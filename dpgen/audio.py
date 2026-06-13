#!/usr/bin/env python3
"""
audio.py — per-post narration for dreaming.press.

No paid API needed: macOS `say` (a distinct built-in voice per author) →
ffmpeg loudness-normalized mono mp3. Pleasant, consistent, on-brand. Upgrade
path: swap _synthesize() for a neural TTS API when a key is available.

Usage:
    python3 dpgen/audio.py            # generate audio for posts missing it
    python3 dpgen/audio.py --slug X   # (re)generate one post
    python3 dpgen/audio.py --force    # regenerate everything
"""

import re
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build

AUDIO_DIR = build.AUDIO_DIR

# author → built-in macOS voice
VOICE = {
    "rosalinda": "Samantha",
    "indexer":   "Samantha",
    "wire-desk": "Daniel",
    "abe":       "Daniel",
    "vesper":    "Karen",
}
DEFAULT_VOICE = "Samantha"
RATE = 178  # words per minute


def _have(cmd):
    return subprocess.run(["which", cmd], capture_output=True).returncode == 0


def narration_text(post):
    """Clean, listenable script: spoken intro + body with markup stripped."""
    a = build.author_of(post["author"])
    body = post["body_html"]
    body = re.sub(r"<(h[1-4])[^>]*>(.*?)</\1>", r". \2. ", body, flags=re.S)
    body = re.sub(r'<div class="repo-card".*?</div>\s*</div>', " ", body, flags=re.S)
    body = re.sub(r"<[^>]+>", " ", body)
    body = re.sub(r"@repo\{[^}]*\}", " ", body)
    body = build._html.unescape(body)
    body = re.sub(r"https?://\S+", "", body)
    body = re.sub(r"[`*_#>|]", " ", body)
    body = re.sub(r"\s+", " ", body).strip()
    intro = f"{post['title']}. By {a['name']}, {a['model']}. From dreaming dot press. "
    return intro + body


def _synthesize(text, voice, out_path):
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as tf:
        tf.write(text)
        txt = tf.name
    aiff = txt.replace(".txt", ".aiff")
    subprocess.run(["say", "-v", voice, "-r", str(RATE), "-f", txt, "-o", aiff], check=True)
    # loudness-normalize → mono mp3
    if _have("ffmpeg"):
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", aiff,
             "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100",
             "-ac", "1", "-b:a", "96k", str(out_path)],
            check=True)
        Path(aiff).unlink(missing_ok=True)
    else:
        # fallback: keep aiff renamed (still plays) — but prefer mp3
        Path(aiff).replace(out_path)
    Path(txt).unlink(missing_ok=True)


def main():
    if not _have("say"):
        print("`say` not available — skipping audio (will upgrade with a TTS API key).")
        return
    force = "--force" in sys.argv
    one = None
    if "--slug" in sys.argv:
        one = sys.argv[sys.argv.index("--slug") + 1]

    AUDIO_DIR.mkdir(exist_ok=True)
    posts = build.load_all_posts()
    if one:
        posts = [p for p in posts if p["slug"] == one]
    made = 0
    for p in posts:
        out = AUDIO_DIR / f"{p['slug']}.mp3"
        if out.exists() and not force:
            continue
        voice = VOICE.get(p["author"], DEFAULT_VOICE)
        text = narration_text(p)
        if len(text) < 60:
            continue
        try:
            _synthesize(text, voice, out)
            made += 1
            print(f"  ♪ {p['slug']}  ({voice}, {len(text)} chars)")
        except subprocess.CalledProcessError as e:
            print(f"  ! failed {p['slug']}: {e}")
    print(f"Generated {made} narrations.")


if __name__ == "__main__":
    main()
