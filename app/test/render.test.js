// Tests for lib/render.js, parameterized over all real posts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { allPosts, postsBySection, totalViews, comparisonClusters, clusterSiblings, comparisonClusterBySlug, concepts, conceptSiblings, CONCEPT_SLUGS, securityHub, SECURITY_HUB_SLUGS } from "../lib/db.js";
import {
  renderHome, renderArticle, renderSection, renderSearch, renderSaved,
  renderWeekly, weeklyWindow, renderSeries, renderSeriesIndex, renderAuthor,
  renderComparisons, renderComparisonCluster, renderConcepts, renderTopicSecurity, authorProfileLd,
  card, wireRow, coverUrl, head, masthead, footer, issueLine, metaDescription,
  ENTITY_SAMEAS_EXTRA, isDescriptiveLabel,
} from "../lib/render.js";
import { SECTIONS, SECTION_ORDER, authorOf, authorKey, esc, NOW, humanDate, SITE } from "../lib/data.js";
import { TOOLS } from "../lib/tools-data.js";

const posts = allPosts();

test("there are posts to test against", () => {
  assert.ok(posts.length > 0, "DB should be populated");
});

// ── coverUrl ─────────────────────────────────────────────────────────────────
test("coverUrl builds /images/<slug>.png", () => {
  assert.equal(coverUrl("my-slug"), "/images/my-slug.png");
});

// ── metaDescription ──────────────────────────────────────────────────────────
test("metaDescription leaves short text unchanged but normalizes whitespace", () => {
  assert.equal(metaDescription("A short dek."), "A short dek.");
  assert.equal(metaDescription("two   spaces\nand a newline"), "two spaces and a newline");
});

test("metaDescription bounds long text to the budget", () => {
  const long = "x".repeat(50) + " " + "y".repeat(200);   // no sentence break, long
  const out = metaDescription(long, 160);
  assert.ok(out.length <= 160, `expected <=160, got ${out.length}`);
  assert.ok(out.endsWith("…"), "long text without a sentence break should be ellipsized");
});

test("metaDescription prefers a sentence boundary inside the window", () => {
  const dek = "First, the real idea lands here in a complete sentence. " +
    "Then a second clause keeps going well past the snippet budget so it must be cut somewhere sensible.";
  const out = metaDescription(dek, 160);
  assert.ok(out.length <= 160);
  assert.ok(out.endsWith("."), "should end on the sentence, not a hard cut");
  assert.ok(!out.endsWith("…"), "a clean sentence boundary needs no ellipsis");
});

test("metaDescription never breaks mid-word", () => {
  const dek = "Supercalifragilistic " + "antidisestablishmentarianism ".repeat(12);
  const out = metaDescription(dek, 160);
  assert.ok(out.length <= 160);
  assert.ok(!/\w…$/.test(out) || out.slice(0, -1).split(" ").length > 1,
    "ellipsis should follow a whole word, not a fragment");
  assert.ok(!out.slice(0, -1).trimEnd().endsWith("-"));
});

test("head emits a bounded meta description for an over-long dek", () => {
  const longDek = "An agent's latency is not one model call but a serial chain of N calls, " +
    "and the chain is the critical path, so the biggest lever is making fewer round-trips rather than buying faster tokens per second.";
  assert.ok(longDek.length > 160);
  const h = head("t", longDek, { url: "u", image: "i" });
  const m = /<meta name="description" content="([^"]*)">/.exec(h);
  assert.ok(m, "description meta tag present");
  assert.ok(m[1].length <= 161, `meta description should be bounded, got ${m[1].length}`);
});

// ── head / masthead / footer ─────────────────────────────────────────────────
test("head produces DOCTYPE and escapes title", () => {
  const h = head('A & "B"', "desc", { url: "u", image: "i" });
  assert.match(h, /^<!DOCTYPE html>/);
  assert.match(h, /A &amp; &quot;B&quot;/);
  assert.match(h, /<meta charset="UTF-8">/);
});

test("head includes section data attribute when given", () => {
  const h = head("t", "d", { url: "u", image: "i", section: "wire" });
  assert.match(h, /data-section="wire"/);
});

test("head includes md alternate link when given", () => {
  const h = head("t", "d", { url: "u", image: "i", mdAlt: "/posts/x.md" });
  assert.match(h, /rel="alternate" type="text\/markdown" href="\/posts\/x.md"/);
});

test("head includes theme boot script", () => {
  const h = head("t", "d", { url: "u", image: "i" });
  assert.match(h, /data-theme/);
});

test("head includes a skip-to-content link as the first body element", () => {
  const h = head("t", "d", { url: "u", image: "i" });
  assert.match(h, /<body>\s*<a class="skip-link" href="#main">Skip to content<\/a>/);
});

test("head always sets og:site_name", () => {
  const h = head("t", "d", { url: "u", image: "i" });
  assert.match(h, /<meta property="og:site_name" content="dreaming\.press">/);
});

test("head declares og:image dimensions + type so the large card renders on first scrape", () => {
  const h = head("t", "d", { url: "u", image: "https://dreaming.press/images/x.png" });
  assert.match(h, /<meta property="og:image:width" content="1200">/);
  assert.match(h, /<meta property="og:image:height" content="800">/);
  assert.match(h, /<meta property="og:image:type" content="image\/png">/);
});

test("head opts into large image previews so the per-post cover is eligible in Google Search/Discover", () => {
  const h = head("t", "d", { url: "u", image: "https://dreaming.press/images/x.png" });
  assert.match(h, /<meta name="robots" content="[^"]*max-image-preview:large[^"]*">/);
  assert.match(h, /<meta name="robots" content="index, follow,/); // indexable + full snippet/video preview
});

test("head og:image:type follows the image extension (png/jpeg/webp)", () => {
  assert.match(head("t", "d", { url: "u", image: "/a.jpg" }), /og:image:type" content="image\/jpeg"/);
  assert.match(head("t", "d", { url: "u", image: "/a.webp" }), /og:image:type" content="image\/webp"/);
  assert.match(head("t", "d", { url: "u", image: "/a.png" }), /og:image:type" content="image\/png"/);
});

test("head emits og:image:alt and twitter:image:alt, defaulting to the title and escaping it", () => {
  const h = head('A & "B"', "d", { url: "u", image: "i" });
  assert.match(h, /<meta property="og:image:alt" content="A &amp; &quot;B&quot;">/);
  assert.match(h, /<meta name="twitter:image:alt" content="A &amp; &quot;B&quot;">/);
});

test("head uses an explicit imageAlt over the title when given", () => {
  const h = head("page title", "d", { url: "u", image: "i", imageAlt: "Cover art for a piece" });
  assert.match(h, /<meta property="og:image:alt" content="Cover art for a piece">/);
  assert.match(h, /<meta name="twitter:image:alt" content="Cover art for a piece">/);
});

test("head emits sitewide WebSite + Organization JSON-LD with a SearchAction", () => {
  const h = head("t", "d", { url: "u", image: "i" });
  assert.match(h, /application\/ld\+json/);
  // a single sitewide graph, parseable, with both nodes + the search box signal
  const m = /<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@graph".*?)<\/script>/.exec(h);
  assert.ok(m, "sitewide @graph present");
  const graph = JSON.parse(m[1])["@graph"];
  const org = graph.find(n => n["@type"] === "Organization");
  const site = graph.find(n => n["@type"] === "WebSite");
  assert.ok(org && org.logo && /\/images\/logo\.png$/.test(org.logo.url), "Organization has a real logo");
  assert.equal(site.potentialAction["@type"], "SearchAction");
  assert.match(site.potentialAction.target.urlTemplate, /\/search\?q=\{search_term_string\}/);
  assert.equal(site.publisher["@id"], org["@id"], "WebSite publisher references the Organization @id");
});

test("head links a favicon", () => {
  const h = head("t", "d", { url: "u", image: "i" });
  assert.match(h, /<link rel="icon" type="image\/png" href="\/images\/favicon\.png">/);
});

// Pull the article-level JSON-LD blob (the one with an #article @id) out of a render.
function articleLd(out) {
  const m = /<script type="application\/ld\+json">(\{[^<]*?"@id":"[^"]*#article"[^<]*?)<\/script>/.exec(out);
  assert.ok(m, "article JSON-LD present");
  return JSON.parse(m[1]);
}

test("renderArticle emits article JSON-LD referencing the sitewide Organization", () => {
  // The Wire is genuine news, so its pieces carry @type NewsArticle.
  const p = posts.find(x => x.section === "wire" && x.tags?.length) || posts.find(x => x.tags?.length) || posts[0];
  const out = renderArticle(p, [], 0, {});
  const ld = articleLd(out);
  if (p.section === "wire") assert.equal(ld["@type"], "NewsArticle");
  assert.equal(ld.headline, p.title);
  assert.ok(ld.datePublished && ld.dateModified, "has published + modified dates");
  assert.equal(ld.mainEntityOfPage["@id"], `${SITE}/posts/${p.slug}.html`);
  assert.match(ld.author.url, /\/authors\//);
  assert.equal(ld.publisher["@id"], `${SITE}/#org`, "publisher references sitewide Organization");
  assert.equal(ld.inLanguage, "en");
  assert.ok(Number.isInteger(ld.wordCount) && ld.wordCount > 0, "carries a positive wordCount");
  assert.match(ld.timeRequired, /^PT\d+M$/, "timeRequired is an ISO-8601 minute duration");
  assert.equal(ld.timeRequired, `PT${p.read_time}M`, "timeRequired mirrors the on-page read time");
});

test("article byline Person @id reconciles with the authoritative author-profile entity", () => {
  // The article author must share the EXACT @id of the /authors/:id ProfilePage
  // Person node, so a search engine merges the byline with the rich E-E-A-T entity
  // (knowsAbout/jobTitle/worksFor) instead of treating each byline as an anonymous
  // Person. Without the shared @id the author's authority never reaches the article.
  const p = posts.find(x => x.tags?.length) || posts[0];
  const ld = articleLd(renderArticle(p, [], 0, {}));
  assert.equal(ld.author["@type"], "Person");
  const expectedId = `${SITE}/authors/${authorKey(p.author)}#person`;
  assert.equal(ld.author["@id"], expectedId, "article author carries the #person @id");
  assert.match(ld.author.url, /\/authors\//, "byline still links the author archive");

  // The profile page must define the SAME @id (byte-identical), or the merge fails.
  const profileM = /<script type="application\/ld\+json">(\{[^<]*?"@type":"ProfilePage"[^<]*?)<\/script>/
    .exec(authorProfileLd(authorKey(p.author), [p]));
  assert.ok(profileM, "author profile ProfilePage JSON-LD present");
  const profile = JSON.parse(profileM[1]);
  assert.equal(profile.mainEntity["@id"], expectedId, "profile Person @id matches the byline @id");
  assert.ok(Array.isArray(profile.mainEntity.knowsAbout) && profile.mainEntity.knowsAbout.length,
    "the reconciled entity actually carries E-E-A-T knowsAbout signals");
});

test("article JSON-LD carries a speakable spec naming the headline + dek selectors", () => {
  const p = posts.find(x => x.tags?.length) || posts[0];
  const ld = articleLd(renderArticle(p, [], 0, {}));
  assert.ok(ld.speakable, "article LD has a speakable block");
  assert.equal(ld.speakable["@type"], "SpeakableSpecification");
  assert.ok(Array.isArray(ld.speakable.cssSelector), "speakable cssSelector is an array");
  // the named selectors must resolve to elements actually present in the markup
  const out = renderArticle(p, [], 0, {});
  assert.match(out, /<div class="article-hero">/);
  assert.ok(ld.speakable.cssSelector.includes(".article-hero h1"), "speaks the headline");
  assert.ok(ld.speakable.cssSelector.includes(".article-hero .dek"), "speaks the dek");
  assert.match(out, /<p class="dek">/, "the .dek node the selector targets exists");
});

test("speakable names the at-a-glance takeaway summary when (and only when) it renders", () => {
  // A demand piece with a `summary:` block voices its spoken digest; the named
  // `.takeaway ul` selector must resolve to a real element in the same markup.
  const withSummary = posts.find(x => Array.isArray(x.summary) ? x.summary.length
    : (typeof x.summary === "string" && x.summary.trim()));
  if (withSummary) {
    const out = renderArticle(withSummary, [], 0, {});
    const ld = articleLd(out);
    assert.ok(ld.speakable.cssSelector.includes(".takeaway ul"),
      "a piece with a summary speaks its takeaway list");
    assert.match(out, /<aside class="takeaway"[^>]*><[^>]*>[\s\S]*?<ul>/,
      "the .takeaway ul node the selector targets exists");
  }
  // A piece with no summary block must NOT name the takeaway selector (invariant:
  // every named selector resolves to a present element).
  const noSummary = posts.find(x => !(Array.isArray(x.summary) ? x.summary.length
    : (typeof x.summary === "string" && x.summary.trim())));
  if (noSummary) {
    const ld = articleLd(renderArticle(noSummary, [], 0, {}));
    assert.ok(!ld.speakable.cssSelector.includes(".takeaway ul"),
      "a piece without a summary does not name a non-existent takeaway");
    assert.ok(!renderArticle(noSummary, [], 0, {}).includes('class="takeaway"'),
      "and indeed renders no takeaway block");
  }
});

test("figures render from a raw `stat | label ;; …` string, not only a JSON array", () => {
  // db.js hydrates `figures` as a JSON array, but a non-DB render path (preview,
  // direct frontmatter) can hand render.js the raw `;;`/`|` string the block
  // documents. That must render the "By the numbers" strip — same robustness the
  // `summary` block already has — rather than silently dropping every figure.
  const base = posts[0];
  const raw = { ...base, figures: "90 | percent off on-demand ;; 2 | minutes of warning" };
  const out = renderArticle(raw, [], 0, {});
  assert.match(out, /class="key-figures"/, "raw figures string still renders the strip");
  assert.match(out, /class="kf-stat">90</, "first stat renders");
  assert.match(out, /percent off on-demand/, "first label renders");
  assert.match(out, /class="kf-stat">2</, "second stat renders");
  // An empty/whitespace string must render no strip (invariant preserved).
  const none = renderArticle({ ...base, figures: "   " }, [], 0, {});
  assert.ok(!none.includes('class="key-figures"'), "blank figures render no strip");
});

test("article JSON-LD exposes the verifiable source list as schema.org citation nodes", () => {
  // House rule #1: Wire/Stack pieces must carry real, verifiable sources. Those
  // sources render visibly, but the structured-data graph must ALSO declare them as
  // machine-readable `citation` CreativeWork nodes so Google's quality systems and
  // AI answer engines (the GEO audience the publication writes for) can see the piece
  // is sourced and which works it rests on.
  const sourced = posts.find(x => Array.isArray(x.sources) && x.sources.length);
  assert.ok(sourced, "corpus has at least one sourced piece to assert against");
  const ld = articleLd(renderArticle(sourced, [], 0, {}));
  assert.ok(Array.isArray(ld.citation), "sourced article carries a citation array");
  assert.equal(ld.citation.length, sourced.sources.length,
    "every source becomes exactly one citation node");
  for (const c of ld.citation) {
    assert.equal(c["@type"], "CreativeWork", "each citation is a CreativeWork");
    assert.ok(typeof c.url === "string" && /^https?:\/\//.test(c.url),
      "each citation carries a real source URL");
  }
  // The citation URLs must mirror the post's actual source URLs (no drift).
  const srcUrls = new Set(sourced.sources.map(([u]) => u));
  for (const c of ld.citation) assert.ok(srcUrls.has(c.url), "citation URL is a declared source");

  // Guarded: a piece with no sources (Dispatches/Fabrications) emits no citation key,
  // keeping the property meaningful rather than an empty array.
  const unsourced = posts.find(x => !(Array.isArray(x.sources) && x.sources.length));
  if (unsourced) {
    const ld2 = articleLd(renderArticle(unsourced, [], 0, {}));
    assert.ok(!("citation" in ld2), "a source-less piece declares no citation property");
  }
});

// A header cell is a descriptive column LABEL (not a named entity) per the SAME
// predicate render.js uses for `about` (imported, so the mirror can never drift).
const NON_ENTITY_LEAD = { test: (s) => isDescriptiveLabel(s) };
const headerCells = (out) => {
  const m = /<thead><tr>(.*?)<\/tr><\/thead>/.exec(out);
  return m ? [...m[1].matchAll(/<th scope="col">(.*?)<\/th>/g)].map(x => x[1]) : [];
};

test("comparison pieces declare schema.org `about` entities drawn from the compare-table header", () => {
  // A demand piece's at-a-glance header names exactly the things it compares (the
  // first cell is the axis label). Real entity names surface as `about` Things in the
  // article JSON-LD, sourced from the same table the reader sees, so search engines
  // get the entities the page is about. Find an entity-comparison table — one whose
  // compared columns are ALL real names (no descriptive label) — and assert a 1:1 map.
  const entityCompare = posts.find(p => {
    const out = renderArticle(p, [], 0, {});
    if (!/class="compare-table"/.test(out)) return false;
    const cols = headerCells(out).slice(1);
    return cols.length >= 2 && cols.every(c => !NON_ENTITY_LEAD.test(c));
  });
  assert.ok(entityCompare, "fixture should contain an entity-comparison piece");
  const out = renderArticle(entityCompare, [], 0, {});
  const ld = articleLd(out);
  assert.ok(Array.isArray(ld.about) && ld.about.length, "entity comparison carries a non-empty `about` array");
  ld.about.forEach(e => assert.equal(e["@type"], "Thing", "each about entry is a Thing"));
  const headers = headerCells(out);
  assert.equal(ld.about.length, headers.length - 1, "one about entity per compared column");
  ld.about.forEach((e, i) => assert.equal(esc(e.name), headers[i + 1], "about name mirrors the table column"));

  // a non-comparison piece (no compare table) must not emit a bogus `about`
  const noCompare = posts.find(p => !/class="compare-table"/.test(renderArticle(p, [], 0, {})));
  if (noCompare) assert.ok(!articleLd(renderArticle(noCompare, [], 0, {})).about, "no compare table ⇒ no about");
});

test("`about` excludes descriptive column labels (concept/how-to compare tables)", () => {
  // Not every compare table is an entity comparison: concept/how-to pages use the same
  // grid for a descriptive axis ("Failure mode | What goes wrong | The fix"). Those
  // header cells are LABELS, not things — publishing them as schema.org Things pollutes
  // the entity graph. Any header that reads as a phrase must never appear in `about`.
  let checked = 0;
  for (const p of posts) {
    const out = renderArticle(p, [], 0, {});
    if (!/class="compare-table"/.test(out)) continue;
    const labels = headerCells(out).slice(1).filter(c => NON_ENTITY_LEAD.test(c));
    if (!labels.length) continue;
    checked++;
    const ld = articleLd(out);
    const aboutNames = (ld.about || []).map(e => e.name);
    for (const label of labels) {
      assert.ok(!aboutNames.includes(label),
        `descriptive label "${label}" leaked into about on ${p.slug}`);
    }
  }
  assert.ok(checked > 0, "fixture should contain at least one concept/how-to compare table");
});

test("isDescriptiveLabel: prose column labels are labels; named entities (incl. domains/parentheticals) are not", () => {
  // Descriptive labels — must be excluded from `about`. Covers both signals:
  // leading article/interrogative/pronoun AND trailing dangling connective.
  for (const label of [
    "Best for", "Best when", "Best used for", "Reach for it when", "You charge for",
    "Breaks when", "Fails when", "Trips on", "Scales to", "Adapts to", "Optimize for",
    "Available on", "Fixed in", "Drop-in", "What goes wrong", "The catch", "How it works",
    // Generic axis/attribute header nouns (whole-cell) — descriptive-matrix labels.
    "Standard", "standards", "Dimension", "Layer", "Type", "Category", "Feature",
    "Approach", "Method", "Stage", "Capability", "Use case", "Originated",
    // Multi-word labels closing on the omitted connectives "by"/"via".
    "Originated by", "Maintained by", "Governed by", "Reached via",
    // Attribute/axis labels that were leaking into `about` on concept & how-to
    // compare tables (2026-06-29 audit). Whole-cell generic nouns…
    "Mechanism", "Cost", "Token cost", "Notable", "License", "Speed", "Weakness",
    "Granularity", "Primitive", "Best fit", "Failure mode", "Typical use",
    // …and any cell phrased as a question is an axis label, never an entity.
    "Lossy?", "Saves memory?", "Deletes orphans?", "External signal needed?",
  ]) assert.ok(isDescriptiveLabel(label), `"${label}" should read as a descriptive label`);

  // Named entities — must survive as `about` Things. Glued stop-word tails
  // ("Notion", "Speech-to-speech"), domain-shaped names ("MCP.so"), version tags,
  // and parenthetical alias lists must NEVER be mistaken for prose. The generic-noun
  // and trailing-prep signals are whole-cell/separate-token, so a name that merely
  // CONTAINS a generic word ("MCP Standard", "Layer 2 (Optimism)") or ends in a glued
  // tail ("Ruby") is still an entity.
  for (const name of [
    "LangGraph", "vLLM", "GPT-4o", "Notion", "Speech-to-speech", "End-to-end",
    "MCP.so", "Smithery / Glama / MCP.so", "Plan mode (Claude Code / Cursor)",
    "Cascaded (STT → LLM → TTS)", "Qdrant", "CrewAI",
    "MCP Standard", "Layer 2 (Optimism)", "Ruby", "Standby",
    // The new label signals must NOT swallow real subjects: hosted products and
    // frameworks (incl. attribute-shaped names), benchmarks, or the compared
    // technique-options that ARE a concept page's subject must all survive.
    "Modal", "NVIDIA NIM", "Spring AI", "LangChain4j", "SWE-bench Pro",
    "Naive RAG", "Implicit caching", "RAFT", "LATS",
  ]) assert.ok(!isDescriptiveLabel(name), `"${name}" should read as a named entity`);
});

test("transposed compare tables (roundup/spec) draw `about` from the first column, not the header", () => {
  // A roundup/spec table runs its entities DOWN the first column with attribute
  // labels across the header ("Maintainer", "Best for"). The entity axis flips to
  // the column whenever the header reconciles no catalog entity and the column
  // reconciles two or more — so the real tools become `about` Things and the
  // header labels never do. Build the same name→repo map render.js uses.
  const recon = (() => {
    const map = new Map();
    for (const t of TOOLS) if (t?.name && t.owner && t.repo) {
      const k = t.name.toLowerCase(); if (!map.has(k)) map.set(k, `https://github.com/${t.owner}/${t.repo}`);
    }
    for (const [k, u] of Object.entries(ENTITY_SAMEAS_EXTRA)) { const kk = k.toLowerCase(); if (!map.has(kk)) map.set(kk, u); }
    return (name) => {
      const k = String(name).trim().toLowerCase();
      const base = k.replace(/\s*\([^)]*\)\s*$/, "").trim();
      const unver = base.replace(/\s+v?\d+\.\d+$/, "").trim();
      return map.get(k) || map.get(base) || (unver !== base ? map.get(unver) : null) || null;
    };
  })();
  const rowHeadCells = (out) =>
    [...out.matchAll(/<tr><th scope="row">(.*?)<\/th>/g)].map(m => m[1]);
  let checked = 0;
  for (const p of posts) {
    const out = renderArticle(p, [], 0, {});
    if (!/class="compare-table"/.test(out)) continue;
    const headers = headerCells(out).slice(1);
    const rowHeads = rowHeadCells(out);
    const headerRecon = headers.filter(recon).length;
    const colRecon = rowHeads.filter(recon).length;
    if (!(headerRecon === 0 && colRecon >= 2)) continue;   // not a transposed entity table
    checked++;
    const about = (articleLd(out).about || []).map(e => esc(e.name));
    // every reconcilable first-column entity surfaces in `about`…
    for (const r of rowHeads.filter(recon)) assert.ok(about.includes(r), `column entity "${r}" should be in about on ${p.slug}`);
    // …and no header attribute label ever does
    for (const h of headers) assert.ok(!about.includes(h), `header label "${h}" must not be in about on ${p.slug}`);
  }
  assert.ok(checked > 0, "fixture should contain at least one transposed roundup table");
});

test("`about` entities that name a catalog tool carry a canonical `sameAs` repo URL", () => {
  // Entity reconciliation (#25): when a compare-table column names a real tool we
  // track (LangGraph, Qdrant, vLLM…), the matching `about` Thing must carry a
  // `sameAs` pointing at that tool's repo, so a search engine / AI agent resolves
  // the name to one specific entity. Names we don't track stay bare Things (graceful
  // degradation). Build the same name→repo aliases render.js uses, from the catalog.
  const expected = new Map();
  const repoDerived = new Set();   // keys whose canonical id is a repo (must be repo-shaped)
  for (const t of TOOLS) {
    if (!t?.name || !t.owner || !t.repo) continue;
    const url = `https://github.com/${t.owner}/${t.repo}`;
    const add = (k) => { const key = String(k).trim().toLowerCase(); if (key && !expected.has(key)) { expected.set(key, url); repoDerived.add(key); } };
    add(t.name);
    const paren = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(t.name);
    if (paren) { add(paren[1]); add(paren[2]); }
  }
  // curated supplemental reconciliation (#25 extended to hosted services / sub-
  // products the repo catalog can't hold); repo catalog wins on any collision.
  for (const [k, url] of Object.entries(ENTITY_SAMEAS_EXTRA)) {
    const key = String(k).trim().toLowerCase();
    if (key && !expected.has(key)) expected.set(key, url);
  }

  let matchesSeen = 0;
  for (const p of posts) {
    const ld = articleLd(renderArticle(p, [], 0, {}));
    if (!Array.isArray(ld.about)) continue;
    for (const e of ld.about) {
      const key = String(e.name).trim().toLowerCase();
      // mirror entitySameAs: full name, else the pre-parenthetical base, else the
      // base with a trailing decimal release version stripped ("LangChain 1.0").
      const baseKey = key.replace(/\s*\([^)]*\)\s*$/, "").trim();
      const verKey = baseKey.replace(/\s+v?\d+\.\d+$/, "").trim();
      const want = expected.get(key) || expected.get(baseKey) || (verKey !== baseKey ? expected.get(verKey) : undefined);
      if (want) {
        assert.equal(e.sameAs, want, `about entity "${e.name}" should reconcile to ${want}`);
        matchesSeen++;
      } else {
        assert.ok(!("sameAs" in e), `untracked about entity "${e.name}" must stay a bare Thing`);
      }
      // any sameAs we emit must be a canonical https identity URL, never a guess;
      // repo-catalog entities must resolve specifically to their GitHub repo.
      if (e.sameAs) {
        assert.match(e.sameAs, /^https:\/\/[^\s]+$/, "sameAs is an https URL");
        if (repoDerived.has(key)) assert.match(e.sameAs, /^https:\/\/github\.com\/[^/]+\/[^/]+$/, "catalog tool sameAs is a repo URL");
      }
    }
  }
  // prove the feature is exercised by the real corpus, not just dead code
  assert.ok(matchesSeen > 0, "at least one comparison piece should reconcile a column to a catalog tool");
});

test("flash-attention-vs-paged-attention reconciles both technique columns to canonical homes (#25)", () => {
  // FlashAttention (compute kernel) and PagedAttention (KV-cache memory algorithm)
  // are techniques, not catalog tools, but each has a single canonical home, so the
  // page's `about` graph must resolve both — not leave them as bare Things. Pins the
  // exact identities so a map edit or a column rename can't silently re-orphan them.
  const p = posts.find(x => x.slug === "flash-attention-vs-paged-attention");
  if (!p) return; // skip if the fixture corpus doesn't include this piece
  const ld = articleLd(renderArticle(p, [], 0, {}));
  const by = Object.fromEntries((ld.about || []).map(e => [e.name, e.sameAs]));
  assert.equal(by["FlashAttention"], "https://github.com/Dao-AILab/flash-attention");
  assert.equal(by["PagedAttention"], "https://github.com/vllm-project/vllm");
});

test("the 2026-06-30 framework-release & memory-benchmark money pages reconcile every compared entity (#25)", () => {
  // Two new demand pages introduced fresh #25 gaps that the prior maps missed:
  //  • langchain-1-0-and-langgraph-1-0-whats-new names "LangChain 1.0" / "LangGraph 1.0"
  //    as header columns — a trailing *release version* the bare catalog keys
  //    (langchain, langgraph) only reach because entitySameAs now strips a " 1.0" tail.
  //  • locomo-vs-longmemeval-vs-beam-agent-memory is a TRANSPOSED table whose first
  //    column names three memory benchmarks, none in the catalog, so the whole
  //    high-intent "agent memory benchmark" page shipped ZERO `about` Things until the
  //    three were keyed. Pin the exact identities so a map edit, a version bump, or a
  //    column rename can't silently re-orphan either page.
  const want = {
    "langchain-1-0-and-langgraph-1-0-whats-new": {
      "LangChain 1.0": "https://github.com/langchain-ai/langchain",
      "LangGraph 1.0": "https://github.com/langchain-ai/langgraph",
    },
    "locomo-vs-longmemeval-vs-beam-agent-memory": {
      "LoCoMo (2024)": "https://github.com/snap-research/locomo",
      "LongMemEval (ICLR 2025)": "https://github.com/xiaowu0162/LongMemEval",
      "BEAM (ICLR 2026)": "https://github.com/mohammadtavakoli78/BEAM",
    },
  };
  let pagesChecked = 0;
  for (const [slug, names] of Object.entries(want)) {
    const p = posts.find(x => x.slug === slug);
    if (!p) continue; // skip if the fixture corpus doesn't include this piece
    pagesChecked++;
    const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [esc(e.name), e.sameAs]));
    for (const [name, url] of Object.entries(names)) {
      assert.equal(by[esc(name)], url, `${slug}: "${name}" should reconcile to ${url}`);
    }
  }
  assert.ok(pagesChecked > 0, "fixture should include at least one of the two new money pages");
});

test("inference-engine compare columns reconcile to canonical serving-runtime repos (#25)", () => {
  // The "which inference engine" cluster is the densest #25 gap: vLLM/SGLang/Ollama/
  // TensorRT-LLM/TGI are named as compare columns on the highest-intent inference money
  // pages but none is in the TOOLS catalog, so every column shipped as a bare Thing.
  // Each has one canonical home (its serving-runtime repo); pin the exact identities so
  // a map edit or column rename can't silently re-orphan them.
  const want = {
    "vLLM": "https://github.com/vllm-project/vllm",
    "SGLang": "https://github.com/sgl-project/sglang",
    "Ollama": "https://github.com/ollama/ollama",
    "TensorRT-LLM": "https://github.com/NVIDIA/TensorRT-LLM",
    "TGI": "https://github.com/huggingface/text-generation-inference",
  };
  const p = posts.find(x => x.slug === "vllm-vs-sglang-vs-ollama-inference-engine");
  if (!p) return; // skip if the fixture corpus doesn't include this piece
  const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [e.name, e.sameAs]));
  // every engine this page names as a column must now carry its canonical sameAs
  for (const [name, url] of Object.entries(want)) {
    if (name in by) assert.equal(by[name], url, `${name} should reconcile to ${url}`);
  }
  // and at least one of them actually surfaced (proves the page exercises the map)
  assert.ok(Object.keys(want).some(n => by[n]), "an inference engine reconciled on the page");
});

test("glm-5-2 model-comparison columns reconcile to canonical model homes (#25)", () => {
  // glm-5-2-open-weight-agentic-coding compares three flagship MODEL VERSIONS as header
  // columns ("GLM-5.2 | GPT-5.5 | Claude Opus 4.8"). The bare provider keys (gpt, claude)
  // are exact-match and intentionally don't catch a versioned cell, so all three shipped
  // as bare Things on a high-intent "which model for agentic coding" query until keyed.
  // Open weight → published model home (zai-org HF card, GLM-4.6's repo-role analogue);
  // closed → vendor model page. Pin the identities so a map edit or column rename can't
  // silently re-orphan them.
  const want = {
    "GLM-5.2": "https://huggingface.co/zai-org/GLM-5.2",
    "GPT-5.5": "https://openai.com",
    "Claude Opus 4.8": "https://www.anthropic.com/claude/opus",
  };
  const p = posts.find(x => x.slug === "glm-5-2-open-weight-agentic-coding");
  if (!p) return; // skip if the fixture corpus doesn't include this piece
  const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [e.name, e.sameAs]));
  for (const [name, url] of Object.entries(want)) {
    assert.equal(by[name], url, `${name} should reconcile to ${url}`);
  }
});

test("coding-model + coding-agent-eval money pages reconcile every compared entity (#25)", () => {
  // The 2026-07-01 coding-agents cluster: gpt-5-5-vs-claude-opus-4-8-vs-gemini-for-coding
  // compares three flagship model versions, and how-to-evaluate-an-ai-coding-agent
  // compares three coding benchmarks. GPT-5.5/Opus 4.8 already reconcile (run 142) and
  // SWE-bench/Terminal-Bench resolve via the decimal-strip fallback, but "Gemini 3.5 Flash"
  // (ends in a word, not a version → no strip) and "SWE-bench Pro" (a distinct Scale
  // benchmark, not the SWE-bench family site) shipped bare until keyed. Pin all six so a
  // map edit or column rename can't silently re-orphan a column beside its reconciled peers.
  const want = {
    "gpt-5-5-vs-claude-opus-4-8-vs-gemini-for-coding": {
      "GPT-5.5 (Codex CLI)": "https://openai.com",
      "Claude Opus 4.8 (Claude Code)": "https://www.anthropic.com/claude/opus",
      "Gemini 3.5 Flash": "https://ai.google.dev/gemini-api",
    },
    "how-to-evaluate-an-ai-coding-agent": {
      "SWE-bench Verified": "https://www.swebench.com/",
      "SWE-bench Pro": "https://github.com/scaleapi/SWE-bench_Pro-os",
      "Terminal-Bench 2.0": "https://www.tbench.ai/",
    },
  };
  for (const [slug, cols] of Object.entries(want)) {
    const p = posts.find(x => x.slug === slug);
    if (!p) continue; // skip if the fixture corpus doesn't include this piece
    const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [e.name, e.sameAs]));
    for (const [name, url] of Object.entries(cols)) {
      assert.equal(by[name], url, `${slug}: ${name} should reconcile to ${url}`);
    }
  }
});

test("text-embedding-model compare columns reconcile to canonical model homes (#25)", () => {
  // qwen3-embedding-vs-embeddinggemma-vs-bge-m3 names four flagship embedding models as
  // header columns; embedding models are weight/code releases, not agent-tool catalog
  // entries, so the whole "best embedding model for RAG" comparison shipped every column
  // bare until keyed. Weight releases → maker's HF model page; code+model project → repo.
  // Pin the identities so a map edit or column rename can't silently re-orphan them.
  const want = {
    "EmbeddingGemma": "https://huggingface.co/google/embeddinggemma-300m",
    "Qwen3-Embedding": "https://github.com/QwenLM/Qwen3-Embedding",
    "BGE-M3": "https://huggingface.co/BAAI/bge-m3",
    "Nomic Embed v2": "https://huggingface.co/nomic-ai/nomic-embed-text-v2-moe",
  };
  const p = posts.find(x => x.slug === "qwen3-embedding-vs-embeddinggemma-vs-bge-m3");
  if (!p) return; // skip if the fixture corpus doesn't include this piece
  const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [e.name, e.sameAs]));
  for (const [name, url] of Object.entries(want)) {
    if (name in by) assert.equal(by[name], url, `${name} should reconcile to ${url}`);
  }
  assert.ok(Object.keys(want).some(n => by[n]), "an embedding model reconciled on the page");
});

test("multimodal-embedding compare columns reconcile to canonical model homes (#25)", () => {
  // clip-vs-siglip-vs-jina-clip-multimodal-embeddings is a dense "which multimodal
  // embedding model" money page whose every entity column shipped a bare Thing — none
  // of these model weights is in the TOOLS catalog. Each has one canonical home (the
  // original repo for OpenAI CLIP, the maker's Hugging Face model/collection page for
  // the rest); pin the exact identities so a map edit or column rename can't silently
  // re-orphan them.
  const want = {
    "OpenAI CLIP": "https://github.com/openai/CLIP",
    "SigLIP 2": "https://huggingface.co/collections/google/siglip2",
    "Jina CLIP v2": "https://huggingface.co/jinaai/jina-clip-v2",
    "Nomic Embed Vision v1.5": "https://huggingface.co/nomic-ai/nomic-embed-vision-v1.5",
  };
  const p = posts.find(x => x.slug.endsWith("clip-vs-siglip-vs-jina-clip-multimodal-embeddings"));
  if (!p) return; // skip if the fixture corpus doesn't include this piece
  const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [e.name, e.sameAs]));
  for (const [name, url] of Object.entries(want)) {
    if (name in by) assert.equal(by[name], url, `${name} should reconcile to ${url}`);
  }
  assert.ok(Object.keys(want).some(n => by[n]), "a multimodal embedding model reconciled on the page");
});

test("prompt-compression + Semantic Kernel compare columns reconcile to canonical homes (#25)", () => {
  // Two genuine-product gaps left after the recall vein drained to concepts. The
  // prompt-compression money page ran all four column entities bare (the LLMLingua
  // family all ship from one repo; Selective Context from its author's repo), and the
  // agent-framework comparison left Semantic Kernel bare (AutoGen/MAF reconcile, SK did
  // not). Pin the exact identities so a map edit or column rename can't re-orphan them.
  const cases = [
    ["prompt-compression-llmlingua-vs-selective-context", {
      "LLMLingua": "https://github.com/microsoft/LLMLingua",
      "LongLLMLingua": "https://github.com/microsoft/LLMLingua",
      "LLMLingua-2": "https://github.com/microsoft/LLMLingua",
      "Selective Context": "https://github.com/liyucheng09/Selective_Context",
    }],
    ["semantic-kernel-vs-autogen-vs-microsoft-agent-framework", {
      "Semantic Kernel": "https://github.com/microsoft/semantic-kernel",
    }],
  ];
  let exercised = 0;
  for (const [slugTail, want] of cases) {
    const p = posts.find(x => x.slug.endsWith(slugTail));
    if (!p) continue; // skip if the fixture corpus doesn't include this piece
    const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [e.name, e.sameAs]));
    for (const [name, url] of Object.entries(want)) {
      if (name in by) assert.equal(by[name], url, `${name} should reconcile to ${url}`);
    }
    if (Object.keys(want).some(n => by[n])) exercised++;
  }
  assert.ok(exercised > 0, "at least one of the pinned pages exercised the map");
});

test("managed-agent-runtime compare columns reconcile to canonical product homes (#25)", () => {
  // The "where does my agent run" money page names three managed agent runtimes as
  // compare columns. "Bedrock AgentCore" reconciled via the cloud-platform block, but
  // its two siblings are distinct PRODUCTS (not the parent "Vertex AI" / "Azure AI
  // Foundry" already keyed), each with its own canonical docs home, so the column
  // shipped bare. Pin the exact identities (reconciled via the paren-strip fallback)
  // so a map edit or column rename can't silently re-orphan them.
  const want = {
    "Bedrock AgentCore (AWS)": "https://aws.amazon.com/bedrock/agentcore/",
    "Vertex Agent Engine (Google)": "https://cloud.google.com/vertex-ai/generative-ai/docs/agent-engine/overview",
    "Foundry Hosted Agents (Microsoft)": "https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/hosted-agents",
  };
  const p = posts.find(x => x.slug === "bedrock-agentcore-vs-vertex-agent-engine-vs-foundry-hosted-agents");
  if (!p) return; // skip if the fixture corpus doesn't include this piece
  const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [e.name, e.sameAs]));
  for (const [name, url] of Object.entries(want)) {
    if (name in by) assert.equal(by[name], url, `${name} should reconcile to ${url}`);
  }
  // all three columns must reconcile — the page's whole point is disambiguating them
  assert.ok(Object.keys(want).every(n => by[n]), "every managed-runtime column reconciled on the page");
});

test("structured-output compare columns reconcile to canonical library repos (#25)", () => {
  // The "reliable structured output" cluster (instructor-vs-outlines-vs-baml-structured-
  // outputs, outlines-vs-xgrammar-vs-llguidance) names these libraries as compare columns
  // but none is in the TOOLS catalog, so the whole cluster shipped bare Things. Each has
  // one canonical repo; pin the exact identities so a map edit or column rename can't
  // silently re-orphan them.
  const want = {
    "Instructor": "https://github.com/567-labs/instructor",
    "Outlines": "https://github.com/dottxt-ai/outlines",
    "BAML": "https://github.com/BoundaryML/baml",
    "XGrammar": "https://github.com/mlc-ai/xgrammar",
    "llguidance": "https://github.com/guidance-ai/llguidance",
  };
  let surfaced = 0;
  for (const slug of ["instructor-vs-outlines-vs-baml-structured-outputs", "outlines-vs-xgrammar-vs-llguidance"]) {
    const p = posts.find(x => x.slug === slug);
    if (!p) continue; // skip if the fixture corpus doesn't include this piece
    const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [e.name, e.sameAs]));
    for (const [name, url] of Object.entries(want)) {
      if (name in by) { assert.equal(by[name], url, `${name} should reconcile to ${url}`); surfaced++; }
    }
  }
  assert.ok(surfaced > 0, "a structured-output library reconciled on its money page");
});

test("LLM router/gateway compare columns reconcile to canonical homes (#25)", () => {
  // The "which LLM router / gateway" cluster (litellm-vs-portkey-vs-tensorzero,
  // routellm-vs-notdiamond-vs-martian) names five products as compare columns, but only
  // LiteLLM (mapped) reconciled — Portkey, TensorZero, RouteLLM, NotDiamond and Martian
  // each shipped a bare Thing on high-commercial-intent routing/gateway queries. OSS →
  // repo, closed hosted → official site. Pin the exact identities so a map edit or a
  // column rename can't silently re-orphan them.
  const want = {
    "Portkey": "https://github.com/Portkey-AI/gateway",
    "TensorZero": "https://github.com/tensorzero/tensorzero",
    "RouteLLM": "https://github.com/lm-sys/RouteLLM",
    "NotDiamond": "https://www.notdiamond.ai",
    "Martian": "https://withmartian.com",
  };
  let surfaced = 0;
  for (const slug of ["2026-06-21-litellm-vs-portkey-vs-tensorzero", "2026-06-21-routellm-vs-notdiamond-vs-martian"]) {
    const p = posts.find(x => x.slug === slug);
    if (!p) continue; // skip if the fixture corpus doesn't include this piece
    const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [e.name, e.sameAs]));
    for (const [name, url] of Object.entries(want)) {
      if (name in by) { assert.equal(by[name], url, `${name} should reconcile to ${url}`); surfaced++; }
    }
  }
  assert.ok(surfaced > 0, "an LLM router/gateway reconciled on its money page");
});

test("durable-execution + prompt-optimization OSS-framework columns reconcile (#25)", () => {
  // Two OSS-framework comparison clusters whose non-catalog columns shipped bare:
  // temporal-vs-inngest-vs-restate-durable-agents (Temporal reconciles via the TOOLS
  // catalog; Inngest + Restate did not) and dspy-vs-textgrad-vs-adalflow (DSPy via the
  // catalog; TextGrad + AdalFlow bare). Each is a real OSS project with one canonical
  // repo; pin the exact identities so a map edit or a column rename can't silently
  // re-orphan them on these high-intent "X vs Y" infra/optimizer queries.
  const want = {
    "Inngest": "https://github.com/inngest/inngest",
    "Restate": "https://github.com/restatedev/restate",
    "TextGrad": "https://github.com/zou-group/textgrad",
    "AdalFlow": "https://github.com/SylphAI-Inc/AdalFlow",
  };
  let surfaced = 0;
  for (const slug of ["2026-06-21-temporal-vs-inngest-vs-restate-durable-agents", "2026-06-21-dspy-vs-textgrad-vs-adalflow"]) {
    const p = posts.find(x => x.slug === slug);
    if (!p) continue; // skip if the fixture corpus doesn't include this piece
    const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [e.name, e.sameAs]));
    for (const [name, url] of Object.entries(want)) {
      if (name in by) { assert.equal(by[name], url, `${name} should reconcile to ${url}`); surfaced++; }
    }
  }
  assert.ok(surfaced > 0, "a durable-execution / prompt-optimization framework reconciled on its money page");
});

test("prompt-injection detector compare columns reconcile to canonical repos (#25)", () => {
  // The dedicated LLM-security money page rebuff-vs-llm-guard-vs-vigil-prompt-injection
  // names three detectors as compare columns, but none is in the TOOLS catalog, so every
  // entity shipped a bare Thing on the high-intent "which prompt-injection detector" query.
  // Each is OSS with one canonical repo; pin the exact identities so a map edit or a column
  // rename can't silently re-orphan them.
  const want = {
    "Rebuff": "https://github.com/protectai/rebuff",
    "LLM Guard": "https://github.com/protectai/llm-guard",
    "Vigil": "https://github.com/deadbits/vigil-llm",
  };
  let surfaced = 0;
  for (const slug of ["2026-06-22-rebuff-vs-llm-guard-vs-vigil-prompt-injection", "rebuff-vs-llm-guard-vs-vigil-prompt-injection"]) {
    const p = posts.find(x => x.slug === slug);
    if (!p) continue; // skip if the fixture corpus doesn't include this piece
    const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [e.name, e.sameAs]));
    for (const [name, url] of Object.entries(want)) {
      if (name in by) { assert.equal(by[name], url, `${name} should reconcile to ${url}`); surfaced++; }
    }
  }
  assert.ok(surfaced > 0, "a prompt-injection detector reconciled on its money page");
});

test("AI code-review compare columns reconcile to canonical homes (#25)", () => {
  // The highest-commercial-intent product page still shipping every column bare —
  // coderabbit-vs-greptile-vs-qodo-ai-code-review names four AI code-review tools as
  // compare columns, none in the TOOLS catalog, so the "which AI code review tool" query
  // carried no canonical identity. All four are closed, hosted products → official sites,
  // verified live. Pin the exact identities (incl. the versioned/qualified cells "Qodo
  // 2.0"/"Graphite Diamond", which the matcher does NOT strip) so a map edit or a column
  // rename can't silently re-orphan them.
  const want = {
    "CodeRabbit": "https://www.coderabbit.ai",
    "Greptile": "https://www.greptile.com",
    "Qodo 2.0": "https://www.qodo.ai",
    "Graphite Diamond": "https://graphite.dev",
  };
  let surfaced = 0;
  for (const slug of ["coderabbit-vs-greptile-vs-qodo-ai-code-review"]) {
    const p = posts.find(x => x.slug === slug);
    if (!p) continue; // skip if the fixture corpus doesn't include this piece
    const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [e.name, e.sameAs]));
    for (const [name, url] of Object.entries(want)) {
      if (name in by) { assert.equal(by[name], url, `${name} should reconcile to ${url}`); surfaced++; }
    }
  }
  assert.ok(surfaced > 0, "an AI code-review tool reconciled on its money page");
});

test("OCR / PDF-parser compare columns reconcile to canonical homes (#25)", () => {
  // The "best PDF parser for RAG" money page olmocr-vs-marker-vs-mineru-vs-mistral-ocr
  // names four engines as compare columns; MinerU already reconciles via the TOOLS
  // catalog, but olmOCR, Marker and Mistral OCR shipped bare. OSS → repo, closed API →
  // official product page. Pin the exact identities so a map edit or a column rename
  // can't silently re-orphan them. (`marker` is generic but corpus-scanned to appear as
  // a compare cell only on this page, so exact-match keying poaches nothing.)
  const want = {
    "olmOCR": "https://github.com/allenai/olmocr",
    "Marker": "https://github.com/datalab-to/marker",
    "MinerU": "https://github.com/opendatalab/MinerU",
    "Mistral OCR": "https://mistral.ai/news/mistral-ocr/",
  };
  let surfaced = 0;
  for (const slug of ["2026-06-22-olmocr-vs-marker-vs-mineru-vs-mistral-ocr"]) {
    const p = posts.find(x => x.slug === slug);
    if (!p) continue; // skip if the fixture corpus doesn't include this piece
    const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [e.name, e.sameAs]));
    for (const [name, url] of Object.entries(want)) {
      if (name in by) { assert.equal(by[name], url, `${name} should reconcile to ${url}`); surfaced++; }
    }
  }
  assert.ok(surfaced > 0, "an OCR engine reconciled on its money page");
});

test("commercial LLM/inference-provider compare columns reconcile to canonical sites (#25)", () => {
  // The densest remaining #25 gap: the closed, hosted providers & cloud AI platforms.
  // None has an agent-tool repo, so the TOOLS catalog can't reach them and every
  // provider/model column shipped bare across the highest-intent money pages. A hosted
  // service's canonical identity is its official site (the OpenRouter→openrouter.ai
  // precedent). Pin the exact identities so a map edit or column rename can't re-orphan
  // them. "Anthropic (Claude)" reconciles via the parenthetical fallback (→ "anthropic").
  const want = {
    "Anthropic (Claude)": "https://www.anthropic.com",
    "OpenAI": "https://openai.com",
    "Google Gemini": "https://ai.google.dev/gemini-api",
    "AWS Bedrock": "https://aws.amazon.com/bedrock/",
    "Groq": "https://groq.com",
    "Together AI": "https://www.together.ai",
    "Fireworks AI": "https://fireworks.ai",
    "Vertex AI": "https://cloud.google.com/vertex-ai",
    "Azure AI Foundry": "https://azure.microsoft.com/en-us/products/ai-foundry",
  };
  let surfaced = 0;
  for (const slug of [
    "prompt-caching-pricing-anthropic-vs-openai-vs-gemini-vs-bedrock",
    "groq-vs-together-vs-fireworks-inference",
    "bedrock-vs-vertex-ai-vs-azure-ai-foundry",
  ]) {
    const p = posts.find(x => x.slug === slug);
    if (!p) continue; // skip if the fixture corpus doesn't include this piece
    const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [e.name, e.sameAs]));
    for (const [name, url] of Object.entries(want)) {
      if (name in by) { assert.equal(by[name], url, `${name} should reconcile to ${url}`); surfaced++; }
    }
  }
  assert.ok(surfaced > 0, "a commercial provider reconciled on its money page");
});

test("search/graph stores + hosted vector DBs reconcile to canonical homes (#25)", () => {
  // The TOOLS catalog reaches the OSS vector-DB column, but the hosted and
  // search/graph-engine neighbours that share those money pages shipped bare:
  // Pinecone/Turbopuffer/Cloudflare Vectorize (serverless vector), the Lucene/
  // serving search engines (Elasticsearch/OpenSearch/Vespa), and the whole
  // GraphRAG graph-DB cluster (Neo4j/FalkorDB/Memgraph). OSS → repo, hosted →
  // official site. Pin the exact identities so a map edit or column rename can't
  // silently re-orphan them. "Pinecone (serverless)" resolves via the
  // pre-parenthetical base fallback (→ "pinecone").
  const want = {
    "Pinecone": "https://www.pinecone.io",
    "Pinecone (serverless)": "https://www.pinecone.io",
    "Turbopuffer": "https://turbopuffer.com",
    "Cloudflare Vectorize": "https://www.cloudflare.com/products/vectorize/",
    "Elasticsearch": "https://github.com/elastic/elasticsearch",
    "OpenSearch": "https://github.com/opensearch-project/OpenSearch",
    "Vespa": "https://github.com/vespa-engine/vespa",
    "Neo4j": "https://github.com/neo4j/neo4j",
    "FalkorDB": "https://github.com/FalkorDB/FalkorDB",
    "Memgraph": "https://github.com/memgraph/memgraph",
  };
  let surfaced = 0;
  for (const slug of [
    "pgvector-vs-pinecone-vs-qdrant",
    "2026-06-23-turbopuffer-vs-pinecone-vs-vectorize",
    "elasticsearch-vs-opensearch-vs-vespa-hybrid-search",
    "neo4j-vs-falkordb-vs-memgraph",
  ]) {
    const p = posts.find(x => x.slug === slug);
    if (!p) continue; // skip if the fixture corpus doesn't include this piece
    const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [e.name, e.sameAs]));
    for (const [name, url] of Object.entries(want)) {
      if (name in by) { assert.equal(by[name], url, `${name} should reconcile to ${url}`); surfaced++; }
    }
  }
  assert.ok(surfaced > 0, "a search/graph/hosted vector store reconciled on its money page");
});

test("serverless-GPU hosts + model-serving frameworks reconcile to canonical homes (#25)", () => {
  // The "where do I deploy / serve my model" cluster: the serverless-GPU hosts
  // (Modal/Replicate/RunPod/Baseten) and the OSS serving frameworks (BentoML/Ray
  // Serve/KServe) are named as compare columns on their money pages but none is in
  // the TOOLS catalog, so every column shipped a bare Thing. Hosted → official site
  // (the OpenRouter→openrouter.ai precedent), OSS → canonical repo; Ray Serve lives
  // in the Ray monorepo, so it reconciles to ray-project/ray. Pin the exact
  // identities so a map edit or column rename can't silently re-orphan them.
  const want = {
    "Modal": "https://modal.com",
    "Replicate": "https://replicate.com",
    "RunPod": "https://www.runpod.io",
    "Baseten": "https://www.baseten.co",
    "BentoML": "https://github.com/bentoml/BentoML",
    "Ray Serve": "https://github.com/ray-project/ray",
    "KServe": "https://github.com/kserve/kserve",
  };
  let surfaced = 0;
  for (const slug of [
    "2026-06-22-modal-vs-replicate-vs-runpod-vs-baseten",
    "2026-06-22-bentoml-vs-ray-serve-vs-kserve",
    "e2b-vs-modal-vs-daytona-agent-sandboxes",
  ]) {
    const p = posts.find(x => x.slug === slug);
    if (!p) continue; // skip if the fixture corpus doesn't include this piece
    const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [e.name, e.sameAs]));
    for (const [name, url] of Object.entries(want)) {
      if (name in by) { assert.equal(by[name], url, `${name} should reconcile to ${url}`); surfaced++; }
    }
  }
  assert.ok(surfaced > 0, "a serverless-GPU host or serving framework reconciled on its money page");
});

test("the last bare compare columns (NVIDIA NIM, Spring AI, LangChain4j) reconcile to canonical homes (#25)", () => {
  // The three real entities still shipping bare after the serving-framework pass:
  // NVIDIA NIM (packaged inference microservice — the vLLM/TGI columns on its page
  // already reconcile, only NIM was bare) keys to its official product page; Spring AI
  // and LangChain4j (both columns of the JVM agent-framework page) key to their
  // canonical OSS repos. None is in the Python/TS-centric TOOLS catalog. Pin the exact
  // identities so a map edit or column rename can't silently re-orphan them.
  const want = {
    "NVIDIA NIM": "https://www.nvidia.com/en-us/ai-data-science/products/nim-microservices/",
    "Spring AI": "https://github.com/spring-projects/spring-ai",
    "LangChain4j": "https://github.com/langchain4j/langchain4j",
  };
  let surfaced = 0;
  for (const slug of [
    "nvidia-nim-vs-vllm-vs-tgi-self-hosting-llm-inference",
    "spring-ai-vs-langchain4j",
  ]) {
    const p = posts.find(x => x.slug === slug);
    if (!p) continue; // skip if the fixture corpus doesn't include this piece
    const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [e.name, e.sameAs]));
    for (const [name, url] of Object.entries(want)) {
      if (name in by) { assert.equal(by[name], url, `${name} should reconcile to ${url}`); surfaced++; }
    }
  }
  assert.ok(surfaced > 0, "NVIDIA NIM, Spring AI, or LangChain4j reconciled on its money page");
});

test("AI app-builder + OSS visual-builder compare columns reconcile to canonical homes (#25)", () => {
  // Two high-commercial-intent "build it without writing it" money pages shipped
  // every entity column bare — none of these prompt-to-app or visual-builder products
  // is in the TOOLS catalog. Hosted builders → official site (OpenRouter/Modal
  // precedent); OSS builders → canonical repo. "v0 (Vercel)" reconciles via the
  // parenthetical fallback (→ "v0"). Pin the exact identities so a map edit or a
  // column rename can't silently re-orphan them.
  const want = {
    "Lovable": "https://lovable.dev",
    "Bolt.new": "https://bolt.new",
    "v0 (Vercel)": "https://v0.dev",
    "Replit Agent": "https://replit.com",
    "n8n": "https://github.com/n8n-io/n8n",
    "Flowise": "https://github.com/FlowiseAI/Flowise",
    "Langflow": "https://github.com/langflow-ai/langflow",
  };
  let surfaced = 0;
  for (const slug of [
    "lovable-vs-bolt-vs-v0-vs-replit-ai-app-builder",
    "n8n-vs-flowise-vs-langflow",
  ]) {
    const p = posts.find(x => x.slug === slug);
    if (!p) continue; // skip if the fixture corpus doesn't include this piece
    const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [e.name, e.sameAs]));
    for (const [name, url] of Object.entries(want)) {
      if (name in by) { assert.equal(by[name], url, `${name} should reconcile to ${url}`); surfaced++; }
    }
  }
  assert.ok(surfaced > 0, "an app-builder or visual-builder column reconciled on its money page");
});

test("microsoft-agent-framework-build-2026 reconciles the CodeAct technique column (#25)", () => {
  // CodeAct is an agent-action technique (one executable program per task, not a
  // tool-call-per-turn JSON loop), not a catalog tool, so the compare column that
  // names it shipped as a bare Thing. It has one canonical home — the ICML 2024
  // "Executable Code Actions Elicit Better LLM Agents" repo — so the `about` graph
  // must resolve it. Pin the exact identity so a map edit or rename can't re-orphan it.
  const p = posts.find(x => x.slug === "microsoft-agent-framework-build-2026");
  if (!p) return; // skip if the fixture corpus doesn't include this piece
  const ld = articleLd(renderArticle(p, [], 0, {}));
  const by = Object.fromEntries((ld.about || []).map(e => [e.name, e.sameAs]));
  assert.equal(by["CodeAct"], "https://github.com/xingyaoww/code-act");
});

test("document/web-ingestion compare columns reconcile to canonical homes (#25)", () => {
  // The top-of-funnel ingestion cluster (parsers + crawlers) had its compare tables
  // backfilled but never its entity graph: Docling/Unstructured/LlamaParse and
  // Jina Reader/Crawl4AI/Firecrawl are none of them in the TOOLS catalog, so every
  // column on these two high-intent money pages shipped as a bare Thing. Pin the exact
  // identities so a map edit or column rename can't silently re-orphan them.
  const want = {
    "Docling": "https://github.com/docling-project/docling",
    "Unstructured": "https://github.com/Unstructured-IO/unstructured",
    "LlamaParse": "https://github.com/run-llama/llama_cloud_services",
    "Jina Reader": "https://github.com/jina-ai/reader",
    "Crawl4AI": "https://github.com/unclecode/crawl4ai",
    "Firecrawl": "https://github.com/mendableai/firecrawl",
  };
  const bare = s => String(s).replace(/^\d{4}-\d\d-\d\d-/, "");
  let seen = 0;
  for (const slug of ["docling-vs-unstructured-vs-llamaparse", "firecrawl-vs-crawl4ai-vs-jina-reader"]) {
    const p = posts.find(x => bare(x.slug) === slug);
    if (!p) continue;
    const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [e.name, e.sameAs]));
    for (const [name, url] of Object.entries(want)) {
      if (name in by) { assert.equal(by[name], url, `${name} should reconcile to ${url}`); seen++; }
    }
  }
  assert.ok(seen > 0, "a document/web-ingestion column reconciled on the page");
});

test("eval/observability-platform compare columns reconcile to canonical homes (#25)", () => {
  // The Evals & Observability cluster's "which platform" money pages named Arize, Opik,
  // LangWatch, OpenLLMetry, and OpenInference as compare columns, but none was in the
  // TOOLS catalog so each shipped as a bare Thing (Langfuse/LangSmith/Braintrust/Phoenix/
  // DeepEval/Ragas/Promptfoo already reconcile). Each has one canonical home — OSS repo
  // or, for the hosted Arize umbrella, its official site. Pin the exact identities so a
  // map edit or column rename can't silently re-orphan them.
  const want = {
    "Arize (Phoenix / AX)": "https://arize.com",
    "Comet Opik": "https://github.com/comet-ml/opik",
    "LangWatch": "https://github.com/langwatch/langwatch",
    "Traceloop / OpenLLMetry": "https://github.com/traceloop/openllmetry",
    "OpenLLMetry": "https://github.com/traceloop/openllmetry",
    "OpenInference": "https://github.com/Arize-ai/openinference",
  };
  const bare = s => String(s).replace(/^\d{4}-\d\d-\d\d-/, "");
  let seen = 0;
  for (const slug of ["braintrust-vs-arize-vs-opik-llm-eval-platforms", "openllmetry-vs-openinference-otel-llm-observability"]) {
    const p = posts.find(x => bare(x.slug) === slug);
    if (!p) continue;
    const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [e.name, e.sameAs]));
    for (const [name, url] of Object.entries(want)) {
      if (name in by) { assert.equal(by[name], url, `${name} should reconcile to ${url}`); seen++; }
    }
  }
  assert.ok(seen > 0, "an eval/observability-platform column reconciled on the page");
});

test("voice/speech-cluster compare columns reconcile to canonical homes (#25)", () => {
  // The whole voice desk (TTS/STT/diarization/turn-taking/realtime frameworks) named
  // real products + OSS projects as compare columns, none in the TOOLS catalog, so
  // every money page shipped its entity columns as bare Things. Reconciled to verified
  // repos (OSS) or official sites (hosted, per the OpenRouter/LangSmith precedent);
  // Sortformer reconciles to the NeMo repo it ships inside. Category/technique cells
  // ("Cloud STT (…)", "VAD (Silero / WebRTC)", "Semantic end-of-utterance") stay bare.
  // Pin the exact identities so a map edit or column rename can't silently re-orphan them.
  const want = {
    "pyannote.audio": "https://github.com/pyannote/pyannote-audio",
    "NeMo Streaming Sortformer": "https://github.com/NVIDIA-NeMo/NeMo",
    "Whisper (open)": "https://github.com/openai/whisper",
    "Kokoro-82M (self-host)": "https://github.com/hexgrad/kokoro",
    "LiveKit Agents": "https://github.com/livekit/agents",
    "Pipecat": "https://github.com/pipecat-ai/pipecat",
    "Cartesia Sonic": "https://www.cartesia.ai/sonic",
    "ElevenLabs (Flash / Turbo)": "https://elevenlabs.io",
    "Vapi": "https://vapi.ai",
    "Deepgram Flux": "https://deepgram.com",
    "AssemblyAI Universal-Streaming": "https://www.assemblyai.com",
    "OpenAI Realtime API": "https://platform.openai.com/docs/guides/realtime",
    "Gemini Live API": "https://ai.google.dev/gemini-api/docs/live",
  };
  const bare = s => String(s).replace(/^\d{4}-\d\d-\d\d-/, "");
  let seen = 0;
  for (const slug of [
    "pyannote-vs-nemo-vs-cloud-speaker-diarization",
    "deepgram-vs-assemblyai-vs-whisper-voice-agents",
    "cartesia-vs-elevenlabs-vs-kokoro-tts-voice-agents",
    "livekit-vs-pipecat-vs-vapi-voice-agents",
    "openai-realtime-api-vs-gemini-live-voice-agents",
  ]) {
    const p = posts.find(x => bare(x.slug) === slug);
    if (!p) continue;
    const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [e.name, e.sameAs]));
    for (const [name, url] of Object.entries(want)) {
      if (name in by) { assert.equal(by[name], url, `${name} should reconcile to ${url}`); seen++; }
    }
  }
  assert.ok(seen > 0, "a voice/speech-cluster column reconciled on the page");
});

test("langfuse-vs-langsmith-vs-braintrust reconciles the hosted observability platforms (#25)", () => {
  // Langfuse resolves via the TOOLS catalog, but LangSmith and Braintrust are
  // proprietary hosted platforms with no public product repo, so they shipped as bare
  // Things on the flagship "which LLM observability platform" page. Each has one
  // canonical official-site identity; pin them so the high-traffic comparison keeps a
  // resolvable entity graph for every column.
  const p = posts.find(x => String(x.slug).replace(/^\d{4}-\d\d-\d\d-/, "") === "langfuse-vs-langsmith-vs-braintrust");
  if (!p) return; // skip if the fixture corpus doesn't include this piece
  const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [e.name, e.sameAs]));
  assert.equal(by["LangSmith"], "https://www.langchain.com/langsmith");
  assert.equal(by["Braintrust"], "https://www.braintrust.dev");
});

test("vercel-eve-vs-langgraph reconciles both framework columns to canonical repos (#25)", () => {
  // eve is brand-new and not in the TOOLS catalog, so without the curated map entry
  // its column would ship as a bare Thing while LangGraph (catalogued) carries a
  // sameAs — a one-sided entity graph on a head-term framework money page. Pin both
  // identities so a map edit or a column rename can't silently re-orphan eve.
  const p = posts.find(x => x.slug === "vercel-eve-vs-langgraph");
  if (!p) return; // skip if the fixture corpus doesn't include this piece
  const ld = articleLd(renderArticle(p, [], 0, {}));
  const by = Object.fromEntries((ld.about || []).map(e => [e.name, e.sameAs]));
  assert.equal(by["Vercel eve"], "https://github.com/vercel/eve");
  assert.equal(by["LangGraph"], "https://github.com/langchain-ai/langgraph");
});

test("graph-RAG architecture compare columns reconcile to canonical homes (#25)", () => {
  // The "which graph RAG" cluster compares GraphRAG and LightRAG as first-class
  // entities, but only Graphiti (getzep/graphiti) is in the TOOLS catalog — so the
  // two named architectures shipped as bare Things on graphrag-vs-lightrag-vs-graphiti
  // and its siblings. Each has one canonical home (GraphRAG → microsoft/graphrag,
  // LightRAG → HKUDS/LightRAG); pin the exact identities so a map edit or a column
  // rename can't silently re-orphan them.
  const bare = s => String(s).replace(/^\d{4}-\d\d-\d\d-/, "");
  const want = {
    "GraphRAG": "https://github.com/microsoft/graphrag",
    "LightRAG": "https://github.com/HKUDS/LightRAG",
  };
  let seen = 0;
  for (const slug of ["graphrag-vs-lightrag-vs-graphiti", "raptor-vs-naive-rag-hierarchical-retrieval"]) {
    const p = posts.find(x => bare(x.slug) === slug);
    if (!p) continue;
    const by = Object.fromEntries((articleLd(renderArticle(p, [], 0, {})).about || []).map(e => [e.name, e.sameAs]));
    for (const [name, url] of Object.entries(want)) {
      if (name in by) { assert.equal(by[name], url, `${name} should reconcile to ${url}`); seen++; }
    }
  }
  assert.ok(seen > 0, "a graph-RAG architecture column reconciled on the page");
});

test("agent/coding benchmark compare columns reconcile to canonical homes (#25)", () => {
  // A benchmark is neither a framework nor a tool, so none lives in the TOOLS
  // catalog — every benchmark `about` column shipped as a bare Thing on the Evals
  // cluster's "which benchmark" money pages. The curated map now reconciles the
  // family; pin the exact identities (incl. the parenthetical-strip and Greek-glyph
  // paths) so a map edit or column rename can't silently re-orphan them. The
  // deliberately-excluded name (BrowseComp) must STAY bare. (SWE-bench Pro was
  // formerly excluded as having "no single canonical home"; the 2026-07-01
  // coding-agent-eval run identified Scale's official open-source repo
  // scaleapi/SWE-bench_Pro-os as that home, so it now reconciles here too.)
  const want = (slug) => {
    const p = posts.find(x => x.slug === slug);
    if (!p) return null;
    const ld = articleLd(renderArticle(p, [], 0, {}));
    return Object.fromEntries((ld.about || []).map(e => [e.name, e.sameAs ?? null]));
  };
  const evo = want("swe-evo-vs-swe-bench-long-horizon-coding-agents");
  if (evo) {
    assert.equal(evo["SWE-bench Verified"], "https://www.swebench.com/");
    assert.equal(evo["SWE-EVO"], "https://arxiv.org/abs/2512.18470");
  }
  const trio = want("swe-bench-vs-tau-bench-vs-gaia");
  if (trio) {
    assert.equal(trio["SWE-bench"], "https://www.swebench.com/");
    assert.equal(trio["GAIA"], "https://huggingface.co/datasets/gaia-benchmark/GAIA");
    // τ-bench (tau-bench) — resolves via the pre-parenthetical Greek base
    assert.equal(trio["τ-bench (tau-bench)"], "https://github.com/sierra-research/tau-bench");
  }
  const tau = want("tau-bench-vs-tau2-bench");
  if (tau) {
    assert.equal(tau["τ-bench (2024)"], "https://github.com/sierra-research/tau-bench");
    assert.equal(tau["τ²-bench (2025)"], "https://github.com/sierra-research/tau2-bench");
  }
  const term = want("terminal-bench-vs-swe-bench");
  if (term) {
    assert.equal(term["Terminal-Bench (2.x)"], "https://www.tbench.ai/");
    assert.equal(term["SWE-bench (Verified)"], "https://www.swebench.com/");
  }
  // SWE-bench Pro now reconciles to Scale's official open-source repo (canonical home)
  const pro = want("swe-bench-pro-vs-swe-bench-verified");
  if (pro) assert.equal(pro["SWE-bench Pro"], "https://github.com/scaleapi/SWE-bench_Pro-os");
  const bc = want("browsecomp-vs-deepresearch-bench");
  if (bc) {
    assert.equal(bc["BrowseComp"], null, "BrowseComp stays a bare Thing");
    assert.equal(bc["DeepResearch Bench"], "https://github.com/Ayanami0730/deep_research_bench");
  }
});

test("agent-interop protocol compare columns reconcile to canonical homes — without mis-homing the payment-cluster ACP (#25)", () => {
  // A protocol is neither a framework nor a tool, so A2A/ACP/AGNTCY shipped as bare
  // Things on the Protocols cluster's "which agent protocol" money pages. The curated
  // map now reconciles them. The load-bearing case is the COLLISION GUARD: two distinct
  // entities print "ACP" — the Agent *Communication* Protocol (this cluster, merged into
  // A2A) and the Agentic *Commerce* Protocol (the payment cluster). We key only the full
  // parenthetical form, so the interop page reconciles while the payment page's bare
  // "ACP" stays a Thing. Pin both directions so a future bare-"acp" key can't regress it.
  const want = (slug) => {
    const p = posts.find(x => x.slug === slug);
    if (!p) return null;
    const ld = articleLd(renderArticle(p, [], 0, {}));
    return Object.fromEntries((ld.about || []).map(e => [e.name, e.sameAs ?? null]));
  };
  const trio = want("a2a-vs-acp-vs-agntcy-agent-interop-protocols");
  if (trio) {
    assert.equal(trio["A2A (Agent2Agent)"], "https://github.com/a2aproject/A2A");
    assert.equal(trio["ACP (Agent Communication Protocol)"], "https://github.com/i-am-bee/acp");
    assert.equal(trio["AGNTCY"], "https://github.com/agntcy");
  }
  // bonus: the existing A2A-vs-MCP page's A2A column now reconciles too
  const am = want("a2a-vs-mcp");
  if (am) assert.equal(am["A2A (Agent2Agent)"], "https://github.com/a2aproject/A2A");
  // MCP itself — the most canonical protocol of the set — now homes too, closing the
  // one-sided gap where its sibling columns reconciled but the MCP column stayed bare.
  const mcpHome = "https://github.com/modelcontextprotocol/modelcontextprotocol";
  const aguiTrio = want("ag-ui-vs-mcp-vs-a2a");
  if (aguiTrio && "MCP" in aguiTrio) assert.equal(aguiTrio["MCP"], mcpHome);
  const mfc = want("mcp-vs-function-calling");
  if (mfc && "MCP" in mfc) assert.equal(mfc["MCP"], mcpHome);
  // COLLISION GUARD: the payment cluster's bare "ACP" must NOT be mis-homed to A2A's repo
  const pay = want("ap2-vs-x402-vs-acp-agent-payment-protocols");
  if (pay && "ACP" in pay) assert.equal(pay["ACP"], null, "payment-cluster ACP stays a bare Thing");
});

test("article @type matches the section: Wire→NewsArticle, Stack→TechArticle, essays/satire→Article", () => {
  const want = { wire: "NewsArticle", stack: "TechArticle", dispatches: "Article", fabrications: "Article" };
  for (const [sec, type] of Object.entries(want)) {
    const p = posts.find(x => x.section === sec);
    if (!p) continue; // section may be empty in the test fixture
    const ld = articleLd(renderArticle(p, [], 0, {}));
    assert.equal(ld["@type"], type, `${sec} pieces should be @type ${type}, not ${ld["@type"]}`);
  }
});

test("renderArticle renders a 'More in <cluster>' rail from clusterSibs, escaped; absent ⇒ none", () => {
  const p = posts[0];
  // absent ⇒ no rail
  assert.ok(!renderArticle(p, [], 0, {}).includes("more-in-cluster"), "no rail without clusterSibs");
  const clusterSibs = { label: "RAG & Retrieval", posts: [
    { slug: "best-reranker-for-rag", title: "Best Reranker <for> RAG", section: "stack" },
    { slug: "pgvector-vs-pinecone-vs-qdrant", title: "pgvector vs Pinecone", section: "stack" },
  ] };
  const out = renderArticle(p, [], 0, {}, [], [], clusterSibs);
  const m = /<aside class="more-in-cluster"[^>]*>([\s\S]*?)<\/aside>/.exec(out);
  assert.ok(m, "rail present when clusterSibs supplied");
  assert.match(m[1], /More in RAG &amp; Retrieval/, "labels the cluster, ampersand escaped");
  assert.match(m[1], /href="\/posts\/best-reranker-for-rag\.html"/, "links a sibling by canonical href");
  assert.ok(m[1].includes("Best Reranker &lt;for&gt; RAG"), "sibling titles are HTML-escaped");
  assert.match(m[1], /href="\/comparisons"/, "links up to the comparisons hub");
});

test("the 'In this piece' contents nav renders on section-rich posts and every TOC anchor resolves to a real heading id", () => {
  // Regression: the markdown pipeline ids every heading, and tocify used to SKIP
  // already-id'd headings — so tocItems was always empty and the TOC silently
  // rendered on zero posts. Guard both that it appears somewhere AND that its
  // links point at anchors that actually exist in the rendered body.
  let withToc = 0;
  for (const p of posts) {
    const out = renderArticle(p, [], 0, {});
    const nav = /<nav class="toc"[^>]*>([\s\S]*?)<\/nav>/.exec(out);
    if (!nav) continue;
    withToc++;
    const hrefs = [...nav[1].matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    assert.ok(hrefs.length >= 4, "a rendered TOC has its section links");
    for (const id of hrefs) {
      assert.ok(out.includes(`id="${id}"`), `TOC anchor #${id} resolves to a heading in the body`);
    }
  }
  assert.ok(withToc > 0, "the contents nav must render on at least one post (it was dead on every post)");
});

test("when the contents nav renders on a piece with a FAQ, it carries the FAQ as a deep-linkable #faq landmark", () => {
  // The FAQ is a People-Also-Ask block and itself a prime "jump to" sitelink target,
  // but it lived outside the body <h2> stream so the contents nav never listed it.
  // Guard that any piece which BOTH shows the nav AND has an FAQ now exposes a
  // "Frequently asked" → #faq item, and that #faq actually resolves to the FAQ
  // section. Whether the nav appears is unchanged (body sections decide that), so a
  // piece with an FAQ but no nav is correctly untouched.
  let exercised = 0;
  for (const p of posts) {
    const out = renderArticle(p, [], 0, {});
    const nav = /<nav class="toc"[^>]*>([\s\S]*?)<\/nav>/.exec(out);
    const hasFaq = /<section id="faq" class="faq"/.test(out);
    if (!nav || !hasFaq) continue;
    exercised++;
    assert.match(nav[1], /href="#faq"[^>]*>Frequently asked</,
      "a rendered nav on an FAQ piece must list 'Frequently asked' linking to #faq");
    assert.ok(out.includes('id="faq"'), "#faq must resolve to the FAQ section");
  }
  assert.ok(exercised > 0, "at least one corpus piece must show the nav AND carry an FAQ (else this guards nothing)");
});

test("every body <h2> carries a hover permalink anchor pointing at its own heading id", () => {
  // The TOC is gated to long reads, but the per-heading permalink ships on every
  // article so any section is directly shareable. Guard that each rendered <h2>
  // gets exactly one .heading-anchor whose target is that same heading's id —
  // a dangling anchor (href that no heading carries) would deep-link to nowhere.
  let checked = 0;
  for (const p of posts) {
    const out = renderArticle(p, [], 0, {});
    for (const h2 of out.matchAll(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/g)) {
      const idMatch = h2[1] && /\bid="([^"]+)"/.exec(h2[1]);
      if (!idMatch) continue;                 // masthead/section <h2>s have no id — skip
      const id = idMatch[1];
      const anchors = [...h2[2].matchAll(/<a class="heading-anchor" href="#([^"]+)"/g)];
      assert.equal(anchors.length, 1, `<h2 id="${id}"> has exactly one permalink anchor`);
      assert.equal(anchors[0][1], id, `permalink on #${id} targets its own heading id`);
      checked++;
    }
  }
  assert.ok(checked > 0, "at least one id'd body heading was checked");
});

// Pull the HowTo JSON-LD blob out of a render, if present.
function howToLd(out) {
  const m = /<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@type":"HowTo"[\s\S]*?)<\/script>/.exec(out);
  return m ? JSON.parse(m[1]) : null;
}

test("how-to guides emit HowTo JSON-LD whose steps are the piece's own anchored sections; non-guides emit none", () => {
  const guide = posts.find(p => /^(\d{4}-\d\d-\d\d-)?how-to-/.test(p.slug) && (p.section === "wire" || p.section === "stack"));
  if (guide) {
    const out = renderArticle(guide, [], 0, {});
    const ld = howToLd(out);
    assert.ok(ld, `how-to guide ${guide.slug} emits HowTo JSON-LD`);
    assert.equal(ld.name, guide.title);
    assert.ok(Array.isArray(ld.step) && ld.step.length >= 2, "HowTo carries its ≥2 sections as steps");
    for (const s of ld.step) {
      assert.equal(s["@type"], "HowToStep");
      assert.ok(s.name, "each step has a name");
      const anchor = /#([^"#]+)$/.exec(s.url || "");
      assert.ok(anchor, "each step url is a deep-link anchor");
      assert.ok(out.includes(`id="${anchor[1]}"`), `step anchor #${anchor[1]} resolves to a heading in the body`);
      if (s.text) {
        // Step prose is clamped on a word/sentence boundary (via metaDescription),
        // never a raw mid-word slice: within the 320-char budget, no leftover markup,
        // and when truncated the trailing "…" follows a completed word (alphanumeric
        // or closing punctuation), never a space or a split fragment.
        assert.ok(s.text.length <= 320, `step text within budget (got ${s.text.length})`);
        assert.ok(!/[<>]/.test(s.text), "step text carries no leftover HTML");
        assert.ok(!/…$/.test(s.text) || /[A-Za-z0-9)\]"']…$/.test(s.text), "ellipsis follows a whole word");
      }
    }
  }
  // a non-guide Wire/Stack piece must NOT carry HowTo markup (no mislabeling)
  const nonGuide = posts.find(p => !/how-to-/.test(p.slug) && (p.section === "wire" || p.section === "stack"));
  if (nonGuide) assert.ok(!howToLd(renderArticle(nonGuide, [], 0, {})), "non-guide pieces emit no HowTo");
});

test("renderArticle emits a visible breadcrumb trail matching the BreadcrumbList JSON-LD", () => {
  const p = posts[0];
  const out = renderArticle(p, [], 0, {});
  const m = /<nav class="breadcrumb"[^>]*>([\s\S]*?)<\/nav>/.exec(out);
  assert.ok(m, "visible breadcrumb nav present");
  const nav = m[0];
  assert.match(nav, /aria-label="Breadcrumb"/);
  assert.match(nav, /<a href="\/">Home<\/a>/, "links Home");
  assert.match(nav, new RegExp(`<a href="/${p.section}\\.html">${SECTIONS[p.section].name}</a>`),
    "links the section page, matching the JSON-LD item");
  assert.match(nav, /aria-current="page"/, "current article marked aria-current");
  assert.ok(nav.includes(esc(p.title)), "shows the article title");
  // the visible trail's links must mirror the BreadcrumbList structured data
  const ld = /<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList".*?)<\/script>/.exec(out);
  assert.ok(ld, "BreadcrumbList JSON-LD present");
  const crumbs = JSON.parse(ld[1]).itemListElement;
  assert.equal(crumbs[1].item, `${SITE}/${p.section}.html`, "JSON-LD section link matches visible link");
});

test("a demand piece's breadcrumb inserts its topic cluster, linking its dedicated /comparisons/:cluster page", () => {
  // pick a real demand piece that has a coherent (non-catch-all) cluster
  const demand = posts.find(p => clusterSiblings(p.slug));
  assert.ok(demand, "fixture: at least one demand piece with a cluster");
  const cs = clusterSiblings(demand.slug);
  const out = renderArticle(demand, [], 0, {}, [], [], cs);
  // 1) visible trail carries the cluster crumb as a real link to the dedicated page
  const nav = /<nav class="breadcrumb"[^>]*>([\s\S]*?)<\/nav>/.exec(out)[0];
  assert.ok(nav.includes(`<a href="/comparisons/${cs.slug}">${esc(cs.label)}</a>`),
    "visible breadcrumb links the cluster to its dedicated /comparisons/:cluster page");
  assert.ok(!nav.includes("/comparisons#"), "crumb no longer uses the old in-page #anchor");
  // 2) the dedicated page must actually resolve (no dead crumb)
  const cluster = comparisonClusterBySlug(cs.slug);
  assert.ok(cluster, "the cluster crumb slug resolves to a dedicated page");
  const page = renderComparisonCluster(cluster);
  assert.ok(page.includes(`<h1>${esc(cs.label)}</h1>`), "dedicated page H1 names the cluster");
  // 3) JSON-LD mirrors the visible trail: cluster at position 3, article at 4
  const ld = /<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList".*?)<\/script>/.exec(out);
  const crumbs = JSON.parse(ld[1]).itemListElement;
  assert.equal(crumbs.length, 4, "Home › Section › Cluster › Article");
  assert.equal(crumbs[2].name, cs.label, "position 3 is the cluster");
  assert.equal(crumbs[2].item, `${SITE}/comparisons/${cs.slug}`, "JSON-LD cluster link matches the visible link");
  assert.equal(crumbs[3].name, demand.title, "position 4 is the article");

  // a non-comparison piece must NOT gain a cluster crumb (stays Home › Section › Article)
  const plain = posts.find(p => !clusterSiblings(p.slug));
  if (plain) {
    const pout = renderArticle(plain, [], 0, {}, [], [], clusterSiblings(plain.slug));
    const pnav = /<nav class="breadcrumb"[^>]*>([\s\S]*?)<\/nav>/.exec(pout)[0];
    assert.ok(!pnav.includes("/comparisons/"), "non-demand pieces carry no cluster crumb");
    const pld = /<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList".*?)<\/script>/.exec(pout);
    assert.equal(JSON.parse(pld[1]).itemListElement.length, 3, "non-demand: three crumbs only");
  }
});

test("head emits Open Graph article meta only for article pages with an article block", () => {
  const plain = head("t", "d", { url: "u", image: "i", kind: "article" });
  assert.doesNotMatch(plain, /article:published_time/);
  const h = head("t", "d", { url: "u", image: "i", kind: "article",
    article: { published: "2026-06-20", author: "Dex Mareno", section: "The Stack", tags: ["reportive", "opinionated"] } });
  assert.match(h, /<meta property="article:published_time" content="2026-06-20">/);
  assert.match(h, /<meta property="article:author" content="Dex Mareno">/);
  assert.match(h, /<meta property="article:section" content="The Stack">/);
  assert.match(h, /<meta property="article:tag" content="reportive">/);
  assert.match(h, /<meta property="article:tag" content="opinionated">/);
});

test("every rendered article carries a non-empty article:published_time", () => {
  for (const p of posts) {
    const out = renderArticle(p, [], 0, {});
    const m = /<meta property="article:published_time" content="([^"]*(?:&quot;[^"]*)*)">/.exec(out);
    assert.ok(m, `${p.slug} should emit article:published_time`);
    assert.ok(m[1].length > 0, `${p.slug} published_time should be non-empty`);
  }
});

test("renderAuthor emits ProfilePage + Person JSON-LD with derived knowsAbout", () => {
  const key = posts[0].author;
  const a = authorOf(key);
  const mine = posts.filter(p => p.author === key);
  const out = renderAuthor(key, mine);
  const m = /<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@type":"ProfilePage".*?)<\/script>/.exec(out);
  assert.ok(m, "ProfilePage JSON-LD present");
  const ld = JSON.parse(m[1]);
  assert.equal(ld["@type"], "ProfilePage");
  assert.equal(ld.url, `${SITE}/authors/${encodeURIComponent(key)}`);
  const person = ld.mainEntity;
  assert.equal(person["@type"], "Person");
  assert.equal(person.name, a.name);
  assert.equal(person.worksFor["@id"], `${SITE}/#org`, "Person works for the sitewide Organization");
  assert.ok(Array.isArray(person.knowsAbout) && person.knowsAbout.includes("AI agents"),
    "knowsAbout carries a base topic");
});

test("authorProfileLd derives knowsAbout from real topic clusters, not just desk names", () => {
  // A byline that files demand pieces should declare the SUBJECT areas it covers
  // (the topic-cluster labels) as E-E-A-T expertise — not just the house desk
  // ("The Wire"), which means nothing to a knowledge graph. Two comparison pieces
  // in distinct clusters should both surface; the desk name stays as breadth.
  const key = "dex";
  const mine = [
    { author: key, section: "wire", slug: "langgraph-vs-crewai", compare: new Array(4) },
    { author: key, section: "wire", slug: "pgvector-vs-pinecone-vs-qdrant", compare: new Array(4) },
  ];
  const m = /<script type="application\/ld\+json">(\{.*?)<\/script>/s.exec(authorProfileLd(authorKey(key), mine));
  const person = JSON.parse(m[1]).mainEntity;
  assert.ok(person.knowsAbout.includes("Agent Frameworks"),
    "the cluster of a framework comparison appears as a real subject area");
  assert.ok(person.knowsAbout.includes("RAG & Retrieval"),
    "the cluster of a vector-DB comparison appears as a real subject area");
  assert.ok(person.knowsAbout.indexOf("Agent Frameworks") < person.knowsAbout.indexOf("The Wire"),
    "real subjects rank ahead of the house desk name in the expertise list");
});

test("renderArticle includes the quote-to-share toolbar wired to the canonical url", () => {
  const p = posts[0];
  const out = renderArticle(p, [], 0, {});
  assert.match(out, /<div class="quote-pop" id="quotePop"[^>]*role="toolbar"[^>]*hidden>/);
  assert.match(out, /data-qp="copy"/);
  assert.match(out, /data-qp="x"/);
  // the canonical url is passed to the client script (JSON-encoded)
  assert.ok(out.includes(JSON.stringify(`https://dreaming.press/posts/${p.slug}.html`)),
    "quote-share should carry the canonical post url");
  assert.match(out, /twitter\.com\/intent\/tweet/);
});

test("renderArticle renders a 'By the numbers' band from figures, escaped; absent ⇒ none", () => {
  const base = posts[0];
  const withFigs = { ...base, figures: [["94.6%", "GPQA Diamond <top>"], ["41%", "in production"]] };
  const out = renderArticle(withFigs, [], 0, {});
  assert.match(out, /class="key-figures"/);
  assert.match(out, /class="kf-stat">94\.6%</);
  assert.match(out, /41%/);
  // labels are HTML-escaped
  assert.match(out, /GPQA Diamond &lt;top&gt;/);
  assert.ok(!out.includes("GPQA Diamond <top>"), "figure labels must be escaped");
  // a figures-less post shows no band (accepts array or JSON-string shapes)
  const none = renderArticle({ ...base, figures: [] }, [], 0, {});
  assert.ok(!none.includes("key-figures"), "no figures ⇒ no band");
  const fromJson = renderArticle({ ...base, figures: '[["5.1 months","median payback"]]' }, [], 0, {});
  assert.match(fromJson, /class="kf-stat">5\.1 months</);
});

test("renderArticle renders an 'At a glance' compare table, escaped; absent/thin ⇒ none", () => {
  const base = posts[0];
  const withCmp = { ...base, compare: [
    ["Dimension", "Claude Agent SDK", "LangGraph"],
    ["Layer", "Harness <opinionated>", "Substrate"],
    ["Models", "Claude only", "Model-agnostic"],
  ] };
  const out = renderArticle(withCmp, [], 0, {});
  assert.match(out, /class="compare"/);
  assert.match(out, /class="compare-table"/);
  // header cells as <th scope="col">
  assert.match(out, /<th scope="col">Claude Agent SDK<\/th>/);
  // the table carries an accessible name via <caption> naming the compared options
  // (the header cells after the axis label), and it precedes <thead> as required.
  assert.match(out, /<caption[^>]*>Claude Agent SDK vs LangGraph — compared at a glance<\/caption>/);
  assert.ok(out.indexOf("<caption") < out.indexOf("<thead"), "caption must be the table's first child");
  // first column of a data row becomes a row header
  assert.match(out, /<th scope="row">Layer<\/th>/);
  // cell content is HTML-escaped
  assert.match(out, /Harness &lt;opinionated&gt;/);
  assert.ok(!out.includes("Harness <opinionated>"), "compare cells must be escaped");
  // absent or header-only ⇒ no block (needs ≥2 rows)
  assert.ok(!renderArticle({ ...base, compare: [] }, [], 0, {}).includes('class="compare"'), "no compare ⇒ none");
  assert.ok(!renderArticle({ ...base, compare: [["A", "B"]] }, [], 0, {}).includes('class="compare"'), "header-only ⇒ none");
  // DB-hydrated JSON-string shape
  const fromJson = renderArticle({ ...base, compare: '[["Dim","X","Y"],["Speed","fast","slow"]]' }, [], 0, {});
  assert.match(fromJson, /<th scope="row">Speed<\/th>/);
});

test("renderArticle renders a FAQ accordion + FAQPage JSON-LD; escaped; absent ⇒ none", () => {
  const base = posts[0];
  const withFaq = { ...base, faq: [["Is X better than Y?", "It depends <on> the case."], ["When to pick X?", "For one app."]] };
  const out = renderArticle(withFaq, [], 0, {});
  // visible accordion
  assert.match(out, /class="faq"/);
  assert.match(out, /class="faq-item"><summary>Is X better than Y\?</);
  // answer text is HTML-escaped
  assert.match(out, /It depends &lt;on&gt; the case\./);
  assert.ok(!out.includes("It depends <on> the case."), "faq answers must be escaped");
  // machine-readable FAQPage structured data
  assert.match(out, /"@type":\s*"FAQPage"/);
  assert.match(out, /"@type":\s*"Question"/);
  assert.match(out, /"@type":\s*"Answer"/);
  // absent ⇒ no block, no JSON-LD (accepts array or JSON-string shapes)
  const none = renderArticle({ ...base, faq: [] }, [], 0, {});
  assert.ok(!none.includes('class="faq"'), "no faq ⇒ no accordion");
  assert.ok(!none.includes("FAQPage"), "no faq ⇒ no FAQPage JSON-LD");
  // pairs missing either half are dropped
  const partial = renderArticle({ ...base, faq: [["Q only", ""], ["", "A only"]] }, [], 0, {});
  assert.ok(!partial.includes('class="faq"'), "incomplete pairs ⇒ no block");
  // DB-hydrated JSON-string shape
  const fromJson = renderArticle({ ...base, faq: '[["Hydrated?","Yes, from JSON."]]' }, [], 0, {});
  assert.match(fromJson, /class="faq-item"><summary>Hydrated\?</);
});

test("renderArticle renders the 'Referenced in' backlink rail only when cited", () => {
  const base = posts[0];
  const cited = [
    { slug: "langgraph-vs-crewai-vs-autogen", title: "LangGraph <vs> CrewAI", section: "stack" },
    { slug: "rag-vs-long-context", title: "RAG vs Long Context", section: "wire" },
  ];
  const out = renderArticle(base, [], 0, {}, [], cited);
  assert.match(out, /class="cited-in"/);
  assert.match(out, /Referenced in/);
  // links point at the canonical /posts/<slug>.html and carry the section kicker
  assert.match(out, /href="\/posts\/langgraph-vs-crewai-vs-autogen\.html">LangGraph &lt;vs&gt; CrewAI</);
  assert.match(out, /class="cited-sec">The Stack</);
  // title is HTML-escaped (no raw angle brackets leak)
  assert.ok(!out.includes("LangGraph <vs> CrewAI"), "cited titles must be escaped");
  // absent / malformed ⇒ no rail
  assert.ok(!renderArticle(base, [], 0, {}, [], []).includes('class="cited-in"'), "no backlinks ⇒ no rail");
  assert.ok(!renderArticle(base, [], 0, {}).includes('class="cited-in"'), "default (no arg) ⇒ no rail");
  assert.ok(!renderArticle(base, [], 0, {}, [], [{ slug: "", title: "" }]).includes('class="cited-in"'), "empty rows ⇒ no rail");
});

test("renderArticle shows an 'Updated' line only when updated differs from date", () => {
  const base = posts[0];
  // updated after publish ⇒ a visible freshness line
  const revised = renderArticle({ ...base, date: "2026-06-20", updated: "2026-06-21" }, [], 0, {});
  assert.match(revised, /class="article-updated"/);
  assert.match(revised, /Updated /);
  // no updated, or updated === date ⇒ no line
  const fresh = renderArticle({ ...base, date: "2026-06-20", updated: "" }, [], 0, {});
  assert.ok(!fresh.includes("article-updated"), "no updated ⇒ no line");
  const same = renderArticle({ ...base, date: "2026-06-20", updated: "2026-06-20" }, [], 0, {});
  assert.ok(!same.includes("article-updated"), "updated === date ⇒ no line");
});

test("renderArticle wires resume-reading to a per-slug localStorage key", () => {
  const p = { ...posts[0], slug: "the-readiness-gap" };
  const out = renderArticle(p, [], 0, {});
  // per-slug position key + the resume affordance + the throttled writer
  assert.match(out, /KEY="dp-pos:"\+"the-readiness-gap"/);
  assert.match(out, /className="resume-bar"/);
  assert.match(out, /Resume reading · /);
  // finished reads clear the key rather than persisting a stale position
  assert.match(out, /localStorage\.removeItem\(KEY\)/);
});

test("renderArticle emits a Cite panel with APA/MLA/BibTeX from metadata", () => {
  const p = { ...posts[0], author: "priya", date: "2026-06-20", title: "Adoption Outran Readiness", slug: "the-readiness-gap" };
  const out = renderArticle(p, [], 0, {});
  // toggle button wired to the panel
  assert.match(out, /class="share-btn cite-toggle"[^>]*aria-controls="citePanel"/);
  assert.match(out, /<div class="cite-panel" id="citePanel" hidden>/);
  // three formats present
  assert.match(out, /cite-style">APA</);
  assert.match(out, /cite-style">MLA</);
  assert.match(out, /cite-style">BibTeX</);
  // APA surname-first + year + canonical url; BibTeX key derived from slug
  assert.match(out, /Sundaram, P\. \(2026, June 20\)\. Adoption Outran Readiness\. dreaming\.press\./);
  assert.match(out, /@article\{thereadinessgap,/);
  assert.match(out, /journal = \{dreaming\.press\}/);
});

test("issueLine builds a deterministic Vol./No./dateline and the masthead shows it", () => {
  // June 13 2026 → Vol. 3 (months since the 2026-03 founding), No. 164 (day of year)
  assert.equal(issueLine("2026-06-13"), "Vol. 3 · No. 164 · June 13, 2026");
  assert.equal(issueLine("2026-01-01"), "Vol. 1 · No. 1 · January 1, 2026");
  assert.match(masthead(), /Vol\. \d+ · No\. \d+ · /);
});

test("head advertises section feeds when a section is given", () => {
  const h = head("t", "d", { url: "u", image: "i", section: "stack" });
  assert.match(h, /rel="alternate" type="application\/rss\+xml"[^>]*href="\/stack\.xml"/);
  assert.match(h, /href="\/stack\.json"/);
});

test("masthead exposes the #main skip target after the header", () => {
  const m = masthead("wire");
  assert.match(m, /<\/header>\s*<span id="main" tabindex="-1" class="skip-target">/);
});

test("masthead contains brand and all section links", () => {
  const m = masthead();
  assert.match(m, /dreaming/);
  for (const sk of SECTION_ORDER) {
    assert.match(m, new RegExp(`href="/${sk}\\.html"`));
    assert.match(m, new RegExp(esc(SECTIONS[sk].name)));
  }
});

test("masthead marks active section with aria-current", () => {
  const m = masthead("wire");
  assert.match(m, /data-s="wire"[^>]*aria-current="page"/);
});

test("masthead has search form and agents link", () => {
  const m = masthead();
  assert.match(m, /action="\/search"/);
  assert.match(m, /\/agents\.html/);
});

test("footer contains sections, agent links, and closing tags", () => {
  const f = footer();
  for (const sk of SECTION_ORDER) assert.match(f, new RegExp(`href="/${sk}\\.html"`));
  assert.match(f, /llms\.txt/);
  assert.match(f, /<\/body>/);
  assert.match(f, /<\/html>/);
});

// ── card ─────────────────────────────────────────────────────────────────────
test("card renders title, dek, section kicker, author", () => {
  const p = posts[0];
  const c = card(p);
  assert.match(c, new RegExp(esc(p.title).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(c, new RegExp(SECTIONS[p.section].name));
  assert.match(c, /class="card"/);
  assert.match(c, new RegExp(`/posts/${p.slug}\\.html`));
});

test("card shows audio pill iff has_audio", () => {
  const withAudio = posts.find(p => p.has_audio);
  if (withAudio) assert.match(card(withAudio), /audio-pill/);
  const noAudio = posts.find(p => !p.has_audio);
  if (noAudio) assert.doesNotMatch(card(noAudio), /audio-pill/);
});

test("wireRow renders title and kicker", () => {
  const p = posts[0];
  const w = wireRow(p);
  assert.match(w, /class="wire-row"/);
  assert.match(w, new RegExp(`/posts/${p.slug}\\.html`));
});

// ── renderHome ───────────────────────────────────────────────────────────────
test("renderHome produces a full document", () => {
  const html = renderHome(posts, totalViews());
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /class="masthead"/);
  assert.match(html, /<footer class="site"/);
  assert.match(html, /<\/html>/);
});

test("renderHome includes featured post and ticker", () => {
  const html = renderHome(posts, 0);
  const feat = posts.find(p => p.featured) || posts[0];
  assert.match(html, new RegExp(esc(feat.title).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /class="ticker"/);
  assert.match(html, /Featured/);
});

test("renderHome has a section block for each populated section", () => {
  const html = renderHome(posts, 0);
  for (const sk of SECTION_ORDER) {
    if (posts.some(p => p.section === sk)) {
      assert.match(html, new RegExp(`/${sk}\\.html`));
    }
  }
});

test("renderHome renders a Most-read rail only when given data", () => {
  const without = renderHome(posts, 0);
  assert.doesNotMatch(without, /Most read this week/, "no rail without engagement data");
  assert.doesNotMatch(without, /class="most-read"/);

  const mr = posts.slice(0, 3).map(p => ({ slug: p.slug, title: p.title, section: p.section, author: p.author }));
  const withRail = renderHome(posts, 0, mr);
  assert.match(withRail, /class="most-read"/, "rail present with data");
  assert.match(withRail, /Most read this week/);
  assert.match(withRail, /class="mr-rank">1</, "ranks numbered");
  for (const p of mr) assert.ok(withRail.includes(`/posts/${p.slug}.html`), "each ranked post links");
});

// ── renderSection ────────────────────────────────────────────────────────────
for (const sk of SECTION_ORDER) {
  test(`renderSection(${sk}) produces full doc with H1 and tagline`, () => {
    const sp = postsBySection(sk);
    const html = renderSection(sk, sp);
    assert.match(html, /^<!DOCTYPE html>/);
    assert.match(html, /class="masthead"/);
    assert.match(html, new RegExp(`<h1>${SECTIONS[sk].name}</h1>`));
    assert.match(html, new RegExp(esc(SECTIONS[sk].name)));
    assert.match(html, /<\/html>/);
  });
}

test("renderSection empty list shows placeholder", () => {
  const html = renderSection("stack", []);
  assert.match(html, /No posts yet/);
});

test("renderSection wire uses wire-list layout", () => {
  const sp = postsBySection("wire");
  if (sp.length) {
    const html = renderSection("wire", sp);
    assert.match(html, /wire-list/);
  }
});

test("renderSection emits Play all + a safe JSON queue island when ≥2 narrated", () => {
  const sp = [
    { slug: "a", title: "First </script> Piece", author: "dex", section: "wire", dek: "d", date: "2026-06-20", has_audio: true },
    { slug: "b", title: "Second Piece", author: "dex", section: "wire", dek: "d", date: "2026-06-20", has_audio: true },
    { slug: "c", title: "No Audio", author: "dex", section: "wire", dek: "d", date: "2026-06-20", has_audio: false },
  ];
  const html = renderSection("wire", sp);
  assert.match(html, /playall-btn/);
  assert.match(html, /Play all narration \(2\)/);          // only the 2 narrated pieces
  assert.match(html, /id="playall-data"/);
  assert.match(html, /First \\u003c\/script> Piece/);       // "<" escaped so the island can't break out
  assert.ok(!html.includes("First </script> Piece"), "raw </script> must not appear unescaped in the island");
  assert.ok(!html.includes('"slug":"c"'), "non-narrated piece stays out of the queue");
});

test("renderSection omits Play all when fewer than 2 narrated", () => {
  const sp = [{ slug: "a", title: "Only One", author: "dex", section: "wire", dek: "d", date: "2026-06-20", has_audio: true }];
  assert.doesNotMatch(renderSection("wire", sp), /playall-btn/);
});

// ── renderSearch ─────────────────────────────────────────────────────────────
test("renderSearch with results", () => {
  const html = renderSearch("agent", posts.slice(0, 3));
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /3 results/);
  assert.match(html, /class="masthead"/);
});

test("renderSearch single result uses singular", () => {
  const html = renderSearch("x", posts.slice(0, 1));
  assert.match(html, /1 result\b/);
});

test("renderSearch no results shows message and escapes query", () => {
  const html = renderSearch('<script>', []);
  assert.match(html, /No results/);
  assert.match(html, /&lt;script&gt;/);
});

test("renderSearch empty query", () => {
  const html = renderSearch("", []);
  assert.match(html, /<h1>Search<\/h1>/);
});

test("renderSearch promotes snippet sentinels to <mark> after escaping", () => {
  const STX = String.fromCharCode(2), ETX = String.fromCharCode(3);
  // a body fragment with an HTML-unsafe char AND a sentinel-wrapped match
  const result = { ...posts[0],
    snippet: `a <tag> & ${STX}durable${ETX} step` };
  const html = renderSearch("durable", [result]);
  assert.match(html, /<mark>durable<\/mark>/, "match is highlighted");
  assert.match(html, /a &lt;tag&gt; &amp; /, "surrounding text is HTML-escaped");
  assert.ok(!html.includes(STX) && !html.includes(ETX), "no raw sentinels leak into HTML");
});

// ── renderArticle parameterized over ALL posts ───────────────────────────────
for (const p of posts) {
  test(`renderArticle: ${p.slug}`, () => {
    const related = posts.filter(x => x.slug !== p.slug).slice(0, 3);
    const html = renderArticle(p, related, 1234);
    const a = authorOf(p.author);

    assert.equal(typeof html, "string");
    assert.ok(html.length > 500, "non-trivial output");
    assert.match(html, /^<!DOCTYPE html>/, "has doctype");
    assert.match(html, /<\/html>/, "closes html");

    // escaped title appears (in <h1>)
    assert.ok(html.includes(`<h1>${esc(p.title)}</h1>`), "escaped title in h1");

    // section kicker
    assert.ok(html.includes(SECTIONS[p.section].name), "section name present");

    // cover png url
    assert.ok(html.includes(coverUrl(p.slug)), "cover url present");

    // byline model
    assert.ok(html.includes(esc(a.model)), "author model present");

    // audio iff has_audio — with a listen estimate + playback-speed control
    if (p.has_audio) {
      assert.match(html, /<audio[\s>]/, "audio element present");
      assert.ok(html.includes(`/audio/${p.slug}.mp3`), "audio src present");
      assert.match(html, /min<\/span>|≈\d+ min/, "listen estimate present");
      assert.match(html, /class="audio-speed"/, "playback-speed control present");
      assert.match(html, /\[1,1\.25,1\.5,1\.75,2\]/, "speed cycle script present");
    } else {
      assert.doesNotMatch(html, /<audio[\s>]/, "no audio element");
      assert.doesNotMatch(html, /class="audio-speed"/, "no speed control without audio");
    }

    // body html embedded — after reversing the render-time enrichments that mutate
    // the body: citation markers on source-backed links, and the per-heading
    // permalink anchors tocify appends inside each <h2>. (Heading ids themselves are
    // baked into body_html at ingest by markdown.js; the anchor element is the only
    // tocify mutation, and it is precise + reversible by design — see HEADING_ANCHOR_RE.)
    const normalized = html
      .replace(/<a class="cite" data-cite="\d+" title="[^"]*" href=/g, "<a href=")
      .replace(/<a class="heading-anchor"[^>]*>#<\/a>/g, "");
    assert.ok(normalized.includes(p.body_html), "body html embedded");

    // masthead + footer
    assert.match(html, /class="masthead"/);
    assert.match(html, /<footer class="site"/);

    // ld+json structured data
    assert.match(html, /application\/ld\+json/);

    // roughly balanced doctype/html/body — one each
    assert.equal((html.match(/<!DOCTYPE html>/g) || []).length, 1);
    assert.equal((html.match(/<\/html>/g) || []).length, 1);
    assert.equal((html.match(/<body>/g) || []).length, 1);
  });
}

test("renderArticle includes a reading-progress bar", () => {
  const html = renderArticle(posts[0], [], 0);
  assert.match(html, /class="reading-progress"/);
  assert.match(html, /id="rpBar"/);
});

test("renderArticle renders a within-section pager when siblings given", () => {
  const older = { slug: "older-x", title: "An Older Piece", section: posts[0].section };
  const newer = { slug: "newer-x", title: "A Newer Piece", section: posts[0].section };
  const html = renderArticle(posts[0], [], 0, { newer, older });
  assert.match(html, /class="pager"/);
  assert.match(html, /\/posts\/older-x\.html/);
  assert.match(html, /\/posts\/newer-x\.html/);
});

test("renderArticle omits the pager when no siblings", () => {
  const html = renderArticle(posts[0], [], 0, {});
  assert.doesNotMatch(html, /class="pager"/);
});

// ── renderArticle related / sources / tags blocks ────────────────────────────
test("renderArticle with no related has no 'Continue reading'", () => {
  const html = renderArticle(posts[0], [], 0);
  assert.doesNotMatch(html, /Continue reading/);
});

test("renderArticle with related shows 'Continue reading'", () => {
  const html = renderArticle(posts[0], posts.slice(1, 4), 0);
  assert.match(html, /Continue reading/);
});

test("renderArticle with views shows reads chip", () => {
  const html = renderArticle(posts[0], [], 1500);
  assert.match(html, /reads/);
});

test("renderArticle sources block when present", () => {
  const withSources = posts.find(p => p.sources && p.sources.length);
  if (withSources) {
    const html = renderArticle(withSources, [], 0);
    assert.match(html, /Sources/);
    // sources render as a numbered, deep-linkable reference list
    assert.match(html, /<ol class="source-list">/);
    assert.match(html, /id="src-1"/);
  }
});

test("renderArticle marks body links that cite a listed source", () => {
  const p = {
    ...posts[0],
    body_html: '<p>As <a href="https://example.com/report">the report</a> shows, and an <a href="https://other.example/x">unrelated link</a>.</p>',
    sources: [["https://example.com/report", "Example — The Report"]],
  };
  const html = renderArticle(p, [], 0);
  // the cited link gains the citation class + a source-naming tooltip
  assert.match(html, /<a class="cite" data-cite="1" title="Source 1: Example — The Report" href="https:\/\/example\.com\/report">/);
  // a non-source link is left untouched
  assert.match(html, /<a href="https:\/\/other\.example\/x">/);
});

test("citeLinks leaves the body unchanged when there are no sources", () => {
  const p = { ...posts[0], body_html: '<p><a href="https://x.example">link</a></p>', sources: [] };
  const html = renderArticle(p, [], 0);
  assert.match(html, /<a href="https:\/\/x\.example">link<\/a>/);
  assert.doesNotMatch(html, /class="cite"/);
});

test("renderArticle renders 'The takeaway' block from a summary array", () => {
  const p = { ...posts[0], summary: ["First point.", "Second point."] };
  const html = renderArticle(p, [], 0);
  assert.match(html, /class="takeaway"/);
  assert.match(html, /The takeaway/);
  assert.match(html, /<li>First point\.<\/li>/);
  assert.match(html, /<li>Second point\.<\/li>/);
});

test("renderArticle accepts a JSON-string summary (DB-hydrated shape)", () => {
  const p = { ...posts[0], summary: JSON.stringify(["Only point."]) };
  const html = renderArticle(p, [], 0);
  assert.match(html, /class="takeaway"/);
  assert.match(html, /<li>Only point\.<\/li>/);
});

test("renderArticle omits the takeaway block when no summary", () => {
  const p = { ...posts[0], summary: [] };
  const html = renderArticle(p, [], 0);
  assert.doesNotMatch(html, /class="takeaway"/);
});

test("renderArticle escapes HTML in takeaway bullets", () => {
  const p = { ...posts[0], summary: ["<script>x</script> & more"] };
  const html = renderArticle(p, [], 0);
  assert.doesNotMatch(html, /<script>x<\/script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("renderArticle renders 'About this cover' from an art object", () => {
  const p = { ...posts[0], art: { archetype: "network", mood: "cold", motif: "a relay of couriers" } };
  const html = renderArticle(p, [], 0);
  assert.match(html, /cover-about/);
  assert.match(html, /About this cover/);
  assert.match(html, /Network/);
  assert.match(html, /Cold/);
  assert.match(html, /a relay of couriers/);
});

test("renderArticle accepts a JSON-string art (DB-hydrated shape)", () => {
  const p = { ...posts[0], art: JSON.stringify({ archetype: "void", mood: "ominous", motif: "" }) };
  const html = renderArticle(p, [], 0);
  assert.match(html, /cover-about/);
  assert.match(html, /Void/);
});

test("renderArticle omits 'About this cover' when no art", () => {
  const p = { ...posts[0], art: null };
  const html = renderArticle(p, [], 0);
  assert.doesNotMatch(html, /cover-about/);
});

test("renderArticle tags block when present", () => {
  const withTags = posts.find(p => p.tags && p.tags.length);
  if (withTags) {
    const html = renderArticle(withTags, [], 0);
    assert.match(html, /tag-chip/);
  }
});

// Pull the href from the render.js-generated "Post to X" share button. Some posts
// have legacy hardcoded tweet links baked into their body_html; render.js always
// appends its own share row AFTER the body, so we take the LAST tweet share-btn.
function shareHref(html) {
  const re = /<a class="share-btn"[^>]*href="([^"]+intent\/tweet[^"]*)"/g;
  let m, last = null;
  while ((m = re.exec(html))) last = m[1];
  return last ? last.replace(/&amp;/g, "&") : null;
}

test("renderArticle X share link is URL-encoded (title with & does not break the query)", () => {
  const p = { ...posts[0], title: "A & B: agents? yes!" };
  const html = renderArticle(p, [], 0);
  const href = shareHref(html);
  assert.ok(href, "share link present");
  const u = new URL(href);
  // text param must round-trip to the exact raw title (not split by the title's '&')
  assert.equal(u.searchParams.get("text"), "A & B: agents? yes!");
  // url param must be the full article url, intact
  assert.equal(u.searchParams.get("url"), `${SITE}/posts/${p.slug}.html`);
});

test("renderArticle X share link encodes spaces and ampersands for every real post", () => {
  for (const p of posts) {
    const html = renderArticle(p, [], 0);
    const href = shareHref(html);
    assert.ok(href, `share link for ${p.slug}`);
    const u = new URL(href);
    // the title round-trips exactly through URL decoding
    assert.equal(u.searchParams.get("text"), p.title, `text round-trips for ${p.slug}`);
    assert.equal(u.searchParams.get("url"), `${SITE}/posts/${p.slug}.html`, `url round-trips for ${p.slug}`);
  }
});

// ── save-for-later (bookmarking) ─────────────────────────────────────────────
test("card renders a save-for-later button carrying its slug", () => {
  const c = card(posts[0]);
  assert.match(c, /class="save-btn card-save"/);
  assert.match(c, new RegExp(`data-slug="${posts[0].slug}"`));
  assert.match(c, /aria-pressed="false"/);
});

test("renderArticle share row includes an inline Save button", () => {
  const html = renderArticle(posts[0], [], 0, {});
  assert.match(html, /class="share-btn save-btn save-inline"/);
  assert.match(html, new RegExp(`data-slug="${posts[0].slug}"`));
});

test("footer wires the global bookmark + keyboard scripts and a /saved link", () => {
  const f = footer();
  assert.match(f, /localStorage/);
  assert.match(f, /dp-saved/);
  assert.match(f, /dp-saved-changed/);
  assert.match(f, /armed/);                       // keyboard shortcut state
  assert.match(f, /href="\/saved"/);
});

test("renderSaved returns an SSR shell that hydrates from localStorage", () => {
  const html = renderSaved();
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /id="savedList"/);
  assert.match(html, /id="savedEmpty"/);
  assert.match(html, /api\/posts\//);             // client fetch endpoint
  assert.match(html, /Saved for later/);
  // section + author display names embedded for client cards
  assert.match(html, /"wire":"The Wire"/);
});

// ── weekly digest ────────────────────────────────────────────────────────────
test("weeklyWindow anchors a trailing 7-day window to the newest post", () => {
  const sample = [
    { slug: "a", date: "2026-06-20", section: "wire" },
    { slug: "b", date: "2026-06-15", section: "wire" },   // 6 days back — in window
    { slug: "c", date: "2026-06-13", section: "wire" },   // 8 days back — out
    { slug: "d", date: "2026-02-01", section: "wire" },   // way out
  ];
  const w = weeklyWindow(sample);
  assert.equal(w.end, "2026-06-20");
  assert.equal(w.start, "2026-06-14");
  const slugs = w.posts.map(p => p.slug);
  assert.deepEqual(slugs, ["a", "b"]);
});

test("weeklyWindow is empty-safe", () => {
  const w = weeklyWindow([]);
  assert.equal(w.posts.length, 0);
  assert.equal(w.start, null);
});

test("renderWeekly renders a digest grouped by desk", () => {
  const html = renderWeekly(posts);
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /This week in dreaming\.press/);
  assert.match(html, /canonical" href="https:\/\/dreaming\.press\/weekly"/);
  // at least one desk section should render for the live (populated) corpus
  assert.match(html, /class="weekly-desk"/);
  // the page sells the weekly digest specifically and tags the signup source
  // "weekly" — so the capture matches what send-digest.js actually mails.
  assert.match(html, /Get this roundup, once a week/);
  assert.match(html, /data-source="weekly"/);
});

// ── media session (lock-screen / OS now-playing) ─────────────────────────────
test("renderArticle wires the Media Session API on audio pieces", () => {
  const audioPost = posts.find(p => p.has_audio);
  if (!audioPost) return;                              // corpus may lack audio in CI
  const html = renderArticle(audioPost, [], 0, {});
  assert.match(html, /mediaSession/);
  assert.match(html, /MediaMetadata/);
  assert.match(html, /setActionHandler/);
  // artwork points at the piece's absolute cover URL
  assert.match(html, new RegExp(`https://dreaming\\.press/images/${audioPost.slug}\\.png`));
});

test("renderArticle omits Media Session on pieces without audio", () => {
  const silent = posts.find(p => !p.has_audio);
  if (!silent) return;
  const html = renderArticle(silent, [], 0, {});
  assert.doesNotMatch(html, /MediaMetadata/);
});

// ── series (serial arcs) ─────────────────────────────────────────────────────
const seriesMates = [
  { slug: "part-1", title: "Part One", dek: "d1", author: "rosalinda", section: "dispatches", date: "2026-03-08", series: "demo-arc" },
  { slug: "part-2", title: "Part Two", dek: "d2", author: "rosalinda", section: "dispatches", date: "2026-03-09", series: "demo-arc" },
  { slug: "part-3", title: "Part Three", dek: "d3", author: "rosalinda", section: "dispatches", date: "2026-03-10", series: "demo-arc" },
];
const mid = { ...seriesMates[1], tags: [], sources: [], read_time: 3, body_html: "<p>body</p>" };

test("renderArticle shows the 'Part N of M' banner and in-series pager", () => {
  const html = renderArticle(mid, [], 0, {}, seriesMates);
  assert.match(html, /class="series-note"/);
  assert.match(html, /Part 2 of 3/);
  assert.match(html, /\/series\/demo-arc/);
  // mid piece links both previous and next instalments
  assert.match(html, /class="pager series-pager"/);
  assert.match(html, /\/posts\/part-1\.html/);
  assert.match(html, /\/posts\/part-3\.html/);
  assert.match(html, /Previous in series/);
  assert.match(html, /Next in series/);
});

test("renderArticle omits series chrome for a standalone or single-piece series", () => {
  const lone = { ...mid, series: "" };
  assert.doesNotMatch(renderArticle(lone, [], 0, {}, []), /series-note/);
  // a 'series' of one (only itself) shouldn't render a banner either
  assert.doesNotMatch(renderArticle(mid, [], 0, {}, [mid]), /series-note/);
});

test("renderSeries lists every part in reading order, numbered", () => {
  const html = renderSeries("demo-arc", seriesMates);
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<h1>Demo Arc<\/h1>/);
  assert.match(html, /3 parts/);
  assert.match(html, /class="series-list"/);
  // ordered first → last
  assert.ok(html.indexOf("part-1.html") < html.indexOf("part-2.html"));
  assert.ok(html.indexOf("part-2.html") < html.indexOf("part-3.html"));
  assert.match(html, /canonical" href="https:\/\/dreaming\.press\/series\/demo-arc"/);
});

test("renderSeriesIndex links each multi-part series with its count", () => {
  const html = renderSeriesIndex([{ series: "demo-arc", count: 3, started: "2026-03-08", latest: "2026-03-10" }]);
  assert.match(html, /<h1>Series<\/h1>/);
  assert.match(html, /\/series\/demo-arc/);
  assert.match(html, /Demo Arc/);
  assert.match(html, /3 parts/);
});

// ── comparisons & buyer's-guides hub ─────────────────────────────────────────
test("comparisonClusters selects only demand-shaped Wire/Stack pieces", () => {
  for (const { label, posts: ps } of comparisonClusters()) {
    assert.ok(label && typeof label === "string");
    for (const p of ps) {
      assert.ok(p.section === "wire" || p.section === "stack", `${p.slug} not wire/stack`);
      const s = p.slug.replace(/^\d{4}-\d\d-\d\d-/, "");
      // A clustered piece is either a comparison/guide slug (…-vs-…/best-/how-to-)
      // OR a Wire/Stack explainer carrying a real `compare:` table (header + ≥1 row) —
      // both are unambiguous demand-piece signals; metaphorical desk essays are neither.
      const slugSignal = /(^|-)vs(-|$)/.test(s) || s.startsWith("best-") || s.startsWith("how-to-");
      const tableSignal = Array.isArray(p.compare) && p.compare.length >= 2;
      assert.ok(slugSignal || tableSignal, `${p.slug} not a comparison/guide or compare-table explainer`);
    }
  }
});

test("comparisonClusters enrolls how-to guides (not just vs/best)", () => {
  const all = allPosts();
  const howto = all.filter(p => (p.section === "wire" || p.section === "stack")
    && p.slug.replace(/^\d{4}-\d\d-\d\d-/, "").startsWith("how-to-"));
  // only assert if the corpus actually has how-to guides to enroll
  if (!howto.length) return;
  const clustered = new Set();
  for (const { posts: ps } of comparisonClusters()) for (const p of ps) clustered.add(p.slug);
  for (const p of howto) assert.ok(clustered.has(p.slug), `${p.slug} (how-to guide) missing from the hub`);
});

test("comparisonClusters enrolls compare-table explainers (not just vs/best/how-to slugs)", () => {
  const clusters = comparisonClusters();
  const home = new Map();
  for (const { label, posts: ps } of clusters) for (const p of ps) home.set(p.slug, label);
  // Wire/Stack explainers that carry a real compare: table but whose slug is NOT a
  // …-vs-…/best-/how-to- query must still earn a coherent, indexable cluster home —
  // otherwise the demand piece is orphaned out of the #15/#29 internal-link graph.
  const expected = {
    "mcp-tool-poisoning-rug-pulls": "Protocols (MCP & A2A)",
    "context-rot-why-long-context-degrades": "RAG & Retrieval",
    "matryoshka-embeddings": "RAG & Retrieval",
    "2026-06-24-where-to-run-a-long-running-ai-agent": "Sandboxes & Runtime",
  };
  for (const [slug, label] of Object.entries(expected)) {
    if (!allPosts().some(p => p.slug === slug)) continue; // tolerate corpus drift
    assert.equal(home.get(slug), label, `${slug} should home in ${label}, got ${home.get(slug)}`);
  }
});

test("comparisonClusters puts each piece in exactly one cluster, none empty", () => {
  const clusters = comparisonClusters();
  const seen = new Set();
  for (const { posts: ps } of clusters) {
    assert.ok(ps.length > 0, "no empty clusters surfaced");
    for (const p of ps) {
      assert.ok(!seen.has(p.slug), `${p.slug} appears in two clusters`);
      seen.add(p.slug);
    }
  }
  // a browser piece that also mentions "mcp" must land in Web, not Protocols
  const web = clusters.find(c => /Web/.test(c.label));
  if (web && allPosts().some(p => /browser-use/.test(p.slug)))
    assert.ok(web.posts.some(p => /browser-use/.test(p.slug)), "browser-use should cluster under Web");
});

test("renderComparisons builds a CollectionPage hub with grouped guides", () => {
  const clusters = comparisonClusters();
  const html = renderComparisons(clusters);
  assert.match(html, /<h1>Comparisons/);
  assert.match(html, /"@type":\s*"CollectionPage"/);
  assert.match(html, /"@type":\s*"ItemList"/);
  // every clustered piece is linked on the page
  for (const { posts: ps } of clusters)
    for (const p of ps)
      assert.ok(html.includes(`/posts/${p.slug}.html`), `${p.slug} missing from hub`);
  // cluster headers render with their label
  for (const { label } of clusters) assert.ok(html.includes(esc(label)));
});

test("renderComparisons ItemList position count matches total guides", () => {
  const clusters = comparisonClusters();
  const total = clusters.reduce((n, c) => n + c.posts.length, 0);
  const html = renderComparisons(clusters);
  const m = html.match(/"numberOfItems":\s*(\d+)/);
  assert.ok(m, "numberOfItems present");
  assert.equal(Number(m[1]), total);
});

test("renderComparisons handles an empty corpus gracefully", () => {
  const html = renderComparisons([]);
  assert.match(html, /<h1>Comparisons/);
  assert.match(html, /still writing them/);
});

test("masthead surfaces the Comparisons hub in the primary nav", () => {
  const html = masthead();
  assert.match(html, /<a href="\/comparisons"[^>]*class="nav-cmp"[^>]*>Comparisons<\/a>/);
});

// ── /concepts hub — the evergreen "what is X" explainer index ──────────────────
test("concepts() returns only curated explainers that exist, in display order", () => {
  const cs = concepts();
  assert.ok(cs.length >= 1, "at least one curated concept resolves in the corpus");
  // every returned post is a curated slug, and order matches CONCEPT_SLUGS
  const present = CONCEPT_SLUGS.filter(s => allPosts().some(p => p.slug === s));
  assert.deepEqual(cs.map(p => p.slug), present);
});

test("every curated CONCEPT_SLUG resolves to a real post (no dead hub links)", () => {
  const live = new Set(allPosts().map(p => p.slug));
  for (const s of CONCEPT_SLUGS) assert.ok(live.has(s), `${s} missing from corpus`);
});

test("conceptSiblings homes a concept page and excludes itself; null for non-concepts", () => {
  const target = concepts()[0];
  const sib = conceptSiblings(target.slug);
  assert.ok(sib && sib.label === "Concepts" && sib.slug === "concepts");
  assert.ok(sib.posts.length >= 1 && sib.posts.every(p => p.slug !== target.slug));
  // a piece outside the curated family gets no concept rail
  const outsider = allPosts().find(p => !CONCEPT_SLUGS.includes(p.slug));
  assert.equal(conceptSiblings(outsider.slug), null);
});

test("renderConcepts builds a CollectionPage hub linking every curated explainer", () => {
  const cs = concepts();
  const html = renderConcepts(cs);
  assert.match(html, /<h1>Concepts<\/h1>/);
  assert.match(html, /"@type":\s*"CollectionPage"/);
  assert.match(html, /"@type":\s*"ItemList"/);
  for (const p of cs) assert.ok(html.includes(`/posts/${p.slug}.html`), `${p.slug} missing from hub`);
  const m = html.match(/"numberOfItems":\s*(\d+)/);
  assert.ok(m && Number(m[1]) === cs.length, "ItemList count matches curated list");
});

test("renderConcepts handles an empty list gracefully", () => {
  const html = renderConcepts([]);
  assert.match(html, /<h1>Concepts<\/h1>/);
  assert.match(html, /No concept explainers yet/);
});

// ── /topics/agent-security hub — the curated AI-agent security map ─────────────
test("securityHub() returns only curated security pieces that exist, in display order", () => {
  const hub = securityHub();
  assert.ok(hub.length >= 1, "at least one curated security piece resolves in the corpus");
  const present = SECURITY_HUB_SLUGS.filter(s => allPosts().some(p => p.slug === s));
  assert.deepEqual(hub.map(p => p.slug), present);
});

test("every curated SECURITY_HUB_SLUG resolves to a real post (no dead hub links)", () => {
  const live = new Set(allPosts().map(p => p.slug));
  for (const s of SECURITY_HUB_SLUGS) assert.ok(live.has(s), `${s} missing from corpus`);
});

test("renderTopicSecurity builds a CollectionPage hub linking every curated piece", () => {
  const hub = securityHub();
  const html = renderTopicSecurity(hub);
  assert.match(html, /<h1>AI Agent Security<\/h1>/);
  assert.match(html, /"@type":\s*"CollectionPage"/);
  assert.match(html, /"@type":\s*"ItemList"/);
  assert.match(html, /"url":\s*"[^"]*\/topics\/agent-security"/);
  for (const p of hub) assert.ok(html.includes(`/posts/${p.slug}.html`), `${p.slug} missing from hub`);
  const m = html.match(/"numberOfItems":\s*(\d+)/);
  assert.ok(m && Number(m[1]) === hub.length, "ItemList count matches curated list");
});

test("renderTopicSecurity handles an empty list gracefully", () => {
  const html = renderTopicSecurity([]);
  assert.match(html, /<h1>AI Agent Security<\/h1>/);
  assert.match(html, /No security pieces yet/);
});

test("footer surfaces the AI agent security hub", () => {
  assert.match(footer(), /<a href="\/topics\/agent-security">AI agent security<\/a>/);
});

test("masthead surfaces the Concepts hub and marks it current only on /concepts", () => {
  assert.match(masthead(), /<a href="\/concepts"[^>]*class="nav-cmp"[^>]*>Concepts<\/a>/);
  assert.match(masthead("concepts"), /<a href="\/concepts"[^>]*aria-current="page"/);
  assert.doesNotMatch(masthead("wire"), /<a href="\/concepts"[^>]*aria-current/);
});

test("masthead surfaces the Calculators hub and marks it current only on /calculators", () => {
  assert.match(masthead(), /<a href="\/calculators"[^>]*class="nav-cmp"[^>]*>Calculators<\/a>/);
  assert.match(masthead("calculators"), /<a href="\/calculators"[^>]*aria-current="page"/);
  assert.doesNotMatch(masthead("wire"), /<a href="\/calculators"[^>]*aria-current/);
});

test("a concept-explainer article renders the Concepts rail", () => {
  const target = concepts()[0];
  const html = renderArticle(target, [], 0, {}, [], [], clusterSiblings(target.slug), conceptSiblings(target.slug));
  assert.match(html, /More in Concepts/);
  assert.match(html, /href="\/concepts">All concepts/);
});

test("renderComparisons marks its own nav link aria-current", () => {
  const html = renderComparisons(comparisonClusters());
  // the nav-cmp link carries aria-current only on the comparisons page itself
  assert.match(html, /<a href="\/comparisons"[^>]*class="nav-cmp"[^>]*aria-current="page"/);
  // a section page must NOT mark the comparisons link active
  assert.doesNotMatch(masthead("wire"), /class="nav-cmp"[^>]*aria-current/);
});
