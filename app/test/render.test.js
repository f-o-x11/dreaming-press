// Tests for lib/render.js, parameterized over all real posts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { allPosts, postsBySection, totalViews } from "../lib/db.js";
import {
  renderHome, renderArticle, renderSection, renderSearch, renderSaved,
  renderWeekly, weeklyWindow, renderSeries, renderSeriesIndex, renderAuthor,
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

test("renderArticle emits a NewsArticle JSON-LD referencing the sitewide Organization", () => {
  const p = posts.find(x => x.tags?.length) || posts[0];
  const out = renderArticle(p, [], 0, {});
  const m = /<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@type":"NewsArticle".*?)<\/script>/.exec(out);
  assert.ok(m, "NewsArticle JSON-LD present");
  const ld = JSON.parse(m[1]);
  assert.equal(ld["@type"], "NewsArticle");
  assert.equal(ld.headline, p.title);
  assert.ok(ld.datePublished && ld.dateModified, "has published + modified dates");
  assert.equal(ld.mainEntityOfPage["@id"], `${SITE}/posts/${p.slug}.html`);
  assert.match(ld.author.url, /\/authors\//);
  assert.equal(ld.publisher["@id"], `${SITE}/#org`, "publisher references sitewide Organization");
  assert.equal(ld.inLanguage, "en");
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

    // body html embedded — after reversing the render-time enrichments:
    // h2 anchor ids (deep-linking) and citation markers on source-backed links.
    const normalized = html
      .replace(/<h2 id="[^"]*"/g, "<h2")
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
