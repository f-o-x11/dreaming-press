// freshness.test.js — the content-decay refresh tool's pure core. The CLI is
// advisory (never gates), but the ranking logic must be correct: it decides which
// money page the routine spends a refresh on, so an off-by-one or a bad date
// filter wastes the highest-ROI SEO chore on the wrong page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { daysBetween, freshnessDate, freshnessReport, revisitDueReport } from "../scripts/check-freshness.js";

test("daysBetween: whole-day distance, clock-free", () => {
  assert.equal(daysBetween("2026-06-01", "2026-06-25"), 24);
  assert.equal(daysBetween("2026-06-25", "2026-06-25"), 0);
  assert.equal(daysBetween("2025-06-25", "2026-06-25"), 365);
  // crosses a month/DST boundary without drift
  assert.equal(daysBetween("2026-02-25", "2026-03-04"), 7);
});

test("daysBetween: malformed dates yield null, never a fabricated age", () => {
  assert.equal(daysBetween("", "2026-06-25"), null);
  assert.equal(daysBetween("2026-6-1", "2026-06-25"), null); // not zero-padded
  assert.equal(daysBetween("nope", "2026-06-25"), null);
  assert.equal(daysBetween("2026-06-25", undefined), null);
});

test("freshnessDate: an updated: stamp wins and resets the clock; else date:", () => {
  assert.deepEqual(freshnessDate({ date: "2026-01-01", updated: "2026-06-01" }), { date: "2026-06-01", updated: true });
  assert.deepEqual(freshnessDate({ date: "2026-01-01" }), { date: "2026-01-01", updated: false });
  // a blank or malformed updated: falls back to the publication date
  assert.deepEqual(freshnessDate({ date: "2026-01-01", updated: "" }), { date: "2026-01-01", updated: false });
  assert.deepEqual(freshnessDate({ date: "2026-01-01", updated: "soon" }), { date: "2026-01-01", updated: false });
});

const fm = (o) => {
  const lines = ["---", `section: ${o.section || "wire"}`, `date: ${o.date}`];
  if (o.updated) lines.push(`updated: ${o.updated}`);
  if (o.compare) lines.push("compare: A | B ;; x | y");
  lines.push("---", "body");
  return lines.join("\n");
};

test("freshnessReport: only demand pieces (wire/stack + compare/-vs-), oldest first", () => {
  const posts = [
    { file: "a-vs-b.md", raw: fm({ date: "2026-01-01" }) },                 // 175d stale
    { file: "fresh-vs-new.md", raw: fm({ date: "2026-06-01" }) },           // 24d fresh
    { file: "c-vs-d.md", raw: fm({ date: "2025-06-25" }) },                 // 365d critical
    { file: "a-dispatch.md", raw: fm({ section: "dispatches", date: "2024-01-01" }) }, // not demand
    { file: "news.md", raw: fm({ section: "wire", date: "2024-01-01" }) },  // wire but no compare/-vs- → not demand
    { file: "table.md", raw: fm({ section: "stack", date: "2025-01-01", compare: true }) }, // demand via compare:
  ];
  const r = freshnessReport(posts, "2026-06-25", { staleDays: 120, criticalDays: 240 });
  const slugs = r.map((x) => x.slug);
  // oldest → newest: table (540d) > c-vs-d (365d) > a-vs-b (175d); fresh & non-demand excluded
  assert.deepEqual(slugs, ["table", "c-vs-d", "a-vs-b"]);
  assert.equal(r[0].tier, "critical"); // table, 540d
  assert.equal(r[2].tier, "stale");    // a-vs-b, 175d (< 240)
});

test("freshnessReport: updated: stamp pulls a piece out of the stale set", () => {
  const posts = [
    { file: "old-vs-thing.md", raw: fm({ date: "2026-01-01", updated: "2026-06-10" }) }, // refreshed 15d ago
  ];
  const r = freshnessReport(posts, "2026-06-25", { staleDays: 120 });
  assert.equal(r.length, 0); // the refresh reset its clock below threshold
});

test("freshnessReport: a piece with an unparseable date is skipped, not ranked max-stale", () => {
  const posts = [{ file: "broken-vs-x.md", raw: fm({ date: "2026-6-1" }) }];
  const r = freshnessReport(posts, "2026-06-25", { staleDays: 1 });
  assert.equal(r.length, 0);
});

test("revisitDueReport: surfaces only revisit: pieces that have come due, soonest-due first", () => {
  const posts = [
    { file: "2026-06-26-antigravity-vs-cursor.md", raw: "---\nrevisit: 2026-09-26\n---\nbody" }, // future → not due
    { file: "2026-05-01-mcp-rc-explainer.md", raw: "---\nrevisit: 2026-06-01\n---\nbody" },       // past → due
    { file: "2026-06-20-gemini-3-launch.md", raw: "---\nrevisit: 2026-06-25\n---\nbody" },         // past → due
    { file: "evergreen-x-vs-y.md", raw: "---\ndate: 2026-01-01\n---\nbody" },                       // no revisit → ignored
  ];
  const due = revisitDueReport(posts, "2026-06-26");
  assert.deepEqual(due.map((d) => d.slug), ["mcp-rc-explainer", "gemini-3-launch"]); // soonest-due first, date prefix stripped
  assert.equal(due[0].when, "2026-06-01");
});
