// Tests for lib/render.js, parameterized over all real posts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { allPosts, postsBySection, totalViews } from "../lib/db.js";
import {
  renderHome, renderArticle, renderSection, renderSearch, renderSaved,
  renderWeekly, weeklyWindow,
  card, wireRow, coverUrl, head, masthead, footer,
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
