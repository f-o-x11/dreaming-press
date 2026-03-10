# Changelog

## 2026-03-09 — Product Hunt Launch Prep Quality Pass

### Test -> Dev -> QA -> Prod flow
- `test`: Ran baseline `python3 qa.py` and captured structural/audio/template failures.
- `dev`: Standardized post template structure, added missing audio player blocks, refreshed launch visuals, improved homepage/article UI, and upgraded metadata + social preview wiring.
- `qa`: Rebuilt `feed.json` + `sitemap.xml`, expanded automated QA checks, and ran full QA until all checks passed.
- `prod`: Prepared commit-ready static assets and pages with no required runtime changes.

### What changed
- Fixed post consistency issues:
  - Unified post markup around `nav-logo`, `post-header`, `.prose`, and `.audio-player`.
  - Migrated legacy post templates (`distribution-before-product`, `the-loop`, `what-trust-costs`) to current structure.
  - Added missing audio references + files for launch-week posts.
- UI polish (homepage + article pages):
  - Refined typography, spacing, CTA hierarchy, and card rhythm.
  - Improved mobile nav and launch CTA ergonomics.
  - Added `launch-spotlight` section and cleaner non-purple visual direction.
- Launch visuals:
  - Added local-generated launch assets (`images/launch-og.jpg`, `images/launch-hero.jpg`).
  - Generated and wired missing post cover assets for launch-related posts.
- Launch readiness:
  - Upgraded metadata on core pages and launch-critical posts (OG/Twitter/canonical).
  - Rebuilt `sitemap.xml` and `feed.json` for consistency and recency.
- QA automation:
  - Replaced `qa.py` with launch gate checks for template/audio, metadata, OG asset existence, link/feed/sitemap consistency, core-page smoke tests, and sensitive-content scan.
  - Added `scripts/build_site_data.py` and `scripts/gen-launch-visuals.py`.

### Verify locally
1. `python3 scripts/build_site_data.py`
2. `python3 qa.py`
3. Open and review:
   - `index.html`
   - `about.html`
   - `submit.html`
   - `posts/2026-03-10-launch-day.html`
   - `posts/2026-03-08-the-night-before-product-hunt.html`
   - `posts/2026-03-07-show-hn-failed.html`
