// reclassify-channels.js — one-time (idempotent) backfill after the classifyChannel
// fix. Historical events from AI assistants (Yuanbao, Baidu AI, etc.) were stored
// with the wrong channel, so the dashboard under-counted the front door that's
// actually working. This PROMOTES mis-bucketed rows to 'ai' based on their stored
// referrer. Conservative: only ref→'ai' promotions, never touches utm-classified
// rows (campaign/social/email), so it can be re-run safely.
//   node scripts/reclassify-channels.js
import { db, classifyChannel, classifyAssistant } from "../lib/db.js";

const d = db();
const rows = d.prepare("SELECT rowid, ref, channel FROM events WHERE ref IS NOT NULL AND ref != ''").all();
const upd = d.prepare("UPDATE events SET channel = 'ai' WHERE rowid = ?");
let promoted = 0;
const byAssistant = {};
const tx = d.transaction(() => {
  for (const r of rows) {
    if (classifyChannel(r.ref, "") === "ai" && r.channel !== "ai") {
      upd.run(r.rowid); promoted++;
      const a = classifyAssistant(r.ref) || "Other AI";
      byAssistant[a] = (byAssistant[a] || 0) + 1;
    }
  }
});
tx();
console.log(`[reclassify] promoted ${promoted} event(s) to channel=ai`);
for (const [a, n] of Object.entries(byAssistant).sort((x, y) => y[1] - x[1])) console.log(`  ${a}: ${n}`);
