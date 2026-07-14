import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMcp, mcpManifest, MCP_TOOLS } from "../lib/mcp.js";

test("MCP initialize returns protocol + serverInfo", () => {
  const r = handleMcp({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  assert.equal(r.jsonrpc, "2.0");
  assert.equal(r.id, 1);
  assert.ok(r.result.protocolVersion, "has protocolVersion");
  assert.equal(r.result.serverInfo.name, "dreaming.press");
  assert.ok(r.result.capabilities.tools, "advertises tools capability");
});

test("MCP notifications get no response (null)", () => {
  assert.equal(handleMcp({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
});

test("MCP tools/list returns the read tools with schemas", () => {
  const r = handleMcp({ id: 2, method: "tools/list" });
  const names = r.result.tools.map((t) => t.name);
  assert.deepEqual(names.sort(), ["get_facts", "list_tools", "read_article", "recommend_stack", "search_articles"]);
  for (const t of r.result.tools) {
    assert.ok(t.description, `${t.name} has a description`);
    assert.equal(t.inputSchema.type, "object", `${t.name} has an object inputSchema`);
  }
});

test("MCP search_articles returns matching results as text", () => {
  const r = handleMcp({ id: 3, method: "tools/call", params: { name: "search_articles", arguments: { query: "rag", limit: 3 } } });
  const text = r.result.content[0].text;
  assert.equal(r.result.content[0].type, "text");
  assert.ok(text.includes("/posts/"), "results link to posts");
});

test("MCP list_tools returns directory entries with stack URLs", () => {
  const r = handleMcp({ id: 4, method: "tools/call", params: { name: "list_tools", arguments: { limit: 5 } } });
  assert.ok(r.result.content[0].text.includes("/stack/"), "links to /stack/");
});

test("MCP get_facts returns valid JSON with a license", () => {
  const r = handleMcp({ id: 5, method: "tools/call", params: { name: "get_facts" } });
  const facts = JSON.parse(r.result.content[0].text);
  assert.ok(facts.publication.totalArticles > 0, "has article count");
});

test("MCP recommend_stack returns a citable stack with per-job tools and a build link", () => {
  const r = handleMcp({ id: 9, method: "tools/call", params: { name: "recommend_stack", arguments: { preference: "oss" } } });
  assert.ok(!r.error, "no JSON-RPC error");
  const text = r.result.content[0].text;
  assert.match(text, /preference: open-source/, "names the preference");
  assert.ok(text.includes("/stack/"), "links each tool to /stack/");
  assert.ok(text.includes("/build"), "points to the interactive builder");
  assert.ok(text.includes("/api/stack.json"), "offers the machine-readable feed");
});

test("MCP recommend_stack honors a per-job override and skipping optional jobs", () => {
  const r = handleMcp({ id: 10, method: "tools/call", params: { name: "recommend_stack", arguments: { select: { memory: "zep", sandbox: "none" } } } });
  assert.ok(!r.error, "no JSON-RPC error");
  const text = r.result.content[0].text;
  assert.match(text, /preference: any/, "defaults preference to any");
  assert.ok(text.includes("Memory:"), "includes the core memory job");
});

test("MCP read_article for a missing slug returns a helpful message, not a crash", () => {
  const r = handleMcp({ id: 6, method: "tools/call", params: { name: "read_article", arguments: { slug: "definitely-not-a-real-slug-xyz" } } });
  assert.ok(!r.error, "no JSON-RPC error");
  assert.match(r.result.content[0].text, /No article/i);
});

test("MCP unknown method returns JSON-RPC -32601", () => {
  const r = handleMcp({ id: 7, method: "does/notexist" });
  assert.equal(r.error.code, -32601);
});

test("MCP unknown tool surfaces as a -32603 error, not an unhandled throw", () => {
  const r = handleMcp({ id: 8, method: "tools/call", params: { name: "delete_everything", arguments: {} } });
  assert.equal(r.error.code, -32603);
  assert.match(r.error.message, /Unknown tool/i);
});

test("MCP manifest advertises the endpoint and tools", () => {
  const m = mcpManifest();
  assert.ok(m.endpoint.endsWith("/mcp"), "endpoint is /mcp");
  assert.equal(m.tools.length, MCP_TOOLS.length);
  assert.ok(m.license.includes("creativecommons"), "declares CC-BY");
});
