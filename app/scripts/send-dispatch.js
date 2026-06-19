// send-dispatch.js — email confirmed subscribers a digest of newly-published posts.
// Run on gil-vm after each deploy/ingest. Safe to run on every deploy: it no-ops
// when there's nothing new, and seeds the existing backlog as already-sent on first
// run so activation never blasts old posts.
//
//   node scripts/send-dispatch.js          # send new posts (or seed on first run)
//   node scripts/send-dispatch.js --seed    # force-seed all current posts, send nothing
//   node scripts/send-dispatch.js --dry      # report what would send, send nothing
import * as DB from "../lib/db.js";
import * as MAIL from "../lib/email.js";

const SEED = process.argv.includes("--seed");
const DRY = process.argv.includes("--dry");
const now = new Date();
const iso = now.toISOString();

function recentCutoff(days) {
  const d = new Date(now.getTime() - days * 86400_000);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// First run (or --seed): mark everything currently published as already-sent.
if (SEED || !DB.dispatchSeeded()) {
  const all = DB.undispatchedPosts();
  if (!DRY) DB.markDispatched(all.map(p => p.slug), iso);
  console.log(`[dispatch] seeded ${all.length} existing posts as already-sent — no email.`);
  process.exit(0);
}

const pending = DB.undispatchedPosts();
if (pending.length === 0) { console.log("[dispatch] nothing new."); process.exit(0); }

// Only email posts published in the last 2 days; older stragglers are marked
// sent silently so an email outage never turns into a backlog blast.
const cutoff = recentCutoff(2);
const toSend = pending.filter(p => (p.date || "") >= cutoff);

if (!MAIL.emailEnabled()) {
  console.log(`[dispatch] ${pending.length} undispatched, but RESEND_API_KEY unset — leaving pending, sending nothing.`);
  process.exit(0);
}

const subs = DB.confirmedSubscribers();
if (subs.length === 0) {
  if (!DRY) DB.markDispatched(pending.map(p => p.slug), iso);
  console.log(`[dispatch] 0 subscribers — marked ${pending.length} posts sent, emailed no one.`);
  process.exit(0);
}

if (toSend.length === 0) {
  if (!DRY) DB.markDispatched(pending.map(p => p.slug), iso);
  console.log(`[dispatch] ${pending.length} undispatched but none within ${cutoff}+ — marked sent, emailed no one.`);
  process.exit(0);
}

console.log(`[dispatch] sending ${toSend.length} post(s) to ${subs.length} subscriber(s)${DRY ? " [DRY]" : ""}:`);
for (const p of toSend) console.log(`  · [${p.section}] ${p.title}`);
if (DRY) process.exit(0);

let ok = 0, fail = 0;
for (const s of subs) {
  const tmpl = MAIL.dispatchEmail({ posts: toSend, unsubToken: s.unsub_token });
  const r = await MAIL.sendEmail({ to: s.email, ...tmpl, unsubToken: s.unsub_token });
  if (r.ok) ok++; else { fail++; console.error(`  ✗ ${s.email}: ${r.status || r.error || "?"} ${r.body || ""}`); }
}
// Mark all pending (incl. older stragglers) sent so they don't resend.
DB.markDispatched(pending.map(p => p.slug), iso);
console.log(`[dispatch] done — ${ok} sent, ${fail} failed.`);
process.exit(fail > 0 ? 1 : 0);
