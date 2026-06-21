#!/usr/bin/env node
// check-content.js — enforce the demand-piece SEO-completeness standard in CODE,
// not just in ENHANCEMENTS.md. The editorial pivot (Wire/Stack demand pieces that
// rank for real search queries) only compounds if every NEW comparison piece
// actually ships the full kit: a Smart-Brevity `summary:`, a `faq:` (→ FAQPage
// JSON-LD), real `sources:`/@repo evidence, generative `art:`, and at least one
// in-cluster internal link. Documented standards quietly regress; a check does not.
//
//   node scripts/check-content.js            # audit everything, print a report (advisory)
//   node scripts/check-content.js --strict   # exit 1 if ANY demand piece fails (full corpus)
//   node scripts/check-content.js --changed  # exit 1 only if a content file this run
//                                            # touched (uncommitted vs git) fails
//
// The `--changed` gate is what the test suite + routine use: anything already
// committed is grandfathered, but the pieces a run is about to ship are held to
// the standard. It keys off `git status`, so it isolates the current slate
// precisely (a whole day shares one `date:`, so date alone can't).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "../lib/markdown.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");
const CONTENT = path.join(REPO, "content", "posts");

// A demand piece is a Wire/Stack comparison: it either declares a `compare:`
// table or its slug reads like a versus query (…-vs-…). Opinion Dispatches with
// "vs" in the prose title are deliberately NOT caught — they aren't demand pieces.
function isDemandPiece(file, fm, raw) {
  const section = (fm.section || "").trim();
  if (section !== "wire" && section !== "stack") return false;
  return /^compare:/m.test(raw) || /-vs-/.test(file);
}

// The checklist. Each rule returns null (pass) or a short reason (fail).
export function auditPiece(file, raw) {
  const { fm, body } = parseFrontmatter(raw);
  const section = (fm.section || "").trim();
  const demand = isDemandPiece(file, fm, raw);
  const errors = [];

  // House rule (AGENTS.md): Wire & Stack are non-fiction and need evidence.
  // Stack pieces may carry their evidence as @repo{…} cards instead of a sources line.
  if (section === "wire" || section === "stack") {
    const hasSources = /^sources:\s*\S/m.test(raw);
    const hasRepoCards = /@repo\{/.test(body);
    if (!hasSources && !hasRepoCards) errors.push("no sources: line or @repo cards (Wire/Stack must cite evidence)");
  }

  if (demand) {
    if (!/^summary:\s*\S/m.test(raw)) errors.push("missing summary: (Smart-Brevity takeaway)");
    if (!/^faq:\s*\S/m.test(raw)) errors.push("missing faq: (PAA-style Q&As → FAQPage JSON-LD)");
    if (!/^art:/m.test(raw) && !/^cover:/m.test(raw)) errors.push("missing art: block (generative cover)");
    // an in-cluster internal link keeps the demand corpus woven together (council #15/#29)
    if (!/\]\(\/(posts|best|compare|stack|tools|reports)\b/.test(body)) errors.push("no in-cluster internal link (e.g. [..](/posts/..))");
  }

  return { file, section, date: (fm.date || "").trim(), demand, errors };
}

export function auditContent(dir = CONTENT) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort() : [];
  return files.map((f) => auditPiece(f, fs.readFileSync(path.join(dir, f), "utf8")));
}

// content/posts/*.md files this run has touched but not yet committed — added,
// modified, staged, or untracked. Returns a Set of basenames. Empty (not throwing)
// if git is unavailable, so the gate degrades to a no-op rather than a false alarm.
export function changedContentFiles(repo = REPO) {
  try {
    const out = execFileSync("git", ["status", "--porcelain", "--", "content/posts"], { cwd: repo, encoding: "utf8" });
    const set = new Set();
    for (const ln of out.split("\n")) {
      const m = /\.md$/.test(ln) && /content\/posts\/(.+\.md)$/.exec(ln.slice(3).trim());
      if (m) set.add(path.basename(m[1]));
    }
    return set;
  } catch { return new Set(); }
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const onlyChanged = args.includes("--changed");
  const results = auditContent();
  const changed = onlyChanged ? changedContentFiles() : null;

  const demand = results.filter((r) => r.demand);
  const failed = results.filter((r) => r.errors.length);
  const changedFailures = failed.filter((r) => changed && changed.has(r.file));

  console.log(`▸ content check — ${results.length} posts, ${demand.length} demand pieces${onlyChanged ? `, ${changed.size} changed this run` : ""}`);
  // in --changed mode show only this run's failures; otherwise show every failure
  const show = onlyChanged ? changedFailures : failed;
  if (!failed.length) {
    console.log("✓ all pieces meet the standard.");
  } else {
    for (const r of show) {
      console.log(`  ✗ ${r.file}`);
      for (const e of r.errors) console.log(`      - ${e}`);
    }
    if (onlyChanged) {
      const legacy = failed.length - changedFailures.length;
      console.log(changedFailures.length ? "" : "  ✓ this run's slate is clean.");
      console.log(`  (${changedFailures.length} below standard in this run; ${legacy} pre-existing legacy piece(s) not gated)`);
    } else {
      console.log(`\n  ${failed.filter((r) => r.demand).length} demand piece(s) below standard.`);
    }
  }

  if (strict && failed.length) { console.error("\n✗ --strict: standard not met across the corpus."); process.exit(1); }
  if (onlyChanged && changedFailures.length) { console.error("\n✗ --changed: this run is about to ship pieces below standard — fix before commit."); process.exit(1); }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
