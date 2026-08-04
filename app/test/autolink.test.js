import { test } from "node:test";
import assert from "node:assert/strict";
import { autolinkHtml } from "../lib/autolink.js";

const TOOLS = [
  { slug: "langgraph", name: "LangGraph" },
  { slug: "llama-index", name: "LlamaIndex" },
  { slug: "qdrant", name: "Qdrant" },
  { slug: "phoenix", name: "Phoenix" }, // in TOOL_SKIP — must NOT link
];

test("links the first mention of a known tool", () => {
  const out = autolinkHtml("<p>We tried LangGraph for the graph.</p>", { tools: TOOLS });
  assert.match(out, /<a href="\/stack\/langgraph" class="auto-link">LangGraph<\/a>/);
});

test("only links the FIRST mention, not later ones", () => {
  const out = autolinkHtml("<p>LangGraph is great. LangGraph again. LangGraph thrice.</p>", { tools: TOOLS });
  assert.equal((out.match(/auto-link/g) || []).length, 1);
});

test("never links inside a code or pre block", () => {
  const out = autolinkHtml("<pre><code>import LangGraph from 'x'</code></pre>", { tools: TOOLS });
  assert.doesNotMatch(out, /auto-link/);
  assert.match(out, /import LangGraph from/);
});

test("never nests a link inside an existing anchor", () => {
  const out = autolinkHtml('<p>See <a href="/x">LangGraph docs</a> here.</p>', { tools: TOOLS });
  assert.equal((out.match(/auto-link/g) || []).length, 0);
});

test("never links inside a heading", () => {
  const out = autolinkHtml("<h2>LangGraph internals</h2><p>and Qdrant vectors</p>", { tools: TOOLS });
  assert.doesNotMatch(out.slice(0, out.indexOf("</h2>")), /auto-link/);
  assert.match(out, /\/stack\/qdrant/); // the body mention still links
});

test("respects the max cap", () => {
  const html = "<p>LangGraph and LlamaIndex and Qdrant and prompt injection and agent memory.</p>";
  const out = autolinkHtml(html, { tools: TOOLS, max: 2 });
  assert.equal((out.match(/auto-link/g) || []).length, 2);
});

test("links curated topic phrases to their hub", () => {
  const out = autolinkHtml("<p>A classic prompt injection attack on agent memory.</p>", { tools: TOOLS });
  assert.match(out, /<a href="\/topics\/agent-security" class="auto-link">prompt injection<\/a>/);
  assert.match(out, /<a href="\/topics\/agent-memory" class="auto-link">agent memory<\/a>/);
});

test("links observability phrases to the evals/observability hub", () => {
  const out = autolinkHtml("<p>Wiring up agent observability with proper LLM observability.</p>", { tools: TOOLS });
  // first mention links to the hub; second (same hub) does not double-link
  assert.match(out, /<a href="\/topics\/agent-evals" class="auto-link">agent observability<\/a>/);
  assert.equal((out.match(/auto-link/g) || []).length, 1);
});

test("links the durable / long-running-agent vocabulary to the frameworks hub", () => {
  const out = autolinkHtml("<p>Building a long-running agent with proper human-in-the-loop pauses.</p>", { tools: TOOLS });
  assert.match(out, /<a href="\/topics\/agent-frameworks" class="auto-link">long-running agent<\/a>/);
  // same hub, so the later human-in-the-loop phrase does not double-link
  assert.equal((out.match(/auto-link/g) || []).length, 1);
});

test("does not mis-fire on a bare 'tracing' or 'monitoring'", () => {
  const out = autolinkHtml("<p>Distributed tracing and monitoring of a database.</p>", { tools: TOOLS });
  assert.doesNotMatch(out, /auto-link/);
});

test("skips ambiguous tool names (Phoenix)", () => {
  const out = autolinkHtml("<p>We flew to Phoenix for the summit.</p>", { tools: TOOLS });
  assert.doesNotMatch(out, /auto-link/);
});

test("does not self-link the post's own page", () => {
  const out = autolinkHtml("<p>Our LangGraph guide covers it.</p>", { tools: TOOLS, selfUrl: "/stack/langgraph" });
  assert.doesNotMatch(out, /auto-link/);
});

test("whole-word only: does not match a substring inside a bigger word", () => {
  const out = autolinkHtml("<p>The Qdrantish thing and Qdrant proper.</p>", { tools: TOOLS });
  assert.equal((out.match(/auto-link/g) || []).length, 1);
  assert.match(out, /Qdrantish thing/); // untouched
});

test("returns input unchanged when nothing matches", () => {
  const html = "<p>Just some ordinary prose about nothing in particular.</p>";
  assert.equal(autolinkHtml(html, { tools: TOOLS }), html);
});

test("preserves surrounding markup exactly", () => {
  const out = autolinkHtml('<p>Use <strong>LangGraph</strong> or <em>plain</em> code.</p>', { tools: TOOLS });
  // mention is inside <strong>, still linkable (strong is not a skip element)
  assert.match(out, /<strong><a href="\/stack\/langgraph" class="auto-link">LangGraph<\/a><\/strong>/);
});
