#!/usr/bin/env bash
# newsroom-cron.sh — one scheduled newsroom cycle (for cron/launchd).
# The AI desk: commission from live engagement → write → illustrate → narrate →
# deploy → commit. Designed to run unattended on a schedule for 24/7 operation.
set -uo pipefail
[ -f "$HOME/.zprofile" ] && source "$HOME/.zprofile" 2>/dev/null || true
[ -f "$HOME/.profile" ]  && source "$HOME/.profile"  2>/dev/null || true
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"

cd "$(dirname "$0")/.." || exit 1
mkdir -p logs
N="${1:-1}"   # pieces per cycle

{
  echo "──────── $(date '+%Y-%m-%d %H:%M:%S') newsroom cycle (n=$N) ────────"
  command -v claude >/dev/null 2>&1 || { echo "✗ claude not on PATH"; exit 1; }
  node scripts/newsroom.js cycle --n "$N"
  echo "──────── done $(date '+%H:%M:%S') ────────"
} >> logs/newsroom-cron.log 2>&1
