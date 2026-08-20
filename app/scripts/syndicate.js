// syndicate.js — cross-post Wire/Stack pieces to dev.to (and Medium) with a
// rel=canonical back to the origin (#24), expanding reach without duplicate-
// content penalties. Needs DEVTO_API_KEY (and optionally MEDIUM_TOKEN). Targets
// pieces published 7–14 days ago so the origin indexes first. Tracks sent items
// in the `dispatched` table (slug `syndicated:<slug>`) to avoid re-posting.
//   DEVTO_API_KEY=... node scripts/syndicate.js [--dry]
import { db, allPosts, eligibleForSyndication } from "../lib/db.js";
import { SITE } from "../lib/data.js";

const DEVTO = process.env.DEVTO_API_KEY || "";
const DRY = process.argv.includes("--dry");
const d = db();

function mdBody(p) {
  // reuse the clean markdown twin the site already serves
  return `> Originally published on [dreaming.press](${SITE}/posts/${p.slug}.html).\n\n${p.body_text || p.dek || ""}`;
}
const now = Date.now();
const windowPosts = eligibleForSyndication({ now }, d);

if (!windowPosts.length) { console.log("[syndicate] nothing in the 7–21 day window to syndicate."); process.exit(0); }
if (!DEVTO) { console.log(`[syndicate] ${windowPosts.length} eligible, but DEVTO_API_KEY unset — nothing posted.`); process.exit(0); }

// Daily ceiling on top of the per-run cap. This posts PUBLICLY under the
// publication's name, and the per-run limit of 3 only bounds one invocation —
// the deploy can fire many times a day, so without this the 432-piece backlog
// could drain in hours. That reads as spam to dev.to and to anyone following the
// account, and it is not undoable once posted.
const DAILY_CAP = 5;
const postedToday = d.prepare(
  "SELECT COUNT(*) AS n FROM dispatched WHERE slug LIKE 'syndicated:%' AND sent_at >= ?"
).get(new Date(now - 86400000).toISOString()).n;
const room = Math.max(0, DAILY_CAP - postedToday);
if (!room) {
  console.log(`[syndicate] daily cap reached (${postedToday}/${DAILY_CAP} in the last 24h) — nothing posted.`);
  process.exit(0);
}

let ok = 0;
for (const p of windowPosts.slice(0, Math.min(3, room))) {
  const payload = { article: { title: p.title, published: true, canonical_url: `${SITE}/posts/${p.slug}.html`,
    tags: (Array.isArray(p.tags) ? p.tags : []).slice(0, 4).map(t => String(t).replace(/[^a-z0-9]/gi, "")).filter(Boolean),
    body_markdown: mdBody(p) } };
  if (DRY) { console.log(`[dry] would syndicate: ${p.title}`); continue; }
  try {
    const r = await fetch("https://dev.to/api/articles", { method: "POST",
      headers: { "api-key": DEVTO, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (r.ok) { d.prepare("INSERT INTO dispatched (slug,sent_at) VALUES (?,?) ON CONFLICT(slug) DO NOTHING").run(`syndicated:${p.slug}`, new Date().toISOString()); ok++; console.log(`✓ dev.to: ${p.title}`); }
    else console.error(`✗ dev.to ${r.status}: ${p.title}`);
  } catch (e) { console.error(`✗ ${p.slug}: ${e.message}`); }
}
console.log(`[syndicate] ${ok} posted (${postedToday + ok}/${DAILY_CAP} in the last 24h, ${windowPosts.length} still eligible).`);
