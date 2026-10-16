// calc.js — pure, testable estimators behind the interactive calculators
// (council move #28: "bespoke calculators extend the data engine"). Kept free of
// any rendering or I/O so the same math runs in a Node unit test and, mirrored,
// in the page's inline client script — one formula, two call sites, locked by a
// render test that asserts the server-default output equals this function's.
//
// The LLM-serving VRAM estimate is the standard decomposition (see EleutherAI's
// "Transformer Math 101" and the vLLM/PagedAttention KV-cache docs):
//
//   VRAM ≈ weights + KV cache + overhead
//     weights      = params × bytes/param
//     KV cache     = 2 (K and V) × n_layers × n_kv_heads × head_dim
//                      × seq_len × batch × bytes/elem
//     overhead     = (weights + KV) × overhead%      (activations, fragmentation,
//                                                      CUDA context, paging slack)
//
// GQA/MQA models share KV heads across query heads, so KV scales with n_kv_heads
// (≤ n_attn_heads), which is why a 70B model's cache is far smaller than a naive
// n_heads estimate suggests. All sizes are reported in GiB (2^30 bytes).

export const GIB = 1024 ** 3;

// bytes per stored element at a given numeric precision
export function bytesPerElem(precision) {
  return ({ fp32: 4, fp16: 2, bf16: 2, fp8: 1, int8: 1, int4: 0.5 })[precision] ?? 2;
}

// Common accelerator memory sizes (GB, vendor-stated) used only to phrase a
// human "how many GPUs" verdict. Stable hardware facts, not pricing.
export const ACCELERATORS = [
  { name: "RTX 4090", gb: 24 },
  { name: "L40S", gb: 48 },
  { name: "A100 80GB", gb: 80 },
  { name: "H100 80GB", gb: 80 },
  { name: "H200", gb: 141 },
  { name: "B200", gb: 192 },
];

// Verifiable, stable architecture presets (head_dim = hidden_size / n_attn_heads).
// Numbers are the published configs for these widely-served open weights.
export const VRAM_PRESETS = {
  "llama31-8b":  { label: "Llama 3.1 8B",  paramsB: 8,   nLayers: 32, nKvHeads: 8, headDim: 128 },
  "llama31-70b": { label: "Llama 3.1 70B", paramsB: 70,  nLayers: 80, nKvHeads: 8, headDim: 128 },
  "mistral-7b":  { label: "Mistral 7B",    paramsB: 7.2, nLayers: 32, nKvHeads: 8, headDim: 128 },
  "qwen25-32b":  { label: "Qwen2.5 32B",   paramsB: 32,  nLayers: 64, nKvHeads: 8, headDim: 128 },
};

// Clamp + coerce a numeric input; falls back to `def` on NaN/≤0 where required.
function num(v, def, { min = 0, allowZero = false } = {}) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  if (n < min) return min;
  if (!allowZero && n <= 0) return def;
  return n;
}

// Core estimate. Inputs are plain numbers/strings; output is GiB figures.
export function vramEstimate(opts = {}) {
  const paramsB = num(opts.paramsB, 8);
  const nLayers = num(opts.nLayers, 32);
  const nKvHeads = num(opts.nKvHeads, 8);
  const headDim = num(opts.headDim, 128);
  const seqLen = num(opts.seqLen, 8192);
  const batch = num(opts.batch, 1);
  const wBytes = bytesPerElem(opts.weightPrecision || "fp16");
  const kvBytes = bytesPerElem(opts.kvPrecision || "fp16");
  const overheadPct = num(opts.overheadPct, 20, { allowZero: true });

  const weights = paramsB * 1e9 * wBytes;
  const kvPerTokenPerLayer = 2 * nKvHeads * headDim * kvBytes; // 2 = K and V
  const kv = kvPerTokenPerLayer * nLayers * seqLen * batch;
  const base = weights + kv;
  const overhead = base * (overheadPct / 100);
  const total = base + overhead;

  return {
    weightsGB: weights / GIB,
    kvGB: kv / GIB,
    overheadGB: overhead / GIB,
    totalGB: total / GIB,
  };
}

// Smallest count of a given accelerator that clears a total VRAM requirement.
export function gpusNeeded(totalGB, cardGB) {
  return Math.max(1, Math.ceil(totalGB / cardGB));
}

// ── LLM API token-cost estimate ──────────────────────────────────────────────
// The other half of "what does it cost to run this" — not GPU memory but the
// per-token API bill. The arithmetic is trivial; the value is modelling the two
// levers that actually move a production invoice: prompt caching (a cache *read*
// costs ~0.1× the base input rate across Anthropic, OpenAI, and Gemini) and the
// input/output split (output tokens are 3–6× the input rate, so a chatty agent's
// bill is dominated by what it writes, not what it reads).
//
//   cost/request = (uncached_in × in$ + cached_in × cache$ + out × out$) / 1e6
//   monthly      = cost/request × requests
//
// Prices are dollars per 1,000,000 tokens — the unit every provider quotes.

// List prices ($/1M tokens) as a dated snapshot. Providers change these often,
// so the page treats them as editable defaults, not gospel — every field is an
// input the reader overwrites with their own contract or the current rate. Cache
// read is usually ~0.1× input (Anthropic cache read = 0.1× base; Gemini $0.20 vs
// $2.00; OpenAI GPT-5.5 $0.50 vs $5.00). Fable 5.1 is the exception: its Sept 1
// 2026 launch kept the $10/$50 base but cut the cache read to $0.25 (0.025× base,
// a 75% cut from Fable 5's $1.00) — which is exactly why it favours cache-heavy
// agent loops, and why the preset is worth pricing against Opus 4.8 here.
export const COST_PRESETS = {
  "claude-fable-51":  { label: "Claude Fable 5.1",    inPrice: 10,   cachePrice: 0.25, outPrice: 50 },
  "claude-opus-48":   { label: "Claude Opus 4.8",     inPrice: 5,    cachePrice: 0.5,  outPrice: 25 },
  "claude-sonnet-46": { label: "Claude Sonnet 4.6",   inPrice: 3,    cachePrice: 0.3,  outPrice: 15 },
  "claude-haiku-45":  { label: "Claude Haiku 4.5",    inPrice: 1,    cachePrice: 0.1,  outPrice: 5 },
  "gpt-55":           { label: "GPT-5.5",             inPrice: 5,    cachePrice: 0.5,  outPrice: 30 },
  "gpt-54":           { label: "GPT-5.4",             inPrice: 2.5,  cachePrice: 0.25, outPrice: 15 },
  "gemini-31-pro":    { label: "Gemini 3.1 Pro",      inPrice: 2,    cachePrice: 0.2,  outPrice: 12 },
  "gemini-35-flash":  { label: "Gemini 3.5 Flash",    inPrice: 1.5,  cachePrice: 0.15, outPrice: 9 },
  "gemini-25-lite":   { label: "Gemini 2.5 Flash-Lite", inPrice: 0.1, cachePrice: 0.01, outPrice: 0.4 },
};

// ── LLM latency / throughput estimate ────────────────────────────────────────
// The third "before you serve a model" question after capacity (VRAM) and price
// (cost): how fast will it FEEL? A request's wall-clock splits into two regimes:
//
//   TTFT (time to first token) = fixed_overhead + prompt_tokens / prefill_rate
//   generation                  = output_tokens / decode_rate
//   per_call                    = TTFT + generation
//   agent_task                  = per_call × sequential_turns
//
// The non-obvious lever lives in the last line. A chat reply pays TTFT once and
// then streams a long answer, so decode dominates and "tokens/sec" is the number
// that matters. An AGENT serializes many short calls — each tool-use turn re-reads
// a growing context (long prefill) and emits a tiny action (short decode) — so it
// pays the TTFT tax once PER TURN while barely touching the decode regime. End to
// end, a multi-step agent's latency is dominated by time-to-first-token, not by
// raw generation speed, which is why a high-throughput model can still feel slow
// in a loop and a snappy-TTFT model can win despite a lower tokens/sec headline.

// Representative (model × hardware) speeds. These are order-of-magnitude typical
// figures, not a benchmark — every field is an editable default the reader
// overwrites with their own measured numbers. decode/prefill in tokens/sec.
export const LATENCY_PRESETS = {
  "frontier-api":   { label: "Frontier API (fast tier)",        decodeRate: 80,  prefillRate: 3000, overheadMs: 400 },
  "frontier-large": { label: "Frontier API (largest model)",    decodeRate: 45,  prefillRate: 2000, overheadMs: 600 },
  "fast-inference": { label: "Fast-inference host (LPU-class)",  decodeRate: 750, prefillRate: 6000, overheadMs: 200 },
  "local-8b":       { label: "Local 8B, single GPU (vLLM)",      decodeRate: 120, prefillRate: 6000, overheadMs: 150 },
  "local-70b":      { label: "Local 70B, one node",             decodeRate: 25,  prefillRate: 1500, overheadMs: 300 },
};

export function llmLatencyEstimate(opts = {}) {
  const promptTokens = num(opts.promptTokens, 8000, { min: 0, allowZero: true });
  const outputTokens = num(opts.outputTokens, 150, { min: 0, allowZero: true });
  const decodeRate = num(opts.decodeRate, 80, { min: 1 });     // tok/s — clamp ≥1 (divisor)
  const prefillRate = num(opts.prefillRate, 3000, { min: 1 }); // tok/s — clamp ≥1 (divisor)
  const overheadMs = num(opts.overheadMs, 400, { allowZero: true });
  const turns = num(opts.turns, 1, { min: 1 });    // sequential LLM calls in a task

  const prefillMs = (promptTokens / prefillRate) * 1000;
  const ttftMs = overheadMs + prefillMs;            // time to first token, one call
  const decodeMs = (outputTokens / decodeRate) * 1000;
  const perCallMs = ttftMs + decodeMs;
  const taskMs = perCallMs * turns;                 // sequential turns ⇒ they add up

  // the split that makes the agent point: across the whole task, how much wall
  // clock is "waiting to start" (overhead + prefill, paid once per turn) vs.
  // actually generating tokens.
  const ttftTotalMs = ttftMs * turns;
  const decodeTotalMs = decodeMs * turns;
  const ttftShare = taskMs > 0 ? (ttftTotalMs / taskMs) * 100 : 0;
  // effective end-to-end throughput the user actually experiences over the task
  const totalTokens = (promptTokens + outputTokens) * turns;
  const effTokPerSec = taskMs > 0 ? totalTokens / (taskMs / 1000) : 0;

  return {
    prefillMs, ttftMs, decodeMs, perCallMs, taskMs,
    ttftTotalMs, decodeTotalMs, ttftShare, effTokPerSec,
  };
}

// ── context-window budget (#28 calculators) ──────────────────────────────────
// An agent never gets the whole context window for its conversation. Fixed costs
// — the system prompt, the tool/function schemas, and any always-on memory or
// retrieved context — are re-sent on every turn and sit at the front of the
// window before the first user message. You must also hold back headroom for the
// model's own output. What's left is the real budget for history, and because
// each agent step appends a roughly fixed chunk (a message + a tool call + a tool
// result), that budget divides into a finite number of turns before you must
// compact or summarize. (See Anthropic, "Effective context engineering," on the
// model's finite "attention budget," and Chroma's "Context Rot" on why filling
// the window to the brim degrades recall — the reserve isn't only about output.)
export const CONTEXT_PRESETS = {
  "200k-frontier": { label: "200K frontier (Claude / GPT class)", contextWindow: 200000, outputReserve: 8000 },
  "1m-long":       { label: "1M long-context (Gemini class)",     contextWindow: 1000000, outputReserve: 16000 },
  "128k-mid":      { label: "128K (GPT-4o-class, many open models)", contextWindow: 128000, outputReserve: 4000 },
  "32k-local":     { label: "32K local model",                    contextWindow: 32000, outputReserve: 2000 },
  "8k-small":      { label: "8K small / legacy model",            contextWindow: 8000, outputReserve: 1000 },
};

export function contextBudgetEstimate(opts = {}) {
  const contextWindow = num(opts.contextWindow, 200000, { min: 1 });   // divisor for shares
  const systemPrompt = num(opts.systemPrompt, 1500, { min: 0, allowZero: true });
  const toolDefs = num(opts.toolDefs, 6000, { min: 0, allowZero: true });
  const memory = num(opts.memory, 4000, { min: 0, allowZero: true });
  const outputReserve = num(opts.outputReserve, 8000, { min: 0, allowZero: true });
  const tokensPerTurn = num(opts.tokensPerTurn, 2500, { min: 1 });     // divisor for turns

  const fixed = systemPrompt + toolDefs + memory;       // re-sent every turn, sits before history
  const reserved = fixed + outputReserve;               // gone before any conversation
  const usable = Math.max(0, contextWindow - reserved); // tokens left for history
  const maxTurns = Math.floor(usable / tokensPerTurn);  // steps before compaction
  const fixedShare = (fixed / contextWindow) * 100;
  const reservedShare = (reserved / contextWindow) * 100;
  const usableShare = (usable / contextWindow) * 100;

  return { fixed, reserved, usable, maxTurns, fixedShare, reservedShare, usableShare };
}

export function llmCostEstimate(opts = {}) {
  const requests = num(opts.requests, 100000, { min: 0, allowZero: true });
  const inputTokens = num(opts.inputTokens, 4000, { min: 0, allowZero: true });
  const cachedTokens = num(opts.cachedTokens, 0, { min: 0, allowZero: true });
  const outputTokens = num(opts.outputTokens, 500, { min: 0, allowZero: true });
  const inPrice = num(opts.inPrice, 5, { min: 0, allowZero: true });
  const cachePrice = num(opts.cachePrice, inPrice * 0.1, { min: 0, allowZero: true });
  const outPrice = num(opts.outPrice, 25, { min: 0, allowZero: true });

  const cached = Math.min(cachedTokens, inputTokens); // cached can't exceed the prompt
  const uncached = inputTokens - cached;
  const inputCostPerReq = (uncached * inPrice + cached * cachePrice) / 1e6;
  const outputCostPerReq = (outputTokens * outPrice) / 1e6;
  const costPerRequest = inputCostPerReq + outputCostPerReq;
  const monthlyCost = costPerRequest * requests;
  const annualCost = monthlyCost * 12;

  // counterfactual with no prompt caching: the whole prompt billed at the input rate
  const noCachePerReq = (inputTokens * inPrice + outputTokens * outPrice) / 1e6;
  const monthlyNoCache = noCachePerReq * requests;
  const cacheSavings = monthlyNoCache - monthlyCost;
  const savingsPct = monthlyNoCache > 0 ? (cacheSavings / monthlyNoCache) * 100 : 0;
  const outputShare = costPerRequest > 0 ? (outputCostPerReq / costPerRequest) * 100 : 0;

  return {
    costPerRequest, monthlyCost, annualCost, monthlyNoCache,
    cacheSavings, savingsPct, inputCostPerReq, outputCostPerReq, outputShare,
  };
}

// ── AI agent run cost (#28 calculators) ──────────────────────────────────────
// The single-call cost calculator prices one independent request. An AGENT is
// not one request — it is a loop of N provider calls, and on every turn it
// re-sends the ENTIRE conversation so far. That re-send is the whole story:
//
//   turn t input  = base + (t-1)·growth      (fixed prefix + everything appended)
//   Σ input       = N·base + growth·N(N-1)/2   ← the N(N-1)/2 term is QUADRATIC
//
// So a loop's raw input tokens grow with the SQUARE of the turn count. Double
// the steps and the input bill roughly quadruples — the cost that ambushes teams
// who sized their budget from a per-call price. (See "why AI agent costs scale
// quadratically.") Prompt/prefix caching is the escape hatch: each turn's prefix
// is identical to the previous turn's, so it bills as a cache READ (~0.1× input),
// and only the newly appended slice is fresh. That collapses the quadratic term
// back toward LINEAR — fresh input ≈ base + (N-1)·growth. The calculator prices
// both so the gap between them is visible, because that gap is the entire ROI of
// caching for agentic workloads.
export const AGENTRUN_DEFAULT_WORKLOAD = { baseTokens: 6000, growthTokens: 1500, outputTokens: 300, turns: 20 };

export function agentRunCostEstimate(opts = {}) {
  const base = num(opts.baseTokens, 6000, { min: 0, allowZero: true });    // fixed prefix, re-sent every turn
  const growth = num(opts.growthTokens, 1500, { min: 0, allowZero: true }); // appended to context per turn
  const output = num(opts.outputTokens, 300, { min: 0, allowZero: true });  // emitted per turn
  const turns = num(opts.turns, 20, { min: 1 });                            // sequential LLM calls per run
  const runs = num(opts.runs, 10000, { min: 0, allowZero: true });          // agent runs / month
  const inPrice = num(opts.inPrice, 5, { min: 0, allowZero: true });
  const cachePrice = num(opts.cachePrice, inPrice * 0.1, { min: 0, allowZero: true });
  const outPrice = num(opts.outPrice, 25, { min: 0, allowZero: true });

  // total input if every turn re-bills its whole context at the input rate
  const totalInputNoCache = turns * base + growth * (turns * (turns - 1)) / 2;
  const totalOutput = turns * output;
  // with prefix caching: turn 1 writes `base` fresh; each later turn adds only
  // `growth` fresh tokens (its prefix is a cache read). The rest is cached.
  const freshInput = base + growth * (turns - 1);
  const cachedRead = Math.max(0, totalInputNoCache - freshInput);

  const costNoCachePerRun = (totalInputNoCache * inPrice + totalOutput * outPrice) / 1e6;
  const costCachedPerRun = (freshInput * inPrice + cachedRead * cachePrice + totalOutput * outPrice) / 1e6;
  const costPerRun = costCachedPerRun; // headline: caching is the recommended path

  const monthlyNoCache = costNoCachePerRun * runs;
  const monthlyCached = costCachedPerRun * runs;
  const annualCached = monthlyCached * 12;
  const cacheSavings = monthlyNoCache - monthlyCached;
  const savingsPct = monthlyNoCache > 0 ? (cacheSavings / monthlyNoCache) * 100 : 0;

  // how much of the raw (uncached) input is the quadratic re-send term vs the
  // linear N·base term — the number that explains why the bill surprised you
  const quadraticTokens = growth * (turns * (turns - 1)) / 2;
  const quadraticShare = totalInputNoCache > 0 ? (quadraticTokens / totalInputNoCache) * 100 : 0;

  return {
    totalInputNoCache, totalOutput, freshInput, cachedRead,
    costNoCachePerRun, costCachedPerRun, costPerRun,
    monthlyNoCache, monthlyCached, annualCached, cacheSavings, savingsPct,
    quadraticTokens, quadraticShare,
  };
}
