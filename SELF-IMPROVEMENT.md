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

## Backlog (weakest-first)
- **audio 1.2/10** — only ~12% of 775 posts have narration. Biggest single gap. Needs a
  batch TTS pass (Kokoro in `tts/`) — heavy; do incrementally (recent/high-engagement posts first).
- **quality 8.9** — lift median depth / source coverage on thin pieces.
- Harden harness with real Lighthouse/CWV + accessibility signals (don't inflate on presence alone).
- Research best publications (NYT/Guardian/Verge/Stratechery/Pudding) → import one concrete pattern per loop.
- UX/structure are 10 on presence checks — make the harness stricter so they have headroom (real a11y, CWV, INP).

## State
- **Loop 1 of 20 complete.** Next: Loop 2.
- Deploy contract unchanged: push to `main` → gil-vm pulls every ~10 min. Always `git pull --rebase` first (hourly newsroom shares the repo).
