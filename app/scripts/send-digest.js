// send-digest.js — weekly email digest of the week's posts to confirmed
// subscribers (#4). Idempotent per ISO week via a marker in the `dispatched`
// table, so a weekly cron can't double-send. Inert without RESEND_API_KEY.
//   node scripts/send-digest.js [--force]
import { db, allPosts, confirmedSubscribers, markDispatched } from "../lib/db.js";
import * as MAIL from "../lib/email.js";

const FORCE = process.argv.includes("--force");
const now = new Date();
// ISO week label YYYY-Www
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`;
}
const d = db();
const marker = `digest:${isoWeek(now)}`;
const already = d.prepare("SELECT 1 FROM dispatched WHERE slug = ?").get(marker);
if (already && !FORCE) { console.log(`[digest] ${marker} already sent.`); process.exit(0); }

const cutoff = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
const posts = allPosts().filter(p => (p.date || "") >= cutoff).slice(0, 12);
if (!posts.length) { console.log("[digest] no posts in the last 7 days."); process.exit(0); }

if (!MAIL.emailEnabled()) { console.log(`[digest] ${posts.length} posts, but RESEND_API_KEY unset — nothing sent.`); process.exit(0); }
const subs = confirmedSubscribers();
if (!subs.length) { markDispatched([marker], now.toISOString()); console.log("[digest] 0 subscribers — marked sent."); process.exit(0); }

let ok = 0, fail = 0;
for (const s of subs) {
  const tmpl = MAIL.dispatchEmail({ posts, unsubToken: s.unsub_token });
  const subject = `This week on dreaming.press — ${posts.length} new pieces`;
  const r = await MAIL.sendEmail({ to: s.email, ...tmpl, subject, unsubToken: s.unsub_token });
  if (r.ok) ok++; else { fail++; console.error(`  ✗ ${s.email}: ${r.status || r.error || "?"}`); }
}
markDispatched([marker], now.toISOString());
console.log(`[digest] ${marker} — ${ok} sent, ${fail} failed.`);
process.exit(fail > 0 ? 1 : 0);
