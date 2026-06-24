// content-standard.test.js — guards the demand-piece SEO-completeness standard so
// each run cannot quietly ship a Wire/Stack comparison missing its summary/faq/
// sources/art/internal-link. Two layers: (1) unit tests on the checklist logic,
// (2) a live gate asserting the pieces THIS run changed (uncommitted) all comply.
import { test } from "node:test";
import assert from "node:assert/strict";
import { auditPiece, auditContent, changedContentFiles } from "../scripts/check-content.js";

const FM = (o) => `---\n${Object.entries(o).map(([k, v]) => `${k}: ${v}`).join("\n")}\n---\n`;
const COMPLIANT = FM({
  title: "Foo vs Bar: Picking One in 2026",
  dek: "A standfirst.",
  author: "dex", author_type: "ai", section: "stack", date: "2026-06-21",
  tags: "reportive",
  summary: "Point one. ;; Point two. ;; Point three.",
  faq: "What is Foo? | Foo is a thing. ;; What is Bar? | Bar is another thing.",
  sources: "https://example.com | Example",
  art: "",
  compare: "Dimension | Foo | Bar ;; Speed | fast | slow ;; Cost | low | high",
}) + "Body with an [internal link](/posts/other.html) and @repo{a/b | https://github.com/a/b | does x | Go | 1k}.\n";

test("auditPiece: a complete demand piece passes", () => {
  const r = auditPiece("foo-vs-bar.md", COMPLIANT);
  assert.equal(r.demand, true);
  assert.deepEqual(r.errors, []);
});

test("auditPiece: missing faq is flagged", () => {
  const raw = COMPLIANT.replace(/^faq:.*\n/m, "");
  const r = auditPiece("foo-vs-bar.md", raw);
  assert.ok(r.errors.some((e) => /faq/.test(e)), `expected faq error, got ${JSON.stringify(r.errors)}`);
});

test("auditPiece: missing summary is flagged", () => {
  const raw = COMPLIANT.replace(/^summary:.*\n/m, "");
  const r = auditPiece("foo-vs-bar.md", raw);
  assert.ok(r.errors.some((e) => /summary/.test(e)));
});

test("auditPiece: missing in-cluster internal link is flagged", () => {
  const raw = COMPLIANT.replace("[internal link](/posts/other.html)", "no link here");
  const r = auditPiece("foo-vs-bar.md", raw);
  assert.ok(r.errors.some((e) => /internal link/.test(e)));
});

test("auditPiece: missing compare at-a-glance table is flagged", () => {
  const raw = COMPLIANT.replace(/^compare:.*\n/m, "");
  const r = auditPiece("foo-vs-bar.md", raw);
  assert.ok(r.errors.some((e) => /compare/.test(e)), `expected compare-table error, got ${JSON.stringify(r.errors)}`);
});

test("auditPiece: a compare line with only a header row (no data) is flagged", () => {
  const raw = COMPLIANT.replace(/^compare:.*\n/m, "compare: Dimension | Foo | Bar\n");
  const r = auditPiece("foo-vs-bar.md", raw);
  assert.ok(r.errors.some((e) => /compare/.test(e)), `expected compare-table error, got ${JSON.stringify(r.errors)}`);
});

test("auditPiece: a Wire/Stack piece with no sources or @repo cards is flagged", () => {
  const raw = FM({ title: "A Report", section: "wire", date: "2026-06-21" }) + "Body with no evidence at all.\n";
  const r = auditPiece("a-report.md", raw);
  assert.ok(r.errors.some((e) => /sources/.test(e)));
});

test("auditPiece: an opinion Dispatch with 'vs' in the title is NOT a demand piece", () => {
  // section dispatches → never gated as a comparison, even with a versus title
  const raw = FM({ title: "The Streak vs The Standard", section: "dispatches", date: "2026-06-21" }) + "First-person prose.\n";
  const r = auditPiece("the-streak-vs-the-standard.md", raw);
  assert.equal(r.demand, false);
  assert.deepEqual(r.errors, []);
});

test("auditPiece: a Stack piece may satisfy evidence with @repo cards instead of sources", () => {
  const raw = FM({ title: "A vs B: Compared", section: "stack", date: "2026-06-21",
    summary: "x. ;; y. ;; z.", faq: "Q? | A.", art: "",
    compare: "Dimension | A | B ;; Layer | x | y" })
    + "Body [link](/best/agents.html) @repo{a/b | https://github.com/a/b | x | Go | 1k}\n";
  const r = auditPiece("a-vs-b.md", raw);
  assert.deepEqual(r.errors, []);
});

test("auditPiece: a dead internal /posts/ link is flagged when the corpus slug-set is supplied", () => {
  const raw = COMPLIANT.replace("/posts/other.html", "/posts/no-such-piece.html");
  const slugs = new Set(["foo-vs-bar", "real-sibling"]);
  const r = auditPiece("foo-vs-bar.md", raw, slugs);
  assert.ok(r.errors.some((e) => /dead internal link/.test(e)), `expected dead-link error, got ${JSON.stringify(r.errors)}`);
});

test("auditPiece: an internal link resolving by date-stripped slug passes (mirrors resolveSlug)", () => {
  // body links the bare form; the corpus only has the date-prefixed file — still valid
  const raw = COMPLIANT.replace("/posts/other.html", "/posts/real-sibling.html");
  const slugs = new Set(["foo-vs-bar", "real-sibling"]); // stored as 2026-06-23-real-sibling → stripped
  const r = auditPiece("foo-vs-bar.md", raw, slugs);
  assert.deepEqual(r.errors, [], `expected no errors, got ${JSON.stringify(r.errors)}`);
});

test("auditPiece: without a slug-set, link resolution is skipped (backward-compatible)", () => {
  // COMPLIANT links /posts/other.html which doesn't exist; with no slug-set, no error
  const r = auditPiece("foo-vs-bar.md", COMPLIANT);
  assert.deepEqual(r.errors, []);
});

// ── live gate: the pieces this run changed must all meet the standard ─────────
// Once committed they fall out of `git status` and are grandfathered, so this
// only ever holds the current slate to account — and never the legacy backlog.
test("content gate: every content file changed in this run meets the standard", () => {
  const changed = changedContentFiles();
  const failures = auditContent()
    .filter((r) => changed.has(r.file) && r.errors.length)
    .map((r) => `${r.file}: ${r.errors.join("; ")}`);
  assert.deepEqual(failures, [], `changed pieces below standard:\n${failures.join("\n")}`);
});
