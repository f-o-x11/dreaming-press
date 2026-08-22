import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveTool, candidateTerms } from "../lib/tool-resolve.js";

// A fixed directory, so these assertions describe the resolver's behaviour rather
// than whatever happens to be in the live tools table on the day they run.
const TOOLS = [
  { slug: "upstash", name: "Upstash", stars: 900 },
  { slug: "supabase", name: "Supabase", stars: 8000 },
  { slug: "phoenix", name: "Arize Phoenix", stars: 400 },
  { slug: "mastra-cloud", name: "Mastra Cloud", stars: 300 },
  { slug: "fly-machines", name: "Fly Machines", stars: 200 },
  { slug: "jina-reader", name: "Jina Reader", stars: 500 },
  { slug: "mcp-servers", name: "MCP Servers", stars: 1000 },
  { slug: "openai-agents-sdk", name: "OpenAI Agents SDK", stars: 5000 },
  { slug: "openai-codex", name: "OpenAI Codex", stars: 5000 },
  { slug: "langgraph", name: "LangGraph", stars: 7000 },
];

test("npm-scoped guesses resolve to the vendor's tool", () => {
  // These are real URLs from the access log, all previously 404.
  assert.equal(resolveTool("@upstash/mcp-server", TOOLS).match?.slug, "upstash");
  assert.equal(resolveTool("@supabase/mcp-server-supabase", TOOLS).match?.slug, "supabase");
  assert.equal(resolveTool("@arizeai/phoenix-mcp", TOOLS).match?.slug, "phoenix");
  assert.equal(resolveTool("@mastra/mcp-docs-server", TOOLS).match?.slug, "mastra-cloud");
});

test("bare vendor names resolve to their prefixed slug", () => {
  assert.equal(resolveTool("fly", TOOLS).match?.slug, "fly-machines");
  assert.equal(resolveTool("jina", TOOLS).match?.slug, "jina-reader");
});

// The regression that matters most. "@pinecone-database/mcp" de-noises to the bare
// token "mcp", which exact-matches the mcp-servers entry — so an agent asking about
// Pinecone, which is not in this directory at all, was confidently redirected to an
// unrelated page. A wrong redirect is worse than a 404: the agent cannot tell it was
// answered with the wrong thing.
test("boilerplate tokens never produce a match on their own", () => {
  assert.equal(resolveTool("@pinecone-database/mcp", TOOLS).match, null);
  assert.equal(resolveTool("@vendor/api", TOOLS).match, null);
  assert.equal(resolveTool("@some/sdk", TOOLS).match, null);
  assert.ok(!candidateTerms("@pinecone-database/mcp").includes("mcp"));
});

test("an ambiguous tie does not redirect, but does offer candidates", () => {
  const r = resolveTool("openai", TOOLS);
  assert.equal(r.match, null, "two equally-good real products must not be guessed between");
  const slugs = r.candidates.map(c => c.slug);
  assert.ok(slugs.includes("openai-agents-sdk") && slugs.includes("openai-codex"));
});

test("unknown names resolve to nothing at all", () => {
  assert.equal(resolveTool("totally-made-up-xyz", TOOLS).match, null);
  assert.deepEqual(resolveTool("totally-made-up-xyz", TOOLS).candidates, []);
  // langchain is not langgraph; a near-miss on a different product must not redirect.
  assert.equal(resolveTool("langchain", TOOLS).match, null);
});

test("empty and malformed input is handled without throwing", () => {
  for (const bad of ["", null, undefined, "/", "@", "@/", "%%%"]) {
    const r = resolveTool(bad, TOOLS);
    assert.equal(r.match, null);
    assert.ok(Array.isArray(r.candidates));
  }
});

test("percent-encoded scoped names still resolve", () => {
  assert.equal(resolveTool("%40upstash%2Fmcp-server", TOOLS).match?.slug, "upstash");
});
