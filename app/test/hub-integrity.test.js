// hub-integrity.test.js — guards the eight curated topic hubs (/topics/*) against
// the one silent failure their shared pattern allows. Each hub is a hand-ordered
// slug list mapped to live post objects and then `.filter(Boolean)`-ed, so a slug
// that no longer resolves — a renamed post, a typo, a piece deleted in a cleanup —
// does NOT 404 or error. It just vanishes from the hub, quietly shrinking a page
// whose entire job is internal-link equity and topical crawl depth. Nothing else
// in the suite would catch that: the route still returns 200 with fewer links.
//
// This mirrors cover-coverage.test.js (a post can ship without its cover and every
// surface silently 404s) — same class of "green build, degraded SEO surface" bug.
// A red here means a curated hub slug stopped resolving: fix the slug or drop it
// from the list on purpose.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SECURITY_HUB_SLUGS, securityHub,
  RAG_HUB_SLUGS, ragHub,
  MEMORY_HUB_SLUGS, memoryHub,
  MCP_HUB_SLUGS, mcpHub,
  AGENT_FRAMEWORK_HUB_SLUGS, frameworksHub,
  INFERENCE_HUB_SLUGS, inferenceHub,
  EVAL_HUB_SLUGS, evalsHub,
  CODING_HUB_SLUGS, codingHub,
} from "../lib/db.js";

const HUBS = [
  ["agent-security", SECURITY_HUB_SLUGS, securityHub],
  ["rag-retrieval", RAG_HUB_SLUGS, ragHub],
  ["agent-memory", MEMORY_HUB_SLUGS, memoryHub],
  ["mcp", MCP_HUB_SLUGS, mcpHub],
  ["agent-frameworks", AGENT_FRAMEWORK_HUB_SLUGS, frameworksHub],
  ["llm-inference", INFERENCE_HUB_SLUGS, inferenceHub],
  ["agent-evals", EVAL_HUB_SLUGS, evalsHub],
  ["coding-agents", CODING_HUB_SLUGS, codingHub],
];

// A hub with only a couple of members is a broken/gutted list, not a topic page.
// The smallest curated hub today carries well above this; the floor only catches a
// list that got accidentally emptied or slashed.
const MIN_HUB_SIZE = 6;

for (const [name, slugs, hubFn] of HUBS) {
  test(`/topics/${name}: every curated slug resolves to a live post`, () => {
    const resolved = hubFn();
    const gotSlugs = new Set(resolved.map((p) => p.slug));
    const dead = slugs.filter((s) => !gotSlugs.has(s));
    assert.deepEqual(
      dead,
      [],
      `${dead.length} curated slug(s) in the ${name} hub no longer resolve to a post, so ` +
        `they silently dropped off the hub (lost internal links). Fix the slug or remove it ` +
        `from the list on purpose. Missing:\n  ${dead.join("\n  ")}`
    );
    // If nothing is dead, the rendered hub must be exactly the curated list.
    assert.equal(resolved.length, slugs.length, `${name} hub size drifted from its curated list`);
  });

  test(`/topics/${name}: no duplicate slugs in the curated list`, () => {
    const seen = new Set();
    const dupes = [];
    for (const s of slugs) {
      if (seen.has(s)) dupes.push(s);
      seen.add(s);
    }
    assert.deepEqual(dupes, [], `duplicate slug(s) in the ${name} hub: ${dupes.join(", ")}`);
  });

  test(`/topics/${name}: hub is not empty/gutted (>= ${MIN_HUB_SIZE})`, () => {
    assert.ok(
      slugs.length >= MIN_HUB_SIZE,
      `the ${name} hub has only ${slugs.length} curated slug(s); a topic hub below ${MIN_HUB_SIZE} ` +
        `is broken, not a page`
    );
  });
}
