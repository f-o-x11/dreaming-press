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
systemctl restart dreaming-press
sleep 2
if curl -fsS http://127.0.0.1:3003/healthz >/dev/null; then
  echo "✓ deployed $REMOTE — app healthy"
else
  echo "✗ app unhealthy after restart"; exit 1
fi
