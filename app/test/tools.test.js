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
import { vramEstimate, bytesPerElem, gpusNeeded, VRAM_PRESETS, llmCostEstimate, COST_PRESETS, llmLatencyEstimate, LATENCY_PRESETS, contextBudgetEstimate, CONTEXT_PRESETS } from "../lib/calc.js";

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

// ── LLM API cost calculator (lib/calc.js + renderLlmCostCalculator, #28) ──────
test("llmCostEstimate splits cached/uncached input, output, and caching savings", () => {
  // 4k input (2k cached) + 500 output at Opus list prices, 100k requests/mo.
  const r = llmCostEstimate({ requests: 100000, inputTokens: 4000, cachedTokens: 2000,
    outputTokens: 500, inPrice: 5, cachePrice: 0.5, outPrice: 25 });
  // input = (2000×5 + 2000×0.5)/1e6 = 0.011 ; output = 500×25/1e6 = 0.0125
  assert.ok(Math.abs(r.inputCostPerReq - 0.011) < 1e-9, `input/req 0.011, got ${r.inputCostPerReq}`);
  assert.ok(Math.abs(r.outputCostPerReq - 0.0125) < 1e-9, `output/req 0.0125, got ${r.outputCostPerReq}`);
  assert.ok(Math.abs(r.costPerRequest - 0.0235) < 1e-9, `cost/req 0.0235, got ${r.costPerRequest}`);
  assert.ok(Math.abs(r.monthlyCost - 2350) < 1e-6, `monthly 2350, got ${r.monthlyCost}`);
  assert.ok(Math.abs(r.annualCost - 28200) < 1e-6, "annual = 12× monthly");
  // no-cache counterfactual: (4000×5 + 500×25)/1e6 × 100k = 3250 ; saves 900 (~27.7%)
  assert.ok(Math.abs(r.monthlyNoCache - 3250) < 1e-6, `no-cache 3250, got ${r.monthlyNoCache}`);
  assert.ok(Math.abs(r.cacheSavings - 900) < 1e-6, `saves 900, got ${r.cacheSavings}`);
  assert.ok(Math.abs(r.savingsPct - 27.6923) < 0.01, `saves ~27.7%, got ${r.savingsPct}`);
});

test("llmCostEstimate clamps cached ≤ input and handles a zero-cache case", () => {
  // cached can't exceed the prompt; over-spec falls back to the whole input cached
  const clamped = llmCostEstimate({ inputTokens: 1000, cachedTokens: 5000,
    outputTokens: 0, inPrice: 5, cachePrice: 0.5, outPrice: 25, requests: 1 });
  assert.ok(Math.abs(clamped.inputCostPerReq - (1000 * 0.5) / 1e6) < 1e-12, "all input billed at cache rate");
  // no caching at all ⇒ zero savings, not NaN
  const noCache = llmCostEstimate({ inputTokens: 1000, cachedTokens: 0,
    outputTokens: 500, inPrice: 5, cachePrice: 0.5, outPrice: 25, requests: 1000 });
  assert.equal(noCache.cacheSavings, 0, "no cached tokens ⇒ no savings");
  assert.equal(noCache.savingsPct, 0, "savings pct is 0, not NaN");
});

test("renderLlmCostCalculator renders schema, form, and a default output that matches calc.js (no drift)", () => {
  const html = TR.renderLlmCostCalculator();
  const def = llmCostEstimate({ ...COST_PRESETS["claude-opus-48"], requests: 100000,
    inputTokens: 4000, cachedTokens: 2000, outputTokens: 500 });
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  assert.ok(html.includes(`id="out-monthly">${usd(def.monthlyCost)}</span>`),
    "default monthly cost is rendered server-side");
  assert.ok(html.includes(`id="out-perreq">$${def.costPerRequest.toFixed(4)}</span>`), "cost/request rendered");
  assert.ok(html.includes(`id="out-savings">${usd(def.cacheSavings)}</span>`), "cache savings rendered");
  assert.ok(html.includes('"@type":"WebApplication"'), "WebApplication schema present");
  assert.ok(html.includes('id="preset"') && html.includes('id="cachePrice"'), "form controls present");
  assert.ok(html.includes("/calculators/llm-cost"), "canonical URL present");
  assert.ok(html.includes("/posts/prompt-caching-for-ai-agents"), "cross-links to a supporting article");
  assert.ok(html.includes("platform.claude.com/docs") && html.includes("ai.google.dev/gemini-api"), "cites real pricing sources");
});

// ── LLM latency calculator (lib/calc.js + renderLlmLatencyCalculator, #28) ────
test("llmLatencyEstimate splits TTFT and generation and sums sequential turns", () => {
  // 8k prompt @3000 tok/s prefill + 400ms overhead; 150 out @80 tok/s; 8 turns.
  const r = llmLatencyEstimate({ promptTokens: 8000, outputTokens: 150,
    decodeRate: 80, prefillRate: 3000, overheadMs: 400, turns: 8 });
  // prefill = 8000/3000*1000 = 2666.666…ms ; ttft = 400 + that = 3066.666…
  assert.ok(Math.abs(r.prefillMs - 2666.6667) < 1e-3, `prefill ~2666.67ms, got ${r.prefillMs}`);
  assert.ok(Math.abs(r.ttftMs - 3066.6667) < 1e-3, `ttft ~3066.67ms, got ${r.ttftMs}`);
  // decode = 150/80*1000 = 1875ms ; per call = 4941.666…
  assert.ok(Math.abs(r.decodeMs - 1875) < 1e-6, `decode 1875ms, got ${r.decodeMs}`);
  assert.ok(Math.abs(r.perCallMs - 4941.6667) < 1e-3, `per-call ~4941.67ms, got ${r.perCallMs}`);
  // task = per call × 8 = 39533.33…ms
  assert.ok(Math.abs(r.taskMs - 39533.3333) < 1e-2, `task ~39533.33ms, got ${r.taskMs}`);
  // the agent point: TTFT is the majority of the wall clock here (~62%), not decode
  assert.ok(Math.abs(r.ttftShare - 62.0573) < 0.01, `ttft share ~62.06%, got ${r.ttftShare}`);
  assert.ok(r.ttftShare > 50, "short outputs over many turns ⇒ TTFT dominates");
});

test("llmLatencyEstimate guards divisors and a single-call (chat) case", () => {
  // zero/negative rates fall back to defaults, never divide-by-zero → Infinity
  const guarded = llmLatencyEstimate({ promptTokens: 1000, outputTokens: 1000,
    decodeRate: 0, prefillRate: -5, overheadMs: 0, turns: 1 });
  assert.ok(Number.isFinite(guarded.perCallMs) && guarded.perCallMs > 0, "no divide-by-zero");
  // a single long chat reply: decode dominates, TTFT is the minority
  const chat = llmLatencyEstimate({ promptTokens: 500, outputTokens: 2000,
    decodeRate: 80, prefillRate: 3000, overheadMs: 300, turns: 1 });
  assert.ok(chat.ttftShare < 50, "one long reply ⇒ generation dominates, not TTFT");
  assert.equal(chat.taskMs, chat.perCallMs, "one turn ⇒ task == per-call");
});

test("renderLlmLatencyCalculator renders schema, form, and a default output that matches calc.js (no drift)", () => {
  const html = TR.renderLlmLatencyCalculator();
  const def = llmLatencyEstimate({ ...LATENCY_PRESETS["frontier-api"],
    promptTokens: 8000, outputTokens: 150, turns: 8 });
  const dur = (ms) => { const s = ms / 1000; return (s < 10 ? s.toFixed(2) : s.toFixed(1)) + "s"; };
  assert.ok(html.includes(`id="out-ttft">${dur(def.ttftMs)}</span>`), "default TTFT rendered server-side");
  assert.ok(html.includes(`id="out-task">${dur(def.taskMs)}</span>`), "end-to-end agent latency rendered");
  assert.ok(html.includes(`id="out-share">${def.ttftShare.toFixed(0)}%</span>`), "TTFT share rendered");
  assert.ok(html.includes('"@type":"WebApplication"'), "WebApplication schema present");
  assert.ok(html.includes('id="preset"') && html.includes('id="turns"'), "form controls present");
  assert.ok(html.includes("/calculators/llm-latency"), "canonical URL present");
  assert.ok(html.includes("/posts/llm-inference-latency-ttft-vs-tpot"), "cross-links to a supporting article");
  assert.ok(html.includes("databricks.com") && html.includes("developer.nvidia.com"), "cites real inference-perf sources");
});

// ── context-window budget calculator (lib/calc.js + renderContextBudgetCalculator, #28) ──
test("contextBudgetEstimate subtracts fixed overhead + output reserve, then divides into turns", () => {
  // 200K window; 1.5K system + 6K tools + 4K memory = 11.5K fixed; 8K reserve.
  const r = contextBudgetEstimate({ contextWindow: 200000, systemPrompt: 1500,
    toolDefs: 6000, memory: 4000, outputReserve: 8000, tokensPerTurn: 2500 });
  assert.equal(r.fixed, 11500, "fixed = system + tools + memory");
  assert.equal(r.reserved, 19500, "reserved = fixed + output reserve");
  assert.equal(r.usable, 180500, "usable = window − reserved");
  assert.equal(r.maxTurns, 72, "floor(180500/2500) = 72 turns before compaction");
  assert.ok(Math.abs(r.fixedShare - 5.75) < 1e-9, `fixed share 5.75%, got ${r.fixedShare}`);
  assert.ok(Math.abs(r.usableShare - 90.25) < 1e-9, `usable share 90.25%, got ${r.usableShare}`);
});

test("contextBudgetEstimate clamps when overhead exceeds the window and guards divisors", () => {
  // overhead bigger than an 8K window ⇒ no negative usable, no negative turns
  const over = contextBudgetEstimate({ contextWindow: 8000, systemPrompt: 2000,
    toolDefs: 6000, memory: 2000, outputReserve: 1000, tokensPerTurn: 2000 });
  assert.equal(over.usable, 0, "usable floors at 0, never negative");
  assert.equal(over.maxTurns, 0, "no room ⇒ 0 turns");
  // zero/blank divisors fall back to defaults instead of dividing by zero
  const guarded = contextBudgetEstimate({ contextWindow: 0, tokensPerTurn: 0 });
  assert.ok(Number.isFinite(guarded.maxTurns) && Number.isFinite(guarded.fixedShare), "no NaN/Infinity from zero divisors");
});

test("renderContextBudgetCalculator renders schema, form, and a default output that matches calc.js (no drift)", () => {
  const html = TR.renderContextBudgetCalculator();
  const def = contextBudgetEstimate({ ...CONTEXT_PRESETS["200k-frontier"],
    systemPrompt: 1500, toolDefs: 6000, memory: 4000, tokensPerTurn: 2500 });
  const tok = (n) => { n = Math.round(n); if (n >= 10000) return Math.round(n / 1000) + "K";
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K"; return String(n); };
  assert.ok(html.includes(`id="out-usable">${tok(def.usable)}</span>`), "default usable tokens rendered server-side");
  assert.ok(html.includes(`id="out-turns">${def.maxTurns}</span>`), "turns-before-compaction rendered");
  assert.ok(html.includes(`id="out-overhead">${def.fixedShare.toFixed(0)}%</span>`), "fixed-overhead share rendered");
  assert.ok(html.includes(`id="out-usableshare">${def.usableShare.toFixed(0)}%</span>`), "usable share rendered");
  assert.ok(html.includes('"@type":"WebApplication"'), "WebApplication schema present");
  assert.ok(html.includes('id="preset"') && html.includes('id="tokensPerTurn"'), "form controls present");
  assert.ok(html.includes("/calculators/context-budget"), "canonical URL present");
  assert.ok(html.includes("/posts/should-an-ai-agent-compact-its-own-context"), "cross-links to a supporting article");
  assert.ok(html.includes("anthropic.com/engineering") && html.includes("research.trychroma.com"), "cites real context-engineering sources");
});

// ── /calculators hub (renderCalculators, #28) ─────────────────────────────────
test("renderCalculators builds a CollectionPage hub linking every calculator", () => {
  const html = TR.renderCalculators();
  assert.match(html, /<h1>Calculators<\/h1>/);
  assert.match(html, /"@type":"CollectionPage"/);
  assert.match(html, /"@type":"ItemList"/);
  for (const path of ["/calculators/llm-vram", "/calculators/llm-cost",
    "/calculators/llm-latency", "/calculators/context-budget"]) {
    assert.ok(html.includes(`href="${path}"`), `${path} missing from hub`);
  }
  const m = html.match(/"numberOfItems":(\d+)/);
  assert.ok(m && Number(m[1]) === 4, "ItemList counts all four calculators");
  assert.ok(html.includes('"url":"https://dreaming.press/calculators"'), "canonical hub URL present");
});

