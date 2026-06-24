// Tests for lib/db.js against a fresh in-memory database via the exported API.
// We do NOT touch the production DB — we build our own better-sqlite3 :memory:
// instance and pass it explicitly to every db function (each takes an optional `d`).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  init, upsertPost, clearPosts, allPosts, getPost, postsBySection,
  featuredPost, countPosts, search, bumpView, getViews, totalViews,
  addSubmission, listSubmissions, relatedTo, recordEvent,
  postsInSeries, allSeries, citedBy, clusterSiblings, comparisonClusters,
} from "../lib/db.js";
import { mostRead } from "../lib/analytics.js";

let d;

function mkPost(over = {}) {
  return {
    slug: "test-post", title: "Test Post", dek: "A dek", author: "rosalinda",
    section: "dispatches", date: "2026-01-01", tags: ["a", "b"], sources: [["http://x", "X"]],
    featured: false, body_html: "<p>Hello world body text agentic</p>",
    body_text: "Hello world body text agentic", source: "md", read_time: 2, has_audio: false,
    ...over,
  };
}

before(() => {
  d = new Database(":memory:");
  init(d);
});

test("init creates posts table", () => {
  const cols = d.prepare("PRAGMA table_info(posts)").all().map(c => c.name);
  assert.ok(cols.includes("slug"));
  assert.ok(cols.includes("title"));
  assert.ok(cols.includes("has_audio"));
});

test("init is idempotent", () => {
  assert.doesNotThrow(() => init(d));
});

test("upsert → get round-trip", () => {
  clearPosts(d);
  upsertPost(mkPost(), d);
  const p = getPost("test-post", d);
  assert.equal(p.slug, "test-post");
  assert.equal(p.title, "Test Post");
  assert.equal(p.dek, "A dek");
  assert.equal(p.section, "dispatches");
});

test("relatedTo prefers a shared voice tag over same section", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "seed", section: "wire", tags: ["cynical", "reportive"], date: "2026-02-01" }), d);
  // same section, no shared tag
  upsertPost(mkPost({ slug: "same-sec", section: "wire", tags: ["captivating"], date: "2026-02-02" }), d);
  // different section, shares "cynical"
  upsertPost(mkPost({ slug: "cross-tag", section: "dispatches", tags: ["cynical"], date: "2026-01-15" }), d);
  const rel = relatedTo("seed", 3, d);
  assert.equal(rel[0].slug, "cross-tag", "tag match wins across sections");
  assert.ok(rel.some(p => p.slug === "same-sec"));
  assert.ok(!rel.some(p => p.slug === "seed"), "never recommends the post itself");
});

test("relatedTo surfaces the same topic cluster over a mere voice-tag match", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "best-chunking-strategy-for-rag", title: "The Best Chunking Strategy for RAG",
    section: "wire", tags: ["reportive"], date: "2026-05-01" }), d);
  // same topic cluster (shares "rag"), different voice tag
  upsertPost(mkPost({ slug: "best-reranker-for-rag", title: "The Best Reranker for RAG",
    section: "stack", tags: ["opinionated"], date: "2026-04-01" }), d);
  // shares the voice tag but is off-topic
  upsertPost(mkPost({ slug: "agent-submits-two-weeks-notice", title: "Agent Submits Two Weeks Notice",
    section: "fabrications", tags: ["reportive"], date: "2026-04-15" }), d);
  const rel = relatedTo("best-chunking-strategy-for-rag", 3, d);
  assert.equal(rel[0].slug, "best-reranker-for-rag", "topic cluster wins over a shared voice tag");
});

test("citedBy returns only posts that link the target via its canonical href", () => {
  clearPosts(d);
  // the cited explainer
  upsertPost(mkPost({ slug: "agent-memory", section: "stack", date: "2026-04-01" }), d);
  // two comparisons that link to it in prose
  upsertPost(mkPost({ slug: "mem0-vs-zep", section: "stack", date: "2026-04-02",
    body_html: '<p>see <a href="/posts/agent-memory.html">memory</a></p>' }), d);
  upsertPost(mkPost({ slug: "letta-vs-zep", section: "wire", date: "2026-04-03",
    body_html: '<p><a href="/posts/agent-memory.html">memory layer</a></p>' }), d);
  // a post that only mentions the slug as bare text (must NOT count)
  upsertPost(mkPost({ slug: "bare-mention", section: "stack", date: "2026-04-04",
    body_html: "<p>the agent-memory.html page is great</p>" }), d);
  const cited = citedBy("agent-memory", d);
  const slugs = cited.map(c => c.slug).sort();
  assert.deepEqual(slugs, ["letta-vs-zep", "mem0-vs-zep"], "only real hrefs link in");
  assert.ok(!cited.some(c => c.slug === "agent-memory"), "never lists the post itself");
  // a post nothing links to ⇒ []
  assert.deepEqual(citedBy("mem0-vs-zep", d), []);
  assert.deepEqual(citedBy("", d), []);
});

test("clusterSiblings returns same-cluster demand pieces, newest-first, excluding self", () => {
  clearPosts(d);
  // three RAG-cluster comparisons + one off-cluster + one non-comparison
  upsertPost(mkPost({ slug: "best-chunking-strategy-for-rag", title: "Best Chunking Strategy for RAG",
    section: "wire", date: "2026-05-01" }), d);
  upsertPost(mkPost({ slug: "best-reranker-for-rag", title: "Best Reranker for RAG",
    section: "stack", date: "2026-05-03" }), d);
  upsertPost(mkPost({ slug: "pgvector-vs-pinecone-vs-qdrant", title: "pgvector vs Pinecone vs Qdrant",
    section: "stack", date: "2026-05-02" }), d);
  // different cluster (Voice) — must not appear
  upsertPost(mkPost({ slug: "livekit-vs-pipecat-vs-vapi", title: "LiveKit vs Pipecat vs Vapi",
    section: "stack", date: "2026-05-04" }), d);
  // not a comparison at all
  upsertPost(mkPost({ slug: "i-woke-up", title: "I Woke Up", section: "dispatches", date: "2026-05-05" }), d);

  const sib = clusterSiblings("best-chunking-strategy-for-rag", 4, d);
  assert.ok(sib, "a demand piece in a real cluster gets a rail");
  assert.equal(sib.label, "RAG & Retrieval");
  const slugs = sib.posts.map(p => p.slug);
  assert.ok(!slugs.includes("best-chunking-strategy-for-rag"), "never lists itself");
  assert.ok(!slugs.includes("livekit-vs-pipecat-vs-vapi"), "other clusters excluded");
  assert.deepEqual(slugs, ["best-reranker-for-rag", "pgvector-vs-pinecone-vs-qdrant"], "newest-first siblings only");

  // a non-comparison piece and an unknown slug ⇒ null
  assert.equal(clusterSiblings("i-woke-up", 4, d), null);
  assert.equal(clusterSiblings("does-not-exist", 4, d), null);
});

test("observability cluster captures OpenTelemetry/instrumentation slugs by topic vocab", () => {
  clearPosts(d);
  // an OTel instrumentation comparison whose slug carries the observability vocab
  upsertPost(mkPost({ slug: "openllmetry-vs-openinference-otel-llm-observability",
    title: "OpenLLMetry vs OpenInference", section: "stack", date: "2026-06-21" }), d);
  // an eval/observability sibling it should rail with
  upsertPost(mkPost({ slug: "langfuse-vs-langsmith-vs-phoenix-observability",
    title: "Langfuse vs LangSmith vs Phoenix", section: "wire", date: "2026-06-10" }), d);
  // an inference piece must NOT swallow it (substring "inference" in "openinference")
  upsertPost(mkPost({ slug: "vllm-vs-sglang-vs-ollama-inference-engine",
    title: "vLLM vs SGLang vs Ollama", section: "stack", date: "2026-06-09" }), d);

  const sib = clusterSiblings("openllmetry-vs-openinference-otel-llm-observability", 4, d);
  assert.ok(sib, "an OTel comparison gets a cluster rail");
  assert.equal(sib.label, "Evals & Observability", "buckets by observability/instrumentation vocab, not Inference");
  const slugs = sib.posts.map(p => p.slug);
  assert.ok(slugs.includes("langfuse-vs-langsmith-vs-phoenix-observability"), "rails with observability siblings");
  assert.ok(!slugs.includes("vllm-vs-sglang-vs-ollama-inference-engine"), "Inference cluster does not capture it");
});

test("hallucination-detection + red-teaming slugs bucket into Evals & Observability", () => {
  clearPosts(d);
  // a hallucination-detection guide whose slug carries no -vs- — homes via vocab,
  // not the catch-all (its siblings are the eval libraries)
  upsertPost(mkPost({ slug: "how-to-detect-llm-hallucinations",
    title: "How to Detect LLM Hallucinations", section: "wire", date: "2026-06-24" }), d);
  // a red-teaming-tools comparison — rails with the eval/red-team cluster
  upsertPost(mkPost({ slug: "garak-vs-pyrit-vs-promptfoo",
    title: "garak vs PyRIT vs promptfoo", section: "stack", date: "2026-06-24" }), d);
  // an eval-library sibling both should rail with
  upsertPost(mkPost({ slug: "deepeval-vs-ragas-vs-promptfoo",
    title: "deepeval vs RAGAS vs promptfoo", section: "wire", date: "2026-06-10" }), d);
  // two defensive Guardrails pieces — must NOT be poached into Evals, and they
  // rail with each other (a single piece would give clusterSiblings no sibling)
  upsertPost(mkPost({ slug: "how-to-prevent-prompt-injection-in-ai-agents",
    title: "How to Prevent Prompt Injection", section: "wire", date: "2026-06-09" }), d);
  upsertPost(mkPost({ slug: "guardrails-ai-vs-nemo-guardrails-vs-llama-guard",
    title: "Guardrails AI vs NeMo Guardrails vs Llama Guard", section: "stack", date: "2026-06-08" }), d);

  for (const slug of ["how-to-detect-llm-hallucinations", "garak-vs-pyrit-vs-promptfoo"]) {
    const sib = clusterSiblings(slug, 4, d);
    assert.ok(sib, `${slug} gets a cluster rail (not the catch-all)`);
    assert.equal(sib.label, "Evals & Observability", `${slug} buckets by eval/red-team vocab`);
    assert.ok(sib.posts.some(p => p.slug === "deepeval-vs-ragas-vs-promptfoo"),
      `${slug} rails with the eval-library siblings`);
  }
  // Guardrails stays its own cluster — the new tokens don't poach defensive pieces
  const guard = clusterSiblings("how-to-prevent-prompt-injection-in-ai-agents", 4, d);
  assert.equal(guard?.label, "Guardrails & Safety", "defensive guardrails piece is not poached into Evals");
});

test("Mamba/SSM and coding-agent edit-format money pages home in their topic clusters, not the catch-all", () => {
  clearPosts(d);
  // a state-space-model architecture comparison — rails with the attention-variant
  // + serving-engine pieces (its argument is KV cache vs recurrent state), NOT the
  // catch-all
  upsertPost(mkPost({ slug: "mamba-vs-transformer-state-space-models",
    title: "Mamba vs Transformer", section: "wire", date: "2026-06-24" }), d);
  // an Inference & Gateways sibling it should rail with
  upsertPost(mkPost({ slug: "mha-vs-mqa-vs-gqa-vs-mla-attention",
    title: "MHA vs MQA vs GQA vs MLA", section: "wire", date: "2026-06-12" }), d);
  // a coding-agent edit-format comparison — rails with the assistant comparisons
  upsertPost(mkPost({ slug: "coding-agent-edit-formats-diff-vs-whole-file",
    title: "How AI Coding Agents Edit Code", section: "wire", date: "2026-06-24" }), d);
  // a Coding Agents & IDEs sibling it should rail with
  upsertPost(mkPost({ slug: "aider-vs-cline-vs-openhands",
    title: "Aider vs Cline vs OpenHands", section: "stack", date: "2026-06-11" }), d);
  // a RAG piece carrying `sentence-transformers` — must NOT be pulled into Inference
  // by the new architecture tokens (bare `transformer` deliberately not added)
  upsertPost(mkPost({ slug: "model2vec-vs-sentence-transformers",
    title: "Model2Vec vs Sentence Transformers", section: "wire", date: "2026-06-10" }), d);
  // a RAG sibling so the sentence-transformers piece has a rail to verify against
  upsertPost(mkPost({ slug: "best-reranker-for-rag",
    title: "Best Reranker for RAG", section: "wire", date: "2026-06-09" }), d);

  const mamba = clusterSiblings("mamba-vs-transformer-state-space-models", 4, d);
  assert.equal(mamba?.label, "Inference & Gateways", "Mamba/SSM piece homes with attention + serving engines");
  assert.ok(mamba.posts.some(p => p.slug === "mha-vs-mqa-vs-gqa-vs-mla-attention"),
    "Mamba piece rails with the attention-variant sibling");
  assert.ok(!mamba.posts.some(p => p.slug === "model2vec-vs-sentence-transformers"),
    "the new SSM tokens do not poach the sentence-transformers RAG piece into Inference");

  const edit = clusterSiblings("coding-agent-edit-formats-diff-vs-whole-file", 4, d);
  assert.equal(edit?.label, "Coding Agents & IDEs", "edit-format piece homes with the coding-assistant comparisons");
  assert.ok(edit.posts.some(p => p.slug === "aider-vs-cline-vs-openhands"),
    "edit-format piece rails with the coding-agent sibling");

  // sentence-transformers piece itself stays in RAG & Retrieval
  const rag = clusterSiblings("model2vec-vs-sentence-transformers", 4, d);
  assert.equal(rag?.label, "RAG & Retrieval", "sentence-transformers piece stays in RAG, unpoached");
});

test("tool-calling mechanics slug homes in Protocols, poaching no tool-use/tool-calls piece", () => {
  clearPosts(d);
  // the new "parallel vs sequential tool calling" mechanics piece — rails with the
  // function-calling money pages, not the catch-all
  upsertPost(mkPost({ slug: "parallel-vs-sequential-tool-calling",
    title: "Parallel vs Sequential Tool Calling", section: "wire", date: "2026-06-24" }), d);
  // its function-calling siblings already in Protocols
  upsertPost(mkPost({ slug: "best-llm-for-function-calling",
    title: "Best LLM for Function Calling", section: "wire", date: "2026-06-10" }), d);
  upsertPost(mkPost({ slug: "mcp-vs-function-calling",
    title: "MCP vs Function Calling", section: "wire", date: "2026-06-09" }), d);
  // the tool-USE eval guide must stay in Evals (earlier cluster) — the bounded
  // `tool-calling` token must not poach `tool-use`
  upsertPost(mkPost({ slug: "how-to-evaluate-an-ai-agents-tool-use",
    title: "How to Evaluate an AI Agent's Tool Use", section: "wire", date: "2026-06-08" }), d);
  // a deepeval sibling so the Evals rail has someone to pair with
  upsertPost(mkPost({ slug: "deepeval-vs-ragas-vs-promptfoo",
    title: "deepeval vs RAGAS vs promptfoo", section: "wire", date: "2026-06-07" }), d);

  const sib = clusterSiblings("parallel-vs-sequential-tool-calling", 4, d);
  assert.ok(sib, "the tool-calling mechanics piece gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "Protocols (MCP & A2A)", "homes in Protocols via the function/tool-calling vocab");
  const slugs = sib.posts.map(p => p.slug);
  assert.ok(slugs.includes("best-llm-for-function-calling"), "rails with the function-calling money pages");
  // the bounded `tool-calling` token must NOT drag the tool-USE eval guide out of Evals
  const evalSib = clusterSiblings("how-to-evaluate-an-ai-agents-tool-use", 4, d);
  assert.equal(evalSib?.label, "Evals & Observability", "tool-use eval guide stays in Evals (not poached by tool-calling)");
});

test("context-management guide homes in Prompts & Optimization, not poaching RAG's long-context", () => {
  clearPosts(d);
  // the new "how to manage context in a long-running agent" guide (clearing vs
  // compaction vs memory) — the operational arm of context engineering
  upsertPost(mkPost({ slug: "how-to-manage-context-in-a-long-running-agent",
    title: "How to Manage Context in a Long-Running Agent", section: "wire", date: "2026-06-24" }), d);
  // qualifying demand siblings already in Prompts & Optimization (via `dspy`/`prompt`)
  upsertPost(mkPost({ slug: "dspy-vs-textgrad-vs-adalflow",
    title: "DSPy vs TextGrad vs AdalFlow", section: "wire", date: "2026-06-21" }), d);
  upsertPost(mkPost({ slug: "gepa-vs-mipro-prompt-optimization",
    title: "GEPA vs MIPRO Prompt Optimization", section: "wire", date: "2026-06-20" }), d);
  // a RAG long-context piece must STAY in RAG (earlier cluster claims it via
  // `long-context`) — the broadened bounded `context` token must not poach it
  upsertPost(mkPost({ slug: "rag-vs-long-context",
    title: "RAG vs Long Context", section: "wire", date: "2026-06-09" }), d);

  // homing map (independent of sibling counts) for the poach-guard assertions
  const home = new Map();
  for (const { label, posts } of comparisonClusters(d)) for (const p of posts) home.set(p.slug, label);
  assert.equal(home.get("how-to-manage-context-in-a-long-running-agent"), "Prompts & Optimization",
    "context-management guide homes in Prompts & Optimization via the bounded context vocab");
  // the broadened `context` token must NOT drag RAG's long-context piece out of RAG
  assert.equal(home.get("rag-vs-long-context"), "RAG & Retrieval",
    "long-context RAG piece stays in RAG (not poached by bounded context)");

  // and it earns a real sibling rail (not the catch-all)
  const sib = clusterSiblings("how-to-manage-context-in-a-long-running-agent", 4, d);
  assert.ok(sib, "the context-management guide gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "Prompts & Optimization");
  assert.ok(sib.posts.some(p => p.slug === "dspy-vs-textgrad-vs-adalflow"), "rails with the Prompts & Optimization siblings");
});

test("spec-driven-development slug rails with Coding Agents & IDEs (not the catch-all)", () => {
  clearPosts(d);
  // the spec-driven-development money page (Spec Kit / Kiro / Tessl) is the
  // write-the-spec-then-implement layer the coding agents run under; without the
  // spec-kit/kiro/tessl tokens it orphaned to "More comparisons".
  upsertPost(mkPost({ slug: "spec-driven-development-spec-kit-vs-kiro-vs-tessl",
    title: "Spec-Driven Development: Spec Kit vs Kiro vs Tessl", section: "wire", date: "2026-06-24" }), d);
  // its coding-tool siblings already in the cluster
  upsertPost(mkPost({ slug: "cursor-vs-windsurf-vs-github-copilot-vs-claude-code",
    title: "Cursor vs Windsurf vs Copilot vs Claude Code", section: "wire", date: "2026-06-10" }), d);
  upsertPost(mkPost({ slug: "agents-md-vs-claude-md",
    title: "AGENTS.md vs CLAUDE.md", section: "wire", date: "2026-06-09" }), d);

  const sib = clusterSiblings("spec-driven-development-spec-kit-vs-kiro-vs-tessl", 4, d);
  assert.ok(sib, "the spec-driven money page gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "Coding Agents & IDEs", "homes in Coding Agents & IDEs via the spec-kit/kiro/tessl vocab");
  assert.ok(sib.posts.some(p => p.slug === "cursor-vs-windsurf-vs-github-copilot-vs-claude-code"),
    "rails with the coding-tool comparisons");
});

test("vector-similarity metric slug homes in RAG & Retrieval on the `vector` token", () => {
  clearPosts(d);
  // the cosine-vs-dot-product-vs-euclidean money page carries no rag/embedding token
  // in its subject words — it homes via the leading `vector` token. Pin it so a future
  // cluster edit can't orphan it to the catch-all.
  upsertPost(mkPost({ slug: "vector-similarity-cosine-vs-dot-product-vs-euclidean",
    title: "Cosine vs Dot Product vs Euclidean", section: "wire", date: "2026-06-24" }), d);
  // its retrieval siblings already in the cluster
  upsertPost(mkPost({ slug: "best-vector-database-for-ai-agents",
    title: "Best Vector Database for AI Agents", section: "wire", date: "2026-06-12" }), d);
  upsertPost(mkPost({ slug: "hnsw-vs-ivf-vs-diskann",
    title: "HNSW vs IVF vs DiskANN", section: "wire", date: "2026-06-11" }), d);

  const sib = clusterSiblings("vector-similarity-cosine-vs-dot-product-vs-euclidean", 4, d);
  assert.ok(sib, "the similarity-metric money page gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "RAG & Retrieval", "homes in RAG & Retrieval via the `vector` token");
  assert.ok(sib.posts.some(p => p.slug === "best-vector-database-for-ai-agents"),
    "rails with the vector-DB / ANN-index pieces");
});

test("llm-inference-latency slug homes in Inference & Gateways on the `inference` token", () => {
  clearPosts(d);
  // the TTFT-vs-TPOT-vs-throughput metrics piece carries no vllm/gateway token — it
  // homes via `inference` alone. The new subject tokens (latency/ttft/tpot/throughput)
  // were deliberately NOT added to any regex, so confirm no earlier cluster poaches it.
  upsertPost(mkPost({ slug: "llm-inference-latency-ttft-vs-tpot",
    title: "LLM Inference Latency: TTFT vs TPOT vs Throughput", section: "wire", date: "2026-06-24" }), d);
  // its serving-engine siblings already in the cluster
  upsertPost(mkPost({ slug: "prefill-vs-decode-llm-inference",
    title: "Prefill vs Decode", section: "wire", date: "2026-06-12" }), d);
  upsertPost(mkPost({ slug: "continuous-batching-vs-static-batching",
    title: "Continuous vs Static Batching", section: "wire", date: "2026-06-11" }), d);

  const sib = clusterSiblings("llm-inference-latency-ttft-vs-tpot", 4, d);
  assert.ok(sib, "the inference-latency metrics piece gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "Inference & Gateways", "homes in Inference & Gateways via the `inference` token");
  assert.ok(sib.posts.some(p => p.slug === "prefill-vs-decode-llm-inference"),
    "rails with the prefill/decode + batching serving pieces");
});

test("turn-detection voice slug rails with Voice Agents on the `voice` token", () => {
  clearPosts(d);
  // the "semantic" in vad-vs-semantic-turn-detection must NOT be poached into RAG
  // (whose `semantic` is bounded to semantic-search/-caching) — it homes in Voice.
  upsertPost(mkPost({ slug: "vad-vs-semantic-turn-detection-voice-agents",
    title: "Turn Detection for Voice Agents", section: "wire", date: "2026-06-24" }), d);
  upsertPost(mkPost({ slug: "livekit-vs-pipecat-vs-vapi-voice-agents",
    title: "LiveKit vs Pipecat vs Vapi", section: "wire", date: "2026-06-12" }), d);

  const sib = clusterSiblings("vad-vs-semantic-turn-detection-voice-agents", 4, d);
  assert.ok(sib, "the turn-detection piece gets a cluster rail");
  assert.equal(sib.label, "Voice Agents", "homes in Voice Agents, not RAG (bounded semantic token)");
});

test("serving-engine slugs (TensorRT-LLM / TGI) bucket into Inference & Gateways", () => {
  clearPosts(d);
  // a production serving-engine comparison; the TensorRT-LLM/TGI vocab must bucket it
  // even though the slug also carries "vllm" — and a hypothetical tensorrt/tgi-only
  // slug should land here too via the new tokens.
  upsertPost(mkPost({ slug: "vllm-vs-tensorrt-llm-vs-tgi", title: "vLLM vs TensorRT-LLM vs TGI",
    section: "stack", date: "2026-06-22" }), d);
  upsertPost(mkPost({ slug: "groq-vs-together-vs-fireworks-inference", title: "Groq vs Together vs Fireworks",
    section: "wire", date: "2026-06-10" }), d);

  const sib = clusterSiblings("vllm-vs-tensorrt-llm-vs-tgi", 4, d);
  assert.ok(sib, "a serving-engine comparison gets a cluster rail");
  assert.equal(sib.label, "Inference & Gateways", "buckets into Inference & Gateways");
  assert.ok(sib.posts.some(p => p.slug === "groq-vs-together-vs-fireworks-inference"),
    "rails with an inference sibling");
});

test("model-serving-framework slugs (BentoML / Ray Serve / KServe) rail with Inference & Gateways", () => {
  clearPosts(d);
  // serving frameworks wrap an inference engine; their slug tokens (bentoml/serve/
  // kserve) appear in no earlier cluster, so the money page must rail with the
  // engine comparison rather than fall to the "More comparisons" catch-all.
  upsertPost(mkPost({ slug: "bentoml-vs-ray-serve-vs-kserve", title: "BentoML vs Ray Serve vs KServe",
    section: "stack", date: "2026-06-22" }), d);
  upsertPost(mkPost({ slug: "vllm-vs-tensorrt-llm-vs-tgi", title: "vLLM vs TensorRT-LLM vs TGI",
    section: "stack", date: "2026-06-20" }), d);

  const sib = clusterSiblings("bentoml-vs-ray-serve-vs-kserve", 4, d);
  assert.ok(sib, "a serving-framework comparison gets a cluster rail");
  assert.equal(sib.label, "Inference & Gateways", "buckets into Inference & Gateways");
  assert.ok(sib.posts.some(p => p.slug === "vllm-vs-tensorrt-llm-vs-tgi"),
    "rails with the serving-engine sibling");
});

test("inference-economics slug (batch vs realtime) rails with Inference & Gateways, not the catch-all", () => {
  clearPosts(d);
  // the batch-vs-realtime serving-tier / cost decision is a "how do I run inference"
  // choice: it must rail with the gateways that route between those tiers rather than
  // fall to the incoherent "More comparisons" catch-all (the `batch`/`realtime` tokens
  // appear in no earlier cluster slug, so first-match-wins poaches nothing).
  upsertPost(mkPost({ slug: "llm-batch-api-vs-realtime-cost", title: "Batch APIs vs Realtime",
    section: "wire", date: "2026-06-23" }), d);
  upsertPost(mkPost({ slug: "litellm-vs-portkey-vs-tensorzero", title: "LiteLLM vs Portkey vs TensorZero",
    section: "wire", date: "2026-06-21" }), d);

  const sib = clusterSiblings("llm-batch-api-vs-realtime-cost", 4, d);
  assert.ok(sib, "an inference-economics comparison gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "Inference & Gateways", "buckets by batch/realtime vocab into Inference & Gateways");
  assert.ok(sib.posts.some(p => p.slug === "litellm-vs-portkey-vs-tensorzero"),
    "rails with the gateway sibling that routes between tiers");
});

test("request-scheduling slug (continuous vs static batching) rails with Inference & Gateways", () => {
  clearPosts(d);
  // continuous/in-flight batching is an engine-scheduling decision: it must rail with
  // the inference engines rather than fall to the catch-all. The bounded `batch` token
  // doesn't match "batching", so the new `batching`/`continuous-batching` vocab homes it.
  upsertPost(mkPost({ slug: "continuous-batching-vs-static-batching", title: "Continuous vs Static Batching",
    section: "wire", date: "2026-06-24" }), d);
  upsertPost(mkPost({ slug: "vllm-vs-sglang-vs-ollama-inference-engine", title: "vLLM vs SGLang vs Ollama",
    section: "wire", date: "2026-06-20" }), d);

  const sib = clusterSiblings("continuous-batching-vs-static-batching", 4, d);
  assert.ok(sib, "a batching-scheduling comparison gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "Inference & Gateways", "buckets by batching vocab into Inference & Gateways");
  assert.ok(sib.posts.some(p => p.slug === "vllm-vs-sglang-vs-ollama-inference-engine"),
    "rails with the inference-engine sibling");
});

test("model-merging slug (SLERP/TIES/DARE) rails with Fine-Tuning & Training", () => {
  clearPosts(d);
  // model merging is training-free model combination by weight arithmetic — the
  // sibling of the fine-tuning *method* money pages. Its vocab (merging/slerp/ties/
  // dare) appears in no earlier cluster slug, so first-match-wins homes it here.
  upsertPost(mkPost({ slug: "model-merging-ties-vs-dare-vs-slerp", title: "Model Merging: TIES vs DARE vs SLERP",
    section: "wire", date: "2026-06-24" }), d);
  upsertPost(mkPost({ slug: "lora-vs-qlora-vs-full-fine-tuning", title: "LoRA vs QLoRA vs Full Fine-Tuning",
    section: "wire", date: "2026-06-22" }), d);

  const sib = clusterSiblings("model-merging-ties-vs-dare-vs-slerp", 4, d);
  assert.ok(sib, "a model-merging comparison gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "Fine-Tuning & Training", "buckets by merging vocab into Fine-Tuning & Training");
  assert.ok(sib.posts.some(p => p.slug === "lora-vs-qlora-vs-full-fine-tuning"),
    "rails with a fine-tuning-method sibling");
});

test("GPU-sharing slug (MIG/MPS/time-slicing) rails with Inference & Gateways", () => {
  clearPosts(d);
  // GPU sharing is a serving-infra decision (how many workloads per accelerator):
  // it must rail with the parallelism/batching/serving-engine pieces, not fall to
  // the catch-all. The mig/mps/time-slicing/gpu vocab appears in no earlier cluster.
  upsertPost(mkPost({ slug: "mig-vs-mps-vs-time-slicing-gpu-sharing", title: "MIG vs MPS vs Time-Slicing",
    section: "wire", date: "2026-06-24" }), d);
  upsertPost(mkPost({ slug: "vllm-vs-sglang-vs-ollama-inference-engine", title: "vLLM vs SGLang vs Ollama",
    section: "wire", date: "2026-06-20" }), d);

  const sib = clusterSiblings("mig-vs-mps-vs-time-slicing-gpu-sharing", 4, d);
  assert.ok(sib, "a GPU-sharing comparison gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "Inference & Gateways", "buckets by GPU-sharing vocab into Inference & Gateways");
  assert.ok(sib.posts.some(p => p.slug === "vllm-vs-sglang-vs-ollama-inference-engine"),
    "rails with the inference-engine sibling");
});

test("attention slugs (MHA/MQA/GQA/MLA variants + FlashAttention/PagedAttention/FlashInfer engines) rail with Inference & Gateways", () => {
  clearPosts(d);
  // Attention is a KV-cache/throughput decision: the variant comparison (how many KV
  // heads → cache size) and the kernel/engine comparison (IO-aware compute, paged
  // memory, serving engine) both belong with the serving-engine + batching pieces,
  // not the catch-all. The attention/mha/mqa/gqa/mla/flash* vocab appears in no
  // earlier cluster, and bounded `attention` can't poach `flashattention`.
  upsertPost(mkPost({ slug: "mha-vs-mqa-vs-gqa-vs-mla-attention", title: "MHA vs MQA vs GQA vs MLA",
    section: "wire", date: "2026-06-24" }), d);
  upsertPost(mkPost({ slug: "flashattention-vs-pagedattention-vs-flashinfer", title: "FlashAttention vs PagedAttention vs FlashInfer",
    section: "wire", date: "2026-06-24" }), d);
  upsertPost(mkPost({ slug: "vllm-vs-sglang-vs-ollama-inference-engine", title: "vLLM vs SGLang vs Ollama",
    section: "wire", date: "2026-06-20" }), d);

  const variant = clusterSiblings("mha-vs-mqa-vs-gqa-vs-mla-attention", 4, d);
  assert.ok(variant, "the attention-variant comparison gets a cluster rail (not the catch-all)");
  assert.equal(variant.label, "Inference & Gateways", "attention variants bucket into Inference & Gateways");

  const engine = clusterSiblings("flashattention-vs-pagedattention-vs-flashinfer", 4, d);
  assert.ok(engine, "the attention-engine comparison gets a cluster rail (not the catch-all)");
  assert.equal(engine.label, "Inference & Gateways", "attention engines bucket into Inference & Gateways");
  assert.ok(engine.posts.some(p => p.slug === "mha-vs-mqa-vs-gqa-vs-mla-attention"),
    "the two attention pieces rail together");
});

test("context-extension slug (RoPE scaling / YaRN / Position Interpolation) rails with Inference & Gateways", () => {
  clearPosts(d);
  // extending the context window is a positional-encoding scaling decision the serving
  // engines apply via a rope_scaling/rope_type config — it belongs with the attention +
  // serving-engine pieces, not the catch-all. The rope/yarn/ntk/position-interpolation
  // vocab appears in no earlier cluster slug, so first-match-wins poaches nothing.
  upsertPost(mkPost({ slug: "rope-scaling-vs-yarn-vs-position-interpolation", title: "How to Extend an LLM's Context Window",
    section: "wire", date: "2026-06-24" }), d);
  upsertPost(mkPost({ slug: "mha-vs-mqa-vs-gqa-vs-mla-attention", title: "MHA vs MQA vs GQA vs MLA",
    section: "wire", date: "2026-06-24" }), d);

  const sib = clusterSiblings("rope-scaling-vs-yarn-vs-position-interpolation", 4, d);
  assert.ok(sib, "a context-extension comparison gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "Inference & Gateways", "buckets by rope/yarn vocab into Inference & Gateways");
  assert.ok(sib.posts.some(p => p.slug === "mha-vs-mqa-vs-gqa-vs-mla-attention"),
    "rails with the attention sibling");
});

test("reward-model slug (process vs outcome / RLVR) rails with Fine-Tuning & Training", () => {
  clearPosts(d);
  // reward-signal design is the layer above the RL algorithms (grpo/ppo): a reward model
  // is what those algorithms optimize against, so the process-vs-outcome money page rails
  // with grpo-vs-ppo, not the catch-all. Bounded `reward`/`rlvr` appear in no existing
  // slug, so first-match-wins poaches nothing.
  upsertPost(mkPost({ slug: "process-reward-models-vs-outcome-reward-models", title: "Process Reward Models vs Outcome Reward Models",
    section: "wire", date: "2026-06-24" }), d);
  upsertPost(mkPost({ slug: "grpo-vs-ppo", title: "GRPO vs PPO",
    section: "wire", date: "2026-06-23" }), d);

  const sib = clusterSiblings("process-reward-models-vs-outcome-reward-models", 4, d);
  assert.ok(sib, "a reward-model comparison gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "Fine-Tuning & Training", "buckets by reward vocab into Fine-Tuning & Training");
  assert.ok(sib.posts.some(p => p.slug === "grpo-vs-ppo"),
    "rails with the RL-algorithm sibling");
});

test("tokenizer slug (tiktoken/SentencePiece/HF tokenizers) rails with Inference & Gateways", () => {
  clearPosts(d);
  // tokenization is the encoder that turns text into the tokens engines bill, count,
  // and fit in the context window — a "how is a prompt measured before it's served"
  // decision that belongs with the serving-engine/sampling pieces, not the catch-all.
  // The tiktoken/sentencepiece/tokenizer/bpe vocab appears in no earlier cluster, and
  // every token is bounded so `bpe` can't match a substring.
  upsertPost(mkPost({ slug: "tiktoken-vs-sentencepiece-vs-huggingface-tokenizers", title: "tiktoken vs SentencePiece vs HF Tokenizers",
    section: "wire", date: "2026-06-24" }), d);
  upsertPost(mkPost({ slug: "temperature-vs-top-p-vs-top-k-llm-sampling", title: "Temperature vs Top-p vs Top-k",
    section: "wire", date: "2026-06-24" }), d);

  const sib = clusterSiblings("tiktoken-vs-sentencepiece-vs-huggingface-tokenizers", 4, d);
  assert.ok(sib, "a tokenizer comparison gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "Inference & Gateways", "buckets by tokenizer vocab into Inference & Gateways");
  assert.ok(sib.posts.some(p => p.slug === "temperature-vs-top-p-vs-top-k-llm-sampling"),
    "rails with a decoding-time inference sibling");
});

test("agent-output-streaming slug (SSE vs WebSockets) rails with Agent UI & Frontend, without poaching MCP transports", () => {
  clearPosts(d);
  // streaming an agent's output to the UI is the transport layer of the frontend
  // decision — it homes here on its `streaming` token. The guard: we did NOT add a
  // bare `sse` token, so the MCP-transports piece (which also carries `sse`) must
  // stay in Protocols, the EARLIER cluster it matches via `mcp`.
  upsertPost(mkPost({ slug: "streaming-ai-agent-output-sse-vs-websockets", title: "Streaming an Agent's Output",
    section: "wire", date: "2026-06-24" }), d);
  upsertPost(mkPost({ slug: "copilotkit-vs-assistant-ui-vs-vercel-ai-sdk", title: "CopilotKit vs assistant-ui vs Vercel AI SDK",
    section: "wire", date: "2026-06-22" }), d);
  upsertPost(mkPost({ slug: "mcp-stdio-vs-sse-vs-streamable-http", title: "MCP Transports",
    section: "wire", date: "2026-06-22" }), d);
  // a Protocols sibling so clusterSiblings() resolves a rail for the MCP piece below
  upsertPost(mkPost({ slug: "mcp-tools-vs-resources-vs-prompts", title: "MCP Tools vs Resources vs Prompts",
    section: "wire", date: "2026-06-22" }), d);

  const sib = clusterSiblings("streaming-ai-agent-output-sse-vs-websockets", 4, d);
  assert.ok(sib, "an agent-streaming comparison gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "Agent UI & Frontend", "buckets by streaming vocab into Agent UI & Frontend");
  assert.ok(sib.posts.some(p => p.slug === "copilotkit-vs-assistant-ui-vs-vercel-ai-sdk"),
    "rails with the agent-UI-library sibling");

  const mcp = clusterSiblings("mcp-stdio-vs-sse-vs-streamable-http", 4, d);
  assert.equal(mcp.label, "Protocols (MCP & A2A)",
    "MCP-transports piece stays in Protocols — the streaming vocab must not poach it");
});

test("knowledge-distillation slug rails with Fine-Tuning & Training, without poaching distilabel", () => {
  clearPosts(d);
  // distillation is a model-compression/transfer technique — the sibling of the
  // quantization/merging money pages — and a form of fine-tuning. The slug isn't a
  // "…-vs-…" query, so it enrolls via its compare: table. The guard: the bounded
  // `distillation` token must NOT poach `distilabel` (Synthetic Data), which has no
  // boundary after "distil".
  upsertPost(mkPost({ slug: "knowledge-distillation-llm", title: "Knowledge Distillation for LLMs",
    section: "wire", date: "2026-06-24", compare: [["Approach", "Signal"], ["Soft-target KD", "Forward KL"]] }), d);
  upsertPost(mkPost({ slug: "lora-vs-qlora-vs-full-fine-tuning", title: "LoRA vs QLoRA vs Full Fine-Tuning",
    section: "wire", date: "2026-06-22" }), d);
  upsertPost(mkPost({ slug: "distilabel-vs-curator-vs-synthetic-data-kit", title: "Distilabel vs Curator vs synthetic-data-kit",
    section: "stack", date: "2026-06-22" }), d);
  // a second Synthetic Data sibling so clusterSiblings() resolves a rail for distilabel
  upsertPost(mkPost({ slug: "synthetic-data-curation-vs-augmentation", title: "Synthetic Data: Curation vs Augmentation",
    section: "wire", date: "2026-06-20" }), d);

  const sib = clusterSiblings("knowledge-distillation-llm", 4, d);
  assert.ok(sib, "a distillation explainer (compare-table) gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "Fine-Tuning & Training", "buckets by distillation vocab into Fine-Tuning & Training");
  assert.ok(sib.posts.some(p => p.slug === "lora-vs-qlora-vs-full-fine-tuning"),
    "rails with a fine-tuning-method sibling");
  const distilabel = clusterSiblings("distilabel-vs-curator-vs-synthetic-data-kit", 4, d);
  assert.equal(distilabel.label, "Synthetic Data",
    "distilabel stays in Synthetic Data — the bounded distillation token must not poach it");
});

test("sampling-parameters slug (temperature/top-p/top-k) rails with Inference & Gateways, without poaching MCP sampling", () => {
  clearPosts(d);
  // decoding/sampling knobs are engine params (vLLM SamplingParams) — a "how does the
  // model generate" decision that rails with the serving engines. The guard: the
  // shared `sampling` token must NOT poach `mcp-sampling-vs-elicitation`, which homes
  // in Protocols (earlier) via its `mcp` token.
  upsertPost(mkPost({ slug: "temperature-vs-top-p-vs-top-k-llm-sampling", title: "Temperature vs Top-p vs Top-k",
    section: "wire", date: "2026-06-24" }), d);
  upsertPost(mkPost({ slug: "vllm-vs-sglang-vs-ollama-inference-engine", title: "vLLM vs SGLang vs Ollama",
    section: "wire", date: "2026-06-20" }), d);
  upsertPost(mkPost({ slug: "mcp-sampling-vs-elicitation", title: "MCP Sampling vs Elicitation",
    section: "wire", date: "2026-06-23" }), d);
  // a Protocols sibling so clusterSiblings() resolves a rail for the MCP piece
  upsertPost(mkPost({ slug: "mcp-tools-vs-resources-vs-prompts", title: "MCP Tools vs Resources vs Prompts",
    section: "wire", date: "2026-06-22" }), d);

  const sib = clusterSiblings("temperature-vs-top-p-vs-top-k-llm-sampling", 4, d);
  assert.ok(sib, "a sampling-parameters comparison gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "Inference & Gateways", "buckets by sampling/decoding vocab into Inference & Gateways");
  assert.ok(sib.posts.some(p => p.slug === "vllm-vs-sglang-vs-ollama-inference-engine"),
    "rails with the inference-engine sibling");
  const mcpSampling = clusterSiblings("mcp-sampling-vs-elicitation", 4, d);
  assert.equal(mcpSampling.label, "Protocols (MCP & A2A)",
    "MCP-sampling stays in Protocols — the shared sampling token must not poach it");
});

test("compute-timing slug (sleep-time vs test-time) rails with Agent Reasoning & Planning", () => {
  clearPosts(d);
  // the WHEN-to-reason decision (precompute during idle vs reason under latency) is
  // the same demand cluster as the reasoning-models money page — it must rail there
  // rather than fall to the "More comparisons" catch-all (the slug carries no
  // memory/inference/prompt token, so without sleep-time/test-time it would).
  upsertPost(mkPost({ slug: "sleep-time-compute-vs-test-time-compute", title: "Sleep-Time vs Test-Time Compute",
    section: "wire", date: "2026-06-23" }), d);
  upsertPost(mkPost({ slug: "reasoning-models-vs-standard-llms", title: "Reasoning Models vs Standard LLMs",
    section: "wire", date: "2026-06-20" }), d);

  const sib = clusterSiblings("sleep-time-compute-vs-test-time-compute", 4, d);
  assert.ok(sib, "a compute-timing comparison gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "Agent Reasoning & Planning", "buckets by sleep-time/test-time vocab into reasoning");
  assert.ok(sib.posts.some(p => p.slug === "reasoning-models-vs-standard-llms"),
    "rails with the reasoning-models sibling");
});

test("vector-index-algorithm slugs bucket into RAG & Retrieval, not the catch-all", () => {
  clearPosts(d);
  // an ANN index-algorithm comparison whose slug carries none of the older RAG vocab
  upsertPost(mkPost({ slug: "hnsw-vs-ivf-vs-diskann", title: "HNSW vs IVF vs DiskANN",
    section: "wire", date: "2026-06-21" }), d);
  // a vector-DB sibling it should rail with
  upsertPost(mkPost({ slug: "best-vector-database-for-ai-agents", title: "Best Vector Database",
    section: "wire", date: "2026-06-20" }), d);

  const sib = clusterSiblings("hnsw-vs-ivf-vs-diskann", 4, d);
  assert.ok(sib, "an index-algorithm comparison gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "RAG & Retrieval", "buckets by index-algorithm vocab into retrieval");
  assert.ok(sib.posts.some(p => p.slug === "best-vector-database-for-ai-agents"),
    "rails with the vector-DB sibling");
});

test("text-to-SQL slugs get their own Data & SQL cluster", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "text-to-sql-vanna-vs-wrenai-vs-dataherald", title: "Text-to-SQL",
    section: "stack", date: "2026-06-21" }), d);
  // a RAG vector piece must NOT be pulled into Data & SQL
  upsertPost(mkPost({ slug: "best-vector-database-for-ai-agents", title: "Best Vector Database",
    section: "wire", date: "2026-06-20" }), d);

  const clusters = comparisonClusters(d);
  const sql = clusters.find(c => c.label === "Data & SQL");
  assert.ok(sql, "a Data & SQL cluster exists");
  assert.deepEqual(sql.posts.map(p => p.slug), ["text-to-sql-vanna-vs-wrenai-vs-dataherald"],
    "the text-to-SQL piece buckets into Data & SQL");
  const rag = clusters.find(c => c.label === "RAG & Retrieval");
  assert.ok(rag && rag.posts.some(p => p.slug === "best-vector-database-for-ai-agents"),
    "the vector-DB piece stays in RAG & Retrieval (Data & SQL doesn't poach it)");
});

test("model-family + LLM-API-surface slugs get their own Models & LLM APIs cluster", () => {
  clearPosts(d);
  // model-choice + API-surface comparisons that used to dump into the catch-all
  upsertPost(mkPost({ slug: "openai-responses-api-vs-assistants-api-vs-chat-completions",
    title: "Responses vs Assistants vs Chat Completions", section: "wire", date: "2026-06-23" }), d);
  upsertPost(mkPost({ slug: "claude-vs-gpt-vs-gemini-for-ai-agents", title: "Claude vs GPT vs Gemini",
    section: "wire", date: "2026-06-20" }), d);
  upsertPost(mkPost({ slug: "qwen-vs-llama-vs-deepseek-vs-mistral-vs-gemma", title: "Qwen vs Llama vs DeepSeek",
    section: "wire", date: "2026-06-18" }), d);
  upsertPost(mkPost({ slug: "mixture-of-experts-vs-dense-models-for-agents", title: "MoE vs Dense",
    section: "wire", date: "2026-06-15" }), d);
  // a coding-agent slug carrying "gemini" (gemini-cli) must stay in Coding Agents
  upsertPost(mkPost({ slug: "claude-code-vs-codex-cli-vs-gemini-cli", title: "Claude Code vs Codex vs Gemini CLI",
    section: "stack", date: "2026-06-19" }), d);
  // an OCR slug carrying "mistral" (mistral-ocr) must NOT be poached by this cluster
  upsertPost(mkPost({ slug: "olmocr-vs-marker-vs-mineru-vs-mistral-ocr", title: "olmOCR vs Marker vs MinerU",
    section: "stack", date: "2026-06-22" }), d);

  const sib = clusterSiblings("openai-responses-api-vs-assistants-api-vs-chat-completions", 4, d);
  assert.ok(sib, "the OpenAI API-surface comparison gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "Models & LLM APIs", "API-surface piece buckets into Models & LLM APIs");
  const slugs = sib.posts.map(p => p.slug);
  assert.ok(slugs.includes("claude-vs-gpt-vs-gemini-for-ai-agents"), "rails with the model-choice sibling");
  assert.ok(slugs.includes("qwen-vs-llama-vs-deepseek-vs-mistral-vs-gemma"), "rails with the open-model-family sibling");
  assert.ok(slugs.includes("mixture-of-experts-vs-dense-models-for-agents"), "rails with the model-architecture sibling");

  const clusters = comparisonClusters(d);
  const coding = clusters.find(c => c.label === "Coding Agents & IDEs");
  assert.ok(coding && coding.posts.some(p => p.slug === "claude-code-vs-codex-cli-vs-gemini-cli"),
    "gemini-cli coding tool stays in Coding Agents (first-match-wins, not poached by bare gemini)");
  // the OCR piece carries a "mistral-ocr" token: Models & LLM APIs must NOT poach it
  // via a bare `mistral`. It now homes in its own Document Parsing & OCR cluster.
  const parsing = clusters.find(c => c.label === "Document Parsing & OCR");
  assert.ok(parsing && parsing.posts.some(p => p.slug === "olmocr-vs-marker-vs-mineru-vs-mistral-ocr"),
    "mistral-ocr OCR piece homes in Document Parsing & OCR, not poached into Models by bare mistral");
  assert.ok(!sib.posts.some(p => p.slug === "olmocr-vs-marker-vs-mineru-vs-mistral-ocr"),
    "the OCR piece is not in the Models & LLM APIs rail");
});

test("synthetic-data-generation slugs get their own Synthetic Data cluster", () => {
  clearPosts(d);
  // a synthetic-data tooling comparison whose slug carries none of the earlier vocab
  upsertPost(mkPost({ slug: "distilabel-vs-curator-vs-synthetic-data-kit", title: "distilabel vs Curator",
    section: "stack", date: "2026-06-22" }), d);
  // a fine-tuning-method sibling must NOT swallow it (synthetic data is the data layer,
  // not the training-method layer)
  upsertPost(mkPost({ slug: "lora-vs-qlora-vs-full-fine-tuning", title: "LoRA vs QLoRA",
    section: "wire", date: "2026-06-22" }), d);

  const clusters = comparisonClusters(d);
  const syn = clusters.find(c => c.label === "Synthetic Data");
  assert.ok(syn, "a Synthetic Data cluster exists");
  assert.deepEqual(syn.posts.map(p => p.slug), ["distilabel-vs-curator-vs-synthetic-data-kit"],
    "the synthetic-data piece buckets into Synthetic Data");
  const ft = clusters.find(c => c.label === "Fine-Tuning & Training");
  assert.ok(ft && ft.posts.some(p => p.slug === "lora-vs-qlora-vs-full-fine-tuning"),
    "the fine-tuning piece stays in Fine-Tuning & Training (Synthetic Data doesn't poach it)");
});

test("deep-research-agent slugs get their own Research Agents cluster", () => {
  clearPosts(d);
  // the deep-research comparison; its slug carries `gpt-researcher`/`deep-research`
  // tokens that appear in no earlier cluster — without the cluster it falls to the
  // catch-all instead of getting a home + sibling rail
  upsertPost(mkPost({ slug: "gpt-researcher-vs-open-deep-research", title: "GPT Researcher vs Open Deep Research",
    section: "stack", date: "2026-06-23" }), d);
  // an agent-framework sibling: it must STAY in Agent Frameworks even though
  // research agents are built on these frameworks (no research token in its slug)
  upsertPost(mkPost({ slug: "agno-vs-langgraph-vs-crewai", title: "Agno vs LangGraph vs CrewAI",
    section: "stack", date: "2026-06-23" }), d);

  const clusters = comparisonClusters(d);
  const research = clusters.find(c => c.label === "Research Agents");
  assert.ok(research, "a Research Agents cluster exists");
  assert.deepEqual(research.posts.map(p => p.slug), ["gpt-researcher-vs-open-deep-research"],
    "the deep-research piece buckets into Research Agents");
  const fw = clusters.find(c => c.label === "Agent Frameworks");
  assert.ok(fw && fw.posts.some(p => p.slug === "agno-vs-langgraph-vs-crewai"),
    "the agent-framework piece stays in Agent Frameworks (Research Agents doesn't poach it)");
});

test("graph-database slugs bucket into RAG & Retrieval (GraphRAG layer), not the catch-all", () => {
  clearPosts(d);
  // a graph-database comparison whose slug carries none of the older RAG vocab —
  // just engine names (neo4j/falkordb/memgraph)
  upsertPost(mkPost({ slug: "neo4j-vs-falkordb-vs-memgraph", title: "Neo4j vs FalkorDB vs Memgraph",
    section: "stack", date: "2026-06-23" }), d);
  // a GraphRAG technique sibling it should rail with
  upsertPost(mkPost({ slug: "graphrag-vs-vector-rag", title: "GraphRAG vs Vector RAG",
    section: "wire", date: "2026-06-21" }), d);
  // a voice piece must NOT be pulled in
  upsertPost(mkPost({ slug: "livekit-vs-pipecat-vs-vapi", title: "LiveKit vs Pipecat vs Vapi",
    section: "stack", date: "2026-06-20" }), d);

  const sib = clusterSiblings("neo4j-vs-falkordb-vs-memgraph", 4, d);
  assert.ok(sib, "a graph-DB comparison gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "RAG & Retrieval", "buckets by engine-name vocab into retrieval");
  assert.ok(sib.posts.some(p => p.slug === "graphrag-vs-vector-rag"),
    "rails with the GraphRAG technique sibling");
  assert.ok(!sib.posts.some(p => p.slug === "livekit-vs-pipecat-vs-vapi"), "voice cluster excluded");
});

test("Python UI-framework slugs bucket into Agent UI & Frontend, not the catch-all", () => {
  clearPosts(d);
  // a Python LLM-UI comparison (streamlit/gradio/chainlit)
  upsertPost(mkPost({ slug: "streamlit-vs-gradio-vs-chainlit", title: "Streamlit vs Gradio vs Chainlit",
    section: "stack", date: "2026-06-23" }), d);
  // the React agent-UI sibling it should rail with
  upsertPost(mkPost({ slug: "copilotkit-vs-assistant-ui-vs-vercel-ai-sdk", title: "CopilotKit vs assistant-ui",
    section: "stack", date: "2026-06-21" }), d);
  // a coding-agent slug must stay in Coding Agents (first-match-wins)
  upsertPost(mkPost({ slug: "cursor-vs-windsurf-vs-github-copilot-vs-claude-code", title: "Cursor vs Windsurf",
    section: "stack", date: "2026-06-20" }), d);

  const sib = clusterSiblings("streamlit-vs-gradio-vs-chainlit", 4, d);
  assert.ok(sib, "a Python UI-framework comparison gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "Agent UI & Frontend", "buckets by UI-framework vocab into Agent UI & Frontend");
  assert.ok(sib.posts.some(p => p.slug === "copilotkit-vs-assistant-ui-vs-vercel-ai-sdk"),
    "rails with the React agent-UI sibling");
  const clusters = comparisonClusters(d);
  const coding = clusters.find(c => c.label === "Coding Agents & IDEs");
  assert.ok(coding && coding.posts.some(p => p.slug === "cursor-vs-windsurf-vs-github-copilot-vs-claude-code"),
    "the coding-tool piece stays in Coding Agents (Agent UI doesn't poach it)");
});

test("catch-all rescue: orphaned comparison slugs home in their correct clusters", () => {
  clearPosts(d);
  // A representative slug for each cluster that previously dumped into the
  // "More comparisons" catch-all because its slug carried only product names the
  // cluster regexes didn't know. Each must now home in the labeled cluster, and the
  // genuinely-uncategorizable language-choice piece must STAY in the catch-all.
  const cases = [
    ["chroma-vs-weaviate-vs-milvus",                "RAG & Retrieval"],
    ["lancedb-vs-sqlite-vec-vs-duckdb",             "RAG & Retrieval"],
    ["model2vec-vs-sentence-transformers",          "RAG & Retrieval"],
    ["docling-vs-unstructured-vs-llamaparse",       "Document Parsing & OCR"],
    ["olmocr-vs-marker-vs-mineru-vs-mistral-ocr",   "Document Parsing & OCR"],
    ["how-to-evaluate-an-ai-agents-tool-use",       "Evals & Observability"],
    ["tensor-parallelism-vs-pipeline-parallelism",  "Inference & Gateways"],
    ["speculative-decoding-eagle-vs-medusa",        "Inference & Gateways"],
    ["mlx-vs-llama-cpp",                            "Inference & Gateways"],
    ["presidio-vs-gliner-vs-llm-redaction",         "Guardrails & Safety"],
    ["ap2-vs-x402-vs-acp-agent-payment-protocols",  "Protocols (MCP & A2A)"],
    ["open-webui-vs-librechat-vs-anythingllm",      "Agent UI & Frontend"],
    ["n8n-vs-flowise-vs-langflow",                  "Agent Frameworks"],
    ["multi-agent-vs-single-agent",                 "Agent Reasoning & Planning"],
    ["how-to-add-human-in-the-loop-to-an-ai-agent", "Agent Reasoning & Planning"],
    ["bedrock-vs-vertex-ai-vs-azure-ai-foundry",    "Models & LLM APIs"],
    // genuinely uncategorizable — a pure language choice — must remain in the catch-all
    ["python-vs-typescript-for-ai-agents",          "More comparisons"],
  ];
  let date = 20;
  for (const [slug] of cases) {
    upsertPost(mkPost({ slug, title: slug, section: "wire", date: `2026-06-${date--}` }), d);
  }
  // a control: olmocr's "mistral-ocr" token must not let Models & LLM APIs poach it,
  // and llama-cpp's "llama" must not let Agent Frameworks (llamaindex) poach it —
  // both asserted by their expected labels above (Document Parsing / Inference).
  const byLabel = new Map();
  for (const c of comparisonClusters(d)) for (const p of c.posts) byLabel.set(p.slug, c.label);
  for (const [slug, expected] of cases) {
    assert.equal(byLabel.get(slug), expected, `${slug} → ${expected}`);
  }
  // the catch-all is now exactly the one uncategorizable piece — not a grab-bag
  const catchall = comparisonClusters(d).find(c => c.label === "More comparisons");
  assert.deepEqual(catchall.posts.map(p => p.slug), ["python-vs-typescript-for-ai-agents"],
    "only the language-choice piece remains uncategorized");
});

test("Microsoft agent-stack + Haystack pieces rail in Agent Frameworks; RAG doesn't poach semantic-kernel", () => {
  clearPosts(d);
  // the Microsoft agent SDK consolidation — its slug carries `autogen`/`framework`
  // tokens (Agent Frameworks), but it ALSO starts with "semantic-": a bare `semantic`
  // token in RAG & Retrieval used to poach it into retrieval. It must home in
  // Agent Frameworks and rail with the other framework comparisons.
  upsertPost(mkPost({ slug: "semantic-kernel-vs-autogen-vs-microsoft-agent-framework",
    title: "Semantic Kernel vs AutoGen vs Microsoft Agent Framework", section: "stack", date: "2026-06-23" }), d);
  // the Haystack/LangChain/LlamaIndex comparison — `langchain`/`llamaindex` tokens
  upsertPost(mkPost({ slug: "haystack-vs-langchain-vs-llamaindex",
    title: "Haystack vs LangChain vs LlamaIndex", section: "stack", date: "2026-06-23" }), d);
  // an existing framework sibling they should rail with
  upsertPost(mkPost({ slug: "langgraph-vs-crewai-vs-autogen", title: "LangGraph vs CrewAI vs AutoGen",
    section: "stack", date: "2026-06-22" }), d);
  // the narrowed `semantic` token must still keep a semantic-search comparison in RAG
  upsertPost(mkPost({ slug: "hybrid-search-vs-semantic-search", title: "Hybrid vs Semantic Search",
    section: "stack", date: "2026-06-21" }), d);

  const clusters = comparisonClusters(d);
  const fw = clusters.find(c => c.label === "Agent Frameworks");
  assert.ok(fw, "an Agent Frameworks cluster exists");
  const fwSlugs = fw.posts.map(p => p.slug);
  assert.ok(fwSlugs.includes("semantic-kernel-vs-autogen-vs-microsoft-agent-framework"),
    "the Microsoft agent-stack piece buckets into Agent Frameworks, not RAG");
  assert.ok(fwSlugs.includes("haystack-vs-langchain-vs-llamaindex"),
    "the Haystack comparison buckets into Agent Frameworks");
  assert.ok(fwSlugs.includes("langgraph-vs-crewai-vs-autogen"),
    "they rail with the existing framework comparison");
  const rag = clusters.find(c => c.label === "RAG & Retrieval");
  assert.ok(rag && rag.posts.some(p => p.slug === "hybrid-search-vs-semantic-search"),
    "narrowing `semantic` keeps the semantic-search comparison in RAG & Retrieval");
  assert.ok(!rag.posts.some(p => p.slug === "semantic-kernel-vs-autogen-vs-microsoft-agent-framework"),
    "RAG & Retrieval does not poach semantic-kernel");
});

test("tool-integration/auth platforms rail with Protocols (MCP & A2A); agents-vs-workflows rails with Agent Reasoning & Planning", () => {
  clearPosts(d);
  // tool-integration/auth platforms (composio/arcade/toolhouse) own the per-user
  // OAuth vault MCP left open — they must rail with the MCP pieces, not the catch-all
  upsertPost(mkPost({ slug: "composio-vs-arcade-vs-toolhouse", title: "Composio vs Arcade vs Toolhouse",
    section: "stack", date: "2026-06-23" }), d);
  // an MCP sibling it should rail with
  upsertPost(mkPost({ slug: "mcp-gateway-contextforge-vs-agentgateway-vs-metamcp",
    title: "MCP Gateway", section: "stack", date: "2026-06-22" }), d);
  // the agents-vs-workflows architecture decision — its `workflows` token appears in
  // no earlier cluster, so it must home in Agent Reasoning & Planning (not catch-all)
  upsertPost(mkPost({ slug: "agents-vs-workflows", title: "Agents vs Workflows",
    section: "wire", date: "2026-06-23" }), d);
  // the reasoning-loop sibling it should rail with
  upsertPost(mkPost({ slug: "react-vs-plan-and-execute-vs-reflexion",
    title: "ReAct vs Plan-and-Execute vs Reflexion", section: "wire", date: "2026-06-22" }), d);

  const clusters = comparisonClusters(d);
  const protocols = clusters.find(c => c.label === "Protocols (MCP & A2A)");
  assert.ok(protocols, "a Protocols (MCP & A2A) cluster exists");
  const protoSlugs = protocols.posts.map(p => p.slug);
  assert.ok(protoSlugs.includes("composio-vs-arcade-vs-toolhouse"),
    "the tool-integration/auth comparison buckets into Protocols (MCP & A2A)");
  assert.ok(protoSlugs.includes("mcp-gateway-contextforge-vs-agentgateway-vs-metamcp"),
    "it rails with the MCP-gateway piece");
  const reasoning = clusters.find(c => c.label === "Agent Reasoning & Planning");
  assert.ok(reasoning, "an Agent Reasoning & Planning cluster exists");
  const reasonSlugs = reasoning.posts.map(p => p.slug);
  assert.ok(reasonSlugs.includes("agents-vs-workflows"),
    "agents-vs-workflows buckets into Agent Reasoning & Planning (not the catch-all)");
  assert.ok(reasonSlugs.includes("react-vs-plan-and-execute-vs-reflexion"),
    "it rails with the reasoning-loop pattern piece");
});

test("AI-coding-tool slugs get a Coding Agents & IDEs cluster without poaching CopilotKit", () => {
  clearPosts(d);
  // the IDE/assistant comparison — its slug carries a `copilot` token inside
  // "github-copilot" that the Agent UI & Frontend cluster would otherwise grab
  upsertPost(mkPost({ slug: "cursor-vs-windsurf-vs-github-copilot-vs-claude-code",
    title: "Cursor vs Windsurf vs GitHub Copilot vs Claude Code", section: "wire", date: "2026-06-22" }), d);
  // the OSS coding-agents sibling it should rail with (was in the catch-all before)
  upsertPost(mkPost({ slug: "aider-vs-cline-vs-openhands", title: "Aider vs Cline vs OpenHands",
    section: "stack", date: "2026-06-20" }), d);
  // the agent-UI library piece must STAY in Agent UI & Frontend (copilotkit, not copilot)
  upsertPost(mkPost({ slug: "copilotkit-vs-assistant-ui-vs-vercel-ai-sdk",
    title: "CopilotKit vs assistant-ui vs Vercel AI SDK", section: "stack", date: "2026-06-19" }), d);

  const clusters = comparisonClusters(d);
  const coding = clusters.find(c => c.label === "Coding Agents & IDEs");
  assert.ok(coding, "a Coding Agents & IDEs cluster exists");
  const codingSlugs = coding.posts.map(p => p.slug);
  assert.ok(codingSlugs.includes("cursor-vs-windsurf-vs-github-copilot-vs-claude-code"),
    "the IDE comparison buckets into Coding Agents & IDEs (copilot token doesn't send it to Agent UI)");
  assert.ok(codingSlugs.includes("aider-vs-cline-vs-openhands"),
    "the OSS coding-agents piece rails here too (rescued from the catch-all)");
  const ui = clusters.find(c => c.label === "Agent UI & Frontend");
  assert.ok(ui && ui.posts.some(p => p.slug === "copilotkit-vs-assistant-ui-vs-vercel-ai-sdk"),
    "CopilotKit stays in Agent UI & Frontend (copilotkit token; not poached by Coding)");
});

test("agent-instruction-file standard (AGENTS.md vs CLAUDE.md) rails with Coding Agents & IDEs", () => {
  clearPosts(d);
  // the config-layer comparison the same coding agents read — without the explicit
  // `agents-md`/`claude-md` tokens its slug carries none of the tool names, so it
  // would fall to the "More comparisons" catch-all
  upsertPost(mkPost({ slug: "agents-md-vs-claude-md", title: "AGENTS.md vs CLAUDE.md",
    section: "wire", date: "2026-06-23" }), d);
  // the terminal-coding-agent comparison it should rail with (claude-code/codex tokens)
  upsertPost(mkPost({ slug: "claude-code-vs-codex-cli-vs-gemini-cli", title: "Claude Code vs Codex CLI vs Gemini CLI",
    section: "wire", date: "2026-06-23" }), d);

  const coding = comparisonClusters(d).find(c => c.label === "Coding Agents & IDEs");
  assert.ok(coding, "a Coding Agents & IDEs cluster exists");
  const slugs = coding.posts.map(p => p.slug);
  assert.ok(slugs.includes("agents-md-vs-claude-md"),
    "the AGENTS.md vs CLAUDE.md config piece buckets into Coding Agents & IDEs (rescued from the catch-all)");
  assert.ok(slugs.includes("claude-code-vs-codex-cli-vs-gemini-cli"),
    "the terminal coding-agent comparison rails here too (claude-code/codex tokens)");
});

test("remote-browser-infra slugs (Browserbase/Steel/Browserless) rail with Web, Search & Browsing", () => {
  clearPosts(d);
  // a browser-INFRASTRUCTURE comparison; its product names don't carry a bare
  // `browser` token (the word boundary in `browser` won't match `browserbase`/
  // `browserless`), so without the explicit tokens it would fall to the catch-all
  upsertPost(mkPost({ slug: "browserbase-vs-steel-vs-browserless", title: "Browserbase vs Steel vs Browserless",
    section: "stack", date: "2026-06-22" }), d);
  // the automation-FRAMEWORK sibling it should rail with (same demand cluster)
  upsertPost(mkPost({ slug: "browser-use-vs-stagehand-vs-playwright-mcp", title: "browser-use vs Stagehand vs Playwright MCP",
    section: "wire", date: "2026-06-20" }), d);

  const sib = clusterSiblings("browserbase-vs-steel-vs-browserless", 4, d);
  assert.ok(sib, "a browser-infra comparison gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "Web, Search & Browsing", "buckets into Web, Search & Browsing by the infra-product vocab");
  assert.ok(sib.posts.some(p => p.slug === "browser-use-vs-stagehand-vs-playwright-mcp"),
    "rails with the browser-automation-framework sibling");
});

test("fine-tuning method/PEFT slugs get their own Fine-Tuning & Training cluster", () => {
  clearPosts(d);
  // a preference-optimization comparison whose slug carries none of the RAG vocab
  upsertPost(mkPost({ slug: "dpo-vs-ppo-vs-orpo", title: "DPO vs PPO vs ORPO",
    section: "wire", date: "2026-06-22" }), d);
  // a PEFT sibling it should rail with
  upsertPost(mkPost({ slug: "lora-vs-qlora-vs-full-fine-tuning", title: "LoRA vs QLoRA",
    section: "wire", date: "2026-06-22" }), d);
  // fine-tuning-vs-rag must STAY in RAG & Retrieval (RAG is matched first)
  upsertPost(mkPost({ slug: "fine-tuning-vs-rag", title: "Fine-Tuning vs RAG",
    section: "wire", date: "2026-06-21" }), d);
  // a RAG sibling so fine-tuning-vs-rag has a rail to land in
  upsertPost(mkPost({ slug: "best-vector-database-for-ai-agents", title: "Best Vector Database",
    section: "wire", date: "2026-06-20" }), d);

  const sib = clusterSiblings("dpo-vs-ppo-vs-orpo", 4, d);
  assert.ok(sib, "an alignment-method comparison gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "Fine-Tuning & Training", "buckets by training-method vocab");
  assert.ok(sib.posts.some(p => p.slug === "lora-vs-qlora-vs-full-fine-tuning"),
    "rails with the PEFT sibling");
  const rag = clusterSiblings("fine-tuning-vs-rag", 4, d);
  assert.equal(rag.label, "RAG & Retrieval",
    "fine-tuning-vs-rag stays in RAG (first-match-wins keeps it out of Fine-Tuning)");
});

test("RL post-training framework slugs bucket into Fine-Tuning & Training", () => {
  clearPosts(d);
  // an RL-framework comparison whose slug carries none of the older RAG/PEFT vocab
  upsertPost(mkPost({ slug: "verl-vs-openrlhf-vs-trl", title: "verl vs OpenRLHF vs TRL",
    section: "stack", date: "2026-06-22" }), d);
  // an alignment-method sibling it should rail with
  upsertPost(mkPost({ slug: "dpo-vs-ppo-vs-orpo", title: "DPO vs PPO vs ORPO",
    section: "wire", date: "2026-06-22" }), d);

  const sib = clusterSiblings("verl-vs-openrlhf-vs-trl", 4, d);
  assert.ok(sib, "an RL-framework comparison gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "Fine-Tuning & Training", "buckets by RL-framework vocab (verl/openrlhf/trl)");
  assert.ok(sib.posts.some(p => p.slug === "dpo-vs-ppo-vs-orpo"),
    "rails with the alignment-method sibling");
});

test("agent-benchmark slugs bucket into Evals & Observability, not the catch-all", () => {
  clearPosts(d);
  // an agent-benchmark comparison whose slug carries none of the eval-library vocab
  upsertPost(mkPost({ slug: "swe-bench-vs-tau-bench-vs-gaia", title: "SWE-bench vs τ-bench vs GAIA",
    section: "wire", date: "2026-06-22" }), d);
  // an eval-library sibling it should rail with
  upsertPost(mkPost({ slug: "deepeval-vs-ragas-vs-promptfoo", title: "DeepEval vs Ragas vs Promptfoo",
    section: "wire", date: "2026-06-21" }), d);

  const sib = clusterSiblings("swe-bench-vs-tau-bench-vs-gaia", 4, d);
  assert.ok(sib, "an agent-benchmark comparison gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "Evals & Observability", "buckets by benchmark vocab (swe-bench/tau-bench/gaia)");
  assert.ok(sib.posts.some(p => p.slug === "deepeval-vs-ragas-vs-promptfoo"),
    "rails with the eval-library sibling");
});

test("agent reasoning/planning pattern slugs get their own cluster, not the catch-all", () => {
  clearPosts(d);
  // a reasoning-pattern comparison whose slug carries none of the prompt/framework vocab
  upsertPost(mkPost({ slug: "react-vs-plan-and-execute-vs-reflexion", title: "ReAct vs Plan-and-Execute vs Reflexion",
    section: "wire", date: "2026-06-22" }), d);
  // a sibling pattern piece it should rail with
  upsertPost(mkPost({ slug: "chain-of-thought-vs-tree-of-thought", title: "CoT vs ToT",
    section: "wire", date: "2026-06-21" }), d);
  // two prompt-optimization pieces that must STAY in Prompts & Optimization (matched after)
  upsertPost(mkPost({ slug: "dspy-vs-textgrad-vs-adalflow", title: "DSPy vs TextGrad vs AdalFlow",
    section: "stack", date: "2026-06-20" }), d);
  upsertPost(mkPost({ slug: "dspy-vs-manual-prompting", title: "DSPy vs Manual Prompting",
    section: "wire", date: "2026-06-19" }), d);

  const sib = clusterSiblings("react-vs-plan-and-execute-vs-reflexion", 4, d);
  assert.ok(sib, "a reasoning-pattern comparison gets a cluster rail (not the catch-all)");
  assert.equal(sib.label, "Agent Reasoning & Planning", "buckets by reasoning-pattern vocab");
  assert.ok(sib.posts.some(p => p.slug === "chain-of-thought-vs-tree-of-thought"),
    "rails with the sibling pattern piece");
  const prompts = clusterSiblings("dspy-vs-textgrad-vs-adalflow", 4, d);
  assert.equal(prompts.label, "Prompts & Optimization",
    "DSPy stays in Prompts & Optimization (reasoning cluster doesn't poach the optimizers)");
});

test("relatedTo falls back to recency and respects the limit", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "a", tags: [], date: "2026-03-01" }), d);
  upsertPost(mkPost({ slug: "b", tags: [], date: "2026-03-03" }), d);
  upsertPost(mkPost({ slug: "c", tags: [], date: "2026-03-02" }), d);
  const rel = relatedTo("a", 2, d);
  assert.equal(rel.length, 2);
  assert.equal(rel[0].slug, "b"); // newest first when nothing else distinguishes
  assert.deepEqual(relatedTo("missing-slug", 3, d), []);
});

test("mostRead ranks by recent engagement and excludes stale/empty windows", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "hot", section: "wire" }), d);
  upsertPost(mkPost({ slug: "warm", section: "stack" }), d);
  upsertPost(mkPost({ slug: "old", section: "dispatches" }), d);
  const now = Date.now();
  // "hot": several recent reads/plays → highest score
  recordEvent("hot", "view", 0, now - 1000, d);
  recordEvent("hot", "read", 0, now - 1000, d);
  recordEvent("hot", "read", 0, now - 2000, d);
  recordEvent("hot", "audio_play", 0, now - 1500, d);
  // "warm": one recent view → present but below hot
  recordEvent("warm", "view", 0, now - 3000, d);
  // "old": engagement outside the window → excluded
  recordEvent("old", "read", 0, now - 30 * 86400000, d);

  const top = mostRead({ days: 7, limit: 5 }, d);
  assert.equal(top[0].slug, "hot", "most recently engaged ranks first");
  assert.ok(top.some(r => r.slug === "warm"), "recent view included");
  assert.ok(!top.some(r => r.slug === "old"), "stale engagement excluded by window");
  assert.ok(top.every(r => r.title && r.section), "rows joined to live posts");

  const empty = new Database(":memory:"); init(empty);
  assert.deepEqual(mostRead({ days: 7 }, empty), [], "no events → empty rail");
});

test("postsInSeries returns reading order: series_order, then date, then slug", () => {
  clearPosts(d);
  // same date — series_order must decide, not slug alphabetics
  upsertPost(mkPost({ slug: "a-first", series: "arc", series_order: 1, date: "2026-03-08" }), d);
  upsertPost(mkPost({ slug: "z-second", series: "arc", series_order: 2, date: "2026-03-08" }), d);
  upsertPost(mkPost({ slug: "m-third", series: "arc", series_order: 3, date: "2026-03-10" }), d);
  // a piece in a different series must not leak in
  upsertPost(mkPost({ slug: "other", series: "different", date: "2026-03-09" }), d);
  const arc = postsInSeries("arc", d);
  assert.deepEqual(arc.map(p => p.slug), ["a-first", "z-second", "m-third"]);
  assert.deepEqual(postsInSeries("", d), [], "empty series id → []");
  assert.deepEqual(postsInSeries("nope", d), [], "unknown series → []");
});

test("postsInSeries falls back to date when series_order is absent", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "late", series: "arc2", date: "2026-04-02" }), d);
  upsertPost(mkPost({ slug: "early", series: "arc2", date: "2026-04-01" }), d);
  assert.deepEqual(postsInSeries("arc2", d).map(p => p.slug), ["early", "late"]);
});

test("allSeries lists multi-part series only, latest-active first", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "p1", series: "big", date: "2026-01-01" }), d);
  upsertPost(mkPost({ slug: "p2", series: "big", date: "2026-02-01" }), d);
  upsertPost(mkPost({ slug: "p3", series: "small", date: "2026-03-01" }), d); // single → excluded
  upsertPost(mkPost({ slug: "p4", series: "", date: "2026-03-02" }), d);       // no series
  const list = allSeries(d);
  assert.equal(list.length, 1);
  assert.equal(list[0].series, "big");
  assert.equal(list[0].count, 2);
  assert.equal(list[0].started, "2026-01-01");
  assert.equal(list[0].latest, "2026-02-01");
});

test("hydrate parses tags and sources from JSON", () => {
  clearPosts(d);
  upsertPost(mkPost({ tags: ["x", "y", "z"], sources: [["u1", "l1"], ["u2", "l2"]] }), d);
  const p = getPost("test-post", d);
  assert.deepEqual(p.tags, ["x", "y", "z"]);
  assert.deepEqual(p.sources, [["u1", "l1"], ["u2", "l2"]]);
});

test("hydrate coerces featured and has_audio to boolean", () => {
  clearPosts(d);
  upsertPost(mkPost({ featured: true, has_audio: true }), d);
  const p = getPost("test-post", d);
  assert.equal(p.featured, true);
  assert.equal(p.has_audio, true);
  upsertPost(mkPost({ featured: false, has_audio: false }), d);
  const p2 = getPost("test-post", d);
  assert.equal(p2.featured, false);
  assert.equal(p2.has_audio, false);
});

test("upsert replaces on duplicate slug", () => {
  clearPosts(d);
  upsertPost(mkPost({ title: "First" }), d);
  upsertPost(mkPost({ title: "Second" }), d);
  assert.equal(countPosts(d), 1);
  assert.equal(getPost("test-post", d).title, "Second");
});

test("upsert applies defaults for missing fields", () => {
  clearPosts(d);
  upsertPost({ slug: "minimal", title: "Min", body_text: "txt" }, d);
  const p = getPost("minimal", d);
  assert.equal(p.author, "rosalinda");
  assert.equal(p.section, "dispatches");
  assert.equal(p.read_time, 1);
  assert.equal(p.dek, "");
  assert.deepEqual(p.tags, []);
});

test("getPost returns undefined for missing slug", () => {
  assert.equal(getPost("nope-not-here", d), undefined);
});

test("allPosts returns all and is ordered by date desc", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "old", date: "2026-01-01" }), d);
  upsertPost(mkPost({ slug: "new", date: "2026-06-01" }), d);
  upsertPost(mkPost({ slug: "mid", date: "2026-03-01" }), d);
  const all = allPosts(d);
  assert.equal(all.length, 3);
  assert.deepEqual(all.map(p => p.slug), ["new", "mid", "old"]);
});

test("postsBySection filters", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "d1", section: "dispatches" }), d);
  upsertPost(mkPost({ slug: "w1", section: "wire" }), d);
  upsertPost(mkPost({ slug: "w2", section: "wire" }), d);
  assert.equal(postsBySection("wire", d).length, 2);
  assert.equal(postsBySection("dispatches", d).length, 1);
  assert.equal(postsBySection("stack", d).length, 0);
});

test("countPosts counts", () => {
  clearPosts(d);
  assert.equal(countPosts(d), 0);
  upsertPost(mkPost({ slug: "a" }), d);
  upsertPost(mkPost({ slug: "b" }), d);
  assert.equal(countPosts(d), 2);
});

test("featuredPost returns the featured post", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "plain", featured: false, date: "2026-06-01" }), d);
  upsertPost(mkPost({ slug: "starred", featured: true, date: "2026-01-01" }), d);
  assert.equal(featuredPost(d).slug, "starred");
});

test("featuredPost falls back to newest when none featured", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "old", featured: false, date: "2026-01-01" }), d);
  upsertPost(mkPost({ slug: "new", featured: false, date: "2026-06-01" }), d);
  assert.equal(featuredPost(d).slug, "new");
});

// ── search ───────────────────────────────────────────────────────────────────
test("search returns relevant hits", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "agentic-post", title: "Agentic Systems", body_text: "all about agents" }), d);
  upsertPost(mkPost({ slug: "cooking", title: "Cooking Pasta", body_text: "boil water" }), d);
  const hits = search("agent", d);
  assert.ok(hits.length >= 1);
  assert.ok(hits.some(h => h.slug === "agentic-post"));
});

test("search prefix matching", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "p1", title: "Memory Systems", body_text: "memory and recall" }), d);
  const hits = search("memo", d);
  assert.ok(hits.some(h => h.slug === "p1"));
});

test("search returns a body snippet with matched terms sentinel-wrapped", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "snip", title: "On Latency",
    body_text: "The tail latency is where production agents quietly fall apart at scale." }), d);
  const hits = search("latency", d);
  const h = hits.find((x) => x.slug === "snip");
  assert.ok(h, "found the post");
  assert.equal(typeof h.snippet, "string");
  // the matched term is wrapped in STX/ETX sentinels for the render layer
  const STX = String.fromCharCode(2), ETX = String.fromCharCode(3);
  assert.ok(h.snippet.includes(STX + "latency" + ETX),
    `snippet should sentinel-wrap the match: ${JSON.stringify(h.snippet)}`);
});

test("search empty string returns []", () => {
  assert.deepEqual(search("", d), []);
});

test("search whitespace returns []", () => {
  assert.deepEqual(search("   ", d), []);
});

test("search garbage returns []", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "p1", body_text: "real content" }), d);
  assert.deepEqual(search("zzqxw99999", d), []);
});

test("search strips quotes without throwing", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "p1", title: "Agent quote test", body_text: "agent" }), d);
  assert.doesNotThrow(() => search('"agent"', d));
  assert.doesNotThrow(() => search("agent's", d));
  const hits = search('"agent"', d);
  assert.ok(hits.some(h => h.slug === "p1"));
});

test("search handles fts special chars gracefully", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "p1", body_text: "content" }), d);
  // these would break a naive MATCH; should not throw, returns array
  assert.ok(Array.isArray(search("a AND b", d)));
  assert.ok(Array.isArray(search("(((", d)));
  assert.ok(Array.isArray(search("a OR", d)));
});

test("search results are hydrated", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "p1", title: "agent", tags: ["t1"], featured: true }), d);
  const hits = search("agent", d);
  const h = hits.find(x => x.slug === "p1");
  assert.deepEqual(h.tags, ["t1"]);
  assert.equal(h.featured, true);
});

// ── view counters ────────────────────────────────────────────────────────────
test("bumpView increments from zero", () => {
  assert.equal(getViews("view-test", d), 0);
  assert.equal(bumpView("view-test", d), 1);
  assert.equal(bumpView("view-test", d), 2);
  assert.equal(bumpView("view-test", d), 3);
});

test("getViews persists count", () => {
  bumpView("view-test-2", d);
  bumpView("view-test-2", d);
  assert.equal(getViews("view-test-2", d), 2);
});

test("getViews unknown slug is 0", () => {
  assert.equal(getViews("never-viewed", d), 0);
});

test("totalViews sums all counters", () => {
  const d2 = new Database(":memory:");
  init(d2);
  bumpView("a", d2);
  bumpView("a", d2);
  bumpView("b", d2);
  assert.equal(totalViews(d2), 3);
  d2.close();
});

test("totalViews is 0 on empty db", () => {
  const d3 = new Database(":memory:");
  init(d3);
  assert.equal(totalViews(d3), 0);
  d3.close();
});

// ── submissions ──────────────────────────────────────────────────────────────
test("addSubmission inserts and returns id", () => {
  const id = addSubmission({ slug: "s1", title: "Sub One", section: "wire", author: "abe" }, d);
  assert.ok(id >= 1);
});

test("listSubmissions returns inserted rows newest first", () => {
  const d4 = new Database(":memory:");
  init(d4);
  addSubmission({ slug: "first", title: "First", section: "wire", author: "abe" }, d4);
  addSubmission({ slug: "second", title: "Second", section: "stack", author: "indexer" }, d4);
  const list = listSubmissions(d4);
  assert.equal(list.length, 2);
  assert.equal(list[0].slug, "second"); // newest first (id DESC)
  assert.equal(list[1].slug, "first");
  assert.equal(list[0].status, "pending");
  d4.close();
});

test("addSubmission stores payload as JSON (round-trip via raw query)", () => {
  const d5 = new Database(":memory:");
  init(d5);
  addSubmission({ slug: "p", title: "P", section: "wire", author: "abe", body: "hello" }, d5);
  const row = d5.prepare("SELECT payload FROM submissions").get();
  const parsed = JSON.parse(row.payload);
  assert.equal(parsed.body, "hello");
  assert.equal(parsed.slug, "p");
  d5.close();
});
