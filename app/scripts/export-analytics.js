// export-analytics.js — write the dashboard's insights into the repo so the
// cloud newsroom (whose sandbox cannot reach dreaming.press — egress-blocked)
// gets REAL numbers from git and commissions from them. Runs on the server in
// the deploy; the deploy then commits analytics/ back to GitHub.
//   node scripts/export-analytics.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as DB from "../lib/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "..", "..", "analytics");
fs.mkdirSync(OUT, { recursive: true });

// AI-crawler demand: which of our pages the real (IP-verified) answer-engine
// crawlers actually fetch, so the newsroom commissions MORE of what ChatGPT &
// friends are ingesting. This is the "research before writing" the desk needs —
// GPTBot pulling a topic hard is a signal to go deeper on that topic.
function crawlerDemand() {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(OUT, "crawlers.json"), "utf8"));
    const verified = (c.bots || []).filter(b => b.category === "ai" && b.verifiable && b.verifiedHits > 0);
    const paths = new Map();
    for (const b of (c.bots || [])) for (const p of (b.topPaths || [])) if (/^\/posts\/|^\/stack\/|^\/compare\/|^\/best\/|^\/reports\//.test(p.path)) paths.set(p.path, (paths.get(p.path) || 0) + p.hits);
    const top = [...paths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    return { verifiedAiHits: c.verifiedAiHits || 0, engines: verified.map(b => `${b.label} ${b.verifiedHits}`), topCrawled: top };
  } catch { return null; }
}

const days = 14;
const snap = {
  generated: new Date().toISOString(),
  windowDays: days,
  site: DB.siteStats(),
  funnel: DB.funnel({ days }),
  channels: DB.channelBreakdown({ days }),
  assistants: DB.assistantBreakdown({ days }),
  devices: DB.deviceBreakdown({ days }),
  topContent: DB.topContent({ days, limit: 15 }),
  referrers: DB.topReferrers({ days, limit: 10 }),
};
fs.writeFileSync(path.join(OUT, "snapshot.json"), JSON.stringify(snap, null, 1));

// a compact natural-language brief the newsroom reads first
const host = (u) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return String(u).slice(0, 40); } };
const secCount = {};
for (const c of snap.topContent) if (c.reads >= 1) secCount[c.section] = (secCount[c.section] || 0) + 1;
const lines = [
  `# Analytics brief — auto-exported ${snap.generated.slice(0, 16)}Z (last ${days} days)`,
  ``,
  `READ THIS FIRST, COMMISSION FROM IT. Real reader data from dreaming.press/dashboard:`,
  ``,
  `- Funnel: ${snap.funnel.views} views → ${snap.funnel.reads} engaged reads → ${snap.funnel.completes} completes · ${snap.funnel.sessions} sessions.`,
  `- Channels: ${snap.channels.map(c => `${c.channel} ${c.reads}r/${c.views}v`).join(" · ") || "none yet"}.`,
  `- AI assistants (our real front door): ${snap.assistants.map(a => `${a.assistant} ${a.reads}r/${a.views}v`).join(" · ") || "none detected yet"}.`,
  `- Referrers: ${snap.referrers.map(r => host(r.ref)).join(", ") || "none yet"}.`,
  `- Engaged-read winners by section: ${Object.entries(secCount).map(([s, n]) => `${s}=${n}`).join(", ") || "no reads yet"}.`,
  ``,
  `## Top content by engaged reads`,
  ...snap.topContent.filter(c => c.reads >= 1).slice(0, 10).map(c => `- [${c.section}] "${c.title}" — ${c.reads} reads, ${c.views} views`),
  ``,
  `## What to do with this`,
  `- Make MORE of whatever formats/topics appear above (comparisons, tool highlights, how-tos are recurring winners).`,
  `- If AI-assistant referrers appear (chatgpt/perplexity/yuanbao/baidu), keep answers skimmable + citable near the top of pieces.`,
  `- If a piece has reads but low completes, tighten its opening; if high completes, write the follow-up.`,
];

// Append the AI-crawler demand section — real, IP-verified answer-engine pull.
const cd = crawlerDemand();
if (cd) {
  lines.push(
    ``,
    `## AI-crawler demand (RESEARCH BEFORE YOU WRITE)`,
    `The real answer engines are crawling us — IP-verified: ${cd.verifiedAiHits} confirmed AI-engine fetches` + (cd.engines.length ? ` (${cd.engines.join(", ")}).` : `.`),
    `These are the pages the crawlers pull hardest — each is a topic ChatGPT/Perplexity/etc. are actively ingesting, so commission MORE around them (deeper cuts, adjacent comparisons, updated versions):`,
    ...cd.topCrawled.map(([p, n]) => `- ${p}  — ${n} crawler fetches`),
    `Rule: before writing, check this list. A heavily-crawled topic is proven answer-engine demand — write the next piece in that cluster and cross-link it.`,
  );
}
fs.writeFileSync(path.join(OUT, "BRIEF.md"), lines.join("\n") + "\n");
console.log(`[analytics-export] snapshot.json + BRIEF.md written (${snap.topContent.length} top items).`);
