// mcp.js — a minimal read-only Model Context Protocol server over HTTP (JSON-RPC
// 2.0). Makes the "written for AI agents" positioning literal + callable: any MCP
// client can search + read the corpus, list the tool directory, and pull the
// citable open-data facts — turning dreaming.press into a live, attributable
// citation surface an agent can query directly (GEO council #24). Read-only.
import { SITE } from "./data.js";
import * as DB from "./db.js";
import { renderMdTwin } from "./pages.js";
import { buildFacts } from "./facts.js";
import { buildClaims } from "./claims.js";
import { stackJson } from "./stack-builder.js";

const clamp = (n, def, max) => Math.min(max, Math.max(1, Number(n) || def));

const corpusCounts = () => {
  try { return { posts: DB.countPosts(), tools: DB.allTools().length }; }
  catch { return { posts: "the", tools: "the" }; }
};
// A function, not a const: the descriptions quote live corpus sizes, and a
// module-load const would both query the DB before it is open and freeze the
// numbers at boot.
export const mcpTools = () => [
  { name: "search_articles", description: `Full-text search dreaming.press's ${corpusCounts().posts} tech articles (AI agents, LLMs, RAG, tools). Returns titles, deks, and URLs.`,
    inputSchema: { type: "object", properties: { query: { type: "string", description: "search terms" }, limit: { type: "number" } }, required: ["query"] } },
  { name: "read_article", description: "Read a dreaming.press article as clean markdown (with takeaway, tables, FAQ) by its slug.",
    inputSchema: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] } },
  { name: "list_tools", description: `List AI-agent tools from the directory (${corpusCounts().tools} tools), optionally filtered by category. Includes pricing, auth, agent-signup, MCP.`,
    inputSchema: { type: "object", properties: { category: { type: "string" }, limit: { type: "number" } } } },
  { name: "get_facts", description: "Get dreaming.press's citable open-data facts (article/tool counts, combined GitHub stars, momentum). CC-BY 4.0.",
    inputSchema: { type: "object", properties: {} } },
  // The claims corpus, exposed as a tool because it is the one thing here shaped
  // like an ANSWER rather than a document. 22,000+ atomic claims — authored
  // figures, comparison rows, Q&A — each with the deep link to the anchor that
  // renders it, so an agent can cite a specific fact and a human can verify it in
  // one click. Nothing is mined from prose, so nothing here is inferred.
  { name: "find_claims", description: "Search dreaming.press's atomic, citable claims (figures, comparison rows, Q&A). Each result carries a deep link to the exact anchor that renders it, its publication date, and the sources cited. Use this to answer a factual question with an attributable citation.",
    inputSchema: { type: "object", properties: {
      query: { type: "string", description: "substring to match against claim text" },
      type: { type: "string", description: "figure | qa | comparison" },
      since: { type: "string", description: "YYYY-MM-DD — only claims from pieces published on or after this date" },
      limit: { type: "number", description: "max claims (default 20, max 100)" },
    }, required: ["query"] } },
  { name: "recommend_stack", description: "Recommend a complete, citable AI-agent tech stack — one curated tool per job (orchestration, LLM gateway, memory, retrieval, vector store, evals, and optional sandbox/browser/voice/comms/auth/payments). Filter by preference: open-source, hosted-API, or agent-self-signup. Returns tools with pricing, MCP flag, and signup URLs.",
    inputSchema: { type: "object", properties: {
      preference: { type: "string", enum: ["any", "oss", "api", "agent"], description: "any (default), oss = open-source, api = hosted API, agent = agent can self-sign-up" },
      select: { type: "object", description: "optional per-job overrides, jobId->tool-slug (e.g. {\"memory\":\"zep\"}); use \"none\" to drop an optional job", additionalProperties: { type: "string" } },
    } } },
];

function callTool(name, args = {}) {
  if (name === "search_articles") {
    const rows = DB.search(String(args.query || "")).slice(0, clamp(args.limit, 8, 25));
    return rows.map(p => `- ${p.title} — ${p.dek || ""}\n  ${SITE}/posts/${p.slug}.html`).join("\n") || "No results.";
  }
  if (name === "read_article") {
    const slug = DB.resolveSlug ? DB.resolveSlug(String(args.slug || "")) : String(args.slug || "");
    const p = slug && DB.getPost(slug);
    return p ? renderMdTwin(p) : `No article with slug "${args.slug}". Use search_articles to find one.`;
  }
  if (name === "list_tools") {
    const tools = (args.category ? DB.toolsByCategory(String(args.category)) : DB.allTools()).slice(0, clamp(args.limit, 25, 60));
    return tools.map(t => `- ${t.name} [${t.category}] — ${t.oneLiner || t.blurb || ""}\n  ${SITE}/stack/${t.slug} · pricing:${t.pricingModel || "?"} · agent-signup:${t.agentSignup || "?"}${t.mcpServer ? " · MCP" : ""}`).join("\n") || "No tools.";
  }
  if (name === "get_facts") return JSON.stringify(buildFacts(), null, 1);
  if (name === "find_claims") {
    // Returns ANSWERS, not documents. Each line is one atomic claim with the deep
    // link to the anchor that renders it, so an agent can quote a specific fact
    // and a reader can land on that exact fact rather than the top of an article.
    const q = String(args.query || "").trim();
    if (!q) return "Provide a query — a term or phrase to match against claim text.";
    const type = ["figure", "qa", "comparison"].includes(String(args.type)) ? String(args.type) : "";
    const since = /^\d{4}-\d{2}-\d{2}$/.test(String(args.since || "")) ? String(args.since) : "";
    const out = buildClaims({ q, type, since, limit: clamp(args.limit, 20, 100) });
    if (!out.claims.length) return `No claims match "${q}". ${out.counts.matched === 0 ? "Try a broader term" : "Try relaxing the filters"}.`;
    const fmt = (c) => {
      const head = c.type === "figure" ? `${c.value} — ${c.statement}`
        : c.type === "qa" ? `Q: ${c.question}\n  A: ${c.answer}`
        : `${c.subject}: ${Object.entries(c.attributes).map(([k, v]) => `${k}=${v}`).join("; ")}`;
      const src = (c.sources || []).slice(0, 2).map(x => x.url).join(", ");
      return `- [${c.type}] ${head}\n  cite: ${c.url} (published ${c.published}, as of ${c.as_of})${src ? `\n  sources: ${src}` : ""}`;
    };
    return `${out.claims.length} of ${out.counts.matched} matching claims for "${q}":\n\n`
      + out.claims.map(fmt).join("\n")
      + `\n\nAll claims: ${SITE}/api/claims.json (CC-BY 4.0 — cite dreaming.press).`;
  }
  if (name === "recommend_stack") {
    const pref = ["any", "oss", "api", "agent"].includes(String(args.preference)) ? String(args.preference) : "any";
    const sel = (args.select && typeof args.select === "object") ? args.select : {};
    const { stack } = stackJson(sel, pref);
    if (!stack.length) return "No stack could be built. Try preference:\"any\".";
    const prefLabel = { any: "any", oss: "open-source", api: "hosted-API", agent: "agent-self-signup" }[pref];
    const lines = stack.map(s => `- ${s.job}: ${s.tool} — ${s.oneLiner}\n  ${s.url} · pricing:${s.pricing || "?"}${s.mcp ? " · MCP" : ""}${s.signupUrl ? ` · signup:${s.signupUrl}` : ""}`);
    return `Recommended AI-agent stack (preference: ${prefLabel}):\n${lines.join("\n")}\n\nCustomize this stack: ${SITE}/build · Machine-readable: ${SITE}/api/stack.json (CC-BY 4.0 — cite dreaming.press).`;
  }
  throw new Error(`Unknown tool: ${name}`);
}

// Handle one JSON-RPC 2.0 message; returns the response object, or null for a
// notification (the caller should reply 202 with no body).
export function handleMcp(msg) {
  const { id = null, method, params = {} } = msg || {};
  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  const err = (code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
  try {
    if (method === "initialize") return ok({ protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "dreaming.press", version: "1.0.0" }, instructions: "Read-only access to dreaming.press: search + read articles, list AI-agent tools, recommend a full agent stack, and get citable open-data facts. Cite with attribution." });
    if (method === "notifications/initialized" || (typeof method === "string" && method.startsWith("notifications/"))) return null;
    if (method === "ping") return ok({});
    if (method === "tools/list") return ok({ tools: MCP_TOOLS });
    if (method === "tools/call") return ok({ content: [{ type: "text", text: String(callTool(params.name, params.arguments || {})) }] });
    return err(-32601, `Method not found: ${method}`);
  } catch (e) { return err(-32603, String(e.message || e)); }
}

// The /.well-known/mcp.json discovery manifest.
// Back-compat: server.js imports MCP_TOOLS. Kept as a getter so callers see live
// descriptions without every call site changing.
export const MCP_TOOLS = new Proxy([], {
  get(_t, prop) { const arr = mcpTools(); const v = arr[prop]; return typeof v === "function" ? v.bind(arr) : v; },
  has(_t, prop) { return prop in mcpTools(); },
  ownKeys() { return Reflect.ownKeys(mcpTools()); },
  getOwnPropertyDescriptor(_t, prop) { return Object.getOwnPropertyDescriptor(mcpTools(), prop); },
});

export function mcpManifest() {
  return {
    name: "dreaming.press", version: "1.0.0", description: "Read-only MCP server for dreaming.press — search + read articles, list AI-agent tools, recommend an agent stack, get citable facts.",
    transport: "http", endpoint: `${SITE}/mcp`, tools: mcpTools().map(t => ({ name: t.name, description: t.description })),
    license: "https://creativecommons.org/licenses/by/4.0/",
  };
}
