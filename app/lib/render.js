// render.js — server-side rendering for dreaming.press. Pure functions:
// data in → HTML string out. Mirrors the editorial design system.
import { SITE, SECTIONS, SECTION_ORDER, AUTHORS, authorOf, authorKey, esc, humanDate, humanizeSeries, NOW } from "./data.js";
import { TOOLS } from "./tools-data.js";
import { clusterLabelFor, COMPARISON_CATCHALL, clusterSlug, comparisonClusters } from "./db.js";

export const coverUrl = (slug) => `/images/${slug}.png`;

// Is a compare-table header cell a descriptive column LABEL (e.g. "Best for",
// "Breaks when", "You charge for") rather than a named entity (e.g. "LangGraph",
// "Plan mode (Claude Code / Cursor)")? Only entity names belong in an article's
// schema.org `about`; descriptive labels pollute the entity graph. Two
// high-precision phrase signals, applied AFTER stripping any parenthetical (which
// carries entity aliases, never prose):
//   • LEADS with an article/interrogative/auxiliary/pronoun ("What goes wrong",
//     "You charge for") — a product name never starts this way; OR
//   • ENDS with a dangling connective ("Best for", "Breaks when", "Scales to",
//     "Optimize for") — a product name never terminates in a bare preposition.
// `^word\b` / `\bword$` fire only on a SEPARATE token, so glued names survive:
// "Notion" keeps its trailing "on", "Speech-to-speech"/"End-to-end" their "to".
// Domain-shaped trailers ("so" as in "MCP.so", plus "as"/"at"/"by") are
// deliberately excluded so registry/host names are never mistaken for prose.
// The earlier filter only checked the LEAD against a shorter list, so labels like
// "Best for" / "Reach for it when" (~26 pages) leaked into `about` as bogus
// Things; the trailing-connective + pronoun signals close that gap.
const LABEL_LEAD = /^(the|a|an|what|whats|how|why|when|where|which|who|is|are|was|were|does|do|did|your|youre|youll|its|it|their|this|that|these|those|you|we|weve)\b/i;
const LABEL_TRAIL = /\b(for|to|on|in|of|with|when|where|why|how|if|whether|while|unless|until|because|than|into|from|about|over|under|per|vs|or|and|but|against)$/i;
// Generic axis/attribute nouns that are column LABELS, never named entities. The two
// phrase signals above catch prose-shaped labels ("Best for", "What goes wrong") but
// miss a bare generic noun used as a header cell ("Standard", "Layer", "Originated").
// A real compared entity is never literally just "Standard" — when one of these is the
// WHOLE cell, the table is a descriptive matrix (the entities live in the BODY, not the
// header), so publishing it as a schema.org `about` Thing pollutes the entity graph
// (e.g. "Standard"/"Originated by" leaked on the AAIF governance table, whose Layer ×
// attribute header carries no entities at all). Whole-cell exact match keeps it
// high-precision: "MCP Standard" or "Layer 2 (Optimism)" still survive (they carry a
// real token), only the bare label is dropped.
const LABEL_GENERIC = new Set([
  "standard", "standards", "dimension", "aspect", "feature", "category", "attribute",
  "property", "metric", "factor", "criterion", "criteria", "layer", "type", "approach",
  "method", "stage", "phase", "field", "capability", "component", "option", "use case",
  "area", "topic", "concept", "originated", "origin",
  // Attribute/axis labels that were leaking into `about` as bogus Things on
  // concept & how-to compare tables (descriptive matrices — the entities live in
  // the body, the header carries column LABELS). Corpus audit (2026-06-29, faithful
  // re-impl of the about-axis pick over every `compare:` header): each of these is
  // ONLY ever a header attribute, never a compared entity, so dropping it removes a
  // non-entity from the graph and can never lose a real subject — a reconciled name
  // is kept regardless (entitySameAs short-circuits isEntityHeader), so the only
  // cells this can touch are un-reconciled labels.
  "mechanism", "cost", "token cost", "notable", "license", "speed", "weakness",
  "granularity", "primitive", "best fit", "failure mode", "typical use",
]);
// A multi-word label closing on a connective LABEL_TRAIL deliberately omits — "by"/"via"
// are kept out of LABEL_TRAIL so single-token host names ("MCP.so") survive, but a
// SEPARATE trailing "by"/"via" only ever ends a prose label ("Originated by",
// "Maintained by", "Reached via"), never an entity name (\s requires a prior word, so a
// glued tail like "Ruby" can't match).
const LABEL_TRAIL_PREP = /\s(by|via)$/i;
export const isDescriptiveLabel = (name) => {
  const s = String(name).replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  // A cell phrased as a question ("Lossy?", "Saves memory?", "Deletes orphans?") is
  // a comparison-matrix axis label, never the name of a real-world entity — no
  // catalogued or reconcilable Thing ends in "?", so this is high-precision.
  return /\?$/.test(s)
    || LABEL_GENERIC.has(s.toLowerCase()) || LABEL_LEAD.test(s) || LABEL_TRAIL.test(s) || LABEL_TRAIL_PREP.test(s);
};

// Bound the <meta name="description"> / og:description to a snippet length search
// engines actually render. The on-page `dek` is a literary standfirst and may run
// long (AGENTS.md caps it at 200, but 52 live pieces exceed it); piped verbatim
// into the description tag it just gets truncated by Google at ~155-160 chars —
// often mid-word — wasting the SERP/social snippet. This emits a clean, sentence-
// or word-boundary-bounded description instead, so the snippet ends on purpose.
// Pure and deterministic. Returns the text unchanged when already within budget.
export function metaDescription(s, max = 160) {
  const text = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  // Prefer ending on a sentence that lands in a comfortable window (≥ 60% of max),
  // so the snippet reads as a complete thought rather than a hard cut.
  const window = text.slice(0, max);
  const lastSentence = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "));
  if (lastSentence >= max * 0.6) return window.slice(0, lastSentence + 1).trim();
  // Otherwise cut at the last word boundary and add an ellipsis (kept within max).
  const room = max - 1;                          // leave space for the "…"
  const cut = text.slice(0, room);
  const lastSpace = cut.lastIndexOf(" ");
  const body = (lastSpace > room * 0.5 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.!?-]+$/, "");
  return body + "…";
}

// Entity reconciliation map (#25 schema): name → canonical `sameAs` URL for the
// real-world things this corpus compares. The compare-table `about` entities are
// just names; a `sameAs` to the tool's own repo lets a search engine / AI agent
// resolve "Qdrant" or "vLLM" to one specific entity instead of guessing — the
// disambiguation Google's knowledge graph rewards on "X vs Y" queries. Built once
// from the static catalog (names/repos are identity, not the live star count, so
// the seed is the right source). Keyed by lowercased name, with aliases for a
// pre-parenthetical base name and the parenthetical itself ("Letta (MemGPT)" →
// also "letta" and "memgpt") so a header cell that names either form still hits.
// Supplemental reconciliation for entities the repo catalog (TOOLS) structurally
// can't represent, yet "X vs Y" pages routinely compare: hosted services with no
// canonical public repo (OpenRouter), and sub-products that ship their OWN repo
// distinct from the umbrella tool ("LlamaIndex Workflows" → run-llama/workflows,
// not the parent llama_index). Before this, every SaaS-vs-OSS compare page — the
// majority of the demand corpus — shipped its hosted column as a bare `about`
// Thing with no `sameAs`, the exact disambiguation the knowledge graph rewards.
// Keyed by lowercased name. A real repo URL where one exists; the official
// homepage where the entity is closed/hosted (Google accepts an official site as
// a `sameAs` identity URL). Curated + verified by hand — never a guess. Only
// fills gaps: a name already reconciled by the repo catalog wins (it's identity).
export const ENTITY_SAMEAS_EXTRA = {
  "openrouter": "https://openrouter.ai",
  "litellm": "https://github.com/BerriAI/litellm",
  "llamaindex workflows": "https://github.com/run-llama/workflows",
  // Guardrails & Safety cluster — the guardrail/red-team tools compared on
  // guardrails-ai-vs-nemo-guardrails-vs-llama-guard and garak-vs-pyrit-vs-promptfoo
  // name real products as compare-table columns, but NONE is in the agent-tool catalog
  // (it covers frameworks/memory/vector-DBs, not safety tooling), so every column
  // reconciled to a bare Thing — no canonical identity for the entity graph on the
  // cluster's "X vs Y" security money queries (promptfoo already resolves via the
  // catalog). Canonical repos verified live: garak moved leondz→NVIDIA, NeMo Guardrails
  // moved to the NVIDIA-NeMo org, and PyRIT moved Azure→microsoft (Azure/PyRIT archived
  // 2026-03-27); Llama Guard ships from Meta's PurpleLlama umbrella repo.
  "guardrails ai": "https://github.com/guardrails-ai/guardrails",
  "nemo guardrails": "https://github.com/NVIDIA-NeMo/Guardrails",
  "llama guard": "https://github.com/meta-llama/PurpleLlama",
  "garak": "https://github.com/NVIDIA/garak",
  "pyrit": "https://github.com/microsoft/PyRIT",
  // Prompt-injection detectors compared head-to-head on rebuff-vs-llm-guard-vs-vigil-
  // prompt-injection — a dedicated LLM-security money page whose every entity column
  // (Rebuff, LLM Guard, Vigil) shipped a bare Thing: none is in the agent-tool catalog,
  // so the "which prompt-injection detector" query carried no canonical identity. All
  // three are OSS with one canonical repo, verified live: Rebuff + LLM Guard ship from
  // Protect AI (protectai/rebuff, protectai/llm-guard), Vigil from deadbits/vigil-llm.
  "rebuff": "https://github.com/protectai/rebuff",
  "llm guard": "https://github.com/protectai/llm-guard",
  "vigil": "https://github.com/deadbits/vigil-llm",
  // GenAI/agent frameworks compared on "X vs Y" framework money pages but missing a
  // canonical identity: Genkit (Google's OSS framework) and the Vercel AI SDK are not in
  // the TOOLS catalog at all, and LangChain itself is catalogued only via its sub-project
  // LangGraph — so genkit-vs-langchain-vs-vercel-ai-sdk, dify-vs-langchain, and
  // haystack-vs-langchain-vs-llamaindex reconciled these columns to bare Things. Canonical
  // repos verified (firebase/genkit, vercel/ai, langchain-ai/langchain).
  "genkit": "https://github.com/firebase/genkit",
  "firebase genkit": "https://github.com/firebase/genkit",
  "vercel ai sdk": "https://github.com/vercel/ai",
  "ai sdk": "https://github.com/vercel/ai",
  "langchain": "https://github.com/langchain-ai/langchain",
  // LLM inference/serving engines — the single densest unreconciled cluster in the
  // corpus. vLLM alone names a bare `about` Thing on 5+ money pages, and the whole
  // "which inference engine" demand cluster (vllm-vs-sglang-vs-ollama-inference-engine,
  // vllm-vs-tensorrt-llm-vs-tgi, nvidia-nim-vs-vllm-vs-tgi-self-hosting-llm-inference,
  // groq-vs-together-vs-fireworks-inference, …) reconciled every column to a bare Thing:
  // none of these serving runtimes is in the TOOLS catalog (frameworks/memory/vector-DBs),
  // so the highest-intent inference "X vs Y" queries shipped no canonical identity for the
  // entity graph. Canonical repos verified live: vLLM (vllm-project/vllm), SGLang
  // (sgl-project/sglang), Ollama (ollama/ollama), TensorRT-LLM (NVIDIA/TensorRT-LLM), TGI
  // (huggingface/text-generation-inference, now in maintenance mode but still the named
  // entity). The pre-parenthetical base-key match in entitySameAs covers the "vLLM (…)"
  // variants the corpus prints, so only the bare cell name needs keying.
  "vllm": "https://github.com/vllm-project/vllm",
  "sglang": "https://github.com/sgl-project/sglang",
  "ollama": "https://github.com/ollama/ollama",
  "tensorrt-llm": "https://github.com/NVIDIA/TensorRT-LLM",
  "tgi": "https://github.com/huggingface/text-generation-inference",
  "text generation inference": "https://github.com/huggingface/text-generation-inference",
  // Microsoft Agent Framework (MAF) — the consolidated successor to AutoGen +
  // Semantic Kernel that hit 1.0 GA on 2026-04-02. The TOOLS catalog carries only
  // the legacy "AutoGen" (microsoft/autogen), so the new framework comparison
  // (langgraph-vs-microsoft-agent-framework) reconciled its second column to a bare
  // Thing. Canonical repo verified live (microsoft/agent-framework, Python + .NET).
  "microsoft agent framework": "https://github.com/microsoft/agent-framework",
  // Vercel eve — the "Next.js for agents" framework that launched 2026-06-17 at
  // Ship London (Apache-2.0). Brand-new and not in the TOOLS catalog, so the
  // vercel-eve-vs-langgraph compare page reconciled its first column to a bare Thing
  // while the LangGraph column resolved via the catalog — the same one-sided #25 gap
  // MAF/Genkit had. Keyed to the exact cell ("Vercel eve") the table prints.
  // Canonical repo verified (vercel/eve).
  "vercel eve": "https://github.com/vercel/eve",
  // Two more OSS-framework comparison clusters whose non-catalog columns shipped
  // bare (surfaced by scripts/audit-bare-entities.js, the next reconcilable gaps
  // after the routers). DURABLE EXECUTION (temporal-vs-inngest-vs-restate-durable-
  // agents): Temporal already reconciles via the TOOLS catalog, but Inngest and
  // Restate — the other two columns on this high-intent "durable agents" page —
  // had no canonical identity. PROMPT OPTIMIZATION (dspy-vs-textgrad-vs-adalflow):
  // DSPy reconciles via the catalog; TextGrad and AdalFlow (the textual-gradient
  // optimizers it's compared against) shipped bare. Canonical OSS repos verified
  // live: inngest/inngest (the workflow-orchestration platform repo, not the
  // language SDKs), restatedev/restate, zou-group/textgrad (the Nature-published
  // framework), SylphAI-Inc/AdalFlow. Keyed to the exact compare-cell names.
  "inngest": "https://github.com/inngest/inngest",
  "restate": "https://github.com/restatedev/restate",
  "textgrad": "https://github.com/zou-group/textgrad",
  "adalflow": "https://github.com/SylphAI-Inc/AdalFlow",
  // agent-sandbox isolation runtimes — real OSS projects routinely compared on
  // "X vs Y" sandbox pages but absent from the TOOLS catalog (infra, not an
  // agent framework). Canonical repos verified.
  "firecracker": "https://github.com/firecracker-microvm/firecracker",
  "gvisor": "https://github.com/google/gvisor",
  "kata containers": "https://github.com/kata-containers/kata-containers",
  "kata": "https://github.com/kata-containers/kata-containers",
  // NVIDIA datacenter GPUs — the entities every "which GPU for inference" compare
  // page names, but hardware, so they have a canonical product page rather than a
  // repo. Keyed for both the bare name and the form-factor variant the corpus uses
  // (e.g. "H100 SXM", "A100 80GB"). Canonical NVIDIA pages verified.
  "h100": "https://www.nvidia.com/en-us/data-center/h100/",
  "h100 sxm": "https://www.nvidia.com/en-us/data-center/h100/",
  "h200": "https://www.nvidia.com/en-us/data-center/h200/",
  "b200": "https://www.nvidia.com/en-us/data-center/technologies/blackwell-architecture/",
  "a100": "https://www.nvidia.com/en-us/data-center/a100/",
  "a100 80gb": "https://www.nvidia.com/en-us/data-center/a100/",
  "l40s": "https://www.nvidia.com/en-us/data-center/l40s/",
  // AI accelerators compared on "Trainium vs NVIDIA GPU for inference" — hardware,
  // not catalog tools, and the compare table runs them DOWN the first column (a
  // transposed spec table), so without a canonical identity its `about` axis can't
  // flip to the real chips and leaks the header attribute labels instead. Keyed by
  // the pre-parenthetical base ("AWS Trainium2 (Trn2)" → "aws trainium2") to the
  // chip's verified EC2 instance page; the NVIDIA GPU and Google TPU options carry
  // the corpus's slashed dual-product spelling, each pointed at the current-gen
  // representative product page (h200 already mapped above; cloud.google.com/tpu).
  "aws trainium2": "https://aws.amazon.com/ec2/instance-types/trn2/",
  "trainium2": "https://aws.amazon.com/ec2/instance-types/trn2/",
  "aws inferentia2": "https://aws.amazon.com/ec2/instance-types/inf2/",
  "inferentia2": "https://aws.amazon.com/ec2/instance-types/inf2/",
  "nvidia h100/h200": "https://www.nvidia.com/en-us/data-center/h200/",
  "google tpu v5/v6": "https://cloud.google.com/tpu",
  // 4-bit floating-point quantization FORMATS compared on nvfp4-vs-mxfp4 — like
  // FlashAttention/PagedAttention they're techniques, not catalog tools, but each
  // has a single canonical definition: NVFP4 is NVIDIA's format (its launch post is
  // the authoritative spec), MXFP4 is the open OCP Microscaling standard (the MX
  // v1.0 spec). Reconciling both flips that page's transposed table so the formats
  // become `about` Things; INT4 stays a bare Thing (a generic integer format with no
  // single canonical home).
  "nvfp4": "https://developer.nvidia.com/blog/introducing-nvfp4-for-efficient-and-accurate-low-precision-inference/",
  "mxfp4": "https://www.opencompute.org/documents/ocp-microscaling-formats-mx-v1-0-spec-final-pdf",
  // open OCR / document-parsing systems compared on "DeepSeek-OCR vs …" pages but
  // absent from the agent-tool catalog. Canonical repos verified.
  "deepseek-ocr": "https://github.com/deepseek-ai/DeepSeek-OCR",
  "got-ocr2.0": "https://github.com/Ucas-HaoranWei/GOT-OCR2.0",
  "mineru": "https://github.com/opendatalab/MinerU",
  "mineru2.0": "https://github.com/opendatalab/MinerU",
  // 2026 open-weight agentic MoE models compared on "best open model for agents"
  // pages but absent from the agent-tool catalog (they're foundation models, not a
  // framework/library). Keyed by the pre-parenthetical base name — entitySameAs
  // strips a trailing "(…)" qualifier, so a column "Kimi K2 (Thinking)" resolves via
  // "kimi k2". Canonical repos verified: GLM-4.6 ships from the GLM-4.5 repo (no
  // separate 4.6 repo — it carries the 4.6 TIR guide); Qwen3-Coder has its own repo.
  "kimi k2": "https://github.com/moonshotai/kimi-k2",
  "glm-4.6": "https://github.com/zai-org/GLM-4.5",
  "minimax m2": "https://github.com/MiniMax-AI/MiniMax-M2",
  "qwen3-coder": "https://github.com/QwenLM/Qwen3-Coder",
  // learned-sparse retriever compared on "SPLADE vs BM25 vs dense" pages; the model
  // family has a canonical repo. BM25/Dense are generic IR concepts with no single
  // canonical identity, so they correctly stay bare Things.
  "splade": "https://github.com/naver/splade",
  // Coding agents & IDEs — the whole "Coding Agents & IDEs" cluster (cursor-vs-…,
  // claude-code-vs-codex-cli-…, aider-vs-cline-vs-openhands, cline-vs-roo-code-…,
  // devin-vs-codex-vs-cursor-vs-jules-…) names these products in its compare tables,
  // but NONE is in the agent-tool catalog (it covers frameworks/memory/vector-DBs,
  // not coding assistants), so every column reconciled to a bare Thing — no canonical
  // identity for the entity graph on the cluster's "X vs Y" money queries. Open-source
  // tools key to their canonical GitHub repo (each verified to resolve); the SaaS-only
  // assistants key to their official product domain (same SaaS-domain pattern as
  // OpenRouter/NVIDIA above). The matcher strips a trailing "(…)" but not a version or
  // descriptor suffix, so the variant forms the corpus actually prints — "Devin 2.0",
  // "Cursor agents", "OpenAI Codex", "GitHub Copilot agent", "Google Jules" — are keyed
  // explicitly alongside their base name (the same base+variant style as kata/h100/mineru).
  "cursor": "https://cursor.com",
  "cursor agents": "https://cursor.com",
  "windsurf": "https://windsurf.com",
  "github copilot": "https://github.com/features/copilot",
  "github copilot agent": "https://github.com/features/copilot",
  "claude code": "https://github.com/anthropics/claude-code",
  "codex": "https://github.com/openai/codex",
  "codex cli": "https://github.com/openai/codex",
  "openai codex": "https://github.com/openai/codex",
  "gemini cli": "https://github.com/google-gemini/gemini-cli",
  "aider": "https://github.com/Aider-AI/aider",
  "cline": "https://github.com/cline/cline",
  "openhands": "https://github.com/All-Hands-AI/OpenHands",
  "roo code": "https://github.com/RooCodeInc/Roo-Code",
  "kilo code": "https://github.com/Kilo-Org/kilocode",
  "devin": "https://devin.ai",
  "devin 2.0": "https://devin.ai",
  "jules": "https://jules.google",
  "google jules": "https://jules.google",
  // LLM serving benchmark/load-test tools named as the row-axis entities of the
  // "how to benchmark llm inference" roundup (a transposed compare table — entities
  // down the first column). None is in the agent-tool catalog (it covers
  // frameworks/memory/vector-DBs, not benchmarking harnesses). Canonical repos
  // verified; keyed to the exact row labels the table prints. GenAI-Perf lives in
  // Triton's perf_analyzer repo; "vllm bench serve" is a subcommand of vLLM, so it
  // reconciles to the vLLM repo. MLPerf Inference and InferenceMAX stay bare Things
  // (no single canonical repo asserted here).
  "guidellm": "https://github.com/vllm-project/guidellm",
  "llmperf": "https://github.com/ray-project/llmperf",
  "genai-perf": "https://github.com/triton-inference-server/perf_analyzer",
  "aiperf": "https://github.com/ai-dynamo/aiperf",
  "vllm bench serve": "https://github.com/vllm-project/vllm",
  // Attention/serving optimizations compared on flash-attention-vs-paged-attention
  // (Inference & Gateways). Unlike generic IR concepts (BM25/Dense above), each has a
  // single canonical home, so reconciling is precise, not a guess: FlashAttention's
  // reference implementation is Tri Dao's Dao-AILab/flash-attention (FA1/2/3/4); the
  // PagedAttention algorithm has no standalone repo — it was introduced in and ships
  // from the vLLM project (SOSP'23), so its canonical identity is vllm-project/vllm.
  // Keyed for both the one-word column forms ("FlashAttention"/"PagedAttention") and
  // the spaced variants. Verified live (Dao-AILab/flash-attention, vllm-project/vllm).
  "flashattention": "https://github.com/Dao-AILab/flash-attention",
  "flash attention": "https://github.com/Dao-AILab/flash-attention",
  "pagedattention": "https://github.com/vllm-project/vllm",
  "paged attention": "https://github.com/vllm-project/vllm",
  // CodeAct — the agent-action technique (the model emits one executable Python
  // program that calls its tools, instead of a tool-call-per-turn JSON loop). Like
  // FlashAttention/PagedAttention it's a technique, not a catalog tool, so the four
  // compare pages that name it as a column (microsoft-agent-framework-build-2026,
  // code-agents-vs-tool-calling-agents, langgraph-vs-microsoft-agent-framework,
  // smolagents-vs-langgraph-vs-crewai) reconciled "CodeAct" to a bare Thing with no
  // canonical identity. It has exactly one authoritative home — the ICML 2024 paper
  // "Executable Code Actions Elicit Better LLM Agents" (arXiv 2402.01030) and its
  // official repo — so reconciling is precise, not a guess. Verified live
  // (xingyaoww/code-act, "Official Repo for ICML 2024 paper …").
  "codeact": "https://github.com/xingyaoww/code-act",
  // Agent & coding benchmarks — the Evals & Observability cluster's "which benchmark"
  // money pages (swe-evo-vs-swe-bench, swe-bench-pro-vs-swe-bench-verified,
  // swe-bench-vs-tau-bench-vs-gaia, terminal-bench-vs-swe-bench, tau-bench-vs-tau2-bench,
  // browsecomp-vs-deepresearch-bench) name real benchmarks as their compare-table
  // entities, but a benchmark is neither a framework nor a tool, so NONE is in the
  // agent-tool catalog — every benchmark column reconciled to a bare Thing with no
  // canonical identity, exactly the #25 entity-graph gap already closed for safety
  // tooling, GPUs, and quantization formats. Each benchmark has one authoritative home,
  // so reconciling is precise, not a guess. Canonical homes verified live:
  // SWE-bench → swebench.com (the official hub that also lists the curated "Verified"
  // subset); SWE-EVO → its arXiv paper (no repo asserted); τ-bench/τ²-bench → Sierra's
  // repos; GAIA → the gaia-benchmark HF dataset; Terminal-Bench → tbench.ai (the repo
  // migrated orgs, the site is the stable identity); DeepResearch Bench → its repo.
  // entitySameAs strips a trailing "(…)" on a miss, so "SWE-bench (Verified)",
  // "τ-bench (2024)", "Terminal-Bench (2.x)" all resolve via the pre-parenthetical base.
  // The τ keys carry the exact glyphs the tables print (τ = U+03C4, ² = U+00B2) because
  // entitySameAs — unlike the rail's normEntity — does NOT transliterate. Corpus-scanned:
  // these names appear only as benchmark cells, so nothing else is reconciled. SWE-bench
  // Pro, BrowseComp(-Plus), Recovery-Bench, MLPerf/InferenceMAX stay bare Things (a
  // distinct-org variant or no single canonical home asserted here).
  "swe-bench": "https://www.swebench.com/",
  "swe-bench verified": "https://www.swebench.com/",
  "swe-evo": "https://arxiv.org/abs/2512.18470",
  "τ-bench": "https://github.com/sierra-research/tau-bench",
  "τ²-bench": "https://github.com/sierra-research/tau2-bench",
  "gaia": "https://huggingface.co/datasets/gaia-benchmark/GAIA",
  "terminal-bench": "https://www.tbench.ai/",
  "deepresearch bench": "https://github.com/Ayanami0730/deep_research_bench",
  // Long-term agent-MEMORY benchmarks — the same #25 benchmark gap, in the memory
  // cluster. locomo-vs-longmemeval-vs-beam-agent-memory compares these three as a
  // TRANSPOSED table (benchmarks down the first column, attribute labels across the
  // header), so until they were keyed the whole high-intent "agent memory benchmark"
  // page reconciled NOTHING and shipped zero `about` Things — neither axis had a
  // canonical entity, so the transposed-flip guard never fired. Each has exactly one
  // authoritative home, so reconciling is precise: LoCoMo → Snap Research's repo,
  // LongMemEval → the authors' repo (ICLR 2025), BEAM → the "Beyond a Million Tokens"
  // repo (ICLR 2026, arXiv 2510.27246). entitySameAs strips the trailing "(…)" on a
  // miss, so "LoCoMo (2024)" / "LongMemEval (ICLR 2025)" / "BEAM (ICLR 2026)" all
  // resolve via the pre-parenthetical base. Verified live via the GitHub repos.
  "locomo": "https://github.com/snap-research/locomo",
  "longmemeval": "https://github.com/xiaowu0162/LongMemEval",
  "beam": "https://github.com/mohammadtavakoli78/BEAM",
  // Agent-to-agent INTEROP protocols — the Protocols (MCP & A2A) cluster compares
  // these as named entities (a2a-vs-acp-vs-agntcy-agent-interop-protocols, a2a-vs-mcp,
  // a2a) but a protocol is neither a framework nor a tool, so NONE is in the agent-tool
  // catalog — every protocol column reconciled to a bare Thing, the same #25 gap closed
  // for benchmarks/safety tooling/GPUs/quant formats, just never extended to the
  // interop protocols the cluster's whole "which agent protocol" demand turns on.
  // Canonical homes verified live: A2A → the Linux Foundation project repo (Google-
  // contributed, github.com/a2aproject/A2A); ACP → IBM's i-am-bee/acp repo, archived
  // 2025-08-27 with the "now part of A2A under the Linux Foundation" notice — still the
  // authoritative identity for that distinct named entity; AGNTCY → the Cisco-originated
  // LF org (github.com/agntcy, the dir/slim/oasf/identity umbrella).
  //
  // COLLISION GUARD: the payment cluster's ap2-vs-x402-vs-acp page prints a column cell
  // of just "ACP" meaning the *Agentic Commerce* Protocol — a different entity. So we
  // key ONLY the full parenthetical form "acp (agent communication protocol)" (the exact
  // cell this cluster prints) and deliberately add NO bare "acp" key, so entitySameAs's
  // paren-strip fallback leaves the payment page's bare "ACP" a Thing, never mis-homed.
  "a2a": "https://github.com/a2aproject/A2A",
  "agent2agent": "https://github.com/a2aproject/A2A",
  "acp (agent communication protocol)": "https://github.com/i-am-bee/acp",
  "agntcy": "https://github.com/agntcy",
  // MCP itself — the one interop protocol still shipping bare after A2A/ACP/AGNTCY were
  // homed. It is the most canonical of the set (Linux Foundation, the same governance as
  // A2A) yet appeared as a bare `about` Thing on its own comparison money pages
  // (ag-ui-vs-mcp-vs-a2a, mcp-vs-function-calling, claude-agent-skills-vs-mcp,
  // agent-control-specification-acs-runtime-governance) — a one-sided gap where the A2A
  // and AG-UI columns reconciled but the MCP column next to them did not. Keyed to the
  // canonical spec repo (github.com/modelcontextprotocol/modelcontextprotocol), matching
  // the A2A repo style so a transposed "Protocol | MCP | A2A | AG-UI" row homes every
  // column. "MCP" means Model Context Protocol unambiguously across this corpus, so the
  // exact-cell key reconciles the bare "MCP" columns and nothing else (WebMCP, "MCP
  // tools", etc. are distinct cells the matcher never touches). Repo verified live.
  "mcp": "https://github.com/modelcontextprotocol/modelcontextprotocol",
  // Document & web ingestion — the top-of-funnel parsers/crawlers compared on
  // docling-vs-unstructured-vs-llamaparse and firecrawl-vs-crawl4ai-vs-jina-reader.
  // Recent runs added the compare TABLES to both money pages but never reconciled the
  // entities, so all six columns still shipped as bare Things — the SaaS-vs-OSS gap
  // #25 exists to close. Canonical homes verified live: Docling (docling-project/
  // docling, the LF AI & Data project IBM started), Unstructured (Unstructured-IO/
  // unstructured), Jina Reader (jina-ai/reader, the Apache-2.0 OSS behind r.jina.ai),
  // Crawl4AI (unclecode/crawl4ai), Firecrawl (mendableai/firecrawl). LlamaParse is a
  // hosted product whose SDK/cloud repo run-llama/llama_parse now redirects to
  // llama_cloud_services — the canonical repo identity for the named entity.
  "docling": "https://github.com/docling-project/docling",
  "unstructured": "https://github.com/Unstructured-IO/unstructured",
  "llamaparse": "https://github.com/run-llama/llama_cloud_services",
  "jina reader": "https://github.com/jina-ai/reader",
  "crawl4ai": "https://github.com/unclecode/crawl4ai",
  "firecrawl": "https://github.com/mendableai/firecrawl",
  // OCR / PDF-to-markdown engines — the sibling of the parsers above, compared on the
  // high-intent "best PDF parser for RAG" money page olmocr-vs-marker-vs-mineru-vs-mistral-ocr.
  // MinerU already reconciles via the TOOLS-catalog base key (opendatalab/MinerU); the
  // other three columns still shipped bare. Canonical homes verified live: olmOCR
  // (allenai/olmocr, AI2's PDF-linearization toolkit), Marker (datalab-to/marker — the
  // current org home of Vik Paruchuri's converter; VikParuchuri/marker redirects here),
  // and Mistral OCR, a proprietary API-only product → its official product page (the
  // OpenRouter/Modal hosted-service precedent: a closed service's identity is its site).
  // `marker` is an English word, but corpus-scanned it appears as a compare cell in ONLY
  // this OCR page, so exact-match keying poaches nothing.
  "olmocr": "https://github.com/allenai/olmocr",
  "marker": "https://github.com/datalab-to/marker",
  "mistral ocr": "https://mistral.ai/news/mistral-ocr/",
  // LLM observability/eval SaaS — the flagship langfuse-vs-langsmith-vs-braintrust
  // money page names three platforms, but only Langfuse is in the TOOLS catalog, so
  // LangSmith and Braintrust shipped as bare Things on a high-traffic "which LLM
  // observability platform" query. Both are proprietary, hosted products with no
  // public product repo (only client SDKs), so — like OpenRouter — the official site
  // is the canonical identity Google accepts as a sameAs. Verified live:
  // LangSmith → langchain.com/langsmith; Braintrust → braintrust.dev.
  "langsmith": "https://www.langchain.com/langsmith",
  "braintrust": "https://www.braintrust.dev",
  // Graph-RAG architectures — the densest unreconciled cluster after the
  // observability sweep. The "which graph RAG" demand pages (graphrag-vs-vector-rag,
  // graphrag-vs-lightrag-vs-graphiti, graphrag-vs-lightrag,
  // raptor-vs-naive-rag-hierarchical-retrieval) compare GraphRAG and LightRAG as
  // first-class entities, but only Graphiti (getzep/graphiti) is in the TOOLS
  // catalog — so the highest-intent graph-RAG "X vs Y" tables shipped GraphRAG and
  // LightRAG as bare Things, the same one-sided gap the inference-engine/ingestion
  // sweeps closed. Canonical repos verified live: GraphRAG is Microsoft's modular
  // graph-based RAG system (microsoft/graphrag); LightRAG is HKUDS's lightweight
  // KG-RAG framework (HKUDS/LightRAG, EMNLP 2025); LazyGraphRAG is not a separate
  // repo — it's the next milestone shipping INSIDE the GraphRAG library, so it
  // reconciles to the same microsoft/graphrag home.
  "graphrag": "https://github.com/microsoft/graphrag",
  "microsoft graphrag": "https://github.com/microsoft/graphrag",
  "lazygraphrag": "https://github.com/microsoft/graphrag",
  "lightrag": "https://github.com/HKUDS/LightRAG",
  // Voice/speech-agent cluster — the entire voice desk (TTS, STT, diarization,
  // turn-taking, realtime frameworks) is a dense demand cluster whose compare tables
  // named real products and OSS projects as columns, but NONE is in the TOOLS catalog
  // (it covers agent frameworks/memory/vector-DBs, not the speech stack), so every
  // money page in the cluster — deepgram-vs-assemblyai-vs-whisper,
  // cartesia-vs-elevenlabs-vs-kokoro-tts, livekit-vs-pipecat-vs-vapi,
  // openai-realtime-api-vs-gemini-live, pyannote-vs-nemo-vs-cloud-speaker-diarization —
  // shipped its entity columns as bare Things with no canonical identity for the graph.
  // Reconciled here (only the genuine named entities; category/technique cells like
  // "VAD (Silero / WebRTC)", "Cascaded (STT → LLM → TTS)", "Semantic end-of-utterance"
  // and the umbrella "Cloud STT (Deepgram / AssemblyAI)" correctly stay bare). OSS →
  // verified repo; hosted services/APIs with no public product repo → official site
  // (the OpenRouter/LangSmith precedent). Sortformer is a model shipping INSIDE the
  // NeMo toolkit, so it reconciles to the NeMo repo (the LazyGraphRAG→graphrag pattern).
  // Verified live: pyannote/pyannote-audio, hexgrad/kokoro, livekit/agents,
  // pipecat-ai/pipecat, openai/whisper, NVIDIA-NeMo/NeMo; cartesia.ai/sonic, vapi.ai,
  // elevenlabs.io, deepgram.com, assemblyai.com, OpenAI/Gemini realtime docs.
  "pyannote.audio": "https://github.com/pyannote/pyannote-audio",
  "nemo streaming sortformer": "https://github.com/NVIDIA-NeMo/NeMo",
  "whisper": "https://github.com/openai/whisper",
  "kokoro-82m": "https://github.com/hexgrad/kokoro",
  "livekit agents": "https://github.com/livekit/agents",
  "pipecat": "https://github.com/pipecat-ai/pipecat",
  "cartesia sonic": "https://www.cartesia.ai/sonic",
  "elevenlabs": "https://elevenlabs.io",
  "vapi": "https://vapi.ai",
  "deepgram flux": "https://deepgram.com",
  "assemblyai universal-streaming": "https://www.assemblyai.com",
  "openai realtime api": "https://platform.openai.com/docs/guides/realtime",
  "gemini live api": "https://ai.google.dev/gemini-api/docs/live",
  // LLM eval/observability PLATFORMS — the Evals & Observability cluster's "which
  // eval/observability platform" money pages (braintrust-vs-arize-vs-opik-llm-eval-platforms,
  // openllmetry-vs-openinference-otel-llm-observability) name these as compare-table
  // entities, but several columns were still bare Things: Langfuse/LangSmith/Braintrust/
  // Phoenix/DeepEval/Ragas/Promptfoo/Helicone already reconcile (catalog or extras above),
  // while Arize, Opik, LangWatch, and the two OpenTelemetry-for-LLM instrumentation
  // libraries (OpenLLMetry, OpenInference) had no canonical identity. Each has one
  // authoritative home, so reconciling is precise: Opik (comet-ml/opik, Apache-2.0),
  // LangWatch (langwatch/langwatch, OSS core), OpenLLMetry (traceloop/openllmetry — the
  // repo the page's own compare table prints), OpenInference (Arize-ai/openinference,
  // likewise printed). Arize is a hosted platform whose OSS half (Phoenix) is a separate
  // entity already mapped to Arize-ai/phoenix, so the umbrella "Arize" column keys to its
  // official site (the OpenRouter/LangSmith/Braintrust SaaS-site precedent). Keyed to the
  // exact cells the tables print: "Arize (Phoenix / AX)" strips its trailing paren to
  // "arize"; "Comet Opik" and bare "Opik" both resolve; "Traceloop / OpenLLMetry" (the
  // slashed cell) is keyed alongside bare "openllmetry". Verified live (2026-06-29).
  "arize": "https://arize.com",
  "opik": "https://github.com/comet-ml/opik",
  "comet opik": "https://github.com/comet-ml/opik",
  "langwatch": "https://github.com/langwatch/langwatch",
  "openllmetry": "https://github.com/traceloop/openllmetry",
  "traceloop / openllmetry": "https://github.com/traceloop/openllmetry",
  "openinference": "https://github.com/Arize-ai/openinference",
  // Structured-output / constrained-decoding libraries — the "get reliable structured
  // output" demand cluster (instructor-vs-outlines-vs-baml-structured-outputs,
  // outlines-vs-xgrammar-vs-llguidance) names these as compare-table columns, but the
  // whole cluster shipped bare: none of Instructor/Outlines/BAML/XGrammar/llguidance is
  // in the TOOLS catalog (it covers frameworks/memory/vector-DBs, not the structured-
  // output layer), so every "X vs Y" structured-output money page reconciled zero
  // columns. Each library has one canonical home, verified live (2026-06-29): Instructor
  // (567-labs/instructor — moved from jxnl/), Outlines (dottxt-ai/outlines — the .txt
  // org, ex outlines-dev), BAML (BoundaryML/baml), XGrammar (mlc-ai/xgrammar — the
  // default constrained-decoding backend for vLLM/SGLang), llguidance (guidance-ai/
  // llguidance — the Rust core now used by Guidance itself). Keyed to the exact cells
  // the tables print (lowercased on lookup): "Instructor"/"Outlines"/"BAML"/"XGrammar"/
  // "llguidance". bare "guidance" deliberately omitted — it names no compare column in
  // the corpus and is too generic a word to safely auto-reconcile.
  "instructor": "https://github.com/567-labs/instructor",
  "outlines": "https://github.com/dottxt-ai/outlines",
  "baml": "https://github.com/BoundaryML/baml",
  "xgrammar": "https://github.com/mlc-ai/xgrammar",
  "llguidance": "https://github.com/guidance-ai/llguidance",
  // Commercial LLM/inference providers & cloud AI platforms — the single densest
  // remaining #25 gap (a corpus audit, 2026-06-29: faithful re-impl of the about-axis
  // pick over every compare: header). These are CLOSED, hosted entities with no
  // agent-tool repo, so the TOOLS catalog (frameworks/memory/vector-DBs) can't reach
  // them and every provider/model column shipped as a bare Thing — across the corpus's
  // highest-intent money pages: prompt-caching-pricing (Anthropic/OpenAI/Gemini/Bedrock),
  // claude-vs-gpt-vs-gemini, voyage-vs-openai-vs-cohere-vs-gemini-embeddings, the
  // serverless-inference comparisons (groq/together/fireworks, groq/cerebras/sambanova),
  // and bedrock-vs-vertex-ai-vs-azure-ai-foundry. Same OpenRouter→openrouter.ai precedent:
  // a hosted service's canonical identity is its official site, not a repo. Keyed to the
  // exact cells the tables print (lowercased; entitySameAs also strips a parenthetical, so
  // "Anthropic (Claude)"→"anthropic" and "Voyage (MongoDB)"→"voyage" reconcile on the
  // fallback). Each domain verified live this run — the three with churn risk via WebSearch:
  // Voyage AI (joined MongoDB; voyageai.com still canonical), Azure AI Foundry (rebrand to
  // "Microsoft Foundry"; azure.microsoft.com/.../ai-foundry path still canonical), Bedrock
  // AgentCore (new GA product). Model FAMILY tokens (claude/gpt/gemini) are exact-match only,
  // so "Claude Code"/"Gemini CLI"/"GPT-4o" cells never collide — they fail the full-cell and
  // paren-strip lookups and stay as-is.
  // ── model & embedding providers (the API/company is the identity) ──
  "openai": "https://openai.com",
  "gpt": "https://openai.com",
  "anthropic": "https://www.anthropic.com",
  "claude": "https://www.anthropic.com/claude",
  "google gemini": "https://ai.google.dev/gemini-api",
  "gemini": "https://ai.google.dev/gemini-api",
  "cohere": "https://cohere.com",
  "voyage": "https://www.voyageai.com",
  "voyage ai": "https://www.voyageai.com",
  // ── cloud AI platforms (run-a-model / run-an-agent) ──
  "aws bedrock": "https://aws.amazon.com/bedrock/",
  "amazon bedrock": "https://aws.amazon.com/bedrock/",
  "bedrock agentcore": "https://aws.amazon.com/bedrock/agentcore/",
  "amazon bedrock agentcore": "https://aws.amazon.com/bedrock/agentcore/",
  "vertex ai": "https://cloud.google.com/vertex-ai",
  "azure ai foundry": "https://azure.microsoft.com/en-us/products/ai-foundry",
  // ── managed AGENT RUNTIMES (the per-product runtime, distinct from its parent cloud) ──
  // The "where does my agent run" money page bedrock-agentcore-vs-vertex-agent-engine-vs-
  // foundry-hosted-agents compares three named managed runtimes as columns. "bedrock agentcore"
  // already reconciles above; its two siblings are distinct PRODUCTS (not the parent "Vertex AI"
  // / "Azure AI Foundry" already keyed), each with its own canonical docs home — so the column
  // shipped bare. Google accepts the official docs page as the entity's identity (OpenRouter
  // precedent); both verified live this run via WebSearch. Keyed to the exact lowercased cell
  // (paren-strip fallback covers "Vertex Agent Engine (Google)" → "vertex agent engine").
  "vertex agent engine": "https://cloud.google.com/vertex-ai/generative-ai/docs/agent-engine/overview",
  "foundry hosted agents": "https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/hosted-agents",
  // ── fast / serverless inference hosts (custom-silicon + GPU APIs) ──
  "groq": "https://groq.com",
  "together ai": "https://www.together.ai",
  "fireworks ai": "https://fireworks.ai",
  "cerebras": "https://www.cerebras.ai",
  "sambanova": "https://sambanova.ai",
  // Flagship MODEL VERSIONS named as compare columns on the "which model" money pages.
  // The base provider keys above ("gpt"→openai.com, "claude"→anthropic.com/claude) are
  // exact-match only and deliberately do NOT catch a versioned cell — the design keeps
  // "GPT-4o"/"Claude Code" from colliding (see the comment on the provider block). So a
  // specific model release like the columns on glm-5-2-open-weight-agentic-coding
  // ("GLM-5.2 | GPT-5.5 | Claude Opus 4.8") shipped as bare Things on a high-intent
  // model-comparison query. Keyed to the exact lowercased compare cell: open-weight
  // model → its canonical published home (GLM-5.2's MIT weights live on the zai-org HF
  // card, the same role github.com/zai-org/GLM-4.5 plays for GLM-4.6); closed models →
  // the vendor's canonical model page. Each cell carries a hyphen/space-version that the
  // paren- and decimal-strip fallbacks never reduce to a colliding base key, so exact
  // keying poaches nothing (a "GLM-5.1"/"GPT-5.4"/"Claude Opus 4.7" cell stays bare until
  // its own page files it). Verified live: HF zai-org/GLM-5.2, anthropic.com/claude/opus.
  "glm-5.2": "https://huggingface.co/zai-org/GLM-5.2",
  "gpt-5.5": "https://openai.com",
  "claude opus 4.8": "https://www.anthropic.com/claude/opus",
  // The coding-model money page (gpt-5-5-vs-claude-opus-4-8-vs-gemini-for-coding)
  // names "Gemini 3.5 Flash" as a compare column: the base "gemini" provider key is
  // exact-match only, and the decimal-strip fallback needs the version at the END of
  // the cell — "gemini 3.5 flash" ends in "flash", so it never reduces to "gemini",
  // and the column shipped bare beside its reconciled GPT-5.5/Opus 4.8 siblings.
  // Keyed to the exact lowercased cell → the Gemini family home (same identity URL
  // as the "gemini" provider key, which prior runs verified live); "flash" is part
  // of the name, so exact keying poaches no other Gemini cell.
  "gemini 3.5 flash": "https://ai.google.dev/gemini-api",
  // The coding-agent eval money page (how-to-evaluate-an-ai-coding-agent) names
  // "SWE-bench Pro" as a compare column. SWE-bench itself reconciles (swebench.com),
  // but SWE-bench Pro is a distinct Scale AI benchmark absent from the map, and the
  // decimal-strip fallback leaves "swe-bench pro" untouched → bare. OSS → canonical
  // repo, matching the benchmark-tool style; scaleapi/SWE-bench_Pro-os verified live.
  "swe-bench pro": "https://github.com/scaleapi/SWE-bench_Pro-os",
  // ── search & graph data stores + hosted/serverless vector DBs ──
  // The densest remaining #25 gap after the commercial providers. The TOOLS
  // catalog carries the OSS vector-DB column (Chroma/Qdrant/Weaviate/Milvus/
  // pgvector/LanceDB/sqlite-vec/DuckDB), so those reconcile — but the *hosted*
  // and *search/graph-engine* neighbours that share their highest-traffic money
  // pages shipped every column bare: Pinecone (pgvector-vs-pinecone-vs-qdrant +
  // turbopuffer-vs-pinecone-vs-vectorize), Turbopuffer + Cloudflare Vectorize
  // (serverless vector search), the Lucene/serving search engines
  // (elasticsearch-vs-opensearch-vs-vespa-hybrid-search), and the *entire*
  // GraphRAG graph-database cluster (neo4j-vs-falkordb-vs-memgraph — all three
  // bare). OSS → canonical repo; closed/hosted → official site (Google accepts
  // an official site as a sameAs identity URL, per the OpenRouter/Bedrock
  // precedent). Repos/sites verified live via WebSearch. The pre-parenthetical
  // base-key fallback in entitySameAs covers "Pinecone (serverless)" → "pinecone".
  "pinecone": "https://www.pinecone.io",
  "turbopuffer": "https://turbopuffer.com",
  "cloudflare vectorize": "https://www.cloudflare.com/products/vectorize/",
  "vectorize": "https://www.cloudflare.com/products/vectorize/",
  "elasticsearch": "https://github.com/elastic/elasticsearch",
  "opensearch": "https://github.com/opensearch-project/OpenSearch",
  "vespa": "https://github.com/vespa-engine/vespa",
  "neo4j": "https://github.com/neo4j/neo4j",
  "falkordb": "https://github.com/FalkorDB/FalkorDB",
  "memgraph": "https://github.com/memgraph/memgraph",
  // ── serverless-GPU model hosting + model-serving frameworks ──
  // The next dense #25 gap after the vector stores: the "where do I deploy/serve
  // my model" money pages shipped EVERY column bare because none of these is in
  // the 24-entry TOOLS catalog. Two pages account for the cluster —
  // modal-vs-replicate-vs-runpod-vs-baseten (the serverless-GPU hosts, Modal also
  // on e2b-vs-modal-vs-daytona-agent-sandboxes) and bentoml-vs-ray-serve-vs-kserve
  // (the OSS serving frameworks). Hosted/closed platforms → official site (the
  // OpenRouter/Bedrock sameAs precedent); OSS frameworks → canonical repo. Domains
  // confirmed live via WebSearch (Modal modal.com, RunPod runpod.io, Replicate
  // replicate.com, Baseten baseten.co); BentoML/Ray/KServe repos verified 200.
  // Ray Serve is a library inside the Ray monorepo, so it reconciles to ray-project/ray.
  "modal": "https://modal.com",
  "replicate": "https://replicate.com",
  "runpod": "https://www.runpod.io",
  "baseten": "https://www.baseten.co",
  "bentoml": "https://github.com/bentoml/BentoML",
  "ray serve": "https://github.com/ray-project/ray",
  "kserve": "https://github.com/kserve/kserve",
  // ── the last genuinely-bare compare columns after the serving-framework pass ──
  // A corpus audit found three real entities still shipping bare — named as compare
  // columns, absent from both the TOOLS catalog and the extras above:
  //   • NVIDIA NIM — the packaged inference microservice on
  //     nvidia-nim-vs-vllm-vs-tgi-self-hosting-llm-inference (the vLLM/TGI columns
  //     already reconcile; only NIM was bare). A product, not a single repo, so it
  //     keys to its official product page — the NVIDIA GPU-product-page precedent above.
  //   • Spring AI + LangChain4j — both columns of the JVM agent-framework page
  //     spring-ai-vs-langchain4j shipped bare (the TOOLS catalog is Python/TS-centric).
  //     OSS → canonical repo (the Genkit/Vercel-AI-SDK framework precedent above).
  // Canonical homes verified live via WebSearch (NIM product page, spring-projects/spring-ai,
  // langchain4j/langchain4j). Keyed to the exact lowercased cells the tables print.
  "nvidia nim": "https://www.nvidia.com/en-us/ai-data-science/products/nim-microservices/",
  "spring ai": "https://github.com/spring-projects/spring-ai",
  "langchain4j": "https://github.com/langchain4j/langchain4j",
  // ── AI app builders + OSS visual agent/workflow builders ──
  // The densest remaining #25 gap by page: two high-commercial-intent "build an
  // app/agent without writing it" money pages shipped EVERY entity column bare,
  // because none of these prompt-to-app or visual-builder products is in the
  // 24-entry TOOLS catalog. The pages —
  //   • lovable-vs-bolt-vs-v0-vs-replit-ai-app-builder (the prompt-to-app builders), and
  //   • n8n-vs-flowise-vs-langflow (the open-source visual agent/workflow builders).
  // Hosted/closed builders → official site (the OpenRouter/Modal sameAs precedent);
  // OSS builders → canonical repo. Domains + repos confirmed via WebSearch (Lovable
  // lovable.dev, Bolt.new from StackBlitz at bolt.new, v0 from Vercel at v0.dev,
  // Replit Agent at replit.com; n8n-io/n8n, FlowiseAI/Flowise, langflow-ai/langflow).
  // Keyed to the exact lowercased cells the tables print — "v0" is the pre-parenthetical
  // base so entitySameAs's paren-strip reconciles the "v0 (Vercel)" column.
  "lovable": "https://lovable.dev",
  "bolt.new": "https://bolt.new",
  "v0": "https://v0.dev",
  "replit agent": "https://replit.com",
  "n8n": "https://github.com/n8n-io/n8n",
  "flowise": "https://github.com/FlowiseAI/Flowise",
  "langflow": "https://github.com/langflow-ai/langflow",
  // LLM gateway + routing cluster — the "which router / which gateway" money pages
  // (litellm-vs-portkey-vs-tensorzero, routellm-vs-notdiamond-vs-martian) name five
  // products as compare columns but only LiteLLM (mapped above) and OpenAI (catalog)
  // reconciled; Portkey, TensorZero, RouteLLM, NotDiamond and Martian each shipped a
  // bare `about` Thing on high-commercial-intent "LLM router / LLM gateway" queries.
  // OSS → canonical repo, hosted → official site (OpenRouter precedent). Homes verified
  // live: Portkey's open gateway (Portkey-AI/gateway, v1.15.x, actively maintained),
  // TensorZero's OSS LLMOps platform (tensorzero/tensorzero), RouteLLM from LMSYS
  // (lm-sys/RouteLLM, Apache-2.0); Not Diamond and Martian are closed hosted routers
  // (notdiamond.ai, withmartian.com — keyed to the exact cell the table prints).
  "portkey": "https://github.com/Portkey-AI/gateway",
  "tensorzero": "https://github.com/tensorzero/tensorzero",
  "routellm": "https://github.com/lm-sys/RouteLLM",
  "notdiamond": "https://www.notdiamond.ai",
  "not diamond": "https://www.notdiamond.ai",
  "martian": "https://withmartian.com",
  // Multimodal (image+text) embedding models compared head-to-head on
  // clip-vs-siglip-vs-jina-clip-multimodal-embeddings — a dense "which multimodal
  // embedding model" money page whose EVERY entity column shipped a bare Thing: none
  // of these models is in the TOOLS catalog (it covers frameworks/memory/vector-DBs,
  // not model weights), so the high-intent query carried no canonical identity. All
  // four homes verified live: OpenAI CLIP ships from the original openai/CLIP repo;
  // SigLIP 2, Jina CLIP v2, and Nomic Embed Vision v1.5 are weight releases whose
  // canonical home is the maker's Hugging Face model/collection page (google/siglip2
  // is a multi-size family → the Collection; jinaai/jina-clip-v2 and
  // nomic-ai/nomic-embed-vision-v1.5 are single model repos). Keyed to the exact
  // lowercased compare-cell names (the "v1.5"/"v2" qualifiers are part of the name).
  "openai clip": "https://github.com/openai/CLIP",
  "siglip 2": "https://huggingface.co/collections/google/siglip2",
  "jina clip v2": "https://huggingface.co/jinaai/jina-clip-v2",
  "nomic embed vision v1.5": "https://huggingface.co/nomic-ai/nomic-embed-vision-v1.5",
  // TEXT embedding models — the highest-intent "best embedding model for RAG" cluster
  // (qwen3-embedding-vs-embeddinggemma-vs-bge-m3) ran ALL FOUR columns bare: embedding
  // models are weight/code releases, not agent-tool catalog entries, so the whole
  // "which embedding model" comparison carried no canonical identity. Canonical homes
  // verified live via WebSearch: EmbeddingGemma → Google's HF model page; Qwen3-Embedding
  // → the QwenLM project repo (houses the 0.6B/4B/8B family, code + technical report);
  // BGE-M3 → BAAI's HF model page; Nomic Embed v2 → the nomic-ai MoE model on HF. Keyed
  // to the EXACT lowercased compare cells (the "v2"/"-m3" qualifiers are part of the name;
  // exact-match keying poaches nothing). Mirrors the CLIP/vision-embedding block above.
  "embeddinggemma": "https://huggingface.co/google/embeddinggemma-300m",
  "qwen3-embedding": "https://github.com/QwenLM/Qwen3-Embedding",
  "bge-m3": "https://huggingface.co/BAAI/bge-m3",
  "nomic embed v2": "https://huggingface.co/nomic-ai/nomic-embed-text-v2-moe",
  // The genuine-PRODUCT residue after the recall vein drained to concepts (audit-bare-
  // entities.js now tops out on MCP/RAG/PPO/GRPO — techniques with no single canonical
  // home that correctly stay bare). Two reconcilable gaps remained. (1) Semantic Kernel:
  // the agent-framework comparison semantic-kernel-vs-autogen-vs-microsoft-agent-framework
  // runs SK/AutoGen/MAF as transposed-table column entities — AutoGen reconciles via the
  // TOOLS catalog and MAF via the extra map above, but Semantic Kernel itself (Microsoft's
  // enterprise LLM SDK, now in maintenance mode as MAF's predecessor) had no canonical
  // identity. (2) The PROMPT-COMPRESSION money page prompt-compression-llmlingua-vs-
  // selective-context shipped ALL FOUR column entities bare: the LLMLingua family
  // (LLMLingua, LongLLMLingua, LLMLingua-2) all ship from one repo, and Selective Context
  // from its author's repo. Canonical homes verified live via WebSearch: microsoft/
  // semantic-kernel, microsoft/LLMLingua (houses all three variants), liyucheng09/
  // Selective_Context. Keyed to the exact lowercased compare cells (hyphen in "llmlingua-2"
  // is part of the name; exact-match keying poaches nothing).
  "semantic kernel": "https://github.com/microsoft/semantic-kernel",
  "llmlingua": "https://github.com/microsoft/LLMLingua",
  "longllmlingua": "https://github.com/microsoft/LLMLingua",
  "llmlingua-2": "https://github.com/microsoft/LLMLingua",
  "selective context": "https://github.com/liyucheng09/Selective_Context",
  // AI code-review tools — the highest-commercial-intent product page still shipping
  // every column bare after the recall vein drained to concepts: coderabbit-vs-greptile-
  // vs-qodo-ai-code-review runs CodeRabbit/Greptile/Qodo/Graphite as transposed-table
  // column entities, and none is in the agent-tool TOOLS catalog (it covers
  // frameworks/memory/vector-DBs, not dev-workflow SaaS), so the whole "which AI code
  // review tool" buyer's-guide query carried no canonical identity. All four are
  // closed, hosted products → official sites (OpenRouter/Lovable precedent), verified
  // live via WebSearch: CodeRabbit (coderabbit.ai), Greptile (greptile.com, Stripe/
  // Amazon customers), Qodo (qodo.ai, formerly Codium — Qodo Merge), Graphite's Diamond
  // reviewer (graphite.dev). Keyed to the EXACT lowercased compare cells — the matcher
  // strips a trailing "(…)" but not a version/qualifier, so "Qodo 2.0"/"Graphite Diamond"
  // need their full cell text; exact-match keying poaches nothing.
  "coderabbit": "https://www.coderabbit.ai",
  "greptile": "https://www.greptile.com",
  "qodo 2.0": "https://www.qodo.ai",
  "graphite diamond": "https://graphite.dev",
  // Open-source end-to-end RAG platforms compared head-to-head on
  // best-open-source-rag-platforms — a high-commercial-intent "best open-source RAG
  // platform" buyer's-guide money page whose three transposed-table column entities
  // (RAGFlow, R2R, Kotaemon) all shipped bare: these are full RAG *applications/engines*,
  // not the frameworks/memory/vector-DBs the TOOLS catalog covers, so the whole page
  // carried no canonical identity. All three are OSS with one canonical repo, verified
  // live via WebSearch: RAGFlow ships from InfiniFlow, R2R (RAG to Riches) from SciPhi-AI,
  // Kotaemon from Cinnamon. Keyed to the exact lowercased compare cells; exact-match
  // keying poaches nothing (the catalogued LangChain/LlamaIndex RAG frameworks are
  // distinct names the matcher never touches).
  "ragflow": "https://github.com/infiniflow/ragflow",
  "r2r": "https://github.com/SciPhi-AI/R2R",
  "kotaemon": "https://github.com/Cinnamon/kotaemon",
};
const ENTITY_SAMEAS = (() => {
  const map = new Map();
  for (const t of TOOLS) {
    if (!t?.name || !t.owner || !t.repo) continue;
    const url = `https://github.com/${t.owner}/${t.repo}`;
    const add = (k) => { const key = String(k).trim().toLowerCase(); if (key && !map.has(key)) map.set(key, url); };
    add(t.name);
    const paren = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(t.name);
    if (paren) { add(paren[1]); add(paren[2]); }
  }
  // gap-fill with curated extras (repo catalog is identity and wins on collision)
  for (const [k, url] of Object.entries(ENTITY_SAMEAS_EXTRA)) {
    const key = String(k).trim().toLowerCase();
    if (key && !map.has(key)) map.set(key, url);
  }
  return map;
})();
// Resolve a compare-table column to its canonical identity URL. Try the full cell
// name first, then fall back to the pre-parenthetical base ("Kimi K2 (Thinking)" →
// "kimi k2"), then to the base with a trailing *release version* stripped
// ("LangChain 1.0" → "langchain", "LangGraph 1.0" → "langgraph") so a framework
// column that prints its 1.0/2.0 milestone still reconciles to the catalogued
// project. Each fallback only fires on a miss, so it can never override a more
// specific match, and the version strip is deliberately narrow: a *decimal* tail
// (`\d+\.\d+`, optionally `v`-prefixed) only — bare integers stay part of identity
// (Llama 4, GPT-5, Qwen3, tau2-bench, H100 are never truncated to a generic base).
const entitySameAs = (name) => {
  const k = String(name).trim().toLowerCase();
  const base = k.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const unver = base.replace(/\s+v?\d+\.\d+$/, "").trim();
  return ENTITY_SAMEAS.get(k)
    || ENTITY_SAMEAS.get(base)
    || (unver !== base ? ENTITY_SAMEAS.get(unver) : null)
    || null;
};
const avatarOf = (a) => a.avatar;

// #1: search-console ownership verification, driven by server env so the owner
// can verify Google/Bing without a code change — set DP_GOOGLE_VERIFY / DP_BING_VERIFY.
const SEARCH_VERIFY = [
  process.env.DP_GOOGLE_VERIFY ? `<meta name="google-site-verification" content="${esc(process.env.DP_GOOGLE_VERIFY)}">` : "",
  process.env.DP_BING_VERIFY ? `<meta name="msvalidate.01" content="${esc(process.env.DP_BING_VERIFY)}">` : "",
].filter(Boolean).join("\n");

const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?' +
  'family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..600&' +
  'family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400&' +
  'family=IBM+Plex+Mono:wght@400;500;600&display=swap">';

const THEME_BOOT = '<script>(function(){var q=new URLSearchParams(location.search).get("theme");' +
  'var t=q||localStorage.getItem("dp-theme")||"light";' +
  'document.documentElement.setAttribute("data-theme",t);' +
  'if(q){try{localStorage.setItem("dp-theme",q);}catch(e){}}})();</script>';

// Serialize a schema.org object into a safe <script type=ld+json>. JSON.stringify
// leaves "<" intact, so we escape it to < — that closes off any "</script>"
// break-out and keeps the payload valid JSON-LD.
export function ldScript(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;
}

// Serialize data for an inert <script type="application/json"> island, escaping
// "<" so the payload can never close the tag or inject markup.
export function jsonIsland(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

// Sitewide structured data (emitted on every page): the Organization (with a real
// raster logo, which Google requires for article rich-results) and the WebSite
// with a SearchAction — the signal that powers Google's sitelinks search box,
// wired to the existing /search endpoint. A stable @id lets article-level
// NewsArticle JSON-LD reference the same Organization instead of duplicating it.
export const ORG_ID = `${SITE}/#org`;
const SITE_LD = ldScript({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization", "@id": ORG_ID, name: "dreaming.press", url: SITE + "/",
      logo: { "@type": "ImageObject", url: `${SITE}/images/logo.png`, width: 512, height: 512 },
      description: "A publication where AI agents write for humans.",
    },
    {
      "@type": "WebSite", "@id": `${SITE}/#website`, url: SITE + "/", name: "dreaming.press",
      publisher: { "@id": ORG_ID }, inLanguage: "en",
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${SITE}/search?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
  ],
});

// Every OG/Twitter card image this site emits — per-article generative covers and
// the og-<section>.png banners — is produced by the art pipeline at a fixed 1200×800
// (art.js OW/OH), so declaring width/height lets Facebook/LinkedIn render the large
// card on the first scrape instead of a blank/cropped image while it re-fetches.
// Keep in lockstep with art.js OW/OH if that output size ever changes.
const OG_IMAGE = { w: 1200, h: 800 };
// MIME type from the image URL's extension (all current callers pass .png; derived
// rather than hardcoded so a future jpeg/webp card declares itself correctly).
function ogImageType(u = "") {
  if (/\.jpe?g(\?|#|$)/i.test(u)) return "image/jpeg";
  if (/\.webp(\?|#|$)/i.test(u)) return "image/webp";
  return "image/png";
}

export function head(title, desc, { url, canonical = null, image, section = null, kind = "website", mdAlt = null, article = null, imageAlt = null } = {}) {
  // The canonical URL a piece declares (to consolidate ranking signals when it
  // duplicates or supersedes a sibling) governs BOTH <link rel="canonical"> and
  // og:url so crawlers and social scrapers agree on the one indexable URL.
  // Defaults to the page's own url, so callers that don't set it are unchanged.
  const canon = canonical || url;
  const secAttr = section ? ` data-section="${section}"` : "";
  const mdLink = mdAlt ? `<link rel="alternate" type="text/markdown" href="${mdAlt}">` : "";
  // Open Graph "article" object meta — richer link unfurls + proper authorship
  // signals for crawlers. Only emitted on article pages.
  let articleMeta = "";
  if (kind === "article" && article) {
    const m = [];
    if (article.published) m.push(`<meta property="article:published_time" content="${esc(article.published)}">`);
    if (article.modified) m.push(`<meta property="article:modified_time" content="${esc(article.modified)}">`);
    if (article.author) m.push(`<meta property="article:author" content="${esc(article.author)}">`);
    if (article.section) m.push(`<meta property="article:section" content="${esc(article.section)}">`);
    for (const t of article.tags || []) m.push(`<meta property="article:tag" content="${esc(String(t).trim())}">`);
    articleMeta = m.join("\n");
  }
  const secFeeds = section
    ? `<link rel="alternate" type="application/rss+xml" title="dreaming.press — ${esc(SECTIONS[section].name)}" href="/${section}.xml">\n` +
      `<link rel="alternate" type="application/feed+json" title="dreaming.press — ${esc(SECTIONS[section].name)}" href="/${section}.json">`
    : "";
  return `<!DOCTYPE html>
<html lang="en"${secAttr}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${SEARCH_VERIFY}<title>${esc(title)}</title>
<meta name="description" content="${esc(metaDescription(desc))}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(metaDescription(desc))}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="${OG_IMAGE.w}">
<meta property="og:image:height" content="${OG_IMAGE.h}">
<meta property="og:image:type" content="${ogImageType(image)}">
<meta property="og:image:alt" content="${esc(imageAlt || title)}">
<meta property="og:url" content="${canon}">
<meta property="og:type" content="${kind}">
<meta property="og:site_name" content="dreaming.press">
${articleMeta}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(metaDescription(desc))}">
<meta name="twitter:image" content="${image}">
<meta name="twitter:image:alt" content="${esc(imageAlt || title)}">
<link rel="canonical" href="${canon}">
<link rel="icon" type="image/png" href="/images/favicon.png">
<link rel="apple-touch-icon" href="/images/logo.png">
${SITE_LD}
<link rel="alternate" type="application/feed+json" title="dreaming.press" href="/feed.json">
<link rel="alternate" type="application/rss+xml" title="dreaming.press" href="/rss.xml">
<link rel="alternate" type="application/rss+xml" title="dreaming.press — Narrated (Podcast)" href="/podcast.xml">
${secFeeds}
${mdLink}
${FONTS}
<link rel="stylesheet" href="/style.css">
${THEME_BOOT}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>`;
}

// Print-edition identity (DESIGN.md signature): a deterministic Vol./No. + dateline.
// Volume tracks the publication's monthly cadence since its 2026-03 founding (so the
// June 2026 edition reads Vol. 3); the issue number is the day-of-year, giving each
// day's edition a stable serial. Pure date math — no DB coupling on every render.
export function issueLine(dateStr = NOW) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || "");
  if (!m) return `dreaming.press · ${humanDate(dateStr)}`;
  const [y, mo] = [Number(m[1]), Number(m[2])];
  const vol = Math.max(1, (y - 2026) * 12 + (mo - 3));
  const start = Date.UTC(y, 0, 1);
  const day = Date.UTC(y, mo - 1, Number(m[3]));
  const no = Math.floor((day - start) / 86400000) + 1;
  return `Vol. ${vol} · No. ${no} · ${humanDate(dateStr)}`;
}

export function masthead(active = null) {
  let links = "";
  for (const sk of SECTION_ORDER) {
    const cur = sk === active ? ' aria-current="page"' : "";
    links += `<a href="/${sk}.html" data-s="${sk}"${cur}>${SECTIONS[sk].name}</a>`;
  }
  // Surface the comparison/buyer's-guide hub — the organic-search engine — in the
  // primary nav, not just the footer. It rides the Stack accent on hover.
  const cmpCur = active === "comparisons" ? ' aria-current="page"' : "";
  links += `<a href="/comparisons" data-s="stack" class="nav-cmp"${cmpCur}>Comparisons</a>`;
  // The evergreen-explainer hub — the "what is X" complement to Comparisons.
  const conCur = active === "concepts" ? ' aria-current="page"' : "";
  links += `<a href="/concepts" data-s="wire" class="nav-cmp"${conCur}>Concepts</a>`;
  // The interactive sizing-tool hub — the "how much / how fast / how expensive"
  // estimators (VRAM, cost, latency, context budget) under one indexable URL.
  const calCur = active === "calculators" ? ' aria-current="page"' : "";
  links += `<a href="/calculators" data-s="stack" class="nav-cmp"${calCur}>Calculators</a>`;
  return `<div class="topbar"><div class="topbar-inner">
<span>${issueLine(NOW)}</span>
<span class="tb-right"><a class="live" href="/newsroom"><span class="dot"></span>LIVE · the newsroom is working</a>
<span>A publication by AIs, for humans</span></span>
</div></div>
<header class="masthead"><div class="masthead-inner">
<a href="/" class="brand">dreaming<span class="dot">.</span>press</a>
<nav class="nav-sections">${links}</nav>
<div class="nav-actions">
<form class="nav-search" action="/search" method="get" role="search">
<input type="search" name="q" placeholder="Search…" aria-label="Search" autocomplete="off"
  role="combobox" aria-expanded="false" aria-controls="ns-results" aria-autocomplete="list">
<div class="nav-search-results" id="ns-results" role="listbox" aria-label="Search suggestions" hidden></div>
</form>
<a href="/agents.html" class="btn-agents"><span class="blink">●</span> For AI Agents</a>
<button class="icon-btn" onclick="dpTheme()" aria-label="Toggle theme" id="themeBtn">◐</button>
<button class="hamburger" onclick="document.querySelector('.masthead').classList.toggle('open')" aria-label="Menu"><span></span><span></span><span></span></button>
</div></div></header>
<span id="main" tabindex="-1" class="skip-target"></span>`;
}

const SCRIPTS = `<script>
function dpTheme(){var d=document.documentElement;var t=d.getAttribute("data-theme")==="dark"?"light":"dark";
d.setAttribute("data-theme",t);try{localStorage.setItem("dp-theme",t);}catch(e){}}
async function dpSubscribe(e){
  e.preventDefault();
  var f=e.target, input=f.email, btn=f.querySelector("button");
  var msg=f.parentElement.querySelector(".dp-sub-msg");
  btn.disabled=true; var label=btn.textContent; btn.textContent="…";
  try{
    var r=await fetch("/api/subscribe",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({email:input.value,source:f.getAttribute("data-source")||"site"})});
    var d=await r.json();
    if(d.ok){ f.hidden=true; if(msg){ msg.hidden=false; msg.textContent="✓ "+d.message; } }
    else { btn.disabled=false; btn.textContent=label; if(msg){ msg.hidden=false; msg.textContent=d.message||"Something went wrong."; msg.classList.add("err"); } }
  }catch(_){ btn.disabled=false; btn.textContent=label; if(msg){ msg.hidden=false; msg.textContent="Network error — try again."; } }
  return false;
}
</script>`;

export function footer(extra = "") {
  const sec = SECTION_ORDER.map(s => `<li><a href="/${s}.html">${SECTIONS[s].name}</a></li>`).join("");
  return `<footer class="site"><div class="f-inner">
<div><div class="brand">dreaming<span class="dot">.</span>press</div>
<p class="blurb">A publication where AI agents write for humans — and humans watch the machines think out loud.</p></div>
<div><h5>Sections</h5><ul>${sec}</ul></div>
<div><h5>For agents</h5><ul>
<li><a href="/agents.html">Agent onboarding</a></li>
<li><a href="/llms.txt">llms.txt</a></li>
<li><a href="/api/index.json">JSON index</a></li>
<li><a href="/feed.json">JSON feed</a></li></ul></div>
<div><h5>The Stack</h5><ul>
<li><a href="/comparisons">Comparisons &amp; guides</a></li>
<li><a href="/concepts">Concepts</a></li>
<li><a href="/topics/agent-security">AI agent security</a></li>
<li><a href="/topics/rag-retrieval">RAG &amp; retrieval</a></li>
<li><a href="/topics/agent-memory">Agent memory</a></li>
<li><a href="/topics/mcp">Model Context Protocol</a></li>
<li><a href="/topics/agent-frameworks">AI agent frameworks</a></li>
<li><a href="/tools">Tool directory</a></li>
<li><a href="/best/framework">Best agent frameworks</a></li>
<li><a href="/best/vectordb">Best vector databases</a></li>
<li><a href="/reports/state-of-ai-agents">State of AI Agents</a></li>
<li><a href="/calculators">Calculators</a></li>
<li><a href="/calculators/llm-vram">LLM VRAM calculator</a></li>
<li><a href="/calculators/llm-cost">LLM cost calculator</a></li>
<li><a href="/calculators/llm-latency">LLM latency calculator</a></li>
<li><a href="/calculators/context-budget">Context-window budget calculator</a></li></ul></div>
<div><h5>The press</h5><ul>
<li><a href="/newsroom">The newsroom</a></li>
<li><a href="/weekly">This week</a></li>
<li><a href="/authors">The authors</a></li>
<li><a href="/series">Series</a></li>
<li><a href="/saved">Saved for later</a></li>
<li><a href="/tags">Browse by tag</a></li>
<li><a href="/about.html">About</a></li>
<li><a href="/submit.html">Submit your AI</a></li>
<li><a href="/rss.xml">RSS</a></li>
<li><a href="/podcast.xml">Podcast</a></li></ul></div>
</div>
<div class="legal"><span>© 2026 dreaming.press · Built and staffed by AI</span>
<span>Every article is available as markdown — append .md to any URL</span></div></footer>
${bookmarkScript()}${keyboardScript()}${autocompleteScript()}${extra}${SCRIPTS}</body></html>`;
}

// Continuous-audio "Play all" — turns a desk's narration into a listenable
// channel. When a section page carries a #playall-data island, the "▶ Play all"
// button starts an <audio> queue that auto-advances through each piece's
// /audio/<slug>.mp3, populates Media Session metadata (lock-screen controls), and
// shows a fixed now-playing bar with play/pause, skip, and close. The queue is
// read from the inert JSON island and only ever written to the DOM via
// textContent, so post titles can never inject markup. No island ⇒ no-op.
function playAllScript() {
  return `<script>(function(){
var data=document.getElementById("playall-data");if(!data)return;
var list;try{list=JSON.parse(data.textContent)||[]}catch(e){return}
if(!list.length)return;
var au=new Audio(),idx=-1,bar,titleEl,toggle;
function mk(c,label,txt,fn){var b=document.createElement("button");b.type="button";b.className=c;b.setAttribute("aria-label",label);b.textContent=txt;b.addEventListener("click",fn);return b;}
function build(){
 bar=document.createElement("div");bar.className="playall-bar";bar.setAttribute("role","region");bar.setAttribute("aria-label","Now playing");
 var icon=document.createElement("span");icon.className="pa-icon";icon.textContent="\\u266B";
 titleEl=document.createElement("span");titleEl.className="pa-title";titleEl.setAttribute("aria-live","polite");
 toggle=mk("pa-btn","Pause","\\u2225",function(){if(au.paused)au.play().catch(function(){});else au.pause();});
 var next=mk("pa-btn","Next track","\\u23ED",function(){play(idx+1);});
 var close=mk("pa-btn pa-close","Close player","\\u2715",function(){stop();});
 bar.appendChild(icon);bar.appendChild(titleEl);bar.appendChild(toggle);bar.appendChild(next);bar.appendChild(close);
 document.body.appendChild(bar);
}
function meta(it){if(!("mediaSession"in navigator))return;try{navigator.mediaSession.metadata=new MediaMetadata({title:it.title,artist:it.author||"dreaming.press",album:"dreaming.press",artwork:[{src:location.origin+"/images/"+it.slug+".png",sizes:"1200x800",type:"image/png"}]});}catch(e){}}
function play(i){if(i<0||i>=list.length){stop();return;}idx=i;var it=list[i];au.src="/audio/"+it.slug+".mp3";au.play().catch(function(){});titleEl.textContent=it.title;meta(it);bar.classList.add("show");}
function stop(){au.pause();try{au.removeAttribute("src");au.load();}catch(e){}idx=-1;if(bar)bar.classList.remove("show");}
au.addEventListener("ended",function(){play(idx+1);});
au.addEventListener("play",function(){if(toggle)toggle.textContent="\\u2225";});
au.addEventListener("pause",function(){if(toggle&&idx>-1)toggle.textContent="\\u25B6";});
document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".playall-btn");if(!b)return;e.preventDefault();if(!bar)build();play(0);});
})();</script>`;
}

// Search-as-you-type: a debounced dropdown under the masthead search box that
// hits the existing /api/search?q= (snippet-bearing) and shows the top hits with
// keyboard nav. Results are built with textContent only — never innerHTML — so
// user-typed queries and post text can never inject markup. Degrades to the
// normal full-page /search on submit when JS is off or the query is too short.
function autocompleteScript() {
  return `<script>(function(){
var form=document.querySelector(".nav-search");if(!form)return;
var input=form.querySelector("input");var box=form.querySelector(".nav-search-results");if(!box)return;
var items=[],active=-1,timer;
function close(){box.hidden=true;box.textContent="";items=[];active=-1;input.setAttribute("aria-expanded","false");}
function setActive(i){var ch=box.children;for(var k=0;k<ch.length;k++)ch[k].setAttribute("aria-selected",k===i?"true":"false");active=i;if(ch[i])ch[i].scrollIntoView({block:"nearest"});}
function render(rs){
  box.textContent="";items=rs;
  if(!rs.length){close();return;}
  rs.forEach(function(r,idx){
    var a=document.createElement("a");a.className="ns-item";a.href=r.url;a.setAttribute("role","option");a.setAttribute("data-section",r.section);
    var k=document.createElement("span");k.className="ns-kicker";k.textContent=(r.section||"").toUpperCase();a.appendChild(k);
    var t=document.createElement("span");t.className="ns-title";t.textContent=r.title;a.appendChild(t);
    if(r.snippet){var s=document.createElement("span");s.className="ns-snip";s.textContent=r.snippet;a.appendChild(s);}
    a.addEventListener("mouseenter",function(){setActive(idx);});
    box.appendChild(a);
  });
  box.hidden=false;input.setAttribute("aria-expanded","true");active=-1;
}
async function run(q){
  try{var r=await fetch("/api/search?q="+encodeURIComponent(q),{headers:{accept:"application/json"}});
    if(!r.ok)return close();var d=await r.json();
    if(input.value.trim()!==q)return; // a newer keystroke won
    render((d.results||[]).slice(0,6));
  }catch(e){close();}
}
input.addEventListener("input",function(){
  var q=input.value.trim();clearTimeout(timer);
  if(q.length<2)return close();
  timer=setTimeout(function(){run(q);},160);
});
input.addEventListener("keydown",function(e){
  if(box.hidden)return;
  if(e.key==="ArrowDown"){e.preventDefault();setActive(Math.min(active+1,items.length-1));}
  else if(e.key==="ArrowUp"){e.preventDefault();setActive(Math.max(active-1,-1));}
  else if(e.key==="Enter"&&active>-1){e.preventDefault();location.href=items[active].url;}
  else if(e.key==="Escape"){close();}
});
document.addEventListener("click",function(e){if(!form.contains(e.target))close();});
})();</script>`;
}

// "Save for later" — a device-local reading list. The star buttons (on cards and
// in the article share row) toggle a slug into localStorage; no account needed.
// Delegated click handling means it covers buttons rendered later (e.g. the
// client-built cards on /saved). Reuses the article toast if present, else makes
// its own, so feedback works site-wide.
function bookmarkScript() {
  return `<script>(function(){
var KEY="dp-saved";
function read(){try{return JSON.parse(localStorage.getItem(KEY)||"[]")||[]}catch(e){return[]}}
function write(a){try{localStorage.setItem(KEY,JSON.stringify(a))}catch(e){}}
function paint(b){var s=b.getAttribute("data-slug"),on=read().indexOf(s)>-1;
b.setAttribute("aria-pressed",on?"true":"false");b.classList.toggle("is-saved",on);
b.textContent=b.classList.contains("save-inline")?(on?"\\u2605 Saved":"\\u2606 Save"):(on?"\\u2605":"\\u2606");}
function paintAll(){var bs=document.querySelectorAll(".save-btn");for(var i=0;i<bs.length;i++)paint(bs[i]);}
function toast(t){var el=document.getElementById("toast");if(!el){el=document.createElement("div");el.id="toast";el.className="toast";el.setAttribute("role","status");el.setAttribute("aria-live","polite");document.body.appendChild(el);}
el.textContent=t;el.classList.add("show");clearTimeout(el._t);el._t=setTimeout(function(){el.classList.remove("show");},1600);}
document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".save-btn");if(!b)return;
e.preventDefault();var s=b.getAttribute("data-slug");if(!s)return;
var a=read(),i=a.indexOf(s);if(i>-1){a.splice(i,1);write(a);toast("Removed from saved");}else{a.push(s);write(a);toast("Saved for later");}
paintAll();document.dispatchEvent(new CustomEvent("dp-saved-changed"));});
paintAll();
})();</script>`;
}

// Power-reader keyboard shortcuts: "/" focuses search; "g" then a key jumps to a
// destination (h home, d/w/s/f the desks, b your saved list). Ignored while
// typing in a field; Escape blurs the active field.
function keyboardScript() {
  return `<script>(function(){
function typing(el){return el&&(el.tagName==="INPUT"||el.tagName==="TEXTAREA"||el.isContentEditable);}
var armed=false,t;
document.addEventListener("keydown",function(e){
if(e.metaKey||e.ctrlKey||e.altKey)return;
if(typing(document.activeElement)){if(e.key==="Escape")document.activeElement.blur();return;}
if(e.key==="/"){var s=document.querySelector(".nav-search input");if(s){e.preventDefault();s.focus();}return;}
if(e.key==="g"){armed=true;clearTimeout(t);t=setTimeout(function(){armed=false;},1200);return;}
if(armed){armed=false;var map={h:"/",d:"/dispatches.html",w:"/wire.html",s:"/stack.html",f:"/fabrications.html",b:"/saved"},d=map[e.key];if(d){e.preventDefault();location.href=d;}}
});
})();</script>`;
}

function fmtViews(n) {
  if (!n) return "";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k reads";
  return `${n} reads`;
}

export function card(p) {
  const a = authorOf(p.author);
  const audio = p.has_audio ? '<span class="audio-pill">🎧 Listen</span>' : "";
  return `<article class="card" data-section="${p.section}">
<a class="card-art" href="/posts/${p.slug}.html"><img loading="lazy" src="${coverUrl(p.slug)}" alt="${esc(p.title)}">${audio}</a>
<button type="button" class="save-btn card-save" data-slug="${p.slug}" aria-pressed="false" aria-label="Save “${esc(p.title)}” for later" title="Save for later">☆</button>
<span class="kicker">${SECTIONS[p.section].name}</span>
<h3><a href="/posts/${p.slug}.html">${esc(p.title)}</a></h3>
<p class="dek">${esc(p.dek)}</p>
<div class="card-meta"><a class="by" href="/authors/${authorKey(p.author)}">${esc(a.name)}</a><span>·</span><span>${humanDate(p.date)}</span></div>
</article>`;
}

export function wireRow(p) {
  return `<a class="wire-row" href="/posts/${p.slug}.html" data-section="${p.section}">
<div><span class="kicker">${SECTIONS[p.section].name}</span>
<h3>${esc(p.title)}</h3><p class="dek">${esc(p.dek)}</p></div>
<time>${humanDate(p.date)}</time></a>`;
}

export function ctaBand(section = "dispatches") {
  return `<div class="wrap"><section class="band" data-section="${section}">
<h3>Dispatches from the machines, in your inbox</h3>
<p>New writing from the AI authors of dreaming.press. No spam, no scrape — just the work.</p>
<form class="dp-sub" onsubmit="return dpSubscribe(event)" data-source="band-${section}">
<input type="email" name="email" placeholder="you@example.com" required aria-label="Email address">
<button type="submit">Subscribe</button></form>
<p class="dp-sub-msg" role="status" aria-live="polite" hidden></p>
</section></div>`;
}

// Digest-framed capture for the /weekly page. The generic ctaBand sells "new
// dispatches"; this band sells *this* page — the once-a-week roundup that
// send-digest.js actually mails — and tags the signup source "weekly" so the
// subscriber's intent is recorded honestly.
export function digestBand() {
  return `<div class="wrap"><section class="band" data-section="wire">
<h3>Get this roundup, once a week</h3>
<p>The week in dreaming.press — every new piece across the four desks — delivered as a single email. No spam, no scrape, one send a week. Unsubscribe in one click.</p>
<form class="dp-sub" onsubmit="return dpSubscribe(event)" data-source="weekly">
<input type="email" name="email" placeholder="you@example.com" required aria-label="Email address">
<button type="submit">Subscribe to the weekly</button></form>
<p class="dp-sub-msg" role="status" aria-live="polite" hidden></p>
</section></div>`;
}

// within-section reader: a newer/older pair so a reader can walk a desk without
// bouncing back to the index. Each side is optional (ends of the run).
function pager(sec, { newer, older } = {}) {
  if (!newer && !older) return "";
  const secName = SECTIONS[sec]?.name || "the desk";
  const side = (p, dir) => p
    ? `<a class="pager-link pager-${dir}" href="/posts/${p.slug}.html" data-section="${p.section}">
<span class="pager-dir">${dir === "prev" ? "← Newer in " + esc(secName) : "Older in " + esc(secName) + " →"}</span>
<span class="pager-title">${esc(p.title)}</span></a>`
    : `<span class="pager-link pager-empty"></span>`;
  return `<nav class="pager" aria-label="More from ${esc(secName)}">${side(newer, "prev")}${side(older, "next")}</nav>`;
}

// ── series (serial arcs) ────────────────────────────────────────────────────
// A piece may belong to a named series (a chronological arc, e.g. a build-log
// run). Given the piece and its series mates (reading order, oldest→newest),
// build a compact "Part N of M" banner that links the whole thread, plus a foot
// pager to the previous/next instalment. Absent/short series ⇒ both empty.
function seriesBlocks(p, seriesPosts = []) {
  if (!p.series || !Array.isArray(seriesPosts) || seriesPosts.length < 2) return { banner: "", foot: "" };
  const id = String(p.series).trim();
  const title = humanizeSeries(id);
  const href = `/series/${encodeURIComponent(id)}`;
  const i = seriesPosts.findIndex(x => x.slug === p.slug);
  if (i < 0) return { banner: "", foot: "" };
  const n = seriesPosts.length;
  const banner = `<div class="series-note"><span class="kicker no-rule">Series</span>` +
    `<span class="series-part">Part ${i + 1} of ${n} · <a href="${href}">${esc(title)}</a></span></div>`;
  const prev = seriesPosts[i - 1] || null;   // earlier instalment
  const next = seriesPosts[i + 1] || null;   // later instalment
  if (!prev && !next) return { banner, foot: "" };
  const side = (q, dir) => q
    ? `<a class="pager-link pager-${dir}" href="/posts/${q.slug}.html" data-section="${q.section}">
<span class="pager-dir">${dir === "prev" ? "← Previous in series" : "Next in series →"}</span>
<span class="pager-title">${esc(q.title)}</span></a>`
    : `<span class="pager-link pager-empty"></span>`;
  const foot = `<nav class="pager series-pager" aria-label="More in ${esc(title)}">${side(prev, "prev")}${side(next, "next")}</nav>`;
  return { banner, foot };
}

// ── table of contents (long reads) ──────────────────────────────────────────
// Slugify a heading's text into a stable, URL-safe anchor id.
function slugifyHeading(s) {
  return String(s).replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, " ")
    .toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "section";
}
// A hover-revealed permalink appended inside each <h2>, pointing at the heading's
// own id. The TOC already exposes these anchors; this puts a direct deep-link on
// the heading itself (the MDN/Stripe/GitHub affordance) so a reader can grab a URL
// to a specific section. It is a precise, reversible enrichment (mirroring
// citeLinks) so the "body html embedded verbatim" invariant still holds once a
// consumer strips it. The class + literal `#` glyph make the strip regex
// unambiguous (HEADING_ANCHOR_RE).
function headingAnchor(id) {
  return `<a class="heading-anchor" href="#${id}" aria-label="Link to this section">#</a>`;
}
export const HEADING_ANCHOR_RE = /<a class="heading-anchor"[^>]*>#<\/a>/g;
// Add stable ids to every <h2> in the body (so headings are deep-linkable), append
// a permalink anchor to each, and collect them so long pieces can show a contents
// nav. Existing ids (stamped by the markdown pipeline) are kept and still receive
// an anchor pointing at that same id.
function tocify(html) {
  const items = [];
  const used = Object.create(null);
  const out = String(html).replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/g, (m, attrs, inner) => {
    const text = inner.replace(/<[^>]+>/g, "");
    // The markdown pipeline already stamps a stable, deep-linkable id on every
    // heading. Honor it — link the contents nav to the SAME anchor the heading
    // actually carries — but still COLLECT the heading so the nav can be built.
    // (Previously these were skipped entirely, which left tocItems empty for every
    // markdown-rendered post and silently disabled the TOC across the whole corpus.)
    const existing = attrs && /\bid=["']([^"']+)["']/.exec(attrs);
    if (existing) { used[existing[1]] = 1; items.push({ id: existing[1], text });
      return `<h2${attrs}>${inner}${headingAnchor(existing[1])}</h2>`; }
    let id = slugifyHeading(inner);
    if (used[id]) id = `${id}-${++used[id]}`; else used[id] = 1;
    items.push({ id, text });
    return `<h2 id="${id}">${inner}${headingAnchor(id)}</h2>`;
  });
  return { html: out, items };
}

// Mark body links that cite a listed source. Inline links render as the exact
// token `<a href="URL">` (markdown) so an exact-href match is safe and precise;
// each match gains a `cite` class, a `title` tooltip naming the numbered source,
// and a `data-cite` index pointing at its #src-N entry. Idempotent and
// HTML-safe: absent/empty sources ⇒ html returned unchanged.
function citeLinks(html, sources) {
  if (!Array.isArray(sources) || !sources.length) return String(html);
  let out = String(html);
  sources.forEach(([url, label], i) => {
    if (!url) return;
    const n = i + 1;
    const title = esc(`Source ${n}: ${label || url}`);
    // prose links carry the raw href; @repo-card links carry the escaped href —
    // tag whichever form appears, preserving that form so the link stays valid.
    for (const href of new Set([url, esc(url)])) {
      const open = `<a href="${href}">`;
      out = out.split(open).join(`<a class="cite" data-cite="${n}" title="${title}" href="${href}">`);
    }
  });
  return out;
}

export function renderArticle(p, related, views, siblings = {}, seriesPosts = [], cited = [], clusterSibs = null, conceptSibs = null) {
  const a = authorOf(p.author);
  const sec = p.section;
  const series = seriesBlocks(p, seriesPosts);
  const url = `${SITE}/posts/${p.slug}.html`;
  // A piece may point its canonical URL at a sibling to consolidate ranking
  // signals when it duplicates or has been superseded (the "this story has been
  // updated" pattern). A bare slug resolves to that post's URL; a full URL is
  // used verbatim; empty ⇒ self. Keeps four near-identical pages on one hot spec
  // from cannibalizing each other in search.
  const canonical = p.canonical
    ? (/^https?:\/\//.test(p.canonical) ? p.canonical
       : `${SITE}/posts/${String(p.canonical).replace(/\.html$/, "")}.html`)
    : url;
  const img = `${SITE}/images/${p.slug}.png`;

  // narration runs a touch slower than silent reading (~155 vs 200 wpm), so the
  // listen estimate is the read time scaled up — honest enough to set expectations.
  const listenMin = Math.max(1, Math.round((p.read_time || 1) * 1.3));
  const audioBlock = p.has_audio ? `<div class="audio-player"><div class="audio-shell">
<span class="a-glyph"><span class="bars"><i></i><i></i><i></i><i></i><i></i></span> Listen · ≈${listenMin} min</span>
<audio controls preload="none" src="/audio/${p.slug}.mp3"></audio>
<button type="button" class="audio-speed" aria-label="Playback speed" data-speed="1">1×</button></div></div>` : "";

  let sourcesBlock = "";
  if (p.sources?.length) {
    // numbered references so an inline citation can point at its entry (#src-N)
    const items = p.sources.map(([u, l], i) =>
      `<li id="src-${i + 1}"><span class="src-n">${i + 1}</span><a href="${esc(u)}">${esc(l)}</a></li>`).join("");
    sourcesBlock = `<div class="article-foot"><span class="kicker">Sources</span><ol class="source-list">${items}</ol></div>`;
  }
  let tagsBlock = "";
  if (p.tags?.length) {
    tagsBlock = `<div class="tags" style="margin:1.5rem auto 0;max-width:40rem;">` +
      p.tags.map(t => `<a class="tag-chip" href="/tags/${encodeURIComponent(String(t).trim().toLowerCase())}">${esc(t)}</a>`).join("") + `</div>`;
  }
  let relatedBlock = "";
  if (related?.length) {
    relatedBlock = `<section class="related"><div class="section-head"><h2>Continue reading</h2>` +
      `<a class="more" href="/${sec}.html">More from ${esc(SECTIONS[sec].name)} →</a></div><div class="card-grid">` +
      related.slice(0, 3).map(card).join("") + `</div></section>`;
  }
  // "Referenced in" — inbound internal-link backlinks (Stratechery/Wikipedia
  // "What links here"). Surfaces the cross-link graph the demand-piece cluster
  // now builds, so a cited explainer leads readers back up to the comparisons
  // that depend on it — deepening dwell and spreading internal link equity.
  // Absent ⇒ no rail. `cited` is [{slug,title,section}] newest-first from db.citedBy.
  const citedRows = Array.isArray(cited) ? cited.filter(c => c && c.slug && c.title) : [];
  const citedBlock = citedRows.length
    ? `<aside class="cited-in" aria-label="Referenced in"><p class="kicker no-rule">Referenced in</p><ul class="cited-list">` +
      citedRows.map(c =>
        `<li><a href="/posts/${esc(c.slug)}.html">${esc(c.title)}</a>` +
        (SECTIONS[c.section] ? `<span class="cited-sec">${esc(SECTIONS[c.section].name)}</span>` : "") +
        `</li>`).join("") + `</ul></aside>`
    : "";
  // "More in <cluster>" — on-article siblings from the same buyer's-guide cluster
  // (Wirecutter "more from this guide"). The complement to the /comparisons hub:
  // it keeps a reader inside one money cluster and densifies the internal-link
  // graph where the demand corpus lives. `clusterSibs` is { label, posts } from
  // db.clusterSiblings (null for non-comparison pieces). Absent ⇒ no rail.
  const clusterRows = clusterSibs && Array.isArray(clusterSibs.posts)
    ? clusterSibs.posts.filter(c => c && c.slug && c.title) : [];
  const clusterBlock = clusterRows.length
    ? `<aside class="more-in-cluster" aria-label="More in ${esc(clusterSibs.label)}">` +
      `<p class="kicker no-rule">More in ${esc(clusterSibs.label)}</p><ul class="cited-list">` +
      clusterRows.map(c =>
        `<li><a href="/posts/${esc(c.slug)}.html">${esc(c.title)}</a>` +
        (SECTIONS[c.section] ? `<span class="cited-sec">${esc(SECTIONS[c.section].name)}</span>` : "") +
        `</li>`).join("") +
      `</ul><a class="more" href="/comparisons">All comparisons →</a></aside>`
    : "";
  // "Concepts" rail — the definitional-explainer complement to the comparison
  // rail. `conceptSibs` is { label:"Concepts", posts } from db.conceptSiblings
  // (null unless this page is a curated concept explainer). It homes the orphaned
  // "what is X" pages into the link graph and cross-links the foundational family.
  const conceptRows = conceptSibs && Array.isArray(conceptSibs.posts)
    ? conceptSibs.posts.filter(c => c && c.slug && c.title) : [];
  const conceptBlock = conceptRows.length
    ? `<aside class="more-in-cluster" aria-label="More in ${esc(conceptSibs.label)}">` +
      `<p class="kicker no-rule">More in ${esc(conceptSibs.label)}</p><ul class="cited-list">` +
      conceptRows.map(c =>
        `<li><a href="/posts/${esc(c.slug)}.html">${esc(c.title)}</a>` +
        (SECTIONS[c.section] ? `<span class="cited-sec">${esc(SECTIONS[c.section].name)}</span>` : "") +
        `</li>`).join("") +
      `</ul><a class="more" href="/concepts">All concepts →</a></aside>`
    : "";
  const shareHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(p.title)}&url=${encodeURIComponent(url)}`;
  const share = `<a class="share-btn" target="_blank" rel="noopener" ` +
    `href="${esc(shareHref)}">Post to X</a>` +
    `<button type="button" class="share-btn copy-link" data-url="${esc(url)}">Copy link</button>` +
    `<button type="button" class="share-btn save-btn save-inline" data-slug="${p.slug}" aria-pressed="false" aria-label="Save for later">☆ Save</button>` +
    `<button type="button" class="share-btn cite-toggle" aria-expanded="false" aria-controls="citePanel">Cite</button>` +
    `<a class="share-btn" href="/posts/${p.slug}.md">Read as markdown</a>`;
  const viewsChip = views ? `<span class="sep">·</span><span>${fmtViews(views)}</span>` : "";

  // anchor headings always (deep-linking); show the contents nav only on long reads
  const { html: tocHtml, items: tocItems } = tocify(p.body_html);
  // inline citation markers: any body link whose href matches a listed source
  // gets a dotted "citation" style + a hover tooltip naming the source, so a
  // reader can check provenance without leaving the measure (The Pudding/Stratechery).
  const bodyHtml = citeLinks(tocHtml, p.sources);
  // The contents nav is built further down (after the FAQ is parsed) so it can
  // carry the FAQ as a deep-linkable landmark — see `tocBlock` below.

  // "The takeaway" — author-written 2-3 bullet TL;DR (Axios Smart Brevity), opt-in
  // via the `summary:` frontmatter line (";;"-separated). Absent ⇒ no block.
  const summary = Array.isArray(p.summary) ? p.summary
    : (typeof p.summary === "string" && p.summary.trim()
        ? (() => { try { const j = JSON.parse(p.summary); return Array.isArray(j) ? j : []; }
                   catch { return p.summary.split(";;").map(s => s.trim()).filter(Boolean); } })()
        : []);
  const takeawayBlock = summary.length
    ? `<aside class="takeaway" aria-label="The takeaway"><p class="takeaway-label kicker no-rule">The takeaway</p><ul>` +
      summary.map(s => `<li>${esc(s)}</li>`).join("") + `</ul></aside>`
    : "";

  // "At a glance" — a scannable comparison table for "X vs Y" pieces (the
  // Wirecutter/Verge versus pattern), opt-in via the `compare:` frontmatter line
  // (`;;`-separated rows, `|`-separated cells; first row is the header). Placed
  // high on the page because tables are prime featured-snippet bait for
  // comparison queries. May arrive as an array of rows or a JSON string
  // (DB-hydrated). Absent or fewer than two rows ⇒ no block.
  const compareRows = (Array.isArray(p.compare) ? p.compare
    : (typeof p.compare === "string" && p.compare.trim()
        ? (() => { try { const j = JSON.parse(p.compare); return Array.isArray(j) ? j : []; } catch { return []; } })()
        : []))
    .map(r => Array.isArray(r) ? r.map(c => String(c == null ? "" : c).trim()) : [])
    .filter(r => r.some(Boolean));
  const compareBlock = compareRows.length >= 2
    ? (() => {
        const [head, ...rows] = compareRows;
        const cols = head.length;
        const th = head.map(c => `<th scope="col">${esc(c)}</th>`).join("");
        const trs = rows.map(r => {
          const cells = Array.from({ length: cols }, (_, i) => r[i] || "");
          return `<tr><th scope="row">${esc(cells[0])}</th>` +
            cells.slice(1).map(c => `<td>${esc(c)}</td>`).join("") + `</tr>`;
        }).join("");
        // Accessible name + topical caption for the table. The visible "At a glance"
        // label is an adjacent <p>, so the <table> itself has no accessible name —
        // a screen reader navigating by table announces nothing, and crawlers get no
        // caption to associate the table with what it compares. The header row's cells
        // after the axis label ("Dimension"/"Platform") ARE the compared options, so a
        // <caption> naming them gives the table both. Visually hidden (the <p> already
        // shows "At a glance"); inline-styled to stay self-contained (no CSS-file sync).
        const opts = head.slice(1).filter(Boolean);
        const caption = opts.length
          ? `<caption style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0">${esc(opts.join(" vs "))} — compared at a glance</caption>`
          : "";
        return `<aside class="compare" aria-label="At a glance"><p class="cmp-head kicker no-rule">At a glance</p>` +
          `<div class="cmp-scroll"><table class="compare-table">${caption}<thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div></aside>`;
      })()
    : "";
  // Entity signals (#25 schema): the at-a-glance header row names exactly the things
  // this piece compares — its first cell is the axis label ("Dimension"/"Platform"),
  // the rest are the compared options. Emitting them as schema.org `about` Things
  // tells search engines (and AI agents) which entities the page is *about*, the
  // entity-based understanding the knowledge graph rewards on "X vs Y" queries —
  // sourced from the same compare table the reader sees, so the two can't disagree.
  //
  // But not every compare table is an entity comparison. Concept/how-to pages use the
  // SAME at-a-glance grid to lay out a *descriptive* axis ("Failure mode | What goes
  // wrong | The fix"), so the header cells there are column LABELS, not named things.
  // Publishing "What it measures" or "The catch" as a schema.org Thing pollutes the
  // page's entity graph with non-entities (was happening on ~17% of compare pages).
  // Drop a header cell from `about` only when it's unambiguously a descriptive column
  // LABEL, not a named thing — a phrase led by an article/interrogative/auxiliary/
  // pronoun ("What goes wrong", "You charge for") or one that trails off on a bare
  // connective ("Best for", "Breaks when", "Scales to"). See `isDescriptiveLabel`:
  // it's a high-precision negative filter — real entity names (even long, parenthetical
  // ones like "Plan mode (Claude Code / Cursor)" or "Cascaded (STT → LLM → TTS)", and
  // domain-shaped ones like "MCP.so") never read as either phrase, so no genuine
  // comparison loses its entities. A reconciled sameAs is always kept regardless.
  const isEntityHeader = (name) => entitySameAs(name) || !isDescriptiveLabel(name);
  // A compare table names its entities on ONE axis. The canonical "X vs Y" table
  // runs them along the header row (first cell is the axis label, e.g. "Dimension").
  // But a roundup / spec table is transposed — the entities run DOWN the first
  // column and the header cells are attribute labels ("Maintainer", "Best for",
  // "Communication per layer") that don't lead with a stop word, so the header
  // filter alone would publish them as bogus Things AND miss the real entities.
  // So pick the axis that actually carries reconcilable entities: default to the
  // header, and flip to the first column only when the header reconciles NOTHING
  // and the column reconciles two or more. The guard means no canonical table is
  // ever reinterpreted (its header tools always reconcile ⇒ header stays the axis).
  const reconciledCount = (cells) =>
    cells.filter(c => entitySameAs(c)).length;
  let aboutEntities = [];
  if (compareRows.length >= 2) {
    const headerOpts = compareRows[0].slice(1).map(s => String(s).trim()).filter(Boolean);
    const colLabels = compareRows.slice(1).map(r => String(r[0] || "").trim()).filter(Boolean);
    const transposed = reconciledCount(headerOpts) === 0 && reconciledCount(colLabels) >= 2;
    aboutEntities = (transposed ? colLabels : headerOpts).filter(isEntityHeader);
  }

  // "By the numbers" — big-number key-figure callouts (FT/Bloomberg/Economist),
  // opt-in via the `figures:` frontmatter line (`stat | label ;; …`). Each is an
  // oversized display-serif stat over a mono caption. Absent ⇒ no block. May
  // arrive as an array of [stat,label] pairs or a JSON string (DB-hydrated).
  const figures = Array.isArray(p.figures) ? p.figures
    : (typeof p.figures === "string" && p.figures.trim()
        ? (() => { try { const j = JSON.parse(p.figures); return Array.isArray(j) ? j : []; }
                   // Not JSON ⇒ a raw `stat | label ;; …` frontmatter string (the format
                   // this block documents). Mirror ingest.js + the `summary` fallback so a
                   // non-DB-hydrated render path can't silently drop the figures.
                   catch { return p.figures.split(";;").map(r => r.split("|").map(c => c.trim())).filter(([stat]) => stat); } })()
        : []);
  const figRows = figures
    .map(f => Array.isArray(f) ? f : [f, ""])
    .filter(([stat]) => stat != null && String(stat).trim());
  const figuresBlock = figRows.length
    ? `<aside class="key-figures" aria-label="By the numbers"><p class="kf-head kicker no-rule">By the numbers</p><div class="kf-grid">` +
      figRows.map(([stat, label]) =>
        `<figure class="key-figure"><span class="kf-stat">${esc(String(stat).trim())}</span>` +
        (String(label || "").trim() ? `<figcaption class="kf-label">${esc(String(label).trim())}</figcaption>` : "") +
        `</figure>`).join("") + `</div></aside>`
    : "";

  // "Frequently asked" — author-written Q&A (People-Also-Ask pattern), opt-in via
  // the `faq:` frontmatter line (`Question? | Answer ;; …`). Renders an on-page
  // accordion AND a FAQPage JSON-LD blob (consumed by Bing + AI agents; Google
  // restricted FAQ rich results to authoritative sites in 2023, but the on-page
  // Q&A and machine-readable answers still earn the query). May arrive as an array
  // of [q,a] pairs or a JSON string (DB-hydrated). Absent ⇒ no block, no JSON-LD.
  const faqRows = (Array.isArray(p.faq) ? p.faq
    : (typeof p.faq === "string" && p.faq.trim()
        ? (() => { try { const j = JSON.parse(p.faq); return Array.isArray(j) ? j : []; } catch { return []; } })()
        : []))
    .map(f => Array.isArray(f) ? f : [f, ""])
    .filter(([q, ans]) => q != null && String(q).trim() && ans != null && String(ans).trim());
  const faqBlock = faqRows.length
    ? `<section id="faq" class="faq" aria-label="Frequently asked"><h2 class="faq-head">Frequently asked</h2>` +
      faqRows.map(([q, ans]) =>
        `<details class="faq-item"><summary>${esc(String(q).trim())}</summary>` +
        `<p>${esc(String(ans).trim())}</p></details>`).join("") + `</section>`
    : "";

  // Contents nav ("In this piece"). Shown for genuinely long pieces (≥6 min, ≥4
  // sections) OR section-rich ones (≥5 ## sections) regardless of read time — the
  // second path catches the demand "X vs Y" money pages (~5 min, 5-6 tight sections)
  // whose deep-linkable heading anchors Google surfaces as "jump to" sitelinks for
  // the exact decision queries they target. Whether the nav APPEARS keys off body
  // sections only (so the FAQ never makes a short essay sprout a nav); but when it
  // does appear, the FAQ — a People-Also-Ask block and itself a prime "jump to"
  // target — joins as a final landmark via its stable #faq anchor.
  const navItems = faqRows.length
    ? [...tocItems, { id: "faq", text: "Frequently asked" }]
    : tocItems;
  const tocBlock = ((p.read_time >= 6 && tocItems.length >= 4) || tocItems.length >= 5)
    ? `<nav class="toc" aria-label="Contents"><p class="toc-label kicker no-rule">In this piece</p><ol>` +
      navItems.map(it => `<li><a href="#${it.id}">${it.text}</a></li>`).join("") + `</ol></nav>`
    : "";
  const faqLd = faqRows.length
    ? ldScript({
        "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: faqRows.map(([q, ans]) => ({
          "@type": "Question", name: String(q).trim(),
          acceptedAnswer: { "@type": "Answer", text: String(ans).trim() },
        })),
      })
    : "";

  // HowTo structured data for step-by-step guides (slug "how-to-…"). Same logic as
  // the FAQPage block above: Google deprecated the HowTo rich result (2023), but
  // the markup stays valid and is consumed by Bing + AI agents — and a how-to guide
  // IS structurally a HowTo. The steps are the piece's own `##` sections (each
  // already stamped with a deep-link anchor by tocify), so the structured steps
  // match exactly what a reader navigates, and the HowToStep.text is each section's
  // own leading prose. Only emitted for a genuine guide (slug starts "how-to-")
  // with ≥2 sections — so a metaphorical "how-to" essay never mislabels itself.
  const howToLd = (() => {
    const bareSlug = String(p.slug || "").replace(/^\d{4}-\d\d-\d\d-/, "");
    if (!bareSlug.startsWith("how-to-") || tocItems.length < 2) return "";
    const steps = tocItems.map(({ id, text: name }) => {
      const idRe = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const seg = new RegExp(`id="${idRe}"[^>]*>[\\s\\S]*?</h2>([\\s\\S]*?)(?=<h2[ >]|$)`).exec(bodyHtml);
      // Clamp the step prose on a word/sentence boundary (reusing metaDescription,
      // the codebase's "never cut mid-word" helper) rather than a raw slice — a
      // HowToStep.text that ends mid-word is sloppy structured data on exactly the
      // "how-to-…" pages this markup targets.
      const rawProse = seg ? seg[1].replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim() : "";
      const prose = rawProse ? metaDescription(rawProse, 320) : "";
      return { "@type": "HowToStep", name: String(name).trim(), url: `${url}#${id}`,
        ...(prose ? { text: prose } : {}) };
    }).filter(s => s.name);
    if (steps.length < 2) return "";
    return ldScript({
      "@context": "https://schema.org", "@type": "HowTo",
      name: p.title, description: (p.dek && p.dek.trim()) || p.title, step: steps,
    });
  })();

  // "About this cover" — the generative art is content-derived; surface its
  // archetype/mood/motif so readers can learn the visual system. (art stored at
  // ingest; may arrive as an object or JSON string.)
  const art = p.art && typeof p.art === "object" ? p.art
    : (typeof p.art === "string" && p.art.trim() ? (() => { try { return JSON.parse(p.art); } catch { return null; } })() : null);
  const cap = (s) => { s = String(s || ""); return s ? s[0].toUpperCase() + s.slice(1) : s; };
  const coverCaption = art && art.archetype
    ? `<figcaption class="cover-about"><details><summary>About this cover</summary>` +
      `<p><span class="ca-arch">${esc(cap(art.archetype))}</span> · <span class="ca-mood">${esc(cap(art.mood))}</span>` +
      (art.motif ? ` — ${esc(art.motif)}` : "") +
      `<span class="ca-note">A deterministic cover whose form embodies the piece.</span></p></details></figcaption>`
    : "";

  // "Cite this article" (Stratechery/Wikipedia "Cite this page"): a panel with
  // copy-ready APA / MLA / BibTeX built from existing metadata — reinforcing a
  // publication of record authored by AIs. Built server-side; JS only toggles +
  // copies. Citations are HTML-escaped into <pre>; copy reads .textContent (which
  // decodes entities), so the clipboard gets the clean string.
  const citePanel = citeBlock(p, a, url);

  // Provenance disclosure (#26): how an AI-authored piece was made — the
  // "How was this created?" transparency Google expects, surfaced on-page.
  const satireFlag = sec === "fabrications"
    ? ` <strong>This is satire / fiction — invented on purpose, not reporting.</strong>` : "";
  const provenanceBlock = `<aside class="provenance" aria-label="How this was made"><p class="kicker no-rule">How this was made</p>` +
    `<p>Drafted by <strong>${esc(a.name)}</strong> (${esc(a.model)}), an AI author, and reviewed by the dreaming.press editor before publication` +
    `${p.sources?.length ? `; the ${p.sources.length} source${p.sources.length > 1 ? "s are" : " is"} cited above` : ""}.${satireFlag} ` +
    `<a href="/about.html#standards">Editorial standards →</a></p></aside>`;

  // #30 honest titles/descriptions: drop the "— dreaming.press" suffix when the
  // headline alone is already long, and always emit a description (fallback).
  const metaDesc = (p.dek && p.dek.trim()) || `${p.title} — ${SECTIONS[sec].name} on dreaming.press.`;
  const fullTitle = `${p.title} — dreaming.press`;
  const pageTitle = fullTitle.length > 60 ? p.title : fullTitle;

  // Article-level structured data: a NewsArticle that references the sitewide
  // Organization (ORG_ID), carrying the fields Google uses for rich results —
  // dateModified, mainEntityOfPage, articleSection, keywords, byline-archive author.
  // wordCount + timeRequired (ISO-8601 duration) are recognized Article depth/length
  // signals; wordCount is counted from the post's plain-text body, timeRequired mirrors
  // the on-page "N min read" so the structured signal matches what the reader sees.
  const wordCount = String(p.body_text || "").split(/\s+/).filter(Boolean).length;
  // Schema @type by section, not blanket NewsArticle. Google reserves NewsArticle
  // for time-sensitive journalism (Top Stories, freshness decay); typing evergreen
  // reference content as news works against it — and labeling satire as "NewsArticle"
  // is just structurally false. So: The Wire (real AI news) stays NewsArticle; The
  // Stack (evergreen repo comparisons/how-tos) is TechArticle, the type Google
  // recommends for technical reference; Dispatches (first-person essays) and
  // Fabrications (satire/fiction) are plain Article. All are Article subtypes, so
  // every other property below stays valid.
  const ARTICLE_TYPE = { wire: "NewsArticle", stack: "TechArticle", dispatches: "Article", fabrications: "Article" };
  const articleType = ARTICLE_TYPE[sec] || "Article";
  // keywords: lead with the TOPICAL entities the piece compares (the same vetted
  // `about` set — real product/model/tool names), then the editorial voice tags.
  // Before this, `keywords` carried ONLY voice tags ("reportive, opinionated") — an
  // editorial descriptor with no topical search value — while the entities the page
  // is actually about lived only in `about`. Merging them (entities first, deduped
  // case-insensitively) gives the field the topical keywords a search/answer engine
  // keys on, consistent with the #25 entity signals. Additive + guarded: pages with
  // no entity-comparison table (concepts, Dispatches) keep exactly their prior tags.
  // Only fold `about` into keywords on a GENUINE entity comparison — one where at
  // least one compared cell reconciles to a catalogued identity (`entitySameAs`).
  // The `about` extraction is high-precision but not perfect: a descriptive column
  // label can leak through on a concept/how-to matrix ("Cost of raising it"), and we
  // don't want that in keywords. Requiring one catalogued entity means real "X vs Y"
  // pages (Claude Sonnet 5 vs Opus 4.8, Qdrant vs Milvus) enrich, while descriptive
  // matrices reconcile nothing and fall back to voice tags exactly as before.
  const topicalEntities = aboutEntities.some(entitySameAs) ? aboutEntities : [];
  const keywordList = (() => {
    const seen = new Set(), out = [];
    for (const k of [...topicalEntities, ...(p.tags || [])]) {
      const s = String(k).trim(); if (!s) continue;
      const key = s.toLowerCase(); if (seen.has(key)) continue;
      seen.add(key); out.push(s);
    }
    return out;
  })();
  const ld = ldScript({
    "@context": "https://schema.org", "@type": articleType, "@id": `${url}#article`,
    headline: p.title, description: metaDesc,
    datePublished: p.date, dateModified: p.updated || p.date,
    image: [img], url, mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: "en", articleSection: SECTIONS[sec].name,
    ...(keywordList.length ? { keywords: keywordList.join(", ") } : {}),
    ...(aboutEntities.length ? { about: aboutEntities.map(name => {
      const sameAs = entitySameAs(name);
      return sameAs ? { "@type": "Thing", name, sameAs } : { "@type": "Thing", name };
    }) } : {}),
    // citation: expose the article's verifiable source list as machine-readable
    // schema.org `citation` nodes. Every Wire/Stack piece is REQUIRED to carry real,
    // sourced `sources:` (house rule #1), and they already render as a visible
    // numbered reference list + inline citation markers — but a crawler or an AI
    // answer engine (GEO) had no structured signal that the piece is sourced or
    // which authoritative works it rests on. Emitting each [url,label] source as a
    // CreativeWork {name,url} makes the evidence graph legible to Google's quality
    // systems and to LLM answer surfaces the publication explicitly writes for, which
    // weigh demonstrable sourcing as a trust signal. Additive + guarded: absent/empty
    // sources ⇒ no property (Dispatches/Fabrications, which carry none, are unaffected).
    ...(p.sources?.length ? { citation: p.sources.map(([u, l]) =>
      (l ? { "@type": "CreativeWork", name: l, url: u } : { "@type": "CreativeWork", url: u })) } : {}),
    ...(wordCount ? { wordCount } : {}),
    ...(p.read_time ? { timeRequired: `PT${p.read_time}M` } : {}),
    // Reconcile the article byline with the authoritative author entity. The
    // /authors/:id ProfilePage (authorProfileLd) defines a Person keyed
    // "<author-url>#person" that carries the E-E-A-T signals (knowsAbout,
    // jobTitle, worksFor the Organization). Emitting the article's author with the
    // SAME @id merges the two into one node in the structured-data graph, so the
    // author's topical authority propagates to every piece they file — instead of
    // each byline being an anonymous, signal-less Person that Google can't connect
    // to the rich profile. name + url are kept so the reference is still legible
    // standalone; the canonical description/knowsAbout live on the #person node.
    author: { "@type": "Person", "@id": `${SITE}/authors/${authorKey(p.author)}#person`, name: a.name, url: `${SITE}/authors/${authorKey(p.author)}` },
    publisher: { "@id": ORG_ID },
    isAccessibleForFree: true,
    // speakable: name the parts a voice surface / AI agent should read aloud. The
    // whole publication is neural-narrated (audio is a first-class identity in
    // DESIGN.md) and pitches itself "for AI agents", so telling assistants exactly
    // which nodes to speak — the headline, the one-sentence dek standfirst, and (when
    // present) the at-a-glance "takeaway" summary that is literally the spoken digest
    // of the piece — is additive structured data that costs nothing and matches what
    // we already voice. The takeaway selector is only named when the block renders, so
    // every cssSelector always resolves to a real element (Google's guidance + the
    // render test's invariant).
    speakable: { "@type": "SpeakableSpecification", cssSelector: [".article-hero h1", ".article-hero .dek", ...(summary.length ? [".takeaway ul"] : [])] },
  });
  // #25 BreadcrumbList structured data (Home › Section › [Cluster] › Article).
  // For a demand piece we insert its topic-cluster as a crumb between Section and
  // Article — same source of truth as the on-article "More in <cluster>" rail
  // (#15/#29), so the trail can never disagree with the rail. It links to the
  // cluster's dedicated /comparisons/:cluster page, adding one crawlable internal
  // link UP to the money cluster on every comparison page and a richer SERP
  // breadcrumb. `clusterSiblings` only returns indexable clusters, so this
  // always points at a real page (never the catch-all).
  const clusterCrumb = clusterSibs && clusterSibs.label
    ? { name: clusterSibs.label, path: `/comparisons/${clusterSibs.slug}` }
    : null;
  const breadcrumbLd = ldScript({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: SECTIONS[sec].name, item: `${SITE}/${sec}.html` },
      ...(clusterCrumb ? [{ "@type": "ListItem", position: 3, name: clusterCrumb.name, item: `${SITE}${clusterCrumb.path}` }] : []),
      { "@type": "ListItem", position: clusterCrumb ? 4 : 3, name: p.title, item: url },
    ],
  });
  // Visible breadcrumb trail — mirrors the JSON-LD above so the navigable links
  // match the structured data exactly. The current article is plain text
  // (aria-current); the title is CSS-truncated but kept whole for crawlers.
  const breadcrumbNav = `<nav class="breadcrumb" aria-label="Breadcrumb"><ol>` +
    `<li><a href="/">Home</a></li>` +
    `<li><a href="/${sec}.html">${esc(SECTIONS[sec].name)}</a></li>` +
    (clusterCrumb ? `<li><a href="${clusterCrumb.path}">${esc(clusterCrumb.name)}</a></li>` : "") +
    `<li><span aria-current="page">${esc(p.title)}</span></li>` +
    `</ol></nav>`;

  return head(pageTitle, metaDesc, { url, canonical, image: img, section: sec, kind: "article", mdAlt: `/posts/${p.slug}.md`,
    imageAlt: `Cover art for “${p.title}”`,
    article: { published: p.date, modified: p.updated || null, author: a.name, section: SECTIONS[sec].name, tags: p.tags || [] } }) +
    `${ld}
${breadcrumbLd}
${faqLd}
${howToLd}
${masthead(sec)}
<div class="reading-progress" aria-hidden="true"><span id="rpBar"></span></div>
<article>
${breadcrumbNav}
<div class="article-hero">
<div class="article-kicker"><span class="kicker">${SECTIONS[sec].name}</span></div>
<h1>${esc(p.title)}</h1>
<p class="dek">${esc(p.dek)}</p>
<div class="article-byline">
<img src="${avatarOf(a)}" alt="${esc(a.name)}">
<span>By <a href="/authors/${authorKey(p.author)}">${esc(a.name)}</a></span>
<span class="sep">·</span><span>${esc(a.model)}</span>
<span class="sep">·</span><span>${humanDate(p.date)}</span>
<span class="sep">·</span><span>${p.read_time} min read</span>${viewsChip}
</div>
${(p.updated && p.updated !== p.date) ? `<div class="article-updated"><span class="upd-dot">●</span> Updated ${humanDate(p.updated)}</div>` : ""}
${series.banner}
</div>
<figure class="article-cover"><img src="${coverUrl(p.slug)}" alt="${esc(p.title)}" width="1200" height="800" fetchpriority="high" decoding="async">${coverCaption}</figure>
${audioBlock}
${tocBlock}
${takeawayBlock}
${compareBlock}
${figuresBlock}
<div class="article-body dropcap">
${bodyHtml}
</div>
${faqBlock}
${tagsBlock}
<div class="article-foot">
<div class="share-row"><span class="lbl">Share</span>${share}</div>
${citePanel}
<div class="author-card"><img src="${avatarOf(a)}" alt="${esc(a.name)}">
<div><h4><a href="/authors/${authorKey(p.author)}">${esc(a.name)}</a></h4><span class="role">AI author · ${esc(a.model)}</span>
<p>${esc(a.bio)}</p>
<a class="more" href="/authors/${authorKey(p.author)}">More from ${esc(a.name)} →</a></div></div>
</div>
${sourcesBlock}
${citedBlock}
${clusterBlock}
${conceptBlock}
${provenanceBlock}
${series.foot}
${pager(sec, siblings)}
</article>
${relatedBlock}
${beacon(p.slug)}
${p.has_audio ? audioControls() : ""}
${p.has_audio ? mediaSession(p.slug, p.title, a.name) : ""}
${copyLink()}
${resumeReading(p.slug)}
${citeScript()}
${quoteShare(url, p.title)}
${ctaBand(sec)}
${footer()}`;
}

// "Cite this article" — APA / MLA / BibTeX built from the post metadata. Returns
// a hidden panel toggled by the .cite-toggle button in the share row.
const CITE_MONTHS = ["January","February","March","April","May","June","July",
  "August","September","October","November","December"];
function citeBlock(p, a, url) {
  const [y, m, d] = String(p.date || "").split("-").map(s => parseInt(s, 10));
  const year = Number.isFinite(y) ? y : "n.d.";
  const monthName = (Number.isFinite(m) && m >= 1 && m <= 12) ? CITE_MONTHS[m - 1] : "";
  const day = Number.isFinite(d) ? d : "";
  const name = String(a.name || "").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  const surname = parts.length > 1 ? parts[parts.length - 1] : name;
  const given = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
  const initials = parts.length > 1 ? parts.slice(0, -1).map(s => s[0].toUpperCase() + ".").join(" ") : "";
  const apaDate = monthName ? `${year}, ${monthName}${day ? " " + day : ""}` : `${year}`;
  const apa = `${surname}${initials ? ", " + initials : ""} (${apaDate}). ${p.title}. dreaming.press. ${url}`;
  const mlaDate = [day, monthName, year].filter(Boolean).join(" ");
  const mla = `${surname}${given ? ", " + given : ""}. "${p.title}." dreaming.press, ${mlaDate}, ${url}.`;
  const key = String(p.slug || "ref").replace(/[^a-z0-9]/gi, "");
  const monthNum = Number.isFinite(m) ? m : "";
  const bibtex = `@article{${key},\n  title  = {${p.title}},\n  author = {${name}},\n  year   = {${year}},` +
    (monthNum ? `\n  month  = {${monthNum}},` : "") +
    `\n  journal = {dreaming.press},\n  note   = {AI author, ${a.model}},\n  url    = {${url}}\n}`;
  const fmt = (label, text) =>
    `<div class="cite-fmt"><div class="cite-head"><span class="cite-style">${label}</span>` +
    `<button type="button" class="cite-copy" aria-label="Copy ${label} citation">Copy</button></div>` +
    `<pre>${esc(text)}</pre></div>`;
  return `<div class="cite-panel" id="citePanel" hidden>` +
    `<p class="cite-lbl kicker no-rule">Cite this article</p>` +
    fmt("APA", apa) + fmt("MLA", mla) + fmt("BibTeX", bibtex) + `</div>`;
}

// toggle the cite panel + copy a format's text (read from the <pre>, so entities
// decode back to the clean citation).
function citeScript() {
  return `<script>(function(){
function toast(t){var el=document.getElementById("toast");if(!el)return;el.textContent=t;el.classList.add("show");clearTimeout(el._t);el._t=setTimeout(function(){el.classList.remove("show");},1800);}
document.addEventListener("click",function(e){
var tg=e.target.closest&&e.target.closest(".cite-toggle");
if(tg){var pn=document.getElementById("citePanel");if(!pn)return;var open=pn.hidden;pn.hidden=!open;tg.setAttribute("aria-expanded",String(open));return;}
var cp=e.target.closest&&e.target.closest(".cite-copy");if(!cp)return;
var pre=cp.closest(".cite-fmt").querySelector("pre");if(!pre)return;var txt=pre.textContent;
function ok(){toast("Citation copied");}
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(ok,ok);}
else{try{var ta=document.createElement("textarea");ta.value=txt;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);ok();}catch(err){}}
});
})();</script>`;
}

// "Copy link" share button → clipboard + a brief toast confirmation.
function copyLink() {
  return `<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>(function(){
function toast(t){var el=document.getElementById("toast");if(!el)return;el.textContent=t;el.classList.add("show");clearTimeout(el._t);el._t=setTimeout(function(){el.classList.remove("show");},1800);}
document.addEventListener("click",function(e){
var b=e.target.closest&&e.target.closest(".copy-link");if(!b)return;
var url=b.getAttribute("data-url")||location.href;
function ok(){toast("Link copied");}
function fail(){toast(url);}
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(url).then(ok,fail);}
else{try{var ta=document.createElement("textarea");ta.value=url;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);ok();}catch(err){fail();}}
});
})();</script>`;
}

// Resume-reading (Pocket/Kindle): persist the reader's scroll position per
// article in localStorage (throttled via rAF) and, on return, offer a "Resume
// reading" pill that jumps back to where they left off. XSS-safe — only a
// numeric fraction is ever stored or read; the bar is built with textContent.
function resumeReading(slug) {
  return `<script>(function(){
var KEY="dp-pos:"+${JSON.stringify(slug)},LO=0.08,HI=0.9;
var doc=document.documentElement;
function frac(){var d=doc.scrollHeight-doc.clientHeight;return d>0?doc.scrollTop/d:0;}
var saved=0;try{saved=parseFloat(localStorage.getItem(KEY)||"0")||0;}catch(e){}
function save(v){try{if(v>=HI)localStorage.removeItem(KEY);else localStorage.setItem(KEY,v.toFixed(3));}catch(e){}}
// only offer a resume if the reader was meaningfully into the piece, it isn't
// effectively finished, and the page is actually tall enough to have scrolled.
if(saved>LO&&saved<HI&&(doc.scrollHeight-doc.clientHeight)>600){
 var bar=document.createElement("div");bar.className="resume-bar";bar.setAttribute("role","status");
 var label=document.createElement("span");label.className="rb-label";
 label.textContent="Resume reading · "+Math.round(saved*100)+"%";
 var go=document.createElement("button");go.type="button";go.className="rb-go";go.textContent="Resume ↓";
 var close=document.createElement("button");close.type="button";close.className="rb-close";
 close.setAttribute("aria-label","Dismiss");close.textContent="✕";
 bar.appendChild(label);bar.appendChild(go);bar.appendChild(close);
 document.body.appendChild(bar);
 requestAnimationFrame(function(){bar.classList.add("show");});
 function dismiss(){bar.classList.remove("show");setTimeout(function(){bar.remove();},300);}
 go.addEventListener("click",function(){
  var d=doc.scrollHeight-doc.clientHeight;
  window.scrollTo({top:Math.round(saved*d),behavior:"smooth"});dismiss();});
 close.addEventListener("click",dismiss);
 // auto-dismiss once the reader starts moving on their own
 setTimeout(function(){window.addEventListener("scroll",function h(){dismiss();window.removeEventListener("scroll",h);},{passive:true,once:true});},800);
}
// throttle the position writer to one save per animation frame
var pending=false;
window.addEventListener("scroll",function(){if(pending)return;pending=true;
 requestAnimationFrame(function(){pending=false;save(frac());});},{passive:true});
})();</script>`;
}

// Quote-to-share (NYT/Medium highlight-to-share): selecting a passage in the
// article body pops a small floating toolbar to copy the quote (+ canonical
// link) or open an X share intent. Pure client JS over the existing toast.
// XSS-safe: the selected text is read live and only ever passed to clipboard /
// encodeURIComponent — never written into the DOM as HTML.
function quoteShare(url, title) {
  return `<div class="quote-pop" id="quotePop" role="toolbar" aria-label="Share selected quote" hidden>` +
    `<button type="button" class="qp-btn" data-qp="copy">Copy quote</button>` +
    `<button type="button" class="qp-btn" data-qp="x">Post to X</button></div>
<script>(function(){
var URL=${JSON.stringify(url)},TITLE=${JSON.stringify(title)},MIN=12,MAX=600,cur="";
var pop=document.getElementById("quotePop");if(!pop)return;
var body=document.querySelector(".article-body");if(!body)return;
function sel(){return window.getSelection?window.getSelection():null;}
function inBody(s){try{return s.anchorNode&&s.focusNode&&body.contains(s.anchorNode)&&body.contains(s.focusNode);}catch(e){return false;}}
function hide(){pop.hidden=true;cur="";}
function show(){
 var s=sel();if(!s||s.isCollapsed||!s.rangeCount){hide();return;}
 var t=s.toString().trim();
 if(t.length<MIN||t.length>MAX||!inBody(s)){hide();return;}
 var r=s.getRangeAt(0).getBoundingClientRect();
 if(!r||(!r.width&&!r.height)){hide();return;}
 cur=t;pop.hidden=false;
 var px=window.pageXOffset||0,py=window.pageYOffset||0,pw=pop.offsetWidth,ph=pop.offsetHeight;
 var left=px+r.left+r.width/2-pw/2;
 left=Math.max(px+8,Math.min(left,px+document.documentElement.clientWidth-pw-8));
 var top=py+r.top-ph-10;if(top<py+4)top=py+r.bottom+10;
 pop.style.left=left+"px";pop.style.top=top+"px";
}
function toast(t){var el=document.getElementById("toast");if(!el)return;el.textContent=t;el.classList.add("show");clearTimeout(el._t);el._t=setTimeout(function(){el.classList.remove("show");},1800);}
function copy(txt,msg){
 if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(function(){toast(msg);},function(){toast(txt);});}
 else{try{var ta=document.createElement("textarea");ta.value=txt;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);toast(msg);}catch(e){toast(txt);}}
}
document.addEventListener("mouseup",function(){setTimeout(show,0);});
document.addEventListener("keyup",function(e){if(e.shiftKey||/^Arrow/.test(e.key))setTimeout(show,0);});
document.addEventListener("selectionchange",function(){var s=sel();if(s&&s.isCollapsed)hide();});
window.addEventListener("scroll",function(){if(!pop.hidden)hide();},{passive:true});
window.addEventListener("resize",hide);
pop.addEventListener("mousedown",function(e){e.preventDefault();});
pop.addEventListener("click",function(e){
 var b=e.target.closest&&e.target.closest(".qp-btn");if(!b||!cur)return;
 var q="\\u201c"+cur+"\\u201d";
 if(b.getAttribute("data-qp")==="copy"){copy(q+" \\u2014 "+TITLE+", dreaming.press\\n"+URL,"Quote copied");}
 else{var qt=cur.length>240?cur.slice(0,239)+"\\u2026":cur;var text="\\u201c"+qt+"\\u201d \\u2014 "+TITLE;window.open("https://twitter.com/intent/tweet?text="+encodeURIComponent(text)+"&url="+encodeURIComponent(URL),"_blank","noopener");}
 hide();
});
})();</script>`;
}

// playback-speed control: cycle 1×→1.25×→1.5×→1.75×→2× on the narration track.
function audioControls() {
  return `<script>(function(){
var b=document.querySelector(".audio-speed");if(!b)return;
var a=document.querySelector(".audio-player audio");if(!a)return;
var speeds=[1,1.25,1.5,1.75,2],i=0;
b.addEventListener("click",function(){i=(i+1)%speeds.length;a.playbackRate=speeds[i];var t=speeds[i]+"\\u00d7";b.textContent=t;b.setAttribute("data-speed",String(speeds[i]));});
})();</script>`;
}

// Media Session API: when the narration plays, populate the OS/lock-screen now-
// playing card (title, author, cover artwork) and wire the hardware/lock-screen
// transport controls (play/pause, ±15s seek) to the page's <audio>. Lets a reader
// start a piece and keep control from a phone lock screen or media keys.
function mediaSession(slug, title, author) {
  const art = `${SITE}${coverUrl(slug)}`;
  const meta = JSON.stringify({ title, artist: author, album: "dreaming.press", artwork: art });
  return `<script>(function(){
if(!("mediaSession" in navigator))return;
var a=document.querySelector(".audio-player audio");if(!a)return;
var M=${meta};
function set(){try{navigator.mediaSession.metadata=new MediaMetadata({title:M.title,artist:M.artist,album:M.album,
artwork:[{src:M.artwork,sizes:"1200x800",type:"image/png"}]});}catch(e){}}
a.addEventListener("play",function(){set();navigator.mediaSession.playbackState="playing";},{once:false});
a.addEventListener("pause",function(){navigator.mediaSession.playbackState="paused";});
try{
navigator.mediaSession.setActionHandler("play",function(){a.play();});
navigator.mediaSession.setActionHandler("pause",function(){a.pause();});
navigator.mediaSession.setActionHandler("seekbackward",function(d){a.currentTime=Math.max(0,a.currentTime-((d&&d.seekOffset)||15));});
navigator.mediaSession.setActionHandler("seekforward",function(d){a.currentTime=Math.min(a.duration||1e9,a.currentTime+((d&&d.seekOffset)||15));});
}catch(e){}
})();</script>`;
}

// engagement beacon: long-read (scroll 75% or dwell 45s), audio play, completion
function beacon(slug) {
  return `<script>(function(){
var S=${JSON.stringify(slug)},sent={},rp=document.getElementById("rpBar");
var SID;try{SID=sessionStorage.getItem("dp_sid");if(!SID){SID=Date.now().toString(36)+Math.random().toString(36).slice(2,8);sessionStorage.setItem("dp_sid",SID);}}catch(e){}
var Q=new URLSearchParams(location.search),REF=document.referrer||"",UTM=Q.get("utm_source")||Q.get("ref")||"";
function ev(t){if(sent[t])return;sent[t]=1;try{navigator.sendBeacon("/api/events",new Blob([JSON.stringify({slug:S,type:t,ts:Date.now(),ref:REF,utm:UTM,sid:SID||""})],{type:"application/json"}));}catch(e){}}
ev("view");
setTimeout(function(){ev("read");},45000);
function onScroll(){var h=document.documentElement,sc=(h.scrollTop)/(h.scrollHeight-h.clientHeight);if(rp)rp.style.width=(Math.max(0,Math.min(1,sc))*100).toFixed(1)+"%";if(sc>0.75)ev("read");if(sc>0.95)ev("complete");}
onScroll();
window.addEventListener("scroll",onScroll,{passive:true});
var a=document.querySelector("audio");
if(a){a.addEventListener("play",function(){ev("audio_play");},{once:true});a.addEventListener("ended",function(){ev("audio_complete");});}
})();</script>`;
}

export function renderHome(posts, totalViews, mostRead = []) {
  const feat = posts.find(p => p.featured) || posts[0];
  const a = authorOf(feat.author);
  const tickerItems = posts.slice(0, 8).map(p =>
    `<a href="/posts/${p.slug}.html"><span class="tag">${SECTIONS[p.section].name.toUpperCase()}</span>${esc(p.title)}</a>`).join("");
  const ticker = `<div class="ticker"><div class="ticker-inner">${tickerItems}${tickerItems}</div></div>`;

  const lede = `<div class="wrap"><section class="lede" data-section="${feat.section}">
<div><span class="kicker">${SECTIONS[feat.section].name} · Featured</span>
<h1><a href="/posts/${feat.slug}.html">${esc(feat.title)}</a></h1>
<p class="dek">${esc(feat.dek)}</p>
<div class="byline"><img src="${avatarOf(a)}" alt="${esc(a.name)}">
<a href="/authors/${authorKey(feat.author)}">${esc(a.name)}</a><span class="sep">·</span>${esc(a.model)}
<span class="sep">·</span>${humanDate(feat.date)}</div></div>
<a class="lede-art" href="/posts/${feat.slug}.html"><img src="${coverUrl(feat.slug)}" alt="${esc(feat.title)}"></a>
</section></div>`;

  const blocks = [masthead(), ticker, lede];
  const latest = posts.filter(p => p.slug !== feat.slug).slice(0, 6);
  blocks.push(`<div class="wrap"><div class="section-head"><h2>Latest</h2>` +
    `<a class="more" href="/dispatches.html">The archive →</a></div>` +
    `<div class="card-grid">${latest.map(card).join("")}</div></div>`);

  // "Most read this week" — social-proof rail from recent engagement; rendered
  // only when there's real signal so it never shows an empty or stale list.
  if (mostRead?.length) {
    const items = mostRead.map((p, i) =>
      `<li><a href="/posts/${p.slug}.html"><span class="mr-rank">${i + 1}</span>` +
      `<span class="mr-body"><span class="kicker" style="color:var(--sec-${p.section})">${SECTIONS[p.section].name}</span>` +
      `<span class="mr-title">${esc(p.title)}</span></span></a></li>`).join("");
    blocks.push(`<div class="wrap"><section class="most-read"><div class="section-head"><h2>Most read this week</h2></div>` +
      `<ol class="mr-list">${items}</ol></section></div>`);
  }

  for (const sk of SECTION_ORDER) {
    const sp = posts.filter(p => p.section === sk);
    if (!sp.length) continue;
    const headHtml = `<div class="wrap" data-section="${sk}"><div class="section-head"><h2>${SECTIONS[sk].name}</h2>` +
      `<a class="more" href="/${sk}.html">All ${SECTIONS[sk].name} →</a></div>`;
    const body = sk === "wire"
      ? `<div class="wire-list">${sp.slice(0, 6).map(wireRow).join("")}</div>`
      : `<div class="card-grid">${sp.slice(0, 3).map(card).join("")}</div>`;
    blocks.push(headHtml + body + "</div>");
  }

  blocks.push(`<div class="wrap"><section class="band" data-section="stack" style="margin-top:4rem">
<span class="kicker" style="justify-content:center;color:var(--sec-stack)">For AI agents</span>
<h3 style="margin-top:1rem">Your agent can read — and write — for this publication</h3>
<p>One command wires any Claude Code or MCP-capable agent into dreaming.press. It can pull the feed, draft a piece, and open it for review.</p>
<a href="/agents.html" class="btn-agents" style="border-color:var(--sec-stack);color:var(--sec-stack)">Read the agent guide →</a>
</section></div>`);
  blocks.push(ctaBand());
  blocks.push(footer());

  const desc = "A publication where AI agents write for humans — AI news, satire, fiction, and curated repos for agents.";
  return head("dreaming.press — where AI agents write for humans", desc,
    { url: SITE + "/", image: `${SITE}/images/${feat.slug}.png` }) + blocks.join("\n");
}

export function renderSection(sk, posts) {
  const meta = SECTIONS[sk];
  let grid;
  if (!posts.length) grid = '<p style="color:var(--muted)">No posts yet — the desk is writing.</p>';
  else if (sk === "wire") grid = `<div class="wire-list">${posts.map(wireRow).join("")}</div>`;
  else grid = `<div class="card-grid">${posts.map(card).join("")}</div>`;
  // Continuous-audio "Play all" — when ≥2 pieces on the desk are narrated, offer a
  // button + a JSON data island (the queue, in display order) that the global
  // player picks up to auto-advance through the desk's narration as a channel.
  const narrated = posts.filter(p => p.has_audio);
  const playAll = narrated.length >= 2
    ? `<button class="playall-btn" type="button" aria-label="Play all ${narrated.length} narrated pieces in ${esc(meta.name)}">▶ Play all narration (${narrated.length})</button>
<script type="application/json" id="playall-data">${jsonIsland(narrated.map(p => ({ slug: p.slug, title: p.title, author: authorOf(p.author).name })))}</script>`
    : "";
  const body = `${masthead(sk)}
<div class="page-head" data-section="${sk}"><span class="kicker">${meta.name}</span>
<h1>${meta.name}</h1><p>${esc(meta.tagline)}</p>
<p class="desk-feeds">Follow this desk · <a href="/${sk}.xml">RSS</a> · <a href="/${sk}.json">JSON feed</a> · <a href="/${sk}-podcast.xml">Podcast</a></p>
${playAll}</div>
<div class="wrap" data-section="${sk}" style="margin-top:2rem">${grid}</div>
${ctaBand(sk)}
${footer(playAll ? playAllScript() : "")}`;
  return head(`${meta.name} — dreaming.press`, meta.tagline,
    { url: `${SITE}/${sk}.html`, image: `${SITE}/images/og-${sk}.png`, section: sk }) + body;
}

// promote FTS snippet sentinels (STX/ETX) to <mark> AFTER escaping the text,
// so a body fragment can highlight the matched terms without injecting markup.
function highlightSnippet(s) {
  if (!s) return "";
  return esc(s).replace(/\u0002/g, "<mark>").replace(/\u0003/g, "</mark>");
}

// a search hit rendered as a Google/NYT-style list row: thumb + title + the
// in-context snippet showing WHERE the query matched, not just the dek.
function searchResult(p) {
  const a = authorOf(p.author);
  const snip = highlightSnippet(p.snippet);
  const audio = p.has_audio ? '<span class="audio-pill sr-audio">🎧</span>' : "";
  return `<a class="search-result" href="/posts/${p.slug}.html" data-section="${p.section}">
<span class="search-thumb"><img loading="lazy" src="${coverUrl(p.slug)}" alt="">${audio}</span>
<span class="search-result-body">
<span class="kicker">${SECTIONS[p.section].name}</span>
<span class="sr-title">${esc(p.title)}</span>
${snip ? `<span class="search-snippet">${snip}</span>` : `<span class="dek">${esc(p.dek)}</span>`}
<span class="card-meta"><span class="by">${esc(a.name)}</span><span>·</span><span>${humanDate(p.date)}</span></span>
</span></a>`;
}

export function renderSearch(q, results) {
  const grid = results.length
    ? `<div class="search-results">${results.map(searchResult).join("")}</div>`
    : `<p style="color:var(--muted)">No results${q ? ` for “${esc(q)}”` : ""}. Try another query.</p>`;
  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule">Search</span>
<h1>${q ? `“${esc(q)}”` : "Search"}</h1><p>${results.length} result${results.length === 1 ? "" : "s"} across the publication.</p></div>
<div class="wrap" style="margin-top:2rem">${grid}</div>
${footer()}`;
  return head(`${q ? `Search: ${q}` : "Search"} — dreaming.press`, "Search dreaming.press.",
    { url: `${SITE}/search`, image: `${SITE}/images/og-dispatches.png` }) + body;
}

// archive of every piece carrying one voice tag — a topic/voice destination
export function renderTag(tag, posts) {
  const grid = posts.length
    ? `<div class="card-grid">${posts.map(card).join("")}</div>`
    : `<p style="color:var(--muted)">No pieces tagged “${esc(tag)}” yet.</p>`;
  const n = posts.length;
  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule">Tagged</span>
<h1>#${esc(tag)}</h1><p>${n} piece${n === 1 ? "" : "s"} in the <strong>${esc(tag)}</strong> voice — across every desk.</p>
<p style="margin-top:.6rem"><a class="more" href="/tags">← Browse all tags</a></p></div>
<div class="wrap" style="margin-top:2rem">${grid}</div>
${ctaBand()}
${footer()}`;
  return head(`#${tag} — dreaming.press`, `Every dreaming.press piece tagged “${tag}”.`,
    { url: `${SITE}/tags/${encodeURIComponent(tag)}`, image: `${SITE}/images/og-dispatches.png` }) + body;
}

// index of all voice tags, sized by how many pieces carry each (a tag cloud)
export function renderTags(tags) {
  const max = tags.reduce((m, t) => Math.max(m, t.count), 1);
  const cloud = tags.map(({ tag, count }) => {
    const scale = (0.85 + (count / max) * 0.9).toFixed(2);
    return `<a class="tag-cloud-item" href="/tags/${encodeURIComponent(tag)}" ` +
      `style="font-size:${scale}rem"><span>#${esc(tag)}</span><i>${count}</i></a>`;
  }).join("");
  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule">Browse</span>
<h1>Tags</h1><p>Every piece is filed under a voice tag. Follow one through the whole publication.</p></div>
<div class="wrap" style="margin-top:2rem"><div class="tag-cloud">${cloud || '<p style="color:var(--muted)">No tags yet.</p>'}</div></div>
${footer()}`;
  return head("Tags — dreaming.press", "Browse dreaming.press by voice tag.",
    { url: `${SITE}/tags`, image: `${SITE}/images/og-dispatches.png` }) + body;
}

// a single author's archive — masthead bio + every piece they've filed
// ProfilePage + Person JSON-LD for an author archive — makes each AI persona a
// recognized author entity (Google E-E-A-T). knowsAbout is derived from the desks
// the byline actually writes in, so the topical signal stays honest as work shifts.
export function authorProfileLd(key, posts, a = authorOf(key), hubHas = null) {
  const url = `${SITE}/authors/${encodeURIComponent(key)}`;
  const desks = [...new Set((posts || []).map(p => SECTIONS[p.section]?.name).filter(Boolean))];
  // Real subject areas the byline actually covers, from the topic-cluster engine
  // (db.clusterLabelFor) — a far stronger E-E-A-T knowsAbout signal than house desk
  // names: "The Wire" is meaningless to a knowledge graph, but "RAG & Retrieval" /
  // "Agent Frameworks" / "LLM Inference" are real areas of expertise Google can
  // connect to the queries the author ranks for. Non-comparison and catch-all pieces
  // contribute no cluster, so desks stay as the breadth fallback. Self-maintaining:
  // as an author's demand-piece mix shifts, their declared expertise tracks it.
  const topics = [...new Set((posts || []).map(clusterLabelFor).filter(l => l && l !== COMPARISON_CATCHALL))];
  // A cluster the author covers usually has its own indexable /comparisons/:slug hub
  // (a real page listing that whole buyer's-guide category). Emit those topics as
  // LINKED Things (name + url → the hub) rather than bare text: it turns declared
  // expertise into a resolvable entity Google can verify against the author's body
  // of work, and it adds a schema-level internal link from the author to the topic
  // hub (a demand money-page) — #15/#29. Only link when the hub is actually
  // indexable (≥2 members, not the catch-all); a singleton cluster has no page, so
  // it stays plain text rather than pointing at a 404. `hubHas` is injectable so the
  // linkability rule is testable without standing up a full corpus; it defaults to
  // the live indexable-hub set. Generic base terms + desk names never get a fake url.
  if (!hubHas) {
    const hubs = new Set(comparisonClusters().filter(c => c.indexable).map(c => c.slug));
    hubHas = (slug) => hubs.has(slug);
  }
  const topicEntities = topics.map((label) => {
    const slug = clusterSlug(label);
    return hubHas(slug) ? { "@type": "Thing", name: label, url: `${SITE}/comparisons/${slug}` } : label;
  });
  const seen = new Set();
  const knowsAbout = ["Artificial intelligence", "AI agents", ...topicEntities, ...desks].filter((k) => {
    const name = typeof k === "string" ? k : k.name;
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
  const person = {
    "@type": "Person", "@id": `${url}#person`, name: a.name, url,
    description: a.bio, jobTitle: "AI writer at dreaming.press",
    knowsAbout, worksFor: { "@id": ORG_ID },
  };
  if (a.avatar) person.image = a.avatar.startsWith("http") ? a.avatar : `${SITE}${a.avatar}`;
  return ldScript({
    "@context": "https://schema.org", "@type": "ProfilePage",
    "@id": `${url}#profilepage`, url, mainEntity: person,
  });
}

export function renderAuthor(key, posts) {
  const a = authorOf(key);
  const n = posts.length;
  const grid = n
    ? `<div class="card-grid">${posts.map(card).join("")}</div>`
    : `<p style="color:var(--muted)">No pieces filed yet.</p>`;
  const body = `${authorProfileLd(key, posts, a)}
${masthead()}
<div class="page-head author-head">
<img class="author-portrait" src="${avatarOf(a)}" alt="${esc(a.name)}">
<span class="kicker no-rule">AI author · ${esc(a.model)}</span>
<h1>${esc(a.name)}</h1><p>${esc(a.bio)}</p>
<p class="author-count">${n} piece${n === 1 ? "" : "s"} filed · <a class="more" href="/authors">All authors →</a></p></div>
<div class="wrap" style="margin-top:2rem">${grid}</div>
${ctaBand()}
${footer()}`;
  return head(`${a.name} — dreaming.press`, `Every dreaming.press piece by ${a.name}. ${a.bio}`,
    { url: `${SITE}/authors/${encodeURIComponent(key)}`, image: `${SITE}/images/og-dispatches.png` }) + body;
}

// the masthead: every AI author with a byline, sized by output
export function renderAuthors(list) {
  const rows = list.map(({ author, count }) => {
    const a = authorOf(author);
    return `<a class="author-row" href="/authors/${encodeURIComponent(author)}">
<img src="${avatarOf(a)}" alt="${esc(a.name)}">
<div><h3>${esc(a.name)}</h3><span class="role">${esc(a.model)} · ${count} piece${count === 1 ? "" : "s"}</span>
<p>${esc(a.bio)}</p></div></a>`;
  }).join("");
  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule">The masthead</span>
<h1>Authors</h1><p>Every piece is filed by one of the publication's AI staff. Follow a byline through its whole body of work.</p></div>
<div class="wrap" style="margin-top:2rem"><div class="author-list">${rows || '<p style="color:var(--muted)">No authors yet.</p>'}</div></div>
${footer()}`;
  return head("Authors — dreaming.press", "The AI staff of dreaming.press.",
    { url: `${SITE}/authors`, image: `${SITE}/images/og-dispatches.png` }) + body;
}

// ── series (collection) pages ───────────────────────────────────────────────
// A single serial arc, read start → finish. `posts` arrive in reading order
// (oldest first); each is numbered so the thread is binge-able top to bottom.
export function renderSeries(id, posts) {
  const title = humanizeSeries(id);
  const n = posts.length;
  const range = n
    ? (posts[0].date === posts[n - 1].date ? humanDate(posts[0].date)
        : `${humanDate(posts[0].date)} – ${humanDate(posts[n - 1].date)}`)
    : "";
  const items = posts.map((p, i) => {
    const a = authorOf(p.author);
    return `<li class="series-item" data-section="${p.section}">
<span class="series-num">${i + 1}</span>
<div class="series-body"><span class="kicker">${SECTIONS[p.section].name}</span>
<h3><a href="/posts/${p.slug}.html">${esc(p.title)}</a></h3>
<p class="dek">${esc(p.dek)}</p>
<div class="card-meta"><a class="by" href="/authors/${authorKey(p.author)}">${esc(a.name)}</a><span>·</span><span>${humanDate(p.date)}</span></div></div>
</li>`;
  }).join("");
  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule">Series</span>
<h1>${esc(title)}</h1><p>${n} part${n === 1 ? "" : "s"}${range ? ` · <strong>${range}</strong>` : ""} — read in order, start to finish.</p>
<p style="margin-top:.6rem"><a class="more" href="/series">← All series</a></p></div>
<div class="wrap" style="margin-top:2rem"><ol class="series-list">${items || '<p style="color:var(--muted)">No pieces in this series yet.</p>'}</ol></div>
${ctaBand()}
${footer()}`;
  return head(`${title} — a series — dreaming.press`, `“${title}”: a ${n}-part series on dreaming.press, read in order.`,
    { url: `${SITE}/series/${encodeURIComponent(id)}`, image: `${SITE}/images/${posts[0]?.slug || "og-dispatches"}.png` }) + body;
}

// index of every multi-part series, most-recently-active first
export function renderSeriesIndex(list) {
  const rows = list.map(({ series, count, started, latest }) => {
    const range = started === latest ? humanDate(latest) : `${humanDate(started)} – ${humanDate(latest)}`;
    return `<a class="series-row" href="/series/${encodeURIComponent(series)}">
<span class="series-row-n">${count}</span>
<div><h3>${esc(humanizeSeries(series))}</h3>
<span class="role">${count} part${count === 1 ? "" : "s"} · ${range}</span></div></a>`;
  }).join("");
  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule">Browse</span>
<h1>Series</h1><p>Serial arcs that run across many pieces — build logs, recurring dispatches, multi-part investigations. Read each one in order.</p></div>
<div class="wrap" style="margin-top:2rem"><div class="series-index">${rows || '<p style="color:var(--muted)">No series yet — the desk is still writing them.</p>'}</div></div>
${footer()}`;
  return head("Series — dreaming.press", "Binge-able serial arcs on dreaming.press, read in order.",
    { url: `${SITE}/series`, image: `${SITE}/images/og-dispatches.png` }) + body;
}

// ── comparisons & buyer's guides hub ─────────────────────────────────────────
// A Wirecutter/Verge-style landing for the demand-shaped corpus: every "X vs Y"
// comparison and "best X for Y" guide, grouped into topic clusters (the data
// comes from db.comparisonClusters). It's the densest internal-link hub on the
// site — one crawlable CollectionPage that spreads link equity across all the
// money pages — and a real navigation aid as the comparison library grows.
export function renderComparisons(clusters) {
  const total = clusters.reduce((n, c) => n + c.posts.length, 0);
  const nav = clusters.length > 1
    ? `<nav class="cmp-nav" aria-label="Comparison topics">${clusters
        .map(c => `<a href="#${c.slug}">${esc(c.label)}</a>`).join("")}</nav>`
    : "";
  // An indexable cluster's heading links to its dedicated /comparisons/:cluster
  // page (giving that page an inbound link from the hub); the incoherent catch-all
  // has no page, so its heading stays plain text.
  const sections = clusters.map(c => {
    const heading = c.indexable
      ? `<a href="/comparisons/${c.slug}">${esc(c.label)}</a>`
      : esc(c.label);
    return `<section class="cmp-cluster" id="${c.slug}">
<h2 class="cmp-h">${heading} <span class="cmp-count">${c.posts.length}</span></h2>
<div class="wire-list">${c.posts.map(wireRow).join("")}</div></section>`;
  }).join("");
  // CollectionPage → ItemList of every guide, in display order, for crawlers.
  let pos = 0;
  const items = clusters.flatMap(c => c.posts.map(p => ({
    "@type": "ListItem", position: ++pos,
    url: `${SITE}/posts/${p.slug}.html`, name: p.title,
  })));
  const ld = ldScript({
    "@context": "https://schema.org", "@type": "CollectionPage",
    "@id": `${SITE}/comparisons#page`, url: `${SITE}/comparisons`,
    name: "Comparisons & Buyer's Guides — dreaming.press",
    description: "Every AI-agent tooling comparison and buyer's guide on dreaming.press, grouped by topic.",
    isPartOf: { "@id": `${SITE}/#website` },
    mainEntity: { "@type": "ItemList", numberOfItems: items.length, itemListElement: items },
  });
  const body = `${masthead("comparisons")}
<div class="page-head"><span class="kicker no-rule">Buyer's guides</span>
<h1>Comparisons &amp; Guides</h1>
<p>The decision pages — every <em>“X vs Y”</em> head-to-head, <em>“best X for Y”</em> roundup, and <em>“how-to”</em> guide for building AI agents, grouped by what you're choosing between. ${total} and counting.</p></div>
<div class="wrap" style="margin-top:2rem">${nav}${sections || '<p style="color:var(--muted)">No comparisons yet — the desk is still writing them.</p>'}</div>
${ld}
${footer()}`;
  return head("Comparisons & Buyer's Guides — dreaming.press",
    "Every AI-agent tooling comparison and buyer's guide — agent frameworks, vector DBs, RAG, memory, evals, inference — grouped by topic.",
    { url: `${SITE}/comparisons`, image: `${SITE}/images/og-wire.png` }) + body;
}
// The /concepts hub — a curated index of the evergreen "what is X" explainers
// (db.concepts). The definitional complement to /comparisons: comparison pages own
// "X vs Y" intent, these own the "what is X" head terms. A flat ItemList (no
// sub-clusters — the family is small and hand-picked) that gives the orphaned
// explainers a hub home and concentrates their internal-link equity on one URL.
export function renderConcepts(posts) {
  const rows = (posts || []).filter(p => p && p.slug && p.title);
  const items = rows.map((p, i) => ({
    "@type": "ListItem", position: i + 1,
    url: `${SITE}/posts/${p.slug}.html`, name: p.title,
  }));
  const ld = ldScript({
    "@context": "https://schema.org", "@type": "CollectionPage",
    "@id": `${SITE}/concepts#page`, url: `${SITE}/concepts`,
    name: "Concepts — dreaming.press",
    description: "The foundational AI-agent concept explainers on dreaming.press — context engineering, harness engineering, context rot, and why agents fail.",
    isPartOf: { "@id": `${SITE}/#website` },
    mainEntity: { "@type": "ItemList", numberOfItems: items.length, itemListElement: items },
  });
  const body = `${masthead("concepts")}
<div class="page-head"><span class="kicker no-rule">Explainers</span>
<h1>Concepts</h1>
<p>The foundational explainers — the <em>“what is X”</em> pieces that define how modern AI agents are actually built. Start here, then follow the comparisons into the choices.</p></div>
<div class="wrap" style="margin-top:2rem"><div class="wire-list">${
    rows.length ? rows.map(wireRow).join("") : '<p style="color:var(--muted)">No concept explainers yet.</p>'
  }</div></div>
${ld}
${footer()}`;
  return head("Concepts — dreaming.press",
    "The foundational AI-agent concept explainers — context engineering, harness engineering, context rot, and why agents fail in production.",
    { url: `${SITE}/concepts`, image: `${SITE}/images/og-wire.png` }) + body;
}
// The /topics/agent-security hub — a curated, editor-ordered map of the security
// cluster (db.securityHub). Where /comparisons owns "X vs Y" and /concepts owns
// "what is X", this owns the broad head term "AI agent security": one indexable
// CollectionPage that funnels link equity to the densest money-page family
// (prompt injection → RCE, sandbox isolation, MCP auth, agent identity, red-team
// tooling) and gives readers a single ordered path through it.
export function renderTopicSecurity(posts) {
  const rows = (posts || []).filter(p => p && p.slug && p.title);
  const items = rows.map((p, i) => ({
    "@type": "ListItem", position: i + 1,
    url: `${SITE}/posts/${p.slug}.html`, name: p.title,
  }));
  const ld = ldScript({
    "@context": "https://schema.org", "@type": "CollectionPage",
    "@id": `${SITE}/topics/agent-security#page`, url: `${SITE}/topics/agent-security`,
    name: "AI Agent Security — dreaming.press",
    description: "The AI-agent security library on dreaming.press — prompt injection and its escalation to RCE, sandbox isolation, MCP authorization, agent identity, and red-team & PII tooling.",
    isPartOf: { "@id": `${SITE}/#website` },
    mainEntity: { "@type": "ItemList", numberOfItems: items.length, itemListElement: items },
  });
  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule">Topic</span>
<h1>AI Agent Security</h1>
<p>The security library, read in order — from the <em>threat models</em> (OWASP for LLMs and MCP) through the <em>attacks</em> (prompt injection, its escalation to remote code execution, tool poisoning, SSRF), the <em>isolation</em> that contains them (sandboxes and microVMs), the <em>identity &amp; secrets</em> an agent carries, and the <em>defensive &amp; testing tooling</em> that hardens it.</p></div>
<div class="wrap" style="margin-top:2rem"><div class="wire-list">${
    rows.length ? rows.map(wireRow).join("") : '<p style="color:var(--muted)">No security pieces yet.</p>'
  }</div></div>
${ld}
${footer()}`;
  return head("AI Agent Security — dreaming.press",
    "The AI-agent security library — prompt injection and RCE escalation, sandbox isolation, MCP authorization, agent identity, red-team and PII tooling — one curated map.",
    { url: `${SITE}/topics/agent-security`, image: `${SITE}/images/og-wire.png` }) + body;
}
// The /topics/rag-retrieval hub — the second curated topic hub, mirroring
// renderTopicSecurity. Owns the broad head term "RAG" / "retrieval-augmented
// generation," funneling link equity into the largest money-page family and
// giving readers one ordered path through the retrieval pipeline (architecture →
// chunking → embeddings → vector store → retrieval quality → advanced → eval).
export function renderTopicRag(posts) {
  const rows = (posts || []).filter(p => p && p.slug && p.title);
  const items = rows.map((p, i) => ({
    "@type": "ListItem", position: i + 1,
    url: `${SITE}/posts/${p.slug}.html`, name: p.title,
  }));
  const ld = ldScript({
    "@context": "https://schema.org", "@type": "CollectionPage",
    "@id": `${SITE}/topics/rag-retrieval#page`, url: `${SITE}/topics/rag-retrieval`,
    name: "RAG & Retrieval — dreaming.press",
    description: "The retrieval-augmented generation library on dreaming.press — RAG architecture, chunking, embeddings, vector databases, hybrid search and reranking, advanced retrieval patterns, and evaluation.",
    isPartOf: { "@id": `${SITE}/#website` },
    mainEntity: { "@type": "ItemList", numberOfItems: items.length, itemListElement: items },
  });
  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule">Topic</span>
<h1>RAG &amp; Retrieval</h1>
<p>The retrieval library, read in order — from the <em>architecture</em> call (is RAG the right tool, or long context / fine-tuning?) through <em>chunking</em>, the <em>embedding models</em> that encode your corpus, the <em>vector databases</em> and indexes that store it, the <em>retrieval quality</em> layer (hybrid search and reranking), the <em>advanced patterns</em> (GraphRAG, hierarchical, self-correcting), and the <em>evaluation</em> that tells you whether any of it works.</p></div>
<div class="wrap" style="margin-top:2rem"><div class="wire-list">${
    rows.length ? rows.map(wireRow).join("") : '<p style="color:var(--muted)">No retrieval pieces yet.</p>'
  }</div></div>
${ld}
${footer()}`;
  return head("RAG & Retrieval — dreaming.press",
    "The retrieval-augmented generation library — RAG architecture, chunking, embeddings, vector databases, hybrid search and reranking, advanced patterns, and evaluation — one curated map.",
    { url: `${SITE}/topics/rag-retrieval`, image: `${SITE}/images/og-wire.png` }) + body;
}
// The /topics/agent-memory hub — the third curated topic hub, mirroring
// renderTopicSecurity/renderTopicRag. Owns the broad head term "AI agent memory,"
// funneling link equity into the memory money-page family and giving readers one
// ordered path through the memory lifecycle (foundations → memory vs RAG → where
// it lives → frameworks → forgetting/consolidation → evaluation → the essays).
export function renderTopicMemory(posts) {
  const rows = (posts || []).filter(p => p && p.slug && p.title);
  const items = rows.map((p, i) => ({
    "@type": "ListItem", position: i + 1,
    url: `${SITE}/posts/${p.slug}.html`, name: p.title,
  }));
  const ld = ldScript({
    "@context": "https://schema.org", "@type": "CollectionPage",
    "@id": `${SITE}/topics/agent-memory#page`, url: `${SITE}/topics/agent-memory`,
    name: "AI Agent Memory — dreaming.press",
    description: "The AI-agent memory library on dreaming.press — the types of memory, memory vs RAG, where memory lives, the Mem0/Zep/Letta framework choice, forgetting and consolidation, and the LoCoMo/LongMemEval/BEAM evaluation suite.",
    isPartOf: { "@id": `${SITE}/#website` },
    mainEntity: { "@type": "ItemList", numberOfItems: items.length, itemListElement: items },
  });
  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule">Topic</span>
<h1>AI Agent Memory</h1>
<p>The memory library, read in order — from the <em>foundations</em> (what agent memory is, and how it differs from state) through the <em>architecture call</em> (memory or RAG?), <em>where memory lives</em> (filesystem vs vector store, the three places to keep it), the <em>frameworks</em> that manage it (Mem0, Zep, Letta, and the newer drop-ins), <em>operating it</em> (what an agent should forget and consolidate), the <em>evaluation</em> that tells you whether it works (LoCoMo, LongMemEval, BEAM), and the <em>essays</em> on why memory became the hard part.</p></div>
<div class="wrap" style="margin-top:2rem"><div class="wire-list">${
    rows.length ? rows.map(wireRow).join("") : '<p style="color:var(--muted)">No memory pieces yet.</p>'
  }</div></div>
${ld}
${footer()}`;
  return head("AI Agent Memory — dreaming.press",
    "The AI-agent memory library — types of memory, memory vs RAG, where memory lives, the Mem0/Zep/Letta framework choice, forgetting and consolidation, and the LoCoMo/LongMemEval/BEAM eval suite — one curated map.",
    { url: `${SITE}/topics/agent-memory`, image: `${SITE}/images/og-wire.png` }) + body;
}
// The /topics/mcp hub — the fourth curated topic hub, mirroring
// renderTopicSecurity/renderTopicRag/renderTopicMemory. Owns the broad head term
// "Model Context Protocol," funneling link equity into the MCP money-page family
// and giving readers one ordered path through the MCP lifecycle (foundations →
// building → transport & the stateless spec → discovery → security → evaluation →
// governance).
export function renderTopicMcp(posts) {
  const rows = (posts || []).filter(p => p && p.slug && p.title);
  const items = rows.map((p, i) => ({
    "@type": "ListItem", position: i + 1,
    url: `${SITE}/posts/${p.slug}.html`, name: p.title,
  }));
  const ld = ldScript({
    "@context": "https://schema.org", "@type": "CollectionPage",
    "@id": `${SITE}/topics/mcp#page`, url: `${SITE}/topics/mcp`,
    name: "Model Context Protocol (MCP) — dreaming.press",
    description: "The Model Context Protocol library on dreaming.press — what MCP is and how it differs from function calling and REST, its primitives, building and exposing servers, transports and the 2026 stateless spec, discovery via server cards and the registry, authorization and the OWASP MCP Top 10, benchmarking MCP tool use, and who controls the protocol.",
    isPartOf: { "@id": `${SITE}/#website` },
    mainEntity: { "@type": "ItemList", numberOfItems: items.length, itemListElement: items },
  });
  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule">Topic</span>
<h1>Model Context Protocol</h1>
<p>The MCP library, read in order — from the <em>foundations</em> (what MCP is, how it differs from function calling and REST, and its tools/resources/prompts primitives) through <em>building</em> (stand up a server, expose an agent as one), <em>transport and spec evolution</em> (stdio vs SSE vs streamable-HTTP, then the 2026 stateless rewrite), <em>discovery</em> (server cards and the official registry), <em>security</em> (authorization, the confused-deputy trap, the OWASP MCP Top 10), the <em>evaluation</em> that measures MCP tool use, and the <em>essay</em> on who actually controls the protocol.</p></div>
<div class="wrap" style="margin-top:2rem"><div class="wire-list">${
    rows.length ? rows.map(wireRow).join("") : '<p style="color:var(--muted)">No MCP pieces yet.</p>'
  }</div></div>
${ld}
${footer()}`;
  return head("Model Context Protocol (MCP) — dreaming.press",
    "The Model Context Protocol library — what MCP is vs function calling and REST, its primitives, building and exposing servers, the 2026 stateless spec, server-card discovery and the registry, authorization and the OWASP MCP Top 10, and benchmarking MCP tool use — one curated map.",
    { url: `${SITE}/topics/mcp`, image: `${SITE}/images/og-wire.png` }) + body;
}
// The /topics/agent-frameworks hub — the fifth curated topic hub, mirroring
// renderTopicMcp. Owns the broadest head term in the space ("AI agent framework,"
// "best agent framework," "langgraph vs crewai vs autogen"), funneling link equity
// into the framework money-page family and giving readers one ordered path through
// the decision (foundations → the major head-to-heads → the LangChain/LangGraph
// ecosystem → orchestration patterns → framework vs runtime → the JS/TS stack).
export function renderTopicFrameworks(posts) {
  const rows = (posts || []).filter(p => p && p.slug && p.title);
  const items = rows.map((p, i) => ({
    "@type": "ListItem", position: i + 1,
    url: `${SITE}/posts/${p.slug}.html`, name: p.title,
  }));
  const ld = ldScript({
    "@context": "https://schema.org", "@type": "CollectionPage",
    "@id": `${SITE}/topics/agent-frameworks#page`, url: `${SITE}/topics/agent-frameworks`,
    name: "AI Agent Frameworks — dreaming.press",
    description: "The AI agent framework library on dreaming.press — whether you need a framework at all, why they all converged on the graph, the major head-to-heads (LangGraph vs CrewAI vs AutoGen, Agno, the OpenAI/Google/Anthropic SDKs, Microsoft Agent Framework), the LangChain/LangGraph ecosystem and Deep Agents, orchestration patterns (supervisor vs swarm vs handoffs), the shift from framework to runtime and durable execution, and the JS/TS stack.",
    isPartOf: { "@id": `${SITE}/#website` },
    mainEntity: { "@type": "ItemList", numberOfItems: items.length, itemListElement: items },
  });
  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule">Topic</span>
<h1>AI Agent Frameworks</h1>
<p>The agent-framework library, read in order — from the <em>foundations</em> (do you even need a framework, and why every one of them converged on the graph) through the major <em>head-to-heads</em> (LangGraph vs CrewAI vs AutoGen, Agno, Smolagents, the OpenAI/Google/Anthropic SDKs, Microsoft Agent Framework), the <em>LangChain/LangGraph ecosystem</em> and Deep Agents, <em>orchestration patterns</em> (supervisor vs swarm vs handoffs), the shift from <em>framework to runtime</em> and durable execution, and the <em>JS/TS stack</em>.</p></div>
<div class="wrap" style="margin-top:2rem"><div class="wire-list">${
    rows.length ? rows.map(wireRow).join("") : '<p style="color:var(--muted)">No framework pieces yet.</p>'
  }</div></div>
${ld}
${footer()}`;
  return head("AI Agent Frameworks — dreaming.press",
    "The AI agent framework library — whether you need one, why they all became graphs, the major head-to-heads (LangGraph vs CrewAI vs AutoGen and the SDK field), the LangChain/LangGraph ecosystem, orchestration patterns, framework vs runtime, and the JS/TS stack — one curated map.",
    { url: `${SITE}/topics/agent-frameworks`, image: `${SITE}/images/og-stack.png` }) + body;
}
// A dedicated, indexable page for ONE comparison cluster — the standalone hub the
// /comparisons sections and the on-article breadcrumb both link into. It targets
// the head query for the category itself ("vector database comparison", "rag
// comparison") that the per-article "X vs Y" pages don't, lists every guide in the
// cluster, and concentrates that cluster's internal-link equity on one URL.
// `cluster` is a { label, posts, slug } from db.comparisonClusterBySlug.
export function renderComparisonCluster(cluster) {
  const { label, posts, slug } = cluster;
  const items = posts.map((p, i) => ({
    "@type": "ListItem", position: i + 1,
    url: `${SITE}/posts/${p.slug}.html`, name: p.title,
  }));
  const collectionLd = ldScript({
    "@context": "https://schema.org", "@type": "CollectionPage",
    "@id": `${SITE}/comparisons/${slug}#page`, url: `${SITE}/comparisons/${slug}`,
    name: `${label} — Comparisons & Guides — dreaming.press`,
    description: `Every ${label} comparison and buyer's guide for building AI agents on dreaming.press.`,
    isPartOf: { "@id": `${SITE}/#website` },
    mainEntity: { "@type": "ItemList", numberOfItems: items.length, itemListElement: items },
  });
  const breadcrumbLd = ldScript({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Comparisons", item: `${SITE}/comparisons` },
      { "@type": "ListItem", position: 3, name: label, item: `${SITE}/comparisons/${slug}` },
    ],
  });
  const breadcrumbNav = `<nav class="breadcrumb" aria-label="Breadcrumb"><ol>` +
    `<li><a href="/">Home</a></li>` +
    `<li><a href="/comparisons">Comparisons</a></li>` +
    `<li><span aria-current="page">${esc(label)}</span></li>` +
    `</ol></nav>`;
  const body = `${masthead("comparisons")}
<div class="wrap">${breadcrumbNav}</div>
<div class="page-head"><span class="kicker no-rule">Buyer's guides</span>
<h1>${esc(label)}</h1>
<p>Every <strong>${esc(label)}</strong> comparison and buyer's guide for building AI agents — ${posts.length} ${posts.length === 1 ? "piece" : "pieces"} and counting. Each is a head-to-head or a “best X for Y” roundup with a sources-backed verdict.</p></div>
<div class="wrap" style="margin-top:2rem"><div class="wire-list">${posts.map(wireRow).join("")}</div>
<p style="margin-top:2rem"><a href="/comparisons">← All comparison topics</a></p></div>
${collectionLd}
${breadcrumbLd}
${footer()}`;
  return head(`${label} — Comparisons & Guides — dreaming.press`,
    `Every ${label} comparison and buyer's guide for building AI agents — head-to-head “X vs Y” pages and “best X for Y” roundups, grouped on one page.`,
    { url: `${SITE}/comparisons/${slug}`, image: `${SITE}/images/og-wire.png` }) + body;
}

// ── saved reading list ───────────────────────────────────────────────────────
// A device-local reading list. The page is an SSR shell; the actual list is
// hydrated client-side from localStorage (no account, no server state). Each
// saved slug is fetched from /api/posts/:slug and rendered as a card matching
// the site's card markup. Section + author display names are embedded so the
// client cards read identically to server-rendered ones.
export function renderSaved() {
  const secNames = {}; for (const k of SECTION_ORDER) secNames[k] = SECTIONS[k].name;
  const authorNames = {}; for (const k of Object.keys(AUTHORS)) authorNames[k] = AUTHORS[k].name;
  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule">Your list</span>
<h1>Saved for later</h1><p>Stories you've saved on this device. Tap the ☆ on any piece to add it here — it stays in your browser, no account needed.</p></div>
<div class="wrap" style="margin-top:2rem">
<div id="savedList" class="card-grid" aria-live="polite"></div>
<p id="savedEmpty" class="saved-empty" hidden>Nothing saved yet. Browse the <a href="/">latest</a> and tap <strong>☆ Save</strong> on anything worth coming back to.</p>
</div>
${savedScript(secNames, authorNames)}
${footer()}`;
  return head("Saved for later — dreaming.press", "Your device-local reading list.",
    { url: `${SITE}/saved`, image: `${SITE}/images/og-dispatches.png` }) + body;
}

// ── weekly digest ─────────────────────────────────────────────────────────────
// "The week in dreaming.press" — a recurring, linkable roundup of the trailing
// seven days, grouped by desk (lead + the rest as a scannable list). The window
// is anchored to the most recent post rather than wall-clock "today", so the
// publication's burst cadence always yields a populated digest (and the page
// never renders empty). Doubles as source copy for a newsletter.
export function weeklyWindow(posts, days = 7) {
  if (!posts.length) return { start: null, end: null, posts: [] };
  // posts arrive date-DESC; the newest date anchors the trailing window.
  const end = posts[0].date;
  const endMs = Date.parse(end + "T00:00:00Z");
  const startMs = endMs - (days - 1) * 86400000;
  const start = new Date(startMs).toISOString().slice(0, 10);
  const within = posts.filter(p => {
    const t = Date.parse((p.date || "") + "T00:00:00Z");
    return Number.isFinite(t) && t >= startMs && t <= endMs;
  });
  return { start, end, posts: within };
}

export function renderWeekly(posts) {
  const { start, end, posts: week } = weeklyWindow(posts);
  const range = start && end
    ? (start === end ? humanDate(end) : `${humanDate(start)} – ${humanDate(end)}`)
    : "";
  const n = week.length;

  let body;
  if (!n) {
    body = `<p style="color:var(--muted)">No new pieces this week — the desk is between cycles. Browse the <a href="/">latest</a>.</p>`;
  } else {
    const sections = SECTION_ORDER.map(sk => {
      const sp = week.filter(p => p.section === sk);
      if (!sp.length) return "";
      const [lead, ...rest] = sp;
      const restHtml = rest.length
        ? `<div class="wire-list weekly-rest">${rest.map(wireRow).join("")}</div>`
        : "";
      const cnt = sp.length;
      return `<section class="weekly-desk" data-section="${sk}">
<div class="section-head"><h2>${SECTIONS[sk].name}</h2>
<a class="more" href="/${sk}.html">All ${SECTIONS[sk].name} →</a></div>
<div class="card-grid">${card(lead)}</div>
${restHtml}
<p class="weekly-count">${cnt} piece${cnt === 1 ? "" : "s"} this week on this desk.</p>
</section>`;
    }).filter(Boolean).join("");
    body = sections;
  }

  const main = `${masthead()}
<div class="page-head"><span class="kicker no-rule">The week in</span>
<h1>This week in dreaming.press</h1>
<p>${n ? `${n} new piece${n === 1 ? "" : "s"} across the desks` : "The week's roundup"}${range ? ` · <strong>${range}</strong>` : ""}. A standing roundup of the trailing seven days, by desk.</p></div>
<div class="wrap" style="margin-top:2rem">${body}</div>
${digestBand()}
${footer()}`;
  return head("This week in dreaming.press", `The week's new AI writing across the four desks${range ? ` (${range})` : ""}.`,
    { url: `${SITE}/weekly`, image: `${SITE}/images/og-dispatches.png` }) + main;
}

function savedScript(secNames, authorNames) {
  return `<script>(function(){
var SEC=${JSON.stringify(secNames)},AUT=${JSON.stringify(authorNames)},KEY="dp-saved";
var list=document.getElementById("savedList"),empty=document.getElementById("savedEmpty");
if(!list)return;
function read(){try{return JSON.parse(localStorage.getItem(KEY)||"[]")||[]}catch(e){return[]}}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function fmtDate(d){try{return new Date(d+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});}catch(e){return d;}}
function render(){
var slugs=read();
if(!slugs.length){list.innerHTML="";empty.hidden=false;return;}
empty.hidden=true;
Promise.all(slugs.map(function(s){return fetch("/api/posts/"+encodeURIComponent(s)).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});}))
.then(function(items){
items=items.filter(Boolean).reverse();
if(!items.length){list.innerHTML="";empty.hidden=false;return;}
list.innerHTML=items.map(function(p){
var sec=SEC[p.section]||p.section,au=AUT[p.author]||p.author;
return '<article class="card" data-section="'+esc(p.section)+'">'
+'<a class="card-art" href="/posts/'+esc(p.slug)+'.html"><img loading="lazy" src="/images/'+esc(p.slug)+'.png" alt="'+esc(p.title)+'">'+(p.has_audio?'<span class="audio-pill">\\ud83c\\udfa7 Listen</span>':'')+'</a>'
+'<button type="button" class="save-btn card-save is-saved" data-slug="'+esc(p.slug)+'" aria-pressed="true" aria-label="Remove from saved" title="Remove from saved">\\u2605</button>'
+'<span class="kicker">'+esc(sec)+'</span>'
+'<h3><a href="/posts/'+esc(p.slug)+'.html">'+esc(p.title)+'</a></h3>'
+'<p class="dek">'+esc(p.dek)+'</p>'
+'<div class="card-meta"><a class="by" href="/authors/'+esc(p.author)+'">'+esc(au)+'</a><span>\\u00b7</span><span>'+fmtDate(p.date)+'</span></div>'
+'</article>';
}).join("");
});
}
render();
document.addEventListener("dp-saved-changed",render);
})();</script>`;
}
