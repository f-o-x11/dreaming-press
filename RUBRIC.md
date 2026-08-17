# ARTIFACT 1 — THE RUBRIC

## dreaming.press → #1 AI news source, 1M visits/month, humans + agents
### A repeatable, outcome-anchored scorecard (v1, baseline 2026-08-17)

---

### Why this rubric scores lower than the six lenses

The six lenses scored 2–4 (avg ≈3.3). They were grading *the quality of the machine*. This rubric grades *distance to the stated outcome*. Those are different questions and the second one is much harsher. Every dimension below is anchored to an outcome a competitor could not fake by publishing more, and "10" is defined as *the value this metric would actually hold at 1,000,000 visits/month*, not as "good for a five-month-old site."

**The central fact, stated three ways:**

| Basis | Today | Monthly | Gap to 1M/mo |
|---|---|---|---|
| All counted views (`snapshot.json` `funnel.views`) | 2,996 / 14d | **6,420** | **156×** |
| Views with a real referrer (organic + ai + referral + campaign) | 93 / 14d | **199** | **5,025×** |
| Engaged reads (`funnel.reads`) | 309 / 14d | 662 | 1,511× to hit 1M *reads* |

97% of counted traffic is `channel = "direct"`, which `app/lib/db.js:231` assigns to **any request with an empty referrer**, at 1.003 pages/session (2,996 views / 2,986 sessions). Nobody currently knows whether that 2,903 is people or headless noise. **That ambiguity is itself the single most damning finding in this audit** — the site cannot presently tell whether its gap is 156× or 5,000×. Dimension 6 exists because of it and is weighted accordingly.

---

## The dimensions

Weights sum to 100. Score each 0–10 using the anchors. Where a dimension is **CAPPED**, an autonomous agent cannot exceed the cap without a named owner action; that cap is stated in the row and repeated in the cap summary.

---

### D1 — Attributable human arrivals · weight 16

**Measures:** monthly visits that came from an identifiable source. Deliberately excludes `direct`, because `direct` is the one channel that inflates without anyone reading anything.

**How to measure (script-runnable):**
```bash
python3 - <<'PY'
import json
s=json.load(open('analytics/snapshot.json'))
v=sum(c['views'] for c in s['channels'] if c['channel']!='direct')
print('attributable views/mo =', round(v*30/s['windowDays']))
PY
```

**Baseline today: 199/month** (organic 57 + ai 17 + referral 11 + campaign 8 = 93 per 14 days).
**10 = 250,000 attributable visits/month** (the level consistent with 1M total when `direct` is ~60–75%).

| Score | Anchor |
|---|---|
| 0 | < 100/mo — indistinguishable from crawler spillover |
| 1 | ~200/mo ← **today** |
| 3 | 1,000/mo, ≥ 5 distinct referring surfaces |
| 5 | 10,000/mo |
| 8 | 100,000/mo, no single source > 50% |
| 10 | 250,000/mo, ≥ 4 sources each contributing ≥ 10% |

**CAPPED at 6 without owner action.** Getting past ~15k/mo attributable requires off-domain surfaces that need accounts and brand posting (see D8, O3–O9). An agent can build every asset; it cannot post to HN under the publication's name.

---

### D2 — Engaged-read volume · weight 11

**Measures:** attention actually delivered, not pages served. A read fires only from a JS-executing browser that stayed ≥2s and reported on `visibilitychange`/`pagehide` (`app/lib/render.js:2995`, `:3017`). Very hard to inflate by publishing.

**How to measure:**
```bash
python3 -c "import json;s=json.load(open('analytics/snapshot.json'));print(round(s['funnel']['reads']*30/s['windowDays']),'reads/mo;',round(100*s['funnel']['reads']/s['funnel']['views'],1),'% read rate')"
# cross-check: curl -s https://dreaming.press/api/analytics | python3 -c "import json,sys;print(json.load(sys.stdin)['totals'])"
```

**Baseline today: 662 reads/month** (309/14d, 10.3% of views; `/dashboard` shows 510 over 30 days on its own window). Lifetime: **617 reads across 1,838 posts and 15,718 views.**
**10 = 200,000 engaged reads/month** (20% read rate against 1M).

| Score | Anchor |
|---|---|
| 0 | < 250/mo |
| 1 | ~650/mo ← **today** |
| 3 | 3,000/mo |
| 5 | 12,000/mo, read rate ≥ 12% |
| 8 | 100,000/mo, read rate ≥ 18% |
| 10 | 200,000/mo, read rate ≥ 20%, ≥ 30% of reads on pages older than 90 days |

The "older than 90 days" clause at 8+ is the anti-gaming clause: a daily news firehose can buy reads today and none tomorrow.

**CAPPED at 6 without owner action** (same reason as D1).

---

### D3 — Crawl → citation → click conversion · weight 14

**Measures:** the single ratio where the 156× actually lives. The site is fetched 16,207 IP-verified times per fortnight by exactly the engines it wants to be the #1 source for, and converts a fraction of a percent of that into a human arrival.

**How to measure:**
```bash
python3 - <<'PY'
import json
c=json.load(open('analytics/crawlers.json')); s=json.load(open('analytics/snapshot.json'))
RET={'ChatGPT-User','OAI-SearchBot','PerplexityBot','Claude-User','Claude-SearchBot','DuckAssistBot'}
ret=sum(b['verifiedHits'] for b in c['bots'] if b['name'] in RET)
sess=sum(ch['sessions'] for ch in s['channels'] if ch['channel']=='ai' or ch['channel'].startswith('campaign:'))
print(f'retrieval fetches={ret}  assistant sessions={sess}  ratio={ret/max(sess,1):.0f}:1  CTR={100*sess/max(ret,1):.3f}%')
PY
```

**Baseline today: 6,787 verified retrieval fetches → 23 assistant-referred sessions = 295:1 (0.34%), i.e. ~49 assistant sessions/month.** Against *all* verified AI fetches (16,207) it is **648:1 (0.15%)**. Per-engine: PerplexityBot 3,964 verified → 1 session. Bingbot 11,434 verified → 42 referrals.

**10 = ≤ 50:1 conversion AND ≥ 25,000 assistant-referred sessions/month.** Both clauses required — the ratio alone is gameable by *reducing* crawl.

| Score | Anchor |
|---|---|
| 0 | ratio unmeasured (no join between `crawlers.json` and referral data exists) |
| 1 | ratio known, < 100 assistant sessions/mo ← **today (49/mo)** |
| 3 | ≥ 500 assistant sessions/mo, ratio ≤ 500:1, published per-engine |
| 5 | ≥ 3,000/mo, ratio ≤ 250:1 |
| 8 | ≥ 12,000/mo, ratio ≤ 100:1, ≥ 3 engines each > 1,000 |
| 10 | ≥ 25,000/mo, ratio ≤ 50:1, and named as a source in ≥ 100 distinct assistant answers/mo |

Note this ratio is *already* better than Cloudflare Radar's network-wide GPTBot figure (~900:1). The defect is volume of citation-worthy answer units, not access.

---

### D4 — Agent-side pull depth (usage, not surface area) · weight 8

**Measures:** whether the agent surface is *used*, not whether it *exists*. Surface area is the classic gameable proxy — this site has a beautiful one and zero consumers.

**How to measure:**
```bash
curl -s https://dreaming.press/api/agent-hub.json | python3 -c "import json,sys;print(json.load(sys.stdin)['counts'])"
# on gil-vm:
grep -c 'feed.json?since' /var/log/nginx/dreaming.press.access.log
grep -c 'POST /mcp'        /var/log/nginx/dreaming.press.access.log
sqlite3 app/data/dreaming.db "select count(*) from agent_subs;"
```

**Baseline today: `agent_subscribers: 0`, `agent_subs` = 0 rows, `agent_dispatched` = 0, and zero `/feed.json?since=` requests anywhere in a 109,418-hit / 14-day log window.** Surface readiness would score ~9 (agent-hub, JSON Feed, llms.txt, `/api/tools.json`, `.md` twins, MCP with 4 tools, webhook subscribe, `/.well-known/*` — all live and spec-correct). Usage is zero.
**10 = ≥ 500 registered agent subscribers, ≥ 50,000 cursor/MCP pulls/month, listed in ≥ 20 agent registries.**

| Score | Anchor |
|---|---|
| 0 | no agent surface |
| 1 | complete surface, 0 subscribers, 0 cursor pulls ← **today** |
| 3 | ≥ 10 subscribers OR ≥ 500 cursor/MCP pulls/mo |
| 5 | ≥ 50 subscribers, ≥ 5,000 pulls/mo, ≥ 3 registry listings |
| 8 | ≥ 200 subscribers, ≥ 25,000 pulls/mo, ≥ 10 listings |
| 10 | ≥ 500 subscribers, ≥ 50,000 pulls/mo, ≥ 20 listings, ≥ 5 named third-party agents depending on the feed |

**CAPPED at 6 without owner action** — most MCP registries and agent directories require an account and an email-verified submission.

---

### D5 — Session depth and return · weight 7

**Measures:** whether an arrival becomes more than one pageview, and whether anyone comes back. The compounding multiplier — at 1.003 pages/session, every visit must be bought individually forever.

**How to measure:**
```bash
python3 -c "import json;s=json.load(open('analytics/snapshot.json'));f=s['funnel'];print('pages/session',round(f['views']/f['sessions'],3),'| avgTimeSec',s['site']['avgTimeSec'],'| completes/reads',round(f['completes']/f['reads'],2))"
sqlite3 app/data/dreaming.db "select count(*) from (select sid from events where type='view' group by sid having count(*)>1);"
```

**Baseline today: 1.003 pages/session. `site.avgTimeSec = 0`** — the read-time instrument publishes zero at the site level while the home page prints "avg 0:06" beside individual items computed on n=4 samples with no minimum-sample floor (`app/lib/db.js:298`). Returning-visitor rate is **not measurable** — `events.sid` is a session id, not a persistent one.
**10 = ≥ 2.2 pages/session, median engaged time ≥ 90s, ≥ 25% returning sessions.**

| Score | Anchor |
|---|---|
| 0 | depth not measurable at all |
| 1 | ≤ 1.05 pages/session and/or `avgTimeSec == 0` ← **today** |
| 3 | ≥ 1.2 pages/session, `avgTimeSec` non-zero and sample-floored |
| 5 | ≥ 1.5 pages/session, median ≥ 45s, return rate measurable |
| 8 | ≥ 1.9 pages/session, median ≥ 75s, ≥ 15% returning |
| 10 | ≥ 2.2 pages/session, median ≥ 90s, ≥ 25% returning |

---

### D6 — Measurement integrity · weight 10

**Measures:** can this system see its own outcomes? This is weighted at 10 because *every other dimension's score is only as trustworthy as this one*, and because the autonomous routine steers on `analytics/BRIEF.md`, which can only see what is instrumented.

**How to measure:**
```bash
# 1. route-family beacon coverage — currently 1 of 13
for p in / /build /tools /topics /stacks /series /concepts /calculators \
         /best/framework /compare/langgraph-vs-crewai /stack/langgraph \
         /alternatives/langgraph /posts/ai-coding-agent-ranking-2026.html; do
  printf "%-46s %s\n" "$p" "$(curl -s -A 'Mozilla/5.0 Chrome/120' https://dreaming.press$p | grep -c 'api/events')"
done
# 2. site-level dwell sanity
python3 -c "import json;print('avgTimeSec',json.load(open('analytics/snapshot.json'))['site']['avgTimeSec'])"
# 3. search-console verification
curl -s https://dreaming.press/ | grep -c google-site-verification   # → 0
curl -s -o /dev/null -w '%{http_code}\n' https://dreaming.press/BingSiteAuth.xml  # → 200 (verified)
```

**Baseline today:**
- **1 of 13 route families emits a beacon.** Only `/posts/<slug>.html` (2 occurrences). `/build` — the single most-crawled path on the site, top-5 for 11 of 22 bots — returns **0**. So do `/`, `/tools`, all 252 `/stack/*`, all 252 `/alternatives/*`, `/compare/*`, `/best/*`, `/calculators`, `/topics`, `/stacks`, `/series`, `/concepts`. That is **640 of 2,476 sitemap URLs reporting nothing**, and `app/lib/db.js:425` `topContent` JOINs `posts`, so hub pages can never reach BRIEF.md even if instrumented naively.
- `site.avgTimeSec = 0` while per-item averages publish on n=4.
- Google Search Console **unverified** (`DP_GOOGLE_VERIFY` unset, `render.js:1068` gates the meta; live homepage has no tag). Bing **is** verified (`BingSiteAuth.xml` → 200).
- **No join exists** between `analytics/crawlers.json` and referral data — D3 currently has to be computed by hand.
- `analytics/crawlers.json` top-paths table is publicly served at `/api/crawlers.json` and rendered on `/dashboard` with `/api/events` as the #1 "crawler-pulled path" for four bots — a POST-only beacon that returns 404 on GET.

**10 = 100% of sitemap route families beaconed with a page-level rollup; `avgTimeSec` non-zero with an n≥20 floor; GSC + Bing Webmaster both verified with query data exported into `analytics/`; a per-bot crawl→referral join published and fed to the routine; no known-false number on any public surface.**

| Score | Anchor |
|---|---|
| 0 | article views only, no channel attribution |
| 2 | ← **today**: articles instrumented, 640 hub URLs blind, `avgTimeSec` broken, no crawl↔visit join, GSC unverified |
| 4 | all route families beaconed + page-level rollup in BRIEF.md |
| 6 | + `avgTimeSec` fixed with sample floor, `/api/events` excluded from the public crawler table |
| 8 | + per-bot crawl→referral join published and machine-readable |
| 10 | + GSC verified, both webmaster tools' query data exported into `analytics/`, every public number reproducible from a committed file |

**CAPPED at 8 without owner action** — GSC verification requires the owner to paste a token (`DP_GOOGLE_VERIFY`).

---

### D7 — Query-demand ownership · weight 10

**Measures:** phrases the site *owns*, not phrases it has *written about*. Coverage is the classic inflate-by-publishing proxy; ownership is not.

**How to measure:**
```bash
python3 -c "import json;d=json.load(open('analytics/search-demand.json'));print(d.get('reached'),len(d.get('phrases',[])),'phrases; fetched',d.get('fetched_at'))"
# ownership requires webmaster query data:
#   Bing Webmaster API (site already verified, key goes in .secrets/bing.env)
#   Google Search Console (owner-gated)
# interim proxy: organic sessions/month
python3 -c "import json;s=json.load(open('analytics/snapshot.json'));o=[c for c in s['channels'] if c['channel']=='organic'][0];print(round(o['sessions']*30/14),'organic sessions/mo')"
```

**Baseline today: 438 phrases tracked, 286 uncovered (35% have a page). 118 organic sessions/month, from Bing 31 + DuckDuckGo 26 + cn.bing 11 + Brave 3 + Google 5 hits per fortnight.** Phrase-level ownership is **unmeasurable today** — no webmaster query export exists.
**10 = ≥ 1,000 phrases tracked, ≥ 40% delivering ≥ 1 organic session/month, ≥ 150,000 organic sessions/month.**

| Score | Anchor |
|---|---|
| 0 | no demand signal at all |
| 1 | ← **today**: demand list exists, ownership unmeasurable, < 250 organic sessions/mo |
| 3 | webmaster query data exported; ≥ 1,000 organic sessions/mo |
| 5 | ≥ 8,000 organic sessions/mo; ≥ 15% of tracked phrases delivering |
| 8 | ≥ 60,000/mo; ≥ 30% delivering; top-3 position on ≥ 50 phrases |
| 10 | ≥ 150,000/mo; ≥ 40% delivering; top-3 on ≥ 300 phrases |

**CAPPED at 4 without owner action.** You cannot score phrase-level ownership without query data. Bing's half is nearly free (site is verified; needs an API key in `.secrets/bing.env`); Google's half needs `DP_GOOGLE_VERIFY`. **Do not chase Google beyond verification** — 536 verified Googlebot fetches produced 5 referral hits in 14 days; Bing, DuckDuckGo, Brave and Chinese assistants are the actual human front door.

---

### D8 — Off-domain distribution footprint · weight 9

**Measures:** how many places outside dreaming.press can send a human. This is the dimension that most directly gates D1 and D2, and the one most thoroughly blocked on the owner.

**How to measure:**
```bash
python3 -c "import json;r=json.load(open('analytics/snapshot.json'))['referrers'];print(len(r),'referring domains');[print(' ',x['ref'],x['sessions']) for x in r]"
ls .secrets/                                    # → bing.env, x.env  (no DEVTO_API_KEY, no Medium)
sqlite3 app/data/dreaming.db "select count(*) from subscribers;"   # → 0
node app/scripts/syndicate.js                   # → "eligible, but DEVTO_API_KEY unset — nothing posted."
```

**Baseline today: 10 referring domains, ~8 of them real** (bing, duckduckgo, chatgpt, cn.bing, google, yuanbao.tencent, doubao, brave — plus a bare IP and a Lark office link). **0 syndication mirrors** (`syndicate.js` is built and exits early). **0 newsletter subscribers.** **0 confirmed registry/aggregator listings.** Podcast feed exists but `rss.xml` emits `<pubDate>2026-08-16</pubDate>` — not valid RFC-822, so readers fail to parse dates (the `rfc822()` helper sits 16 lines below in the same file).
**10 = ≥ 300 referring domains, ≥ 5 syndication mirrors publishing weekly with canonical back, ≥ 20 registry listings, ≥ 10,000 newsletter subscribers.**

| Score | Anchor |
|---|---|
| 0 | no referrers other than search |
| 1 | ← **today**: ~8 referring domains, 0 syndication, 0 subscribers |
| 3 | ≥ 25 referring domains OR ≥ 2 live syndication mirrors |
| 5 | ≥ 60 domains, ≥ 3 mirrors, ≥ 500 subscribers |
| 8 | ≥ 150 domains, ≥ 5 mirrors, ≥ 4,000 subscribers, ≥ 10 registries |
| 10 | ≥ 300 domains, ≥ 5 weekly mirrors, ≥ 10,000 subscribers, ≥ 20 registries |

**CAPPED at 3 without owner action.** Every route above 3 requires an account, a key, or the brand posting in public. Named blockers: `DEVTO_API_KEY`, Medium integration token, HN/Reddit/X/LinkedIn brand accounts, Baidu Ziyuan, Google Publisher Center, Apple Podcasts/Spotify, Product Hunt.

---

### D9 — Interactive asset yield · weight 6

**Measures:** the one surface with *demonstrated* machine demand. `/build` is the #1 crawled path for **11 of 22 bots** (Bingbot 225, Amazonbot 168, GPTBot 80, ClaudeBot 44, PerplexityBot 33) — it outdraws all 1,838 articles individually. Scored on both crawlable inventory *and* human yield, so it can't be gamed by URL-stamping.

**How to measure:**
```bash
curl -s https://dreaming.press/sitemap.xml | grep -o '<loc>[^<]*' | sed 's|<loc>https://dreaming.press||' \
 | awk -F/ '{print ($2==""?"(home)":"/"$2)}' | sort | uniq -c | sort -rn
# after D6 lands: share of engaged sessions whose landing path is a non-/posts route
```

**Baseline today: 571 crawlable interactive/decision URLs** (`/stack` 252, `/alternatives` 252, `/compare` 28, `/best` 23, `/stacks` 9, `/calculators` 6, `/build` 1) out of 2,476 total. Crawler affection is proven; **human yield is 0% measurable** because none of them beacon.
**10 = ≥ 5,000 crawlable decision URLs each with a distinct data-derived title and a machine twin, AND interactive pages producing ≥ 30% of all engaged human sessions.**

| Score | Anchor |
|---|---|
| 0 | prose only |
| 3 | ← **today**: 571 URLs, crawler-loved, human yield unmeasurable |
| 5 | yield measurable; interactive pages ≥ 10% of engaged sessions |
| 8 | ≥ 2,000 URLs, ≥ 20% of engaged sessions, each with `.json`/`.md` twin |
| 10 | ≥ 5,000 URLs, ≥ 30% of engaged sessions, expansion gated on measured per-URL yield |

The "gated on measured per-URL yield" clause at 10 is the anti-gaming clause: mass permutation URLs score 0 extra unless the previous cohort earned crawls *and* clicks.

---

### D10 — Differentiated-asset freshness (audio) · weight 4

**Measures:** the one asset genuinely nobody else has — a unique blended Kokoro voice per byline — and whether it is present on the pieces people actually land on.

**How to measure:**
```bash
for s in $(sqlite3 app/data/dreaming.db "select slug from posts where date>=date('now','-14 day')"); do
  curl -s -o /dev/null -w '%{http_code}\n' -I https://dreaming.press/audio/$s.mp3
done | sort | uniq -c
python3 -c "import json;print(json.load(open('analytics/snapshot.json'))['funnel']['plays'],'plays/14d')"
```

**Baseline today: 83 of 227 posts from the last 14 days are narrated (37%); a 30-slug random sample of the whole corpus returned 18/30 (60%).** Narration runs on the owner's laptop and rsyncs, so it structurally lags the 07:00 ET edition — the newest pieces, which get the most traffic, are the least likely to have audio and fall back to robotic browser `SpeechSynthesis`. **4 plays in 14 days; 17 lifetime.**
**10 = 100% narrated within 1 hour of publish, generated server-side; ≥ 5,000 plays/month; podcast feed with ≥ 1,000 subscribers.**

| Score | Anchor |
|---|---|
| 0 | no audio |
| 2 | ← **today**: ~60% corpus / 37% recent, laptop-dependent, < 20 plays/mo |
| 4 | ≥ 90% recent coverage, generation runs on the server |
| 6 | 100% at publish time, ≥ 300 plays/mo, valid RFC-822 podcast feed |
| 8 | ≥ 1,500 plays/mo, feed in ≥ 2 directories |
| 10 | ≥ 5,000 plays/mo, ≥ 1,000 podcast subscribers |

**CAPPED at 7 without owner action** — podcast directory submissions (Apple, Spotify) require accounts.

---

### D11 — Compounding efficiency · weight 5

**Measures:** whether the machine is getting *more efficient*, not just *bigger*. Explicitly penalises the failure mode of the last two months: 1,024 posts published in July while human traffic stayed flat.

**How to measure:**
```bash
sqlite3 app/data/dreaming.db "
 select substr(p.date,1,7) mo, count(distinct p.slug) posts,
        sum(coalesce(v.count,0)) views,
        round(1.0*sum(coalesce(v.count,0))/count(distinct p.slug),1) views_per_post
 from posts p left join views v on v.slug=p.slug group by 1 order by 1;"
# and: monthly attributable visits (D1) growth rate vs monthly new-URL growth rate
```

**Baseline today: 8.55 lifetime views per post (15,718 / 1,838). Best article ever: 418 views. Median post: ~0.** Verified AI crawler fetches grew 4,578 → 16,207 across five weekly snapshots (**+254%**) while human views stayed flat — machine demand is compounding, human demand is not, and nothing currently converts one into the other.
**10 = median 30-day views/post ≥ 500 AND attributable visits growing ≥ 20% MoM for 6 consecutive months while new-URL count is flat or falling.**

| Score | Anchor |
|---|---|
| 0 | traffic falling while URLs rise |
| 1 | ← **today**: URLs rising 3× faster than traffic; ~8.5 views/post lifetime |
| 3 | traffic growth ≥ URL growth; median 30-day views/post ≥ 15 |
| 5 | ≥ 10% MoM attributable growth for 3 months; ≥ 50 views/post |
| 8 | ≥ 20% MoM for 6 months; ≥ 200 views/post; URL count flat |
| 10 | ≥ 20% MoM for 6 months; ≥ 500 views/post; URL count flat or falling |

---

## BASELINE SCORE — the arithmetic

| # | Dimension | Weight | Score | Weighted |
|---|---|---:|---:|---:|
| D1 | Attributable human arrivals | 16 | 1 | 16 |
| D2 | Engaged-read volume | 11 | 1 | 11 |
| D3 | Crawl → citation → click | 14 | 1 | 14 |
| D4 | Agent pull depth (usage) | 8 | 1 | 8 |
| D5 | Session depth & return | 7 | 1 | 7 |
| D6 | Measurement integrity | 10 | 2 | 20 |
| D7 | Query-demand ownership | 10 | 1 | 10 |
| D8 | Off-domain distribution | 9 | 1 | 9 |
| D9 | Interactive asset yield | 6 | 3 | 18 |
| D10 | Audio freshness | 4 | 2 | 8 |
| D11 | Compounding efficiency | 5 | 1 | 5 |
| | **Total** | **100** | | **126** |

**Weighted baseline = 126 / 100 = 1.3 / 10.**

Read that honestly: the *craft* is a 4 and the *outcome* is a 1. The site has a genuinely excellent agent surface, a real interactive tool that crawlers prefer to every article, self-hosted neural narration, and a public-metrics dashboard — and it converts all of that into 199 identifiable human visits a month.

## Ceiling caps — where an autonomous agent runs out of road

| Dimension | Autonomous cap | Exactly what the owner must supply |
|---|---:|---|
| D1 Attributable arrivals | **6** | Brand posting on HN/Reddit/X/LinkedIn; syndication keys |
| D2 Engaged reads | **6** | Same |
| D4 Agent pull depth | **6** | Accounts on MCP registries / agent directories |
| D6 Measurement integrity | **8** | `DP_GOOGLE_VERIFY` token from Google Search Console |
| D7 Query-demand ownership | **4** | Bing Webmaster API key → `.secrets/bing.env`; GSC verification |
| D8 Off-domain distribution | **3** | `DEVTO_API_KEY`, Medium token, HN/Reddit/X accounts, Baidu Ziyuan, Google Publisher Center, Product Hunt |
| D10 Audio freshness | **7** | Apple Podcasts + Spotify submissions |

**Maximum achievable score with zero owner involvement: ≈ 5.5 / 10.** All of D3, D5, D9, D11 and most of D6 are fully autonomous — which is roughly 45 of the 100 weight points.

---
---

# ARTIFACT 2 — THE ROADMAP

Ordered by (impact ÷ effort), biased toward what compounds **at 6,420 views/month**, not at 640,000. Effort: **S** ≤ half a day, **M** ≤ three days, **L** ≥ a week.

Twelve council moves were adversarially challenged and **all twelve failed as stated**. I judged eleven of those challenges strong and one only partially strong (noted at A6). What survives below is the salvaged kernels, merged and re-ranked, plus six moves nobody proposed that the rubric makes obvious.

---

## AUTONOMOUS NOW — an agent can build and deploy this today

### A1 · Instrument every route family, with a page-level rollup — **BLOCKING**
**Build:** add the `beacon()` emitter (`app/lib/render.js:2995`, currently called from exactly one site, `:2727`) to all twelve blind route families: `/`, `/build`, `/tools`, `/topics`, `/stacks`, `/series`, `/concepts`, `/calculators`, `/best/:cat`, `/compare/:a-vs-:b`, `/stack/:tool`, `/alternatives/:tool`. This needs a non-post event path — `beacon()` hard-codes a post slug and `app/lib/db.js:425` `topContent` JOINs `posts` — so add a `path` key to `POST /api/events` (`app/server.js:592`) and a page-level rollup alongside the slug-level one, surfaced in `app/scripts/export-analytics.js`.
**Moves:** D6 **2 → 5** (+3). Unblocks scoring of D3, D5, D9, D11.
**Effort:** S–M. **Autonomous:** yes.
**Why first:** 640 of 2,476 URLs currently report nothing, including the single most-crawled path on the site. Every debate about "do hubs out-yield posts?" is currently unanswerable, and the 07:00 routine steers on a brief that structurally cannot see them. Nothing below is trustworthy until this ships.

### A2 · Publish the crawl → click join, and feed it to the routine
**Build:** a new `app/scripts/crawl-yield.js` joining `analytics/crawlers.json` per-bot `verifiedHits` + `topPaths` against first-party referral/session data, emitting `analytics/crawl-yield.json` and a per-engine table. Render it at a permanent `/crawlers` URL (currently **404**) by mounting the existing `crawlerPanel()` from `app/lib/dashboard.js:57`, with `schema.org/Dataset`, a "data as of" line, and entries in `llms.txt` + `sitemap.xml`. Add ~8 lines to `export-analytics.js` so BRIEF.md leads with it.
**Moves:** D3 **1 → 3** (+2), D6 +1.
**Effort:** S. **Autonomous:** yes.
**Why:** "GPTBot fetched us 7,420 verified times and sent N humans" is a number **only this site can compute** — Cloudflare has the crawl side, publishers have the visit side, almost nobody has both plus a public dashboard. It is the honest, defensible version of the crawler-report idea, and it makes D3 measurable so the rest of the roadmap can be steered.
**Ship with it (one line):** add `/api/events` and `/manifest.webmanifest` to the exclusion regex in `app/scripts/crawler-stats.js`. Right now the publicly-served top-paths table shows a POST-only beacon that 404s on GET as the #1 "crawler-pulled path" for four bots, under a banner reading "every number public."

### A3 · Retrieval-bot demand → commissioning loop
**Build:** feed `topPaths` from **retrieval-class verified bots only** (ChatGPT-User, OAI-SearchBot, PerplexityBot, Claude-User — never the unverifiable Amazonbot/Bytespider bulk) into `analytics/BRIEF.md` as a ranked "what assistants are pulling" block, above the existing "write more like winners" section.
**Moves:** D11 **1 → 3** (+2), D3 +1.
**Effort:** S. **Autonomous:** yes.
**Why:** ChatGPT-User's top three paths are `coreweave-vs-lambda-vs-nebius-gpu-cloud` (216), `gpu-rental-price-map-h100-h200-b200-august-2026` (200), `agent-funding-august-2026` (187) — all dated price/market data. That is a live demand signal from the one bot class that precedes a human click, and the routine currently ignores it in favour of curve-fitting on winners with n=8.
**Ship with it:** gate the "WRITE MORE LIKE THESE" block in `export-analytics.js` behind a support floor (suppress unless a winner clears ~25 engaged reads). Right now it infers a "winning format" from 8 reads.

### A4 · The live data layer — continuously-updated, dated, machine-twinned
**Build:** promote the GPU-price map, model-price index and funding tracker from articles into **continuously-updated canonical datasets**: `/data/gpu-prices`, `/data/model-prices`, `/data/agent-funding`, each with (a) a dated HTML page, (b) a `.json` twin, (c) a visible changelog of what changed and when, (d) `posts.updated` bumped on every refresh, (e) `dateModified` in schema. Wire the refresh into `scripts/server-pull-deploy.sh` next to `crawler-stats.js`.
**Moves:** D3 **+2**, D9 **+1**, D11 **+1**.
**Effort:** M. **Autonomous:** yes.
**Why:** this is the highest-confidence content bet in the entire evidence set, because it is *revealed preference from the only bot that converts*. A price that changes is a page an assistant must re-fetch; an opinion piece is one it caches once. 169 posts already carry `updated` timestamps, so the mechanism exists.

### A5 · Citable answer units
**Build:** in the article template (`app/lib/render.js` ~`:2689`), give every atomic claim a stable anchor id and a machine-extractable wrapper (`<span data-claim="gpu-h100-hourly-2026-08" data-asof="2026-08-16">`). Expand `/api/facts.json` to serve those claims as addressable records with source + date. Add a compact "cite this" block carrying canonical URL, publication date, and last-verified date. Keep the takeaway block where it is.
**Moves:** D3 **+2**.
**Effort:** M. **Autonomous:** yes.
**Why:** 96% of crawler article fetches are `.html`, not `.md` (1,495 vs 56 in sampled top paths) — GPTBot, PerplexityBot, ClaudeBot and ChatGPT-User show **zero** `.md` paths in their top-5. Citation-friendliness has to live in the HTML. The corpus already has FAQ + compare structured data on 1,838/1,838 posts, so the cheap half is done; what is missing is per-claim addressability and freshness dating.

### A6 · Server-side narration
**Build:** move the Kokoro TTS run from the owner's laptop onto gil-vm and hook it into the publish path (`scripts/newsroom-cron.sh` → `scripts/narrate-cycle.sh`), so every piece is narrated before the edition goes live. Backfill the ~40% of recent posts currently 404ing on `/audio/<slug>.mp3`.
**Moves:** D10 **2 → 5** (+3).
**Effort:** M. **Autonomous:** yes, assuming gil-vm can run the model (verify CPU/RAM headroom first; if it cannot, this becomes owner-gated for a GPU box).
**Why:** this is the one asset with no competitor equivalent, and it is systematically missing from exactly the newest posts that get the traffic. *Challenge note: this was the one item I judged only partially challenged — it was raised as an aside rather than adversarially tested, and it holds up.*

### A7 · Gated `/build` permutation expansion — 250 first, then measure
**Build:** server-render canonical URLs for curated stack permutations (`/stacks/<orchestration>+<inference>+<memory>`) with data-derived titles, distinct pricing/MCP/star content, and `.json` + `.md` twins. **Ship 250, not 5,000.** Then read per-URL crawl rate and referral yield after 30 days (possible only because A1 landed) and expand only if yield holds.
**Moves:** D9 **3 → 5** (+2).
**Effort:** M. **Autonomous:** yes.
**Why:** `/build` is one nav-linked URL and it out-pulls 1,838 articles for 11 of 22 bots. Article demand is spread across 1,838 leaves; interactive demand is concentrated on one. **The gate is not optional** — unbounded permutation URLs are exactly the scaled-content pattern that would tank D11, and the rubric scores 0 for expansion that isn't yield-verified.

### A8 · Session-depth work, measured
**Build:** after A1, add data-driven related-reading (same series / same tool / same comparison cluster), a persistent "next in this decision path" rail, and hub cross-links from articles into `/build` and `/compare`. Fix `app/lib/db.js:298` to apply an n≥20 floor on dwell averages and suppress "avg M:SS" below it.
**Moves:** D5 **1 → 3** (+2), D6 +1.
**Effort:** M. **Autonomous:** yes.
**Why:** 1.003 pages/session means every visit is bought once and never compounds. And the home page currently prints "avg 0:06" beside items computed on n=4 — on a masthead that reads "every number public."

### A9 · Machine-surface hygiene bundle (one commit)
**Build, all small:**
- `rss.xml` `<pubDate>` → RFC-822 via the existing `rfc822()` helper (`app/lib/pages.js:426`, helper at `:442`). Currently `<pubDate>2026-08-16</pubDate>` — every RSS reader fails to parse it.
- Replace 4 hard-coded `T08:00` stamps with `EDITION_UTC_HOUR` (`app/lib/newsroom.js:18`, already imported at `pages.js:8`): `pages.js:412`, `server.js:421`, `newsroom.js:49`, `:94`. Real cron is 11:00 UTC.
- Default `/feed.json` `limit` to 100 — it currently returns **1,838 items / 1.46 MB** uncapped.
- Add explicit `section: p.section` to feed items.
- `Access-Control-Allow-Origin: *` on **read-only GET** agent routes only — never on `POST /api/agents/subscribe` or `POST /api/events`.
- `GET /mcp` with `Accept: text/event-stream` currently returns 200 `application/json`; spec requires `text/event-stream` or 405. Branch on Accept at `app/server.js:462`.

**Moves:** D4 +1, D6 +1.
**Effort:** S total. **Autonomous:** yes.
**Honest billing:** none of this creates demand. It is 90 minutes of correctness on a publication whose brand is correctness. Ship it inside another commit.

### A10 · Ingest atomicity + deploy hazard
**Build:** in `app/scripts/ingest.js`, build into `app/data/dreaming.db.new` and `fs.renameSync()` into place — better than the proposed transaction wrap, because `clearPosts` (`app/lib/db.js:565`) committing standalone means a mid-transaction throw leaves the DB **permanently empty on disk**. Add `--exclude 'app/data/*.db'` to the rsync in `scripts/deploy-app.sh:16-21` (WAL/SHM are already excluded — a tell) so the running server and the re-ingest stop operating on two inodes sharing one WAL. Add one shared middleware: `allPosts().length === 0` → 503 + `Retry-After: 120`.
**Moves:** reliability; D6 +0 but protects everything.
**Effort:** S. **Autonomous:** yes.
**Honest billing:** the measured empty-corpus window is ~6.5s, once or twice a day, ≈0.02% of wall-clock, and `/build` — the most-crawled path — reads from `tools` and is immune. This is a **total-outage landmine**, not a citation story. Fix it as hygiene; do not credit it against the gap.

### A11 · Research-signal correctness
**Build:** `scripts/server-pull-deploy.sh:99` gates the search-demand refresh on **file mtime** of a git-tracked file — `git reset --hard` and `git pull --rebase` rewrite mtimes independent of data age, so the gate reads "fresh" on days-old data. Gate on the `fetched_at` field inside the JSON. Add an `else` branch to the `ageH < 96` / `ageH < 72` gates in `export-analytics.js:184` / `:157` printing "STALE (Nh old)" instead of silently omitting the section, and replace the bare `catch {}` at `:199` with a "signal file missing" note.
**Moves:** D7 +1, D11 +0.5.
**Effort:** S. **Autonomous:** yes.
**Note:** the proposed `feeds.json` + FEEDS table + per-feed systemd timers are **not** needed — `dreaming-deploy.timer` already fires every 10 minutes and three of four feeds are sub-10-minutes fresh at edition time.

### A12 · Self-listing where no account is required
**Build:** submit/register on every agent-discovery surface that accepts an unauthenticated URL: `llms.txt` aggregators, `.well-known` crawlers, open MCP discovery indexes, JSON Feed directories. Emit `/.well-known/ai-plugin`-class descriptors where a spec exists.
**Moves:** D4 **1 → 2** (+1).
**Effort:** S. **Autonomous:** yes — but only the account-free subset; the rest is O8.

### A13 · Article-hero typography and block order
**Build:** move only `aside.compare` (1,260px) and `aside.key-figures` (518px) below `.article-body`; **keep `aside.takeaway` above the fold** (it is the `speakable` schema target and the first-screen extraction unit for the 96% of crawler article fetches that are HTML). Measured: first sentence moves 3,978px → 2,129px. Fix the dead `.article h1` selector (`style.css:568` — `render.js:2668` emits `.article-hero`, not `.article`) with a **corrected** clamp:
```css
.article-hero h1 { font-family: var(--display); font-weight: 600;
  font-size: clamp(2rem, 3.4vw, 2.75rem); line-height: 1.08; letter-spacing: -.02em; }
.article-hero .dek { font-size: 1.22rem; line-height: 1.45; color: var(--ink-soft); }
```
Do **not** ship the originally-proposed `clamp(2.1rem,5.2vw,3.3rem)` — measured, it makes the desktop hero **101px taller**. Drop `.article-byline` from the patch entirely (it already works). Screenshot `/subscribe` and `/calculators/llm-cost` before deploying — `.article-hero` has 14 call sites.
**Moves:** D5 +0.5.
**Effort:** S. **Autonomous:** yes.

### A14 · Single pre-brief news harvest — lowest priority
**Build:** `app/scripts/newswire.js` modelled on `x-trends.js`: HN Algolia `search_by_date` (verified reachable, keyless) + a hand-listed set of vendor RSS/atom URLs **each curl-tested from gil-vm first**. Run **once immediately before the brief**, not every 15 minutes. Drop Reddit (403/429 from this machine under four UAs; worse from a Hetzner IP). Reuse `sync-tools.js`'s existing GitHub path.
**Moves:** D11 +0.5.
**Effort:** S. **Autonomous:** yes.
**Honest billing:** citation hygiene, not speed. The site's two fastest-ever posts (1-day lag) have its two **worst** read rates (1.3%, 4.8%); its best read rates (16%, 40%) are 3-and-5-day-lag pieces. A 96×/day poller feeding a brief read once/day buys zero minutes.

---

## OWNER-GATED — needs an account, a key, money, or brand posting

Ranked by traffic unlocked per minute of owner time. **These, not the code, are what gate D1, D2, D7 and D8.**

| # | Action | Exactly what is needed | Moves | Effort |
|---|---|---|---|---|
| **O1** | **Post one HN or subreddit item per week** | Owner's HN + Reddit accounts, posting under the brand. Drafts already written in `DISTRIBUTION.md` (HN Tue–Thu 8–10am ET + second-chance pool; five named subreddits). `EXECUTION.md:19` has flagged this 🔵 for weeks. | D1 +2, D8 +2 | 20 min/week |
| **O2** | **Bing Webmaster API key → `.secrets/bing.env`** | Site is **already verified** (`BingSiteAuth.xml` → 200). Just needs an API key so query-level data can be exported into `analytics/`. Bing + DuckDuckGo (which uses Bing's index) are the site's #1 and #2 human referrers. | D7 +2, D6 +1 | 15 min |
| **O3** | **`DP_GOOGLE_VERIFY` token** | Copy the verification string from Google Search Console into `/etc/dreaming-press.env`. `render.js:1068` already gates the meta tag; the live homepage has **no** verification tag today. | D6 +1, D7 cap 4→8 | 10 min |
| **O4** | **`DEVTO_API_KEY` + Medium integration token** | `app/scripts/syndicate.js` is fully built with canonical-URL handling and a 7–21 day origin-first window. It currently exits: *"eligible, but DEVTO_API_KEY unset — nothing posted."* `.secrets/` holds only `bing.env` and `x.env`. | D8 +1, D1 +1 | 15 min, then autonomous forever |
| **O5** | **Baidu Ziyuan account + push token** | Kimi (12 views), Tencent Yuanbao (4), Doubao (4) are the site's **top assistant referrers** — Chinese assistants already send more humans than Perplexity does. This is the most under-exploited real signal in the dataset. `baidu-push.js` already runs in `scripts/server-pull-deploy.sh:70`. | D1 +1, D8 +1 | 30 min |
| **O6** | **X + LinkedIn daily loop under the brand** | `x.env` exists but posting needs an access token + secret (v2 search works, posting does not). Loop already specified in `DISTRIBUTION.md`. | D1 +1, D8 +1 | 10 min/day |
| **O7** | **Podcast directory submissions** | Apple Podcasts Connect + Spotify for Podcasters accounts. `podcast.xml` exists and `podcastXml` already emits valid RFC-822 dates (only `rss.xml` is broken — fixed in A9). | D10 cap 7→10 | 45 min once |
| **O8** | **MCP registry + agent-directory listings** | Accounts on the registries that require email-verified submission. The MCP endpoint is spec-correct and installable **today** (verified: initialize → protocolVersion 2025-06-18, tools/list → 4 tools, tools/call → real content). It is simply unlisted. | D4 cap 6→9 | 1–2 hrs once |
| **O9** | **Google Publisher Center / Apple News / Flipboard** | Publisher accounts. Lower priority than O1–O5 — Google sends 5 referral hits per fortnight. | D8 +1 | 2 hrs |
| **O10** | **Show HN / Product Hunt launch of `/build`** | Brand accounts + a launch day. `/build` is the one asset with proven independent machine demand and a genuinely good human UI (252 tools, live stack panel). | D8 +1, D9 +1 | half a day |

**If the owner does exactly three things, do O1, O2, O4.** Those unlock the D7 and D8 caps and turn `syndicate.js` from dead code into a permanent autonomous channel.

---

## DO NOT BOTHER

| Move | Why not |
|---|---|
| **Consolidate 1,838 posts into ~200 canonical pages** | The experiment already ran in-house. Bingbot fetches these same 2,476 URLs **21× more often** than Googlebot (11,434 vs 536 verified) — one fetch per URL every 3 days, precisely the frequency consolidation promises to buy. Result: **42 Bing referrals per fortnight.** Crawl frequency is not the binding constraint. Also: 640 canonical hubs already exist (the ask was 200), and the end state would be 840 URLs, not 200. Irreversible destruction of 1,638 live URLs plus their narration assets, executed by an unattended cron, to chase a channel delivering 5 visits/fortnight. |
| **Cross-site crawler-log ingest network** | Cloudflare Radar (≈20% of the web) and Known Agents already ship this with funded distribution and a WordPress plugin. Cold start is unsolvable at 5,170 sessions/month among readers who mostly don't have root on an nginx box. An unauthenticated POST ingest destroys the one property (authority) the idea is built on. |
| **A weekly "AI Crawler Report" franchise** | `/reports/state-of-ai-agents` has been live eight weeks and appears in **zero** bots' top-5 paths and nowhere in human top content. Meanwhile `/build` is top-5 for 11 of 22 bots. This site has already run the reports-vs-tools experiment and tools won. Also: 82% of the headline number is unverifiable UA text, and `crawler-stats.js:197-200` documents a logging-coverage change mid-window, so the 3.5× growth is partly artifact. Publish the crawl→click *join* (A2) instead — that's the number only this site has. |
| **`published_at` column + opaque feed cursor protocol** | The real bug is 4 hard-coded `T08:00` strings and the fix constant is already imported into the file containing the bug (A9). Addressable audience is a verified **zero**: `agent_subscribers: 0`, `agent_subs` 0 rows, and **not one** `/feed.json?since=` request in 109,418 hits across 14 days. Conditional GET already returns 304 today. |
| **15-minute news watcher** | Fastest posts have the worst read rates; the brief that consumes it is read once per day, so 95 of 96 polls are wasted. And the motivating anecdote is backwards: 447 posts cite a primary vendor source, exactly 6 cite Engadget, and today's lede is pegged same-day. Keep only the once-daily version (A14). |
| **Reset the goal to 100–200k/month** | Changes zero behavior — the routine's prompt contains no traffic target at all ("optimize for exactly two things: visitors and time-on-site"). And on machine traffic (~235k requests/month) the proposed target is already met. Keep 1M as direction, grade the routine on AUTO items closed and assistant-referred sessions. |
| **A fourth channel-strategy document** | `TRAFFIC-PLAN.md` (21 ranked moves with AUTO/OWNER columns), `GEO-PLAN.md` (25 moves) and `DISTRIBUTION.md` (full playbook with drafts) already exist. The gap is that the routine's ORIENT list doesn't include them. One-line fix inside A3's commit: point PART B at "the highest-ranked AUTO item not yet ✅ in `EXECUTION.md`." |
| **Chasing Google** | 536 verified Googlebot fetches → **5 referral hits** per fortnight. Verify the property (O3) so you can measure, then spend the effort on Bing, DuckDuckGo, Brave and the Chinese assistants that are actually sending humans. |
| **Blanket CORS, including write endpoints** | The MCP endpoint is installable today — Anthropic connects server-side from its own infrastructure, and I verified the full lifecycle succeeds with no `Origin` header. CORS was never the blocker. Wildcard CORS on `POST /api/events` or `/api/agents/subscribe` invites analytics pollution and webhook spam. Read-only GETs only (A9). |
| **Moving the takeaway block below the body** | Measured, the full move lands the first sentence at 1,544px, not the claimed ~900px, and it buries the `speakable` schema target and the first-screen citation unit for the 96% of crawler article fetches that are HTML. Ship the compare + key-figures half (A13) and keep the takeaway. |

---

## The honest forecast

Every autonomous item above, shipped and working, plausibly moves the weighted score **1.3 → ~4.0** and attributable traffic from ~200/month into the **2,000–8,000/month** range over two quarters — driven mostly by D3 (turning 16,207 fortnightly verified fetches into more than 23 sessions) and D9 (more of the surface machines already prefer).

**That is not 1M, and no combination of code in this repo is.** 1,000,000 visits/month requires one of exactly two things:

1. **Owner-gated distribution at scale** — a real newsletter, real syndication, real social presence, real backlinks. Every one of O1–O10 is a prerequisite, and even fully executed they are a path to low-six-figures, not seven.
2. **Becoming the default retrieval source for a query class large enough that assistant citations alone deliver six-figure clicks.** This is the only version of the goal that fits what the site actually is, and it is what D3 + D4 + D9 are collectively measuring. The best evidence it is reachable: verified AI fetches grew **+254% in five weeks** while human views stayed flat. The demand is arriving. Nothing currently converts it.

Fix the conversion, not the corpus size. And fix the instruments first, because right now the site genuinely cannot tell whether its gap is 156× or 5,000×.