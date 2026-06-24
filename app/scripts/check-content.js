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

// Count the rows in a `compare:` frontmatter line — `;;`-separated rows, the same
// split ingest.js/render.js use to build the "At a glance" table. Returns the
// number of non-empty rows (header included), so ≥2 means a header plus real data.
function compareRowCount(raw) {
  const m = /^compare:\s*(.+)$/m.exec(raw);
  if (!m) return 0;
  return m[1].split(";;").map((r) => r.trim()).filter(Boolean).length;
}

// strip a leading YYYY-MM-DD- date prefix — the corpus mixes bare slugs
// (`langgraph-vs-crewai`) with date-prefixed ones (`2026-06-23-…`), and a piece's
// IDENTITY for link-resolution is its date-stripped slug (mirrors db.resolveSlug).
const stripDate = (s) => s.replace(/^\d{4}-\d\d-\d\d-/, "");

// ── near-duplicate slug guard ───────────────────────────────────────────────
// Two Wire/Stack pieces aimed at the SAME query cannibalize each other — the
// council audit's exact warning. The slug is the cleanest topic signal: strip
// the non-topical scaffolding ("vs", "for", "the", "ai", "agents", "llm", the
// year, "best"…) and what's left is the subject. If a NEW piece's subject tokens
// nearly match an existing piece's, it's a duplicate in search-intent even when
// the prose differs. Caught two real near-clones the day this shipped
// (llm-as-a-judge / -evaluation; human-in-the-loop-ai-agents vs
// how-to-add-human-in-the-loop-to-an-ai-agent), both authored hours apart.
const SLUG_STOPWORDS = new Set([
  "vs", "for", "the", "a", "an", "to", "of", "in", "on", "and", "or", "with",
  "your", "you", "how", "what", "why", "when", "is", "are", "do", "does", "be",
  "ai", "agent", "agents", "llm", "llms", "model", "models", "2026", "2025",
  "best", "choosing", "choose", "guide", "using", "use", "explained", "actually",
]);

// the topical tokens of a (date-stripped) slug — the subject, minus scaffolding.
export function contentTokens(slug) {
  return new Set(
    stripDate(String(slug)).split("-")
      .filter((t) => t.length > 1 && !/^\d+$/.test(t) && !SLUG_STOPWORDS.has(t))
  );
}

// do two subject-token sets describe the same piece? Two complementary signals:
//   • Jaccard ≥ 0.7 — the sets are mostly the same tokens, OR
//   • one set ⊆ the other and they differ by ≤ 1 token — the classic "same slug
//     plus a qualifier" clone (judge ⊂ judge+evaluation; human+loop ⊂ add+human+loop).
// Both sets must be non-empty (an all-scaffolding slug is unjudgeable → skip).
export function nearDuplicate(a, b) {
  if (!a.size || !b.size) return false;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  const jaccard = inter / union;
  const subset = inter === a.size || inter === b.size;        // one contained in the other
  const symDiff = union - inter;
  return jaccard >= 0.7 || (subset && symDiff <= 1);
}

// Internal /posts/<slug>.html|.md links that resolve to NO real post. The server
// 301-canonicalizes between the bare and dated forms of the same piece, so a link
// only truly 404s when its date-stripped slug matches nothing in the corpus — a
// typo'd or hallucinated sibling link. `validSlugs` is the set of date-stripped
// post slugs; when absent (a piece audited in isolation, e.g. unit tests) the
// check is skipped rather than firing false positives. Returns the raw, unresolved
// slugs (deduped). See FIXES 2026-06-23: 30 dead cross-links once shipped on the
// money pages the internal-link engine (#15/#29) depends on.
function deadInternalLinks(body, validSlugs) {
  if (!validSlugs) return [];
  const dead = [];
  for (const m of body.matchAll(/\]\(\/posts\/([a-z0-9-]+)\.(?:html|md)(?:#[^)]*)?\)/g)) {
    if (!validSlugs.has(stripDate(m[1]))) dead.push(m[1]);
  }
  return [...new Set(dead)];
}

// The checklist. Each rule returns null (pass) or a short reason (fail).
export function auditPiece(file, raw, validSlugs = null) {
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
    // an at-a-glance comparison table (the Wirecutter/Verge versus pattern) is the
    // single most snippet-winning element for "X vs Y" queries — render.js builds it
    // from a `compare:` line (`;;`-separated rows, first row = header). Require a
    // header + at least one data row so the table is real, not a stub.
    if (compareRowCount(raw) < 2) errors.push("missing compare: at-a-glance table (header + ≥1 row; featured-snippet bait for versus queries)");
  }

  // Any section: an internal /posts/ link that resolves to no real post is a hard
  // 404 on a published page — caught only when the corpus slug-set is supplied.
  for (const s of deadInternalLinks(body, validSlugs)) {
    errors.push(`dead internal link /posts/${s} (resolves to no post)`);
  }

  return { file, section, date: (fm.date || "").trim(), demand, errors };
}

export function auditContent(dir = CONTENT) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort() : [];
  // the identities every piece may link to: the date-stripped slug of each post,
  // so an internal /posts/ link can be validated against what actually exists.
  const validSlugs = new Set(files.map((f) => stripDate(f.replace(/\.md$/, ""))));
  return files.map((f) => auditPiece(f, fs.readFileSync(path.join(dir, f), "utf8"), validSlugs));
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

// For each changed Wire/Stack file, the existing piece (if any) it near-duplicates
// in search-intent. Relational by nature — a piece is only a "duplicate" relative
// to the rest of the corpus — so this runs on the run's slate against EVERYTHING
// already there, never pairwise across the grandfathered backlog (which legitimately
// holds adjacent pairs like prompt-caching / prefix-caching-vs-prompt-caching).
// Returns [{ file, dupOf }]; empty when git/dir is unavailable so it degrades to a no-op.
export function duplicateWarnings(changed, dir = CONTENT) {
  if (!changed || !changed.size || !fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  // index the demand corpus (Wire/Stack only — where cannibalization costs rankings)
  const index = [];
  for (const f of files) {
    const { fm } = parseFrontmatter(fs.readFileSync(path.join(dir, f), "utf8"));
    const section = (fm.section || "").trim();
    if (section !== "wire" && section !== "stack") continue;
    index.push({ file: f, slug: stripDate(f.replace(/\.md$/, "")), tokens: contentTokens(f.replace(/\.md$/, "")) });
  }
  const warnings = [];
  for (const file of changed) {
    const self = index.find((e) => e.file === file);
    if (!self) continue;                       // changed file isn't a Wire/Stack piece
    const dup = index.find((e) => e.file !== self.file && e.slug !== self.slug && nearDuplicate(self.tokens, e.tokens));
    if (dup) warnings.push({ file, dupOf: dup.file });
  }
  return warnings;
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const onlyChanged = args.includes("--changed");
  const results = auditContent();
  const changed = onlyChanged ? changedContentFiles() : null;
  const dups = onlyChanged ? duplicateWarnings(changed) : [];

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

  // near-duplicate guard (changed-mode only): a new piece must not cannibalize an
  // existing one's search intent.
  for (const d of dups) console.log(`  ✗ ${d.file}\n      - near-duplicate of ${d.dupOf} (same search intent — consolidate or differentiate the slug)`);

  if (strict && failed.length) { console.error("\n✗ --strict: standard not met across the corpus."); process.exit(1); }
  if (onlyChanged && (changedFailures.length || dups.length)) { console.error("\n✗ --changed: this run is about to ship pieces below standard — fix before commit."); process.exit(1); }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
