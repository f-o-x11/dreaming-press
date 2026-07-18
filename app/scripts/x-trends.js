// x-trends.js — pull what's hot on X (Twitter) in the topics dreaming.press
// covers, so the newsroom commissions at the intersection of "what wins here"
// (analytics) and "what's trending out there". Runs on the server in the deploy
// (where X_BEARER_TOKEN lives and egress to api.twitter.com works) and writes
// analytics/x-trends.json, which export-analytics.js folds into BRIEF.md.
// INERT without X_BEARER_TOKEN. Read-only (v2 recent search, app-only bearer).
//   X_BEARER_TOKEN=... node scripts/x-trends.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "..", "..", "analytics");
const TOKEN = process.env.X_BEARER_TOKEN || "";

// Seed queries tuned to our audience: founders/solopreneurs/CEOs building with AI.
const QUERIES = [
  "(AI agents OR agentic OR MCP) (build OR launch OR ship) -is:retweet -is:reply lang:en",
  "(LLM OR \"coding agent\" OR RAG OR \"AI startup\") founder -is:retweet -is:reply lang:en",
];
const STOP = new Set(("the a an and or of to in for on with is are be this that it you your we our their they them at as by from will can just how what why not but so if new now get got out up my me i im dont into more most our us via amp rt http https co t".split(" ")));

async function search(q) {
  const url = "https://api.twitter.com/2/tweets/search/recent?" + new URLSearchParams({
    query: q, max_results: "40", sort_order: "relevancy",
    "tweet.fields": "public_metrics,created_at,lang",
  });
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { headers: { authorization: `Bearer ${TOKEN}` }, signal: ctl.signal });
    if (!r.ok) { console.log(`[x-trends] query "${q.slice(0, 30)}…" → HTTP ${r.status}`); return []; }
    const j = await r.json();
    return j.data || [];
  } catch (e) { console.log(`[x-trends] fetch failed: ${String(e && e.message || e)}`); return []; }
  finally { clearTimeout(t); }
}

function engagement(m = {}) { return (m.like_count || 0) + 2 * (m.retweet_count || 0) + (m.reply_count || 0) + (m.quote_count || 0); }

async function main() {
  if (!TOKEN) { console.log("[x-trends] no X_BEARER_TOKEN — skipping (inert)."); return; }
  const seen = new Set(); const all = [];
  for (const q of QUERIES) { for (const tw of await search(q)) { if (!seen.has(tw.id)) { seen.add(tw.id); all.push(tw); } } }
  if (!all.length) { console.log("[x-trends] no results (rate-limited or empty) — leaving prior file."); return; }

  const terms = new Map(); const tags = new Map();
  for (const tw of all) {
    const text = String(tw.text || "");
    for (const h of text.match(/#\w{2,30}/g) || []) tags.set(h.toLowerCase(), (tags.get(h.toLowerCase()) || 0) + 1);
    for (const w of text.toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/[^a-z0-9#\s-]/g, " ").split(/\s+/)) {
      if (w.length < 3 || w.length > 30 || STOP.has(w) || w.startsWith("#") || /^\d+$/.test(w)) continue;
      terms.set(w, (terms.get(w) || 0) + 1);
    }
  }
  const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([term, count]) => ({ term, count }));
  const topPosts = all.sort((a, b) => engagement(b.public_metrics) - engagement(a.public_metrics)).slice(0, 8)
    .map(tw => ({ text: tw.text.replace(/\s+/g, " ").slice(0, 220), engagement: engagement(tw.public_metrics),
      url: `https://x.com/i/status/${tw.id}`, created: tw.created_at }));

  const out = {
    generated: new Date().toISOString(), sampled: all.length, queries: QUERIES,
    topTerms: top(terms, 20), hashtags: top(tags, 12), topPosts,
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "x-trends.json"), JSON.stringify(out, null, 1));
  console.log(`[x-trends] wrote x-trends.json — ${all.length} posts, ${out.topTerms.length} terms, ${out.hashtags.length} tags.`);
}

main().catch((e) => { console.error("[x-trends] failed:", e); process.exit(0); });
