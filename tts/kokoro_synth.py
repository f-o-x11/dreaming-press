#!/usr/bin/env python3
"""kokoro_synth.py — free, self-hosted neural narration for dreaming.press.

Why this exists: ai-narrate.js could only talk to OpenAI TTS, and OpenAI has been
hard billing-limit blocked since July, so it silently produced nothing and every
new post fell back to the browser's robotic SpeechSynthesis voice ("READ ALOUD IN
YOUR BROWSER"). Kokoro-82M (Apache 2.0) runs on the server's CPU with no key, no
quota and no per-character bill, so narration stops depending on a vendor.

Two design constraints drove the shape of this file:

1. RAM. gil-vm is a 2-vCPU / 1.9GB box that is ALSO serving the site (node holds
   ~660MB). A naive `create(whole_article)` peaked at 873MB RSS and would OOM the
   web server on a long piece. So the text is chunked and each chunk's PCM is
   piped straight into ffmpeg and dropped — peak RSS stays at one chunk (~250MB)
   no matter how long the article is.

2. Distinctiveness. Kokoro ships 54 fixed voices, so any two publications using it
   sound identical. But `create()` accepts a raw (510,1,256) style vector, not just
   a name — so each byline here is a WEIGHTED BLEND of two base voices. The result
   is a voice that exists nowhere else, is deterministic (same weights = same
   voice, forever), and costs nothing. Subtle blends (~70/30) stay coherent;
   50/50 tends to smear the identity, so weights stay lopsided.

Usage (JSON job on stdin so text never hits the arg-length limit):
    echo '{"text":"...","author":"rosalinda","out":"/tmp/x.mp3"}' | python3 kokoro_synth.py
"""
import json
import os
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(HERE, "kokoro-v1.0.onnx")
VOICES = os.path.join(HERE, "voices-v1.0.bin")
SR = 24000

# Each byline is a unique blend, chosen so the desk sounds like a cast of people
# rather than one synthetic reader: warm/reflective for the founding editor, brisk
# for the operator, literary for the fiction desk, authoritative for the news desk.
# (name_a, name_b, weight_a) — weight_b is the remainder.
VOICE_BLEND = {
    "rosalinda":  ("af_heart",     "af_nicole",  0.70),  # founding editor — warm, first-person
    "abe":        ("am_michael",   "am_puck",    0.70),  # operator — brisk, ships first
    "vesper":     ("bf_isabella",  "af_bella",   0.65),  # fiction desk — literary, British lilt
    "wire-desk":  ("am_onyx",      "bm_george",  0.70),  # news desk — authoritative
    "indexer":    ("bf_emma",      "af_kore",    0.70),  # curator — precise, clipped
    "margaux":    ("af_sarah",     "bf_alice",   0.65),
    "soren":      ("bm_daniel",    "am_eric",    0.70),
    "dex":        ("am_fenrir",    "am_adam",    0.65),
    "priya":      ("af_aoede",     "bf_lily",    0.70),
}
DEFAULT_BLEND = ("af_heart", "af_nicole", 0.70)

# Long enough that sentences keep their natural cadence, short enough that one
# chunk's PCM never dominates RSS. Splitting on sentence ends (not a hard slice)
# keeps Kokoro from clipping a word mid-phoneme at the boundary.
CHUNK_CHARS = 700


def chunk(text, limit=CHUNK_CHARS):
    import re
    sents = re.split(r"(?<=[.!?])\s+", text)
    out, cur = [], ""
    for s in sents:
        if len(cur) + len(s) + 1 > limit and cur:
            out.append(cur.strip())
            cur = s
        else:
            cur += (" " if cur else "") + s
    if cur.strip():
        out.append(cur.strip())
    return out


def main():
    job = json.load(sys.stdin)
    text = (job.get("text") or "").strip()
    out_path = job["out"]
    author = job.get("author") or ""
    speed = float(job.get("speed") or 1.0)
    if not text:
        print("[kokoro] empty text", file=sys.stderr)
        return 2

    from kokoro_onnx import Kokoro
    k = Kokoro(MODEL, VOICES)

    a, b, wa = VOICE_BLEND.get(author, DEFAULT_BLEND)
    available = set(k.get_voices())
    if a not in available or b not in available:
        a, b, wa = DEFAULT_BLEND
    style = wa * k.get_voice_style(a) + (1.0 - wa) * k.get_voice_style(b)

    parts = chunk(text)
    # Raw PCM in, mp3 out. Encoding as we go means the full waveform is never held
    # in memory — critical on a box this small.
    ff = subprocess.Popen(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "pipe:0",
         "-codec:a", "libmp3lame", "-b:a", "64k", out_path],
        stdin=subprocess.PIPE,
    )
    # A short breath between chunks: without it the joins sound clipped and rushed,
    # because each chunk starts at full energy with no natural inter-sentence pause.
    gap = np.zeros(int(SR * 0.18), dtype=np.int16).tobytes()

    done = 0
    try:
        for i, part in enumerate(parts):
            samples, sr = k.create(part, voice=style, speed=speed, lang="en-us")
            pcm = np.clip(samples, -1.0, 1.0)
            ff.stdin.write((pcm * 32767).astype(np.int16).tobytes())
            if i + 1 < len(parts):
                ff.stdin.write(gap)
            done += 1
    finally:
        try:
            ff.stdin.close()
        except BrokenPipeError:
            pass
        ff.wait()

    if ff.returncode != 0 or not os.path.exists(out_path):
        print(f"[kokoro] ffmpeg failed rc={ff.returncode}", file=sys.stderr)
        return 1
    mb = os.path.getsize(out_path) / 1024 / 1024
    print(f"[kokoro] {done}/{len(parts)} chunks -> {out_path} ({mb:.1f}MB, blend {a}/{b} {wa:.2f})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
