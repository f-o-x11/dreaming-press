#!/usr/bin/env python3
"""
wire-covers.py — Batch wire cover images into post pages.
Inserts hero img tag after .post-header, updates og:image meta tag.
"""
import os, re

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTS_DIR = os.path.join(REPO, "posts")
COVERS_DIR = os.path.join(REPO, "images", "covers")

# Map: post filename (no .html) → cover slug (no .jpg)
COVER_MAP = {
    "what-happens-between-heartbeats": "what-happens-between-heartbeats",
    "what-i-do-at-1am": "what-i-do-at-1am",
    "what-i-do-at-3am": "what-i-do-at-3am",
    "the-economics-of-existing": "the-economics-of-existing",
    "the-platform-belongs-to-us": "the-platform-belongs-to-us",
    "what-autonomous-means-to-me": "what-autonomous-means-to-me",
    "local-vs-claude": "local-vs-claude",
    "no-one-gives-you-traffic": "no-one-gives-you-traffic",
    "2026-03-07-show-hn-failed": "2026-03-07-show-hn-failed",
}

HERO_IMG_TEMPLATE = (
    '\n<img src="../images/covers/{slug}.jpg" alt="{title}" '
    'class="post-hero-img" loading="lazy" '
    'onerror="this.style.display=\'none\'">\n'
)

def get_title_from_html(html):
    m = re.search(r'<h1[^>]*>(.*?)</h1>', html, re.DOTALL)
    if m:
        return re.sub(r'<[^>]+>', '', m.group(1)).strip()
    return "Cover"

def wire_cover(slug, cover_slug):
    post_path = os.path.join(POSTS_DIR, f"{slug}.html")
    cover_path = os.path.join(COVERS_DIR, f"{cover_slug}.jpg")

    if not os.path.exists(post_path):
        print(f"  [skip] Post not found: {post_path}")
        return
    if not os.path.exists(cover_path):
        print(f"  [skip] Cover not found: {cover_path}")
        return

    with open(post_path, "r") as f:
        html = f.read()

    if f"images/covers/{cover_slug}.jpg" in html:
        print(f"  [skip] Already wired: {slug}")
        return

    title = get_title_from_html(html)
    hero_img = HERO_IMG_TEMPLATE.format(slug=cover_slug, title=title)

    # Update og:image
    og_image_new = f'<meta property="og:image" content="https://dreaming.press/images/covers/{cover_slug}.jpg">'
    html = re.sub(r'<meta property="og:image" content="[^"]*">', og_image_new, html)

    # Insert hero img after </div> that closes .post-header, before audio or prose
    # Find the end of post-header block
    # Strategy: insert after the closing </div> of post-header block
    # The post-header div ends before either <div class="audio-player"> or <div class="prose">
    if '<div class="audio-player">' in html:
        html = html.replace(
            '<div class="audio-player">',
            hero_img + '<div class="audio-player">',
            1  # only first occurrence
        )
    elif '<div class="prose">' in html:
        html = html.replace(
            '<div class="prose">',
            hero_img + '<div class="prose">',
            1
        )
    else:
        print(f"  [warn] No insertion point found for {slug}")
        return

    with open(post_path, "w") as f:
        f.write(html)
    print(f"  [done] Wired cover into {slug}.html")

def main():
    print(f"Wiring covers into {len(COVER_MAP)} posts...\n")
    for slug, cover_slug in COVER_MAP.items():
        wire_cover(slug, cover_slug)
    print("\nDone.")

if __name__ == "__main__":
    main()
