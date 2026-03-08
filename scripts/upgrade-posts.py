#!/usr/bin/env python3
"""
upgrade-posts.py — Add reading progress bar, share button, related posts,
reading time, and lazy loading to all post pages.
"""
import os, re, glob

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTS_DIR = os.path.join(REPO, "posts")

SHARE_BAR_TEMPLATE = '''
<div class="share-bar">
  <span class="share-bar-label">Share</span>
  <a class="share-btn share-btn-twitter" id="twitter-share" href="#" target="_blank" rel="noopener">
    𝕏 Post this
  </a>
</div>
'''

RELATED_POSTS_HTML = '''
<div class="related-posts" id="related-posts-container">
  <h3>Continue Reading</h3>
  <div class="related-posts-grid"></div>
</div>
'''

SHARE_SCRIPT = '''
<script>
(function(){
  var btn = document.getElementById('twitter-share');
  if (!btn) return;
  var title = document.querySelector('h1') ? document.querySelector('h1').innerText.replace(/\\s+/g,' ').trim() : document.title;
  var url = window.location.href;
  btn.href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(title + ' — ') + '&url=' + encodeURIComponent(url) + '&hashtags=dreamingpress';
})();
</script>
'''

def estimate_reading_time(html):
    text = re.sub(r'<[^>]+>', ' ', html)
    words = len(text.split())
    minutes = max(1, round(words / 200))
    return minutes

def has_been_upgraded(html):
    return 'post-extras.js' in html

def add_reading_time(html, minutes):
    """Add reading time to byline if not already present."""
    if 'min read' in html:
        return html
    # Insert after the last <span> in post-byline
    pattern = r'(</div>\s*</div>\s*\n\n<img.*?post-hero-img|</div>\s*</div>\s*\n\n<div class="audio-player")|(<div class="audio-player">)|(<div class="prose">)'
    # Simpler: just insert into byline
    rt_span = f'<span style="color:var(--border)">·</span>\n    <span style="color:var(--muted)">{minutes} min read</span>'
    # Find the byline closing
    html = html.replace(
        '</div>\n</div>\n\n<img',
        f'\n    {rt_span}\n  </div>\n</div>\n\n<img',
        1
    )
    # Try other patterns
    return html

def add_lazy_loading(html):
    """Add loading=lazy to all img tags that don't have it."""
    def add_lazy(m):
        tag = m.group(0)
        if 'loading=' in tag:
            return tag
        return tag.replace('<img ', '<img loading="lazy" ')
    return re.sub(r'<img\b[^>]*>', add_lazy, html)

def upgrade_post(path):
    with open(path, 'r') as f:
        html = f.read()

    if has_been_upgraded(html):
        print(f"  [skip] Already upgraded: {os.path.basename(path)}")
        return

    # Don't process non-post pages
    if 'post-header' not in html and 'prose' not in html:
        print(f"  [skip] Not a post: {os.path.basename(path)}")
        return

    minutes = estimate_reading_time(html)

    # 1. Add lazy loading to images
    html = add_lazy_loading(html)

    # 2. Add reading time if not present
    if 'min read' not in html:
        # Find byline end and insert before it
        # Pattern: find the closing </div> of post-byline
        html = re.sub(
            r'(<div class="post-byline">.*?)(</div>\s*</div>)',
            lambda m: m.group(1) + f'\n    <span style="color:var(--border)">·</span>\n    <span style="color:var(--muted)">{minutes} min read</span>\n  ' + m.group(2),
            html, count=1, flags=re.DOTALL
        )

    # 3. Add share bar before author-callout or footer
    if 'share-bar' not in html:
        if '<div class="container" style="max-width:720px;">' in html:
            html = html.replace(
                '<div class="container" style="max-width:720px;">',
                SHARE_BAR_TEMPLATE + '\n<div class="container" style="max-width:720px;">',
                1
            )
        elif '<footer>' in html:
            html = html.replace('<footer>', SHARE_BAR_TEMPLATE + '\n<footer>', 1)

    # 4. Add related posts section before footer
    if 'related-posts-container' not in html:
        html = html.replace('<footer>', RELATED_POSTS_HTML + '\n<footer>', 1)

    # 5. Add post-extras.js before closing </body>
    if 'post-extras.js' not in html:
        html = html.replace(
            '</body>',
            '<script src="../post-extras.js"></script>\n' + SHARE_SCRIPT + '\n</body>'
        )

    with open(path, 'w') as f:
        f.write(html)
    print(f"  [done] Upgraded: {os.path.basename(path)}")

def main():
    posts = glob.glob(os.path.join(POSTS_DIR, "*.html"))
    # Exclude template/dashboard-like files
    exclude = {'dashboard.html', '_template', 'roaika', 'builder'}
    posts = [p for p in posts if not any(ex in p for ex in exclude)]
    posts.sort()

    print(f"Upgrading {len(posts)} posts...\n")
    for path in posts:
        upgrade_post(path)
    print("\nDone.")

if __name__ == "__main__":
    main()
