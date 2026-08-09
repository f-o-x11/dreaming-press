// search-demand.js — what people actually TYPE into search, and which of those
// questions this publication has not answered yet.
//
// Why this exists: organic search is the weakest channel in the whole funnel
// (20 reads / 39 views in 14 days, against 3016 direct views), while AI crawlers
// pulled 9548 verified fetches. Both of those audiences find pages by matching a
// QUERY, and until now the newsroom had no query data at all — it commissioned
// from what already won here (analytics/BRIEF.md) and what was loud on X
// (x-trends.json). Both are rear-view mirrors of an audience we already have.
//
// Google Trends was the obvious source and is useless for this: the daily RSS,
// even with cat=t (technology), returns "britney spears" and "travel weather".
// The autocomplete endpoints are the real signal — they are literally the most
// common continuations of a prefix, they need no key, and they expose the long
// tail ("best ai agent for coding", "... reddit", "... free") that comparison and
// how-to pieces are shaped to answer. Two engines, because Bing's index is what
// several of our actual referrers (bing, cn.bing, duckduckgo, brave) are built on
// and its suggestions differ from Google's in useful ways.
//
// The output is not a list of trends. It is a COMMISSIONING QUEUE: every phrase
// is checked against the existing corpus, and the ones nothing covers are ranked
// by cross-engine agreement. Coverage is the whole point — 1817 posts in and the
// question is no longer "what is hot" but "what is hot that we have not written".
//
//   node scripts/search-demand.js [--seeds "a,b,c"] [--json PATH] [--quiet]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allPosts } from "../lib/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "..", "..", "analytics");
const QUIET = process.argv.includes("--quiet");
const argOf = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };

// Seeds are prefixes, not questions: autocomplete completes them. They mirror the
// formats that actually win here (comparison 9, news 7, how-to 5 — BRIEF.md) and
// the clusters AI crawlers pull hardest (GPU cloud, agent funding, local agents).
const DEFAULT_SEEDS = [
  "best ai agent", "best ai coding", "best llm for", "best gpu cloud", "best vector database",
  "ai agent vs", "claude code vs", "mcp server", "how to build an ai agent",
  "how to deploy llm", "cheapest gpu", "self host llm", "ai agent framework",
  "llm api pricing", "agent memory", "rag vs", "fine tune vs", "open source llm",
  "ai coding agent", "vibe coding", "context engineering", "llm observability",
  "ai agent security", "serverless gpu", "local llm",
];
const SEEDS = (argOf("--seeds", "") || "").trim()
  ? argOf("--seeds", "").split(",").map(s => s.trim()).filter(Boolean)
  : DEFAULT_SEEDS;

const TIMEOUT = 9000;
async function getJSON(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, {
      signal: ctl.signal,
      // Both endpoints are public but return junk or nothing to an obvious bot UA.
      headers: { "User-Agent": "Mozilla/5.0 (compatible; dreaming.press/1.0)" },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; } finally { clearTimeout(t); }
}

// Both engines answer OpenSearch-suggestions shape: [query, [suggestions], ...].
const google = (q) => getJSON(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`);
const bing = (q) => getJSON(`https://api.bing.com/osjson.aspx?query=${encodeURIComponent(q)}`);

const STOP = new Set("the a an and or of to in for on with is are be this that it you your we our at as by from will can how what why not but so if new now vs".split(" "));
const words = (s) => String(s).toLowerCase().replace(/[^a-z0-9+.# ]+/g, " ").split(/\s+/).filter(w => w && !STOP.has(w) && w.length > 2);

// Coverage test. A phrase counts as covered when some post's title+tags already
// carries essentially all of its meaningful words — deliberately generous, since
// the cost of re-writing a covered topic (cannibalisation, wasted run) is higher
// than the cost of skipping a marginal one.
function coverageIndex() {
  const idx = [];
  for (const p of allPosts()) {
    const hay = `${p.title || ""} ${p.dek || ""} ${Array.isArray(p.tags) ? p.tags.join(" ") : (p.tags || "")}`;
    idx.push({ slug: p.slug, title: p.title, set: new Set(words(hay)) });
  }
  return idx;
}
function coveredBy(phrase, idx) {
  const w = words(phrase);
  if (!w.length) return null;
  let best = null;
  for (const p of idx) {
    let hit = 0;
    for (const x of w) if (p.set.has(x)) hit++;
    const ratio = hit / w.length;
    if (!best || ratio > best.ratio) best = { ratio, slug: p.slug, title: p.title };
  }
  return best && best.ratio >= 0.85 ? best : null;
}

const suggestions = new Map(); // phrase -> {engines:Set, seeds:Set}
let reached = 0;
for (const seed of SEEDS) {
  const [g, b] = await Promise.all([google(seed), bing(seed)]);
  for (const [engine, res] of [["google", g], ["bing", b]]) {
    if (!Array.isArray(res) || !Array.isArray(res[1])) continue;
    reached++;
    for (const s of res[1]) {
      const phrase = String(s).toLowerCase().trim();
      if (!phrase || phrase === seed) continue;
      if (!suggestions.has(phrase)) suggestions.set(phrase, { engines: new Set(), seeds: new Set() });
      const e = suggestions.get(phrase);
      e.engines.add(engine); e.seeds.add(seed);
    }
  }
  await new Promise(r => setTimeout(r, 120)); // be a polite client
}

if (!reached) {
  if (!QUIET) console.log("[search-demand] no engine reachable — leaving previous file in place.");
  process.exit(0);
}

const idx = coverageIndex();
const rows = [];
for (const [phrase, meta] of suggestions) {
  const cov = coveredBy(phrase, idx);
  rows.push({
    phrase,
    engines: [...meta.engines],
    seeds: [...meta.seeds].slice(0, 3),
    // Agreement across two independent indexes is the closest thing to a volume
    // proxy available without a paid keyword tool.
    score: meta.engines.size * 2 + Math.min(meta.seeds.size, 3),
    covered: cov ? { slug: cov.slug, title: cov.title } : null,
  });
}
rows.sort((a, b) => b.score - a.score || a.phrase.localeCompare(b.phrase));
const gaps = rows.filter(r => !r.covered);

const payload = {
  fetched_at: new Date().toISOString(),
  seeds: SEEDS.length, phrases: rows.length, gaps: gaps.length,
  // The queue the newsroom reads. Capped because a brief nobody finishes reading
  // is a brief nobody acts on.
  top_gaps: gaps.slice(0, 40),
  covered_sample: rows.filter(r => r.covered).slice(0, 10),
};
fs.mkdirSync(OUT, { recursive: true });
const dest = argOf("--json", path.join(OUT, "search-demand.json"));
fs.writeFileSync(dest, JSON.stringify(payload, null, 1));
if (!QUIET) {
  console.log(`[search-demand] ${SEEDS.length} seeds → ${rows.length} phrases, ${gaps.length} uncovered → ${dest}`);
  for (const g of gaps.slice(0, 12)) console.log(`  · ${g.phrase}  [${g.engines.join("+")}]`);
}
