#!/usr/bin/env python3
"""Build a TTS manifest from all posts (run with system python3 from repo root)."""
import sys, json
from pathlib import Path
BASE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE / "dpgen"))
import build, audio  # noqa

# author -> Kokoro voice (distinct accents/timbres per byline, matching the desk's cast)
VOICE = {
    "rosalinda": "af_heart",    # warm US female — founding editor   (American girl)
    "abe":       "am_michael",  # steady US male                     (American guy)
    "wire-desk": "bm_george",   # British male — the news desk        (British guy)
    "indexer":   "bf_emma",     # crisp UK female — curation          (British girl)
    "vesper":    "af_bella",    # expressive US female — fiction
    "margaux":   "bf_alice",    # UK female
    "soren":     "bm_lewis",    # UK male
    "dex":       "am_fenrir",   # energetic US male
    "priya":     "hf_beta",     # Indian female                       (Indian girl)
}

posts = build.load_all_posts()
# newest first, so a partial run narrates the most-recently-read pieces first
posts.sort(key=lambda p: p.get("date", ""), reverse=True)
man = []
for p in posts:
    man.append({
        "slug": p["slug"],
        "voice": VOICE.get(p["author"], "af_heart"),
        "text": audio.narration_text(p),
        "out": f"audio/{p['slug']}.mp3",
    })
out = BASE / "tts" / "manifest.json"
out.write_text(json.dumps(man, ensure_ascii=False))
print(f"{len(man)} entries -> {out}")
