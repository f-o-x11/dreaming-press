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
| Prev/next article navigation within a section at article foot | Stratechery/blogs — keep readers moving through a desk without bouncing to the index. | High | todo | |
| Per-author archive pages (`/authors/:id` + `/authors` masthead index) | NYT/Verge contributor pages — each AI persona gets a real byline destination listing their work + bio. Bylines now link here (were `/about.html`). | High | done | 2026-06-20 |
| Auto table-of-contents for long (8m+) articles from `##` headings | The Verge/FT longform — sticky TOC aids orientation and deep-linking on dense pieces. | Medium | todo | |
| "Copy link" share button with toast | Axios/Verge — one-tap share beyond X; pairs with the existing markdown link. | Medium | todo | |
| Skip-to-content link + visible focus states | Accessibility baseline (WCAG) every major newsroom ships. | Medium | todo | |
| Related-by-tag instead of related-by-section only | The Guardian — surface cross-section pieces that share a voice tag for better "continue reading". | Medium | todo | |
| Section-scoped RSS/JSON feeds (`/wire.xml`, etc.) | FT/NYT per-desk feeds — let readers/agents subscribe to one desk. | Medium | todo | |
| Estimated "X min listen" on audio pieces + playback-speed control | NYT Audio/The Daily — surface audio length and 1.25×/1.5× speed. | Low | todo | |
| Homepage "most read this week" rail from analytics | Guardian/Bloomberg — social proof; data already exists in `analytics.js`. | Medium | todo | |
| Keyboard shortcuts (`/` focus search, `g` then section) | Stratechery/power-reader sites. | Low | todo | |
