// Tests for lib/render.js, parameterized over all real posts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { allPosts, postsBySection, totalViews, comparisonClusters } from "../lib/db.js";
import {
  renderHome, renderArticle, renderSection, renderSearch, renderSaved,
  renderWeekly, weeklyWindow, renderSeries, renderSeriesIndex, renderAuthor,
  renderComparisons,
  card, wireRow, coverUrl, head, masthead, footer, issueLine,
} from "../lib/render.js";
import { SECTIONS, SECTION_ORDER, authorOf, esc, NOW, humanDate, SITE } from "../lib/data.js";

const posts = allPosts();

test("there are posts to test against", () => {
  assert.ok(posts.length > 0, "DB should be populated");
});

// ── coverUrl ─────────────────────────────────────────────────────────────────
test("coverUrl builds /images/<slug>.png", () => {
  assert.equal(coverUrl("my-slug"), "/images/my-slug.png");
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

    // body html embedded — after reversing the only render-time enrichment that
    // mutates the body: citation markers on source-backed links. (Heading anchor
    // ids are now baked into body_html at ingest by markdown.js, so render's
    // tocify is a no-op on them and they must NOT be stripped here.)
    const normalized = html
      .replace(/<a class="cite" data-cite="\d+" title="[^"]*" href=/g, "<a href=");
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
      assert.ok(/(^|-)vs(-|$)/.test(s) || s.startsWith("best-") || s.startsWith("how-to-"), `${p.slug} not a comparison/guide`);
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

test("renderComparisons marks its own nav link aria-current", () => {
  const html = renderComparisons(comparisonClusters());
  // the nav-cmp link carries aria-current only on the comparisons page itself
  assert.match(html, /<a href="\/comparisons"[^>]*class="nav-cmp"[^>]*aria-current="page"/);
  // a section page must NOT mark the comparisons link active
  assert.doesNotMatch(masthead("wire"), /class="nav-cmp"[^>]*aria-current/);
});
