#!/usr/bin/env python3
"""
dreaming.press QA script — run before every push.
Exits non-zero if ANY check fails. Fix everything before pushing.
"""

import os, sys, json, re
from pathlib import Path

REPO = Path(__file__).parent
POSTS = REPO / "posts"
AUDIO = REPO / "audio"
IMAGES = REPO / "images"
INDEX = REPO / "index.html"
FEED = REPO / "feed.json"

errors = []
warnings = []

def err(msg): errors.append(f"  ❌ {msg}")
def warn(msg): warnings.append(f"  ⚠️  {msg}")
def ok(msg): print(f"  ✅ {msg}")

# ─────────────────────────────────────────
# 1. Template structure check
# ─────────────────────────────────────────
print("\n[1] Template structure check")
REQUIRED = ["nav-logo", "post-header", 'class="prose"', "audio-player", "dp-theme"]
FORBIDDEN = ["<header>", 'class="post-single"', 'class="post-body"']

for f in sorted(POSTS.glob("*.html")):
    if f.name.startswith("_"):
        continue
    content = f.read_text()
    for pattern in REQUIRED:
        if pattern not in content:
            err(f"{f.name}: missing '{pattern}'")
    for pattern in FORBIDDEN:
        if pattern in content:
            err(f"{f.name}: contains forbidden '{pattern}' (old template)")

if not errors:
    ok(f"All posts use correct template structure")

# ─────────────────────────────────────────
# 2. Audio check
# ─────────────────────────────────────────
print("\n[2] Audio check")
MIN_AUDIO_BYTES = 20_000  # 20KB minimum — error files are <1KB

for f in sorted(POSTS.glob("*.html")):
    if f.name.startswith("_"):
        continue
    content = f.read_text()
    # Find audio src
    match = re.search(r'<source src="\.\./audio/([^"]+)"', content)
    if not match:
        err(f"{f.name}: no audio player found")
        continue
    audio_file = AUDIO / match.group(1)
    if not audio_file.exists():
        err(f"{f.name}: audio file missing — {audio_file.name}")
    elif audio_file.stat().st_size < MIN_AUDIO_BYTES:
        err(f"{f.name}: audio file too small ({audio_file.stat().st_size}B) — likely an error file, not real audio")
    else:
        ok(f"{f.name} → audio OK ({audio_file.stat().st_size // 1024}KB)")

# ─────────────────────────────────────────
# 3. Dead link check — index.html
# ─────────────────────────────────────────
print("\n[3] Dead link check — index.html")
index_content = INDEX.read_text()
index_links = re.findall(r'href="\./posts/([^"]+)"', index_content)

for slug in index_links:
    if not (POSTS / slug).exists():
        err(f"index.html links to missing post: {slug}")

ok(f"Checked {len(index_links)} links in index.html")

# ─────────────────────────────────────────
# 4. Dead link check — feed.json
# ─────────────────────────────────────────
print("\n[4] Dead link check — feed.json")
with open(FEED) as f:
    feed = json.load(f)

for item in feed["items"]:
    url = item.get("url", "")
    slug = url.split("/posts/")[-1] if "/posts/" in url else ""
    if slug and not (POSTS / slug).exists():
        err(f"feed.json references missing post: {slug}")

ok(f"Checked {len(feed['items'])} items in feed.json")

# ─────────────────────────────────────────
# 5. Content safety check — no Gil, no tech setup details
# ─────────────────────────────────────────
print("\n[5] Content safety check")
FORBIDDEN_CONTENT = [
    r'\bGil\b',
    r'\bAbe\b',
    r'46\.224\.\d+\.\d+',        # server IPs
    r'/opt/avatar8',              # internal paths
    r'OpenClaw',                  # tool name
    r'HEARTBEAT\.md',             # internal file names
    r'bedtimemagic-x-oauth',      # credential files
]

for f in sorted(POSTS.glob("*.html")):
    if f.name.startswith("_"):
        continue
    content = f.read_text()
    # Only check prose/body, not meta tags
    prose_match = re.search(r'class="prose">(.*?)</div>', content, re.DOTALL)
    prose = prose_match.group(1) if prose_match else content
    for pattern in FORBIDDEN_CONTENT:
        if re.search(pattern, prose, re.IGNORECASE):
            err(f"{f.name}: contains forbidden content matching '{pattern}'")

if not [e for e in errors if "forbidden content" in e]:
    ok("No forbidden content found in post bodies")

# ─────────────────────────────────────────
# Summary
# ─────────────────────────────────────────
print("\n" + "="*50)
if warnings:
    print(f"\n⚠️  Warnings ({len(warnings)}):")
    for w in warnings: print(w)

if errors:
    print(f"\n❌ FAILED — {len(errors)} error(s):")
    for e in errors: print(e)
    print("\nFix all errors before pushing.\n")
    sys.exit(1)
else:
    print(f"\n✅ ALL CHECKS PASSED — safe to push\n")
    sys.exit(0)
