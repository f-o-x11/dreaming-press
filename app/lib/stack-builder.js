// stack-builder.js — the Agent Stack Explorer (council "big idea"). Turns the
// 256-tool directory into a decision: pick one tool per job → get a recommended,
// citable, shareable, agent-consumable AI-agent stack. Pure logic here; the page
// renders in tools-render.js and the JSON API in server.js both call resolveStack.
import { allTools } from "./db.js";

// The building blocks of an AI-agent stack, in build order. Each job maps to one
// or more tool-directory categories; `core` jobs are pre-selected, the rest opt
// in. `pick` is the curated default (verified to exist).
export const JOBS = [
  { id: "framework", label: "Orchestration", blurb: "The framework that runs your agent's loop.", cats: ["framework"], core: true, pick: "langgraph" },
  { id: "llm", label: "LLM / inference", blurb: "Where your model calls actually go.", cats: ["llm-gateways"], core: true, pick: "openrouter" },
  { id: "memory", label: "Memory", blurb: "Long-term memory across sessions.", cats: ["memory", "memory-context"], core: true, pick: "mem0" },
  { id: "retrieval", label: "Search & retrieval", blurb: "Live web + document search for grounding.", cats: ["search-retrieval"], core: true, pick: "exa" },
  { id: "vectordb", label: "Vector store", blurb: "Embeddings + similarity search.", cats: ["vectordb", "vector-db-infra"], core: true, pick: "pinecone" },
  { id: "evals", label: "Evals & observability", blurb: "See what the agent does + measure quality.", cats: ["eval", "observability", "observability-eval"], core: true, pick: "langfuse" },
  { id: "sandbox", label: "Sandbox / runtime", blurb: "Run agent-generated code safely.", cats: ["sandboxes-runtime", "runtime"], core: false, pick: "e2b" },
  { id: "browser", label: "Browser automation", blurb: "Let it drive a real browser.", cats: ["browser-automation"], core: false, pick: "browserbase" },
  { id: "voice", label: "Voice & speech", blurb: "Talk and listen.", cats: ["voice-media"], core: false, pick: "elevenlabs" },
  { id: "comms", label: "Email / SMS", blurb: "Let the agent send + receive messages.", cats: ["agent-comms"], core: false, pick: "agentmail" },
  { id: "auth", label: "Auth & tool access", blurb: "Let it act inside third-party apps.", cats: ["agent-auth-tools"], core: false, pick: "arcade" },
  { id: "payments", label: "Payments & billing", blurb: "Charge for what you built.", cats: ["payments-billing"], core: false, pick: "autumn" },
];

const AGENT_TIERS = ["programmatic-api", "self-serve-instant-key", "oauth"];
export const PREFS = {
  any: { label: "Any", test: () => true },
  oss: { label: "Open source", test: (t) => (t.kind || "oss") === "oss" || t.pricingModel === "open-source" },
  api: { label: "Hosted API", test: (t) => (t.kind || "oss") !== "oss" },
  agent: { label: "Agent can self-sign-up", test: (t) => AGENT_TIERS.includes(t.agentSignup) || (t.kind || "oss") === "oss" },
};

// All candidate tools for a job (its categories), honoring a preference filter,
// sorted by community traction. The curated pick floats to the top when present.
export function optionsForJob(job, tools, pref = "any") {
  const test = (PREFS[pref] || PREFS.any).test;
  const cand = tools.filter((t) => job.cats.includes(t.category) && test(t));
  cand.sort((a, b) => (b.stars || 0) - (a.stars || 0));
  const i = cand.findIndex((t) => t.slug === job.pick);
  if (i > 0) cand.unshift(cand.splice(i, 1)[0]);
  return cand;
}

// The default pick for a job under a preference: the curated tool if it passes
// the filter, else the top candidate.
function defaultPick(job, tools, pref) {
  const opts = optionsForJob(job, tools, pref);
  const curated = opts.find((t) => t.slug === job.pick);
  return curated || opts[0] || null;
}

// Resolve a full stack. `sel` maps job.id -> slug ("none" to skip an optional
// job; absent core jobs fall back to the default). `pref` filters candidates.
// Returns { pref, items: [{job, tool}], slugs }. Pure — no I/O beyond allTools.
export function resolveStack(sel = {}, pref = "any", tools = null) {
  const all = tools || allTools();
  const bySlug = new Map(all.map((t) => [t.slug, t]));
  const items = [];
  for (const job of JOBS) {
    const chosen = sel[job.id];
    if (chosen === "none") continue;                 // explicitly skipped
    if (!chosen && !job.core) continue;              // optional + unselected ⇒ omit
    let tool = chosen && bySlug.get(chosen);
    if (tool && !job.cats.includes(tool.category)) tool = null; // guard bad slug
    if (!tool) tool = defaultPick(job, all, pref);
    if (tool) items.push({ job, tool });
  }
  return { pref, items, slugs: items.map((i) => i.tool.slug) };
}

// A compact, machine-friendly view of a resolved stack (for /api/stack.json + MCP).
export function stackJson(sel, pref, tools = null) {
  const { items } = resolveStack(sel, pref, tools);
  return {
    generated: "see server", // stamped by caller (Date is unavailable in some contexts)
    preference: pref || "any",
    stack: items.map(({ job, tool }) => ({
      job: job.label, jobId: job.id,
      tool: tool.name, slug: tool.slug,
      category: tool.category,
      oneLiner: tool.oneLiner || tool.blurb || "",
      pricing: tool.pricingModel || null,
      agentSignup: tool.agentSignup || null,
      mcp: !!tool.mcpServer,
      url: `https://dreaming.press/stack/${tool.slug}`,
      signupUrl: tool.signupUrl || tool.website || null,
    })),
  };
}

// Parse ?framework=langgraph&memory=none&pref=oss into { sel, pref }.
export function parseStackQuery(query = {}) {
  const sel = {};
  for (const job of JOBS) if (query[job.id]) sel[job.id] = String(query[job.id]);
  const pref = PREFS[query.pref] ? String(query.pref) : "any";
  return { sel, pref };
}
