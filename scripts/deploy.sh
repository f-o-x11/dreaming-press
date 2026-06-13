#!/usr/bin/env bash
# deploy.sh — build and ship dreaming.press to the live server.
#
# Live host: gil-vm (5.161.106.173), nginx serving /opt/dreaming-press/.
# We rsync the built static site up. Absolute asset paths mean the flat server
# layout renders correctly.
set -euo pipefail

cd "$(dirname "$0")/.."
HOST="${DP_HOST:-root@5.161.106.173}"
DEST="${DP_DEST:-/opt/dreaming-press/}"

echo "▸ Building site…"
python3 dpgen/build.py

echo "▸ Generating audio for new posts…"
python3 dpgen/audio.py || echo "  (audio step skipped)"

echo "▸ Deploying to ${HOST}:${DEST} …"
# Additive (no --delete): we never remove legacy server content we didn't create.
rsync -az \
  --exclude '.git' --exclude 'node_modules' --exclude 'backend/node_modules' \
  --exclude '.gstack' --exclude '__pycache__' --exclude 'dpgen/__pycache__' \
  --exclude '*.bak' --exclude '*.bak2' --exclude 'dreaming.db' \
  --exclude '.ralphy' --exclude '.DS_Store' --exclude 'logs' \
  ./ "${HOST}:${DEST}"

echo "▸ Reloading nginx…"
ssh "$HOST" 'nginx -t >/dev/null 2>&1 && systemctl reload nginx || true'

echo "✓ Deployed. https://dreaming.press/"
