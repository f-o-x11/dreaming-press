#!/usr/bin/env python3
"""Regenerate Kokoro TTS audio for posts with broken/missing audio."""
import sqlite3, re, os, subprocess, tempfile, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

DB_PATH    = '/var/www/dreaming-press/backend/dreaming.db'
AUDIO_DIR  = '/var/www/dreaming-press/audio'
MODEL_PATH = os.path.expanduser('~/models/kokoro/kokoro-v1.0.onnx')
VOICES_PATH= os.path.expanduser('~/models/kokoro/voices.bin')
VOICE      = 'af_nova'
LANG       = 'en-us'
SPEED      = 1.0
CHUNK_CHARS= 400  # safe chunk size for kokoro_onnx

def strip_html(html):
    text = re.sub(r'<[^>]+>', ' ', html)
    text = (text.replace('&amp;','&').replace('&lt;','<').replace('&gt;','>')
                .replace('&nbsp;',' ').replace('&quot;','"').replace('&#39;',"'")
                .replace('&mdash;','—').replace('&ndash;','–').replace('&hellip;','...'))
    return re.sub(r'\s+', ' ', text).strip()

def get_duration(path):
    try:
        r = subprocess.run(
            ['ffprobe','-v','error','-show_entries','stream=duration',
             '-of','default=noprint_wrappers=1:nokey=1', path],
            capture_output=True, text=True)
        lines = [l.strip() for l in r.stdout.strip().split('\n') if l.strip()]
        return float(lines[0]) if lines else 0
    except:
        return 0

def is_broken(slug, word_count):
    mp3 = os.path.join(AUDIO_DIR, f'{slug}.mp3')
    if not os.path.exists(mp3):
        return True
    dur = get_duration(mp3)
    if word_count <= 30:
        return dur < 5  # very short posts: just need something
    expected = word_count / 2.5  # expected seconds at 150wpm
    return dur < (expected / 6)  # flag if less than 1/6 expected duration

def split_into_chunks(text, max_chars=CHUNK_CHARS):
    # Split on sentence boundaries
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current = ''
    for s in sentences:
        if len(current) + len(s) + 1 > max_chars:
            if current:
                chunks.append(current.strip())
            # If single sentence is too long, split further
            if len(s) > max_chars:
                parts = [s[i:i+max_chars] for i in range(0, len(s), max_chars)]
                chunks.extend(parts[:-1])
                current = parts[-1]
            else:
                current = s
        else:
            current = (current + ' ' + s).strip() if current else s
    if current:
        chunks.append(current.strip())
    return [c for c in chunks if c.strip()]

def generate_mp3(slug, text, kokoro):
    chunks = split_into_chunks(text)
    if not chunks:
        print(f'  No chunks for {slug}')
        return False

    print(f'  {len(chunks)} chunks...')
    all_samples = []
    sr = 24000
    silence = np.zeros(int(sr * 0.35))  # 350ms gap between chunks

    for i, chunk in enumerate(chunks):
        try:
            samples, sr = kokoro.create(chunk, voice=VOICE, speed=SPEED, lang=LANG)
            all_samples.append(samples)
            if i < len(chunks) - 1:
                all_samples.append(silence)
        except Exception as e:
            print(f'  chunk {i+1} error: {e}')
            continue

    if not all_samples:
        return False

    audio = np.concatenate(all_samples)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        wav_path = f.name
    sf.write(wav_path, audio, sr)

    mp3_path = os.path.join(AUDIO_DIR, f'{slug}.mp3')
    r = subprocess.run(
        ['ffmpeg','-y','-i', wav_path,
         '-codec:a','libmp3lame','-qscale:a','4',
         '-ar','22050', mp3_path],
        capture_output=True, text=True)
    os.unlink(wav_path)

    if r.returncode != 0:
        print(f'  ffmpeg error: {r.stderr[-300:]}')
        return False

    size = os.path.getsize(mp3_path)
    dur  = get_duration(mp3_path)
    print(f'  -> {mp3_path} ({size//1024}KB, {dur:.1f}s)')
    return True

def main():
    dry = '--dry-run' in sys.argv
    slugs = [a for a in sys.argv[1:] if not a.startswith('--')]

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    if slugs:
        posts = [conn.execute("SELECT slug,title,content,word_count FROM posts WHERE slug=?", (s,)).fetchone() for s in slugs]
        posts = [p for p in posts if p]
    else:
        posts = conn.execute(
            "SELECT slug,title,content,word_count FROM posts WHERE status='published' ORDER BY word_count DESC"
        ).fetchall()

    todo = []
    for p in posts:
        if is_broken(p['slug'], p['word_count']):
            todo.append(p)

    print(f'Posts needing audio: {len(todo)}')
    for p in todo:
        mp3 = os.path.join(AUDIO_DIR, f"{p['slug']}.mp3")
        dur = get_duration(mp3) if os.path.exists(mp3) else 0
        print(f'  {p["slug"]} ({p["word_count"]}w, cur={dur:.0f}s)')

    if dry or not todo:
        conn.close()
        return

    os.makedirs(AUDIO_DIR, exist_ok=True)
    print(f'\nLoading Kokoro model...')
    kokoro = Kokoro(MODEL_PATH, VOICES_PATH)
    print('Model loaded.\n')

    ok = 0
    for p in todo:
        print(f'[{ok+1}/{len(todo)}] {p["slug"]}')
        text = strip_html(p['content'])
        if not text:
            print('  Empty content, skip')
            continue
        if generate_mp3(p['slug'], text, kokoro):
            ok += 1
        else:
            print(f'  FAILED: {p["slug"]}')

    print(f'\nDone: {ok}/{len(todo)} regenerated.')
    conn.close()

if __name__ == '__main__':
    main()
