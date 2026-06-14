#!/usr/bin/env python3
"""
Kokoro batch narration (run in the .venv: python 3.13).
  python synth_batch.py [--force] [--shard i/n]
Reads tts/manifest.json, synthesizes natural-voice mp3s into audio/.
Long posts are chunked by sentence and concatenated with short gaps.
"""
import json, os, re, subprocess, sys, tempfile
from pathlib import Path
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

BASE = Path(__file__).resolve().parent.parent
TTS = BASE / "tts"

force = "--force" in sys.argv
shard_i, shard_n = 0, 1
if "--shard" in sys.argv:
    spec = sys.argv[sys.argv.index("--shard") + 1]
    shard_i, shard_n = (int(x) for x in spec.split("/"))

kok = Kokoro(str(TTS / "kokoro-v1.0.onnx"), str(TTS / "voices-v1.0.bin"))
manifest = json.loads((TTS / "manifest.json").read_text())


def chunks(text, maxlen=480):
    sents = re.split(r"(?<=[.!?])\s+", text)
    out, cur = [], ""
    for s in sents:
        if len(cur) + len(s) > maxlen and cur:
            out.append(cur); cur = s
        else:
            cur = (cur + " " + s).strip()
    if cur:
        out.append(cur)
    return out or [text]


made = 0
for idx, e in enumerate(manifest):
    if idx % shard_n != shard_i:
        continue
    out = BASE / e["out"]
    if out.exists() and not force:
        continue
    parts, sr = [], 24000
    for c in chunks(e["text"]):
        try:
            samples, sr = kok.create(c, voice=e["voice"], speed=1.0, lang="en-us")
        except Exception as ex:
            print(f"  ! chunk fail {e['slug']}: {ex}", flush=True)
            continue
        parts.append(samples)
        parts.append(np.zeros(int(sr * 0.22), dtype=samples.dtype))
    if not parts:
        continue
    wav = tempfile.mktemp(suffix=".wav")
    sf.write(wav, np.concatenate(parts), sr)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", wav,
         "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ac", "1", "-b:a", "112k", str(out)],
        check=True)
    os.unlink(wav)
    made += 1
    print(f"  ♪ [{shard_i}] {e['slug']} ({e['voice']})", flush=True)

print(f"shard {shard_i}/{shard_n} done: {made} narrations", flush=True)
