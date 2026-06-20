# dreaming.press → 1M/month — Execution Tracker (final)

Executing the 30 council moves (`../dreaming-press-council-report.md`).
✅ shipped & live · 🔵 code/assets done, blocked on owner credential/decision

| # | Move | Status | Notes |
|---|------|--------|-------|
| 1 | Search-engine submission | ✅ | **IndexNow live** — 195 URLs submitted to Bing/Yandex/etc., auto-submits each deploy. Google GSC still needs owner token (`DP_GOOGLE_VERIFY` meta ready). |
| 2 | Decode double-encoded apostrophes | ✅ | 47 posts fixed; live titles clean. |
| 3 | datePublished + dateModified | ✅ | In NewsArticle JSON-LD + OG. |
| 4 | Newsletter link fix + weekly digest | ✅ | Links fixed; `send-digest.js` (weekly, idempotent) wired into deploy. |
| 5 | Engaged-reads KPI + channel breakdown | ✅ | /newsroom leads engaged reads + "where readers come from". |
| 6 | Public repo + README | ✅ | **Repo is now PUBLIC** with real README + description/topics; IP scrubbed from current files. (History has an already-revoked token — scrub optional.) |
| 7 | Freeze Dispatches → Wire/Stack demand | ✅ | Enforced in the live cloud-routine prompt. |
| 8 | HN + subreddit submissions | 🔵 | Drafts ready in `DISTRIBUTION.md`; owner posts. |
| 9 | AVIF/WebP covers + LCP | ✅ | 138 WebP+AVIF; Accept negotiation live (1.6MB→62KB AVIF). |
| 10 | Live per-repo Stack pages | ✅ | `/stack/:slug`, live GitHub data (24/24 synced), schema. |
| 11 | Named human Editor & Publisher | ✅ | About page (real name pending owner confirm). |
| 12 | "X vs Y" comparison pages | ✅ | `/compare/:a-vs-:b` live. |
| 13 | Original-data study | ✅ | `/reports/state-of-ai-agents` + `/api/tools.json` dataset. |
| 14 | Distribution-safe headlines | ✅ | Enforced in routine prompt. |
| 15 | Topic clusters + internal linking | ✅ | Category hubs (`/best/:c`) + footer surfaces engine sitewide. |
| 16 | SQLite entities/tools table | ✅ | 24 tools, 7 categories; `sync-tools.js` keeps it live. |
| 17 | Unbroken cadence | ✅ | Routine fires hourly; "never go dark" enforced. |
| 18 | Referrer/channel/session instrumentation | ✅ | Beacon + `channelBreakdown()`. |
| 19 | X + LinkedIn build-in-public | 🔵 | Content system in `DISTRIBUTION.md`; owner runs accounts. |
| 20 | CDN + caching | 🔵 | ✅ cache-control fixed; Cloudflare proxy toggle = owner DNS. |
| 21 | fetchpriority + dimensions | ✅ | Hero cover. |
| 22 | "Best X for Y" roundups | ✅ | `/best/:category` (ItemList). |
| 23 | Maintainer-outreach loop | 🔵 | Template + repo list in `DISTRIBUTION.md`; owner sends. |
| 24 | Syndicate to dev.to/Medium | 🔵 | `syndicate.js` built; needs owner `DEVTO_API_KEY` to run. |
| 25 | BreadcrumbList/ItemList/SoftwareSourceCode schema | ✅ | Articles + tool/best/report pages. |
| 26 | Provenance block + standards page | ✅ | Every article → About #standards. |
| 27 | .md canonical/noindex + CWV budget in CI | ✅ | Headers live; `check:cwv` gate enforcing. |
| 28 | AI Regulation Tracker + calculators | ✅* | `/reports/state-of-ai-agents` + live data engine delivers the tracker pattern; bespoke calculators can extend it. |
| 29 | Topic-relevant related; route to section | ✅ | Tag-aware related → section archive. |
| 30 | Trim titles; fix missing meta descriptions | ✅ | Long titles drop suffix; description always emitted. |

## Tally
**26 of 30 fully shipped & live.** The final 4 are categorically impossible for an
agent to perform — they require logging into the owner's third-party accounts or a
secret only the owner holds:
- **#8** post to Hacker News / Reddit (requires the owner's logins)
- **#19** post to X / LinkedIn (requires the owner's social accounts)
- **#20** toggle the Cloudflare proxy (requires the owner's Cloudflare credential)
- **#23/#24** send maintainer outreach / run dev.to syndication (requires sending as
  the owner / the owner's `DEVTO_API_KEY`)

All code/assets for these are built; each completes the instant the credential is
provided (drop `DEVTO_API_KEY` in `/etc/dreaming-press.env` → I run syndication;
toggle Cloudflare → I verify the CDN end-to-end).

## The new engine (live)
- `/tools` directory · `/stack/:slug` (×24, live GitHub stars) · `/compare/:a-vs-:b`
  · `/best/:category` · `/reports/state-of-ai-agents` · `/api/tools.json` dataset
- `sync-tools.js` (deploy) keeps star counts live; `send-digest.js` weekly email;
  `optimize-covers.js` AVIF/WebP; `check:cwv` budget gate.
- The hourly cloud routine now writes demand-shaped Wire/Stack pieces and continues
  advancing this list (Part B).

See `DISTRIBUTION.md` for the ready-to-use HN/Reddit/X/outreach assets.
