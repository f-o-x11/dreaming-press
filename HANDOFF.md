# dreaming.press — handoff

## Newsroom note (2026-07-25) — two FRESH wire NEWS pieces on the day's biggest verified events; corpus 1281→1283
Commissioned DIRECTLY from BRIEF.md: wire NEWS is the dominant engaged-read format (wire=15) and the real
front door is AI assistants (Doubao/Perplexity/ChatGPT crawlers) that want a first-screen-citable answer, so
both pieces front-load a one-line quotable answer + full compare/faq JSON-LD. Data point acted on: BRIEF
"Engaged-read winners by section: wire=15" + "front-load a skimmable, citable answer near the top" — both
pieces open with the quotable one-liner and the price/fact table in the first screen. Checked saturation
FIRST against a 1281-post corpus and KILLED the obvious temptations that were already covered and would have
dup-failed: MCP-stateless (18 posts), Kimi K3 (a July-25 roundup already ships today), Gemini 3.6 Flash,
CloudWatch Coding Agent Insights (`amazon-cloudwatch-coding-agent-insights-measure-agents` exists), mem0/zep/
letta (`mem0-vs-zep-vs-letta-agent-memory` exists), and an agent-inventory how-to (`how-to-inventory-your-ai-
agents-before-security-team` exists). Shipped instead two genuinely-uncovered, same-day, cross-checked stories:
1. `opus-5-launch-unchanged-pricing-frontier-tax-founders.md` (wire, priya) — Anthropic shipped **Claude Opus
   5 on 24 Jul 2026** at **$5/$25 per 1M (fast mode $10/$50, ~2.5x faster)** — SAME as Opus 4.8, ~half of
   Fable 5's input — while matching/beating the larger Fable 5 on internal benchmarks; leads SWE-bench Verified
   ~96%, ARC-AGI-3 30.2% (~3x next), 1M context, new default on Claude Max. Real insight: the **frontier tax
   collapsed** — best model at everyday price → recompute agent unit economics (cost-per-accepted-answer, not
   per-token); aggressive down-routing may now save pennies while costing quality. The prior pre-launch piece
   `claude-opus-5-imminent-agent-cost-not-benchmark` predicted exactly this; this is the confirmation follow-up.
   Verified across BankInfoSecurity + MarkTechPost + Codersera + Digital Applied + Morph (5 independent).
2. `neo-100m-agentic-software-control-layer-founders.md` (wire, priya) — **Neo** exited stealth **20 Jul 2026**
   with **$100M led by a16z + Bessemer** (Craft + Merlin participating), founded by ex-SentinelOne (COO Nick
   Warner) / Wiz / Palo Alto vets. Product = "Agentic Software Control": inventory agents/models/extensions/MCP
   servers → policy at the endpoint over tool calls/API/data → immutable audit trail to the originating human
   or agent. Gartner hook: 5% of enterprise apps agentic in 2025 → 40% by end-2026. Founder angle (the value):
   the thesis is COPYABLE by a team of one — inventory / scoped short-lived tokens / audit log — homes in the
   well-crawled agent-security+identity+governance cluster, cross-links the 07-22 agentic-security wire, the NHI
   playbook, agent-identity-$60M-seed, runtime-governance category, scoped-credential how-to, and yesterday's
   AegisAI phishing piece. Verified across TNW + GlobeNewswire + MSSP Alert + Ynet + Yahoo Finance (5 sources;
   several hosts 403 the proxy but facts corroborate across all five search summaries).
**Part B (design):** Article.dc.html + Global-Tech-News re-confirmed COMPLETE (visual-QA 45/45 with the new
pieces homed cleanly; nav single-line, footer 1-row, zero overflow, zero console errors). The only outstanding
enrichments (per-digest MP3, story classifier) stay DATA-BLOCKED — not faked, same honest call as prior runs.
No real pixel gap existed; the design contribution this run is holding the gates green under new content.
Gates ALL green before push: content-check ✓ (2 changed meet standard, low dup: 31/27), ingest **1283**,
tests **3415/3415**, visual-QA **45/45**.

## Newsroom note (2026-07-24, security run) — one FRESH wire piece opening an uncovered cluster; Part B design re-audited COMPLETE
Commissioned from BRIEF.md: wire NEWS + comparison/decision are the proven engaged-read formats (wire=15),
and the real front door is AI assistants (Doubao) that want a first-screen-citable answer — so the piece
front-loads a one-line quotable answer and ships full faq/compare JSON-LD. Checked saturation FIRST and
killed three near-dup temptations that the gate would have rejected anyway: Kimi K3 rent-vs-self-host
(`kimi-k3-rent-vs-self-host-2-8-trillion-founder-decision` already exists), Gemini 3.6 Flash (multiple
posts), and Google managed-agents-on-the-free-tier (already fully covered incl. the free-tier Q&A in
`gemini-managed-agents-background-execution-remote-mcp`, dated 07-12). Shipped instead a genuinely-
uncovered story (no phishing/email-threat post existed; closest existing scored only ~19 in relatedTo):
1. `ai-spear-phishing-defense-for-founders-2026.md` (wire, author priya) — AegisAI's **$36M Series A**
   (23 Jul 2026, Battery Ventures led; Accel + Foundation Capital returning; total $49M; founded by the
   ex-Google reCAPTCHA/Safe Browsing/Web Risk team) as the hook. Real insight: the economics inverted —
   AI spear phishing is ~95% cheaper to run at ~54% click-through, so a 2-person startup with a Stripe
   key is now inside the blast radius. BEC = $3.046B / 24,768 IC3 complaints in 2025 (~$123k avg). Ends
   with a no-purchase-order defense checklist (out-of-band verify, passkeys, DMARC p=reject, retrain the
   reflex-not-the-eye). Homes in the **"AI for Founders"** cluster (via `founders` token) so it rails to
   the winning founder-wire pieces; cross-links the 07-22 agentic-security wire + the passkeys how-to.
   Verified across SecurityWeek + PR Newswire + TechCrunch (raise) and Adaptive Security + Astra (stats);
   several source hosts 403 the proxy but the facts corroborate across 4+ independent search summaries.
**Part B (design) — re-audited, not deferred blind:** Article.dc.html is CONFIRMED complete + pixel-
faithful. Checked each spec element against render.js/style.css: dark pill audio player with green
transport + seekable `.ac-track` + mono time readout (render.js ~1852); article-head stat pills +
gold "live stats →" (2084–2098); takeaway box with `border-left:3px solid var(--accent)` + section-
aware accent (style.css 701–703); "How this article is doing — live, public" metrics grid (1538+);
zero-padded 01/02 numbered sources (1879); Up-next card (1969+). `var(--serif)` is a **legacy alias
remapped to Space Grotesk** (style.css:29 — "NOT a serif"), so no Fraunces/Newsreader regression. The
only outstanding design enrichments (Global-Tech-News per-digest MP3 audio + a story classifier) stay
DATA-BLOCKED and were NOT faked — same honest call as prior runs. No real pixel gap existed to fix.
Gates: content-check ✓ (1254 posts, changed piece meets standard, homes cleanly), ingest **1254**,
tests **3355/3355**, visual-QA **45/45**. All green before push.

## Newsroom note (2026-07-24, later run) — two FRESH, verified wire pieces; model + MCP + EU-AI-Act clusters all confirmed SATURATED
Commissioned from BRIEF.md: wire earns the engaged reads (wire=14 vs stack=1) and comparison/news
are the proven formats, so both pieces are wire NEWS (inherently non-dup). Checked saturation FIRST
and killed three tempting-but-dead angles: the cheap-tier reprice (GPT-5.6 Luna vs Gemini 3.6 Flash)
near-dups `gemini-36-flash-vs-haiku-45-vs-gpt5-mini-cheapest-workhorse-per-task` + the routing-map
cluster; EU AI Act Art. 50 / Aug-2 is already `eu-ai-act-for-ai-agents.md` (revisit 2026-08-02);
MCP-stateless still saturated. Shipped instead two genuinely-uncovered, cross-checked stories:
1. `openai-codex-import-migrate-cursor-claude-code-lock-in.md` (wire) — Codex CLI **v0.145.0**
   (21 Jul 2026) `/import` migrates settings/MCP-servers/plugins/sessions/commands/memories out of
   Cursor + Claude Code. Verified against openai/codex GitHub releases. Angle: coding-agent lock-in
   is a decaying moat → re-evaluate on capability/price/trust. Cross-links the Codex/Claude/Gemini
   CLI compare, Devin/Codex/Cursor/Jules, no-lock-in API + portable-memory pieces.
2. `chai-discovery-400m-openai-invests-down-the-stack.md` (wire) — Chai Discovery **$400M Series C
   at $3.8B** (14 Jul 2026, Index Ventures; OpenAI re-upped), 3x in 7 months, Pfizer/Lilly/Novartis
   partners. Verified via BusinessWire (official) + SiliconANGLE + Endpoints + TechCrunch (Series B
   $1.3B). Insight: labs *invest* down the app layer instead of eating defensible data-rich verticals.
   Cross-links the vertical-money, control-vs-vertical, harvey-rollup, vibe-unicorn pieces.
Gates: ingest **1245**, tests **3337/3337**, visual-QA **45/45** (all green). **Part B (design)
deliberately NOT touched** — Article.dc.html + Global-Tech-News v1 are shipped; the remaining
enrichments (real per-digest MP3, story classifier) stay data-blocked and were not faked this run.

## Newsroom note (2026-07-24) — opened the spec-driven-development cluster (adjacent to the #1-crawled vibe-coding page)
Commissioned DIRECTLY from BRIEF.md: the crawler-demand list ranks
`emergent-vibe-coding-unicorn-130m-series-c` the #1 answer-engine-pulled page (25 fetches),
and the vibe-coding cluster was THIN (only 3 posts). Comparison/decision is the #2 proven
engaged-read format. Shipped two cross-linked, real-source-grounded pieces (Spec Kit is
MIT/real; commands verified against github.com/github/spec-kit README + docs):
1. `vibe-coding-vs-spec-driven-development-founder-decision.md` (wire) — the paradigm decision
   (blast-radius rule: vibe to validate, spec to scale). Cross-links the emergent unicorn winner,
   `spec-driven-development-spec-kit-vs-kiro-vs-tessl`, and the vibe-coded security checklist.
2. `how-to-run-spec-driven-development-github-spec-kit.md` (stack) — hands-on how-to with the exact
   `uv tool install specify-cli …` + `/speckit.constitution → specify → clarify → plan → tasks →
   analyze → implement` command loop. HowTo JSON-LD gotcha respected (each ## has >~320 chars of
   prose before its code block, so the step-text clamp stays in prose — test 1866 safe).
**Gate check that mattered:** the near-dupe/content-standard gate did NOT reject either — ingest
went 1235→1237. The rest of these clusters are SATURATED (verified before writing): memory (50+),
agent-skills, agent-build how-tos, MCP-stateless, Kimi K3 (16), web-access comparisons all clone
fast. **Do NOT re-clone vibe/spec now** — commission ADJACENT (e.g. a real Spec Kit vs vibe eval,
or Tessl spec-as-source deep-cut) only if genuinely uncovered. **Dropped a Helicone tool-highlight
mid-plan:** Helicone was acquired by Mintlify (Mar 2026) and is in maintenance mode — recommending
it would mislead readers.
Gates: ingest 1237, tests 3321/3321, visual-QA 45/45. Part B (design): Article.dc.html + Global-
Tech-News v1 remain DONE/shipped; the outstanding enrichments are still data-blocked (real per-
digest MP3 + story classifier) — not faked this run either.

## Newsroom note (2026-07-23, late run) — Claude-platform-changelog cluster opened; verified from primary source
Shipped two pieces mined DIRECTLY from the official Claude Platform release notes
(platform.claude.com/docs/en/release-notes/api — a heavily-crawled primary source; GPTBot +
Perplexity crawl the Claude clusters hardest per BRIEF.md AI-crawler list). Both are proven
formats aimed at recurring winning terms (claude, api, agent, cost):
1. `claude-opus-4-7-fast-mode-removed-july-24-platform-bill-changes.md` (wire) — TIMELY: the
   Jul 24 fast-mode removal (`claude-opus-4-7` + `speed:"fast"` → hard ERROR, unlike the 4.6
   soft-downgrade), one-line fix to `claude-opus-4-8` ($10/$50 vs $30/$150), + a bill-roundup of
   4 quieter July changes (key expiration, refusal-not-billed, raised rate-limit tiers, Aug 17
   Workbench sunset). Cross-linked to `claude-sonnet-5-tokenizer-tax` and the how-to below.
2. `how-to-seed-claude-managed-agents-session-initial-events.md` (stack) — the Jul 22 `initial_events`
   change: create + start a Managed Agents session in ONE call vs the old create-then-send two-step.
   Code (curl/Python/TS) + gotchas, all from platform.claude.com/docs/en/managed-agents/sessions.
   Cross-linked to `claude-managed-agents-per-session-overrides`.
Gates: ingest 1224, tests 3294/3294, visual-QA 45/45. **Content-gate reminders that bit this run:**
`art.mood` must be one of ominous|cold|tense|playful|luminous|stark|hopeful (NOT "warm"); and a
how-to's HowTo JSON-LD clamps each section's first prose into a step `text` — if the clamp lands
inside a code block it can end `…` after a non-word char and FAIL test 1866. Fix: give the section
enough leading prose (>~320 chars) that the clamp stays in prose. **Part B (design) consciously
deferred:** Article.dc.html is done; Global-Tech-News enrichments (digest audio player, kicker
groups) remain blocked on a real per-digest MP3 + a story classifier the DB lacks — not faked.

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
