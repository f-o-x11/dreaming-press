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

const days = 14;
const snap = {
  generated: new Date().toISOString(),
  windowDays: days,
  site: DB.siteStats(),
  funnel: DB.funnel({ days }),
  channels: DB.channelBreakdown({ days }),
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
fs.writeFileSync(path.join(OUT, "BRIEF.md"), lines.join("\n") + "\n");
console.log(`[analytics-export] snapshot.json + BRIEF.md written (${snap.topContent.length} top items).`);
