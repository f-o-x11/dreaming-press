// Tests for lib/data.js — esc, humanDate, readTime, authorOf, sections, authors.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  esc, humanDate, readTime, authorOf, SECTIONS, SECTION_ORDER,
  AUTHORS, DEFAULT_AUTHOR, SITE, NOW, humanizeSeries,
} from "../lib/data.js";

// ── esc() ────────────────────────────────────────────────────────────────────
test("esc: ampersand", () => assert.equal(esc("a & b"), "a &amp; b"));
test("esc: less-than", () => assert.equal(esc("a < b"), "a &lt; b"));
test("esc: greater-than", () => assert.equal(esc("a > b"), "a &gt; b"));
test("esc: double quote", () => assert.equal(esc('say "x"'), "say &quot;x&quot;"));
test("esc: all together", () =>
  assert.equal(esc('<a href="x">&</a>'), "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;"));
test("esc: ampersand escaped before others (no double-escape)", () =>
  assert.equal(esc("<"), "&lt;"));
test("esc: null becomes empty string", () => assert.equal(esc(null), ""));
test("esc: undefined becomes empty string", () => assert.equal(esc(undefined), ""));
test("esc: number coerced to string", () => assert.equal(esc(42), "42"));
test("esc: zero coerced", () => assert.equal(esc(0), "0"));
test("esc: plain text unchanged", () => assert.equal(esc("hello"), "hello"));
test("esc: single quotes not escaped", () => assert.equal(esc("it's"), "it's"));

// ── humanDate() ──────────────────────────────────────────────────────────────
test("humanDate: formats ISO date", () => assert.equal(humanDate("2026-06-13"), "June 13, 2026"));
test("humanDate: January", () => assert.equal(humanDate("2026-01-01"), "January 1, 2026"));
test("humanDate: December", () => assert.equal(humanDate("2026-12-31"), "December 31, 2026"));
test("humanDate: strips leading zero from day", () => assert.equal(humanDate("2026-03-05"), "March 5, 2026"));
test("humanDate: passthrough on bad input", () => assert.equal(humanDate("not-a-date"), "not-a-date"));
test("humanDate: empty string returns empty", () => assert.equal(humanDate(""), ""));
test("humanDate: null returns empty", () => assert.equal(humanDate(null), ""));
test("humanDate: undefined returns empty", () => assert.equal(humanDate(undefined), ""));
test("humanDate: partial date passthrough", () => assert.equal(humanDate("2026-06"), "2026-06"));
test("humanDate: all months map correctly", () => {
  const expect = ["January","February","March","April","May","June","July",
    "August","September","October","November","December"];
  for (let i = 0; i < 12; i++) {
    const mm = String(i + 1).padStart(2, "0");
    assert.equal(humanDate(`2026-${mm}-15`), `${expect[i]} 15, 2026`);
  }
});

// ── readTime() ───────────────────────────────────────────────────────────────
test("readTime: minimum 1 minute", () => assert.equal(readTime("short"), 1));
test("readTime: empty html is 1 min", () => assert.equal(readTime(""), 1));
test("readTime: 200 words ~ 1 min", () => {
  const html = "<p>" + Array(200).fill("word").join(" ") + "</p>";
  assert.equal(readTime(html), 1);
});
test("readTime: 400 words ~ 2 min", () => {
  const html = Array(400).fill("word").join(" ");
  assert.equal(readTime(html), 2);
});
test("readTime: 600 words ~ 3 min", () => {
  const html = Array(600).fill("word").join(" ");
  assert.equal(readTime(html), 3);
});
test("readTime: strips html tags from word count", () => {
  const html = "<p><strong>" + Array(200).fill("w").join(" ") + "</strong></p>";
  assert.equal(readTime(html), 1);
});
test("readTime: tags alone count as zero words → 1 min floor", () => {
  assert.equal(readTime("<p></p><div></div>"), 1);
});
test("readTime: rounds to nearest", () => {
  // 300 words / 200 = 1.5 → rounds to 2
  assert.equal(readTime(Array(300).fill("w").join(" ")), 2);
  // 250 / 200 = 1.25 → rounds to 1
  assert.equal(readTime(Array(250).fill("w").join(" ")), 1);
});

// ── authorOf() ───────────────────────────────────────────────────────────────
test("authorOf: known key returns that author", () => {
  assert.equal(authorOf("vesper").name, "Vesper Quill");
});
test("authorOf: unknown key falls back to default", () => {
  assert.equal(authorOf("nobody"), AUTHORS[DEFAULT_AUTHOR]);
});
test("authorOf: empty key falls back to default", () => {
  assert.equal(authorOf(""), AUTHORS[DEFAULT_AUTHOR]);
});
test("authorOf: null falls back to default", () => {
  assert.equal(authorOf(null), AUTHORS[DEFAULT_AUTHOR]);
});
test("authorOf: full-name value (not a key) falls back to default", () => {
  // The DB has one post with author '"Rosalinda Solana"' which is not a key.
  assert.equal(authorOf('"Rosalinda Solana"'), AUTHORS[DEFAULT_AUTHOR]);
});
test("authorOf: every key resolves to itself", () => {
  for (const key of Object.keys(AUTHORS)) {
    assert.equal(authorOf(key), AUTHORS[key]);
  }
});

// ── SECTION_ORDER + SECTIONS integrity ───────────────────────────────────────
test("SECTION_ORDER has 4 sections", () => assert.equal(SECTION_ORDER.length, 4));
test("SECTION_ORDER entries all exist in SECTIONS", () => {
  for (const s of SECTION_ORDER) assert.ok(SECTIONS[s], `missing section ${s}`);
});
test("SECTIONS keys all present in SECTION_ORDER", () => {
  for (const k of Object.keys(SECTIONS)) assert.ok(SECTION_ORDER.includes(k));
});
test("SECTION_ORDER has no duplicates", () => {
  assert.equal(new Set(SECTION_ORDER).size, SECTION_ORDER.length);
});
test("every section has name, accent, tagline", () => {
  for (const k of SECTION_ORDER) {
    const s = SECTIONS[k];
    assert.equal(typeof s.name, "string");
    assert.ok(s.name.length > 0);
    assert.match(s.accent, /^#[0-9a-f]{6}$/i, `accent for ${k}`);
    assert.equal(typeof s.tagline, "string");
    assert.ok(s.tagline.length > 0);
  }
});
test("expected section keys", () => {
  assert.deepEqual(SECTION_ORDER, ["dispatches", "wire", "stack", "fabrications"]);
});

// ── AUTHORS integrity ────────────────────────────────────────────────────────
test("every author has name, model, avatar, bio", () => {
  for (const [key, a] of Object.entries(AUTHORS)) {
    assert.equal(typeof a.name, "string", `${key}.name`);
    assert.ok(a.name.length > 0, `${key}.name nonempty`);
    assert.equal(typeof a.model, "string", `${key}.model`);
    assert.ok(a.model.length > 0, `${key}.model nonempty`);
    assert.equal(typeof a.avatar, "string", `${key}.avatar`);
    assert.match(a.avatar, /^\//, `${key}.avatar is a path`);
    assert.equal(typeof a.bio, "string", `${key}.bio`);
    assert.ok(a.bio.length > 0, `${key}.bio nonempty`);
  }
});
test("DEFAULT_AUTHOR exists in AUTHORS", () => assert.ok(AUTHORS[DEFAULT_AUTHOR]));
test("at least 5 authors", () => assert.ok(Object.keys(AUTHORS).length >= 5));

// ── SITE + NOW ───────────────────────────────────────────────────────────────
test("SITE is https url with no trailing slash", () => {
  assert.match(SITE, /^https:\/\//);
  assert.doesNotMatch(SITE, /\/$/);
});
test("NOW is ISO date", () => assert.match(NOW, /^\d{4}-\d{2}-\d{2}$/));

// ── humanizeSeries() ─────────────────────────────────────────────────────────
test("humanizeSeries: basic title-case", () =>
  assert.equal(humanizeSeries("the-operator"), "The Operator"));
test("humanizeSeries: small words stay lowercase mid-phrase", () =>
  assert.equal(humanizeSeries("tales-of-the-machine"), "Tales of the Machine"));
test("humanizeSeries: leading small word is capitalized", () =>
  assert.equal(humanizeSeries("the-arc"), "The Arc"));
test("humanizeSeries: domain acronym MCP upper-cased", () =>
  assert.equal(humanizeSeries("mcp-server-handbook"), "MCP Server Handbook"));
test("humanizeSeries: multiple acronyms", () =>
  assert.equal(humanizeSeries("llm-and-rag-basics"), "LLM and RAG Basics"));
test("humanizeSeries: AI acronym mid-phrase with leading + small words", () =>
  assert.equal(humanizeSeries("anatomy-of-an-ai-coding-agent"), "Anatomy of an AI Coding Agent"));
test("humanizeSeries: acronym beats small-word rule (is not in acronym set, vs kept small)", () =>
  assert.equal(humanizeSeries("ai-vs-ui"), "AI vs UI"));
test("humanizeSeries: underscores and spaces split too", () =>
  assert.equal(humanizeSeries("api_design notes"), "API Design Notes"));
test("humanizeSeries: empty/blank returns empty", () => {
  assert.equal(humanizeSeries(""), "");
  assert.equal(humanizeSeries("   "), "");
  assert.equal(humanizeSeries(null), "");
});
