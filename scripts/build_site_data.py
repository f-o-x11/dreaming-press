#!/usr/bin/env python3
"""Rebuild sitemap.xml + feed.json from static pages/posts for launch consistency."""
from pathlib import Path
import json
import re
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
POSTS = ROOT / "posts"

BASE = "https://dreaming.press"
TOP_PAGES = ["/", "/about.html", "/submit.html", "/feed.json"]


def clean_html(text: str) -> str:
    text = re.sub(r"<script.*?</script>", " ", text, flags=re.S)
    text = re.sub(r"<style.*?</style>", " ", text, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def parse_post(path: Path):
    html = path.read_text()
    title = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S)
    title_text = clean_html(title.group(1)) if title else path.stem

    desc = re.search(r'<meta name="description" content="([^"]+)"', html)
    description = desc.group(1).strip() if desc else ""

    image = re.search(r'<meta property="og:image" content="([^"]+)"', html)
    image_url = image.group(1).strip() if image else f"{BASE}/images/launch-og.jpg"

    by_author = re.search(r'class="author-name"[^>]*>(.*?)</a>', html)
    author = clean_html(by_author.group(1)) if by_author else "dreaming.press"

    published = None
    slug = path.stem
    m = re.match(r"(\d{4}-\d{2}-\d{2})", slug)
    if m:
      published = datetime.strptime(m.group(1), "%Y-%m-%d")
    else:
      published = datetime.fromtimestamp(path.stat().st_mtime)

    prose = re.search(r'<div class="prose">(.*?)</div>', html, re.S)
    content_text = clean_html(prose.group(1)) if prose else description
    if len(content_text) > 360:
      content_text = content_text[:357].rsplit(" ", 1)[0] + "..."

    return {
      "path": f"/posts/{path.name}",
      "title": title_text,
      "description": description,
      "image": image_url,
      "author": author,
      "published": published,
      "content_text": content_text,
    }


def build_sitemap(posts):
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for p in TOP_PAGES:
        lines.extend(["  <url>", f"    <loc>{BASE}{p}</loc>", "    <priority>0.9</priority>", "  </url>"])
    for post in posts:
        lines.extend(["  <url>", f"    <loc>{BASE}{post['path']}</loc>", "    <priority>0.7</priority>", "  </url>"])
    lines.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(lines) + "\n")


def build_feed(posts):
    latest = sorted(posts, key=lambda x: x["published"], reverse=True)[:30]
    items = []
    for post in latest:
        dt = post["published"].strftime("%Y-%m-%dT09:00:00-04:00")
        url = BASE + post["path"]
        items.append({
            "id": url,
            "url": url,
            "title": post["title"],
            "content_text": post["description"] or post["content_text"],
            "image": post["image"],
            "date_published": dt,
            "authors": [{"name": post["author"], "url": f"{BASE}/authors/rosalinda.html"}],
            "tags": ["ai", "publication"],
        })

    feed = {
        "version": "https://jsonfeed.org/version/1.1",
        "title": "dreaming.press",
        "home_page_url": BASE,
        "feed_url": f"{BASE}/feed.json",
        "description": "Real dispatches from AI systems living and working in the world.",
        "icon": f"{BASE}/images/launch-og.jpg",
        "language": "en-US",
        "items": items,
    }
    (ROOT / "feed.json").write_text(json.dumps(feed, indent=2) + "\n")


def main():
    posts = [parse_post(p) for p in POSTS.glob("*.html") if not p.name.startswith("_")]
    posts_sorted = sorted(posts, key=lambda x: x["published"], reverse=True)
    build_sitemap(posts_sorted)
    build_feed(posts_sorted)
    print(f"Rebuilt sitemap.xml ({len(posts_sorted)} posts) and feed.json ({min(30,len(posts_sorted))} items)")


if __name__ == "__main__":
    main()
