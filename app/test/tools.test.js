// Tests for the data-backed Stack engine (#10/#12/#16/#22/#13).
import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { init, seedTools, allTools, getTool, toolsByCategory } from "../lib/db.js";
import * as TR from "../lib/tools-render.js";

function freshDb() { const d = new Database(":memory:"); init(d); return d; }

test("seedTools populates the catalog", () => {
  const d = freshDb();
  const tools = allTools(d);
  assert.ok(tools.length >= 20, "at least 20 tools seeded");
  assert.ok(getTool("langgraph", d), "langgraph present");
  assert.ok(toolsByCategory("vectordb", d).length >= 3, "vectordb category populated");
});

test("lightweight agent frameworks are tracked with canonical repos (entity reconciliation)", () => {
  // These frameworks are named in compare-table headers across multiple money pages
  // (agno-vs-langgraph-vs-crewai, openai-agents-sdk-vs-…, pydantic-ai-vs-…). Tracking
  // each gives its `about` Thing a canonical `sameAs` repo instead of a bare name, the
  // disambiguation #25/#48 reward. Pin owner/repo so a future catalog edit can't
  // silently drop them and re-orphan those entities.
  const d = freshDb();
  const expect = {
    "openai-agents-sdk": "openai/openai-agents-python",
    "agno": "agno-agi/agno",
    "google-adk": "google/adk-python",
    "claude-agent-sdk": "anthropics/claude-agent-sdk-python",
  };
  for (const [slug, repo] of Object.entries(expect)) {
    const t = getTool(slug, d);
    assert.ok(t, `${slug} present in catalog`);
    assert.equal(`${t.owner}/${t.repo}`, repo, `${slug} points at ${repo}`);
    assert.equal(t.category, "framework", `${slug} lives in the framework category`);
  }
});

test("seedTools preserves higher live star counts (MAX)", () => {
  const d = freshDb();
  d.prepare("UPDATE tools SET stars = 999999 WHERE slug = 'langgraph'").run();
  seedTools(d); // re-seed should not lower the synced value
  assert.equal(getTool("langgraph", d).stars, 999999);
});

test("tool pages render with structured data", () => {
  const d = freshDb();
  const t = getTool("langgraph", d);
  const alts = t.alternatives.map(s => getTool(s, d)).filter(Boolean);
  const page = TR.renderToolPage(t, [], alts);
  assert.match(page, /SoftwareSourceCode/);
  assert.match(page, /BreadcrumbList/);
  assert.match(TR.renderBest("vectordb", toolsByCategory("vectordb", d)), /ItemList/);
  assert.match(TR.renderCompare(getTool("langgraph", d), getTool("crewai", d)), /vs/);
  assert.match(TR.renderStateReport(allTools(d)), /Dataset/);
});

test("alternatives page renders ranked siblings with compare links + schema", () => {
  const d = freshDb();
  const t = getTool("langgraph", d);
  const siblings = toolsByCategory(t.category, d).filter(x => x.slug !== t.slug)
    .sort((a, b) => (b.stars || 0) - (a.stars || 0));
  assert.ok(siblings.length >= 2, "framework category has siblings");
  const page = TR.renderAlternatives(t, siblings);
  assert.match(page, /LangGraph alternatives/, "H1/title names the tool");
  assert.match(page, /ItemList/, "emits ItemList schema");
  assert.match(page, /BreadcrumbList/, "emits breadcrumb schema");
  // a head-to-head compare link for the top sibling, self excluded
  assert.match(page, new RegExp(`/compare/langgraph-vs-${siblings[0].slug}`));
  assert.doesNotMatch(page, /compare\/langgraph-vs-langgraph/, "tool is not its own alternative");
});
