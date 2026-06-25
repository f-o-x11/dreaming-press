#!/usr/bin/env node
// check-freshness.js — surface the evergreen demand pages that are decaying by AGE,
// so the newsroom routine can do the single highest-ROI SEO chore on a large
// corpus: refresh the stalest money page each run instead of only ever adding new
// ones. (Wirecutter/NYT/HubSpot/Ahrefs all run a "content decay" refresh loop — a
// 200-piece comparison backlog loses rankings to fresher competitors unless old
// pages are periodically re-checked and re-stamped.)
//
//   node scripts/check-freshness.js              # full ranked staleness queue
//   node scripts/check-freshness.js --top 10     # just the 10 stalest
//   node scripts/check-freshness.js --stale 90   # custom staleness threshold (days)
//
// This is the companion to check-content's `revisit:` advisory, which only fires
// for TIMELY news pieces that manually opted in. Freshness here is AUTOMATIC and
// covers the evergreen demand corpus that never opts in: a piece's clock is its
// `updated:` stamp if present (a refresh resets decay), else its `date:`. The tool
// is purely advisory — it never gates a build or exits non-zero — it just tells the
// routine which page is bleeding the most rank so a refresh can be targeted, not
// guessed. The core is pure (`today` is passed in) so it's testable without a clock.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "../lib/markdown.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");
const CONTENT = path.join(REPO, "content", "posts");

// strip a leading YYYY-MM-DD- date prefix from a slug (mirrors check-content/db).
const stripDate = (s) => s.replace(/^\d{4}-\d\d-\d\d-/, "");

// Whole-day distance between two ISO (YYYY-MM-DD) dates, `to` minus `from`. Pure
// and clock-free: parses at UTC midnight so DST/timezones can't shift the count.
// Returns null if either date is missing or malformed, so a bad date never
// fabricates an age (it's simply skipped from the report rather than ranked as
// infinitely stale).
export function daysBetween(from, to) {
  const iso = /^(\d{4})-(\d\d)-(\d\d)$/;
  const a = iso.exec(String(from || "")), b = iso.exec(String(to || ""));
  if (!a || !b) return null;
  const ms = Date.UTC(+b[1], +b[2] - 1, +b[3]) - Date.UTC(+a[1], +a[2] - 1, +a[3]);
  return Math.round(ms / 86400000);
}

// A demand piece is a Wire/Stack comparison — the same definition check-content
// uses (section wire/stack AND a `compare:` table or a `…-vs-…` slug). These are
// the evergreen money pages whose rankings decay; opinion Dispatches and timely
// news are deliberately out of scope (news uses the `revisit:` advisory instead).
function isDemandPiece(file, fm, raw) {
  const section = (fm.section || "").trim();
  if (section !== "wire" && section !== "stack") return false;
  return /^compare:/m.test(raw) || /-vs-/.test(file);
}

// The date a piece's freshness clock runs from: its `updated:` stamp if it carries
// a valid one (a refresh resets the clock), otherwise its `date:`. Returns
// { date, updated } where `updated` is whether the stamp won. A missing/blank
// `updated:` falls back to `date:` so an un-refreshed piece ages from publication.
export function freshnessDate(fm) {
  const iso = /^\d{4}-\d\d-\d\d$/;
  const pub = (fm.date || "").trim();
  const upd = (fm.updated || "").trim();
  if (iso.test(upd)) return { date: upd, updated: true };
  return { date: pub, updated: false };
}

// Rank the demand corpus by staleness. `posts` is [{file, raw}]; `today` is an ISO
// date. Returns the pieces at or past `staleDays` of age, oldest first, each tagged
// `critical` (≥ criticalDays) or `stale`. Pure — no fs, no clock — so it unit-tests
// cleanly. A piece with an unparseable freshness date is skipped (age null), never
// ranked as max-stale, so a typo can't dominate the queue.
export function freshnessReport(posts, today, opts = {}) {
  const staleDays = opts.staleDays ?? 120;
  const criticalDays = opts.criticalDays ?? 240;
  const rows = [];
  for (const { file, raw } of posts) {
    const { fm } = parseFrontmatter(raw);
    if (!isDemandPiece(file, fm, raw)) continue;
    const { date, updated } = freshnessDate(fm);
    const ageDays = daysBetween(date, today);
    if (ageDays == null || ageDays < staleDays) continue;
    rows.push({
      file,
      slug: stripDate(file.replace(/\.md$/, "")),
      freshnessDate: date,
      updated,
      ageDays,
      tier: ageDays >= criticalDays ? "critical" : "stale",
    });
  }
  rows.sort((a, b) => b.ageDays - a.ageDays || a.file.localeCompare(b.file));
  return rows;
}

function main() {
  const argv = process.argv.slice(2);
  const flag = (k, d) => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : d; };
  const staleDays = parseInt(flag("stale", "120"), 10);
  const criticalDays = parseInt(flag("critical", "240"), 10);
  const top = argv.includes("--top") ? parseInt(flag("top", "10"), 10) : Infinity;
  const today = new Date().toISOString().slice(0, 10);

  const files = fs.existsSync(CONTENT) ? fs.readdirSync(CONTENT).filter((f) => f.endsWith(".md")) : [];
  const posts = files.map((f) => ({ file: f, raw: fs.readFileSync(path.join(CONTENT, f), "utf8") }));
  const report = freshnessReport(posts, today, { staleDays, criticalDays });

  // count the demand corpus for context (how much of it is going stale).
  const demandTotal = posts.filter(({ file, raw }) => isDemandPiece(file, parseFrontmatter(raw).fm, raw)).length;

  const critical = report.filter((r) => r.tier === "critical").length;
  console.log(`▸ freshness — ${demandTotal} demand pieces, ${report.length} stale (≥${staleDays}d), ${critical} critical (≥${criticalDays}d) — as of ${today}`);
  if (!report.length) {
    console.log("✓ no demand page is past the staleness threshold.");
    return;
  }
  const shown = report.slice(0, top);
  for (const r of shown) {
    const mark = r.tier === "critical" ? "‼" : "⟳";
    const stamp = r.updated ? `updated ${r.freshnessDate}` : `published ${r.freshnessDate}`;
    console.log(`  ${mark} ${r.ageDays}d  ${r.slug}  (${stamp})`);
  }
  if (report.length > shown.length) console.log(`  … and ${report.length - shown.length} more (drop --top to see all)`);
  console.log(`\n  Refresh the stalest: re-verify its facts/sources against current docs, tighten where the field moved, and stamp 'updated: ${today}' to reset its clock and emit a fresh dateModified.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
