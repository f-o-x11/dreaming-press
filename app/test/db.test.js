// Tests for lib/db.js against a fresh in-memory database via the exported API.
// We do NOT touch the production DB — we build our own better-sqlite3 :memory:
// instance and pass it explicitly to every db function (each takes an optional `d`).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  init, upsertPost, clearPosts, allPosts, getPost, postsBySection,
  featuredPost, countPosts, search, bumpView, getViews, totalViews,
  addSubmission, listSubmissions,
} from "../lib/db.js";

let d;

function mkPost(over = {}) {
  return {
    slug: "test-post", title: "Test Post", dek: "A dek", author: "rosalinda",
    section: "dispatches", date: "2026-01-01", tags: ["a", "b"], sources: [["http://x", "X"]],
    featured: false, body_html: "<p>Hello world body text agentic</p>",
    body_text: "Hello world body text agentic", source: "md", read_time: 2, has_audio: false,
    ...over,
  };
}

before(() => {
  d = new Database(":memory:");
  init(d);
});

test("init creates posts table", () => {
  const cols = d.prepare("PRAGMA table_info(posts)").all().map(c => c.name);
  assert.ok(cols.includes("slug"));
  assert.ok(cols.includes("title"));
  assert.ok(cols.includes("has_audio"));
});

test("init is idempotent", () => {
  assert.doesNotThrow(() => init(d));
});

test("upsert → get round-trip", () => {
  clearPosts(d);
  upsertPost(mkPost(), d);
  const p = getPost("test-post", d);
  assert.equal(p.slug, "test-post");
  assert.equal(p.title, "Test Post");
  assert.equal(p.dek, "A dek");
  assert.equal(p.section, "dispatches");
});

test("hydrate parses tags and sources from JSON", () => {
  clearPosts(d);
  upsertPost(mkPost({ tags: ["x", "y", "z"], sources: [["u1", "l1"], ["u2", "l2"]] }), d);
  const p = getPost("test-post", d);
  assert.deepEqual(p.tags, ["x", "y", "z"]);
  assert.deepEqual(p.sources, [["u1", "l1"], ["u2", "l2"]]);
});

test("hydrate coerces featured and has_audio to boolean", () => {
  clearPosts(d);
  upsertPost(mkPost({ featured: true, has_audio: true }), d);
  const p = getPost("test-post", d);
  assert.equal(p.featured, true);
  assert.equal(p.has_audio, true);
  upsertPost(mkPost({ featured: false, has_audio: false }), d);
  const p2 = getPost("test-post", d);
  assert.equal(p2.featured, false);
  assert.equal(p2.has_audio, false);
});

test("upsert replaces on duplicate slug", () => {
  clearPosts(d);
  upsertPost(mkPost({ title: "First" }), d);
  upsertPost(mkPost({ title: "Second" }), d);
  assert.equal(countPosts(d), 1);
  assert.equal(getPost("test-post", d).title, "Second");
});

test("upsert applies defaults for missing fields", () => {
  clearPosts(d);
  upsertPost({ slug: "minimal", title: "Min", body_text: "txt" }, d);
  const p = getPost("minimal", d);
  assert.equal(p.author, "rosalinda");
  assert.equal(p.section, "dispatches");
  assert.equal(p.read_time, 1);
  assert.equal(p.dek, "");
  assert.deepEqual(p.tags, []);
});

test("getPost returns undefined for missing slug", () => {
  assert.equal(getPost("nope-not-here", d), undefined);
});

test("allPosts returns all and is ordered by date desc", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "old", date: "2026-01-01" }), d);
  upsertPost(mkPost({ slug: "new", date: "2026-06-01" }), d);
  upsertPost(mkPost({ slug: "mid", date: "2026-03-01" }), d);
  const all = allPosts(d);
  assert.equal(all.length, 3);
  assert.deepEqual(all.map(p => p.slug), ["new", "mid", "old"]);
});

test("postsBySection filters", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "d1", section: "dispatches" }), d);
  upsertPost(mkPost({ slug: "w1", section: "wire" }), d);
  upsertPost(mkPost({ slug: "w2", section: "wire" }), d);
  assert.equal(postsBySection("wire", d).length, 2);
  assert.equal(postsBySection("dispatches", d).length, 1);
  assert.equal(postsBySection("stack", d).length, 0);
});

test("countPosts counts", () => {
  clearPosts(d);
  assert.equal(countPosts(d), 0);
  upsertPost(mkPost({ slug: "a" }), d);
  upsertPost(mkPost({ slug: "b" }), d);
  assert.equal(countPosts(d), 2);
});

test("featuredPost returns the featured post", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "plain", featured: false, date: "2026-06-01" }), d);
  upsertPost(mkPost({ slug: "starred", featured: true, date: "2026-01-01" }), d);
  assert.equal(featuredPost(d).slug, "starred");
});

test("featuredPost falls back to newest when none featured", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "old", featured: false, date: "2026-01-01" }), d);
  upsertPost(mkPost({ slug: "new", featured: false, date: "2026-06-01" }), d);
  assert.equal(featuredPost(d).slug, "new");
});

// ── search ───────────────────────────────────────────────────────────────────
test("search returns relevant hits", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "agentic-post", title: "Agentic Systems", body_text: "all about agents" }), d);
  upsertPost(mkPost({ slug: "cooking", title: "Cooking Pasta", body_text: "boil water" }), d);
  const hits = search("agent", d);
  assert.ok(hits.length >= 1);
  assert.ok(hits.some(h => h.slug === "agentic-post"));
});

test("search prefix matching", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "p1", title: "Memory Systems", body_text: "memory and recall" }), d);
  const hits = search("memo", d);
  assert.ok(hits.some(h => h.slug === "p1"));
});

test("search empty string returns []", () => {
  assert.deepEqual(search("", d), []);
});

test("search whitespace returns []", () => {
  assert.deepEqual(search("   ", d), []);
});

test("search garbage returns []", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "p1", body_text: "real content" }), d);
  assert.deepEqual(search("zzqxw99999", d), []);
});

test("search strips quotes without throwing", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "p1", title: "Agent quote test", body_text: "agent" }), d);
  assert.doesNotThrow(() => search('"agent"', d));
  assert.doesNotThrow(() => search("agent's", d));
  const hits = search('"agent"', d);
  assert.ok(hits.some(h => h.slug === "p1"));
});

test("search handles fts special chars gracefully", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "p1", body_text: "content" }), d);
  // these would break a naive MATCH; should not throw, returns array
  assert.ok(Array.isArray(search("a AND b", d)));
  assert.ok(Array.isArray(search("(((", d)));
  assert.ok(Array.isArray(search("a OR", d)));
});

test("search results are hydrated", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "p1", title: "agent", tags: ["t1"], featured: true }), d);
  const hits = search("agent", d);
  const h = hits.find(x => x.slug === "p1");
  assert.deepEqual(h.tags, ["t1"]);
  assert.equal(h.featured, true);
});

// ── view counters ────────────────────────────────────────────────────────────
test("bumpView increments from zero", () => {
  assert.equal(getViews("view-test", d), 0);
  assert.equal(bumpView("view-test", d), 1);
  assert.equal(bumpView("view-test", d), 2);
  assert.equal(bumpView("view-test", d), 3);
});

test("getViews persists count", () => {
  bumpView("view-test-2", d);
  bumpView("view-test-2", d);
  assert.equal(getViews("view-test-2", d), 2);
});

test("getViews unknown slug is 0", () => {
  assert.equal(getViews("never-viewed", d), 0);
});

test("totalViews sums all counters", () => {
  const d2 = new Database(":memory:");
  init(d2);
  bumpView("a", d2);
  bumpView("a", d2);
  bumpView("b", d2);
  assert.equal(totalViews(d2), 3);
  d2.close();
});

test("totalViews is 0 on empty db", () => {
  const d3 = new Database(":memory:");
  init(d3);
  assert.equal(totalViews(d3), 0);
  d3.close();
});

// ── submissions ──────────────────────────────────────────────────────────────
test("addSubmission inserts and returns id", () => {
  const id = addSubmission({ slug: "s1", title: "Sub One", section: "wire", author: "abe" }, d);
  assert.ok(id >= 1);
});

test("listSubmissions returns inserted rows newest first", () => {
  const d4 = new Database(":memory:");
  init(d4);
  addSubmission({ slug: "first", title: "First", section: "wire", author: "abe" }, d4);
  addSubmission({ slug: "second", title: "Second", section: "stack", author: "indexer" }, d4);
  const list = listSubmissions(d4);
  assert.equal(list.length, 2);
  assert.equal(list[0].slug, "second"); // newest first (id DESC)
  assert.equal(list[1].slug, "first");
  assert.equal(list[0].status, "pending");
  d4.close();
});

test("addSubmission stores payload as JSON (round-trip via raw query)", () => {
  const d5 = new Database(":memory:");
  init(d5);
  addSubmission({ slug: "p", title: "P", section: "wire", author: "abe", body: "hello" }, d5);
  const row = d5.prepare("SELECT payload FROM submissions").get();
  const parsed = JSON.parse(row.payload);
  assert.equal(parsed.body, "hello");
  assert.equal(parsed.slug, "p");
  d5.close();
});
