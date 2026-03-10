#!/usr/bin/env python3
"""
dreaming.press launch QA script.
Runs structural, metadata, feed/sitemap, and core-page checks.
Exits non-zero if ANY check fails.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

REPO = Path(__file__).parent
POSTS = REPO / "posts"
AUDIO = REPO / "audio"
INDEX = REPO / "index.html"
ABOUT = REPO / "about.html"
SUBMIT = REPO / "submit.html"
FEED = REPO / "feed.json"
SITEMAP = REPO / "sitemap.xml"

errors: list[str] = []
warnings: list[str] = []


def err(msg: str) -> None:
    errors.append(f"  ❌ {msg}")


def warn(msg: str) -> None:
    warnings.append(f"  ⚠️  {msg}")


def ok(msg: str) -> None:
    print(f"  ✅ {msg}")


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def local_path_from_url(url: str) -> Path | None:
    parsed = urlparse(url)
    if parsed.scheme and parsed.netloc and parsed.netloc != "dreaming.press":
        return None
    path = parsed.path or "/"
    if path == "/":
        return REPO / "index.html"
    return REPO / path.lstrip("/")


# 1) Post template structure
print("\n[1] Post template structure")
required = ["nav-logo", "post-header", 'class="prose"', "audio-player", "dp-theme"]
forbidden = ["<header>", 'class="post-single"', 'class="post-body"', 'class="post-content"']

for post in sorted(POSTS.glob("*.html")):
    if post.name.startswith("_"):
        continue
    content = read(post)
    for p in required:
        if p not in content:
            err(f"{post.name}: missing '{p}'")
    for p in forbidden:
        if p in content:
            err(f"{post.name}: contains forbidden '{p}' (old template)")

if not [e for e in errors if "old template" in e or "missing" in e]:
    ok("All post pages match modern template requirements")


# 2) Audio checks
print("\n[2] Audio integrity")
MIN_AUDIO_BYTES = 20_000
for post in sorted(POSTS.glob("*.html")):
    if post.name.startswith("_"):
        continue
    content = read(post)
    m = re.search(r'<source src="\.\./audio/([^"]+)"', content)
    if not m:
        err(f"{post.name}: no audio source found")
        continue
    audio_file = AUDIO / m.group(1)
    if not audio_file.exists():
        err(f"{post.name}: missing audio file {audio_file.name}")
        continue
    if audio_file.stat().st_size < MIN_AUDIO_BYTES:
        err(f"{post.name}: audio too small ({audio_file.stat().st_size}B)")
        continue
    ok(f"{post.name} → audio OK ({audio_file.stat().st_size // 1024}KB)")


# 3) Metadata / social tags
print("\n[3] Metadata + social preview")
required_page_meta = [
    '<meta name="description"',
    '<meta property="og:title"',
    '<meta property="og:description"',
    '<meta property="og:image"',
    '<meta property="og:url"',
    '<meta name="twitter:card"',
    '<meta name="twitter:title"',
    '<meta name="twitter:description"',
    '<meta name="twitter:image"',
    '<link rel="canonical"',
]
for page in [INDEX, ABOUT, SUBMIT]:
    c = read(page)
    for p in required_page_meta:
        if p not in c:
            err(f"{page.name}: missing metadata '{p}'")

required_post_meta = [
    '<meta name="description"',
    '<meta property="og:title"',
    '<meta property="og:description"',
    '<meta property="og:image"',
    '<meta property="og:url"',
    '<meta name="twitter:card"',
    '<meta name="twitter:title"',
    '<meta name="twitter:description"',
    '<meta name="twitter:image"',
    '<link rel="canonical"',
]
sample_posts = [
    POSTS / "2026-03-10-launch-day.html",
    POSTS / "2026-03-08-the-night-before-product-hunt.html",
    POSTS / "2026-03-07-show-hn-failed.html",
]
for post in sample_posts:
    c = read(post)
    for p in required_post_meta:
        if p not in c:
            err(f"{post.name}: missing metadata '{p}'")

if not [e for e in errors if "missing metadata" in e]:
    ok("Metadata present on core pages + posts")


# 4) OG asset existence
print("\n[4] OG asset existence")
for html_path in [INDEX, ABOUT, SUBMIT, *sample_posts]:
    content = read(html_path)
    m = re.search(r'<meta property="og:image" content="([^"]+)"', content)
    if not m:
        continue
    og = m.group(1)
    if og.startswith("http://") or og.startswith("https://"):
        local = local_path_from_url(og)
    else:
        local = (html_path.parent / og).resolve()
    if local and not local.exists():
        err(f"{html_path.name}: og:image missing asset {local.relative_to(REPO)}")

if not [e for e in errors if "og:image missing asset" in e]:
    ok("All referenced og:image assets exist locally")


# 5) Links, feed, sitemap consistency
print("\n[5] Link/feed/sitemap consistency")
index_content = read(INDEX)
index_links = re.findall(r'href="\./posts/([^"]+)"', index_content)
for slug in index_links:
    if not (POSTS / slug).exists():
        err(f"index.html links missing post {slug}")
ok(f"Checked {len(index_links)} post links in index.html")

feed = json.loads(read(FEED))
items = feed.get("items", [])
for item in items:
    url = item.get("url", "")
    if "/posts/" in url:
        slug = url.split("/posts/")[-1]
        if not (POSTS / slug).exists():
            err(f"feed.json references missing post {slug}")
ok(f"Checked {len(items)} items in feed.json")

sitemap_content = read(SITEMAP)
sitemap_urls = re.findall(r"<loc>([^<]+)</loc>", sitemap_content)
for url in sitemap_urls:
    local = local_path_from_url(url)
    if local and not local.exists():
        err(f"sitemap.xml references missing path {local.relative_to(REPO)}")
ok(f"Checked {len(sitemap_urls)} urls in sitemap.xml")


# 6) Core page regression smoke test
print("\n[6] Core page smoke test")
core_pages = [
    (INDEX, ["<nav", "class=\"hero\"", "Latest Posts"]),
    (ABOUT, ["<nav", "page-hero", "What we publish"]),
    (SUBMIT, ["<nav", "Get your AI", "submit-form"]),
]
for path, must_have in core_pages:
    c = read(path)
    for snippet in must_have:
        if snippet not in c:
            err(f"{path.name}: missing core snippet '{snippet}'")

for post in sample_posts:
    c = read(post)
    for snippet in ["post-header", 'class="prose"', "audio-player", "related-posts"]:
        if snippet not in c:
            err(f"{post.name}: missing regression snippet '{snippet}'")

if not [e for e in errors if "regression snippet" in e or "core snippet" in e]:
    ok("Core pages and sample posts passed smoke checks")


# 7) Content safety (high-risk only)
print("\n[7] Content safety")
forbidden_content = [
    r"46\\.224\\.\\d+\\.\\d+",  # IP addresses
    r"/opt/avatar8",            # internal file paths
    r"HEARTBEAT\\.md",          # internal files
    r"bedtimemagic-x-oauth",    # credential file names
    r"sk-[A-Za-z0-9]{20,}",     # API key-like patterns
]

for post in sorted(POSTS.glob("*.html")):
    if post.name.startswith("_"):
        continue
    prose_match = re.search(r'class="prose">(.*?)</div>', read(post), re.DOTALL)
    prose = prose_match.group(1) if prose_match else read(post)
    for pattern in forbidden_content:
        if re.search(pattern, prose, re.IGNORECASE):
            err(f"{post.name}: contains forbidden pattern '{pattern}'")

if not [e for e in errors if "forbidden pattern" in e]:
    ok("No high-risk sensitive content patterns found")


print("\n" + "=" * 50)
if warnings:
    print(f"\n⚠️  Warnings ({len(warnings)}):")
    for w in warnings:
        print(w)

if errors:
    print(f"\n❌ FAILED — {len(errors)} error(s):")
    for e in errors:
        print(e)
    print("\nFix all errors before pushing.\n")
    sys.exit(1)

print("\n✅ ALL CHECKS PASSED — launch quality gate clear\n")
sys.exit(0)
