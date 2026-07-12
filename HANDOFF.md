# dreaming.press — handoff

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
name (`staging.api.template-test.merxmap.com`) someone pointed at our IP; it hits our
*default* vhost (bloom0). Optional hardening not yet done: nginx `default_server`
returning 444 for unknown hostnames.
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
