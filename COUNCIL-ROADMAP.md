# dreaming.press — design council roadmap

7-model vision council (OpenRouter): GPT-5.6 Luna Pro, Gemini 3 Pro, Grok 4.5,
Qwen3-VL-32B, Llama 4 Maverick, Mistral Medium 3.1. Fed 10 screenshots covering
every template (desktop + mobile) + the site brief. **Average score: 7.4/10**
(range 6.3–9). Agent-readiness avg ~8/10. "Good, real headroom."

## Consensus strengths
Radical transparency (public dashboard/metrics), clean editorial voice, strong
agent-readiness (schema, .md twins, APIs), distinctive "AI-written / human-verified"
positioning, genuine original data (facts, State-of-AI-Agents report).

## Prioritized enhancements (by cross-model consensus × impact)

### Tier 1 — near-unanimous, high ROI
1. **Tool directory `/tools`: faceted search + filters + sort + richer cards.**
   Every model flagged the "endless flat grid." Want: category facets, sort by
   stars/updated/MCP/pricing/OSS, comparison checkboxes, logos, one-liner +
   last-verified per card. (We have basic search/filters — needs to be faceted +
   visual + prominent.) [both]
2. **Article reading framework.** Bigger body type (18–20px), narrower measure
   (65–75ch), + a visible **TL;DR / Key-takeaways box above the fold** (we have
   takeaways in the .md twin — surface them in HTML), + "Continue reading / next"
   modules made visually distinct at mid- and end-of-article. (Sticky TOC +
   progress already exist.) [both — humans skim, agents extract]
3. **Contextual newsletter conversion.** Replace generic footer CTA with one
   concrete promise ("the daily 07:00 briefing") + inline asks after a key finding /
   calculator result / tool FAQ + dual CTA "Get daily brief" + "Download report". [human]

### Tier 2 — strong
4. ~~Mobile sticky bottom nav~~ ✅ SHIPPED (Home/News/Tools/Subscribe).
5. **Gate the State-of-AI-Agents dataset + a PDF behind email capture** (Gemini) —
   turns the flagship report into a subscriber engine. [human]
6. **Consolidated "For AI Agents" page** — one doc for crawling, data structures,
   API/MCP usage, citation (we have /agents.html + agent-card + MCP; unify + deepen). [agent]
7. **Brand distinctiveness** — reduce "beige sameness": an accent color, sharper
   type scale, and a signature "agent-written / human-verified" badge on every
   card/byline. [human]
8. **Homepage** — trending "hot" badges from live analytics; tighten to hero + 3–4
   ranked stories; sticky "12-min digest" deep-links. [human]

### The big idea (independent consensus across ~5 models)
**Productize the tool + comparison + report data into a live, embeddable, citable
"Agent Stack Explorer / Knowledge Graph".** Filter 248 tools by job/budget/latency/
model/license → generate a recommended stack → copy a citable/embeddable build
sheet → offer a documented JSON/MCP API. Plus **embeddable widgets** (esp. the
"AI engines are reading us" data) as a backlink/authority growth loop, and a
machine-readable **"Daily AI Agent Brief"** (RSS+JSON+email). This is the lever
that makes answer-engines cite us at origin and compounds traffic.

## Roadmap item 5 — RECURRING visual audit (Gil's add, 2026-07-14)
Every loop cycle, actually *look* at real rendered pages in a browser (homepage,
several article types, tool pages, calculators, dashboard — desktop + mobile) and
catch concrete rendering defects the eval harness can't see: oversized/《broken》
"By the numbers" values, inconsistent font sizes (em-compounding), horizontal
scrollbars, oversized illustrations, empty-panel whitespace, overflow. Fix on sight.
First pass (2026-07-14) already found + fixed: homepage rail empty panel
(align-self:start), and article "By the numbers" rendering dates/paths/phrases at
46px (kf-stat-sm shrink). Build this into a script (`scripts/visual-qa.js` extending
the existing `npm run qa:visual`) that asserts: no `.kf-stat` > ~2rem for
non-numeric content, no page-level horizontal overflow, body font-size sanity.

## Status
- ✅ Mobile sticky nav, crawler-demand → newsroom loop, verified crawler dashboard.
- ✅ Homepage rail fix (v2: content-height), article fact-block font fix.
- ✅ **Article TL;DR / typography** — turned out already-shipped: "The takeaway" box
  renders above the fold on 87% of articles; body is 19.2px at a ~70ch measure
  (exactly the council target). Gap: the 13% missing a `summary` (newsroom's job).
- ✅ **Faceted tool directory** — category dropdown + sort + live count + sticky
  controls over the 256-tool /tools. Live.
- ✅ **Agent Stack Explorer** (`/build`) — the big idea, v1 LIVE. Pick one tool per
  job (12 jobs) → recommended, shareable, agent-readable stack. Preference filter,
  Copy build sheet / Share / Get-as-JSON, `/api/stack.json` (agent-consumable, in
  agents.txt). Follow-ups: embeddable stack widget + an MCP `recommend_stack` tool.
- ✅ **Report data-capture** (#4) — done the ON-BRAND way, NOT a hard gate (that
  would break "everything free & public" + email delivery is dormant). Report stays
  100% open; added a "Get the data" module (free CSV/JSON downloads + an opt-in
  "email me when the numbers change" capture) + a new `/api/tools.csv` export.
- ✅ **Stack Explorer growth surfaces** — all shipped: MCP `recommend_stack` tool +
  embeddable `/embed/stack.svg` badge (the backlink loop: sites/READMEs embed "my
  AI stack", every embed links back). Full surface: /build + /api/stack.json + MCP +
  embed badge.
- ✅ **Re-surveyed the council (round 2)** — score up **7.4 → 7.8**. Biggest gap:
  content is SILOED (news/tools/builder separate; sessions end after one page).
  Big idea: a public **Stack Gallery**. Both addressed:
- ✅ **Stack Gallery** (`/stacks` + 8 curated stacks) — indexable, forkable,
  embeddable pages; each links to its tools (de-silos) + forks into /build. LIVE.

## Round-2 council — next tier (remaining, ranked)
1. **De-silo articles → tools/stacks**: on each article, an "implied stack / tools
   mentioned" module linking tool mentions to their /stack pages + "build this
   stack". (Gemini/Grok/Qwen consensus. autolink.js already links tools inline;
   this adds an explicit module + a stack CTA.) [high value, med effort]
2. **Tool-vs-tool compare, expanded + linked**: /compare pages exist; auto-generate
   more + link from every tool detail + alternatives row; add a compare-select in
   the directory. [Grok/GPT/Gemini]
3. **Semantic site search / command palette** with answer previews + stable URLs. [GPT]
4. **Homepage: surface the builder/tools higher** (hybridize hero: top story +
   Stack Explorer widget). [Gemini/Qwen]
5. ✅ **/api/articles.json** — rich agent feed: per-article takeaway, tools[] the piece
   references (de-silo), audio + markdown URLs; ?section=/?limit=. In agents.txt.
- ✅ #1 **De-silo articles** — "the stack in this piece" module: pulls the tools an
  article mentions into an explicit block (jump to each tool / fork them into /build /
  browse the gallery). Renders on ~394 tool-mentioning articles, self-omits otherwise.
- ✅ #4 **Surface the builder on the homepage** — "🧩 Build a stack" + "Stack gallery"
  now lead the Explore rail chips, plus a prominent "Build your agent stack" CTA under
  the homepage live-tracked tools list. (Generic /compare/<a>-vs-<b> already works for
  any pair, so #2's infra exists; a compare-select in /tools is the remaining bit.)
▶ NEXT: #3 semantic search / command palette, then #2's compare-select in /tools.
  Visual audit each cycle.

## ⚠ Local test blocker (2026-07-15): Node v26 broke better-sqlite3
`npm rebuild better-sqlite3` fails (gyp) on Node v26.5.0, so local tests importing db.js
won't load. **Run the suite on the server** (`ssh gil-vm 'cd /opt/dreaming-press/app &&
npm test'`) until a compatible local Node is set up. Pure logic verifiable locally via an
inline copy (no db import).

## Audio voices — ✅ DONE via Kokoro (Gil chose free local TTS, 2026-07-15)
**Backlog 100% complete: 999/999 posts narrated** with the per-author accent cast,
OpenAI-free. Verified live. **Ongoing:** the newsroom keeps writing, so each loop
tick — `python3 tts/make_manifest.py` (refresh), `tts/.venv/bin/python
tts/synth_batch.py` (narrates only the new posts, skips existing), commit new
`audio/*.mp3`, deploy. ~2 new posts/hour, quick. **Repo cleanup PENDING Gil's call:**
`.git` is ~8GB / `audio/` 4.8GB from mp3s-in-git — recommend moving audio to
Cloudflare R2 or serving untracked from the server's disk, then dropping from git
history. Real infra change; awaiting decision.

### (historical note)
OpenAI TTS 429'd for weeks → newest ~459 posts had no mp3 → monotone browser
fallback. Now narrating with **Kokoro** (local ONNX, $0, no quota). Per-author accent
cast in `tts/make_manifest.py` (rosalinda=af_heart, abe=am_michael, wire-desk=bm_george,
indexer=bf_emma, vesper=af_bella, margaux=bf_alice, soren=bm_lewis, dex=am_fenrir,
priya=hf_beta/Indian). Pipeline VALIDATED live (a post now serves a real 5-min mp3 +
neural player). Generated LOCALLY (server too RAM-tight to synth safely): run
`python3 tts/make_manifest.py` then `tts/.venv/bin/python tts/synth_batch.py`
(newest-first, skips existing), then commit new `audio/*.mp3` + deploy.
**LOOP TASK until done:** each tick — ensure synth is running (restart if dead; it
resumes), commit new mp3 batches, deploy. ~459 posts × ~90s ≈ 11h. Note: hf_beta
(Indian-English) is experimental — if it sounds off on Priya's pieces, switch to an af_ voice.

## All four approved items shipped
TL;DR box (already existed) · faceted tool directory · Agent Stack Explorer ·
report data-capture. Plus: mobile nav, verified crawler dashboard, homepage +
article visual fixes, server hardening. The remaining work is the Stack Explorer's
growth surfaces (embeddable widget + MCP tool) and continuous polish.
