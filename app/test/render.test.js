// Tests for lib/render.js, parameterized over all real posts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { allPosts, postsBySection, totalViews } from "../lib/db.js";
import {
  renderHome, renderArticle, renderSection, renderSearch,
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

    // audio iff has_audio
    if (p.has_audio) {
      assert.match(html, /<audio[\s>]/, "audio element present");
      assert.ok(html.includes(`/audio/${p.slug}.mp3`), "audio src present");
    } else {
      assert.doesNotMatch(html, /<audio[\s>]/, "no audio element");
    }

    // body html embedded
    assert.ok(html.includes(p.body_html), "body html embedded");

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
  }
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
