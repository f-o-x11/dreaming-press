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
  echo "· up to date ($LOCAL)"; exit 0
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

# Email any newly-published posts to subscribers (no-ops if nothing new / no key).
[ -f /etc/dreaming-press.env ] && set -a && . /etc/dreaming-press.env && set +a
node scripts/send-dispatch.js || echo "· dispatch step returned non-zero (continuing)"
# Weekly roundup digest — idempotent per ISO week, so safe to call every deploy.
node scripts/send-digest.js || echo "· digest step returned non-zero (continuing)"
