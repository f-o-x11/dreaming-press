import { test } from "node:test";
import assert from "node:assert/strict";
import { renderDashboard } from "../lib/dashboard.js";

const base = {
  days: 30,
  rangeLabel: "Last 30 days",
  range: "30d",
  totalPosts: 1854,
  funnel: { views: 6299, reads: 569, completes: 201, plays: 7, sessions: 6256 },
  prevFunnel: { views: 3116, reads: 185, completes: 85, plays: 9, sessions: 3075 },
  series: [{ day: "2026-08-01", views: 10, reads: 2 }],
  channels: [], referrers: [], content: [], devices: [], assistants: [],
  sections: [{ section: "wire", views: 100, reads: 20, sessions: 90, pieces: 12 }],
  pages: [{ path: "build", views: 40, reads: 5, sessions: 38, avg_dwell_sec: 30 }],
  nav: [{ surface: "masthead", clicks: 12, sessions: 10 }],
  quality: [{ channel: "direct", views: 6000, reads: 500, completes: 10, sessions: 5900,
    read_rate: 0.083, complete_rate: 0.002, pages_per_session: 1.02, median_dwell_sec: 14 }],
  audience: { subscribers: 12, confirmed: 9, agents: 0 },
};

// This is the regression that motivated the file. dashboard.js defines `stat()`
// TWICE — once inside crawlerPanel and once inside renderDashboard — and the
// delta argument was added to the wrong one. The page still rendered perfectly;
// the feature was simply absent, which no status-code or smoke check would catch.
test("headline stats carry a period-over-period delta", () => {
  const html = renderDashboard(base);
  assert.ok(html.includes("vs previous"), "expected a delta badge on the headline stats");
  // 569 vs 185 is +208%.
  assert.match(html, /208% vs previous/);
});

test("a zero-base previous period shows no delta rather than +100%", () => {
  const html = renderDashboard({ ...base, prevFunnel: { views: 0, reads: 0, completes: 0, plays: 0, sessions: 0 } });
  assert.ok(!html.includes("vs previous"),
    "a delta against zero is arithmetic, not information, and must be omitted");
});

test("the range picker marks exactly one option active", () => {
  for (const r of ["7d", "30d", "ytd", "all"]) {
    const html = renderDashboard({ ...base, range: r });
    const active = html.match(/class="dash-range is-on"/g) || [];
    assert.equal(active.length, 1, `range=${r} should mark one pill active`);
    assert.ok(html.includes(`href="/dashboard?range=${r}"`));
  }
});

test("the new panels render from their data", () => {
  const html = renderDashboard(base);
  for (const needle of ["Traffic quality by channel", "By desk", "Audience",
    "Top non-article pages", "Most-used navigation"]) {
    assert.ok(html.includes(needle), `missing panel: ${needle}`);
  }
  assert.ok(html.includes("1.02"), "pages/session should be shown");
  assert.ok(html.includes("14s"), "median dwell should be shown");
});

// Panels are conditional on having rows; an empty site must not emit an empty
// table shell with headers and no body.
test("panels are omitted entirely when there is no data", () => {
  const html = renderDashboard({ ...base, quality: [], sections: [], pages: [], nav: [], audience: null });
  assert.ok(!html.includes("Traffic quality by channel"));
  assert.ok(!html.includes("By desk"));
  assert.ok(!html.includes("Most-used navigation"));
});
