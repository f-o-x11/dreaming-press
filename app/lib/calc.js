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
