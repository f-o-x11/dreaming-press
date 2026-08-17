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
  # One backfill piece per IDLE cycle. The default run above only considers posts
  # from the last RECENT_DAYS (3), so anything that misses that window — a cycle
  # skipped on low RAM, a piece published during an outage — is silent FOREVER.
  # Measured: 604 of 1,840 posts have no narration, and 8 of the newest 25 had
  # aged out while the queue cheerfully reported "nothing new to narrate". A
  # permanent gap that reports itself as done is this codebase's recurring failure.
  # Deliberately on the IDLE branch, not the deploy branch: this is the path taken
  # when there is nothing new to ship, so ~90s of nice'd CPU is spare capacity
  # rather than contention with covers, narration and ingest for fresh content.
  # It also honours DP_TTS_MIN_FREE_MB, so it yields entirely when RAM is tight.
  node scripts/ai-narrate.js --backfill --limit 1 || true
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
# Join crawl volume against referred sessions -> analytics/crawl-yield.json.
# Must run AFTER crawler-stats (it reads crawlers.json) and BEFORE export-analytics
# (which folds the ratio into the brief).
node scripts/crawl-yield.js --quiet || echo "· crawl-yield returned non-zero (continuing)"
# What's hot on X → analytics/x-trends.json (inert without X_BEARER_TOKEN). Runs
# BEFORE export-analytics so the brief can fold in trending topics.
node scripts/x-trends.js || echo "· x-trends returned non-zero (continuing)"
# Google + Bing autocomplete → analytics/search-demand.json. Keyless, but it is a
# network call per seed, so it runs at most every 6h (the phrases move slowly and
# the deploy fires every 10 minutes — refetching 25 seeds x 2 engines every cycle
# would be 300 pointless requests an hour against two public endpoints).
# NOTE the ../ — cwd here is $REPO/app (set at line 45), but the script resolves
# its output to $REPO/analytics. Testing the bare relative path looked at
# $REPO/app/analytics/, which never exists, so the freshness gate always passed
# and the fetch ran on EVERY deploy — the exact hammering this gate exists to stop.
# Gate on the data's OWN timestamp, not the file's mtime. analytics/ is
# git-tracked and this deploy runs `git reset --hard`, which stamps checked-out
# files with the checkout time — so mtime reports "fresh" on arbitrarily stale
# data and the refresh would silently never run again. fetched_at cannot lie.
DP_SD_AGE_H=$(node -e '
  try {
    const j = require("../analytics/search-demand.json");
    const h = (Date.now() - Date.parse(j.fetched_at)) / 3600000;
    process.stdout.write(String(Number.isFinite(h) ? Math.round(h) : 999));
  } catch { process.stdout.write("999"); }
' 2>/dev/null || echo 999)
if [ "${DP_SD_AGE_H:-999}" -ge 6 ]; then
  node scripts/search-demand.js --quiet || echo "· search-demand returned non-zero (continuing)"
fi
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
# Cross-post older Wire/Stack pieces to dev.to with rel=canonical back here.
# INERT without DEVTO_API_KEY — it prints how many are eligible and exits, so this
# line is a no-op today. It is wired now precisely BECAUSE it is owner-gated: the
# script was written, tested and left un-called, so adding the key would have
# changed nothing and the gap would have looked like the key not working.
# Targets pieces 7-14 days old so the origin indexes first, and tracks what it
# sent, so it cannot double-post. D8 (off-domain distribution) is the lowest-
# scoring dimension on the board at 1/10 and 432 pieces are eligible right now.
node scripts/syndicate.js || echo "· syndicate returned non-zero (continuing)"
