import { test } from "node:test";
import assert from "node:assert/strict";
import * as DB from "../lib/db.js";
import { renderToolPage, renderToolsIndex } from "../lib/tools-render.js";
import { TOOLS, CATEGORIES } from "../lib/tools-data.js";

DB.db();

test("directory expanded to hundreds of tools, OSS + API", () => {
  const tools = DB.allTools();
  assert.ok(tools.length > 200, `expected 200+ tools, got ${tools.length}`);
  assert.ok(tools.some(t => t.kind === "oss"), "has OSS repos");
  assert.ok(tools.some(t => t.kind === "api"), "has API services");
  // the user's requested services are present
  for (const name of ["Exa", "Tavily", "ElevenLabs", "AgentMail"]) {
    assert.ok(tools.some(t => t.name === name), `${name} present`);
  }
});

test("API tools carry the agent-usable fields", () => {
  const exa = DB.getTool("exa");
  assert.ok(exa, "exa exists");
  assert.ok(exa.website && exa.website.startsWith("http"), "has website");
  assert.ok(exa.signupUrl, "has signup URL");
  assert.ok(["programmatic-api", "self-serve-instant-key", "oauth", "manual-only", "unknown"].includes(exa.agentSignup), "valid agent-signup tier");
});

test("tool page renders CTA, agent-signup block, code sample, and schema", () => {
  const exa = DB.getTool("exa");
  const h = renderToolPage(exa, [], []);
  assert.match(h, /btn-primary/, "has a register/CTA button");
  assert.match(h, new RegExp(exa.signupUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "CTA points at signup URL");
  assert.match(h, /agent-signup/, "has the agent-signup priority block");
  assert.match(h, /\/api\/tools\/exa\.json/, "links the machine-readable per-tool JSON");
  assert.match(h, /SoftwareApplication|WebAPI/, "API schema type");
});

test("OSS tool page still renders (backward compatible)", () => {
  const lg = DB.getTool("langgraph");
  const h = renderToolPage(lg, [], []);
  assert.match(h, /SoftwareSourceCode/, "OSS keeps source-code schema");
  assert.match(h, /github\.com\/langchain-ai\/langgraph/, "links the repo");
});

test("index has search + filters and every category with tools", () => {
  const h = renderToolsIndex(DB.allTools());
  assert.match(h, /id="toolSearch"/, "search box");
  assert.match(h, /data-f="agent"/, "agent-signup filter");
  assert.match(h, /data-f="mcp"/, "MCP filter");
  // new API categories are registered
  for (const c of ["search-retrieval", "voice-media", "agent-comms", "llm-gateways"]) {
    assert.ok(CATEGORIES[c], `${c} category registered`);
  }
});
