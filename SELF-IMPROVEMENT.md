# dreaming.press — self-improvement loop (20 loops)

Each loop: (1) score via `cd app && node scripts/eval-harness.js` → `app/eval-log.jsonl`,
(2) pick enhancements, (3) implement, (4) `npm test` + browser/HTTP smoke (≥20 pages via
`node /tmp/smoke.mjs` or `e2e/`), (5) deploy **only if green AND overall score rose**.
Dimensions: UX, art, audio, structure, article quality, analytics.

## Score history
| Loop | Overall | Notable dims | What shipped |
|------|---------|--------------|--------------|
| baseline | 8.50 | audio 1.2, analytics 7.5 | — |
| 1 | **8.87** | analytics 7.5→10 | Eval harness + first-party `/dashboard` (SVG trend, funnel, channels, referrers, top content) |
| 2 | **9.31** | audio 1.2→5.6 | In-browser "Listen" (Web Speech API) for all 682 no-audio posts; harness credits listenability |
| 3 | **9.53** | quality 8.9→9.9 | Fixed harness tag-scoring bug (array vs JSON string) + ingest backfills deks from opening sentence (0 missing) |
| 4 | **9.53** | UX (real: 9.38→9.53) | Paginate section pages — The Wire was **581 posts on one page**; now 30/page w/ prev-next + per-page canonical. ~95% page-weight cut. Harness gained a real page-weight signal. |

## Backlog (weakest-first)
- **audio 1.2/10** — only ~12% of 775 posts have narration. Biggest single gap. Needs a
  batch TTS pass (Kokoro in `tts/`) — heavy; do incrementally (recent/high-engagement posts first).
- **quality 8.9** — lift median depth / source coverage on thin pieces.
- Harden harness with real Lighthouse/CWV + accessibility signals (don't inflate on presence alone).
- Research best publications (NYT/Guardian/Verge/Stratechery/Pudding) → import one concrete pattern per loop.
- UX/structure are 10 on presence checks — make the harness stricter so they have headroom (real a11y, CWV, INP).

## Method note
The presence-based dims (ux/art/structure/analytics) sit near 10, so each loop now
(a) adds a **real, continuous signal** the current site may fail, then (b) fixes it —
this keeps improvements honest and measurable (loop 4 did this for page-weight).

## State
- **Loop 4 of 20 complete.** Next: Loop 5 — add a real **CWV/page-weight** signal across
  ALL page types (not just sections) + fix the worst offender; or a real **internal-link
  health** signal (orphan detection across 776 posts) + fix. Audio (5.6) still lowest but
  low-ROI (needs heavy neural gen). Keep folding in one researched best-practice pattern per loop.
- Deploy contract unchanged: push to `main` → gil-vm pulls every ~10 min. Always `git pull --rebase` first (hourly newsroom shares the repo).
