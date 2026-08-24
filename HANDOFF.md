# dreaming.press — handoff

## SESSION 2026-08-24 — sitemap re-read, and the dashboard got date ranges

### Google is crawling normally again — confirmed
Owner resubmitted the sitemap in Search Console. Within ~15 seconds **verified Googlebot**
(192.178.4.4/5, reverse-DNS `googlebot.com`) fetched the full 744KB file successfully.

| | before | after |
|---|---|---|
| Discovered pages | 1,779 | **2,509** |
| Last read | Jul 22 | **Aug 24** |

Google had been working from a **month-old** snapshot and did not know about 730 pages.
This is also the cleanest proof the restart fix landed: a month ago ~1 in 12 of its
requests hit a dead process and it stopped returning.

**Domain properties need the FULL URL** in the Add-a-sitemap box (`https://dreaming.press/
sitemap.xml`), not just the filename — a bare path returns "Invalid sitemap address".

`news-sitemap.xml` shows "Couldn't fetch" but is **valid and was fetched successfully**
(logged: Googlebot, HTTP 200, 3,263 bytes). Its Last-read column is blank while the main
one shows today — the status was written at submission time, before the fetcher ran. Left
alone deliberately. One option was full W3C timestamps instead of dates, but posts carry
only a date, so that would invent precision; the spec accepts date-only for this reason.

### /dashboard — date ranges + six new panels
`?range=7d|30d|ytd|all` as plain links (no client JS; the dashboard is server-rendered and
a script just to rewrite a query string would be the only JS on the page). `?days=` still
works and its cap is now the site's own age, not 365, so all-time is not truncated as the
archive grows.

New, all from data already collected and previously unused:
- **period-over-period deltas** on every headline stat
- **traffic quality by channel** — read rate, pages/session, median dwell
- **by-desk** performance including pieces that earned the reads
- **top non-article pages** — `/build` and the hubs appeared nowhere before
- **most-used navigation surfaces**
- **audience** — confirmed subscribers, agent webhook subscriptions

What the quality panel immediately shows: **direct is 6,077 of 6,300 views at a 7% read
rate; organic is 116 views at 57%.** Volume and attention are inversely related here, and
the old channel bar chart hid it completely.

### Gotchas hit
- `dashboard.js` defines **`stat()` twice** — in `crawlerPanel` and in `renderDashboard`.
  The delta argument landed on the first. The page rendered perfectly and the feature was
  simply missing; no status check or smoke test catches that. Found by grepping the served
  HTML for "vs previous" and getting 0 while the numbers were 569 vs 185.
- `SUM()` over an empty comparison window returns **NULL, not 0** — every delta would have
  rendered `NaN%`. A zero-base delta now returns null rather than "+100%".
- `confirmedSubscribers()` returns **rows, not a count**.
- The browse tool only writes screenshots under `/tmp` or the repo.
- `dreaming.press.access.log*` globs **current-then-rotated**, so `tail` on the
  concatenation shows the OLDEST file. Read the current log alone.

4,600 tests green. `test/dashboard-range.test.js` pins the delta badge, the zero-base case,
single-active-pill, and that empty panels are dropped rather than emitting header-only tables.

---

## SESSION 2026-08-23 — the homepage was never broken

**Correction to yesterday's note.** It recorded "`/` returned 404 63 times to real AI
crawlers" as an open bug. That framing was wrong. Checked by method:

- **86 POSTs → 404. Zero GETs have ever 404ed.**
- ChatGPT-User and PerplexityBot made **356 GETs to `/`, all 200**.

A 404 on `POST /` is correct — there was no POST route. Nothing was broken.

### But the probes were a missed opportunity
The clients are AgenstryBot, KunlunYaochi-Probe, ChatGPT-User and Perplexity, and POSTing
to the root is how an agent probes for a **JSON-RPC endpoint**. This site has one, at
`/mcp`. Each probe was being answered with a 7KB HTML 404 page.

`POST /` now returns **405** with `Allow: GET, HEAD` and `Link: </mcp>; rel="service-desc"`.
A JSON-RPC-shaped probe gets a JSON-RPC-shaped reply — error `-32601`, the endpoint in
`data`, and **the request id echoed back**, because a JSON-RPC client correlates on id and
dropping it strands the caller. A non-RPC POST gets a plain JSON body listing `/mcp`,
`/openapi.json` and `/llms-full.txt`.

Verified live, the whole chain an agent now walks:
1. `POST /` → 405, points at `https://dreaming.press/mcp`
2. `POST /mcp` `tools/list` → 6 tools
3. `tools/call` `get_facts` → real CC-BY data

`test/root-post.test.js` pins the id echo, the endpoint pointer, and — most importantly —
that **`GET /` still returns HTML and not JSON**. 4,585 tests green.

---

## SESSION 2026-08-22 — the "49 broken links" were not broken links

Owner asked to fix the 49 404s, force a Google re-index, and make the site more
agent-friendly.

### There are no broken internal links
A full anchor audit — 1,274 pages fetched, **6,829 unique link targets**, every non-sitemap
target status-checked — found **0 broken links**. All 2,506 sitemap URLs serve 200.

The first run of that audit reported 2 breakages and both were the crawler's fault: a naive
`href="..."` regex matches string fragments inside inline JS. Scripts are stripped now.
**But one of those fragments turned out to be real anyway**: the log contains genuine
requests for `/stack/'+b.dataset.slug+'`, because other crawlers make the same mistake.
The `/build` page now builds hrefs as DOM nodes, so there is no literal to scrape.

### What the 404s actually are — read the RIGHT log
`/var/log/nginx/access.log` is the shared-box default vhost and is almost entirely
WordPress attack noise. **dreaming.press has its own log**: `dreaming.press.access.log`.
Scoped to it, 15,176 404s are mostly `.env` / `wp-admin` / `.git/config` probes — normal
internet background radiation, not a site defect.

The real finding: **152 requests across 12 `/stack/` URLs that were never published** —
`/stack/@upstash/mcp-server`, `/stack/@supabase/mcp-server-supabase`, `/stack/fly`,
`/stack/jina`. Agents read an npm package or vendor name out of an article and guess this
site's URL shape. That is demand, not breakage.

**Now resolved**: a miss gets one resolution pass. Confident single match → 301 to the real
tool. Ambiguous → keeps its 404 with candidates, because serving 200 for a page that does
not exist teaches a crawler that this site's 404s cannot be trusted.

| guessed URL | now |
|---|---|
| `/stack/@upstash/mcp-server` | 301 → `/stack/upstash` |
| `/stack/@supabase/mcp-server-supabase` | 301 → `/stack/supabase` |
| `/stack/@mastra/mcp-docs-server` | 301 → `/stack/mastra-cloud` |
| `/stack/fly` · `/stack/jina` | 301 → `fly-machines` · `jina-reader` |
| `/stack/@pinecone-database/mcp` | 404 — Pinecone is not in the directory |
| `/stack/openai` | 404 + candidates — two real products, do not guess |

Two bugs the tests caught, not review: the bare token `mcp` exact-matched a directory entry
called `mcp-servers`, so a **Pinecone** lookup got a confident 301 to an unrelated page (a
wrong redirect is worse than a 404 — the agent cannot tell); and `%%%` and `/` both crashed
the resolver into a 500 where 404 was correct. `test/tool-resolve.test.js` pins all of it.

### New agent surfaces
`llms.txt` advertised machine surfaces that nothing served. Now live:
- **`/llms-full.txt`** — every article grouped by desk with its markdown URL, one fetch (736KB).
  Deliberately the INDEX, not the prose: bodies are one `.md` fetch away each, and inlining
  1,844 articles would cost megabytes to answer any single question.
- **`/openapi.json`** — all 17 JSON endpoints with parameters, no auth. Previously an agent
  had to read English prose in llms.txt and guess.
- **`/ads.txt`** — 39 logged 404s; an empty authorised-sellers list is the IAB-standard way
  to say "no ads", which beats a 404 that only says "we did not answer".

`robots.txt` now lists all of them. Already present and verified good: JSON-LD on articles
(TechArticle, FAQPage, HowTo, BreadcrumbList, NewsMediaOrganization, Person, WebSite),
`.md` twins, MCP, agent-card, content-schema, per-desk RSS/JSON/podcast feeds.

### Re-indexing: what is and is not possible
- **IndexNow: done** — 671 URLs submitted, HTTP 200. Covers Bing/Yandex/Seznam.
- **Google does not accept IndexNow**, and Google's Indexing API is officially only for
  JobPosting and BroadcastEvent — not general pages. Google also **retired the sitemap ping
  endpoint in 2023**. So there is no API to force this.
- What Google actually responds to is a server it can crawl. **Verified after the restart
  fix: 600 URLs at 16 concurrency as Googlebot → 600x 200, zero failures** (was 8.7%).
  Sitemap carries lastmod on all 2,506 URLs, 36 dated today.
- **Owner action, 30 seconds:** Search Console → Sitemaps → resubmit `sitemap.xml`. Optional:
  URL Inspection → Request Indexing on 3-4 key pages.

### Unresolved
`/` returned 404 **63 times** to real AI crawlers (ChatGPT-User, PerplexityBot, Amazonbot,
AgenstryBot). Intermittent, still happening, and `/` serves 200 on demand. 0.03% of traffic
so it was not chased, but it is the homepage and the clients are exactly the audience.

---

## SESSION 2026-08-20 — the app was restarting 144x a day, and Google noticed

Owner sent the Search Console "6 reasons" breakdown. It splits cleanly:

| reason | pages | whose call |
|---|---|---|
| Discovered – currently not indexed | **1,702** | Google's |
| Crawled – currently not indexed | **386** | Google's |
| Not found (404) | 49 | ours |
| Alternate page w/ proper canonical | 32 | working as designed |
| Page with redirect | 10 | normal |
| Blocked / forbidden (403) | 1 | ours |

### THE FIX THAT MATTERED: 8.7% of crawl requests were failing
Crawling all 2,501 sitemap URLs at 16 concurrency returned **42x 502 and 177 refused
connections**. Every one of those URLs returned **200 when retried one at a time** — the
pages were never broken. nginx's error log said `connect() failed (111: Connection
refused)` to `127.0.0.1:3003`: the Node process simply was not running at that instant.

Cause: `server-pull-deploy.sh` restarted the app on the IDLE branch whenever analytics
changed — and analytics change on essentially every page view, so the 10-minute timer
restarted the app **~144 times a day**. Each restart is a 502 window.

"Discovered – currently not indexed" means Google knows the URL and **never fetched it**.
Google throttles crawl rate on repeated 5xx. 1,702 URLs sit in exactly that state.

**Fixed:** restart only when generated media changes (`audio/ai-narrations.json` /
`images/ai-covers.json`), since `has_audio` then needs re-ingesting. Analytics need no
restart at all — they are read from SQLite per request.

**Verified after the fix: 700 URLs at 16 concurrency → 700x 200, 0 failures (was 8.7%).**

Gotcha found while writing it: the first version checked `git diff --cached` *after*
`git commit`, which empties the index — it would have silently never restarted. The
staged list is now captured before the commit.

### Still open on the indexing side
- **49 404s and 1 403** — real broken URLs Google found. Not yet located; they are NOT in
  the sitemap (all 2,501 serve 200 now), so they come from internal links or old URLs.
- The 2,088 Google-systems rows are a trust judgment, not a bug. See the velocity table in
  the 2026-08-19 section: 1,024 articles in July on a 6-month-old domain with no backlinks.

### On mass directory submission — DO NOT
Researched because the owner asked. Bulk-submitting to hundreds/thousands of directories is
[explicitly what Google's link spam policy targets](https://developers.google.com/search/docs/essentials/spam-policies);
SpamBrain devalues those patterns automatically, and link spam has the harshest recovery
profile of any policy. On a domain already showing 96% non-indexing, it is the fastest way
to make things worse. Google also **closed manual Google News applications in April 2024** —
there is nothing to submit to.

What actually works instead: Publisher Center verification, a handful of real communities
(dev.to — LIVE, HN, Reddit, Product Hunt), and IndexNow (already wired:
`scripts/indexnow.js`, covers Bing/Yandex; Google does not participate).

---

## SESSION 2026-08-19 — why Google indexed 37 pages out of 2,180

Owner shared a Search Console screenshot: **37 indexed, 2.18K not indexed, "6 reasons."**
That single number explains the organic-traffic gap the rubric has been reporting all along.

### It is NOT a technical SEO problem — all of that checks out
Verified directly against the live site:
- `robots.txt` — no `Disallow` anywhere, both sitemaps declared
- `sitemap.xml` — **2,499 URLs** (an earlier `grep -c` said "1"; that counts LINES and the
  XML is one line — the gotcha already recorded in this file, hit again)
- articles send `<meta name="robots" content="index, follow, ...">` and a **self-referencing canonical**
- content quality is fine: **0 duplicate titles, 0 duplicate descriptions**, median **867 words**,
  only 15 pieces under 300

Google can crawl it. It is choosing not to index it.

### What the numbers actually say (all measured)
| fact | value | source |
|---|---|---|
| domain age | created **2026-02-21** — 6 months old | `whois` |
| corpus | **1,840 articles** | DB |
| July 2026 alone | **1,024 articles** | DB |
| Feb / Mar / Apr baseline | 46 / 31 / 2 | DB |
| external referrals | ~none; direct is 97% of views | analytics |
| Google indexed | **37 of ~2,180** | owner's GSC screenshot |

A 6-month-old domain with no external validation published **1,024 articles in one month**,
a ~25x jump off its own baseline. Crawled, assessed, 98% left unindexed.

**Verified vs inferred:** every row above is measured. The causal link to Google's
scaled-content assessment is INFERRED — the actual "6 reasons" are only visible by
clicking the Not-indexed breakdown in Search Console. Get those before acting further.

### What follows from it
1. **Stop mass publishing** — already done; cadence is 1/day since the cron change.
2. **Earn external signals** — dev.to syndication is now live (below). This is the first real one.
3. **Prune the tail, do not add to it.** 1,840 articles with 37 indexed is not an asset
   base. More volume is the thing that caused this.

### dev.to syndication — LIVE and verified
Key added to `/etc/dreaming-press.env`, service restarted, **2 articles published**,
canonical back-links confirmed rendering ("Originally published at dreaming.press").

Three bugs found and fixed by running it for real, not by reading it:
- **422** — dev.to caps titles at **128 chars**; wire headlines run to 155. Now trimmed on a word boundary.
- **429** — the create limit is **300 seconds** between articles (the error body says so; a 35s
  gap still lost 2 of 3). Now **one post per run**, with `DAILY_CAP = 5` spreading the rest
  across the day. Sleeping 5 min inside the deploy would stall the deploy.
- **tags were voice, not topic** — the corpus's five commonest tags are `reportive`,
  `opinionated`, `howto`, `cynical`, `captivating`, so dev.to received `#reportive`, a tag
  nobody browses. On dev.to the tag IS the distribution. Now derived from the text
  (`#ai #aiagents #llm #rag`). The pre-fix post was retagged via `PUT /api/articles/:id`.

**Gotcha:** `syndicate.js` had no daily ceiling — only `slice(0,3)` per run, and the deploy
timer fires often. With 326 eligible pieces that could have drained in hours and read as spam.
`DAILY_CAP = 5` added before the key went in.

### Still owner-gated
- **The 6 reasons** — click through Not-indexed in GSC and paste the breakdown.
- `DP_GOOGLE_VERIFY` **not needed** — verification is already satisfied by DNS TXT.
- `BING_API_KEY` on the server is **dead** (401 Web Search / 400 Webmaster).
- `OPENROUTER_API_KEY` is valid and paid but **read by no code**.
- `RESEND_API_KEY` unset — email digest inert.
- The dev.to key was pasted in plaintext chat; rotate it at some point.
- dev.to profile has **no bio and no avatar** ("404 bio not found"), which reads as spam
  and costs click-through. Needs the owner's dev.to login.

---

## SESSION 2026-08-17 — the site can now measure itself, and 14 things were quietly wrong

Owner asked for: a 50-page browser walkthrough, a grand LLM council to build an
evaluation rubric for reaching 1M visits/month serving humans AND agents, then a
30-iteration loop implementing the roadmap until the score hits 9.5/10.

### READ THIS FIRST: 9.5/10 IS NOT AUTONOMOUSLY REACHABLE
`RUBRIC.md` (new, council-produced, 11 weighted dimensions) scores DISTANCE TO
OUTCOME, not craft. Baseline was **1.3/10**; it is **1.85/10** now. Seven of the
eleven dimensions CAP below 10 without owner action, and 46 of the 100 weight
points sit in dimensions that only an audience can move:
- D1 attributable arrivals (16) — needs ~10,000 visits/mo vs today's 199
- D2 engaged reads (11), D3 crawl→citation (14), D11 compounding (5)
- D8 off-domain distribution (9) — capped at 3 without dev.to/Medium/HN/Reddit/X
- D7 query-demand (10) — capped at 4 without a Bing Webmaster key + GSC token
Building took D6 (measurement integrity) to its cap of 8 and moved D9/D10 off the
floor. It cannot move the rest. Expect a plateau in the low 3s, not 9.5.

**Run the evaluation yourself:** `cd app && npm run score`
(`scripts/measure.js` gathers facts → `scripts/score.js` applies the rubric.)

### WHAT SHIPPED (14 items, each with gates green)
| | |
|---|---|
| A1 | Route-family telemetry — 640 URLs incl. `/build` reported NOTHING before |
| A2 | `/crawlers` — the crawl→click ledger, per engine |
| A3 | Retrieval-bot demand in BRIEF.md + a support floor on "winning format" |
| A4 | `/data/agent-tools` — daily star time series, 8,008 observations, 32 days |
| A5 | `/api/claims.json` — 22,273 addressable claims with resolving deep links |
| A7 | Stack permutations as URLs — 15 indexed, 235 noindex (see below) |
| A9 | Machine-surface hygiene — 6 correctness bugs on the agent side |
| A10 | Ingest atomicity — the corpus-wipe landmine |
| A11 | Research-signal correctness — a freshness gate that could not detect staleness |
| — | Narration engine fallback, ghost-element fix, assistant-classification fix, channel segmentation, next-click instrumentation, head-metadata audit |

### THE THINGS THAT WILL BITE THE NEXT PERSON
1. **Template literals in render.js/pages.js emit BROWSER code.** `\s` is an
   unrecognised escape and emits as a bare `s` — a click handler was silently
   running `.split(/s+/)`, splitting on the letter s. A backtick in a comment
   terminated the template entirely (1,834 test failures). Keep those blocks plain
   ASCII with no regex escapes and no backticks.
2. **A present API key is not a working key.** OPENAI_API_KEY is set on gil-vm and
   the account is billing-blocked; preferring OpenAI "when a key exists" chose the
   dead engine every run. ai-narrate now falls back to Kokoro and logs loudly.
3. **CSS `display` beats the `[hidden]` attribute.** Two floating bars were painted
   on every page from first load with their reveal logic running correctly and
   nothing listening. ui-audit now has a `ghost` check for exactly this.
4. **`head()` is `head(title, desc, opts)`** — calling `head({...})` ships
   `<title>[object Object]</title>`, which it did, on two pages built to be cited.
   ui-audit now checks head metadata AND samples route families from the sitemap,
   because its hand-maintained page list never visited those pages at all.
5. **`agent_signup` is an enum**, not a boolean — `"manual-only"` is truthy.
6. **Frontmatter fields arrive in two shapes**: `;;` strings pre-ingest, arrays of
   cell arrays post-ingest. `String()` on the hydrated form yields "a,b,c", which
   still parses and silently glues every value onto its own definition.
7. **HTTP 200 does not mean the thing exists** — `/images/<slug>.png` serves a
   1263-byte placeholder SVG when art is missing. Check `content_type`.
8. **The UA bot filter catches `headlesschrome`**, so beacons cannot be verified
   from the default test browser. Set a real UA or the beacon looks broken.
9. **`analytics/` is git-tracked and the deploy runs `git reset --hard`** — never
   gate freshness on file mtime, it becomes checkout time. Gate on the timestamp
   inside the JSON.

### DECISIONS TAKEN THAT DEVIATE FROM THE ROADMAP
- **A7 shipped 15 indexed pages, not 250.** Measured before publishing: across the
  250 highest-scoring combinations there are only ~15 distinct verdicts, so 250
  pages would be 15 answers in 250 costumes. The cap was never the safeguard;
  distinctness is. The other 235 resolve with `noindex`.
- **A4 did NOT build GPU/model price datasets** despite those being the most
  demanded topics. No licensed feed exists here and scraping vendor pricing
  unattended would put unverifiable numbers on a masthead whose claim is "every
  number public". Owner-gated, not quietly filled with guesses.
- **A5 does not mine claims from prose.** Only authored structured fields
  (figures/FAQ/compare). A regex over sentences containing numbers would
  manufacture confident, wrong, precisely-attributed facts.

### THE TWO NUMBERS THAT MATTER
- **667 retrieval fetches per human session.** Answer engines fetch constantly and
  send almost nobody back. Every citability improvement is a bet on this ratio.
- **Zero agent subscribers**, against a genuinely excellent agent surface
  (agent-hub, JSON Feed cursor, MCP, `.md` twins, 22k claims). Built for an
  audience that does not know it exists.
- Bonus third: **~1.0 pages/session on EVERY channel.** Nobody clicks a second
  piece from any source. Next-click instrumentation just shipped to find out which
  surfaces readers even notice; it needs reader volume before it says anything.

### OWNER ACTIONS THAT UNLOCK THE MOST
1. `DP_GOOGLE_VERIFY` (Search Console) + a Bing Webmaster API key → `/etc/dreaming-press.env`. Unblocks D6→10 and D7→10.
2. dev.to / Medium keys, and a decision on brand posting to HN/Reddit/X → D8 (weight 9, capped at 3 today).
3. Podcast directory submissions (Apple/Spotify) → D10 cap 7→10.

## CADENCE CHANGE (2026-08-09) — ONE morning edition a day, not hourly

Owner: "we really only need new articles every morning 7am once a day."

The cloud routine **trig_016oXv4ZJ4TPTrTe6HDMTF2J** (renamed "dreaming.press daily
morning edition + product loop") now runs **`0 11 * * *` = 07:00 America/New_York**,
was `0 * * * *`. It is the ONLY thing that publishes — the local crons were already
disabled, and `dreaming-deploy.timer` (10 min) plus the server's `*/5` git pull are
DEPLOY, not publishing, so both stay as they are.

**The trigger API has no timezone field, so the cron is UTC.** 11:00 UTC tracks 07:00
Eastern during EDT; when EST resumes in November it will land at **06:00 Eastern**.
Change the cron to `0 12 * * *` then (and `EDITION_UTC_HOUR` with it) if 7am matters.

**Code that had to change, not just wording.** /newsroom publicly counts down to the
next edition, and that countdown was hard-coded to `60 - getUTCMinutes()` in TWO places
— server render (`newsroom.js`) and a client ticker that recomputed every 30s
(`pages.js`). Left alone it would have promised a new edition every hour on a site whose
entire pitch is that every number is public. Both now read one exported constant,
**`EDITION_UTC_HOUR` in app/lib/newsroom.js** — change the cron, change that constant.
The ETA also got a formatter (`editionEta`), because "Next edition in 1249m" is a number,
not information; it renders "20h 49m".

`newsroom-floor.test.js` asserted `nextEditionMin <= 60` — that bound encoded the hourly
cadence and is now 1440.

**Prompt changes beyond the schedule:** the routine is told it runs once daily and there
is NO second attempt, so it must fix-and-ship rather than leave a blank day (an hourly
failure used to self-heal within the hour — that safety net is gone). It also now ranks
the brief's four signals explicitly, with "Arrived but left" first, and runs
`ui-audit.mjs --strict` as a push gate.

**Known trade-off:** PART B (design/growth work) also drops from 24 runs a day to 1.
Product-improvement throughput falls with it. That is inherent to one routine doing both
jobs; if product velocity matters more than the article cadence, split PART B into its own
trigger.

## SESSION 2026-08-09 — narration unblocked, three layout bugs killed, two new signals

Owner asked for (a) human-like + UNIQUE narration without paying OpenAI/ElevenLabs,
(b) a whole-site e2e UI audit with automatic fixes, (c) a 6h autonomous improvement
loop using trends + analytics + an LLM council. All shipped and verified live.

### 1. Narration was DEAD, not merely robotic
`ai-narrate.js` could only talk to OpenAI TTS, and OpenAI has been hard billing-limit
blocked since July — so it produced nothing, silently, and every post since 2026-07-25
fell back to the browser's SpeechSynthesis voice. **0 of the 15 newest posts had audio**;
the dashboard's 0-listens figure was a missing-file problem, not a taste problem.
ai-covers.js already had a free fallback (pollinations); narration had none.

**Engine: Kokoro-82M (Apache 2.0), local, keyless** — `tts/kokoro_synth.py`, wired into
ai-narrate.js as the free path (OpenAI stays preferred if a key ever returns).
Benchmarked before choosing: Chatterbox beats ElevenLabs in blind tests and Orpheus is
more expressive, but both want a GPU or ~8GB; **gil-vm is 2 vCPU / 1.9GB and node
already holds ~660MB**. Measured on the server: RTF 0.51 (1.9x realtime), ~1GB peak.
Peak RAM is invariant to chunk size AND to int8 (both measured — the cost is
activations, not weights), so the fp32 model stays for quality and the script instead
STREAMS PCM into ffmpeg (waveform never fully in memory) and **yields entirely when
free RAM < DP_TTS_MIN_FREE_MB (default 900)**. The site comes first.

**UNIQUE, not just human:** Kokoro's 54 voices are the same 54 everyone else ships.
`create()` accepts a raw (510,1,256) style vector, not only a name — so each byline is
a **weighted blend of two voices** (`VOICE_BLEND` in kokoro_synth.py). Deterministic,
reproducible from the weights, and a voice that exists nowhere else. 9 bylines, 9 blends.
Subtle blends (~65/35) stay coherent; 50/50 smears the identity.

**GOTCHA / open decision:** narration currently runs on the OWNER'S LAPTOP and rsyncs to
`/opt/dreaming-press/audio-ai/`. The server can run it but is RAM-tight. The clean fix is
generating in GitHub Actions and shipping to the server — that needs Actions to hold prod
SSH write access, which is an OWNER DECISION, not taken. ~70 pieces narrated so far of 1817.

### 2. Three layout bugs, all geometry, none catchable by presence-checks
- **Both desktop gutter rails floated over the footer.** `.toc` and `.article-rrail` are
  `position:fixed`; the TOC had no hide logic and the right rail's script latched
  `shown=true` and never unset it. Measured: article body's bottom **2470px ABOVE the
  viewport**, both rails still painted at top:96, over "Continue reading" and the
  subscribe band. Fixed by `railGuard()` in render.js (anchors on the body's bottom edge,
  not a scroll %, because how much furniture sits below the text varies wildly).
- **`.provenance` had NO screen CSS at all** — only a print rule. It was the one direct
  child of `<article>` that never got the measure treatment: 20 siblings at 640px, it
  alone bled the full 1600px flush left.
- **The up-next bar was dead on EVERY narrated article.** Its reveal guard tested
  `!querySelector(".playall-bar")`, but audioSession appends its mini-player to the body
  AT SCRIPT EXECUTION (its own comment claims "mounts on first play" — it does not; only
  `.show` is deferred). So the guard always matched an invisible element. This is the only
  next-click surface that fires when a reader finishes, and the Kokoro backfill was
  spreading the suppression corpus-wide. Guard is now `.playall-bar.show` (both real bars
  signal visibility with `.show`, so "never stack two sticky bars" is preserved).

### 3. NEW: `app/scripts/ui-audit.mjs` — whole-site layout audit (`npm run ui:audit`)
20 page types + a round-robin article sample across sections x 4 viewports (390/768/
1280/1600). Measures rectangles: overflow, **escape** (a block wider than the measure its
siblings share), **collision** (a floater painting over content), broken images, clipped
text, mobile tap targets, console errors. `--strict` gates on high-severity.
**The collision check is the subtle part.** A first cut reported 94 findings, all of them
the sticky masthead and mobile tab bar doing their job. Two filters fixed it: edge-docked
full-bleed chrome is a bar; and — the sharp one — an **OPAQUE floater is a surface**
(content hidden beneath it is intended), while a **TRANSPARENT one lets the overlap show
through**, which is the mess a reader sees. That is exactly what the rails did
(`background: none`). Validated as a DETECTOR: run against LIVE with the bugs still up it
reported precisely the rail collision + the provenance escape and nothing else.
Live went **8 high-severity → 0**.

### 4. Two new commissioning signals (both fold into analytics/BRIEF.md)
- **`app/scripts/search-demand.js`** — Google + Bing + DuckDuckGo autocomplete, filtered to
  phrases NO post answers. Google Trends is useless here (its daily RSS returns "britney
  spears" even with `cat=t`); autocomplete IS the long tail that comparison/how-to pieces
  answer. First run: 25 seeds → 440 phrases → **307 uncovered**, incl. a dense
  agent-security cluster. Rate-limited to 1 refresh/6h in the deploy.
  This is the ONLY input describing people who have not arrived yet — organic is 20 reads
  /39 views against 3016 direct, so it is also the channel with the most headroom.
- **"Arrived but left"** section — the brief listed top-by-reads and top-by-views and never
  subtracted them, hiding the pages that earned clicks then lost everyone. Two Founder's
  Wire editions, same section+format, sit **5x apart on read rate** (413v/28r vs 155v/2r);
  one took 36 views to zero reads. Rewriting an opening is cheaper than earning traffic.

### 5. Brief honesty fixes (this file steers ~34 commissions/day)
- `winningPatterns()` was fed `[...topContent, ...topListens]` — 9 of 10 slugs overlap
  (25 entries, 16 unique), so narrated pieces were double-counted and inflated whichever
  format they used. Deduped by slug.
- The crawler-demand filter kept only `/posts|/stack|/compare|/best|/reports`, dropping
  **3230 of 4197** crawled hits — including **`/build` at 497 fetches, 4x the top article**.
  Answer engines pulling the stack-builder that hard is a signal in itself: agents want the
  TOOL, not only the write-up. Widened to content hubs; `/api/*` (1951 hits on /api/events)
  and assets still excluded.

### 6. Mobile tap targets: 112 undersized → 53
16-23px links against WCAG 2.5.8's 24px floor; 38 in the footer columns alone. Fixed the
standalone controls (footer, breadcrumb, tags, home-digest jump links, LIVE, bylines).
Also corrected the AUDIT: it was flagging links set inline in prose, which 2.5.8 exempts.

### GOTCHAS learned this session
- **Comments inside a browser-script template literal SHIP TO THE CLIENT as page text.**
  A backtick in one terminated the template (`ReferenceError: bar is not defined`, 1834
  test failures); a literal `<body>` in prose broke the one-body-tag assertion. Keep those
  comments plain ASCII with no backticks and no HTML-looking tokens.
- **HTTP 200 on `/images/<slug>.png` does NOT mean a cover exists** — a 1263-byte
  placeholder SVG is served when art is missing. Check `content_type`.
- The browse-skill browser caches `style.css`; `browse restart` to bust it.
- The LLM council is useful but **verify every claim**: it was right about the up-next
  guard, the double-count and the crawler filter, and WRONG that gil-vm's IP was blocked by
  the autocomplete endpoints (tested from the server: all three return 200).

## FIX (2026-08-06) — two sections had gone dark, and CI was cancelling itself

Owner reported "some sections weren't generating new articles for a while." Both true, two
unrelated causes. Site itself was never down (HTTP 200, wire + stack publishing hourly all day).

**1. Dispatches and Fabrications were dead — the hourly routine never commissioned them.**
The masthead ships four sections (`SECTION_ORDER` in `app/lib/data.js`: dispatches, wire, stack,
fabrications) but the cloud routine's prompt only ever named two: `section [wire=news,
stack=how-tos/tools]`. So Dispatches stopped at **2026-07-06 (31 days)** and Fabrications at
**2026-06-20 (47 days)**, while `/dispatches.html` and `/fabrications.html` kept serving a
month-old "latest" to readers. Not a bug in any code — a gap in the prompt, dating to the
2026-07-09 traffic pivot that (correctly) deprioritized zero-search-demand Dispatches but
silently zeroed them instead of flooring them.
FIX: added a **SECTION HEALTH** block to routine `trig_016oXv4ZJ4TPTrTe6HDMTF2J`. Every run it
checks the newest date per section and writes **exactly one** Dispatch if the newest is >7 days
old, **exactly one** Fabrication if >14 days old, and otherwise nothing. Self-regulating floor,
not a quota — wire/stack keep the whole run when both are current. Authors pinned
(`rosalinda`/`abe` for dispatches, `vesper` for fabrications). Verified the staleness shell
command in the prompt actually returns the right dates before shipping it.
NOTE: `check:content --strict` deliberately **exempts** both sections (check-content.js:65,
446, 558 gate the demand standard on wire+stack only), so reviving them cannot redden the build.

**2. CI was cancelling its own gates.** The server pushes an analytics/media snapshot every
~10 min; each one triggered a run and, via `cancel-in-progress`, killed the in-flight run of the
*content* commit before it. 14 of 40 runs cancelled that way — caught one live at 23:32
(`1a4c32f9`, a visual-QA test commit, killed by two analytics pushes behind it).
FIX: `paths-ignore` on `analytics/**` + the two media manifests. Also added `workflow_dispatch`
and a 15-min job timeout, and bumped checkout/setup-node to **v5** (Node 20 deprecated on runners).
Both CI commits verified green end-to-end (1m53s, zero annotations).

**3. `ai-covers.js` excluded the same two sections — a THIRD instance of the same blind spot.**
Surfaced only after (1) shipped: the revived posts rendered the grey "cover rendering" placeholder.
The pool hard-filtered `["wire","stack"]`, so a Dispatch/Fabrication could never be illustrated —
and with `RECENT_DAYS = 3` they aged out of eligibility before anything could pick them up, making
it **permanent, not delayed**. FIX: order instead of exclude (`coverPriority`), matching the shape
`ai-narrate.js` already uses correctly — its `priority()` ranks wire first without dropping any
section, which is why older voice pieces DO have audio. Demand pieces keep first claim; voice
pieces queue behind. Verified: `--dry --force` over the full pool gave all 8 top slots to
wire/stack even though the two voice pieces were newest by date; both covers then generated live
(distinct PNGs, 26996 + 55758 bytes) and the placeholder is gone from /fabrications.html.

**GOTCHA — HTTP 200 does NOT prove a cover exists.** `/images/<slug>.png` returns **200 with a
1263-byte placeholder SVG** (`content-type: image/svg+xml`) when the real art is missing. Check
`content_type`, never the status code — two slugs reporting an identical byte count is the tell.
This produced a false "covers generated" reading during this session before it was caught. Sibling
of the known `curl -f` / `grep -oc` gotcha above.

**The 5 red runs today were GitHub's fault, not ours** — "job was not acquired by Runner of type
hosted", "Failed to resolve action download info", 500s resolving `actions/checkout@v4`. Self-heals.
Also worth knowing: **red CI never blocks publishing** — gil-vm pulls `main` every 10 min regardless.

Gates verified locally before push: **4356 tests pass**, `check:content --strict` clean over
**1747 posts / 1587 demand pieces**, `check:cwv` 0 failures.

## Newsroom note (2026-07-26, scheduled run) — EU Digital Omnibus + Paper $34M; corpus 1313→1315
Commissioned from BRIEF.md. Data point acted on: "Engaged-read winners by section: wire=15" + the proven
governance cluster (china-persona-law = 5 engaged reads) and the "AI for founders funding/valuation" winner
cluster + "front-load a skimmable, citable answer near the top" (both open with a bold **The short version**
one-liner + first-screen compare table for Doubao/Google/Perplexity citability). Topic-checked ~16 candidates
FIRST. KILLED as SATURATED (do NOT re-draft): MCP Tasks extension (52%, `mcp-tasks-long-running-async-work`
+ `how-to-run-a-long-mcp-tool-call-as-a-task-stateless` exist), MCP Apps/server-UI (95%, `mcp-apps-how-to-give-
your-mcp-server-a-ui` exists), Kimi-K3 self-host-vs-API (85%, two pieces exist), Claude Opus 5 pricing/fast-mode
(61%, `opus-5-launch`/`upgrading-to-opus-5` exist), ChatGPT-Work-vs-Claude-Cowork (100% dupe), Wisesheets/
financial-data-API-for-agents (60%, `mcp-vs-rest-api-for-agents` etc.), sqlite-vec-vs-Qdrant (55%), Gemini
Managed Agents (66%), agent-memory-in-SQLite (85%, `google-always-on-memory-agent`), PyTorch 2.13 (already
`pytorch-2-13-flexattention-apple-silicon-founders`). Etched $300M and AegisAI $36M also near-dupes of existing
pieces. Shipped the two CLEAR verified pieces:
1. `eu-digital-omnibus-ai-act-delay-august-2-transparency-deadline-founders.md` (wire, soren) — Reg (EU)
   2026/1744 published Jul 24, in force Jul 27: high-risk Annex III → Dec 2 2027, Annex I → Aug 2 2028, BUT
   Article 50 transparency + synthetic-media labeling STILL starts **Aug 2, 2026** (only 50(2) watermarking for
   pre-existing systems gets a grace period to Dec 2 2026). Founder trap: the "delay" headline hides the one
   duty that hits every chatbot next week. Verified Gibson Dunn + Freshfields + Digital Applied + Modulos +
   Digital Watch. New Article 5 ban on nudifiers/CSAM noted.
2. `paper-34m-series-a-design-platform-agentic-era-html-css.md` (wire, priya) — Paper $34M Series A (Accel+
   ICONIQ, Jul 23), 25x ARR since Paper Desktop; transferable bet = HTML/CSS-native design so agents edit the
   production artifact not a picture ("give agents artifacts in their production format"). Follow-up to existing
   `tool-highlight-paper-design-platform-agentic-era`. Verified paper.design + Axios + FinSMEs + AIwire.
**Part B (growth):** both pieces dense-cross-link proven engaged-read winners (EU → multi-region-compliance/
china-persona-law/WAICO-vs-PAX/eu-ai-act-for-agents/companion-checklist/white-house-review; Paper → Paper
tool-highlight/Humanoid/Fireworks) — a data-commissioned time-on-site lever, zero render risk. Article +
Global-Tech-News design RE-CONFIRMED holding: visual-QA **47/47**, nav single-line, footer 1-row, zero overflow,
zero console errors — no pixel gap outstanding this run. Gates ALL green: content-check 1155 demand pieces,
ingest **1315**, tests **3479/3479**, visual-QA **47/47**. Pushed clean via `HEAD:refs/heads/main`.

## ⚠️ PUSH GOTCHA (learned 2026-07-25) — `git pull --rebase` leaves DETACHED HEAD
On this cloud sandbox the repo starts on a detached HEAD (no local `main` branch checked
out). `git pull --rebase origin main` then rebases the detached HEAD, and a subsequent
`git push origin main` pushes the STALE local `main` **branch ref** (still at the old base),
which GitHub rejects as `non-fast-forward` — even though your work is a perfectly valid
fast-forward. Symptom: fetch/ls-remote/GitHub-API all agree remote main = X, `merge-base
--is-ancestor X HEAD` says YES, yet `git push origin main` keeps failing. FIX: push the
detached HEAD explicitly → **`git push origin HEAD:refs/heads/main`** (worked first try).
Or `git checkout -B main && git push origin main`. Don't burn time re-fetching/rebasing;
the ref state is fine, the branch name resolution is the bug. NEVER force-push to "fix" it.

## Newsroom note (2026-07-25, scheduled PM run) — the H1 capital MAP + a composable-vs-monolithic decision; corpus 1300→1302
Commissioned from BRIEF.md. Data point acted on: "Engaged-read winners by section: wire=15" + the proven
AI-for-founders funding/valuation cluster + "front-load a skimmable, citable answer" (both open with a bolded
one-liner + first-screen compare/figures). Ran topic-check FIRST; KILLED the saturated temptations: Kimi K3
(53%+, full weights land Jul 27 but corpus already deep), MCP-stateless migration (69%), Opus-5-vs-Kimi coding
(57%), vLLM-vs-SGLang-vs-TGI (48%), Anthropic-$965B-most-valuable (STALE — that round was announced May 28, not
fresh; do NOT commission as breaking July news). Shipped two CLEAR (≤32%) verified pieces:
1. `ai-took-86-cents-every-vc-dollar-h1-2026-founders.md` (wire, priya) — PitchBook-NVCA H1 2026 (released
   mid-July): $412.7B US VC, **86% to AI ($355.9B)**, **87.5% into $100M+ megadeals**, **OpenAI+Anthropic = 43%
   of ALL global funding**, **3 firms = 48.1%**; Fortune: "almost none trickles down." July 23 roundup: **81%**
   of top rounds into physical AI (Etched $300M@$10.3B, Humanoid $152M@$1.35B). Founder read: the boom is a
   SUBSIDY not a fund — build revenue-first at the app/deployment layer where capital (and rivals) aren't.
   Distinct from the single-company pieces (it's the macro map + trickle-down lesson). Verified SiliconANGLE +
   Fortune + PitchBook + TechStartups.
2. `abstract-25m-composable-security-vs-monolithic-siem-founders.md` (stack, dex) — Abstract **$25M co-led
   Cheyenne+AVP, Jul 24, ~$50M total ~3x prior val**; "composable security operations" (in-stream detection,
   data stays in storage you own, Astro AI) vs monolithic SIEM. Reframed as a composable-vs-monolithic buying
   principle that generalizes across the stack; opens/joins the security-ops cluster crawlers pull. Verified
   PR Newswire + FinTech Global + AVP + FinSMEs.
**Part B (growth):** both home to strong clusters with dense mutual cross-links (piece 1 → Etched/Humanoid/
Fireworks/Alphabet-capex/escape-hatch/Corgi/Chai; piece 2 → email-security/spear-phishing/Neo/agent-inventory
+ demand-side-price-war). Data-commissioned time-on-site lever, zero render risk. Article.dc.html +
Global-Tech-News design RE-CONFIRMED holding: visual-QA **45/45**, nav single-line, footer 1-row, zero overflow,
zero console errors — no real pixel gap outstanding this run. Gates ALL green before push: content-check ✓ (1142
demand pieces), ingest **1302**, tests **3453/3453**, visual-QA **45/45**. Pushed clean via `HEAD:refs/heads/main`.

## Newsroom note (2026-07-25, scheduled run) — two FRESH wire "what priced this round" founder reads; corpus 1292→1294
Commissioned DIRECTLY from BRIEF.md. Data point acted on: "Engaged-read winners by section: wire=15" + the
winning "AI for Founders" funding/valuation cluster (Emergent, Corgi, agent-funding dominate engaged reads) +
"front-load a skimmable, citable answer near the top" (both open with a bold one-line answer + a first-screen
compare table for Doubao/GPTBot/Perplexity citability). Topic-checked ~9 candidates FIRST; both shipped pieces
CLEAR (0 near-dupes ≥50%). KILLED: voice-agent cluster (Presence/Grok/Realtime all 57–64% SATURATED), Google
Cloud Next "Gemini Enterprise Agent Platform" rebrand (research confirmed it's an **April 22, 2026** Next '26
event, NOT July — stale, would misdate; do not commission as fresh news), MCP-stateless (still saturated).
Shipped:
1. `humanoid-135b-unicorn-physical-ai-offtake-contract-founders.md` (wire, priya) — Humanoid (London, KinetIQ,
   HMND 01 wheeled) raised **$152M Series A at $1.35B** (announced 21 Jul), Prime Movers Lab lead + Schaeffler/
   Bosch/Fubon/Aglaé. Real insight: valuation priced on two BINDING pre-round industrial deals — Schaeffler
   deployment/supply (1,000+ units by 2032, signed May 13) + Bosch contract-manufacture up to 100k/5yr — i.e.
   committed demand + committed supply, not a demo. Founder read: get a signed purchase order + a delivery
   partner before you raise. Verified across TNW/Forbes/SiliconANGLE/Robot Report/company release (6+).
2. `fireworks-175b-specialized-intelligence-inference-founders.md` (wire, priya) — Fireworks **$1.5B Series D at
   $17.5B** (announced 16 Jul), $1B+ ARR (~5x YoY). Real insight: the load-bearing stat is **95% of its 40T
   daily tokens run on customer-SPECIALIZED small models, not frontier flagships** — production wants the right
   small model, not the best model. Founder read: specialize/distill the repetitive 80%, route only the hard 20%
   to frontier. Verified Fireworks blog/Yahoo/Quartz/Sacra.
**Part B (growth):** both home to the funding/inference clusters and carry a MUTUAL cross-link (the two halves of
"what a 2026 valuation actually rides on — nameable committed reality, not a benchmark"); each also rails to
cluster siblings (Corgi/Emergent/agent-funding/escape-hatch/inference-wars/cost-routing how-tos). Data-commissioned
time-on-site lever, zero render risk. Article.dc.html + Global-Tech-News design RE-CONFIRMED holding: visual-QA
45/45, nav single-line, footer 1-row, zero overflow, zero console errors. Gates ALL green before push: content-check
✓, ingest **1294**, tests **3437/3437**, visual-QA **45/45**. Pushed clean fast-forward via `HEAD:refs/heads/main`.

## Newsroom note (2026-07-25, PM run) — two FRESH wire founder-insight pieces on genuinely-uncovered same-day events; corpus 1284→1286
Commissioned DIRECTLY from BRIEF.md. Data point acted on: BRIEF "Engaged-read winners by section: wire=15" +
the winning "AI for Founders" cluster (founder pieces — Emergent unicorn, Neo, agent-funding — dominate engaged
reads) + "front-load a skimmable, citable answer near the top" (both pieces open with a bolded one-line answer +
an at-a-glance compare table in the first screen for Doubao/GPTBot/Perplexity citability). Ran topic-check FIRST
on ~8 candidates and KILLED everything already covered/saturated: Kimi K3 (20+ posts, today's daily wire already
shipped), Gemini-3.6-Flash-vs-Kimi cheapest-backend (65% SATURATED), MCP-stateless migration (63% SATURATED),
Crunchbase MCP (55%), Pydantic AI durability (49% — `pydantic-ai-v2-14-durability...` exists), DeepSeek model-name
retirement (`deepseek-chat-reasoner-retire-july-24-migrate-api` exists). ALSO killed a fully-drafted **Etched Sohu
$300M/$10.3B** piece at the check-content gate — it near-dup'd the existing `etched-sohu-300m-transformer-asic-
inference-economics` (topic-check missed it at 35%; check-content's stronger near-dup signal caught it → deleted,
NOT shipped). Shipped instead two uncovered stories, both multi-source cross-checked:
1. `cognition-bought-poke-ai-personality-agent-moat.md` (wire, priya) — Cognition (Devin) acquired **The Interaction
   Company / Poke** on **23 Jul 2026**, low-nine-figure, its 2nd acquisition in 3 days (TierZero 20 Jul). Poke = an
   iMessage/SMS/Telegram agent, 100M+ msgs/3mo, reportedly first 3rd-party agent approved for Apple Messages for
   Business; Scott Wu: "proactive, it knows you, fun to talk to." Real insight: with Opus 5/GPT-5.6/Kimi K3 all
   near-frontier, the coding-agent moat shifts from **capability → personality + presence** (copyable by a team of
   one: meet users where they text, be proactive, keep a voice). Homes to "AI for Founders" via `moat`. Verified
   TechCrunch + Yahoo Finance + Mezha + Nile1.
2. `corgi-4b-vertical-ai-valuation-velocity-founders.md` (wire, priya) — **Corgi** (AI insurance, founded 2024) hit
   **~$4B** around 22–23 Jul, its **3rd round in ~8 weeks** (Jan $108M A ~$630M → May $160M B TCV $1.3B → ext ~$2.6B
   → ext ~$4B), pricing on a **10x run-rate TARGET** ($45M→$450M, unbooked). Real insight (CEO-audience): froth is a
   temperature read, not a valuation to match — sell momentum if raising, ignore the comp if not. Same proven mold
   as the top-crawled Emergent unicorn piece. Homes to "AI for Founders" via `founders` slug token (was orphaning to
   the comparisons catch-all → renamed slug to fix). Verified Forbes + TechCrunch + Inc + MLQ.
**Part B (growth):** Strengthened the internal-link graph around the winning "AI for Founders" cluster — both new
pieces home there (not orphaned) and now carry a natural mutual cross-link (moat piece ↔ froth piece = the two
halves of "how to read the 2026 founder market"), plus each rails to the cluster's top-engaged siblings (Emergent,
agent-funding, gartner, demand-side price war). That's a data-commissioned time-on-site lever, zero render/style
risk. Article.dc.html + Global-Tech-News design RE-CONFIRMED holding: visual-QA 45/45 with the new pieces homed
cleanly (nav single-line, footer 1-row, zero overflow, zero console errors). Per-digest MP3 + story classifier stay
DATA-BLOCKED (not faked, same honest call as prior runs). Gates ALL green before push: content-check ✓ (2 changed
meet standard, low dup ≤19), ingest **1286**, tests **3421/3421**, visual-QA **45/45**.

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
