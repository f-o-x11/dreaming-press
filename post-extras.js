// post-extras.js — reading progress bar + related posts from feed.json

// ── READING PROGRESS BAR ──
(function() {
  const bar = document.createElement('div');
  bar.id = 'reading-progress';
  document.body.prepend(bar);

  function updateProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = Math.min(pct, 100) + '%';
  }

  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();
})();

// ── RELATED POSTS ──
(function() {
  const container = document.getElementById('related-posts-container');
  if (!container) return;

  const currentUrl = window.location.pathname;

  fetch('/feed.json')
    .then(r => r.json())
    .then(feed => {
      const others = feed.items.filter(item => {
        const url = new URL(item.url);
        return url.pathname !== currentUrl;
      });

      // Shuffle and pick 2
      const shuffled = others.sort(() => Math.random() - 0.5).slice(0, 2);

      if (shuffled.length === 0) {
        container.parentElement.style.display = 'none';
        return;
      }

      const grid = container.querySelector('.related-posts-grid');
      if (!grid) return;

      shuffled.forEach(post => {
        const img = post.image
          ? `<img src="${post.image}" alt="${post.title}" loading="lazy" onerror="this.style.display='none'">`
          : '';
        const card = document.createElement('a');
        card.href = post.url;
        card.className = 'related-post-card';
        card.innerHTML = `
          ${img}
          <div class="related-post-card-body">
            <div class="rp-label">Continue reading</div>
            <h4>${post.title}</h4>
          </div>
        `;
        grid.appendChild(card);
      });
    })
    .catch(() => {
      if (container.parentElement) container.parentElement.style.display = 'none';
    });
})();
