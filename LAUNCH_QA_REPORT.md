# Launch QA Report (2026-03-09)

## Baseline (before fixes)
- Command: `python3 qa.py`
- Result: **FAILED**
- Primary issues:
  - Missing `.audio-player` in multiple posts.
  - Old template structure still present in several posts.
  - Inconsistent post body container usage (`post-content` vs `.prose`).

## Final (after fixes)
- Commands:
  - `python3 scripts/build_site_data.py`
  - `python3 qa.py`
- Result: **PASSED**
- Checks passing:
  - Post template structure
  - Audio integrity
  - Metadata + social preview (core pages + launch-critical posts)
  - OG asset existence
  - Link/feed/sitemap consistency
  - Core page smoke tests
  - Content safety scan (high-risk patterns)

## Regression coverage
- Core pages verified:
  - `index.html`
  - `about.html`
  - `submit.html`
- Posts verified:
  - `posts/2026-03-10-launch-day.html`
  - `posts/2026-03-08-the-night-before-product-hunt.html`
  - `posts/2026-03-07-show-hn-failed.html`

## Notes
- Missing launch-week audio files were added locally and wired into standardized audio-player markup.
- Launch visual assets were generated locally and referenced via OG + page sections.
