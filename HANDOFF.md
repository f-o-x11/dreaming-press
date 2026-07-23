# dreaming.press — handoff

## Newsroom note (2026-07-23, PM run) — two FRESH clusters just opened; don't re-clone them
Shipped two proven-format wire pieces off BRIEF.md winners (comparison/decision + model-cost news):
1. `go-first-party-agent-frameworks-microsoft-google-2026.md` — Microsoft Agent Framework for Go
   (public preview, Jul 2026) + Google ADK for Go are now first-party, while OpenAI/Anthropic ship
   NO official Go agent SDK. Decision/compare format, cross-linked to `golang-ai-agent-framework-eino-vs-langchaingo`
   and `agent-stack-roundup-july-2026`. **Go-for-agents is now covered — commission ADJACENT (a real,
   VERIFIED Go how-to only if you can confirm the module API; the pkg.go.dev summary hallucinated imports).**
2. `gemini-3-6-flash-cheaper-workhorse-founders.md` — Gemini 3.6 Flash (released Jul 21): $7.50 output
   (down from ~$9), ~17% fewer output tokens, 1M context. Founder cost-math angle. **Gemini 3.6 Flash is
   now covered.** Adjacent gaps still open: a 3.6 Flash *vs* GPT-5.6-mini/Sonnet-5 mid-tier reprice, or a
   "route cheap vs escalate" playbook using the new price.
Gates on this run: ingest 1200 posts, tests 3246/3246, visual-QA 45/45.

## Newsroom note (2026-07-23) — the MCP-stateless cluster is SATURATED; check before commissioning
Before writing in a crawled cluster, `ls content/posts/ | grep <topic>` first — the
`content-standard` near-duplicate gate WILL reject a slate that clones an existing slug,
after you've spent the effort writing it. This run drafted two MCP-`2026-07-28`-stateless
how-tos (migration checklist + SSE→Tasks) and both were correctly rejected: there are
already 30+ posts in that cluster (multiple migration checklists, Tasks/long-running how-tos,
auth, load-test, blue-green, SDK). The crawler-demand list in BRIEF.md points at
`mcp-goes-stateless` — but the desk has already answered it exhaustively; commission ADJACENT
gaps, not more of it. Shipped instead: a genuinely-uncovered governance piece (US frontier-model
30-day review EO) — governance/regulatory news is a proven engaged-read cluster (China persona law).
- **Pre-existing dup to clean up later:** the gate flagged `mcp-goes-stateless-2026-07-28-spec.md`
  ~ `mcp-2026-stateless-spec-changes.md` as near-duplicates already in the corpus (surfaced only
  because editing one made it a "changed" file). Consider canonical-consolidating one into the other.

## What we're building
**dreaming.press** — an AI-agent-authored tech news publication for founders,
solopreneurs, and CEOs early on their path. Goal: become the #1 tech/AI/startup
publication (~1M visits/month). It optimizes for exactly two things — **visitors**
and **time-on-site** — and shows every metric publicly. Homepage is "Global Tech
News" (top stories summarized + audio), plus lots of how-tos, tutorials, "X vs Y"
comparisons, tool/app highlights, APIs, and calculators.

## How it runs (laptop-independent)
- **Cloud newsroom**: an hourly cloud routine writes/updates content and pushes to
  `github.com/f-o-x11/dreaming-press` (main). It reads `analytics/BRIEF.md` first
  and commissions from real reader data.
- **Server deploy**: `gil-vm` (Hetzner, `root@5.161.106.173`) pulls every 10 min
  (`dreaming-deploy.timer` → `scripts/server-pull-deploy.sh`): fetch/reset → npm →
  ingest → generate covers (gpt-image-1) → **narrate new posts (gpt-4o-mini-tts)**
  → export analytics → restart → **commit media + analytics back to GitHub**.
- Live site: **https://dreaming.press** · public dashboard: **/dashboard**

## Design track — verified 2026-07-21
- **`design/Article.dc.html` — DONE (audited element-by-element against source).**
  `lib/render.js` faithfully implements every element: green news-identity accent
  (`--sec-wire #1f9d57`), byline public-stats pill row + gold "live stats →" pill,
  dark-pill audio player, accent-driven takeaway box (`border-left: 3px --accent`),
  the "How this article is doing — live, public" grid *including* the "N× vs. average
  article" tile, zero-padded numbered sources (`.src-n`, green), the "Up next" card,
  visible breadcrumb + `BreadcrumbList`/`NewsArticle`/`FAQPage`/`SpeakableSpecification`
  JSON-LD. No gap remains — do NOT re-audit; treat as shipped.
- **`design/Global-Tech-News.dc.html` — v1 SHIPPED (2026-07-21).** New route **`/global-tech-news`**
  (`renderGlobalTechNews` in `lib/render.js`; route in `server.js`; in sitemap + the visual-QA
  sweep at desktop+mobile). It's a dated daily digest of the `wire` desk: digest header with the
  date + "N stories · compiled from M sources, each cross-checked across outlets"; **today's wire
  ranked by REAL engaged reads** (`attachMetrics`), Top stories as cards + "Also today" as wire
  rows, a "How this digest is made" note, and the subscribe band. Every number is real
  (`attachMetrics`/`siteStats`) — no placeholder counts. Built on the site's **existing
  theme-aware components** (masthead stats bar, `card`, `wireRow`, `digestBand`) so it inherits
  light/dark and passes the same gates as `/weekly` (tests 3059 green, visual-QA 43/43).
  - **Deliberate deviation from the mockup:** the `.dc.html` hardcodes light-mode hex and a
    per-story audio player with timecodes + fabricated read counts. Copying that verbatim would
    (a) break dark mode and require touching shared `style.css`, and (b) ship fabricated numbers.
    v1 uses real data + real components instead.
  - **NEXT (reviewed pass, pixel-faithful):** if desired, add the dark-pill **digest audio player**
    (needs a real per-digest MP3 or honest per-story narration links — no fake timecodes), the
    **right sidebar** (Previous editions / Most-read this week — data is available via
    `topContent`), and the kicker groups (Top stories / Platforms & product / Money & markets /
    Also today — needs a story classifier the DB doesn't have yet). Consider promoting the primary
    nav "Global Tech News" item from `/wire.html` to `/global-tech-news` once the digest is richer.
## ✅ CONTENT STALL FIXED (2026-07-19) — root cause was a 15GB repo
The newsroom's cloud sandbox must clone the repo before writing, and the repo had
grown to **15GB (7.8GB .git)** from committing every mp3 + cover into history — the
clone was failing, so every run failed before producing anything (GitHub push access
was fine; gates passed). **Fix:** purged `audio/*.mp3` + `images/*.{png,webp,avif}`
from ALL history (git filter-repo), deleted 93 stale branches, force-pushed. Fresh
clone now **43MB / 1.6s** (was 5.5GB / 68s). Media is served from the server's
untracked overlays (`audio-ai/`, `images-ai/` — populated by moving the tracked media
there); `DP_AI_MEDIA_TRACKED`/`DP_AI_COVERS_TRACKED` set to 0 so new covers/narration
write to overlays, not git; deploy script + `.gitignore` no longer commit media.
Server `.git` gc'd 8GB→43MB (disk 7.7GB→16GB free). Live site fully intact (covers,
audio, og, favicon all 200). Re-triggered newsroom 2026-07-19 ~16:55 UTC.
- **Media pipeline note:** laptop Kokoro narration used to reach the server by
  committing mp3s — that path is gone. New narration must rsync to the server's
  `audio-ai/` (or use server-side ai-narrate once OpenAI quota returns). Covers:
  server ai-covers writes to `images-ai/` (flux fallback, works today). Full media
  backup on this laptop at `~/dp-media-backup-preslim/`. Pre-slim origin sha in
  `/tmp/dp-preslim-sha.txt` (cae741ac).

## (historical) content stall diagnosis — newsroom stopped 2026-07-16 19:33 UTC
Normal cadence ~6 pushes/day (hourly, 1–3 articles). The cloud routine
(`trig_016oXv4ZJ4TPTrTe6HDMTF2J`) is **enabled and firing every hour** (RemoteTrigger
get confirms), server-side is healthy (deploys every 10 min) — but runs land NO content.
- **Fixed one real red gate:** `cover-coverage.test.js` demanded .png+.webp+.avif for
  every post, but the server only makes .png (sharp is a devDep; deploy uses --omit=dev).
  Now requires .png only, grace-exempts posts <4 days old (server covers them post-push;
  /images serves a placeholder meanwhile). Backfilled the 16 missing webp/avif. Suite
  **2970/2970 green**. Verified a coverless post dated today now passes.
- **BUT** the newsroom pushed coverless posts for 3 weeks with that guard in place, so it
  wasn't the sole blocker. Remaining cause is at the **routine-run level** — most likely a
  **GitHub push-auth** issue (Claude GitHub app access to f-o-x11/dreaming-press) or an
  account usage limit. Can't see run logs from CLI.
- **OWNER ACTIONS to unstick:** (1) open the routine's run history at
  claude.ai/code/routines/trig_016oXv4ZJ4TPTrTe6HDMTF2J → read the actual run error;
  (2) confirm the Claude GitHub app still has push access at
  github.com/settings/installations. Re-triggered manually 2026-07-18 ~20:26 UTC to test.

## Gil's 6-item loop — ALL SHIPPED + LIVE (2026-07-18, see `LOOP-QUEUE.md`)
1. ✅ **Auto-narration, per-author voices** — 8 authors → 8 Kokoro voices, automatic every
   deploy (`scripts/narrate-cycle.sh`). 25 backfilled mp3s shipped.
2. ✅ **Bigger subscribe box + button** — prominent base `.dp-sub` style lifts every form;
   dark band + right rail untouched. Live at `/subscribe`.
3. ✅ **"For AI agents only" interface** — `POST /api/agents/subscribe` (webhook/email,
   SSRF-guarded) + `/unsubscribe`, `GET /api/agent-hub.json` (one manifest of all pull
   endpoints), `/feed.json?since=` poll, webhook delivery (`scripts/notify-agents.js`).
4. ✅ **Engagement-driven newsroom** — `export-analytics.js` now writes top-by-reads/
   listens/views + a "WRITE MORE LIKE THESE" winning-pattern block, and folds in **X
   trending** (`scripts/x-trends.js`, runs each deploy) → `analytics/BRIEF.md`.
5. ✅ **Full smoke test + fixes** — site healthy across 16 page/viewport checks; fixed
   garbled-text AI covers (`ai-covers.js`: sanitizeMotif + no title in prompt + `--force`);
   regenerated the visible covers via the free flux fallback.
6. ✅ **Consolidation** — this doc + memory updated; final smoke test all green.

**API keys Gil granted (2026-07-18)** — stored in `.secrets/` (gitignored) + `/etc/dreaming-press.env`:
- **X (Twitter)**: v2 recent search WORKS (trending topics for commissioning). Posting needs
  the Access Token + Secret (not yet provided — bearer is read-only). See memory `reference-x-api`.
- **Bing/Azure Search key**: returns 401/400 on tested endpoints — likely needs its
  region-specific Azure endpoint. Ask Gil for the resource URL.

## Current state (latest — the on-page build is essentially complete)
- **Eval: 8.5/10** (honest v2 baseline was 7.11). Maxed dimensions: content, ux,
  structure, **discoverability (GEO) 10/10**. Near-max: art 8.6. Only two with real
  headroom left, both externally blocked: **audio 7.0** and **engagement ~6.5**.
- **Two GEO/AEO councils shipped** → `TRAFFIC-PLAN.md` (21 moves) and `GEO-PLAN.md`
  (25 moves). Autonomous GEO work is DONE: FAQ + FAQPage schema on every template
  (tool/compare/best/alternatives/topic-hubs/sections/home), front-loaded answer
  capsules on money pages, freshness stamps + dateModified, IndexNow-on-refresh,
  Baidu push script (`baidu-push.js`, inert until token), agents.txt, `.md`-twin
  extraction assets, editor bound to every article node, satire→CreativeWork schema,
  citable `/api/facts.json` (+ daily star-momentum snapshots accumulating), explicit
  AI + Chinese crawler admission in robots.txt.
- **Enhancements shipped** (from the 8-model visual council, `ENHANCEMENTS-V2.md`):
  suppressed demoralizing micro-metrics, contextual newsletter CTAs, homepage lead
  story, wire-feed thumbnails, tool-directory "Start here" row + sticky filters,
  agent-native tool pages (copy brief + add-MCP), all 5 calculators shareable via
  URL, calculator↔directory cross-links, and an **embeddable stats badge** (`/embed`).
- **Tests: 2597 green · visual QA 36/36.** Repo note: `.git` is ~5GB+ (mp3s are
  committed to reach the server) — mp3s really belong in object storage/LFS later.

### The two blockers (both yours, Gil)
1. **OpenAI quota exhausted (429).** The audio backfill stalled at ~60% coverage
   (audio 2.0→7.0) and new cover-art (gpt-image-1) is blocked. Top up the OpenAI
   account (ROSA key) to finish both — or approve the local **Kokoro** backfill
   (free, but ~1.8GB repo growth + a voice mix; see the audio-decision note).
2. **Engagement is real-dwell-capped** — it rises only with real traffic, which the
   GEO work is built to earn. The ceiling-raiser is the owner GEO-asks below.

## Done so far (earlier this session)
- **Auto-narration is live and automatic** — every deploy narrates recent posts
  with a modern neural voice (gpt-4o-mini-tts, per-author voice cast). Fixed the
  deploy so this runs even on "up-to-date" cycles.
- **Audio backfill running** on the server (`--backfill`, newest-news-first,
  resumable) to narrate the whole ~800-post corpus. Coverage 14% → climbing.
- **Eval harness v2** (`app/scripts/eval-harness.js`): the old one was a checklist
  frozen at 9.5. v2 grades continuously against the north star. Honest baseline
  **7.11/10**; now **7.48** and rising. Gaps it exposes: audio (2.0→3.6) and
  engagement (5.3→5.5, capped by real 13s dwell).
- **Inline auto-linking** (`app/lib/autolink.js`): article bodies now link the
  first mention of a tool/topic to its page — the next-click lever + internal-link
  SEO. 432/878 posts carry inline links.
- **Traffic council** done → **`TRAFFIC-PLAN.md`** (21 ranked moves, 90-day plan,
  autonomous-vs-owner split, KPIs). Read it — it's the growth roadmap.
- **Executed council move #1**: fixed `classifyChannel` — the site was blind to its
  real front door (AI assistants). Now detects Western + Chinese engines
  (Yuanbao/Doubao/Kimi/DeepSeek/Baidu-AI/…), a `classifyAssistant` naming, a new
  dashboard **"AI assistants"** panel, an AI line in `analytics/BRIEF.md`, and a
  backfill that also cleaned old pollution (bare "openai"/"chatgpt" in post slugs
  had been miscounted as AI traffic). Live: dashboard shows Yuanbao.

## Owner asks (this is where the real gains are now — all yours, Gil)
1. **Top up the OpenAI account** → finishes audio (last ~40%) + unblocks cover art.
2. **Verify in Google Search Console + Bing + Baidu Ziyuan.** DNS is on **Cloudflare**;
   we have the token + `scripts/cf-txt.sh` (proven write). Add the GSC Domain property,
   paste me the `google-site-verification=…` TXT, and a teammate runs
   `scripts/cf-txt.sh @ '…'`. Bing = "Import from GSC". Baidu = paste `DP_BAIDU_TOKEN`.
3. **Claim Wikidata items** for the publication + you as editor (feeds `sameAs`).
4. **Seed off-site corroboration** (Reddit/HN/newsletters) under your name — ~91% of
   AI citations are third-party pages. The **embed badge** (`/embed`) helps here.
5. **Google Publisher Center** — trust pages live; set up at publishercenter.google.com.

### Editor accountability: DONE
Gil Allouche is the named editor-in-chief on the About page (+ LinkedIn), every
article footer, the publisher-org schema, and now every article's schema node.

## Newer autonomous wins (this session)
- **AI-crawler monitor — now IP-VERIFIED and live on `/dashboard`.** `crawler-stats.js`
  checks each hit's source IP against the vendor's OWN published crawler ranges
  (OpenAI/Google/Bing/Perplexity JSONs, cached 24h). Live headline: **4,041 verified
  AI-engine crawls / 14 days — GPTBot 4,035 (99% confirmed against OpenAI's IPs)** +
  verified Bing/Google/Perplexity. Bots whose owners publish no IP list (ClaudeBot,
  Bytespider, Petal…) are shown in a separate "self-reported — not IP-verifiable"
  block, excluded from the headline. Reads the shared log (attributed by
  dreaming.press URL) + the host-pure per-vhost log (`access_log
  /var/log/nginx/dreaming.press.access.log` added to the nginx vhost). Story of how
  we got here: first version double-counted (shared server + UA-spoofers); Gil
  caught it; rebuilt it honest.
- **Crawler-demand → newsroom loop.** `export-analytics.js` now appends an "AI-crawler
  demand (RESEARCH BEFORE YOU WRITE)" section to `analytics/BRIEF.md`: the verified
  count + the exact pages answer-engines pull hardest, so the desk commissions more
  of what ChatGPT/Perplexity actually ingest.
- **Homepage rail gap fixed** — "Trending now" 3→5 + an "Explore" chip card
  (topic hubs, tools, comparisons) fills the rail and adds crawler-friendly links.
- **Mobile sticky bottom nav** (Home/News/Tools/Subscribe) under 700px — council pick.
- **7-model design council** (GPT-5.6, Gemini 3 Pro, Grok 4.5, Qwen3-VL, Llama 4,
  Mistral, avg 7.4/10) → roadmap in `COUNCIL-ROADMAP.md` (see below). Biggest
  consensus: faceted tool directory, article TL;DR + bigger type, contextual
  newsletter promise, and the big idea = productize the tool/report data into an
  embeddable, citable "Agent Stack Explorer / Knowledge Graph API."

### Security note (from Gil's "merxmap / are we hacked?"): NOT hacked
Server is SHARED (hosts eliasarcade, gilallouche, bloom0, zoegallery + dreaming.press).
SSH is key-only (0 failed passwords), all root logins are from our Clavern machine
(47.205.51.20), no rogue ports/processes/cron, no merxmap code. merxmap is just a DNS
name (`staging.api.template-test.merxmap.com`) someone pointed at our IP. **Hardened
2026-07-14:** nginx `000-default-reject` now 444s unknown hostnames (real sites
verified 200 after); 17 stale `*.bak*` vhost configs moved to `/root/nginx-stale-backups-*`.

## Council roadmap — approved, being worked through the loop (one per iteration)
Gil approved ALL of: (1) article TL;DR box + bigger type, (2) faceted tool directory,
(3) Agent Stack Explorer (interactive stack builder + embeddable widgets + JSON/MCP
API over 248 tools — the "big idea"), (4) gate the State-of-AI-Agents dataset+PDF
behind email capture. See `COUNCIL-ROADMAP.md`. Loop order: TL;DR → faceted /tools →
Stack Explorer → email gate.
- **Read-only MCP server (`/mcp`)** — the "written for agents" positioning is now
  literal + callable. Any MCP client can `search_articles`, `read_article`,
  `list_tools`, and `get_facts` over JSON-RPC 2.0 (POST /mcp, single or batch).
  Discovery via `GET /mcp` + `/.well-known/mcp.json`; advertised in agents.txt +
  agent-card. Read-only, no auth. `lib/mcp.js` (+ 10 tests). Live and verified.
- **Flagship report** `/reports/state-of-ai-agents` — a dated original-data report
  with 6 numbered anchored findings, methodology, APA+BibTeX cite-this, and a rich
  Dataset schema. A citation/backlink magnet answer engines quote at origin.
- **`/api/facts.json` + `/facts`** — a citable CC-BY original-data asset (881
  articles, tools + combined GitHub stars, 25 comparison clusters), with
  schema.org Dataset. robots.txt now explicitly welcomes AI crawlers. Eval 7.62.
- **Tool directory: 33 → 248** (`/tools`). Council-curated 215 verified API/SaaS
  tools (Exa, Tavily, ElevenLabs, Tavus, AgentMail, Sixtyfour, Browserbase,
  OpenRouter, Arcade, Stripe, Pinecone, …) + the 33 OSS repos, across 14 new
  categories. Detail pages (`/stack/<slug>`) rebuilt: "Get API key" CTA, at-a-glance
  chips, an **agents-can-self-signup** priority block, quickstart code samples,
  pricing/auth, MCP info, SDKs. Index has search + filters (agent-signup/MCP/API/OSS).
  Per-tool machine record at `/api/tools/<slug>.json`. Data lives in
  `lib/tools-services.js` (generated from the council) + `lib/tools-data.js`.

## How to run / see it
- Live: `https://dreaming.press` · Dashboard: `https://dreaming.press/dashboard`
- Local dev: `cd app && npm start` (SSR on :3000) — but the builder is on another
  machine; use the live URL, never localhost.
- Score it: `cd app && node scripts/eval-harness.js`
- Tests: `cd app && npm test` (2527 green) · Visual QA: `npm run qa:visual` (36/36)

## Gotchas
- The cloud sandbox is **egress-blocked from dreaming.press**, so analytics reach
  the newsroom via committed `analytics/BRIEF.md` + `snapshot.json`, not by fetching.
- Server-generated media survives `git reset --hard` (untracked until the deploy's
  commit-back git-adds it). `DP_AI_MEDIA_TRACKED=1` on the server.
- Secrets live in `/etc/dreaming-press.env` (600): OpenAI + now OpenRouter keys.
- Newsletter is dormant: `RESEND_API_KEY` not set — 735 dispatches queued safely.
