import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, BOTS } from "../scripts/crawler-stats.js";
import { renderDashboard } from "../lib/dashboard.js";

const line = (ts, req, ua) => `1.2.3.4 - - [${ts}] "${req}" 200 1234 "-" "${ua}"`;

test("aggregate counts a bot once per line despite the UA naming it twice", () => {
  const lines = [
    line("12/Jul/2026:14:03:11 +0000", "GET /posts/x.html HTTP/1.1", "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)"),
    line("11/Jul/2026:09:00:00 +0000", "GET /tools HTTP/1.1", "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)"),
  ];
  const r = aggregate(lines);
  assert.equal(r.bots.find((b) => b.name === "GPTBot").hits, 2, "2 lines = 2 hits, not 4");
});

test("aggregate ignores non-bot (human) user-agents", () => {
  const r = aggregate([line("10/Jul/2026:11:00:00 +0000", "GET / HTTP/1.1", "Mozilla/5.0 (Macintosh) Safari/537.36")]);
  assert.equal(r.bots.length, 0);
});

test("aggregate categorises AI vs search crawlers", () => {
  const r = aggregate([
    line("12/Jul/2026:10:00:00 +0000", "GET / HTTP/1.1", "ClaudeBot/1.0 (+claudebot@anthropic.com)"),
    line("12/Jul/2026:10:00:00 +0000", "GET / HTTP/1.1", "Mozilla/5.0 (compatible; Googlebot/2.1)"),
  ]);
  assert.equal(r.aiEngines, 1, "ClaudeBot is the one AI engine");
  assert.equal(r.aiHits, 1);
  assert.equal(r.bots.find((b) => b.name === "ClaudeBot").category, "ai");
  assert.equal(r.bots.find((b) => b.name === "Googlebot").category, "search");
});

test("aggregate resolves overlapping tokens most-specific-first (Applebot-Extended over Applebot)", () => {
  const r = aggregate([line("10/Jul/2026:11:00:00 +0000", "GET / HTTP/1.1", "Mozilla/5.0 (compatible; Applebot-Extended/0.1)")]);
  assert.equal(r.bots[0].name, "Applebot-Extended");
  assert.equal(r.bots[0].category, "ai");
});

test("aggregate tracks last-seen date and filters junk/static paths from topPaths", () => {
  const r = aggregate([
    line("12/Jul/2026:10:00:00 +0000", "GET /reports/state-of-ai-agents HTTP/1.1", "GPTBot/1.2 (+https://openai.com/gptbot)"),
    line("13/Jul/2026:10:00:00 +0000", "GET /.env HTTP/1.1", "GPTBot/1.2 (+https://openai.com/gptbot)"),
    line("13/Jul/2026:10:00:00 +0000", "GET /style.css HTTP/1.1", "GPTBot/1.2 (+https://openai.com/gptbot)"),
  ]);
  const g = r.bots.find((b) => b.name === "GPTBot");
  assert.equal(g.hits, 3, "all 3 fetches counted");
  assert.equal(g.lastSeen, "2026-07-13");
  assert.deepEqual(g.topPaths.map((p) => p.path), ["/reports/state-of-ai-agents"], "junk + static paths excluded from top pages");
});

test("BOTS list is ordered so no earlier pattern shadows a more specific later one", () => {
  // Applebot must come after Applebot-Extended; GPTBot after OAI-SearchBot/ChatGPT-User
  const idx = (n) => BOTS.findIndex((b) => b.name === n);
  assert.ok(idx("Applebot-Extended") < idx("Applebot"));
  assert.ok(idx("OAI-SearchBot") < idx("GPTBot"));
});

test("dashboard renders the crawler panel when crawlers data is present", () => {
  const crawlers = {
    windowStart: "2026-06-28", windowEnd: "2026-07-12", totalHits: 100, aiHits: 80, aiEngines: 2,
    bots: [
      { name: "GPTBot", label: "GPTBot (OpenAI)", category: "ai", home: "https://openai.com/gptbot", hits: 60, lastSeen: "2026-07-12", topPaths: [] },
      { name: "Googlebot", label: "Googlebot", category: "search", home: "https://google.com", hits: 20, lastSeen: "2026-07-12", topPaths: [] },
    ],
  };
  const base = { funnel: { views: 1, reads: 1, completes: 0, plays: 0, sessions: 1 }, series: [], channels: [], referrers: [], content: [], devices: [], assistants: [] };
  const html = renderDashboard({ ...base, crawlers });
  assert.match(html, /AI engines are reading us/);
  assert.match(html, /AI-crawler fetches/);
  assert.match(html, /GPTBot \(OpenAI\)/);
});

test("dashboard omits the crawler panel gracefully when no data", () => {
  const base = { funnel: { views: 1, reads: 1, completes: 0, plays: 0, sessions: 1 }, series: [], channels: [], referrers: [], content: [], devices: [], assistants: [] };
  const html = renderDashboard({ ...base, crawlers: null });
  assert.ok(!html.includes("AI engines are reading us"), "no panel, no crash");
});
