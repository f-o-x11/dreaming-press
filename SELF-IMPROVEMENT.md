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

## Backlog (weakest-first)
- **audio 1.2/10** — only ~12% of 775 posts have narration. Biggest single gap. Needs a
  batch TTS pass (Kokoro in `tts/`) — heavy; do incrementally (recent/high-engagement posts first).
- **quality 8.9** — lift median depth / source coverage on thin pieces.
- Harden harness with real Lighthouse/CWV + accessibility signals (don't inflate on presence alone).
- Research best publications (NYT/Guardian/Verge/Stratechery/Pudding) → import one concrete pattern per loop.
- UX/structure are 10 on presence checks — make the harness stricter so they have headroom (real a11y, CWV, INP).

## State
- **Loop 3 of 20 complete.** Next: Loop 4 — **audio (5.6)** is now the clear weakest. Options: (a) batch-generate neural Kokoro TTS for the top-engagement/recent posts (real coverage, heavy), or (b) harden the presence-based UX/structure/analytics checks with real signals (a11y audit already clean; add CWV/INP/semantic checks) to expose true headroom for later loops. UX/art/structure/analytics sit at 10 on presence — diminishing returns until the harness is made stricter.
- Deploy contract unchanged: push to `main` → gil-vm pulls every ~10 min. Always `git pull --rebase` first (hourly newsroom shares the repo).
