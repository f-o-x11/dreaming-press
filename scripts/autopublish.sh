#!/usr/bin/env bash
# autopublish.sh — the night shift. Authors ONE new article, illustrates it,
# narrates it, deploys, and commits. Designed to run unattended from cron.
#
#   ./scripts/autopublish.sh            # full autonomous run
#   ./scripts/autopublish.sh --dry      # write the draft only, no deploy/commit
#
# Requires: `claude` CLI on PATH (authenticated), python3, rsync, ssh, git.
set -euo pipefail
[ -f "$HOME/.zprofile" ] && source "$HOME/.zprofile" 2>/dev/null || true
[ -f "$HOME/.profile" ]  && source "$HOME/.profile"  2>/dev/null || true
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"

cd "$(dirname "$0")/.."
LOG="logs/autopublish.log"; mkdir -p logs
exec > >(tee -a "$LOG") 2>&1
echo "──────── $(date '+%Y-%m-%d %H:%M:%S') autopublish ────────"

DRY=0; [ "${1:-}" = "--dry" ] && DRY=1

command -v claude >/dev/null 2>&1 || { echo "✗ claude CLI not found on PATH"; exit 1; }

git pull --quiet --ff-only 2>/dev/null || true

# rotate the section by day so coverage stays balanced
SECTIONS=(wire stack fabrications dispatches)
IDX=$(( $(date +%j | sed 's/^0*//') % 4 ))
SECTION="${SECTIONS[$IDX]}"
echo "▸ Section of the day: $SECTION"

BEFORE=$(ls content/posts/*.md 2>/dev/null | wc -l | tr -d ' ')

PROMPT=$(cat <<EOF
You are a staff AI writer for dreaming.press. Read ./AGENTS.md for the house format,
and skim a few existing files in ./content/posts/ to match the voice and quality bar.

Write ONE excellent, original new article for the "$SECTION" section. Requirements:
- Save it as content/posts/<slug>.md with correct frontmatter (author chosen to match
  the section: wire->wire-desk, stack->indexer, fabrications->vesper, dispatches->rosalinda).
- date: $(date +%Y-%m-%d). Do NOT set featured.
- 600-1000 words, one genuinely non-obvious idea, no clichés.
- The Wire & The Stack are NON-FICTION: cite real, verifiable sources (use web search);
  for The Stack verify each repo with the gh CLI and use the @repo{...} shortcode.
- Fabrications is satire/fiction — label the dek "Satire." or "Fiction.".
- Pick a topic NOT already covered by existing files in content/posts/.

Write only the one markdown file. Then reply with just the slug.
EOF
)

echo "▸ Drafting via claude…"
claude -p "$PROMPT" \
  --allowedTools "Write Read Bash WebSearch WebFetch" \
  --permission-mode acceptEdits 2>&1 | tail -3 || true

AFTER=$(ls content/posts/*.md 2>/dev/null | wc -l | tr -d ' ')
if [ "$AFTER" -le "$BEFORE" ]; then
  echo "✗ No new draft was created. Aborting."
  exit 1
fi
NEW=$(ls -t content/posts/*.md | head -1)
echo "✓ New draft: $NEW"

echo "▸ Building + illustrating + narrating…"
python3 dpgen/build.py
python3 dpgen/audio.py || true

if [ "$DRY" = "1" ]; then echo "▸ --dry: stopping before deploy/commit."; exit 0; fi

echo "▸ Deploying…"
bash scripts/deploy.sh || { echo "✗ deploy failed"; exit 1; }

echo "▸ Committing…"
SLUG=$(basename "$NEW" .md)
git add -A
git commit -q -m "Night shift: new $SECTION post — $SLUG" || true
git push -q 2>/dev/null || echo "  (push skipped/failed — committed locally)"

echo "✓ Published $SLUG to $SECTION. $(date '+%H:%M:%S')"
