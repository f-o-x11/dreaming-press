// crawl-yield.js — join what the answer engines TAKE against what they SEND BACK.
//
// This is the number the whole strategy turns on, and almost nobody can compute
// it. Cloudflare has the crawl side. Publishers have the visit side. A site that
// owns its own logs AND its own first-party analytics has both, and dreaming.press
// does — so it can state, per engine: "GPTBot fetched us 7,420 verified times and
// sent back N humans."
//
// RUBRIC.md D3 is weighted 14 and scored 1 because that ratio was never computed.
// Crawl volume alone is a vanity metric: 16,207 verified fetches looks like
// success right up until you notice it produced 25 human visits.
//
// The one distinction that makes this analytically honest: RETRIEVAL bots fetch a
// page *because a user asked a question right now*, so they can plausibly convert
// to a click. INDEX/TRAINING bots crawl to build a corpus and were never going to
// send anyone. Lumping them together understates the conversion rate of the only
// traffic that could ever convert, and flatters the traffic that couldn't. They
// are reported separately and the headline ratio uses retrieval only.
//
//   node scripts/crawl-yield.js [--days 14] [--json PATH] [--quiet]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as DB from "../lib/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "..", "..", "analytics");
const argOf = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const DAYS = parseInt(argOf("--days", "14"), 10);
const QUIET = process.argv.includes("--quiet");

// Which crawler belongs to which assistant brand, and whether its fetches are
// user-triggered. Names match crawlers.json `name`; brands match the strings
// classifyAssistant() returns, so the two halves of the join line up.
const BOTS = {
  "GPTBot":          { brand: "ChatGPT",    retrieval: false }, // corpus builder
  "OAI-SearchBot":   { brand: "ChatGPT",    retrieval: true },
  "ChatGPT-User":    { brand: "ChatGPT",    retrieval: true },  // a user clicked/asked
  "PerplexityBot":   { brand: "Perplexity", retrieval: true },
  "Perplexity-User": { brand: "Perplexity", retrieval: true },
  "ClaudeBot":       { brand: "Claude",     retrieval: false },
  "Claude-User":     { brand: "Claude",     retrieval: true },
  "Claude-SearchBot":{ brand: "Claude",     retrieval: true },
  "Google-Extended": { brand: "Gemini",     retrieval: false },
  "DuckAssistBot":   { brand: "DuckDuckGo", retrieval: true },
  "Bytespider":      { brand: "Doubao",     retrieval: false },
  "Amazonbot":       { brand: "Amazon",     retrieval: false },
  "Applebot-Extended": { brand: "Apple",    retrieval: false },
};

const crawlers = (() => { try { return JSON.parse(fs.readFileSync(path.join(OUT, "crawlers.json"), "utf8")); } catch { return null; } })();
if (!crawlers || !Array.isArray(crawlers.bots)) {
  console.error("[crawl-yield] no analytics/crawlers.json — run crawler-stats.js first.");
  process.exit(0);
}

// First-party side: sessions actually referred by each assistant.
const assistants = DB.assistantBreakdown({ days: DAYS });
const byBrand = new Map(assistants.map(a => [a.assistant, a]));

const engines = [];
const brandFetches = new Map(); // brand -> {retrieval, index}
for (const b of crawlers.bots) {
  const meta = BOTS[b.name];
  if (!meta || !(b.verifiedHits > 0)) continue;
  const e = brandFetches.get(meta.brand) || { retrieval: 0, index: 0, bots: [] };
  e[meta.retrieval ? "retrieval" : "index"] += b.verifiedHits;
  e.bots.push({ name: b.name, verified: b.verifiedHits, retrieval: meta.retrieval });
  brandFetches.set(meta.brand, e);
}

for (const [brand, f] of brandFetches) {
  const seen = byBrand.get(brand) || { views: 0, reads: 0, sessions: 0 };
  const total = f.retrieval + f.index;
  engines.push({
    engine: brand,
    verified_fetches: total,
    retrieval_fetches: f.retrieval,
    index_fetches: f.index,
    referred_sessions: seen.sessions,
    referred_views: seen.views,
    referred_reads: seen.reads,
    // Headline: retrieval fetches per human session. Lower is better. Null when
    // there is no retrieval crawling at all, because a ratio over zero is not
    // "perfect", it is undefined — and printing 0 would read as success.
    fetches_per_session: f.retrieval > 0 ? +(f.retrieval / Math.max(seen.sessions, 1)).toFixed(0) : null,
    click_through_pct: f.retrieval > 0 ? +(100 * seen.sessions / f.retrieval).toFixed(3) : null,
    bots: f.bots.sort((a, b2) => b2.verified - a.verified),
  });
}
engines.sort((a, b) => b.verified_fetches - a.verified_fetches);

const totRetrieval = engines.reduce((s, e) => s + e.retrieval_fetches, 0);
const totIndex = engines.reduce((s, e) => s + e.index_fetches, 0);
const totSessions = engines.reduce((s, e) => s + e.referred_sessions, 0);

const payload = {
  generated: new Date().toISOString(),
  window_days: DAYS,
  log_window: crawlers.windowStart && crawlers.windowEnd ? `${crawlers.windowStart} → ${crawlers.windowEnd}` : null,
  totals: {
    verified_fetches: totRetrieval + totIndex,
    retrieval_fetches: totRetrieval,
    index_fetches: totIndex,
    referred_sessions: totSessions,
    // The single number. Retrieval-only, because index crawling was never going
    // to send anyone and including it would flatter the result.
    retrieval_fetches_per_session: totRetrieval > 0 ? +(totRetrieval / Math.max(totSessions, 1)).toFixed(0) : null,
    click_through_pct: totRetrieval > 0 ? +(100 * totSessions / totRetrieval).toFixed(3) : null,
  },
  engines,
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(argOf("--json", path.join(OUT, "crawl-yield.json")), JSON.stringify(payload, null, 1));
if (!QUIET) {
  const t = payload.totals;
  console.log(`[crawl-yield] ${t.verified_fetches} verified fetches (${t.retrieval_fetches} retrieval / ${t.index_fetches} index) → ${t.referred_sessions} sessions`);
  console.log(`              retrieval ratio ${t.retrieval_fetches_per_session ?? "n/a"}:1 (CTR ${t.click_through_pct ?? "n/a"}%)`);
  for (const e of engines) {
    console.log(`  ${e.engine.padEnd(12)} ${String(e.verified_fetches).padStart(6)} fetched (${e.retrieval_fetches} retrieval) → ${e.referred_sessions} sessions  ${e.fetches_per_session ? e.fetches_per_session + ":1" : "—"}`);
  }
}
