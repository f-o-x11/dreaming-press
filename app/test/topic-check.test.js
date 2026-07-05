// topic-check.test.js — pins the pre-draft saturation radar's verdicts + exit
// codes so a scoring/threshold regression can't silently let a duplicate through
// (or start flagging genuinely-novel topics as covered). Runs the CLI as a
// subprocess against the ingested corpus, exactly as the newsroom would.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, "..", "scripts", "topic-check.js");

// Run the script; execFileSync throws on non-zero exit, so capture both paths
// and return { code, out }.
function run(arg) {
  try {
    const out = execFileSync("node", [SCRIPT, "--json", arg], { encoding: "utf8" });
    return { code: 0, out: JSON.parse(out) };
  } catch (e) {
    return { code: e.status, out: JSON.parse(e.stdout || "{}") };
  }
}

test("topic-check: an exact existing title is SATURATED (exit 4)", () => {
  const { code, out } = run("MCP code execution vs direct tool calls");
  assert.equal(out.verdict, "SATURATED");
  assert.equal(code, 4);
  assert.ok(out.topScore >= 0.8, `expected a near-exact match, got ${out.topScore}`);
  assert.equal(out.closest[0].slug, "2026-06-23-mcp-code-execution-vs-direct-tool-calls");
});

test("topic-check: a densely-covered comparison is SATURATED via near-dupe count", () => {
  const { code, out } = run("langgraph vs crewai for production agents");
  assert.equal(out.verdict, "SATURATED");
  assert.equal(code, 4);
  assert.ok(out.nearDupes >= 3, `expected many near-dupes, got ${out.nearDupes}`);
});

test("topic-check: a genuinely novel topic is CLEAR (exit 0)", () => {
  // deliberately absurd/uncovered subject — no near-dupes should exist
  const { code, out } = run("teaching an ai agent to play competitive curling");
  assert.equal(out.verdict, "CLEAR");
  assert.equal(code, 0);
  assert.equal(out.nearDupes, 0);
});

test("topic-check: a slug argument tokenizes to words (not one blob)", () => {
  // if hyphen-splitting regressed, a bare slug would only 100%-match itself and
  // surface zero real siblings — assert it actually finds the vector-DB cluster.
  const { out } = run("best-vector-database-for-multi-agent-systems");
  const slugs = out.closest.map((c) => c.slug);
  assert.ok(
    slugs.some((s) => s.includes("vector-database") && s !== "best-vector-database-for-multi-agent-systems"),
    `expected a real vector-DB sibling, got ${JSON.stringify(slugs)}`
  );
});
