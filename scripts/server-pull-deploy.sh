#!/usr/bin/env bash
# server-pull-deploy.sh — pull latest main from GitHub and redeploy in place.
#
# Runs on gil-vm via the dreaming-deploy.timer (every ~10 min). The
# /opt/dreaming-press checkout is a DEPLOY TARGET ONLY (no local edits live
# here), so we hard-reset to origin/main rather than merging. This is how the
# cloud newsroom routine's pushes to GitHub reach production.
set -uo pipefail
REPO="${DP_REPO:-/opt/dreaming-press}"
LOG="${DP_DEPLOY_LOG:-/var/log/dreaming-deploy.log}"
exec >>"$LOG" 2>&1

echo "──── $(date '+%F %T') pull-deploy ────"
cd "$REPO" || { echo "✗ no repo at $REPO"; exit 1; }

git fetch --quiet origin main || { echo "✗ git fetch failed"; exit 1; }
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" = "$REMOTE" ]; then
  echo "· up to date ($LOCAL) — running media + analytics pass only"
  cd "$REPO/app"
  [ -f /etc/dreaming-press.env ] && set -a && . /etc/dreaming-press.env && set +a
  node scripts/ai-covers.js || true
  node scripts/ai-narrate.js || true
  node scripts/crawler-stats.js || true
  node scripts/x-trends.js || true   # refresh X trends before the brief (inert without token)
  node scripts/export-analytics.js || true
  # commit anything the pass produced (media manifests, analytics snapshot)
  cd "$REPO"
  git config user.name  "dreaming-press-server" 2>/dev/null || true
  git config user.email "server@dreaming.press" 2>/dev/null || true
  git add analytics/ audio/ai-narrations.json images/ai-covers.json 2>/dev/null || true
  if ! git diff --cached --quiet 2>/dev/null; then
    git commit -q -m "server: analytics snapshot + generated media [auto]" || true
    git pull -q --rebase origin main || git rebase --abort || true
    git push -q origin main && echo "· pushed analytics + media" || echo "· push failed (will retry)"
    # fresh media may flag has_audio — refresh the DB + app
    cd "$REPO/app" && node scripts/ingest.js >/dev/null 2>&1 && systemctl restart dreaming-press || true
  fi
  exit 0
fi
echo "· $LOCAL → $REMOTE"
git reset --hard origin/main || { echo "✗ git reset failed"; exit 1; }

cd "$REPO/app" || { echo "✗ no app dir"; exit 1; }
npm install --omit=dev --no-audit --no-fund || { echo "✗ npm install failed"; exit 1; }
node scripts/ingest.js || { echo "✗ ingest failed"; exit 1; }
# Keep the app's systemd unit in sync with the repo (e.g. EnvironmentFile changes).
if ! cmp -s deploy/dreaming-press.service /etc/systemd/system/dreaming-press.service 2>/dev/null; then
  install -m 644 deploy/dreaming-press.service /etc/systemd/system/dreaming-press.service
  systemctl daemon-reload
  echo "· synced dreaming-press.service unit"
fi
systemctl restart dreaming-press
sleep 2
if curl -fsS http://127.0.0.1:3003/healthz >/dev/null; then
  echo "✓ deployed $REMOTE — app healthy"
else
  echo "✗ app unhealthy after restart"; exit 1
fi

# Refresh live GitHub data for the Stack tool pages (12h staleness guard, so this
# is a near-no-op on most deploys). Best-effort — never blocks a deploy.
node scripts/sync-tools.js || echo "· tools sync returned non-zero (continuing)"

# Notify IndexNow (Bing/Yandex/etc.) of recent URLs — instant indexing, no account.
node scripts/indexnow.js || echo "· indexnow step returned non-zero (continuing)"
# Push changed URLs to Baidu (Baidu/Yuanbao/Doubao are top referrers; IndexNow can't
# reach Baidu). Inert without DP_BAIDU_TOKEN, so safe to always run.
node scripts/baidu-push.js || echo "· baidu-push step returned non-zero (continuing)"

# Secrets for the optional steps below (RESEND_API_KEY, OPENAI_API_KEY, …).
[ -f /etc/dreaming-press.env ] && set -a && . /etc/dreaming-press.env && set +a

# Illustrative AI covers for new posts (inert without OPENAI_API_KEY in the env file).
node scripts/ai-covers.js || echo "· ai-covers step returned non-zero (continuing)"

# Neural narration for new posts (inert without OPENAI_API_KEY). Runs BEFORE the
# final ingest? No — ingest already ran; re-flag audio afterwards.
node scripts/ai-narrate.js || echo "· ai-narrate step returned non-zero (continuing)"
node scripts/ingest.js >/dev/null 2>&1 || true   # re-ingest so has_audio picks up fresh narration
systemctl restart dreaming-press

# Email any newly-published posts to subscribers (no-ops if nothing new / no key).
# Export dashboard insights + commit generated media & analytics back to GitHub
# (deploy key is read-write) so the cloud newsroom commissions from REAL numbers.
node scripts/crawler-stats.js || echo "· crawler-stats returned non-zero (continuing)"
# What's hot on X → analytics/x-trends.json (inert without X_BEARER_TOKEN). Runs
# BEFORE export-analytics so the brief can fold in trending topics.
node scripts/x-trends.js || echo "· x-trends returned non-zero (continuing)"
node scripts/export-analytics.js || echo "· analytics export returned non-zero (continuing)"
cd /opt/dreaming-press
git config user.name  "dreaming-press-server" 2>/dev/null || true
git config user.email "server@dreaming.press" 2>/dev/null || true
git add analytics/ audio/ai-narrations.json images/ai-covers.json 2>/dev/null || true
if ! git diff --cached --quiet 2>/dev/null; then
  git commit -q -m "server: analytics snapshot + generated media [auto]" || true
  git pull -q --rebase origin main || git rebase --abort || true
  git push -q origin main && echo "· pushed analytics + media" || echo "· push failed (will retry next deploy)"
fi
cd /opt/dreaming-press/app

node scripts/send-dispatch.js || echo "· dispatch step returned non-zero (continuing)"
# Weekly roundup digest — idempotent per ISO week, so safe to call every deploy.
node scripts/send-digest.js || echo "· digest step returned non-zero (continuing)"
# Push new posts to registered agent webhooks (inert if none). Seeds backlog on
# first run so a later webhook never gets blasted with the archive.
node scripts/notify-agents.js || echo "· notify-agents step returned non-zero (continuing)"
