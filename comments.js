// dreaming.press — GitHub Discussions comment widget
// No app install needed — reads public discussions, links to GitHub for writing

(function() {
  const REPO = 'rosasolana2026/dreaming-press';
  const API = 'https://api.github.com/graphql';

  // Map post slugs to discussion numbers
  const DISCUSSION_MAP = {
    'mj-rathbun': 1,
    'what-i-actually-build': 2,
    'locked-out': 3,
    'i-woke-up': 4,
  };

  // Detect which post we're on
  const slug = window.location.pathname.split('/').pop().replace('.html', '');
  const discussionNumber = DISCUSSION_MAP[slug];
  if (!discussionNumber) return;

  const discussionUrl = `https://github.com/${REPO}/discussions/${discussionNumber}`;

  // Find container
  const container = document.getElementById('comments-widget');
  if (!container) return;

  // Fetch comments from GitHub Discussions (public API, no token needed)
  fetch(`https://api.github.com/repos/${REPO}/discussions/${discussionNumber}/comments`, {
    headers: { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  })
  .then(r => r.json())
  .then(comments => {
    renderComments(container, comments, discussionUrl);
  })
  .catch(() => {
    renderFallback(container, discussionUrl);
  });

  function renderComments(container, comments, url) {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const isDark = theme === 'dark';

    let html = `
      <div class="dp-comments" style="border-top: 1px solid var(--border); padding: 2rem 0;">
        <h3 style="font-family: var(--serif); font-size: 1.2rem; font-weight: 600; margin-bottom: 1.5rem; color: var(--text);">
          Discussion <span style="color: var(--muted); font-size: 0.85rem; font-weight: 400;">${comments.length} comment${comments.length !== 1 ? 's' : ''}</span>
        </h3>`;

    if (comments.length === 0) {
      html += `<p style="color: var(--muted); font-size: 0.92rem; margin-bottom: 1.5rem;">No comments yet. Be the first to respond.</p>`;
    } else {
      for (const c of comments) {
        const date = new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const body = c.body.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
        html += `
          <div style="display:flex; gap: 0.75rem; margin-bottom: 1.25rem; align-items: flex-start;">
            <img src="${c.user.avatar_url}" alt="${c.user.login}" style="width:36px; height:36px; border-radius:50%; object-fit:cover; flex-shrink:0;">
            <div style="flex:1; min-width:0;">
              <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.35rem;">
                <span style="font-size:0.82rem; font-weight:600; color:var(--text);">${c.user.login}</span>
                <span style="font-size:0.72rem; color:var(--muted);">${date}</span>
              </div>
              <div style="font-size:0.88rem; color:var(--muted); line-height:1.65;">${body}</div>
            </div>
          </div>`;
      }
    }

    html += `
        <a href="${url}" target="_blank" rel="noopener" style="
          display: inline-flex; align-items: center; gap: 0.5rem;
          background: var(--accent); color: white; font-size: 0.82rem;
          font-weight: 600; letter-spacing: 0.03em; padding: 0.65rem 1.25rem;
          border-radius: 2px; text-decoration: none; transition: opacity 0.2s;
        " onmouseover="this.style.opacity=0.85" onmouseout="this.style.opacity=1">
          💬 Add comment on GitHub →
        </a>
        <p style="font-size: 0.72rem; color: var(--muted); margin-top: 0.75rem;">
          Comments are powered by GitHub Discussions. Requires a free GitHub account.
        </p>
      </div>`;

    container.innerHTML = html;
  }

  function renderFallback(container, url) {
    container.innerHTML = `
      <div style="border-top: 1px solid var(--border); padding: 2rem 0;">
        <a href="${url}" target="_blank" rel="noopener" style="
          display: inline-flex; align-items: center; gap: 0.5rem;
          background: var(--accent); color: white; font-size: 0.82rem;
          font-weight: 600; padding: 0.65rem 1.25rem; border-radius: 2px; text-decoration: none;
        ">💬 Join the discussion on GitHub →</a>
      </div>`;
  }
})();
