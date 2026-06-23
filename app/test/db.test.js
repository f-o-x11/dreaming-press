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
