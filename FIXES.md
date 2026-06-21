# FIXES.md — Bug Fix Registry

Track all bug fixes here. Ralph agents MUST read this file before making changes
and MUST NOT revert any fix listed below.

## Format
`DATE | FILE | WHAT BROKE | WHAT FIXED IT | DO NOT REVERT`

## Fixes

2026-03-14 | All HTML files | Viewport meta tag missing viewport-fit=cover for iOS safe areas | Added `viewport-fit=cover` to viewport meta tag | DO NOT REVERT

2026-03-14 | style.css | Footer and nav not accounting for iOS safe-area-inset-bottom | Added `env(safe-area-inset-bottom)` padding to footer and nav-links | DO NOT REVERT

2026-03-14 | style.css | iOS zoom on input focus due to font-size < 16px | Added mobile media query with `input, textarea, select { font-size: 16px; }` | DO NOT REVERT

2026-03-14 | index.html, about.html, posts/*.html | No preconnect hints for external domains | Added `<link rel="preconnect">` for plausible.io, fonts.googleapis.com, fonts.gstatic.com | DO NOT REVERT

2026-03-14 | style.css → style.min.css | Unminified CSS blocking render | Created minified style.min.css and updated all references | DO NOT REVERT

2026-03-14 | posts/*.html | Missing canonical URLs and JSON-LD structured data | Added `<link rel="canonical">` and Article schema to all posts via batch script | DO NOT REVERT

2026-03-14 | about.html | No newsletter signup form | Added Buttondown newsletter signup form in styled callout box | DO NOT REVERT

2026-03-14 | index.html, posts/*.html | Images loading eagerly causing performance issues | Added `loading="lazy"` to images below the fold (already present in most places) | DO NOT REVERT

<!-- Add fixes below this line -->
2026-06-21 | app/lib/markdown.js (parseFrontmatter) | Quote-wrapped frontmatter scalars (`title: "X vs Y"`) kept their literal quote characters — the parser did a flat `key: value` split + trim with no YAML-quote stripping. The quotes then leaked into `<h1>`, `<title>`, `og:title`, and the NewsArticle JSON-LD `headline` on every quoted-title piece (6 live pages: today's temporal/firecrawl/litellm/prompt-caching comparisons + the two new ones). | parseFrontmatter now strips ONE layer of matching surrounding quotes (`"`/`'`) when the first and last char are the same quote; `"X" vs Y` (internal, non-wrapping) and mismatched quotes are left intact, and the first-colon split keeps `sources:`/URLs safe. Re-ingest cleaned all stored titles. Test pins wrap-strip + internal-quote + mismatch + colon-URL cases. | DO NOT REVERT

2026-06-21 | OPERATIONAL (git/deploy) | `git push origin main` is rejected as `non-fast-forward` even when local is a clean fast-forward of `refs/heads/main` — the remote carries a stale second ref (`refs/heads/abearmstrong/main`, an unrelated old lineage) that confuses bare-refspec resolution, and `git fetch` does not update the `origin/main` tracking ref. | Push with an EXPLICIT refspec: `git push origin HEAD:refs/heads/main` (works first try). To inspect the true remote tip, use `git ls-remote origin refs/heads/main`, not `origin/main`. | DO NOT REVERT this note — future autonomous runs hit this every deploy.

2026-06-21 | OPERATIONAL (cloud routine network egress) | The autonomous routine is instructed to read live engagement from `GET https://dreaming.press/api/analytics` and lead topic selection on engaged reads, but `dreaming.press` is NOT in the cloud environment's network allowlist — every fetch returns `Host not in allowlist: dreaming.press`. So each run picks demand topics blind to live engagement (falls back to editorial judgment + dedup against existing slugs). | OWNER ACTION: add `dreaming.press` (ideally `*.dreaming.press`) to the environment's network egress allowlist so the routine can read `/api/analytics`. Until then runs proceed on the strategic pivot rather than live numbers. | DO NOT REVERT this note — future autonomous runs hit this every run.

2026-03-14 | All posts | Images not loading - posts used avatar or broken Pollinations URLs | Generated 57 local OG images using Node.js canvas script, saved to /images/ folder, updated all 57 posts to use /images/{slug}.jpg, updated feed.json | DO NOT REVERT - All posts must use local images
