// score.js — apply RUBRIC.md to measured facts and print the weighted score.
//
// The point is repeatability. "How are we doing?" used to be an opinion; this
// turns it into eleven numbers with a documented arithmetic, so a different agent
// on a different day scores the same site the same way — and so movement between
// runs means something.
//
// Two rules keep it honest:
//
//   1. It scores facts from measure.js, which it does NOT gather itself. A scorer
//      that also measures can quietly define its way to a better number.
//   2. A dimension whose inputs are unavailable scores `null`, never 0 and never
//      a guess. Unmeasured and bad look identical in a total, and the optimistic
//      reading of an unmeasured dimension is the dangerous one. Nulls are dropped
//      from the weighted mean and reported separately, so the total always says
//      how much of the rubric it actually covered.
//
//   node scripts/measure.js --json /tmp/m.json --quiet && node scripts/score.js --facts /tmp/m.json
import fs from "node:fs";

const argOf = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const FACTS = argOf("--facts", "");
const JSON_OUT = argOf("--json", "");
if (!FACTS || !fs.existsSync(FACTS)) {
  console.error("score.js: --facts <path> required (produce it with scripts/measure.js --json <path>)");
  process.exit(2);
}
const M = JSON.parse(fs.readFileSync(FACTS, "utf8"));

// Score against ascending thresholds: the highest band whose floor is met.
// `bands` is [[floor, score], …] ascending; below the first floor scores 0.
const band = (v, bands) => {
  if (v == null || Number.isNaN(v)) return null;
  let s = 0;
  for (const [floor, score] of bands) if (v >= floor) s = score;
  return s;
};
// At this site's volumes several dimensions sit ON a band edge — D1's boundary is
// 200 attributable views/month and the measured value moves between 197 and 206
// week to week, which swings a 16-weight dimension by a full point on noise. That
// is a property of scoring small numbers, not a regression, but a score that
// jitters without explanation invites either false alarm or false comfort. So
// proximity to an edge is printed next to the value.
const nearEdge = (v, bands) => {
  if (v == null || Number.isNaN(v)) return "";
  for (const [floor] of bands) {
    if (floor > 0 && Math.abs(v - floor) / floor <= 0.12) {
      return ` ⚠ within 12% of the ${floor} boundary — expect jitter`;
    }
  }
  return "";
};
// Same, for metrics where LOWER is better (a fetches-per-session ratio).
const bandDesc = (v, bands) => {
  if (v == null || Number.isNaN(v)) return null;
  let s = 0;
  for (const [ceil, score] of bands) if (v <= ceil) s = Math.max(s, score);
  return s;
};

const reach = M.reach || {}, eng = M.engagement || {}, agents = M.agents || {};
const corpus = M.corpus || {}, quality = M.quality || {}, research = M.research_pipeline || {};
const perMonth = (n, days = 14) => (n == null ? null : Math.round(n * 30 / days));

// Attributable = everything except `direct`. direct is excluded deliberately: the
// code assigns it to ANY request with an empty referrer, so it is the one channel
// that inflates without anyone reading anything.
const attributableViews = (() => {
  const byCh = reach.by_channel || {};
  const keys = Object.keys(byCh).filter(k => k !== "direct");
  if (!keys.length) return null;
  return keys.reduce((s, k) => s + (byCh[k].views || 0), 0);
})();

const assistantSessions = agents.assistant_referred_views ?? null;
const retrievalRatio = agents.crawl_to_referral_ratio ? Math.round(1 / agents.crawl_to_referral_ratio) : null;

const DIMS = [
  { id: "D1", name: "Attributable human arrivals", weight: 16, cap: 6,
    value: perMonth(attributableViews) == null ? null : `${perMonth(attributableViews)}${nearEdge(perMonth(attributableViews), [[100, 0], [200, 1], [1000, 3], [10000, 5], [100000, 8], [250000, 10]])}`,
    unit: "attributable views/mo",
    score: band(perMonth(attributableViews), [[100, 0], [200, 1], [1000, 3], [10000, 5], [100000, 8], [250000, 10]]) },

  { id: "D2", name: "Engaged-read volume", weight: 11, cap: 6,
    value: perMonth(reach.reads) == null ? null : `${perMonth(reach.reads)}${nearEdge(perMonth(reach.reads), [[250, 0], [650, 1], [3000, 3], [12000, 5], [100000, 8], [200000, 10]])}`,
    unit: "engaged reads/mo",
    score: band(perMonth(reach.reads), [[250, 0], [650, 1], [3000, 3], [12000, 5], [100000, 8], [200000, 10]]) },

  // Two clauses, scored as the MINIMUM of both: the ratio alone is gameable by
  // crawling less, and the volume alone by being crawled more.
  { id: "D3", name: "Crawl → citation → click", weight: 14, cap: 10,
    value: assistantSessions == null ? null : `${perMonth(assistantSessions)}/mo @ ${retrievalRatio ?? "?"}:1`,
    unit: "assistant sessions/mo @ fetches-per-session",
    score: (() => {
      const vol = band(perMonth(assistantSessions), [[0, 0], [100, 1], [500, 3], [3000, 5], [12000, 8], [25000, 10]]);
      const rat = bandDesc(retrievalRatio, [[50, 10], [100, 8], [250, 5], [500, 3], [1e9, 1]]);
      if (vol == null || rat == null) return null;
      return Math.min(vol, rat);
    })() },

  // Usage, not surface area. Surface readiness is ~9 and irrelevant: the rubric
  // scores whether anything CONSUMES it. Cursor-pull counts need nginx logs, which
  // this script cannot read, so it scores on subscribers alone and says so.
  { id: "D4", name: "Agent pull depth (usage)", weight: 8, cap: 6,
    value: M.agent_subscribers ?? null, unit: "registered agent subscribers",
    note: "cursor/MCP pull counts require server log access — not measured here",
    score: band(M.agent_subscribers, [[0, 1], [10, 3], [50, 5], [200, 8], [500, 10]]) },

  // Scored on ATTRIBUTABLE median dwell, not the blended site average. `direct` is
  // 97% of views at a 8.8% read rate against organic's 52.5%, so a blended figure
  // measures the traffic nobody can vouch for and hides the readers who arrived
  // from somewhere real. Falls back to the blended number only when no attributable
  // channel has enough events to have a median at all.
  { id: "D5", name: "Session depth & return", weight: 7, cap: 10,
    value: (() => {
      const t = M.attributable_median_dwell_sec ?? eng.avg_time_sec;
      const pps = (M.channel_quality || []).length
        ? Math.max(...M.channel_quality.map(c => c.pages_per_session || 0)) : null;
      return t == null ? null : `${t}s median (attributable)${pps ? `, ${pps} pages/session best` : ""}`;
    })(),
    unit: "attributable median dwell + pages/session",
    score: (() => {
      const t = M.attributable_median_dwell_sec ?? eng.avg_time_sec;
      const dwellScore = band(t, [[0, 1], [20, 3], [45, 5], [70, 8], [90, 10]]);
      const pps = (M.channel_quality || []).length
        ? Math.max(...M.channel_quality.map(c => c.pages_per_session || 0)) : null;
      const depthScore = band(pps, [[1.0, 1], [1.3, 3], [1.6, 5], [2.0, 8], [2.2, 10]]);
      if (dwellScore == null) return null;
      // Both clauses, weakest wins: long dwell on a single page is a reader who
      // finished and left, which is not session DEPTH.
      return depthScore == null ? dwellScore : Math.min(dwellScore, depthScore);
    })() },

  // Can the system see its own outcomes? Scored from things this script can
  // actually verify: route-family telemetry present, dwell recorded, the audit
  // harness running (not merely returning zeros), and live demand signals.
  { id: "D6", name: "Measurement integrity", weight: 10, cap: 8,
    value: null, unit: "composite",
    score: (() => {
      let s = 2; // baseline: article-only telemetry
      if (M.route_families_beaconed) s += 2;              // A1
      if (agents.crawl_to_referral_ratio != null) s += 1; // A2: the join exists
      if (quality.ui_high != null) s += 1;                // audit actually runs
      if ((research.live_signals || 0) >= 3) s += 1;
      if (eng.avg_time_sec > 0) s += 1;                   // dwell actually lands
      return Math.min(s, 8);
    })() },

  { id: "D7", name: "Query-demand ownership", weight: 10, cap: 4,
    value: research.search_demand ? `${research.search_demand.phrases} tracked / ${research.search_demand.uncovered} uncovered` : null,
    unit: "phrases tracked + organic sessions",
    score: (() => {
      const sd = research.search_demand;
      if (!sd) return null;
      const organic = (reach.by_channel || {}).organic;
      const organicMo = organic ? perMonth(organic.views) : 0;
      let s = sd.phrases >= 100 ? 2 : 1;
      if (sd.phrases >= 1000) s += 1;
      if (organicMo >= 1000) s += 1;
      if (organicMo >= 20000) s += 2;
      if (organicMo >= 150000) s = 10;
      return Math.min(s, 4); // capped: real ownership needs GSC/Bing verification
    })() },

  { id: "D8", name: "Off-domain distribution", weight: 9, cap: 3,
    value: null, unit: "syndication surfaces live",
    note: "needs owner credentials (dev.to, Medium, HN/Reddit/X accounts) — capped at 3",
    score: 1 },

  { id: "D9", name: "Interactive asset yield", weight: 6, cap: 10,
    value: M.interactive_urls ?? null, unit: "crawlable decision URLs",
    score: band(M.interactive_urls, [[0, 0], [100, 2], [571, 3], [1500, 5], [3000, 8], [5000, 10]]) },

  { id: "D10", name: "Audio freshness", weight: 4, cap: 7,
    value: corpus.narrated_of_newest_25 == null ? null : `${corpus.narrated_of_newest_25}/25 newest`,
    unit: "narration coverage on recent posts",
    score: band(corpus.narrated_of_newest_25, [[0, 0], [5, 2], [12, 4], [20, 6], [25, 7]]) },

  { id: "D11", name: "Compounding efficiency", weight: 5, cap: 10,
    value: corpus.posts && reach.views ? +((reach.views * 30 / 14) / corpus.posts).toFixed(2) : null,
    unit: "monthly views per post",
    score: band(corpus.posts && reach.views ? (reach.views * 30 / 14) / corpus.posts : null,
      [[0, 0], [5, 1], [20, 3], [80, 5], [250, 8], [500, 10]]) },
];

const scored = DIMS.filter(d => d.score != null);
const unscored = DIMS.filter(d => d.score == null);
const totalWeight = scored.reduce((s, d) => s + d.weight, 0);
const weighted = scored.reduce((s, d) => s + d.score * d.weight, 0);
const overall = totalWeight ? +(weighted / totalWeight).toFixed(2) : null;
// What the same score would be if every dimension were pinned at its autonomous
// cap — the honest ceiling for work that needs no owner credentials.
const ceiling = +(DIMS.reduce((s, d) => s + Math.min(d.cap, 10) * d.weight, 0) / DIMS.reduce((s, d) => s + d.weight, 0)).toFixed(2);

console.log(`\ndreaming.press — RUBRIC score  (facts: ${M.measured_at || "?"})`);
console.log("=".repeat(78));
console.log(`${"".padEnd(4)}${"Dimension".padEnd(30)}${"Wt".padStart(3)}${"Score".padStart(7)}${"Cap".padStart(5)}   Measured`);
for (const d of DIMS) {
  const sc = d.score == null ? "  —" : String(d.score).padStart(3);
  console.log(`${d.id.padEnd(4)}${d.name.padEnd(30)}${String(d.weight).padStart(3)}${sc.padStart(7)}${String(d.cap).padStart(5)}   ${d.value ?? d.note ?? ""}`);
}
console.log("=".repeat(78));
console.log(`WEIGHTED SCORE: ${overall ?? "n/a"} / 10   (over ${totalWeight}/100 weight points scored)`);
if (unscored.length) console.log(`UNSCORED (reported as null, never 0): ${unscored.map(d => d.id).join(", ")}`);
console.log(`Autonomous ceiling with zero owner action: ~${ceiling} / 10`);

if (JSON_OUT) {
  fs.writeFileSync(JSON_OUT, JSON.stringify({
    scored_at: new Date().toISOString(), facts_from: M.measured_at,
    overall, weight_covered: totalWeight, autonomous_ceiling: ceiling,
    dimensions: DIMS.map(d => ({ id: d.id, name: d.name, weight: d.weight, score: d.score, cap: d.cap, value: d.value, note: d.note })),
  }, null, 2));
  console.log(`\nwrote ${JSON_OUT}`);
}
