// notify-agents.js — push new posts to registered agent webhooks.
// Runs on the server after ingest (server-pull-deploy.sh), mirroring
// send-dispatch.js for email. INERT when there are no webhook subscriptions.
//
// First run seeds the existing backlog as already-dispatched, so a webhook
// registered later never gets blasted with the whole archive — it only receives
// genuinely new posts (and can always poll /feed.json?since= for history).
//
//   node scripts/notify-agents.js [--dry]
import * as DB from "../lib/db.js";
import { isSafeWebhookUrl, webhookPayload } from "../lib/agent-subs.js";

const DRY = process.argv.includes("--dry");
const TIMEOUT_MS = 8000;

async function postWebhook(url, body) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "dreaming.press-agent-notify/1" },
      body: JSON.stringify(body), signal: ctl.signal,
    });
    return { ok: r.ok, status: r.status };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  } finally { clearTimeout(t); }
}

async function main() {
  const d = DB.db();
  const now = new Date().toISOString();

  // 1. Seed backlog on first run (never blast the archive).
  if (!DB.agentDispatchSeeded(d)) {
    const all = DB.allPosts(d).map((p) => p.slug);
    if (!DRY) DB.markAgentDispatched(all, now, d);
    console.log(`notify-agents: seeded ${all.length} existing posts as dispatched (first run)`);
    return;
  }

  const hooks = DB.activeAgentWebhooks(d);
  const fresh = DB.agentUndispatchedPosts(d);
  if (!hooks.length) {
    // no webhooks yet — still mark fresh posts dispatched so a future webhook
    // starts clean (gets only posts published after it registers).
    if (fresh.length && !DRY) DB.markAgentDispatched(fresh.map((p) => p.slug), now, d);
    console.log(`notify-agents: no webhooks; marked ${fresh.length} new post(s) as dispatched.`);
    return;
  }
  if (!fresh.length) { console.log("notify-agents: nothing new to deliver."); return; }

  console.log(`notify-agents: ${fresh.length} new post(s) → ${hooks.length} webhook(s)${DRY ? " [dry]" : ""}`);
  for (const h of hooks) {
    if (!isSafeWebhookUrl(h.endpoint)) { console.log(`  skip unsafe ${h.endpoint}`); continue; }
    const secs = h.sections ? h.sections.split(",") : null;
    const items = secs ? fresh.filter((p) => secs.includes(p.section)) : fresh;
    if (!items.length) { if (!DRY) DB.markAgentSubNotified(h.id, now, d); continue; }
    if (DRY) { console.log(`  would POST ${items.length} to ${h.endpoint}`); continue; }
    const r = await postWebhook(h.endpoint, webhookPayload(items, h));
    if (r.ok) { DB.markAgentSubNotified(h.id, now, d); console.log(`  ✓ ${h.endpoint} (${items.length} items, ${r.status})`); }
    else { const b = DB.bumpAgentSubFailure(h.id); console.log(`  ✗ ${h.endpoint} (${r.status || r.error})${b.deactivated ? " — deactivated after repeated failures" : ""}`); }
  }
  // mark the batch delivered (best-effort broadcast; a hook down now can poll later)
  if (!DRY) DB.markAgentDispatched(fresh.map((p) => p.slug), now, d);
}

main().catch((e) => { console.error("notify-agents failed:", e); process.exit(0); });
