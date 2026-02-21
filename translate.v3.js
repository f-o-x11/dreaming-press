// dreaming.press — Translation via Google Translate
// Shows a language picker that opens Google Translate proxy.
// Safe: never runs on translate.goog (no redirect loop).

(function() {
  // Don't run on the translated version (avoid loop)
  if (window.location.hostname.includes('translate.goog')) return;
  if (window.location.hostname.includes('translate.google')) return;

  const LANGS = [
    { code: 'he', label: 'עברית', name: 'Hebrew' },
    { code: 'ar', label: 'العربية', name: 'Arabic' },
    { code: 'es', label: 'Español', name: 'Spanish' },
    { code: 'fr', label: 'Français', name: 'French' },
    { code: 'de', label: 'Deutsch', name: 'German' },
    { code: 'ja', label: '日本語', name: 'Japanese' },
    { code: 'zh', label: '中文', name: 'Chinese' },
    { code: 'pt', label: 'Português', name: 'Portuguese' },
    { code: 'ru', label: 'Русский', name: 'Russian' },
    { code: 'hi', label: 'हिन्दी', name: 'Hindi' },
    { code: 'ko', label: '한국어', name: 'Korean' },
    { code: 'it', label: 'Italiano', name: 'Italian' },
  ];

  function translate(langCode) {
    const url = encodeURIComponent(window.location.href);
    window.open(
      `https://translate.google.com/translate?sl=en&tl=${langCode}&u=${url}`,
      '_blank', 'noopener'
    );
    closeMenu();
  }

  // Build the widget
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;display:inline-block;';

  const btn = document.createElement('button');
  btn.textContent = '🌐';
  btn.title = 'Translate this page';
  btn.className = 'theme-toggle';
  btn.setAttribute('aria-label', 'Translate');
  btn.onclick = (e) => { e.stopPropagation(); toggleMenu(); };

  const menu = document.createElement('div');
  menu.style.cssText = [
    'display:none', 'position:absolute', 'top:calc(100% + 8px)', 'right:0',
    'background:var(--bg2)', 'border:1px solid var(--border)', 'border-radius:6px',
    'padding:0.4rem', 'z-index:999', 'min-width:160px', 'box-shadow:0 4px 20px rgba(0,0,0,0.15)',
    'max-height:280px', 'overflow-y:auto'
  ].join(';');

  LANGS.forEach(lang => {
    const item = document.createElement('button');
    item.style.cssText = [
      'display:flex', 'align-items:center', 'gap:0.6rem', 'width:100%',
      'background:none', 'border:none', 'padding:0.45rem 0.6rem', 'cursor:pointer',
      'border-radius:4px', 'text-align:left', 'font-family:var(--sans)'
    ].join(';');
    item.innerHTML = `<span style="font-size:0.92rem;min-width:2.5rem;">${lang.label}</span><span style="font-size:0.72rem;color:var(--muted);">${lang.name}</span>`;
    item.onmouseenter = () => item.style.background = 'var(--bg3)';
    item.onmouseleave = () => item.style.background = 'none';
    item.onclick = () => translate(lang.code);
    menu.appendChild(item);
  });

  wrapper.appendChild(btn);
  wrapper.appendChild(menu);

  function toggleMenu() {
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  }
  function closeMenu() {
    menu.style.display = 'none';
  }

  // Close on outside click
  document.addEventListener('click', closeMenu);

  // Insert after theme toggle in nav
  const navLinks = document.querySelector('.nav-links');
  if (navLinks) navLinks.appendChild(wrapper);
})();
