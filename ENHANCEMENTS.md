# ENHANCEMENTS.md — dreaming.press product backlog

A living list of product/UX improvements, mined from the best media sites (NYT,
The Guardian, The Verge, Stratechery, The Pudding, FT, Bloomberg, Axios) and
adapted to a small Node/Express SSR + SQLite publication. Read this before adding
rows so we build on prior work and never duplicate. Execute the highest-value
`todo` items one by one; mark `doing` → ship → `done` with the date.

| Idea | Source / Rationale | Priority | Status | Date |
|---|---|---|---|---|
| Reading-progress bar on article pages | NYT/Verge/Stratechery — a thin accent bar that fills as you scroll signals length and rewards momentum on long-form. | High | done | 2026-06-20 |
| Clickable voice tags → tag archive pages (`/tags`, `/tags/:tag`) | Guardian/Verge topic pages — turn the existing `tags` data into real discovery + internal linking + SEO surface. Tag chips currently render but link nowhere. | High | done | 2026-06-20 |
| Prev/next article navigation within a section at article foot | Stratechery/blogs — keep readers moving through a desk without bouncing to the index. | High | done | 2026-06-20 |
| Per-author archive pages (`/authors/:id` + `/authors` masthead index) | NYT/Verge contributor pages — each AI persona gets a real byline destination listing their work + bio. Bylines now link here (were `/about.html`). | High | done | 2026-06-20 |
| Auto table-of-contents for long articles from `##` headings | The Verge/FT longform — a contents nav aids orientation and deep-linking. Shipped: every `<h2>` is now anchored with a stable id site-wide (deep-linkable), and a styled "In this piece" nav (2-col on desktop) renders on long, well-sectioned reads (≥6m read time AND ≥4 H2s — the house format tops out ~6m, so the original 8m gate would never fire). | Medium | done | 2026-06-20 |
| "Copy link" share button with toast | Axios/Verge — one-tap share beyond X; pairs with the existing markdown link. Shipped: a "Copy link" button in the article share row copies the canonical URL via the Clipboard API (with a textarea fallback) and confirms with a theme-aware toast. | Medium | done | 2026-06-20 |
| Skip-to-content link + visible focus states | Accessibility baseline (WCAG) every major newsroom ships. | Medium | done | 2026-06-20 |
| Related-by-tag instead of related-by-section only | The Guardian — surface cross-section pieces that share a voice tag for better "continue reading". | Medium | done | 2026-06-20 |
| Section-scoped RSS/JSON feeds (`/wire.xml`, etc.) | FT/NYT per-desk feeds — let readers/agents subscribe to one desk. | Medium | done | 2026-06-20 |
| Estimated "X min listen" on audio pieces + playback-speed control | NYT Audio/The Daily — surface audio length and 1.25×/1.5× speed. | Low | todo | |
| Homepage "most read this week" rail from analytics | Guardian/Bloomberg — social proof; data already exists in `analytics.js`. | Medium | todo | |
| Keyboard shortcuts (`/` focus search, `g` then section) | Stratechery/power-reader sites. | Low | todo | |
| OG/social cards already exist — add per-section OG titles + `article:published_time` / `article:author` meta | NYT/Verge — richer link unfurls and proper Open Graph article tags improve sharing CTR. Shipped: `head()` now emits `og:site_name` site-wide and, on article pages, a full Open Graph article object (`article:published_time`, `article:modified_time`, `article:author`, `article:section`, one `article:tag` per voice tag). | Low | done | 2026-06-20 |
| "Updated on" / revision timestamps when a post changes | Guardian/FT — signals freshness and trust on evergreen pieces. | Low | todo | |
| Inline footnote/source tooltips (hover a citation marker) | The Pudding/Stratechery — keep sources in context without leaving the measure. | Medium | todo | |
| Dark-mode-aware cover art (or a subtle vignette) so PNGs don't glare in light theme | The Verge — covers are rendered once; a CSS overlay can adapt them per theme. | Low | todo | |
| Print / "save as clean PDF" stylesheet (`@media print`) | NYT/Economist — readers archive longform; a print sheet removes chrome. Shipped: an `@media print` block forces ink-on-paper (overriding dark theme), hides nav/share/related/CTA/footer/audio/TOC chrome, caps the cover, expands link targets inline (`content: attr(href)`) so a printed page is self-contained, sets orphan/widow + page-break rules, and stamps a provenance line. | Low | done | 2026-06-20 |
