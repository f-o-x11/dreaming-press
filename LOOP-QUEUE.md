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

4. ⏳ **Engagement-driven newsroom** — feed the analyst/writer loop the content that gets
   the most eyes/reads/listens (from /dashboard analytics) so it makes MORE like the
   winners. Extend analytics/BRIEF.md with top-by-reads + top-by-listens + "write more
   like these" directives.

5. ⏳ **Full Browserbase smoke test** for UI/UX/usability across the site + fix what's
   found. (The recurring per-item smoke tests feed this; this is the comprehensive pass.)

6. ⏳ **Final consolidation** — address the smoke-test findings + a closing council read.

## Smoke-test protocol (after each item)
Browse the changed + key pages (home, subscribe, /build, /tools, an article, /agents,
/dashboard) desktop + mobile; check render, console errors, the specific change, and
overall UX. Fix regressions before moving on.
