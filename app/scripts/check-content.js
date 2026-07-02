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
import { parseFrontmatter, splitCells } from "../lib/markdown.js";
import { ARCHETYPE_NAMES, MOOD_NAMES } from "../lib/artspec.js";
import { clusterLabelFor, COMPARISON_CATCHALL } from "../lib/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");
const CONTENT = path.join(REPO, "content", "posts");

// A demand piece is a Wire/Stack piece written to rank for a real search query, so
// it owes the full rich-result kit (summary/faq/compare/art/internal-link). Detect it
// the SAME way the cluster engine's isComparisonPost (lib/db.js) does, so the two
// surfaces can never disagree: a piece that earns a topic-cluster home + a sibling rail
// must also meet the SEO-completeness standard. (Before this, `best-`/`how-to-` slugs
// were homed in clusters by db.js yet escaped this gate — a real inconsistency the
// `opentelemetry-genai-semantic-conventions` run flagged.) The signals:
//   • a `compare:` table — the unambiguous at-a-glance demand element; OR
//   • a query-shaped slug — a "…-vs-…" comparison, a "best-…" guide, or a "how-to-…"
//     guide (the exact decision/guide vocabulary db.js admits, where the desk's
//     metaphorical essay slugs — "the-megawatt-you-cannot-rent" — carry none); OR
//   • a `faq:` block — a People-Also-Ask play an essay never writes, so it's the safe
//     tell that a TOPIC-LED piece (council #14 leads the headline with the value, NOT
//     "X vs Y", so a genuine demand piece's slug needn't be a query) is in fact chasing
//     search and owes the rest of the kit. Corpus-validated (366 Wire/Stack posts): every
//     faq-bearing piece that previously escaped this gate is a real demand piece
//     (llm-as-a-judge, semantic-caching-for-ai-agents, how-to-*-mcp-server, best-*-for-rag)
//     and ZERO are metaphorical essays — those carry only a `summary:` takeaway, never a faq.
// Opinion Dispatches are excluded by section (a "vs" prose title isn't a demand piece).
// A pure-prose topic-led piece with NONE of these signals is structurally indistinguishable
// from a desk essay, so it deliberately stays author-discipline — broadening further would
// start flagging the council-voice essays. `--changed` grandfathers committed pieces, so
// this only ever raises the bar for a run's NEW pieces.
function isDemandPiece(file, fm, raw) {
  const section = (fm.section || "").trim();
  if (section !== "wire" && section !== "stack") return false;
  const slug = file.replace(/^\d{4}-\d\d-\d\d-/, "").replace(/\.md$/, "");
  return /^compare:/m.test(raw)
    || /(^|-)vs(-|$)/.test(slug) || slug.startsWith("best-") || slug.startsWith("how-to-")
    || /^faq:\s*\S/m.test(raw);
}

// Count the rows in a `compare:` frontmatter line — `;;`-separated rows, the same
// split ingest.js/render.js use to build the "At a glance" table. Returns the
// number of non-empty rows (header included), so ≥2 means a header plus real data.
function compareRowCount(raw) {
  const m = /^compare:\s*(.+)$/m.exec(raw);
  if (!m) return 0;
  return m[1].split(";;").map((r) => r.trim()).filter(Boolean).length;
}

// A `compare:` table renders as <th>/<td> cells split on UNescaped pipes (the same
// splitCells() ingest.js/render.js use). render.js builds the header from row 0 and
// a <tr> per data row, so a row with a different cell count than the header renders
// a silently MISALIGNED table on the money page — the single most snippet-winning
// element for versus queries. The classic cause is a `;;` row separator typed as a
// lone ` | `, fusing two rows into one over-wide row (caught a live 4-vs-8 break in
// ap2-vs-x402-vs-acp on the day this shipped). compareRowCount only counts rows, so
// it can't see this. Returns the first offending {row, cells, expected}, else null.
export function compareColumnMismatch(raw) {
  const m = /^compare:\s*(.+)$/m.exec(raw);
  if (!m) return null;
  const rows = m[1].split(";;").map((r) => r.trim()).filter(Boolean);
  if (rows.length < 2) return null;            // needs a header + ≥1 data row to compare
  const expected = splitCells(rows[0]).length; // the header sets the column count
  for (let i = 1; i < rows.length; i++) {
    const cells = splitCells(rows[i]).length;
    if (cells !== expected) return { row: i + 1, cells, expected };
  }
  return null;
}

// A `faq:` line is `Question? | Answer ;; Question? | Answer` and powers BOTH an
// on-page accordion and the FAQPage JSON-LD that wins People-Also-Ask real estate.
// ingest.js parses it leniently — `if (i < 0) continue` drops a pair with no pipe,
// and `if (q && aTxt)` drops a pair with an empty half — so a malformed entry does
// not error, it SILENTLY VANISHES from the schema (e.g. a `;;` typed as a single
// `;`, fusing two pairs into one over-long answer and halving your rich-result
// coverage; or a missing `|`). This is the exact silent-regression class that
// motivated compareColumnMismatch, but `faq:` had no guard. Mirrors ingest's split
// precisely so the check and the renderer agree. Returns the first offending
// {entry, reason}, else null.
export function faqMalformed(raw) {
  const m = /^faq:\s*(.+)$/m.exec(raw);
  if (!m) return null;
  const pairs = m[1].split(";;").map((p) => p.trim()).filter(Boolean);
  for (const pair of pairs) {
    const i = pair.indexOf("|");
    if (i < 0) return { entry: pair, reason: "no | separating question from answer (this Q&A is dropped from the FAQ + schema)" };
    const q = pair.slice(0, i).trim(), ans = pair.slice(i + 1).trim();
    if (!q) return { entry: pair, reason: "empty question before the | (dropped from the FAQ + schema)" };
    if (!ans) return { entry: pair, reason: "empty answer after the | (dropped from the FAQ + schema)" };
  }
  return null;
}

// A `figures:` line is `stat | label ;; stat | label` and renders the FT/Bloomberg
// "By the numbers" stat strip (an oversized display stat over a mono caption).
// ingest.js parses it leniently — `f.split("|")` then `if (stat && stat.trim())` —
// so a malformed entry does NOT error, it silently DEGRADES: an entry with an empty
// stat half (a stray `;;` or a leading `|`) is dropped from the strip entirely, and
// an entry with no `|` renders a naked number with a blank caption (render.js omits
// the empty <figcaption>) — a stat the reader can't interpret. Same silent-regression
// class as faqMalformed/compareColumnMismatch, but `figures:` had no guard. Mirrors
// ingest's first-`|` split so the check and the renderer agree (a later `|` inside the
// label is fine). Returns the first offending {entry, reason}, else null.
export function figuresMalformed(raw) {
  const m = /^figures:\s*(.+)$/m.exec(raw);
  if (!m) return null;
  const entries = m[1].split(";;").map((e) => e.trim()).filter(Boolean);
  for (const entry of entries) {
    const i = entry.indexOf("|");
    if (i < 0) return { entry, reason: "no | separating stat from label (renders a naked stat with a blank caption)" };
    const stat = entry.slice(0, i).trim(), label = entry.slice(i + 1).trim();
    if (!stat) return { entry, reason: "empty stat before the | (this figure is dropped from the By-the-numbers strip)" };
    if (!label) return { entry, reason: "empty label after the | (renders a stat with no caption)" };
  }
  return null;
}

// A `sources:` line is `url | label ;; url | label` and is the REQUIRED evidence
// line for every Wire/Stack piece (AGENTS.md house rule) — it powers the numbered
// references list AND the inline citation markers (render.js citeLinks matches a
// body link's href to a source URL). ingest.js parses it leniently — it splits on
// `;;`, takes the part before the FIRST `|` as the url, and `if (url && url.trim())`
// DROPS any entry whose url is empty — so a malformed entry does not error, it
// SILENTLY VANISHES from the references + breaks any citation that pointed at it.
// Two silent-loss signatures, the same class as faqMalformed/figuresMalformed:
//   • a content-bearing entry with an empty url before the `|` (a `;;` typed as a
//     lone `|`, or a leading `|`) — ingest drops the whole source.
//   • a URL inside the LABEL half (`://`) — the classic `;;` row break typed as a
//     single `;`, which fuses two sources into one entry so the second URL leaks
//     into the first's label and is lost from the list (labels are human text, so
//     a `://` in a label is reliably this bug, not legitimate prose).
// A trailing/empty `;;` chunk is harmless (ingest skips it) so it's NOT flagged,
// and an entry with no `|` is a SUPPORTED form (label defaults to the url), so it's
// not flagged either — the check mirrors ingest's actual behavior exactly. Returns
// the first offending {entry, reason}, else null.
export function sourcesMalformed(raw) {
  const m = /^sources:\s*(.+)$/m.exec(raw);
  if (!m) return null;
  for (const entry of m[1].split(";;")) {
    if (!entry.trim()) continue;                 // empty/trailing chunk — ingest skips it, no loss
    const i = entry.indexOf("|");
    const url = (i < 0 ? entry : entry.slice(0, i)).trim();
    const label = i < 0 ? "" : entry.slice(i + 1).trim();
    if (!url) return { entry: entry.trim(), reason: "empty url before the | (this source is dropped from the references list and any inline citation pointing to it breaks)" };
    if (/:\/\//.test(label)) return { entry: entry.trim(), reason: "a URL appears in the label half (a ';;' source break typed as a single ';'? the two sources are fused and the second is lost)" };
  }
  return null;
}

// The generative cover honors an explicit `art:` block ONLY when its archetype/mood
// name a real key — artspec (deriveArtSpec) silently reverts to the heuristic cover
// otherwise. So a typo (`archetype: divisn`, `mood: clod`) ships a piece whose
// deliberately art-directed cover quietly collapses to the section default: the same
// silent-degradation class as faqMalformed/sourcesMalformed, on the one frontmatter
// field AGENTS.md tells the routine to choose with intent ("the archetype whose FORM
// embodies the idea"). Parse the block EXACTLY as gen-art's readArtSpec does — inline
// JSON `art: {…}` or an indented block that stops at the first non-indented line — and
// flag an archetype/mood that isn't a valid key. The valid sets are imported from
// artspec so there's a single source of truth and no drift. motif/hue/density are
// free-form and not validated. Returns the first offending {field, value, reason}, else null.
export function artMalformed(raw) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(raw);
  if (!fm) return null;
  const lines = fm[1].split("\n");
  const i = lines.findIndex(l => /^art:\s*(\{.*\})?\s*$/.test(l));
  if (i < 0) return null;
  let art = null;
  const inline = /^art:\s*(\{.*\})\s*$/.exec(lines[i]);
  if (inline) { try { art = JSON.parse(inline[1]); } catch { return null; } }   // unparseable JSON ⇒ no spec, heuristic cover (a separate concern)
  else {
    art = {};
    for (let k = i + 1; k < lines.length; k++) {
      const m = /^[ \t]+([a-z_]+):\s*(.+?)\s*$/i.exec(lines[k]);
      if (!m) break;                                                            // first non-indented line ends the block — mirrors gen-art
      art[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  if (typeof art.archetype === "string" && art.archetype && !ARCHETYPE_NAMES.includes(art.archetype))
    return { field: "archetype", value: art.archetype, reason: `not a valid archetype, so the cover silently reverts to the section default; valid: ${ARCHETYPE_NAMES.join("|")}` };
  if (typeof art.mood === "string" && art.mood && !MOOD_NAMES.includes(art.mood))
    return { field: "mood", value: art.mood, reason: `not a valid mood, so the palette silently reverts to "stark"; valid: ${MOOD_NAMES.join("|")}` };
  return null;
}

// Timely Wire *news* pieces (unlike the evergreen "X vs Y" backlog) go stale on a
// known date — a "release candidate" explainer is wrong once the thing ships GA.
// A piece can opt into a freshness check with a `revisit: YYYY-MM-DD` frontmatter
// line; once that date is reached, this surfaces it (advisory, never gating) so a
// future run re-checks the facts and stamps `updated:`. Pure — `today` is passed
// in (YYYY-MM-DD) so it's testable without a clock and safe in any harness.
// Returns the revisit date string if the piece is due (revisit <= today), else null.
export function revisitDue(raw, today) {
  const m = /^revisit:\s*(\d{4}-\d\d-\d\d)\b/m.exec(raw);
  if (!m) return null;
  if (!/^\d{4}-\d\d-\d\d$/.test(String(today))) return null;  // no usable clock → no false alarm
  return m[1] <= today ? m[1] : null;                         // ISO dates sort lexicographically
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

// Two subject tokens count as the same when they're equal OR one is a prefix of
// the other with the shorter ≥ 4 chars. This collapses abbreviation/full-form and
// morphological variants that surface-string equality misses — `eval`⊂`evaluation`,
// `optim`⊂`optimization`, `quant`⊂`quantization` — which would otherwise sail under
// the Jaccard floor (eval/evaluation-dataset scored 0.5 and a real keyword-cannibal
// dup shipped, 2026-06-26). The ≥4 floor keeps short tokens (`rag`, `mcp`) exact so
// `rag`⊄`ragas`. Corpus-validated: flags the same 6 pairs across 397 posts as plain
// equality plus the eval/evaluation clone — zero new false positives.
function tokenMatch(x, y) {
  return x === y
    || (x.length >= 4 && y.startsWith(x))
    || (y.length >= 4 && x.startsWith(y));
}

// do two subject-token sets describe the same piece? Three complementary signals:
//   • Jaccard ≥ 0.7 — the sets are mostly the same tokens, OR
//   • one set ⊆ the other and they differ by ≤ 1 token — the classic "same slug
//     plus a qualifier" clone (judge ⊂ judge+evaluation; human+loop ⊂ add+human+loop), OR
//   • a large shared core: ≥ 3 matching tokens, Jaccard ≥ 0.6, and BOTH sides carry
//     ≥ 4 subject tokens — the "same subject, differently qualified" twin that the
//     subset rule misses when each slug adds its own qualifier (symDiff = 2).
//     Dogfooded: this run shipped and had to pull `agent-memory-without-a-vector-
//     database` (subject {memory,vector,database,without}), a clone of the existing
//     `filesystem-vs-vector-database-agent-memory` ({filesystem,vector,database,memory})
//     — inter 3, Jaccard 0.6, so it cleared the two rules above. Corpus-calibrated
//     across 444 Wire/Stack posts: this branch flags exactly 3 more pairs than the
//     first two, ALL genuine same-subject dups (embedding-quantization ×2, kv-cache-
//     quantization, mcp-stateless), and ZERO false positives. The min-4 floor is what
//     buys that: it drops the asymmetric adjacents (a 3-token side like
//     `how-to-evaluate-a-deep-research-agent` vs `gpt-researcher-vs-open-deep-research`)
//     that share a core but aim at a different query.
// Both sets must be non-empty (an all-scaffolding slug is unjudgeable → skip).
export function nearDuplicate(a, b) {
  if (!a.size || !b.size) return false;
  let inter = 0;
  for (const t of a) { for (const u of b) if (tokenMatch(t, u)) { inter++; break; } }
  const union = a.size + b.size - inter;
  const jaccard = inter / union;
  const subset = inter === a.size || inter === b.size;        // one contained in the other
  const symDiff = union - inter;
  const sharedCore = inter >= 3 && jaccard >= 0.6 && Math.min(a.size, b.size) >= 4;
  return jaccard >= 0.7 || (subset && symDiff <= 1) || sharedCore;
}

// Internal /posts/<slug> links that resolve to NO real post. The server
// 301-canonicalizes between the bare and dated forms of the same piece, so a link
// only truly 404s when its date-stripped slug matches nothing in the corpus — a
// typo'd or hallucinated sibling link. The extension is optional: the house style
// links both the indexable `/posts/<slug>.html|.md` forms AND the extension-less
// `/posts/<slug>` form (server.js 301-redirects the bare form to canonical .html
// when it resolves, and hard-404s when it does not) — so the bare form must be
// validated too, or a dead extension-less cross-link ships unseen. `validSlugs` is
// the set of date-stripped post slugs; when absent (a piece audited in isolation,
// e.g. unit tests) the check is skipped rather than firing false positives. Returns
// the raw, unresolved slugs (deduped). See FIXES 2026-06-23: 30 dead cross-links
// once shipped on the money pages the internal-link engine (#15/#29) depends on.
function deadInternalLinks(body, validSlugs) {
  if (!validSlugs) return [];
  const dead = [];
  for (const m of body.matchAll(/\]\(\/posts\/([a-z0-9-]+)(?:\.(?:html|md))?(?:#[^)]*)?\)/g)) {
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

  // Any piece carrying a compare: table (demand or not) must keep every row the
  // same width as the header, or it renders a misaligned <th>/<td> table.
  const mismatch = compareColumnMismatch(raw);
  if (mismatch) errors.push(`compare: table column mismatch — row ${mismatch.row} has ${mismatch.cells} cells, header has ${mismatch.expected} (a lone " | " where a ";;" row break belongs?)`);

  // Any piece carrying a faq: line must keep every Q&A parseable, or ingest
  // silently drops it from the on-page FAQ and the FAQPage rich-result schema.
  const badFaq = faqMalformed(raw);
  if (badFaq) errors.push(`faq: malformed entry — ${badFaq.reason}: "${badFaq.entry.slice(0, 60)}${badFaq.entry.length > 60 ? "…" : ""}"`);

  // Any piece carrying a figures: line must keep every stat|label pair well-formed,
  // or the rendered "By the numbers" strip silently drops or de-captions a figure.
  const badFig = figuresMalformed(raw);
  if (badFig) errors.push(`figures: malformed entry — ${badFig.reason}: "${badFig.entry.slice(0, 60)}${badFig.entry.length > 60 ? "…" : ""}"`);

  // Any piece carrying a sources: line must keep every url|label pair parseable, or
  // ingest silently drops the source from the references list and breaks the inline
  // citation that pointed at it (Wire/Stack require sources, so this is high-stakes).
  const badSrc = sourcesMalformed(raw);
  if (badSrc) errors.push(`sources: malformed entry — ${badSrc.reason}: "${badSrc.entry.slice(0, 60)}${badSrc.entry.length > 60 ? "…" : ""}"`);

  // Any piece with an explicit art: block must name a real archetype/mood, or the
  // art-directed cover silently reverts to the heuristic default (a typo defeats the
  // whole point of choosing the form that embodies the idea).
  const badArt = artMalformed(raw);
  if (badArt) errors.push(`art: invalid ${badArt.field} "${badArt.value}" — ${badArt.reason}`);

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

// ── subject-proximity advisory (NOT a gate) ─────────────────────────────────
// `duplicateWarnings`/`nearDuplicate` above key on SLUG tokens, which cleanly
// catch "same slug plus a qualifier" clones but miss same-subject pieces whose
// slugs diverge on their *qualifiers* — e.g. `how-to-migrate-embedding-models-
// in-production` vs `...-without-downtime`: one how-to on migrating embeddings,
// but Jaccard 0.5 (under the 0.7 floor) so the gate stays silent. A corpus scan
// showed no token-set threshold separates that pair from legitimately-adjacent
// comparison pieces (145 of 435 Wire/Stack posts share a content bigram), so a
// HARD subject gate would either miss it or flag dozens of real pieces. What DOES
// isolate it is the site's own relatedTo ranking: the twin is the single closest
// existing piece by topic-token overlap. So this is an advisory, not a gate — it
// surfaces the closest existing pieces to a changed demand piece so the writer
// confirms it isn't re-covering one of them (the check I wish this run had had).

// topic tokens over slug + title (mirrors db.topicTokens; self-contained here so
// the check has no build-DB dependency). SLUG_STOPWORDS strips the scaffolding.
export function subjectTokens(slug, title = "") {
  const raw = `${stripDate(String(slug))} ${title}`.toLowerCase();
  const out = new Set();
  for (const t of raw.match(/[a-z0-9][a-z0-9'+.-]*/g) || []) {
    const w = t.replace(/^[-'+.]+|[-'+.]+$/g, "");
    if (w.length > 2 && !SLUG_STOPWORDS.has(w)) out.add(w);
  }
  return out;
}

// Rank existing Wire/Stack pieces by how close their SUBJECT is to `seed`, using
// the exact signal db.relatedTo trusts on the live site: topic-token overlap (×6)
// dominates, then shared voice tag (×3), then same section (×1). `seed` is
// {slug, title, tags, section}; `tags` may be a comma string or an array. Returns
// the top `k` as [{ file, slug, score }] (only pieces sharing ≥1 subject token,
// the seed's own slug excluded). Advisory only — nothing here fails a build.
export function closestExisting(seed, dir = CONTENT, k = 3) {
  if (!fs.existsSync(dir)) return [];
  const seedSlug = stripDate(String(seed.slug || ""));
  const seedTok = subjectTokens(seed.slug || "", seed.title || "");
  if (!seedTok.size) return [];
  const seedTags = new Set(
    (Array.isArray(seed.tags) ? seed.tags : String(seed.tags || "").split(","))
      .map((t) => String(t).trim().toLowerCase()).filter(Boolean));
  const scored = [];
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const { fm } = parseFrontmatter(fs.readFileSync(path.join(dir, f), "utf8"));
    const section = (fm.section || "").trim();
    if (section !== "wire" && section !== "stack") continue;
    const slug = stripDate(f.replace(/\.md$/, ""));
    if (slug === seedSlug) continue;                 // never rank a piece against itself
    const tok = subjectTokens(f.replace(/\.md$/, ""), fm.title || "");
    let overlap = 0; for (const w of tok) if (seedTok.has(w)) overlap++;
    if (!overlap) continue;
    let shared = 0;
    for (const t of String(fm.tags || "").split(",").map((x) => x.trim().toLowerCase())) {
      if (t && seedTags.has(t)) shared++;
    }
    scored.push({ file: f, slug, score: overlap * 6 + shared * 3 + (section === seed.section ? 1 : 0) });
  }
  // stable by score desc, then slug for a deterministic tie order
  return scored.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug)).slice(0, Math.max(0, k));
}

// Cluster-orphan guard (changed-mode only): a new demand piece that the cluster
// engine (db.clusterLabelFor) buckets into the "More comparisons" CATCH-ALL ships
// with no indexable cluster page and no sibling rail — the exact #15/#29 silent
// degradation the topic-cluster engine exists to prevent, and the failure mode every
// recent run has had to catch by hand (then add a bounded token to the cluster regex).
// This automates that check: it calls the SAME clusterLabelFor the /comparisons hub
// and the on-article rail use, so the gate and the live site can never disagree about
// whether a piece is homed. A piece is only flagged if clusterLabelFor considers it a
// comparison post AND lands it in the catch-all — non-comparison posts return null and
// are ignored, and legacy catch-all pieces are grandfathered (changed-only gate).
// Returns [{ file, label }]; empty when the dir is unavailable so it degrades to a no-op.
export function orphanWarnings(changed, dir = CONTENT) {
  if (!changed || !changed.size || !fs.existsSync(dir)) return [];
  const warnings = [];
  for (const file of changed) {
    const full = path.join(dir, file);
    if (!fs.existsSync(full)) continue;            // deleted/renamed away
    const raw = fs.readFileSync(full, "utf8");
    const { fm } = parseFrontmatter(raw);
    // Build the minimal post shape clusterLabelFor reads: it strips the date from the
    // slug itself, and isComparisonPost only inspects compare.length (not contents), so
    // an array sized to the real row count is a faithful stand-in for the parsed table.
    const post = {
      slug: file.replace(/\.md$/, ""),
      section: (fm.section || "").trim(),
      compare: new Array(compareRowCount(raw)),
    };
    if (clusterLabelFor(post) === COMPARISON_CATCHALL) warnings.push({ file });
  }
  return warnings;
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const onlyChanged = args.includes("--changed");

  // Pre-write check: `--similar "<proposed title or slug>"` prints the closest
  // existing Wire/Stack pieces so a writer can confirm a topic isn't already
  // covered BEFORE drafting it (the fast path around a subject dup). Standalone —
  // returns before the full corpus audit.
  const simIdx = args.indexOf("--similar");
  if (simIdx >= 0) {
    const text = args[simIdx + 1] || "";
    const slug = text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const near = closestExisting({ slug, title: text, tags: "", section: "wire" });
    console.log(`▸ closest existing Wire/Stack pieces to "${text}":`);
    if (!near.length) { console.log("  (none share a subject token — looks novel)"); return; }
    for (const n of near) console.log(`  ~${String(n.score).padStart(3)}  ${n.slug}`);
    return;
  }

  const results = auditContent();
  const changed = onlyChanged ? changedContentFiles() : null;
  const dups = onlyChanged ? duplicateWarnings(changed) : [];
  const orphans = onlyChanged ? orphanWarnings(changed) : [];

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

  // subject-proximity advisory (changed demand pieces, never gating): the slug-token
  // dup gate can't catch a same-subject piece whose qualifiers diverge, so surface
  // the closest existing pieces by the site's own relatedTo ranking. A twin will sit
  // at the top with a clear score gap; a genuinely novel piece shows only low-score
  // neighbors. The writer confirms it isn't re-covering one of them.
  if (onlyChanged) {
    for (const r of demand.filter((x) => changed.has(x.file))) {
      const { fm } = parseFrontmatter(fs.readFileSync(path.join(CONTENT, r.file), "utf8"));
      const near = closestExisting({ slug: r.file.replace(/\.md$/, ""), title: fm.title || "", tags: fm.tags || "", section: r.section });
      if (near.length) {
        console.log(`\n▸ ${r.file} — closest existing pieces (confirm it isn't the same subject):`);
        for (const n of near) console.log(`  ~${String(n.score).padStart(3)}  ${n.slug}`);
      }
    }
  }

  // cluster-orphan guard (changed-mode only): a new comparison piece must home in a
  // real topic cluster, not the "More comparisons" catch-all (council #15/#29).
  for (const o of orphans) console.log(`  ✗ ${o.file}\n      - orphaned to the "${COMPARISON_CATCHALL}" catch-all (no cluster page or sibling rail — add a bounded token to the matching cluster regex in lib/db.js)`);

  // freshness advisory (always, never gating): timely news pieces past their
  // `revisit:` date need a facts re-check + an `updated:` stamp. ISO date so a
  // lexicographic compare is correct; no Date math needed beyond reading "today".
  const today = new Date().toISOString().slice(0, 10);
  const due = [];
  for (const f of fs.existsSync(CONTENT) ? fs.readdirSync(CONTENT).filter((f) => f.endsWith(".md")) : []) {
    const when = revisitDue(fs.readFileSync(path.join(CONTENT, f), "utf8"), today);
    if (when) due.push({ file: f, when });
  }
  if (due.length) {
    console.log(`\n▸ freshness: ${due.length} timely piece(s) past their revisit date — re-check facts and stamp updated:`);
    for (const d of due) console.log(`  ⟳ ${d.file} (revisit: ${d.when})`);
  }

  if (strict && failed.length) { console.error("\n✗ --strict: standard not met across the corpus."); process.exit(1); }
  if (onlyChanged && (changedFailures.length || dups.length || orphans.length)) { console.error("\n✗ --changed: this run is about to ship pieces below standard — fix before commit."); process.exit(1); }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
