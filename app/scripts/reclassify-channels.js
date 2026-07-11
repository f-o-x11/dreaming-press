// reclassify-channels.js — one-time (idempotent) backfill after the classifyChannel
// fix. Two corrections, both keyed off the stored referrer:
//  - PROMOTE real AI-assistant traffic (Yuanbao, Baidu AI, ChatGPT, …) that the old
//    classifier missed (esp. Chinese engines) into channel='ai'.
//  - DEMOTE rows the OLD classifier wrongly marked 'ai' because it matched a bare
//    substring ("openai"/"chatgpt"/"claude") inside an INTERNAL post slug — those
//    were internal clicks, not assistant referrals, and badly inflated the channel.
// The 'ai' bucket is only ever ref-derived (utm never yields 'ai'), so recomputing
// 'ai' rows from ref is safe and the script is re-runnable.
//   node scripts/reclassify-channels.js
import { db, classifyChannel, classifyAssistant } from "../lib/db.js";

const d = db();
const rows = d.prepare("SELECT id, ref, channel FROM events WHERE ref IS NOT NULL AND ref != ''").all();
const upd = d.prepare("UPDATE events SET channel = ? WHERE id = ?");
let promoted = 0, demoted = 0;
const byAssistant = {};
const tx = d.transaction(() => {
  for (const r of rows) {
    const nc = classifyChannel(r.ref, "");            // ref-only (utm isn't stored)
    if (nc === "ai" && r.channel !== "ai") {
      const info = upd.run("ai", r.id); promoted += info.changes;
      const a = classifyAssistant(r.ref) || "Other AI";
      byAssistant[a] = (byAssistant[a] || 0) + 1;
    } else if (r.channel === "ai" && nc !== "ai") {   // old substring-pollution cleanup
      const info = upd.run(nc, r.id); demoted += info.changes;
    }
  }
});
tx();
console.log(`[reclassify] promoted ${promoted} → ai, demoted ${demoted} mislabeled ai → correct channel`);
for (const [a, n] of Object.entries(byAssistant).sort((x, y) => y[1] - x[1])) console.log(`  +${a}: ${n}`);
