// sync-tools.js — refresh the tools table with LIVE GitHub data (stars +
// last-push), so every Stack page carries current per-entity data (#10, and the
// unique-value requirement of Google's scaled-content policy).
//
// Uses the GitHub REST API via fetch (works on the server / cloud routine).
// Set GITHUB_TOKEN for the 5000/hr limit (else 60/hr unauthenticated). A 12h
// staleness guard means running it on every ~10-min deploy stays well under the
// rate limit — only stale tools are fetched.
//   node scripts/sync-tools.js [--force]
import { db, allTools, updateToolStars } from "../lib/db.js";

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const FORCE = process.argv.includes("--force");
const STALE_MS = 12 * 3600 * 1000;

async function stars(t) {
  const r = await fetch(`https://api.github.com/repos/${t.owner}/${t.repo}`, {
    headers: { "User-Agent": "dreaming-press-tools-sync", Accept: "application/vnd.github+json",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) },
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  return { stars: j.stargazers_count, pushed: j.pushed_at };
}

db();
let ok = 0, skip = 0, fresh = 0;
for (const t of allTools()) {
  if (!FORCE && t.synced_at && (Date.now() - Date.parse(t.synced_at) < STALE_MS)) { fresh++; continue; }
  try {
    const { stars: s, pushed } = await stars(t);
    if (s != null) { updateToolStars(t.slug, s, pushed); ok++; console.log(`✓ ${t.slug.padEnd(14)} ★${s}`); }
    else skip++;
  } catch (e) { skip++; console.log(`· ${t.slug.padEnd(14)} skipped (${String(e.message || e).slice(0, 50)})`); }
}
console.log(`synced ${ok}, skipped ${skip}, still-fresh ${fresh}`);
