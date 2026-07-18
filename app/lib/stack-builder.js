// stack-builder.js — the Agent Stack Explorer (council "big idea"). Turns the
// 256-tool directory into a decision: pick one tool per job → get a recommended,
// citable, shareable, agent-consumable AI-agent stack. Pure logic here; the page
// renders in tools-render.js and the JSON API in server.js both call resolveStack.
import { allTools } from "./db.js";

// The building blocks of an AI-agent stack, in build order. Each job maps to one
// or more tool-directory categories; `core` jobs are pre-selected, the rest opt
// in. `pick` is the curated default (verified to exist).
export const JOBS = [
  { id: "framework", label: "Orchestration", blurb: "The framework that runs your agent's loop.", tip: "The engine of your agent — it decides what to do next, calls the right tools, and keeps track of the conversation and state between steps.", cats: ["framework"], core: true, pick: "langgraph" },
  { id: "llm", label: "LLM / inference", blurb: "Where your model calls actually go.", tip: "Where your agent's 'thinking' happens: the AI model (or a router across many models) that actually answers each prompt. This is usually your biggest cost.", cats: ["llm-gateways"], core: true, pick: "openrouter" },
  { id: "memory", label: "Memory", blurb: "Long-term memory across sessions.", tip: "Lets your agent remember who it is, who you are, your rules and instructions, and what you already worked on together — across sessions, not just one chat.", cats: ["memory", "memory-context"], core: true, pick: "mem0" },
  { id: "retrieval", label: "Search & retrieval", blurb: "Live web + document search for grounding.", tip: "Gives the agent fresh, real-world facts — live web and document search — so its answers aren't stuck at the model's training cut-off date.", cats: ["search-retrieval"], core: true, pick: "exa" },
  { id: "vectordb", label: "Vector store", blurb: "Embeddings + similarity search.", tip: "The agent's long-term filing cabinet: it stores your documents by meaning so the agent can instantly pull the most relevant passages when it needs them.", cats: ["vectordb", "vector-db-infra"], core: true, pick: "pinecone" },
  { id: "evals", label: "Evals & observability", blurb: "See what the agent does + measure quality.", tip: "See exactly what your agent did on every run — traces and logs — and measure whether changes are making it better or worse before your users notice.", cats: ["eval", "observability", "observability-eval"], core: true, pick: "langfuse" },
  { id: "sandbox", label: "Sandbox / runtime", blurb: "Run agent-generated code safely.", tip: "A safe, throwaway computer where the agent can run code it writes without any risk to your real systems or data.", cats: ["sandboxes-runtime", "runtime"], core: false, pick: "e2b" },
  { id: "browser", label: "Browser automation", blurb: "Let it drive a real browser.", tip: "Lets the agent actually use a web browser — click, type, and read pages like a person — to do tasks on sites that have no API.", cats: ["browser-automation"], core: false, pick: "browserbase" },
  { id: "voice", label: "Voice & speech", blurb: "Talk and listen.", tip: "Gives your agent a voice and ears: turn its text into natural speech, and turn a person's spoken words back into text it can act on.", cats: ["voice-media"], core: false, pick: "elevenlabs" },
  { id: "comms", label: "Email / SMS", blurb: "Let the agent send + receive messages.", tip: "Lets the agent send and receive real email and text messages, so it can reach people and act on their replies.", cats: ["agent-comms"], core: false, pick: "agentmail" },
  { id: "auth", label: "Auth & tool access", blurb: "Let it act inside third-party apps.", tip: "Safely connects the agent to apps like Gmail, Slack, or GitHub so it can act on your behalf — without you ever handing it your passwords.", cats: ["agent-auth-tools"], core: false, pick: "arcade" },
  { id: "payments", label: "Payments & billing", blurb: "Charge for what you built.", tip: "Turn what you built into a business: charge customers, meter usage, and handle subscriptions and invoices.", cats: ["payments-billing"], core: false, pick: "autumn" },
];

// Curated, opinionated starter stacks — the public Stack Gallery (council round-2
// "big idea": shared stacks as indexable, forkable, citable pages). Each is a real
// answer to "what should I use for <scenario>", rendered at /stacks/<slug>, and
// de-silos the site (every stack links to its tool pages + the builder). `sel`
// maps job.id -> slug (optional jobs appear only when named); `pref` sets defaults.
export const STACKS = [
  { slug: "rag-startup", name: "The RAG Startup Stack", tagline: "Ship a retrieval-augmented agent that cites its sources.", forWho: "Founders building a product that answers from their own docs + the live web.", pref: "any", sel: {} },
  { slug: "open-source", name: "The Open-Source-Only Stack", tagline: "Own every layer — self-host, no vendor lock-in.", forWho: "Teams that want to run the whole stack themselves and bring their own model keys.", pref: "oss", sel: {} },
  { slug: "agent-native", name: "The Agent-Native Stack", tagline: "Every tool an agent can sign up for on its own.", forWho: "Autonomous agents that provision their own keys — no human in the signup loop.", pref: "agent", sel: {} },
  { slug: "voice-agent", name: "The Voice Agent Stack", tagline: "An agent that listens and talks.", forWho: "Builders of voice assistants, phone agents, and speech products.", pref: "any", sel: { voice: "elevenlabs" } },
  { slug: "web-automation", name: "The Web-Automation Stack", tagline: "Let your agent drive a real browser.", forWho: "Scraping, form-filling, and browser-operator agents.", pref: "any", sel: { browser: "browserbase", sandbox: "e2b" } },
  { slug: "support-agent", name: "The Support-Agent Stack", tagline: "A customer-support agent with memory + email.", forWho: "Teams automating inbound support that must remember customers and reply by email.", pref: "any", sel: { comms: "agentmail", memory: "mem0" } },
  { slug: "production-grade", name: "The Production-Grade Stack", tagline: "The observability + safety layer for agents in prod.", forWho: "Teams past the prototype — who need to see, measure, and sandbox what agents do.", pref: "any", sel: { sandbox: "e2b" } },
  { slug: "minimal", name: "The Minimal Agent Stack", tagline: "The two pieces you actually can't skip.", forWho: "A weekend build or a proof of concept — orchestration + a model gateway, nothing else.", pref: "any", sel: { memory: "none", retrieval: "none", vectordb: "none", evals: "none" } },
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
