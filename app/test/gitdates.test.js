// Tests for lib/gitdates.js — resolveUpdated() picks the value that lights the
// on-page "Updated <date>" freshness signal (render.js shows it only when
// updated !== date). The git-walk itself (lastModifiedDates) shells out to git and
// is exercised end-to-end by ingest; here we pin the pure resolution rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveUpdated, lastModifiedDates } from "../lib/gitdates.js";

test("resolveUpdated: explicit frontmatter updated always wins", () => {
  assert.equal(resolveUpdated("2026-06-22", "2026-06-20", "2026-06-30"), "2026-06-22");
});

test("resolveUpdated: explicit updated honored even if it predates publish (author override)", () => {
  assert.equal(resolveUpdated("2026-06-10", "2026-06-20", ""), "2026-06-10");
});

test("resolveUpdated: git date used when strictly newer than publish", () => {
  assert.equal(resolveUpdated("", "2026-06-20", "2026-06-23"), "2026-06-23");
});

test("resolveUpdated: same-day git edit stays unmarked (would hide the line)", () => {
  assert.equal(resolveUpdated("", "2026-06-24", "2026-06-24"), "");
});

test("resolveUpdated: git date earlier than publish is ignored (no backwards freshness)", () => {
  assert.equal(resolveUpdated("", "2026-06-20", "2026-06-18"), "");
});

test("resolveUpdated: missing git date falls back to empty (prior behavior)", () => {
  assert.equal(resolveUpdated("", "2026-06-20", undefined), "");
  assert.equal(resolveUpdated("", "2026-06-20", null), "");
});

test("resolveUpdated: empty/whitespace frontmatter is not treated as explicit", () => {
  assert.equal(resolveUpdated("   ", "2026-06-20", "2026-06-25"), "2026-06-25");
});

test("lastModifiedDates: degrades to empty Map when not a git repo (no throw)", () => {
  const m = lastModifiedDates("/nonexistent-not-a-repo-xyz");
  assert.ok(m instanceof Map);
  assert.equal(m.size, 0);
});
