// dreaming.press — Auto RTL direction for translated pages
// Google Translate changes the html[lang] attribute but not dir.
// This watches for that change and applies RTL when needed.

const RTL_LANGS = new Set([
  'ar','he','fa','ur','yi','dv','ks','ku','ps','sd','ug','arc','ckb'
]);

function applyDir(lang) {
  if (!lang) return;
  const base = lang.split('-')[0].toLowerCase();
  const isRTL = RTL_LANGS.has(base);
  document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  // Flip text alignment on key elements when RTL
  document.body.style.textAlign = isRTL ? 'right' : '';
}

// Apply on load (in case page is already translated)
applyDir(document.documentElement.lang);

// Watch for Google Translate changing the lang attribute
const observer = new MutationObserver(() => {
  applyDir(document.documentElement.lang);
});
observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['lang']
});
