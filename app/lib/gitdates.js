// gitdates.js — map each content file to the date of its last *focused* edit, so
// ingest can populate `updated` automatically and HONESTLY. The freshness signal
// (an on-page "Updated <date>" line + `dateModified` in the NewsArticle JSON-LD) is
// wired end to end in render.js but was dark: `updated` only ever came from a
// frontmatter key authors never set. Wirecutter/Verge/NYT surface an accurate
// "Updated" date on evergreen guides — a real CTR + freshness signal for "best X"
// queries — and git records when each piece last changed.
//
// The trap a naive "last commit that touched the file" map falls into: a single
// site-wide maintenance sweep (a reformat, an entity-decode pass, a backfill) touches
// dozens of files in one commit, so EVERY page would suddenly claim the same "Updated"
// date — uniform, meaningless, and the kind of freshness inflation search engines
// discount. So we only count a *focused* commit: one that touched at most
// FOCUSED_MAX content files, i.e. a deliberate revision of that piece, not a sweep.
//
// Degrades to an empty map (NOT a throw) if git is unavailable, so a non-repo build
// falls back to the prior frontmatter-only behavior — zero regression.
import { execFileSync } from "node:child_process";
import path from "node:path";

// A commit touching more content files than this is treated as a maintenance sweep,
// not a per-piece update, and does not move any file's "Updated" date.
const FOCUSED_MAX = 4;

// Returns Map<basename, "YYYY-MM-DD"> of the most-recent *focused* commit date per
// content file. `git log` is newest-first, so the first focused commit we see for a
// file is its last genuine revision.
export function lastModifiedDates(repo, dirs = ["content/posts", "posts"]) {
  const map = new Map();
  try {
    const out = execFileSync(
      "git",
      ["log", "--date=short", "--format=%x01%cd", "--name-only", "--", ...dirs],
      { cwd: repo, encoding: "utf8", maxBuffer: 128 * 1024 * 1024 }
    );
    // Split into commit records on the \x01 sentinel so we can size each commit
    // (how many content files it touched) before deciding whether it counts.
    for (const rec of out.split("\x01")) {
      const lines = rec.split("\n");
      const date = (lines.shift() || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const files = lines.map((l) => l.trim()).filter(Boolean);
      if (files.length === 0 || files.length > FOCUSED_MAX) continue; // skip sweeps
      for (const f of files) {
        const base = path.basename(f);
        if (!map.has(base)) map.set(base, date); // newest focused commit wins
      }
    }
  } catch {
    // git missing / not a repo / shallow with no history → empty map, caller falls back
  }
  return map;
}

// Resolve the `updated` value for one file: an explicit frontmatter `updated:` wins
// (author override, honored even if it predates publish), else the focused git date
// but ONLY when it is strictly after the published date — so a brand-new piece
// (committed the day it's published) and same-day edits stay unmarked, and a clock
// skew / rebase can never surface an "Updated" date that's earlier than publication.
export function resolveUpdated(fmUpdated, publishDate, gitDate) {
  const explicit = (fmUpdated || "").trim();
  if (explicit) return explicit;
  if (gitDate && publishDate && gitDate > publishDate) return gitDate;
  return "";
}
