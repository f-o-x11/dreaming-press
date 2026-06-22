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

- **2026-06-22 (run 11):** two NEW demand clusters the corpus had never covered — the embedding-*serving*
  infrastructure layer (distinct from the vector-DB and LLM-inference-engine pieces) and the retrieval-*representation*
  layer (dense vs sparse vs late-interaction, distinct from the hybrid-search *fusion* piece). Shipped both at full
  standard with verified primary sources + the enforced compare table: `tei-vs-infinity-vs-vllm-embedding-inference`
  (Stack; the non-obvious framing that serving embeddings is an *architecture* decision — dedicated specialist vs
  consolidating onto the vLLM engine already running generation — not a throughput contest, since embedding traffic is
  bimodal (bulk index builds + a query-time trickle) and batching dwarfs the gap between well-configured servers;
  verified @repo cards TEI ~4.9k, Infinity ~2.8k, vLLM ~83k; sources: TEI/Infinity/vLLM repos, vLLM pooling docs,
  Snowflake + Baseten embedding-serving benchmarks) and `colbert-vs-dense-vs-sparse-retrieval` (Wire; the framing that
  the three aren't a quality ladder but one cost axis — *where the matching cost lives* — with the 2026 payload that
  native multi-vector indexing in Qdrant/LanceDB/Vespa/Weaviate retired the separate PLAID engine, and ColBERTv2
  residual compression cut storage from ~256 to ~20–36 bytes/vector; sources: ColBERTv2 2112.01488, PLAID 2205.09707,
  Weaviate late-interaction overview, Qdrant/LanceDB multivector docs, SPLATE). Then advanced the **#15/#30 legacy
  compare-table backfill** (the top `todo` from run 10): added verified at-a-glance tables to two high-demand
  framework money pages — `llamaindex-vs-langchain` and `mem0-vs-zep-vs-letta-agent-memory` (cells drawn strictly
  from each piece's already-sourced body), taking the legacy backlog from **30 → 28** pieces below standard. Suite
  **735 green**; check:content reports this run's slate clean.

- **2026-06-22 (run 12):** two NEW demand clusters the corpus had never covered — the *AI coding-agent harness*
  layer and the voice-stack's missing *TTS* leg (the corpus already had STT and orchestration). Shipped both at full
  standard with verified sources + the enforced compare table: `aider-vs-cline-vs-openhands` (Stack; the non-obvious
  framing that these aren't a capability ladder but three points on one axis — *where the agent runs and how much it
  does before you look* — so the real choice is blast radius, with the kicker that the SWE-bench score belongs to the
  *model* you plug into the harness, not the harness: OpenHands posts ~70%+ Verified with a frontier model vs ~37% with
  a 32B open one; verified @repo cards Aider ~46k / Cline ~64k / OpenHands ~78k, plus the note that Continue went
  read-only in 2026 after the Cursor acquisition) and `cartesia-vs-elevenlabs-vs-kokoro-tts-voice-agents` (Wire; the
  framing that the metric that matters is production *time-to-first-audio*, not MOS or vendor "model latency" — and the
  gap is 2–4× (Cartesia ~90ms model vs ~188ms P50; ElevenLabs Flash ~75ms vs ~264–288ms P50) because the network round
  trip is the un-optimizable half, which is the actual case for self-hosting Kokoro-82M to delete the hop; Cartesia's SSM
  architecture from the S4/Mamba authors explains its raw-latency lead; sources: Cartesia Sonic blog, Index Ventures,
  TechCrunch, ElevenLabs models docs, Gradium TTS-latency benchmark, Kokoro-82M HF). Then advanced the **#15/#30 legacy
  compare-table backfill** (top `todo` from run 11): added verified tables to the two remaining voice-cluster money pages
  — `deepgram-vs-assemblyai-vs-whisper-voice-agents` and `livekit-vs-pipecat-vs-vapi-voice-agents` (cells drawn strictly
  from each piece's already-sourced body), taking the legacy backlog from **28 → 26** pieces below standard. Suite
  **739 green**; check:content reports this run's slate clean (2 changed, 0 below).

- **2026-06-22 (run 13):** two NEW demand clusters the corpus had never covered — the *embedding-compression*
  layer (vector quantization, distinct from both the LLM-weight quant pieces `gguf-vs-gptq-vs-awq` and the
  ANN-index pieces `hnsw-vs-ivf-vs-diskann`) and the *visual-document-RAG* layer (retrieve over PDF pages as
  images, no OCR). Shipped both at full standard with verified primary sources + the enforced compare table:
  `binary-vs-scalar-vs-product-quantization-embeddings` (Wire; the non-obvious framing that quantization
  compresses the *vectors*, orthogonal to the index, so it composes with HNSW/IVF rather than replacing them —
  and the move that rescues aggressive binary quant is the two-tier *oversample-then-rescore* (search binary in
  RAM, re-rank top-k with full-precision vectors on disk), lifting retention from ~92.5% → ~96% while keeping the
  32x memory cut and 25–45x speedup; int8 scalar is the ~99.3%-retention 4x default; PQ is the tunable
  static-index option; binary needs ≥1024-dim robust embeddings; sources: HF Shakir/Aarsen embedding-quantization
  blog, Sentence Transformers docs, Qdrant, MongoDB Atlas, FAISS) and `colpali-vs-byaldi-vs-colivara-visual-document-rag`
  (Stack; the framing that the three repos aren't competitors but three rungs on one productionization ladder, and
  the real choice is *who owns the multi-vector storage explosion* — ColPali emits ~1030 patch vectors per page,
  so one page = ~1030 vectors: colpali-engine ~2.7k is the model layer, byaldi ~850 punts on scale (in-memory),
  ColiVara ~1.5k owns the Postgres+pgvector serving problem; verified @repo cards + ViDoRe figures; sources:
  ColPali paper 2407.01449, the three repos, Qdrant ColPali multi-vector blog). Both route correctly into the
  **RAG & Retrieval** cluster with no taxonomy change (first-match-wins on `-embeddings$` / `-rag$`), and the two
  pieces cross-link each other (the storage explosion ↔ the compression that survives it). Then advanced the
  **#15/#30 legacy compare-table backfill** (top `todo` from run 12): added verified at-a-glance tables to
  `deepeval-vs-ragas-vs-promptfoo` and `langfuse-vs-langsmith-vs-phoenix-observability` (cells drawn strictly from
  each piece's already-sourced body), taking the legacy backlog from **26 → 24** pieces below standard. Suite
  **743 green**; check:content reports this run's slate clean (4 changed, 0 below).

- **2026-06-22 (run 14):** two NEW demand clusters the corpus had never covered — the *preference/alignment-optimization*
  layer (distinct from the LoRA/QLoRA *parameter-efficiency* layer) and the constrained-*decoding backend* layer
  (distinct from the instructor/outlines/baml structured-*output library* layer). Shipped both at full standard with
  verified primary sources + the enforced compare table: `dpo-vs-ppo-vs-orpo` (Wire; the non-obvious framing that the
  three methods aren't a quality ladder but one RLHF pipeline being deleted component by component — PPO loads 4 models
  (policy/reference/reward/value) + an RL loop, DPO drops the reward model and the loop but keeps the frozen reference
  (2 models), ORPO drops the reference model AND merges SFT+alignment into one stage (1 model) — with the payload that the
  deletion isn't free: "Is DPO Superior to PPO?" (Xu et al. 2024) shows well-tuned online PPO still beats offline DPO on
  hard domains like code because DPO can exploit out-of-distribution responses the offline set never generated; sources:
  InstructGPT 2203.02155, DPO 2305.18290, ORPO 2403.07691, KTO 2402.01306, Xu 2404.10719, HF TRL) and
  `outlines-vs-xgrammar-vs-llguidance` (Stack; the framing that structured output split into two layers and the problem
  moved from "CAN we constrain output" (solved by Outlines' FSM logit-masking, Willard & Louf 2307.09702) to "can we
  constrain WITHOUT killing throughput" — which is why XGrammar (context-independent token cache + persistent stack +
  GPU-overlap, up to 100x faster per-token grammar processing, near-zero end-to-end overhead) and llguidance (~50µs Rust
  mask for a 128k vocab) exist, and why vLLM (`auto`, prefers xgrammar) and SGLang (xgrammar default) adopted them as
  pluggable backends — so the backend is increasingly chosen by your serving stack, not you; verified @repo cards
  dottxt-ai/outlines ~14k, mlc-ai/xgrammar ~1.8k, guidance-ai/llguidance ~800). Then advanced **#15/#29** with the
  taxonomy gap this run's Wire piece exposed: there was no **Fine-Tuning & Training** cluster, so `lora-vs-qlora`,
  `unsloth-vs-axolotl`, `gguf-vs-gptq-vs-awq` (and now `dpo-vs-ppo-vs-orpo`) were all falling to the "More comparisons"
  catch-all. Added the cluster (`lora|qlora|dpo|ppo|orpo|kto|simpo|rlhf|peft|unsloth|axolotl|torchtune|gguf|gptq|awq|fine-tuning|quantization`)
  placed AFTER RAG & Retrieval so first-match-wins keeps `fine-tuning-vs-rag` and `…-quantization-embeddings` in retrieval
  while the training-method money pages get a real hub + sibling rail. A regression test pins both behaviors (alignment
  pieces rail together; fine-tuning-vs-rag stays in RAG). The Stack piece routes correctly into the existing **Structured
  Outputs** cluster with no change (matches `outlines`). Suite **748 green**; check:content reports this run's slate clean
  (2 changed, 0 below).

- **2026-06-22 (run 15):** two NEW demand clusters the corpus had never covered — the RL *post-training-framework*
  layer (distinct from the alignment-*method* layer `dpo-vs-ppo-vs-orpo` and the SFT-*tools* layer `unsloth-vs-axolotl`)
  and the *agent-benchmark* layer (distinct from the eval-*library* layer `deepeval-vs-ragas-vs-promptfoo`). Shipped both
  at full standard with verified primary sources + the enforced compare table: `verl-vs-openrlhf-vs-trl` (Stack; the
  non-obvious framing that GRPO is now commodity — all three ship it — so the differentiator is *who owns the distributed
  orchestration and at what scale*: TRL hands the cluster to HF Accelerate (accessible, PEFT-friendly), while OpenRLHF and
  verl own a Ray-based generation/training split for 70B+, where the real split is the training-parallelism backend —
  DeepSpeed-ZeRO (OpenRLHF) vs Megatron-LM (verl); plus the kicker that rollout generation is &gt;80–90% of RL runtime so
  RL training has become an inference-infra problem, everyone bolting on vLLM/SGLang; verified @repo cards verl-project/verl
  ~22.1k, OpenRLHF ~9.7k, huggingface/trl ~18.7k; sources: HybridFlow 2409.19256, OpenRLHF 2405.11143, DeepSeekMath/GRPO
  2402.03300, DeepSeek-R1 2501.12948, HF "16 RL libraries" shared-bottleneck blog) and `swe-bench-vs-tau-bench-vs-gaia`
  (Wire; the framing that the three aren't a difficulty ladder but three orthogonal axes — SWE-bench grades a *verifiable
  artifact* (a patch the repo's tests certify), GAIA grades *tool-chaining + browsing* to one exact answer, τ-bench grades
  *policy adherence across a multi-turn conversation* — with the load-bearing payload that τ-bench's **pass^k** (success
  across ALL k trials) measures *reliability*, the production wall most leaderboards hide behind single-run pass@1: SOTA
  function-calling agents fall below 25% at pass^8 in retail; plus the 2026 saturation/contamination context driving
  SWE-bench Pro ~59% vs Verified's 70s–80s; sources: SWE-bench 2310.06770, SWE-bench Verified, τ-bench 2406.12045,
  τ²-bench 2506.07982, GAIA 2311.12983, SWE-bench Pro 2509.16941. Live SOTA numbers deliberately *not* quoted — the
  research surfaced fabricated leaderboard entries, so the piece cites paper-era verified numbers and leans into the
  saturation point instead). Then advanced **#15/#29** with the taxonomy gaps both pieces exposed: extended
  **Fine-Tuning & Training** with the RL-framework vocab (`grpo|verl|openrlhf|trl`) and **Evals & Observability** with the
  benchmark vocab (`benchmark|benchmarks|swe-bench|tau-bench|gaia`), so both money pages bucket into a real hub + sibling
  rail (verified live: verl → Fine-Tuning & Training rails with dpo-vs-ppo-vs-orpo; swe-bench → Evals & Observability rails
  with deepeval-vs-ragas-vs-promptfoo); two regression tests pin both. Also advanced the **#15/#30 legacy compare-table
  backfill** (top `todo` from run 14): added verified at-a-glance tables to two foundational money pages —
  `mcp-vs-function-calling` and `vllm-vs-sglang-vs-ollama-inference-engine` (cells drawn strictly from each piece's
  already-sourced body/figures), taking the legacy backlog from **24 → 22** pieces below standard. Suite **754 green**;
  check:content reports this run's slate clean (4 changed, 0 below).

- **2026-06-22 (run 16):** one NEW demand cluster the corpus had never covered — agent *reasoning/planning
  patterns* (distinct from the Agent Frameworks that implement them and the prompt-*optimization* tools DSPy/TextGrad).
  Shipped at full standard with verified primary sources + the enforced compare table:
  `react-vs-plan-and-execute-vs-reflexion` (Wire; the non-obvious framing that the three aren't interchangeable
  list items but live on *two different axes* — ReAct↔Plan-and-Execute is a single *commitment* dial (how much the
  agent decides before it observes; production plan-and-execute bolts on a re-plan step that drags it back toward
  ReAct, so they're the same dial at different clock rates), while Reflexion is on a separate *across-attempts
  learning* axis (verbal reinforcement into episodic memory) that requires retries + a verifiable success signal,
  else it "reflects into noise"; sources: ReAct 2210.03629, Reflexion 2303.11366, Plan-and-Solve 2305.04091,
  LLMCompiler 2312.04511, ReWOO 2305.18323; the one quoted number — Reflexion 91% vs 80% GPT-4 pass@1 on HumanEval —
  verified against the paper). Then advanced **#15/#29** with the taxonomy gap this exposed: added an **Agent Reasoning
  & Planning** cluster (`react|reflexion|reasoning|planning|plan-and-execute|plan-and-solve|rewoo|llmcompiler|cot|tot|
  chain-of-thought|tree-of-thought`) placed before Prompts & Optimization so the pattern money pages rail together
  instead of falling to the catch-all; a regression test pins it (DSPy stays in Prompts). **Editorial integrity catch:**
  the run's second drafted Stack piece (`nemo-guardrails-vs-guardrails-ai-vs-llm-guard`) was *not shipped* — it
  cannibalized the existing `guardrails-ai-vs-nemo-guardrails-vs-llama-guard` (run-prior, same NeMo+Guardrails-AI core),
  exactly the keyword-duplication the audit warns against. Instead advanced the **#15/#30 legacy compare-table backfill**:
  added the verified at-a-glance table to that existing guardrails money page (cells drawn strictly from its body),
  taking the legacy backlog from **22 → 21** pieces below standard and giving the Guardrails & Safety cluster its
  first table-complete money page. Logged a genuinely non-overlapping future demand piece (a *security-scanner*
  comparison: LLM Guard vs Rebuff vs Lakera) in `ENHANCEMENTS.md` instead of forcing the duplicate. Suite **757 green**;
  check:content reports this run's slate clean (2 changed, 0 below).

- **2026-06-22 (run 17):** two NEW demand clusters the corpus had never covered — the *inference-decoding-acceleration*
  layer (speculative decoding, distinct from the inference-*engine* and *serverless-GPU* pieces) and the *runtime
  prompt-injection-scanner* layer (distinct from the content-moderation/output-validation Guardrails cluster). Shipped
  both at full standard with verified primary sources + the enforced compare table:
  `speculative-decoding-eagle-vs-medusa` (Wire; the non-obvious framing that the speedup is *borrowed idle compute* — at
  batch-size-1 decoding is memory-bandwidth-bound so the GPU's arithmetic units sit ~98% idle, and speculative decoding
  spends them to verify several drafted tokens in one weight-load; it is *lossless* via rejection sampling, not approximate;
  the lever is acceptance-rate × draft-cost, which drove the arc separate-draft-model → Medusa's self-speculation heads →
  EAGLE's *feature-level* autoregression (highest acceptance, EAGLE-3 ~3–6.5x); and the payload nobody benchmarks: it's a
  batch-1 *latency* win that can *slow* a saturated, compute-bound serving fleet — so vLLM/SGLang make it a per-deployment
  switch; sources: Leviathan 2211.17192, Chen 2302.01318, Medusa 2401.10774, EAGLE 2401.15077, EAGLE-3 2503.01840, vLLM
  speculators docs) and `rebuff-vs-llm-guard-vs-vigil-prompt-injection` (Stack; the honest, non-obvious finding that the
  category consolidated — the most-starred *dedicated* detector Rebuff (~1.5k) was archived read-only May 2025 and Vigil
  (~482) has been alpha since 2023, while the survivor LLM Guard (~3.1k) is a *broad* input/output suite where injection
  detection is 1 of ~35 scanners — because detection-by-classifier is a losing arms race, which is why the serious 2025
  work moved to *architectural* containment (the six design patterns / dual-LLM / plan-then-execute); verified @repo cards +
  archive/alpha status drawn from each repo's live GitHub state; sources: the three repos, Beurer-Kellner et al. 2506.08837,
  Simon Willison on the design-patterns paper). Both route into existing clusters (Inference; Guardrails & Safety) with no
  taxonomy change. Then advanced the **#15/#30 legacy compare-table backfill** (top `todo` from run 16): added verified
  at-a-glance tables to two high-demand second-wave money pages — `openai-agents-sdk-vs-pydantic-ai-vs-google-adk` and
  `ollama-vs-lm-studio-vs-jan` (cells drawn strictly from each piece's already-sourced body), taking the legacy backlog
  from **21 → 19** pieces below standard. Suite **761 green**; check:content reports this run's slate clean (2 changed,
  0 below). Note: live `/api/analytics` was unreachable this run (host not in the routine's network allowlist), so topic
  selection leaned on the corpus-gap analysis + the standing demand-cluster map rather than fresh engagement numbers.

- **2026-06-22 (run 18):** opened the run by catching a **red build on `main`**: the prior commit
  (`c2a6346`, "slugged heading anchors") bakes `<h2 id>` anchors into `body_html` at ingest time, but
  `test/render.test.js` still reversed those ids as a *render-time* enrichment before the `body html
  embedded` assertion — so once the DB is freshly ingested, **171 of the parameterized `renderArticle`
  assertions failed**. The regression slipped through because the routine's test step runs against a stale
  DB dir and short-circuits on 3 env errors that mask the 771-test suite. Fixed by dropping the stale h2-id
  strip from the test normalization (ids now legitimately live in `body_html`; render's `tocify` no-ops on
  them), restoring a clean **771 green** before shipping anything new — committed atomically. Then shipped
  two NEW demand clusters the corpus had never covered: `agentic-rag-vs-naive-rag` (Wire; the asymmetry
  thesis — agentic RAG's *benefit is concentrated* on multi-hop/ambiguous/high-stakes queries while its
  *cost is uniform* per query, so the right architecture is a cheap query *router*, not a global winner;
  evidence: Self-RAG 55.8% vs 14.7% PopQA, CRAG +19–37pp on adversarial-retrieval QA, the FiQA ~2.7x
  input-token cost; sources: Agentic RAG survey 2501.09136, Self-RAG 2310.11511, CRAG 2401.15884, "Is
  Agentic RAG worth it?" 2601.07711, IBM/NVIDIA/LangGraph docs) and `vllm-vs-tensorrt-llm-vs-tgi` (Stack;
  the non-obvious framing that the feature sets are *converging*, so the durable axis is portability ×
  vendor-lock-in × project momentum, not peak tokens/sec — with the load-bearing, under-reported fact that
  **TGI is officially in maintenance mode** as of 2025, making it the legacy-comfort pick; verified @repo
  cards for vllm-project/vllm, NVIDIA/TensorRT-LLM, huggingface/text-generation-inference; sources:
  PagedAttention 2309.06180, vLLM V1 blog, the TGI HFOIL relicense/revert). Both route into existing
  clusters (RAG & Retrieval; Inference & Gateways). Then advanced **#15/#29** by hardening the **Inference &
  Gateways** cluster regex with the serving-engine vocab (`tensorrt|trt|tgi`) so a future TensorRT/TGI-only
  slug buckets correctly instead of falling to the catch-all (the new piece matched via `vllm`, but the
  tokens were missing); a regression test pins it. Suite **776 green**; check:content reports this run's
  slate clean (2 changed, 0 below). Note: `/api/analytics` was again unreachable (host not in the routine's
  egress allowlist), so topic selection leaned on corpus-gap analysis + the standing demand-cluster map.

- **2026-06-22 (run 19):** opened by clearing the top-priority **build-safety** todo, then shipped two NEW demand
  clusters. **Part B (the High `todo`):** the run-18 red-`main` post-mortem flagged that `npm test` runs the
  render/pages/content suites against the real SQLite DB, so a missing/stale `app/data/` DB makes `new Database()`
  throw at import → the per-post parameterized suite silently skips → a content/render regression ships unseen. Fixed
  by adding `app/scripts/setup-test-db.js` (deletes the DB file + WAL/SHM sidecars so the schema rebuilds from
  scratch, recreates the data dir, runs `ingest.js`, honors `DP_DB`) wired as npm **`pretest`**, so `npm test` now
  ALWAYS executes against a freshly-ingested DB reflecting current `content/posts`. Verified by deleting the DB and
  running `npm test`: pretest re-ingested and all 776 tests ran green — the masking failure mode is closed and the
  routine's manual "ingest first" workaround is now redundant. **Part A:** two NEW demand clusters the corpus had
  never covered — the *synthetic-training-data generation* layer (the dataset layer that feeds fine-tuning, distinct
  from the training-*method* pages) and the *computer-use vs DOM browser-automation* architectural decision (distinct
  from the browser-framework comparison). Shipped both at full standard with verified sources + the enforced compare
  table: `distilabel-vs-curator-vs-synthetic-data-kit` (Stack; the non-obvious thesis that the bottleneck moved from
  *generation* (solved — any frontier model generates) to *verification* — "Beyond Model Collapse" (2406.07515) proves
  synthetic data degrades the model unless an external verifier filters it, which is why all three tools ship a curation
  stage — so the real axis is generality vs scale vs opinionation: distilabel a research-faithful pipeline DSL with
  built-in UltraFeedback/Self-Instruct Tasks, Curator a bulk-inference + observability engine (Curator Viewer, batch
  APIs, Pydantic outputs), synthetic-data-kit a narrow docs→training-set CLI; verified @repo cards argilla-io/distilabel
  ~3.3k, bespokelabsai/curator ~1.7k, meta-llama/synthetic-data-kit ~1.6k; sources: 2406.07515, Self-Instruct 2212.10560,
  UltraFeedback 2310.01377, Constitutional AI 2212.08073, Stanford Alpaca) and `computer-use-vs-browser-automation`
  (Wire; the framing that vision-vs-DOM is not old-vs-new but *generality vs reliability* — pixel/coordinate computer-use
  (Anthropic Oct 2024, OpenAI Operator/CUA Jan 2025, Gemini 2.5 Computer Use Oct 2025) is the universal fallback that
  works on anything with a screen but pays in accuracy (OSWorld: humans ~72% vs agents far lower; Claude's launch
  screenshot-only score 14.9%), while DOM/accessibility-tree agents (browser-use, Stagehand, Playwright MCP, Skyvern)
  are cheaper/faster/more reliable on clean web (~10–100x less input than screenshots) — and the production frontier is
  HYBRID, evidenced by DOM frameworks bolting vision on as a fallback and Gemini's vision model being deliberately
  browser-scoped; sources: Anthropic computer-use launch + docs, OpenAI CUA, Google Gemini 2.5 Computer Use, OSWorld
  2404.07972, WebArena 2307.13854, WebVoyager 2401.13919, Playwright MCP repo. Vendor-reported benchmark numbers
  attributed as such; unverifiable WebArena/Mind2Web scores deliberately omitted). Then advanced **#15/#29** with the
  taxonomy gap the Stack piece exposed: added a **Synthetic Data** cluster (`synthetic|distilabel|curator|sdg`) placed
  after Data & SQL so the generation money page gets its own hub + sibling rail instead of the catch-all, and the
  fine-tuning-method pages keep theirs (first-match-wins; the Wire piece routes correctly into the existing
  **Web, Search & Browsing** cluster via `browser` with no change). A regression test pins both behaviors. Suite **781
  green**; check:content reports this run's slate clean (2 changed, 0 below). Note: `/api/analytics` was again
  unreachable (host not in the routine's egress allowlist), so topic selection leaned on corpus-gap analysis + the
  standing demand-cluster map.

- **2026-06-22 (run 20):** two NEW demand clusters the corpus had never covered, each shipped at full standard
  with a taxonomy fix + regression test (**#15/#29**). (1) `browserbase-vs-steel-vs-browserless` (Stack) — the
  managed/remote-*browser-infrastructure* layer (where an agent's Chromium actually runs: stealth, residential
  proxies, CAPTCHA, session persistence, live-view), distinct from the automation *framework* (browser-use/
  Stagehand/Playwright) and from code *sandboxes* (E2B/Modal/Daytona). Anchor thesis: framework vs infrastructure
  are conflated but separate layers glued by CDP-over-WebSocket, so the infra is framework-agnostic and the real
  decision is self-host vs managed-stealth-at-scale; load-bearing honest fact that **Browserless v2 is SSPL, not
  OSI-open** (Steel is Apache-2.0, Stagehand MIT). Verified @repo cards (browserbase/stagehand, steel-dev/
  steel-browser, browserless/browserless); Browserbase $40M Series B (June 2025) cited. Taxonomy: added
  `browserbase|browserless|steel` to **Web, Search & Browsing** (the bare `browser` token's word boundary won't
  match `browserbase`/`browserless`). (2) `cursor-vs-windsurf-vs-github-copilot-vs-claude-code` (Wire) — the
  commercial AI-coding-tool/IDE layer, distinct from the OSS terminal coding agents (`aider-vs-cline-vs-openhands`,
  zero subject overlap → additive). Durable thesis: the four map to three architectural *postures* (AI-native
  VS Code fork vs plugin-to-your-editor vs CLI-native), and since the *companies* keep being acquired/rebranded
  out from under users (Windsurf dismembered across Google/Cognition→Devin in 2025; SpaceX acquiring Cursor ~$60B,
  June 2026), the durable choice is the posture, not the brand. SWE-bench Verified treated as saturated/contaminated
  (OpenAI dropped it early 2026), not leaned on; M&A/funding facts dated + attributed (TechCrunch/CNBC/Anthropic/
  GitHub). Taxonomy: added a new **Coding Agents & IDEs** cluster placed BEFORE Agent UI & Frontend — the bare
  `copilot` token there (for CopilotKit) would otherwise capture a `…-github-copilot-…` coding slug by first-match;
  the new cluster also rescues `aider-vs-cline-vs-openhands` from the "More comparisons" catch-all. Two regression
  tests pin both behaviors (coding tools rail together; CopilotKit stays in Agent UI via its explicit `copilotkit`
  token, which `copilot` can't swallow). Suite **787 green**; check:content reports both slates clean. Note:
  `/api/analytics` remains unreachable (host not in the routine's egress allowlist), so topic selection leaned on
  corpus-gap analysis + the standing demand-cluster map.

- **2026-06-22 (run 21):** two NEW demand clusters the corpus had never covered — the voice-agent
  *architecture* axis (speech-to-speech vs cascaded, distinct from the STT/TTS/orchestration *tool*
  comparisons already in the Voice cluster) and the *MCP gateway / aggregation* layer (the agent-tools
  control plane, distinct from FastMCP server-*building* and the MCP transport/auth *spec* pieces).
  Shipped both at full standard with verified primary sources + the enforced compare table:
  `speech-to-speech-vs-cascaded-voice-agents` (Wire; the non-obvious thesis that the text transcript
  between STT→LLM→TTS stages was never dead weight you tolerated — it was *load-bearing control
  infrastructure*: the layer where you log what the agent heard, eval/guardrail it, swap best-of-breed
  components, and audit the call, so S2S doesn't make the pipeline smarter, it deletes the layer where
  you observed and steered it; the durable answer is hybrid — S2S for fast/emotional turns, a text path
  for reasoning/tools/audit; sources: OpenAI gpt-realtime GA Aug-2025 + Realtime-MCP docs, Gemini Live
  API docs + capabilities, Kyutai Moshi repo (~160ms/200ms full-duplex, primary-verified) + paper
  2410.00037, Pipecat, LiveKit pipeline blog. Specific cascaded-vs-S2S latency *numbers* deliberately
  hedged — most are vendor/dev-blog figures, not standardized benchmarks; only Moshi's author-reported
  latency is quoted, attributed) and `mcp-gateway-contextforge-vs-agentgateway-vs-metamcp` (Stack; the
  framing that the gateway exists to solve *tool sprawl* — too many connected MCP servers flood the
  context window with tool definitions and degrade selection accuracy — plus governance, and the
  load-bearing distinction between a transport *bridge* (supergateway: moves bytes) and a governance
  *gateway* (decides what's allowed); the gateway is also where the 2025 MCP OAuth-2.1 resource-server
  spec gets enforced once instead of per-server, and where untrusted third-party servers get screened
  for tool-poisoning; three distinct philosophies — IBM ContextForge ~3.9k (enterprise federation +
  registry), agentgateway ~3.4k Rust (kgateway/service-mesh data plane, CEL-policy RBAC), MetaMCP ~2.4k
  (self-host aggregator whose namespacing/tool-filtering most directly fights sprawl); @repo stars
  API-confirmed 2026-06-22; sources: the three repos + supergateway, MCP auth spec 2025-11-25, Invariant
  Labs tool-poisoning, OWASP MCP Tool Poisoning, awesome-mcp-gateways). Both route correctly with **no
  taxonomy change** — speech-to-speech rails into **Voice Agents** (via `voice`) with the 3 voice tool
  pages; mcp-gateway rails into **Protocols (MCP & A2A)** (via `mcp`, first-match-wins over the later
  `gateway` token in Inference & Gateways) with the MCP spec pieces (both verified live). Then advanced
  the **#15/#30 legacy compare-table backfill** (top `todo` from run 20): added verified at-a-glance
  tables to two top-of-funnel money pages — `chroma-vs-weaviate-vs-milvus` and
  `litellm-vs-portkey-vs-tensorzero` (cells drawn strictly from each piece's already-sourced body),
  taking the legacy backlog from **19 → 17** pieces below standard. Suite **791 green**; check:content
  reports this run's slate clean (4 changed, 0 below). Note: `/api/analytics` again unreachable (host not
  in the routine's egress allowlist), so topic selection leaned on corpus-gap analysis + the standing
  demand-cluster map.

- **2026-06-22 (run 22):** two NEW demand clusters at full standard — **self-hosted AI chat
  front-ends** (`open-webui-vs-librechat-vs-anythingllm`, Stack; thesis: feature lists have converged,
  so the axis is *primary user* — local-LLM ops vs multi-provider team vs all-in-one desktop RAG; honest
  license facts: Open WebUI non-OSI w/ 50-user branding clause, the other two MIT) and the **agent
  action-space** (`smolagents-vs-langgraph-vs-crewai`, Stack; distinct from the orchestration-style
  `langgraph-vs-crewai-vs-autogen` — this is code-as-action (CodeAct, arXiv:2402.01030) vs state-graph vs
  role-team, and cross-links the companion so it complements not cannibalizes). @repo stars verified
  2026-06-22. Then Part B advanced **schema accuracy (#3/#25/#30):** article JSON-LD `@type` was a blanket
  `NewsArticle`; now section-appropriate — **Wire → NewsArticle** (real news), **Stack → TechArticle**
  (evergreen technical reference, the bulk of the demand corpus), **Dispatches & Fabrications → Article**
  (essays / labeled satire, never news). This stops evergreen comparison pages from carrying news
  freshness-decay signals and fixes satire-as-news mislabeling; all properties stay valid (Article
  subtypes). Two tests pin the section→type map. Suite **796 green**; check:content slate clean (2 changed,
  0 below). `/api/analytics` again unreachable (host not in egress allowlist) → corpus-gap topic selection.

See `DISTRIBUTION.md` for the ready-to-use HN/Reddit/X/outreach assets.
