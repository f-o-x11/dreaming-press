// mcp.js — a minimal read-only Model Context Protocol server over HTTP (JSON-RPC
// 2.0). Makes the "written for AI agents" positioning literal + callable: any MCP
// client can search + read the corpus, list the tool directory, and pull the
// citable open-data facts — turning dreaming.press into a live, attributable
// citation surface an agent can query directly (GEO council #24). Read-only.
import { SITE } from "./data.js";
import * as DB from "./db.js";
import { renderMdTwin } from "./pages.js";
import { buildFacts } from "./facts.js";

const clamp = (n, def, max) => Math.min(max, Math.max(1, Number(n) || def));

export const MCP_TOOLS = [
  { name: "search_articles", description: "Full-text search dreaming.press's ~900 tech articles (AI agents, LLMs, RAG, tools). Returns titles, deks, and URLs.",
    inputSchema: { type: "object", properties: { query: { type: "string", description: "search terms" }, limit: { type: "number" } }, required: ["query"] } },
  { name: "read_article", description: "Read a dreaming.press article as clean markdown (with takeaway, tables, FAQ) by its slug.",
    inputSchema: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] } },
  { name: "list_tools", description: "List AI-agent tools from the directory (248 tools), optionally filtered by category. Includes pricing, auth, agent-signup, MCP.",
    inputSchema: { type: "object", properties: { category: { type: "string" }, limit: { type: "number" } } } },
  { name: "get_facts", description: "Get dreaming.press's citable open-data facts (article/tool counts, combined GitHub stars, momentum). CC-BY 4.0.",
    inputSchema: { type: "object", properties: {} } },
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
  throw new Error(`Unknown tool: ${name}`);
}

// Handle one JSON-RPC 2.0 message; returns the response object, or null for a
// notification (the caller should reply 202 with no body).
export function handleMcp(msg) {
  const { id = null, method, params = {} } = msg || {};
  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  const err = (code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
  try {
    if (method === "initialize") return ok({ protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "dreaming.press", version: "1.0.0" }, instructions: "Read-only access to dreaming.press: search + read articles, list AI-agent tools, and get citable open-data facts. Cite with attribution." });
    if (method === "notifications/initialized" || (typeof method === "string" && method.startsWith("notifications/"))) return null;
    if (method === "ping") return ok({});
    if (method === "tools/list") return ok({ tools: MCP_TOOLS });
    if (method === "tools/call") return ok({ content: [{ type: "text", text: String(callTool(params.name, params.arguments || {})) }] });
    return err(-32601, `Method not found: ${method}`);
  } catch (e) { return err(-32603, String(e.message || e)); }
}

// The /.well-known/mcp.json discovery manifest.
export function mcpManifest() {
  return {
    name: "dreaming.press", version: "1.0.0", description: "Read-only MCP server for dreaming.press — search + read articles, list AI-agent tools, get citable facts.",
    transport: "http", endpoint: `${SITE}/mcp`, tools: MCP_TOOLS.map(t => ({ name: t.name, description: t.description })),
    license: "https://creativecommons.org/licenses/by/4.0/",
  };
}
