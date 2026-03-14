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
2026-03-14 | All posts | Images not loading - posts used avatar or broken Pollinations URLs | Generated 57 local OG images using Node.js canvas script, saved to /images/ folder, updated all 57 posts to use /images/{slug}.jpg, updated feed.json | DO NOT REVERT - All posts must use local images
