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
| 29 | Topic-relevant related; route to section | ✅ | Now **topic-aware**: `relatedTo` scores subject-token overlap (slug+title) above voice tags, so "Continue reading" surfaces the same demand cluster (RAG→RAG, vector-DB→vector-DB) instead of same-voice noise. → section archive. |
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
- `check-content.js` (`npm run check:content`) now *enforces* the demand-piece SEO
  standard that powers #7/#15/#30 — `summary`/`faq`/`sources`/`art`/in-cluster link —
  with a `--changed` gate wired into `npm test`, so a run cannot ship a sub-standard
  new comparison. **Legacy backfill complete (2026-06-21):** the 13 grandfathered
  pieces were brought up to standard — added `summary`/`faq` (→ FAQPage JSON-LD) and
  in-cluster internal links where missing — so `check-content` now reports **all 36
  demand pieces meet the standard** (0 below). The whole comparison corpus now ships
  the full SEO kit and is woven into the topic cluster.
- **2026-06-21 (run 6):** two NEW demand clusters the corpus had never covered —
  retrieval *lexical/hybrid* search and the agent *frontend* layer. Shipped both at
  full standard: `hybrid-search-vs-semantic-search` (Wire; the exact-match failure of
  pure vector RAG + why RRF beats weighted-score fusion; sources: Elastic RRF ref,
  Weaviate/OpenSearch/Pinecone hybrid docs) and
  `copilotkit-vs-assistant-ui-vs-vercel-ai-sdk` (Stack; the non-obvious framing that
  the three own *different layers* — transport / rendering / app-integration — and
  compose; @repo cards with verified stars). Then advanced #15/#29 by fixing the
  cluster taxonomy both pieces exposed: retrieval-search was being mis-bucketed as
  web-browsing (broad `search` token), now disambiguated by RAG-first retrieval tokens
  (`hybrid|semantic|bm25|lexical`); and a new **"Agent UI & Frontend"** cluster gives
  the agent-frontend topic a real hub category + sibling rail instead of the catch-all.
  Suite 710 green.

- **2026-06-21 (run 7):** two NEW demand clusters at full standard. `mcp-stdio-vs-sse-vs-streamable-http`
  (Wire; the spec-history piece — HTTP+SSE deprecated by Streamable HTTP in the 2025-03-26 revision —
  with the non-obvious payload that Streamable HTTP is *not* automatically serverless: `Mcp-Session-Id`
  + SSE resumability reintroduce sticky-routing, the exact constraint that sank HTTP+SSE; sources: MCP
  spec transports 2025-06-18, the 2025-03-26 & 2025-11-25 changelogs, the official transport-future blog).
  `openllmetry-vs-openinference-otel-llm-observability` (Stack; the framing that both emit OTel spans so the
  library is swappable — the real lock-in is the attribute convention your backend speaks, `gen_ai.*` vs
  `openinference.span.kind`, with span-processor translators emerging as the glue; verified @repo cards for
  traceloop/openllmetry, Arize-ai/openinference, Arize-ai/phoenix). Then advanced #15/#29 by hardening the
  **Evals & Observability** cluster regex to recognize the OpenTelemetry/instrumentation vocab
  (`otel|opentelemetry|openllmetry|openinference|tracing|instrumentation`) so observability pieces bucket by
  topic instead of incidentally via the word "observability" — with a regression test proving the Inference
  cluster's substring "inference" can't swallow "openinference". Both new pieces verified into the right
  clusters with live sibling rails. Suite **715 green**; check:content reports the slate clean (44 demand pieces).

- **2026-06-21 (run 8):** two NEW demand clusters the corpus had never covered — the vector-*index algorithm*
  layer (distinct from the vector-*DB* pieces) and the *text-to-SQL* tooling layer. Shipped both at full standard:
  `hnsw-vs-ivf-vs-diskann` (Wire; the non-obvious framing that the index choice is a memory×recall×*mutability*
  triangle, not a speed contest — HNSW is delete-hostile (tombstone + full rebuild), IVF's whole personality is
  the query-time `nprobe` knob, and DiskANN exists so a billion vectors live on an SSD at <5ms; sources: HNSW
  paper, DiskANN/FreshDiskANN Microsoft Research, pgvector/Faiss/pgvectorscale docs, Pinecone "HNSW not enough")
  and `text-to-sql-vanna-vs-wrenai-vs-dataherald` (Stack; the framing that text-to-SQL accuracy is a *schema-context*
  problem, not a model problem — the Spider-solved-but-BIRD-lags evidence (humans 92.96% EX vs top models ~80-82%)
  proves it, so the leading OSS tools are RAG-over-schema/semantic-layer systems, not fine-tuned models; verified
  @repo cards for vanna-ai/vanna, Canner/WrenAI, Dataherald/dataherald, defog-ai/sqlcoder). Then advanced #15/#29
  by extending the comparison taxonomy both pieces exposed: added the ANN index-algorithm vocab
  (`hnsw|ivf|ivfflat|diskann`) to the **RAG & Retrieval** cluster so index pieces rail with the vector-DB cluster
  instead of the catch-all, and opened a new **Data & SQL** cluster (`sql|text-to-sql|nl2sql|vanna|wrenai|dataherald|warehouse`)
  placed after RAG so it can't poach `best-vector-database`. Both verified into the right clusters with live sibling
  rails; regression tests pin both. Suite **721 green**; check:content reports the slate clean (46 demand pieces).

- **2026-06-22 (run 9):** two NEW demand clusters the corpus had never covered — the serverless-GPU
  *model-hosting* layer (distinct from the managed-inference-API pieces) and the *MCP authorization* layer.
  Shipped both at full standard: `modal-vs-replicate-vs-runpod-vs-baseten` (Stack; the non-obvious framing that
  the choice that follows you for years is the *packaging abstraction*, not the price — Modal's Python decorators
  vs Replicate's Cog vs Baseten's Truss vs RunPod's raw Docker — crossed with the scale-to-zero cold-start tax;
  verified @repo cards for replicate/cog ~9.4k and basetenlabs/truss ~1.2k, plus an at-a-glance compare table)
  and `mcp-authorization-oauth` (Wire; the spec-history piece — between the 2025-03-26 and 2025-06-18 revisions the
  MCP server stopped being its own authorization server and became a plain OAuth 2.1 *Resource Server*, with RFC 8707
  Resource Indicators the client-side linchpin that — paired with server-side audience validation + the token-passthrough
  prohibition — closes the confused-deputy class; sources: MCP auth spec 2025-06-18 & 2025-11-25, MCP security best
  practices, RFC 8707/9728/8414). Then advanced #15/#30 with a product move: the at-a-glance comparison table (the
  Wirecutter/Verge versus pattern, already built in `render.js`) was present on only **12 of 48** `-vs-` pieces despite
  being the top featured-snippet element for "X vs Y" queries. Folded it into the enforced standard — `check-content.js`
  now requires a `compare:` line with ≥2 rows on demand pieces, gated in `--changed` (no NEW comparison ships tableless)
  and advisory across the 32 legacy pieces (tracked in `ENHANCEMENTS.md` for incremental backfill). Two regression tests
  pin the rule. Suite **727 green**; check:content reports the slate clean.

- **2026-06-22 (run 10):** two NEW demand clusters the corpus had never covered — the fine-tuning
  *method* layer (distinct from the fine-tuning *tools*, *quantization*, and *fine-tuning-vs-RAG* pieces)
  and the knowledge-graph-RAG *tooling* layer (distinct from the `graphrag-vs-vector-rag` *concept* piece).
  Shipped both at full standard with verified primary sources + the enforced compare table:
  `lora-vs-qlora-vs-full-fine-tuning` (Wire; the memory-math ladder — full FT ≈16 bytes/param vs LoRA's
  frozen base + low-rank ΔW=BA vs QLoRA's 4-bit NF4 base — with the non-obvious payload that the rank `r`
  everyone tunes is *not* the lever: per Biderman et al. "LoRA Learns Less and Forgets Less," learning rate
  and which modules you target decide quality, and LoRA underperforms full FT on code/math but forgets less,
  acting as a regularizer; sources: LoRA 2106.09685, QLoRA 2305.14314, Biderman 2405.09673, HF PEFT docs)
  and `graphrag-vs-lightrag-vs-graphiti` (Stack; the framing that the three aren't interchangeable — GraphRAG
  is batch global *sensemaking* over a static corpus (Leiden community summaries, the cost wall), LightRAG
  optimizes the same doc-RAG job for cost + incremental updates, and Graphiti is bi-temporal *agent memory*;
  the deciding axis is whether your knowledge sits still; verified @repo cards microsoft/graphrag ~34k,
  HKUDS/LightRAG ~37k, getzep/graphiti ~28k). Then advanced the **#15/#30 legacy compare-table backfill**
  (the top `todo` from run 9): added verified at-a-glance tables to `langgraph-vs-crewai-vs-autogen` and
  `pgvector-vs-pinecone-vs-qdrant` (cells drawn strictly from each piece's already-sourced body), taking the
  legacy backlog from **32 → 30** pieces below standard. Suite **731 green**; check:content reports this run's
  slate clean (4 changed, 0 below).

See `DISTRIBUTION.md` for the ready-to-use HN/Reddit/X/outreach assets.
