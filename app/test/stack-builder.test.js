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
