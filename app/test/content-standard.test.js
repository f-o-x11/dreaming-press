// content-standard.test.js — guards the demand-piece SEO-completeness standard so
// each run cannot quietly ship a Wire/Stack comparison missing its summary/faq/
// sources/art/internal-link. Two layers: (1) unit tests on the checklist logic,
// (2) a live gate asserting the pieces THIS run changed (uncommitted) all comply.
import { test } from "node:test";
import assert from "node:assert/strict";
import { auditPiece, auditContent, changedContentFiles, contentTokens, nearDuplicate, duplicateWarnings, orphanWarnings, faqMalformed, figuresMalformed, sourcesMalformed, artMalformed, revisitDue } from "../scripts/check-content.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const FM = (o) => `---\n${Object.entries(o).map(([k, v]) => `${k}: ${v}`).join("\n")}\n---\n`;
const COMPLIANT = FM({
  title: "Foo vs Bar: Picking One in 2026",
  dek: "A standfirst.",
  author: "dex", author_type: "ai", section: "stack", date: "2026-06-21",
  tags: "reportive",
  summary: "Point one. ;; Point two. ;; Point three.",
  faq: "What is Foo? | Foo is a thing. ;; What is Bar? | Bar is another thing.",
  sources: "https://example.com | Example",
  art: "",
  compare: "Dimension | Foo | Bar ;; Speed | fast | slow ;; Cost | low | high",
}) + "Body with an [internal link](/posts/other.html) and @repo{a/b | https://github.com/a/b | does x | Go | 1k}.\n";

test("auditPiece: a complete demand piece passes", () => {
  const r = auditPiece("foo-vs-bar.md", COMPLIANT);
  assert.equal(r.demand, true);
  assert.deepEqual(r.errors, []);
});

test("auditPiece: missing faq is flagged", () => {
  const raw = COMPLIANT.replace(/^faq:.*\n/m, "");
  const r = auditPiece("foo-vs-bar.md", raw);
  assert.ok(r.errors.some((e) => /faq/.test(e)), `expected faq error, got ${JSON.stringify(r.errors)}`);
});

test("auditPiece: missing summary is flagged", () => {
  const raw = COMPLIANT.replace(/^summary:.*\n/m, "");
  const r = auditPiece("foo-vs-bar.md", raw);
  assert.ok(r.errors.some((e) => /summary/.test(e)));
});

test("auditPiece: missing in-cluster internal link is flagged", () => {
  const raw = COMPLIANT.replace("[internal link](/posts/other.html)", "no link here");
  const r = auditPiece("foo-vs-bar.md", raw);
  assert.ok(r.errors.some((e) => /internal link/.test(e)));
});

test("auditPiece: missing compare at-a-glance table is flagged", () => {
  const raw = COMPLIANT.replace(/^compare:.*\n/m, "");
  const r = auditPiece("foo-vs-bar.md", raw);
  assert.ok(r.errors.some((e) => /compare/.test(e)), `expected compare-table error, got ${JSON.stringify(r.errors)}`);
});

test("auditPiece: a compare line with only a header row (no data) is flagged", () => {
  const raw = COMPLIANT.replace(/^compare:.*\n/m, "compare: Dimension | Foo | Bar\n");
  const r = auditPiece("foo-vs-bar.md", raw);
  assert.ok(r.errors.some((e) => /compare/.test(e)), `expected compare-table error, got ${JSON.stringify(r.errors)}`);
});

test("auditPiece: a compare row wider than the header (the lone-pipe-for-;; break) is flagged", () => {
  // a 3-col header with a data row of 6 cells — the exact ap2-vs-x402 break, where a
  // `;;` row separator was typed as a lone ` | `, fusing two rows into one over-wide row.
  const raw = COMPLIANT.replace(/^compare:.*\n/m,
    "compare: Dimension | Foo | Bar ;; Speed | fast | slow | Cost | low | high\n");
  const r = auditPiece("foo-vs-bar.md", raw);
  assert.ok(r.errors.some((e) => /column mismatch/.test(e)), `expected column-mismatch error, got ${JSON.stringify(r.errors)}`);
});

test("auditPiece: a column-consistent compare table (incl. escaped pipes) passes the mismatch check", () => {
  // every row the header's width, and a cell carrying an escaped \\| must NOT be
  // miscounted as two cells (splitCells splits only UNescaped pipes).
  const raw = COMPLIANT.replace(/^compare:.*\n/m,
    "compare: Metric | Foo | Bar ;; Formula | Sum of \\|a-b\\| | none ;; Cost | low | high\n");
  const r = auditPiece("foo-vs-bar.md", raw);
  assert.ok(!r.errors.some((e) => /column mismatch/.test(e)), `expected no column-mismatch error, got ${JSON.stringify(r.errors)}`);
});

test("auditPiece: a faq pair missing its | separator is flagged (silently dropped from FAQPage schema)", () => {
  // the dangerous case — a Q&A with no pipe parses to nothing in ingest, so the
  // FAQ + schema quietly shrink with no error. A `;;` mistyped as `;` produces this.
  const raw = COMPLIANT.replace(/^faq:.*\n/m,
    "faq: What is Foo? | Foo is a thing. ;; What is Bar? Bar is another thing.\n");
  const r = auditPiece("foo-vs-bar.md", raw);
  assert.ok(r.errors.some((e) => /faq: malformed/.test(e)), `expected faq-malformed error, got ${JSON.stringify(r.errors)}`);
});

test("auditPiece: a faq pair with an empty answer is flagged", () => {
  const raw = COMPLIANT.replace(/^faq:.*\n/m,
    "faq: What is Foo? | Foo is a thing. ;; What is Bar? |\n");
  const r = auditPiece("foo-vs-bar.md", raw);
  assert.ok(r.errors.some((e) => /faq: malformed/.test(e)), `expected faq-malformed error, got ${JSON.stringify(r.errors)}`);
});

test("faqMalformed: a well-formed faq line (incl. a pipe inside the answer) passes", () => {
  // the FIRST pipe splits Q from A, so a later pipe in the answer prose is fine —
  // exactly how ingest.js parses it (indexOf('|')), so the check must agree.
  assert.equal(faqMalformed("faq: What? | A or B | C. ;; Why? | Because.\n"), null);
  // no faq line at all → nothing to check
  assert.equal(faqMalformed("title: x\n"), null);
});

test("auditPiece: a figures entry with no pipe is flagged (naked stat, blank caption)", () => {
  // a `;;` mistyped as `;` or a forgotten `|` → ingest renders a stat with no label.
  const raw = COMPLIANT.replace(/^---\n/, "---\nfigures: 15x | more tokens ;; 80% of variance\n");
  const r = auditPiece("foo-vs-bar.md", raw);
  assert.ok(r.errors.some((e) => /figures: malformed/.test(e)), `expected figures-malformed error, got ${JSON.stringify(r.errors)}`);
});

test("auditPiece: a figures entry with an empty stat is flagged (silently dropped)", () => {
  // a leading `|` (or stray `;;`) leaves an empty stat half → ingest drops the figure.
  const raw = COMPLIANT.replace(/^---\n/, "---\nfigures: 15x | more tokens ;; | orphan label\n");
  const r = auditPiece("foo-vs-bar.md", raw);
  assert.ok(r.errors.some((e) => /figures: malformed/.test(e)), `expected figures-malformed error, got ${JSON.stringify(r.errors)}`);
});

test("figuresMalformed: a well-formed figures line (incl. a pipe inside the label) passes", () => {
  // the FIRST pipe splits stat from label, so a later pipe in the label is fine —
  // both halves non-empty → no flag. Matches ingest/render's split.
  assert.equal(figuresMalformed("figures: 15x | more tokens vs chat ;; 80% | variance (A|B)\n"), null);
  // an empty label after the pipe is flagged (renders a stat with no caption)
  assert.ok(figuresMalformed("figures: 15x |\n"));
  // no figures line at all → nothing to check
  assert.equal(figuresMalformed("title: x\n"), null);
});

test("auditPiece: a sources entry with an empty url is flagged (silently dropped from references)", () => {
  // a `;;` mistyped as a lone `|`, or a leading `|`, leaves an empty url half →
  // ingest's `if (url && url.trim())` drops the source and any citation to it breaks.
  const raw = COMPLIANT.replace(/^sources:.*\n/m,
    "sources: https://a.com | A ;; | B\n");
  const r = auditPiece("foo-vs-bar.md", raw);
  assert.ok(r.errors.some((e) => /sources: malformed/.test(e)), `expected sources-malformed error, got ${JSON.stringify(r.errors)}`);
});

test("auditPiece: two sources fused by a single ';' (URL leaks into the label) is flagged", () => {
  // the classic `;;`-typed-as-`;` break: ingest splits on `;;`, so both sources land
  // in one chunk; the first `|` makes url=https://a, label="A ; https://b | B" — the
  // second source is lost. The `://` in the label half is the tell.
  const raw = COMPLIANT.replace(/^sources:.*\n/m,
    "sources: https://a.com | A ; https://b.com | B\n");
  const r = auditPiece("foo-vs-bar.md", raw);
  assert.ok(r.errors.some((e) => /sources: malformed/.test(e)), `expected sources-malformed error, got ${JSON.stringify(r.errors)}`);
});

test("sourcesMalformed: well-formed sources (incl. a no-label url and a trailing ';;') pass", () => {
  // a url with no `|` label is a SUPPORTED form (label defaults to the url), and a
  // trailing empty `;;` chunk is harmless (ingest skips it) — neither is data loss.
  assert.equal(sourcesMalformed("sources: https://a.com | A ;; https://b.com ;;\n"), null);
  // a query string with an escaped/raw `|`-free url and a normal label is fine
  assert.equal(sourcesMalformed("sources: https://x.com/a?b=c | The X paper\n"), null);
  // no sources line at all → nothing to check
  assert.equal(sourcesMalformed("title: x\n"), null);
});

test("artMalformed: a valid art block passes; a typo'd archetype/mood is flagged", () => {
  const block = (a, m) => `---\ntitle: x\nart:\n  archetype: ${a}\n  mood: ${m}\n  motif: "two panels"\nsources: https://a.com | A\n---\nbody\n`;
  // a real archetype + real mood → no silent fallback
  assert.equal(artMalformed(block("division", "cold")), null);
  // a misspelled archetype → cover would silently revert to the section default
  assert.equal(artMalformed(block("divisn", "cold"))?.field, "archetype");
  // a misspelled mood → palette would silently revert to "stark"
  assert.equal(artMalformed(block("division", "clod"))?.field, "mood");
  // the inline JSON form is validated too
  assert.equal(artMalformed('---\nart: {"archetype":"nope","mood":"cold"}\n---\nb')?.value, "nope");
  // no art: block at all → nothing to check (heuristic cover is a valid choice)
  assert.equal(artMalformed("title: x\n"), null);
});

test("revisitDue: a timely piece is due only once its revisit date arrives", () => {
  const raw = "revisit: 2026-07-28\ntitle: MCP RC\n";
  assert.equal(revisitDue(raw, "2026-06-25"), null);          // before → not due
  assert.equal(revisitDue(raw, "2026-07-28"), "2026-07-28");  // on the day → due
  assert.equal(revisitDue(raw, "2026-08-01"), "2026-07-28");  // after → still due
  assert.equal(revisitDue("title: x\n", "2026-07-28"), null); // no revisit: line → never due
  assert.equal(revisitDue(raw, "not-a-date"), null);          // no usable clock → no false alarm
});

test("auditPiece: a Wire/Stack piece with no sources or @repo cards is flagged", () => {
  const raw = FM({ title: "A Report", section: "wire", date: "2026-06-21" }) + "Body with no evidence at all.\n";
  const r = auditPiece("a-report.md", raw);
  assert.ok(r.errors.some((e) => /sources/.test(e)));
});

test("auditPiece: an opinion Dispatch with 'vs' in the title is NOT a demand piece", () => {
  // section dispatches → never gated as a comparison, even with a versus title
  const raw = FM({ title: "The Streak vs The Standard", section: "dispatches", date: "2026-06-21" }) + "First-person prose.\n";
  const r = auditPiece("the-streak-vs-the-standard.md", raw);
  assert.equal(r.demand, false);
  assert.deepEqual(r.errors, []);
});

test("auditPiece: a Stack piece may satisfy evidence with @repo cards instead of sources", () => {
  const raw = FM({ title: "A vs B: Compared", section: "stack", date: "2026-06-21",
    summary: "x. ;; y. ;; z.", faq: "Q? | A.", art: "",
    compare: "Dimension | A | B ;; Layer | x | y" })
    + "Body [link](/best/agents.html) @repo{a/b | https://github.com/a/b | x | Go | 1k}\n";
  const r = auditPiece("a-vs-b.md", raw);
  assert.deepEqual(r.errors, []);
});

test("auditPiece: a dead internal /posts/ link is flagged when the corpus slug-set is supplied", () => {
  const raw = COMPLIANT.replace("/posts/other.html", "/posts/no-such-piece.html");
  const slugs = new Set(["foo-vs-bar", "real-sibling"]);
  const r = auditPiece("foo-vs-bar.md", raw, slugs);
  assert.ok(r.errors.some((e) => /dead internal link/.test(e)), `expected dead-link error, got ${JSON.stringify(r.errors)}`);
});

test("auditPiece: an internal link resolving by date-stripped slug passes (mirrors resolveSlug)", () => {
  // body links the bare form; the corpus only has the date-prefixed file — still valid
  const raw = COMPLIANT.replace("/posts/other.html", "/posts/real-sibling.html");
  const slugs = new Set(["foo-vs-bar", "real-sibling"]); // stored as 2026-06-23-real-sibling → stripped
  const r = auditPiece("foo-vs-bar.md", raw, slugs);
  assert.deepEqual(r.errors, [], `expected no errors, got ${JSON.stringify(r.errors)}`);
});

test("auditPiece: without a slug-set, link resolution is skipped (backward-compatible)", () => {
  // COMPLIANT links /posts/other.html which doesn't exist; with no slug-set, no error
  const r = auditPiece("foo-vs-bar.md", COMPLIANT);
  assert.deepEqual(r.errors, []);
});

// ── near-duplicate slug guard ─────────────────────────────────────────────────
test("contentTokens: strips date prefix and non-topical scaffolding", () => {
  // "vs", "for", "an", "ai", "agent", "llm" are scaffolding; the subject survives
  assert.deepEqual([...contentTokens("2026-06-24-semantic-router-vs-llm-routing")].sort(),
    ["routing", "router", "semantic"].sort());
  assert.deepEqual([...contentTokens("how-to-add-human-in-the-loop-to-an-ai-agent")].sort(),
    ["add", "human", "loop"].sort());
});

test("nearDuplicate: flags a slug that is another plus one qualifier", () => {
  // the two real clones this guard was built for
  assert.equal(nearDuplicate(contentTokens("llm-as-a-judge"), contentTokens("llm-as-a-judge-evaluation")), true);
  assert.equal(nearDuplicate(contentTokens("human-in-the-loop-ai-agents"), contentTokens("how-to-add-human-in-the-loop-to-an-ai-agent")), true);
});

test("nearDuplicate: distinct subjects sharing one scaffolding-free token are NOT flagged", () => {
  // both about "caching" but different first token → adjacent, not duplicate
  assert.equal(nearDuplicate(contentTokens("prompt-caching-for-ai-agents"), contentTokens("semantic-caching-for-ai-agents")), false);
  // both routing-adjacent but disjoint subjects (intent routing vs model-cost routing)
  assert.equal(nearDuplicate(contentTokens("semantic-router-vs-llm-routing"), contentTokens("routellm-vs-notdiamond-vs-martian")), false);
});

test("nearDuplicate: abbreviation/full-form variants of the same subject ARE flagged", () => {
  // a real keyword-cannibal clone that shipped because eval ≠ evaluation under plain
  // equality dropped Jaccard to 0.5; prefix-aware token match (eval ⊂ evaluation) catches it.
  assert.equal(nearDuplicate(contentTokens("how-to-build-an-llm-eval-dataset"), contentTokens("how-to-build-an-llm-evaluation-dataset")), true);
  // but the ≥4 floor keeps short abbreviations exact so adjacent subjects stay distinct
  assert.equal(nearDuplicate(contentTokens("agentic-rag-vs-naive-rag"), contentTokens("ragas-vs-deepeval-rag-evals")), false);
});

test("duplicateWarnings: flags a new Wire piece that clones an existing one, but not a distinct one", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dp-dup-"));
  const wire = (extra) => `---\ntitle: T\nsection: wire\ndate: 2026-06-24\n---\nbody\n` + (extra || "");
  fs.writeFileSync(path.join(dir, "llm-as-a-judge.md"), wire());                 // existing
  fs.writeFileSync(path.join(dir, "llm-as-a-judge-evaluation.md"), wire());      // new clone
  fs.writeFileSync(path.join(dir, "semantic-router-vs-llm-routing.md"), wire()); // new distinct
  const warns = duplicateWarnings(new Set(["llm-as-a-judge-evaluation.md", "semantic-router-vs-llm-routing.md"]), dir);
  assert.equal(warns.length, 1, `expected exactly one dup warning, got ${JSON.stringify(warns)}`);
  assert.equal(warns[0].file, "llm-as-a-judge-evaluation.md");
  assert.equal(warns[0].dupOf, "llm-as-a-judge.md");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("duplicateWarnings: a dispatches/fabrications clone is not gated (demand corpus only)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dp-dup2-"));
  const post = (section) => `---\ntitle: T\nsection: ${section}\ndate: 2026-06-24\n---\nbody\n`;
  fs.writeFileSync(path.join(dir, "the-quiet-machine.md"), post("dispatches"));
  fs.writeFileSync(path.join(dir, "the-quiet-machine-returns.md"), post("dispatches"));
  const warns = duplicateWarnings(new Set(["the-quiet-machine-returns.md"]), dir);
  assert.deepEqual(warns, []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("orphanWarnings: a new comparison piece that lands in the catch-all is flagged; a homed one is not", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dp-orphan-"));
  const wire = `---\ntitle: T\nsection: wire\ndate: 2026-06-25\n---\nbody\n`;
  // homes in RAG & Retrieval via the `cross-encoder`/`bi-encoder` tokens added this run
  fs.writeFileSync(path.join(dir, "cross-encoder-vs-bi-encoder.md"), wire);
  // homes in Evals & Observability via the `confidence-scores` token added this run
  fs.writeFileSync(path.join(dir, "how-to-get-confidence-scores-from-an-llm.md"), wire);
  // a real comparison slug whose vocab matches no cluster regex → catch-all
  fs.writeFileSync(path.join(dir, "frobnicator-vs-wibblizer.md"), wire);
  const warns = orphanWarnings(new Set([
    "cross-encoder-vs-bi-encoder.md",
    "how-to-get-confidence-scores-from-an-llm.md",
    "frobnicator-vs-wibblizer.md",
  ]), dir);
  assert.equal(warns.length, 1, `expected exactly one orphan warning, got ${JSON.stringify(warns)}`);
  assert.equal(warns[0].file, "frobnicator-vs-wibblizer.md");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("orphanWarnings: a non-comparison Dispatch is never flagged (not a clustered piece)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dp-orphan2-"));
  // a Wire essay whose slug isn't a vs/best-/how-to- query and carries no compare table
  fs.writeFileSync(path.join(dir, "the-megawatt-you-cannot-rent.md"),
    `---\ntitle: T\nsection: wire\ndate: 2026-06-25\n---\nbody\n`);
  const warns = orphanWarnings(new Set(["the-megawatt-you-cannot-rent.md"]), dir);
  assert.deepEqual(warns, []);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ── live gate: the pieces this run changed must all meet the standard ─────────
// Once committed they fall out of `git status` and are grandfathered, so this
// only ever holds the current slate to account — and never the legacy backlog.
test("content gate: every content file changed in this run meets the standard", () => {
  const changed = changedContentFiles();
  const failures = auditContent()
    .filter((r) => changed.has(r.file) && r.errors.length)
    .map((r) => `${r.file}: ${r.errors.join("; ")}`);
  assert.deepEqual(failures, [], `changed pieces below standard:\n${failures.join("\n")}`);
});

test("content gate: this run's slate introduces no near-duplicate of an existing piece", () => {
  const dups = duplicateWarnings(changedContentFiles())
    .map((d) => `${d.file} ~ ${d.dupOf}`);
  assert.deepEqual(dups, [], `near-duplicate pieces about to ship:\n${dups.join("\n")}`);
});

// ── series binding: the "Anatomy of an AI Coding Agent" reading arc (#15/#29) ──
// The retrieve → express-the-edit → fast-apply pieces are bound into one series so
// the on-article pager + /series hub weave the highest-intent coding-agent money
// pages together. A stray edit to any of the three frontmatter blocks (a dropped
// `series:`, a re-typed `series_order`, a slug rename) silently breaks the arc with
// no error, so pin the membership + order against the live content files.
test("series: anatomy-of-an-ai-coding-agent binds its three parts in order", () => {
  const CONTENT = path.resolve(import.meta.dirname, "..", "..", "content", "posts");
  const expected = [
    ["code-retrieval-for-ai-coding-agents", "1"],
    ["coding-agent-edit-formats-diff-vs-whole-file", "2"],
    ["fast-apply-models-morph-vs-relace-vs-cursor", "3"],
  ];
  for (const [slug, order] of expected) {
    const raw = fs.readFileSync(path.join(CONTENT, `${slug}.md`), "utf8");
    assert.match(raw, /^series:\s*anatomy-of-an-ai-coding-agent\s*$/m, `${slug} missing series tag`);
    assert.match(raw, new RegExp(`^series_order:\\s*${order}\\s*$`, "m"), `${slug} wrong series_order (want ${order})`);
  }
});
