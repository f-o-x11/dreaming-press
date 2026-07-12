import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, mergeStats, cidrMatch, ipToInt, BOTS, BOT_LISTS } from "../scripts/crawler-stats.js";
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

test("cidrMatch and ipToInt do correct subnet math", () => {
  assert.equal(ipToInt("0.0.0.1"), 1);
  assert.ok(cidrMatch("74.7.227.10", "74.7.224.0/19"), "inside /19");
  assert.ok(!cidrMatch("8.8.8.8", "74.7.224.0/19"), "outside /19");
  assert.ok(cidrMatch("1.2.3.4", "0.0.0.0/0"), "/0 matches everything");
  assert.ok(!cidrMatch("not-an-ip", "74.7.224.0/19"), "garbage IP never matches");
});

test("aggregate counts IP-verified hits only when verify() confirms the source IP", () => {
  const line = (ip, ua) => `${ip} - - [12/Jul/2026:10:00:00 +0000] "GET /posts/x.html HTTP/1.1" 200 900 "-" "${ua}"`;
  const verify = (ip, name) => name === "GPTBot" && cidrMatch(ip, "74.7.224.0/19");
  const r = aggregate([
    line("74.7.227.10", "GPTBot/1.2 (+https://openai.com/gptbot)"), // real OpenAI range
    line("9.9.9.9", "GPTBot/1.2 (+https://openai.com/gptbot)"),     // spoofer
  ], { verify });
  const g = r.bots.find(b => b.name === "GPTBot");
  assert.equal(g.hits, 2);
  assert.equal(g.verifiedHits, 1, "only the in-range hit is verified");
});

test("mergeStats sums disjoint-window aggregates without double counting", () => {
  const line = (ip, ua) => `${ip} - - [12/Jul/2026:10:00:00 +0000] "GET /posts/x.html HTTP/1.1" 200 900 "-" "${ua}"`;
  const verify = (ip) => cidrMatch(ip, "74.7.224.0/19");
  const a = aggregate([line("74.7.227.1", "GPTBot"), line("9.9.9.9", "GPTBot")], { verify });
  const b = aggregate([line("74.7.227.2", "GPTBot")], { verify });
  const m = mergeStats(a, b);
  const g = m.bots.find(x => x.name === "GPTBot");
  assert.equal(g.hits, 3);
  assert.equal(g.verifiedHits, 2);
});

test("BOT_LISTS maps the verifiable engines to vendor range keys", () => {
  assert.deepEqual(BOT_LISTS.GPTBot, ["oai_gptbot"]);
  assert.ok(BOT_LISTS.Googlebot && BOT_LISTS.Bingbot && BOT_LISTS.PerplexityBot);
  assert.ok(!BOT_LISTS.ClaudeBot, "Anthropic publishes no list — not verifiable");
});

test("dashboard shows verified AI crawls and separates unverifiable bots", () => {
  const crawlers = {
    windowStart: "2026-06-28", windowEnd: "2026-07-12", totalHits: 100, aiHits: 80, aiEngines: 2, verifiedAiHits: 60,
    bots: [
      { name: "GPTBot", label: "GPTBot (OpenAI)", category: "ai", home: "https://openai.com/gptbot", hits: 61, verifiedHits: 60, verifiable: true, lastSeen: "2026-07-12", topPaths: [] },
      { name: "ClaudeBot", label: "ClaudeBot (Anthropic)", category: "ai", home: "https://anthropic.com", hits: 40, verifiedHits: 0, verifiable: false, lastSeen: "2026-07-12", topPaths: [] },
      { name: "Googlebot", label: "Googlebot", category: "search", home: "https://google.com", hits: 20, verifiedHits: 18, verifiable: true, lastSeen: "2026-07-12", topPaths: [] },
    ],
  };
  const base = { funnel: { views: 1, reads: 1, completes: 0, plays: 0, sessions: 1 }, series: [], channels: [], referrers: [], content: [], devices: [], assistants: [] };
  const html = renderDashboard({ ...base, crawlers });
  assert.match(html, /AI engines are reading us/);
  assert.match(html, /verified AI-engine crawls/);
  assert.match(html, /GPTBot \(OpenAI\)/);
  assert.match(html, /IP-verified/);
  assert.match(html, /Self-reported — not IP-verifiable/, "ClaudeBot shown as unverifiable");
  assert.match(html, /ClaudeBot \(Anthropic\)/);
});

test("dashboard omits the crawler panel gracefully when no data", () => {
  const base = { funnel: { views: 1, reads: 1, completes: 0, plays: 0, sessions: 1 }, series: [], channels: [], referrers: [], content: [], devices: [], assistants: [] };
  const html = renderDashboard({ ...base, crawlers: null });
  assert.ok(!html.includes("AI engines are reading us"), "no panel, no crash");
});
