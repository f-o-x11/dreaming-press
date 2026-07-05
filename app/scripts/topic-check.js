#!/usr/bin/env node
// topic-check.js — pre-draft saturation radar for the newsroom.
//
//   node scripts/topic-check.js "Best Vector Database for Multi-Agent Systems"
//   node scripts/topic-check.js best-vector-database-for-multi-agent-systems
//   node scripts/topic-check.js --json langgraph vs crewai for production agents
//
// The corpus is 630+ posts and exhaustively deep, so "find an uncovered demand
// topic" is now the binding constraint on every Part A run. A bare slug/keyword
// grep misses near-duplicates (this guard exists because a full Wire draft +
// cover art were once wasted on a topic already 5x covered). Given a candidate
// title or slug, this scores lexical overlap against every existing post's
// slug+title tokens (the SAME `topicTokens` used by the on-site `relatedTo`
// engine) plus its `compare:` entities, prints the closest existing pieces, and
// exits NON-ZERO with a SATURATED verdict when too many near-dupes already exist.
// Cheap, deterministic, no LLM. Run it FIRST, before writing or generating art.
//
// Exit codes: 0 = clear (write it) · 3 = crowded (differentiate) · 4 = SATURATED.
import { allPosts, topicTokens, comparedEntities } from "../lib/db.js";

const argv = process.argv.slice(2);
const JSON_OUT = argv.includes("--json");
const candidate = argv.filter((a) => a !== "--json").join(" ").trim();

if (!candidate) {
  console.error('usage: node scripts/topic-check.js [--json] "<candidate title or slug>"');
  process.exit(2);
}

// Tokenize the candidate exactly like a stored post (topicTokens keys off
// slug+title and strips the publication's generic vocab), so a candidate and a
// real post are measured on the same axis. A stored post keeps its slug as one
// hyphenated blob AND its title as individual words; a bare slug candidate has
// no title, so split hyphens/underscores to words first — otherwise the whole
// slug is a single token that only matches itself.
const norm = candidate.replace(/[-_]+/g, " ");
const cand = topicTokens({ slug: "", title: norm });
if (cand.size === 0) {
  console.error("candidate reduced to zero topic tokens (all stopwords?) — rephrase with the concrete subject.");
  process.exit(2);
}

// Overlap coefficient (shared / smaller set), NOT Jaccard: a short, sharply
// scoped candidate ("langgraph vs crewai") should score ~1.0 against a longer
// existing title that contains it, rather than being diluted by the longer
// title's extra tokens. That's the failure mode we're guarding — a new piece
// whose whole subject is a subset of an existing one.
function overlap(aSet, bSet) {
  if (!aSet.size || !bSet.size) return 0;
  let shared = 0;
  const [small, big] = aSet.size <= bSet.size ? [aSet, bSet] : [bSet, aSet];
  for (const t of small) if (big.has(t)) shared++;
  return shared / small.size;
}

const scored = [];
for (const p of allPosts()) {
  const toks = topicTokens(p);
  const tokScore = overlap(cand, toks);
  // Compared entities (the named tools in a `compare:` table header) are the
  // highest-signal proof two buyer's guides cover the same decision. Fold any
  // candidate token that names such an entity into the score with extra weight.
  const ents = comparedEntities(p);
  let entHits = 0;
  for (const e of ents) {
    // an entity may be multi-word ("microsoft agent framework"); count it if any
    // of its tokens is in the candidate.
    for (const w of String(e).split(/\s+/)) if (w.length > 2 && cand.has(w)) { entHits++; break; }
  }
  const entScore = ents.size ? entHits / ents.size : 0;
  const score = Math.min(1, tokScore + 0.35 * entScore);
  const shared = [...cand].filter((t) => toks.has(t));
  if (score > 0) scored.push({ slug: p.slug, title: p.title, section: p.section, score, shared });
}

scored.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));

// Thresholds tuned to the failure mode: a single ~0.8 overlap is a likely
// duplicate; several ≥0.5 means the demand is already served from many angles.
const NEAR = 0.5;        // "near-duplicate" band
const DUPE = 0.8;        // "this piece may already exist"
const nearDupes = scored.filter((s) => s.score >= NEAR);
const topScore = scored.length ? scored[0].score : 0;

let verdict, code;
if (topScore >= DUPE) { verdict = "SATURATED"; code = 4; }
else if (nearDupes.length >= 3) { verdict = "SATURATED"; code = 4; }
else if (nearDupes.length >= 1) { verdict = "CROWDED"; code = 3; }
else { verdict = "CLEAR"; code = 0; }

const top = scored.slice(0, 5);

if (JSON_OUT) {
  console.log(JSON.stringify({ candidate, verdict, code, topScore: +topScore.toFixed(3), nearDupes: nearDupes.length, closest: top.map((t) => ({ slug: t.slug, score: +t.score.toFixed(3), shared: t.shared })) }, null, 2));
  process.exit(code);
}

const bar = (s) => "█".repeat(Math.round(s * 20)).padEnd(20, "·");
const label = { SATURATED: "⛔ SATURATED", CROWDED: "⚠️  CROWDED ", CLEAR: "✅ CLEAR   " }[verdict];

console.log(`\ncandidate: ${candidate}`);
console.log(`tokens:    ${[...cand].join(" ")}`);
console.log(`\n${label}  — top overlap ${(topScore * 100).toFixed(0)}%, ${nearDupes.length} near-dupe(s) ≥${NEAR * 100}%\n`);
if (top.length) {
  console.log("closest existing pieces:");
  for (const t of top) {
    console.log(`  ${bar(t.score)} ${(t.score * 100).toFixed(0).padStart(3)}%  ${t.slug}`);
    if (t.shared.length) console.log(`  ${" ".repeat(20)}       shared: ${t.shared.join(", ")}`);
  }
} else {
  console.log("no overlapping pieces found — this looks genuinely uncovered.");
}
console.log(
  verdict === "SATURATED"
    ? "\n→ Do NOT draft this. Pick a distinct angle/query, or a different topic entirely.\n"
    : verdict === "CROWDED"
      ? "\n→ A related piece exists. Only proceed if your angle/target query is clearly distinct from the above.\n"
      : "\n→ Clear to draft. Still lead the title with the concrete search query.\n"
);
process.exit(code);
