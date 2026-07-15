import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../lib/db.js";
import { JOBS, PREFS, resolveStack, stackJson, optionsForJob, parseStackQuery } from "../lib/stack-builder.js";
import * as TR from "../lib/tools-render.js";
import { allTools } from "../lib/db.js";

db();
const TOOLS = allTools();

test("default stack is exactly the core jobs with their curated picks", () => {
  const { items, slugs } = resolveStack({}, "any", TOOLS);
  const coreCount = JOBS.filter((j) => j.core).length;
  assert.equal(items.length, coreCount, "only core jobs in the default stack");
  assert.deepEqual(slugs, ["langgraph", "openrouter", "mem0", "exa", "pinecone", "langfuse"]);
});

test("selecting a tool swaps it; 'none' skips an optional job; unknown slug falls back", () => {
  const { sel, pref } = parseStackQuery({ framework: "crewai", browser: "browserbase", memory: "none", vectordb: "not-a-real-slug" });
  const { items } = resolveStack(sel, pref, TOOLS);
  const byJob = Object.fromEntries(items.map((i) => [i.job.id, i.tool.slug]));
  assert.equal(byJob.framework, "crewai", "explicit pick honored");
  assert.equal(byJob.browser, "browserbase", "optional job added when selected");
  assert.ok(!("memory" in byJob), "memory skipped via none");
  assert.ok(byJob.vectordb, "bad slug falls back to a real default, not empty");
});

test("a slug from the wrong category is rejected (falls back to a valid pick)", () => {
  // exa is search-retrieval, not a framework — must not be accepted for framework
  const { items } = resolveStack({ framework: "exa" }, "any", TOOLS);
  const fw = items.find((i) => i.job.id === "framework");
  assert.notEqual(fw.tool.slug, "exa");
  assert.ok(JOBS[0].cats.includes(fw.tool.category), "fallback is a real framework");
});

test("preference filter never yields an empty candidate set for a core job that has any tools", () => {
  for (const job of JOBS.filter((j) => j.core)) {
    // 'any' always has options; that's the floor
    assert.ok(optionsForJob(job, TOOLS, "any").length > 0, `${job.id} has options`);
  }
});

test("oss preference biases toward open-source tools where they exist", () => {
  const { items } = resolveStack({}, "oss", TOOLS);
  const llm = items.find((i) => i.job.id === "llm");
  // llm-gateways has open-source options (LiteLLM) — the oss default must pass the oss filter
  assert.ok(PREFS.oss.test(llm.tool), `${llm.tool.slug} should qualify as open-source`);
});

test("stackJson emits agent-consumable records with stable URLs", () => {
  const j = stackJson({}, "any", TOOLS);
  assert.equal(j.preference, "any");
  assert.ok(j.stack.length >= 6);
  for (const s of j.stack) {
    assert.ok(s.tool && s.slug && s.jobId, "has identity");
    assert.match(s.url, /^https:\/\/dreaming\.press\/stack\//, "stable tool URL");
  }
});

test("PREFS test functions classify correctly", () => {
  assert.ok(PREFS.oss.test({ kind: "oss" }));
  assert.ok(!PREFS.oss.test({ kind: "api", pricingModel: "usage-based" }));
  assert.ok(PREFS.agent.test({ agentSignup: "programmatic-api", kind: "api" }));
  assert.ok(PREFS.agent.test({ kind: "oss" }), "self-hostable counts as agent-usable");
});

test("renderStackBuilder emits 12 jobs, options, and the JSON + share affordances", () => {
  const html = TR.renderStackBuilder(TOOLS);
  assert.equal((html.match(/class="sb-job"/g) || []).length, JOBS.length);
  assert.ok((html.match(/class="sb-opt/g) || []).length > 100, "many options");
  assert.match(html, /\/api\/stack\.json/);
  assert.match(html, /Copy build sheet/);
  // core jobs pre-select their first tool; optional jobs pre-select Skip
  assert.match(html, /sb-skip is-sel/, "optional jobs start skipped");
});

import { stackCardSvg } from "../lib/embed.js";

test("stackCardSvg renders a self-contained SVG listing the stack tools + a backlink", () => {
  const { items } = resolveStack({}, "any", TOOLS);
  const svg = stackCardSvg(items);
  assert.ok(svg.startsWith("<svg"), "is an SVG");
  assert.match(svg, /viewBox="0 0 \d+ \d+"/, "has a viewBox so it scales");
  assert.match(svg, /dreaming\.press\/build/, "links back to the builder");
  for (const it of items.slice(0, 3)) assert.ok(svg.includes(it.tool.name.slice(0, 8)) || svg.includes("…"), `shows ${it.tool.name}`);
  // height grows with the number of rows (no fixed clipping)
  const tall = stackCardSvg(items);
  const short = stackCardSvg(items.slice(0, 2));
  const h = (s) => +(/height="(\d+)"/.exec(s) || [])[1];
  assert.ok(h(tall) > h(short), "taller stack ⇒ taller card");
});

test("renderStackBuilder exposes the embeddable badge + Embed action", () => {
  const html = TR.renderStackBuilder(TOOLS);
  assert.match(html, /\/embed\/stack\.svg/, "badge image source");
  assert.match(html, /id="sb-embed"/, "embed button");
});

import { STACKS } from "../lib/stack-builder.js";

test("every curated stack resolves to a non-empty set of real tools", () => {
  for (const s of STACKS) {
    const { items } = resolveStack(s.sel, s.pref, TOOLS);
    assert.ok(items.length >= 2, `${s.slug} has tools`);
    for (const it of items) assert.ok(it.tool.slug, `${s.slug} tool has a slug`);
  }
});

test("Stack Gallery lists every curated stack with a link", () => {
  const html = TR.renderStackGallery(TOOLS);
  for (const s of STACKS) {
    assert.ok(html.includes(`/stacks/${s.slug}`), `${s.slug} linked`);
    assert.ok(html.includes(s.name), `${s.name} shown`);
  }
});

test("a stack page renders tools, a fork-to-builder link, an embed badge, and JSON-LD", () => {
  const s = TR.getStack("voice-agent");
  const html = TR.renderStackPage(s, TOOLS);
  assert.match(html, /ElevenLabs/, "includes the voice tool");
  assert.match(html, /\/build\?voice=elevenlabs/, "forks into the builder with its picks");
  assert.match(html, /\/embed\/stack\.svg\?voice=elevenlabs/, "embeddable badge carries the picks");
  assert.match(html, /"@type":"ItemList"/, "structured data");
  assert.match(html, /\/api\/stack\.json\?voice=elevenlabs/, "agent-readable feed of the exact stack");
});

test("getStack returns null for an unknown slug (route 404s cleanly)", () => {
  assert.equal(TR.getStack("not-a-stack"), null);
});
