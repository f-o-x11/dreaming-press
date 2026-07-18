#!/usr/bin/env bash
# Robust ongoing Kokoro narration — run from the repo (has the tts/.venv + model).
# Prevents the coverage drift where new newsroom posts fall back to the monotone
# browser voice: always sync content FIRST, then narrate every un-voiced post.
#   scripts/narrate-cycle.sh          # start/continue narration (background synth)
#   scripts/narrate-cycle.sh --commit # commit + push + deploy whatever's done
set -uo pipefail
cd "$(dirname "$0")/.."

commit_and_deploy() {
  git add audio/*.mp3 2>/dev/null || true
  if git diff --cached --quiet; then echo "nothing new to commit"; return; fi
  N=$(git diff --cached --name-only | grep -c 'audio/.*\.mp3')
  git commit -q -m "Kokoro: narrate $N posts (ongoing)"
  git pull -q --rebase -X theirs origin main >/dev/null 2>&1 || true
  git push -q origin main >/dev/null 2>&1 && echo "pushed $N mp3s"
  ssh -o ConnectTimeout=15 root@5.161.106.173 'systemctl start dreaming-deploy.service' >/dev/null 2>&1 || true
}

if [ "${1:-}" = "--commit" ]; then commit_and_deploy; exit 0; fi

# 1. commit any pending audio so the pull is clean, then SYNC content (critical:
#    build the manifest from the same posts the live site has, never stale).
git add audio/*.mp3 2>/dev/null || true
git diff --cached --quiet || git commit -q -m "Kokoro: pending audio (pre-sync)" >/dev/null 2>&1 || true
git pull -q --rebase -X theirs origin main >/dev/null 2>&1 || true

# 2. rebuild the manifest from current content and report the gap.
python3 tts/make_manifest.py >/dev/null 2>&1
GAP=$(python3 -c "import json,os;m=json.load(open('tts/manifest.json'));print(sum(1 for e in m if not os.path.exists(e['out'])))")
echo "un-voiced posts: $GAP"

# 3. narrate the gap (background; newest-first; skips existing). Only start if not
#    already running, so repeated ticks don't spawn duplicates.
if [ "$GAP" -gt 0 ]; then
  if pgrep -f "synth_batch.py" >/dev/null; then echo "synth already running"; else
    ( cd tts && nohup .venv/bin/python synth_batch.py > /tmp/kokoro-synth.log 2>&1 & )
    echo "synth started for $GAP posts"
  fi
fi
