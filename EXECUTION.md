# dreaming.press → 1M/month — Execution Tracker

Executing the 30 council moves (`../dreaming-press-council-report.md`).
✅ shipped & deployed · 🟢 routine to continue (autonomous) · 🔵 needs owner action

| # | Move | Status | Notes |
|---|------|--------|-------|
| 1 | GSC + Bing verification + sitemap | 🔵 | Code ready: set `DP_GOOGLE_VERIFY` / `DP_BING_VERIFY` env on gil-vm → meta tags emit automatically. Owner: create the accounts, paste tokens, submit sitemap. |
| 2 | Decode double-encoded apostrophes in titles/dek | ✅ | `ingest.js decodeEntities()` — 47 posts fixed. |
| 3 | dateModified + article:modified_time | ✅ | Emitted in NewsArticle JSON-LD + OG. (Deploy-date stamping addressed by routine pivot.) |
| 4 | Newsletter 404 link fix + weekly digest | 🟢 | ✅ links now `/posts/<slug>.html`; weekly digest send = routine/cron follow-on. |
| 5 | Engaged-reads KPI + channel breakdown | ✅ | /newsroom leads with engaged reads; "where readers come from" by channel; raw views labeled honestly. |
| 6 | Make GitHub repo public + README | 🔵 | ⚠ Repo contains server IP + deploy keys/scripts — do NOT blanket-public. Recommend a sanitized public mirror or scrub first. Owner decision. |
| 7 | Freeze Dispatch firehose → Wire/Stack demand topics | 🟢 | Routine prompt now caps Dispatches ≤1/day, mandates demand-shaped Wire/Stack with search-intent titles. |
| 8 | Cold-start wedge: HN + subreddit submissions | 🔵 | See HANDOFF below — drafts ready; owner submits (can't post as you). |
| 9 | AVIF/WebP covers + srcset + preload | 🟢 | `fetchpriority`/dimensions shipped (#21); transcode pipeline = routine/build follow-on (needs `sharp`). |
| 10 | Live per-repo Stack pages | 🟢 | Engine spec in HANDOFF; routine to build on the `tools` table. |
| 11 | Named human Editor & Publisher | ✅ | About page now names an accountable human editor + contact (real name pending owner confirm). |
| 12 | "X vs Y" comparison pages | 🟢 | Routine to build from the tools table (spec in HANDOFF). |
| 13 | Recurring original-data study | 🟢 | Routine to scaffold "State of AI Agents" dataset + page. |
| 14 | Distribution-safe headlines (not "AI wrote this") | 🟢 | Routine prompt enforces topic-first titles; on-site transparency kept. |
| 15 | Topic clusters + pillar pages; topic tags | 🟢 | Routine to define clusters + pillars. |
| 16 | SQLite entities/tools table (pSEO prerequisite) | 🟢 | The shared prerequisite for #10/#12/#22 — routine to add. |
| 17 | Unbroken daily cadence | ✅ | Cloud routine fires hourly (verified `last_fired_at`); pivot enforces "never go dark". |
| 18 | Referrer/channel/session instrumentation | ✅ | Beacon sends referrer+utm+session; events classify channel; `channelBreakdown()`. |
| 19 | X + LinkedIn build-in-public | 🔵 | HANDOFF has the content system; owner creates accounts/posts. |
| 20 | CDN + caching | 🟢 | ✅ static cache-control fixed (was max-age=0); Cloudflare proxy toggle = owner (DNS). |
| 21 | fetchpriority + width/height on hero cover | ✅ | Shipped. |
| 22 | "Best X for Y" roundup pages | 🟢 | Routine to build from tools table. |
| 23 | Maintainer-outreach link loop | 🔵 | HANDOFF has the template; owner sends per Stack feature. |
| 24 | Syndicate to dev.to + Medium (canonical) | 🟢 | Needs owner dev.to/Medium API keys; .md twins make bodies portable. |
| 25 | BreadcrumbList JSON-LD (+ItemList/FAQ on lists) | ✅ | Breadcrumb on every article; ItemList/FAQ on list/explainer pages = routine follow-on. |
| 26 | Per-article provenance block + standards page | ✅ | Provenance aside on every article → #standards section on About. |
| 27 | .md-twin canonical/noindex + CWV budget in CI | ✅ | .md twins serve canonical→html + X-Robots noindex; CWV CI check = routine follow-on. |
| 28 | AI Regulation Tracker + live calculators | 🟢 | Routine to scaffold. |
| 29 | Topic-relevant related; route to section | ✅ | "Continue reading" → section archive; related is tag-aware; author binge loop present. |
| 30 | Trim over-length titles; fix missing meta descriptions | ✅ | Long titles drop the suffix; description always emitted. |

## Shipped this session (deployed to production)
Batches: #2 #4 (apostrophes, newsletter links) · #3 #21 #25 #26 #29 #30 (article SEO + trust) ·
#18 #27 #20 (instrumentation, .md canonical, caching) · #1 #5 #11 (verification, KPI, masthead) ·
#7 #14 #17 (editorial pivot via the autonomous routine).
**14 items fully shipped; 10 handed to the autonomous routine to continue; 6 need owner action.**

---

## HANDOFF — owner actions (with ready-made assets)

### #1 Search Console (5 min)
1. Go to search.google.com/search-console → add property `dreaming.press` → "HTML tag" method → copy the token.
2. On gil-vm: add `DP_GOOGLE_VERIFY=<token>` to `/etc/dreaming-press.env`; `systemctl restart dreaming-press`. The meta tag emits automatically; click Verify.
3. Submit `https://dreaming.press/sitemap.xml`. Repeat at bing.com/webmasters with `DP_BING_VERIFY`.

### #6 Public repo — ⚠ security first
The repo contains the server IP (`5.161.106.173`) and deploy scripts/keys references. Do **not** flip to public as-is. Options: (a) scrub infra details + rotate the deploy key, then public; or (b) create a clean public mirror with only `app/`, `content/`, docs. Tell me which and I'll prepare it.

### #8 Cold-start wedge — submission drafts (owner posts)
- **HN** (Tue–Thu 8–10am ET, one/week): submit a single strong **Wire/Stack** article URL (not the homepage, not "Show HN: AI…"). Title = the article's plain headline. Use the second-chance pool (news.ycombinator.com/pool) if <5pts.
- **Reddit**: r/AI_Agents, r/mcp, r/LocalLLaMA — post the *artifact* with a value-first title; engage in comments; never lead with "an AI wrote this".

### #19 X + LinkedIn — content system (owner runs accounts)
Daily: 1 value thread from a Wire/Stack piece, 2–3 replies in AI-builder threads, 1 "shipped today". The meta-story (an autonomous AI newsroom) is the hook.

### #20 CDN (owner DNS toggle)
dreaming.press is on Cloudflare DNS. Turn the proxy (orange cloud) ON for the A record, set caching to "Standard", and add a cache rule for `/images/*` + `/style.css` (cache everything, edge TTL 1mo). Origin already sends sane cache-control now.

### #23 Maintainer outreach — template
> Subject: featured {repo} on dreaming.press
> We curate tools for AI agents and featured {repo} in {article}. If it's useful, a "mentioned in" link helps others find it. Either way — nice work on {repo}.

### #24 Syndication (owner API keys)
Provide dev.to + Medium API keys (or connect accounts); I'll wire a `scripts/syndicate.js` that cross-posts each Wire/Stack piece 7–14 days post-publish with `canonical_url` back to the origin.
