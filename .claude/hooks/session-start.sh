#!/bin/bash
# SessionStart hook for dreaming.press.
# The Node app lives in app/ and its node_modules is gitignored, so a fresh
# Claude Code on the web clone starts with the quality gates broken:
# `node scripts/ingest.js` and `npm test` fail with ERR_MODULE_NOT_FOUND
# until dependencies are installed. This installs them so the gates
# (ingest → npm test → visual-qa) work from the first turn.
set -euo pipefail

# Only run in the remote (Claude Code on the web) environment; a local dev
# machine manages its own node_modules.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR/app"

# Idempotent + cache-friendly: npm install is a no-op when node_modules is
# already present and current, and takes advantage of the container's cached
# state on resume (preferred over npm ci, which wipes and reinstalls).
npm install --no-audit --no-fund
