# dreaming.press → 1M/month — Execution Tracker

Executing the 30 council moves (see `../dreaming-press-council-report.md`).
Status: ✅ shipped · 🟡 in progress / scaffolded · 🔵 needs owner action (account/social/decision)

| # | Move | Status | Notes |
|---|------|--------|-------|
| 1 | Register GSC + Bing, submit sitemap | 🔵 | Needs Gil's Google/Bing login. I add the verification `<meta>` support + submit sitemap once token provided. |
| 2 | Fix double-encoded apostrophes in titles/og/dek | ✅ | `ingest.js` now `decodeEntities()` on title/dek (loops to undo double-encoding). |
| 3 | Date integrity: datePublished + dateModified from frontmatter | 🟡 | Emit dateModified in Article JSON-LD; stop deploy-date stamping in newsroom. |
| 4 | Newsletter 404 link bug + weekly digest send | 🟡 | ✅ link path fixed (`/posts/<slug>.html`); weekly send cron pending. |
| 5 | Stop counting bot views; engaged-reads KPI | 🟡 | Bot filter already live; add engaged-reads headline to /newsroom + commissioning gate. |
| 6 | Make GitHub repo public + README | 🔵 | I can flip via `gh` + write README — confirm you want the source public. |
| 7 | Freeze Dispatch firehose; reweight to Wire/Stack | 🟡 | Update cloud-routine prompt + autopublish section weighting. |
| 8 | Cold-start wedge: HN + subreddit submissions | 🔵 | I draft value-first posts; you submit (can't post as you). |
| 9 | AVIF/WebP covers + srcset + preload LCP | 🟡 | Add sharp-based cover transcode + `<picture>` in render. |
| 10 | Data-backed Stack: live page per repo | 🟡 | Build `tools` table + `/stack/:repo` route + nightly GitHub sync. |
| 11 | Named human on masthead (Editor & Publisher) | 🟡 | Add Gil Allouche to about.html + article footer + Person sameAs. |
| 12 | Programmatic "X vs Y" comparison pages | 🟡 | `/compare/:a-vs-:b` from the tools table. |
| 13 | Recurring original-data study (citation magnet) | 🟡 | Scaffold the dataset pipeline + first "State of AI Agents" page. |
| 14 | Stop foregrounding "written by AI" on distribution | 🟡 | Distribution playbook doc; keep on-site transparency. |
| 15 | Topic clusters + pillar pages; topic tags | 🟡 | Define clusters, add pillar route, topic-tag taxonomy. |
| 16 | Re-platform: SQLite entities table feeding templates | 🟡 | `tools` table is the shared prerequisite for #10/#12/#22. |
| 17 | Lock unbroken daily cadence | 🟡 | Verify/repair the hourly cloud cron + autopublish reliability. |
| 18 | Referrer + channel + session instrumentation | 🟡 | Extend `/api/events` + beacon with referrer/UTM/session. |
| 19 | X + LinkedIn build-in-public | 🔵 | I draft the content system; you create accounts/post. |
| 20 | CDN in front of origin; fix caching | 🟡 | Fix cache-control headers now; Cloudflare proxy needs your DNS toggle. |
| 21 | fetchpriority=high + width/height on hero cover | 🟡 | Template fix in render.js. |
| 22 | "Best X for Y" roundup pages | 🟡 | `/best/:query` from the tools table. |
| 23 | Maintainer-outreach link loop on Stack features | 🔵 | I write the outreach template + per-repo list; you send. |
| 24 | Syndicate Wire/Stack to dev.to + Medium (canonical) | 🟡 | Build syndication script; needs your dev.to/Medium API keys. |
| 25 | ItemList/Breadcrumb/FAQ JSON-LD on rankable pages | 🟡 | Add to section/stack/article templates. |
| 26 | Per-article provenance block | 🟡 | Render model + reviewer + sources + satire label. |
| 27 | CWV budget in CI + .md-twin canonical/noindex | 🟡 | Add `X-Robots-Tag`/canonical to .md twins; CWV check in e2e. |
| 28 | AI Regulation Tracker + live calculators | 🟡 | Scaffold tracker data + page; calculators as follow-on. |
| 29 | Topic-relevant "Continue reading"; route to section | 🟡 | relatedTo already tag-aware; add "more from author" + section link. |
| 30 | Cut over-length titles; fix missing meta descriptions | 🟡 | Title-length + description fallback in render head. |

**Approach:** ship safe code items in tested, committed batches (the live site + hourly routine keep running); scaffold the large builds; hand off account/social items with ready-made assets.
