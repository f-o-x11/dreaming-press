// Tests for the data-backed Stack engine (#10/#12/#16/#22/#13).
import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { init, seedTools, allTools, getTool, toolsByCategory } from "../lib/db.js";
import * as TR from "../lib/tools-render.js";

function freshDb() { const d = new Database(":memory:"); init(d); return d; }

test("seedTools populates the catalog", () => {
  const d = freshDb();
  const tools = allTools(d);
  assert.ok(tools.length >= 20, "at least 20 tools seeded");
  assert.ok(getTool("langgraph", d), "langgraph present");
  assert.ok(toolsByCategory("vectordb", d).length >= 3, "vectordb category populated");
});

test("lightweight agent frameworks are tracked with canonical repos (entity reconciliation)", () => {
  // These frameworks are named in compare-table headers across multiple money pages
  // (agno-vs-langgraph-vs-crewai, openai-agents-sdk-vs-…, pydantic-ai-vs-…). Tracking
  // each gives its `about` Thing a canonical `sameAs` repo instead of a bare name, the
  // disambiguation #25/#48 reward. Pin owner/repo so a future catalog edit can't
  // silently drop them and re-orphan those entities.
  const d = freshDb();
  const expect = {
    "openai-agents-sdk": "openai/openai-agents-python",
    "agno": "agno-agi/agno",
    "google-adk": "google/adk-python",
    "claude-agent-sdk": "anthropics/claude-agent-sdk-python",
    "strands-agents": "strands-agents/sdk-python",
    "cloudflare-agents": "cloudflare/agents",
  };
  for (const [slug, repo] of Object.entries(expect)) {
    const t = getTool(slug, d);
    assert.ok(t, `${slug} present in catalog`);
    assert.equal(`${t.owner}/${t.repo}`, repo, `${slug} points at ${repo}`);
    assert.equal(t.category, "framework", `${slug} lives in the framework category`);
  }
});

test("seedTools preserves higher live star counts (MAX)", () => {
  const d = freshDb();
  d.prepare("UPDATE tools SET stars = 999999 WHERE slug = 'langgraph'").run();
  seedTools(d); // re-seed should not lower the synced value
  assert.equal(getTool("langgraph", d).stars, 999999);
});

test("tool pages render with structured data", () => {
  const d = freshDb();
  const t = getTool("langgraph", d);
  const alts = t.alternatives.map(s => getTool(s, d)).filter(Boolean);
  const page = TR.renderToolPage(t, [], alts);
  assert.match(page, /SoftwareSourceCode/);
  assert.match(page, /BreadcrumbList/);
  assert.match(TR.renderBest("vectordb", toolsByCategory("vectordb", d)), /ItemList/);
  assert.match(TR.renderCompare(getTool("langgraph", d), getTool("crewai", d)), /vs/);
  assert.match(TR.renderStateReport(allTools(d)), /Dataset/);
});

test("alternatives page renders ranked siblings with compare links + schema", () => {
  const d = freshDb();
  const t = getTool("langgraph", d);
  const siblings = toolsByCategory(t.category, d).filter(x => x.slug !== t.slug)
    .sort((a, b) => (b.stars || 0) - (a.stars || 0));
  assert.ok(siblings.length >= 2, "framework category has siblings");
  const page = TR.renderAlternatives(t, siblings);
  assert.match(page, /LangGraph alternatives/, "H1/title names the tool");
  assert.match(page, /ItemList/, "emits ItemList schema");
  assert.match(page, /BreadcrumbList/, "emits breadcrumb schema");
  // a head-to-head compare link for the top sibling, self excluded
  assert.match(page, new RegExp(`/compare/langgraph-vs-${siblings[0].slug}`));
  assert.doesNotMatch(page, /compare\/langgraph-vs-langgraph/, "tool is not its own alternative");
});

// ── LLM VRAM calculator (lib/calc.js + renderVramCalculator, #28) ─────────────
import { vramEstimate, bytesPerElem, gpusNeeded, VRAM_PRESETS } from "../lib/calc.js";

test("vramEstimate decomposes weights + KV cache + overhead correctly", () => {
  // Llama 3.1 8B at fp16, 8k context, single request: a known-good reference point.
  const r = vramEstimate({ paramsB: 8, weightPrecision: "fp16", nLayers: 32,
    nKvHeads: 8, headDim: 128, seqLen: 8192, batch: 1, kvPrecision: "fp16", overheadPct: 20 });
  // weights = 8e9 × 2 bytes = 16e9 B = 14.90 GiB
  assert.ok(Math.abs(r.weightsGB - 14.901) < 0.01, `weights ~14.9 GiB, got ${r.weightsGB}`);
  // KV = 2 × 8 × 128 × 2 × 32 × 8192 × 1 = 1.073e9 B = 1.0 GiB
  assert.ok(Math.abs(r.kvGB - 1.0) < 0.05, `KV ~1.0 GiB, got ${r.kvGB}`);
  // overhead = 20% of (weights + KV); total = base × 1.2
  assert.ok(Math.abs(r.overheadGB - (r.weightsGB + r.kvGB) * 0.2) < 1e-6, "overhead is 20% of base");
  assert.ok(Math.abs(r.totalGB - (r.weightsGB + r.kvGB) * 1.2) < 1e-6, "total = base + overhead");
});

test("vramEstimate honors precision and GQA scaling", () => {
  const fp16 = vramEstimate({ paramsB: 70, weightPrecision: "fp16", nKvHeads: 8 });
  const int4 = vramEstimate({ paramsB: 70, weightPrecision: "int4", nKvHeads: 8 });
  assert.ok(int4.weightsGB < fp16.weightsGB / 3.5, "int4 weights ~1/4 of fp16");
  assert.equal(bytesPerElem("int4"), 0.5);
  assert.equal(bytesPerElem("fp16"), 2);
  // more KV heads (MHA) ⇒ larger cache than GQA at equal everything else
  const gqa = vramEstimate({ paramsB: 8, nKvHeads: 8, headDim: 128 });
  const mha = vramEstimate({ paramsB: 8, nKvHeads: 32, headDim: 128 });
  assert.ok(mha.kvGB > gqa.kvGB * 3.9, "MHA (32 KV heads) caches ~4× the GQA (8) cache");
});

test("gpusNeeded rounds up to whole accelerators", () => {
  assert.equal(gpusNeeded(159, 80), 2);
  assert.equal(gpusNeeded(40, 80), 1);
  assert.equal(gpusNeeded(0, 80), 1);
});

test("renderVramCalculator renders schema, form, and a default output that matches calc.js (no drift)", () => {
  const html = TR.renderVramCalculator();
  // server-rendered default must equal the pure estimator (locks the inline mirror)
  const def = vramEstimate({ ...VRAM_PRESETS["llama31-8b"], weightPrecision: "fp16",
    kvPrecision: "fp16", seqLen: 8192, batch: 1, overheadPct: 20 });
  assert.ok(html.includes(`<span id="out-total">${def.totalGB.toFixed(1)}</span>`),
    "default total VRAM is rendered server-side");
  assert.ok(html.includes(`<span id="out-weights">${def.weightsGB.toFixed(1)}</span>`), "weights rendered");
  assert.ok(html.includes('"@type":"WebApplication"'), "WebApplication schema present");
  assert.ok(html.includes('id="preset"') && html.includes('id="seqLen"'), "form controls present");
  assert.ok(html.includes("/calculators/llm-vram"), "canonical URL present");
  assert.ok(html.includes("/posts/how-much-vram-to-serve-an-llm"), "cross-links to the supporting article");
  assert.ok(html.includes("eleuther.ai/transformer-math"), "cites a real formula source");
});
