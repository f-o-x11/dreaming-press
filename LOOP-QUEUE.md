# Loop queue — Gil's 6-item plan (2026-07-18)

One item per /loop, **run a Browserbase/browse smoke test after each**, convene the LLM
council as useful. Mark items done here as they ship.

1. ✅ **Automatic per-author narration for ALL future articles, different voices per author.**
   Done + verified: 8 authors → 8 distinct Kokoro voices (dex=am_fenrir US-male,
   priya=hf_beta Indian-female, rosalinda=af_heart US-female, wire-desk=bm_george &
   soren=bm_lewis British-male, indexer=bf_emma & vesper=af_bella, abe=am_michael).
   Automatic + drift-proof via `scripts/narrate-cycle.sh` (syncs content BEFORE building
   the manifest, background synth, idempotent). Loop runs it each tick. (Was a 45-post
   drift gap; fixed + backfilling.)

2. ✅ **Bigger, more pronounced subscribe box + button.** Added a prominent base `.dp-sub`
   style (big pill input + accent button) in style.css — lifts EVERY understyled form:
   /subscribe hero (extra size boost), home sub-band, inline article form. Dark `.band`
   + compact right rail deliberately left unchanged (low-specificity `:where()` + a
   `flex:0 0 auto` reset on `.rr-sub` so the rail stays compact). Verified in all 5
   contexts, desktop + mobile, via harness screenshots (no console errors).

3. ✅ **"For AI agents only" interface** — programmatic SUBSCRIBE + pull-everything.
   Shipped: `POST /api/agents/subscribe` (webhook OR email, SSRF-guarded), `POST
   /api/agents/unsubscribe` (id+token), `GET /api/agent-hub.json` (ONE manifest of every
   pull endpoint + subscribe), `/feed.json?since=&limit=&section=` poll cursor. Webhook
   delivery via `scripts/notify-agents.js` (runs each deploy, seeds backlog so a new hook
   never gets blasted, deactivates after 10 failures). New `lib/agent-subs.js`
   (isSafeWebhookUrl blocks localhost/private/metadata/IPv6-loopback; webhookPayload).
   agents page got "Pull everything" + "Subscribe your agent" sections; agents.txt +
   agent-card advertise it. +5 tests (SSRF guard). Verified live-locally end-to-end;
   visual QA 36/36. GOTCHA fixed: URL.hostname keeps `[]` on IPv6 → `[::1]` bypass.

4. ✅ **Engagement-driven newsroom.** `export-analytics.js` now writes top-by-reads,
   **top-by-listens**, and top-by-views, plus a **"WRITE MORE LIKE THESE"** block that
   extracts the winning pattern (formats, section mix, recurring title words) from the
   reads+listens winners → concrete commissioning directives. `topContent()` gained an
   `order` param (reads|views|plays). Folded in Gil's **X account**: new `x-trends.js`
   (v2 recent search, runs on server each deploy, inert without token) writes
   `analytics/x-trends.json`; the brief adds a **"Trending on X right now"** section (hot
   terms + top posts) and tells the desk to write at the intersection of what-wins +
   what's-hot. Verified: x-trends pulled 79 real posts; enriched BRIEF.md renders all
   sections. Tests 2969/2970, visual QA 36/36.

5. ✅ **Full smoke test + fixes.** Swept 10 pages desktop + 6 mobile (headless Chrome):
   all HTTP 200, ZERO console errors, no horizontal overflow, no broken resources/images,
   search returns 30 hits, article narration mp3 loads (3.2MB), public metrics strip
   present. Found + fixed ONE real quality issue: **AI covers rendered garbled fake text**
   (a "wordmark" motif → giant "VEETIE BONKNI" cover). Root-caused it: (a) `sanitizeMotif()`
   strips text-inducing words, (b) dropped the literal article title from the prompt (flux
   drew it as a garbled heading), (c) forceful no-text instruction, (d) new `--force` flag.
   Regenerated the 6 homepage-visible covers via the FREE flux fallback (OpenAI is
   hard-billing-blocked) — verified the vertex-ai cover is now a clean editorial
   illustration, no text.

6. ✅ **Final consolidation** — HANDOFF + memory updated; final full-site smoke test green.

## API keys (Gil, 2026-07-18) — see memory reference-x-api; stored in .secrets/ + server env
- X: v2 search WORKS (feeds Item 4). POSTING needs Access Token+Secret (bearer is read-only).
- Bing/Azure key: 401/400 on tested endpoints — needs its region-specific Azure endpoint.

## Local dev gotcha
The default `node` is v26 and better-sqlite3's binding won't build for it. Use node@24:
`export PATH="/opt/homebrew/opt/node@24/bin:$PATH"` then `npm rebuild better-sqlite3` once,
then `PORT=3055 node server.js`. (node@22 in brew is broken — missing simdjson dylib.)

## Smoke-test protocol (after each item)
Browse the changed + key pages (home, subscribe, /build, /tools, an article, /agents,
/dashboard) desktop + mobile; check render, console errors, the specific change, and
overall UX. Fix regressions before moving on.
