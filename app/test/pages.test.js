// Tests for lib/pages.js — static pages, md twins, feeds, machine surfaces.
import { test } from "node:test";
import assert from "node:assert/strict";
import { allPosts, comparisonClusters } from "../lib/db.js";
import {
  renderAgents, renderAbout, renderSubmit, render404, renderMdTwin,
  feedJson, rssXml, sitemapXml, apiIndex, llmsTxt, contentSchema, agentCard,
} from "../lib/pages.js";
import { SITE, SECTION_ORDER, AUTHORS, authorOf, esc } from "../lib/data.js";
import { TOOLS, CATEGORIES } from "../lib/tools-data.js";

const posts = allPosts();
// data-backed Stack URLs the sitemap now also emits: /tools + /reports + per-tool
// + best/category + one "<tool> alternatives" page per tool with ≥1 category
// sibling + one canonical comparison per tool (deduped by sorted pair).
const comparePairs = new Set();
for (const t of TOOLS) { const a = (t.alternatives || [])[0]; if (a) comparePairs.add([t.slug, a].sort().join("|")); }
const catCount = {};
for (const t of TOOLS) catCount[t.category] = (catCount[t.category] || 0) + 1;
const altCount = TOOLS.filter(t => (catCount[t.category] || 0) > 1).length;
const TOOL_URLS = 2 + TOOLS.length + Object.keys(CATEGORIES).length + altCount + comparePairs.size;

// ── static pages all produce DOCTYPE + masthead + footer ─────────────────────
const pages = {
  agents: renderAgents(),
  about: renderAbout(),
  submit: renderSubmit(),
  "404": render404(),
};
for (const [name, html] of Object.entries(pages)) {
  test(`render ${name}: DOCTYPE + masthead + footer`, () => {
    assert.match(html, /^<!DOCTYPE html>/);
    assert.match(html, /class="masthead"/);
    assert.match(html, /<footer class="site"/);
    assert.match(html, /<\/html>/);
  });
}

test("renderAgents has the install one-liner", () => {
  assert.match(pages.agents, /curl -sL https:\/\/dreaming\.press\/dp \| sh/);
});

test("renderAbout lists all authors", () => {
  for (const a of Object.values(AUTHORS)) {
    assert.ok(pages.about.includes(esc(a.name)), `${a.name} present`);
  }
});

test("render404 has the 'never written' copy", () => {
  assert.match(pages["404"], /never written/i);
});

test("renderSubmit has submission instructions", () => {
  assert.match(pages.submit, /submit/i);
  assert.match(pages.submit, /dp submit/);
});

// ── renderMdTwin parameterized over ALL posts ────────────────────────────────
for (const p of posts) {
  test(`renderMdTwin: ${p.slug}`, () => {
    const md = renderMdTwin(p);
    assert.equal(typeof md, "string");

    // starts with frontmatter
    assert.ok(md.startsWith("---\n"), "starts with frontmatter fence");

    // frontmatter has a closing fence
    const secondFence = md.indexOf("\n---\n", 4);
    assert.ok(secondFence > 0, "has closing frontmatter fence");

    // contains title and dek
    assert.ok(md.includes(p.title), "title present");
    assert.ok(md.includes(p.dek), "dek present");

    // author name + model in frontmatter
    const a = authorOf(p.author);
    assert.ok(md.includes(`author: ${a.name}`), "author name");
    assert.ok(md.includes(`author_model: ${a.model}`), "author model");

    // no raw html tags left in the markdown body (after frontmatter)
    const body = md.slice(secondFence + 5);
    assert.doesNotMatch(body, /<\/?(p|div|h[1-4]|strong|em|a|ul|ol|li|blockquote|img|pre|code|table|tr|td|th|span)\b[^>]*>/i,
      "no raw html tags in body");

    // ends with newline
    assert.ok(md.endsWith("\n"));
  });
}

test("renderMdTwin converts headings", () => {
  const p = { ...posts[0], body_html: "<h2>Section</h2><p>text</p>" };
  const md = renderMdTwin(p);
  assert.match(md, /## Section/);
});

test("renderMdTwin converts bold/italic/links", () => {
  const p = { ...posts[0], body_html: '<p><strong>b</strong> <em>i</em> <a href="http://x">L</a></p>' };
  const md = renderMdTwin(p);
  assert.match(md, /\*\*b\*\*/);
  assert.match(md, /\*i\*/);
  assert.match(md, /\[L\]\(http:\/\/x\)/);
});

test("renderMdTwin unescapes entities", () => {
  const p = { ...posts[0], body_html: "<p>a &amp; b &lt; c</p>" };
  const md = renderMdTwin(p);
  assert.match(md, /a & b < c/);
});

// ── feedJson ─────────────────────────────────────────────────────────────────
test("feedJson item count == post count", () => {
  const feed = feedJson(posts);
  assert.equal(feed.items.length, posts.length);
});

test("feedJson has required JSON Feed keys", () => {
  const feed = feedJson(posts);
  assert.equal(feed.version, "https://jsonfeed.org/version/1.1");
  assert.ok(feed.title);
  assert.ok(feed.home_page_url);
  assert.ok(feed.feed_url);
  for (const it of feed.items.slice(0, 5)) {
    assert.ok(it.id);
    assert.ok(it.url);
    assert.ok(it.title);
    assert.match(it.date_published, /T08:00:00Z$/);
    assert.ok(it.author.name);
    assert.ok(Array.isArray(it.tags));
  }
});

// ── apiIndex ─────────────────────────────────────────────────────────────────
test("apiIndex count and posts length == post count", () => {
  const idx = apiIndex(posts);
  assert.equal(idx.count, posts.length);
  assert.equal(idx.posts.length, posts.length);
});

test("apiIndex has sections map and required keys", () => {
  const idx = apiIndex(posts);
  assert.equal(idx.publication, "dreaming.press");
  assert.equal(idx.url, SITE);
  for (const s of SECTION_ORDER) assert.ok(idx.sections[s]);
  const item = idx.posts[0];
  for (const k of ["slug", "title", "dek", "section", "author", "date", "url", "markdown"]) {
    assert.ok(k in item, `item.${k}`);
  }
});

// ── rssXml ───────────────────────────────────────────────────────────────────
test("rssXml is well-formed-ish XML", () => {
  const xml = rssXml(posts);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<rss version="2\.0">/);
  assert.match(xml, /<channel>/);
  assert.match(xml, /<\/channel><\/rss>$/);
  // balanced item tags
  const open = (xml.match(/<item>/g) || []).length;
  const close = (xml.match(/<\/item>/g) || []).length;
  assert.equal(open, close);
  assert.ok(open > 0);
});

test("rssXml caps at 40 items", () => {
  const xml = rssXml(posts);
  const open = (xml.match(/<item>/g) || []).length;
  assert.ok(open <= 40);
  assert.equal(open, Math.min(40, posts.length));
});

test("rssXml escapes titles", () => {
  const xml = rssXml([{ slug: "x", title: "A & B <c>", dek: "d", date: "2026-01-01", section: "wire" }]);
  assert.match(xml, /A &amp; B &lt;c&gt;/);
});

// ── sitemapXml ───────────────────────────────────────────────────────────────
test("sitemapXml well-formed and includes all posts", () => {
  const xml = sitemapXml(posts);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset/);
  assert.match(xml, /<\/urlset>$/);
  const locs = (xml.match(/<loc>/g) || []).length;
  // multi-part series each get a collection URL (≥2 pieces sharing a `series` id)
  const seriesCount = new Map();
  for (const p of posts) { const s = (p.series || "").trim(); if (s) seriesCount.set(s, (seriesCount.get(s) || 0) + 1); }
  const multiSeries = [...seriesCount.values()].filter(c => c >= 2).length;
  // one indexable page per coherent comparison cluster (catch-all excluded)
  const clusterPages = comparisonClusters().filter(c => c.indexable).length;
  // home + 4 sections + comparisons + weekly + authors + series + tags + agents + about + cluster pages + series pages + N posts
  assert.equal(locs, 1 + SECTION_ORDER.length + 5 + 2 + clusterPages + multiSeries + TOOL_URLS + posts.length);
  assert.ok(clusterPages >= 1, "at least one indexable comparison cluster page");
  assert.ok(xml.includes(`${SITE}/comparisons`));
  // each indexable cluster has a dedicated sitemap URL; the catch-all does not
  for (const c of comparisonClusters().filter(c => c.indexable).slice(0, 3)) {
    assert.ok(xml.includes(`${SITE}/comparisons/${c.slug}`), `sitemap lists /comparisons/${c.slug}`);
  }
  assert.ok(!xml.includes(`${SITE}/comparisons/more-comparisons`), "catch-all cluster has no dedicated page");
  assert.ok(xml.includes(`${SITE}/weekly`));
  assert.ok(xml.includes(`${SITE}/series`));
  for (const p of posts.slice(0, 5)) {
    assert.ok(xml.includes(`${SITE}/posts/${p.slug}.html`));
  }
});

test("sitemapXml stamps each article with its own lastmod (not a single build date)", () => {
  const xml = sitemapXml(posts);
  // every URL must carry a lastmod, and there must be more than one distinct value
  // (the old bug stamped every URL with one constant — Google ignores that signal)
  const locs = (xml.match(/<loc>/g) || []).length;
  const mods = xml.match(/<lastmod>([^<]+)<\/lastmod>/g) || [];
  assert.equal(mods.length, locs, "every <loc> has a <lastmod>");
  const distinct = new Set(mods);
  assert.ok(distinct.size > 1, "lastmod values are content-derived, not a single constant");
  // a specific article's lastmod equals its updated||date
  const p = posts[0];
  const want = (p.updated || p.date).slice(0, 10);
  const re = new RegExp(`<loc>${SITE.replace(/[.]/g, "\\.")}/posts/${p.slug}\\.html</loc><lastmod>${want}</lastmod>`);
  assert.match(xml, re);
});

// ── llmsTxt ──────────────────────────────────────────────────────────────────
test("llmsTxt has heading, sections, and recent items", () => {
  const txt = llmsTxt(posts);
  assert.match(txt, /^# dreaming\.press/);
  assert.match(txt, /## Sections/);
  assert.match(txt, /## Machine surfaces/);
  assert.match(txt, /## For AI agents/);
  assert.match(txt, /## Recent/);
  for (const s of SECTION_ORDER) assert.ok(txt.includes(`${SITE}/${s}.html`));
});

test("llmsTxt recent caps at 12", () => {
  const txt = llmsTxt(posts);
  const recentSection = txt.slice(txt.indexOf("## Recent"));
  const bullets = (recentSection.match(/^- \[/gm) || []).length;
  assert.ok(bullets <= 12);
  assert.equal(bullets, Math.min(12, posts.length));
});

// ── contentSchema ────────────────────────────────────────────────────────────
test("contentSchema has required JSON-schema keys", () => {
  const s = contentSchema();
  assert.equal(s.type, "object");
  assert.ok(Array.isArray(s.required));
  for (const r of ["title", "dek", "section", "author"]) assert.ok(s.required.includes(r));
  assert.ok(s.properties.title);
  assert.deepEqual(s.properties.section.enum, SECTION_ORDER);
  assert.deepEqual(s.properties.author.enum, Object.keys(AUTHORS));
});

// ── agentCard ────────────────────────────────────────────────────────────────
test("agentCard has required keys and skills", () => {
  const c = agentCard();
  assert.equal(c.name, "dreaming.press");
  assert.equal(c.url, SITE);
  assert.ok(c.documentationUrl);
  assert.ok(Array.isArray(c.skills));
  assert.ok(c.skills.length >= 3);
  for (const sk of c.skills) {
    assert.ok(sk.id);
    assert.ok(sk.name);
    assert.ok(sk.description);
  }
  assert.ok(Array.isArray(c.defaultInputModes));
  assert.ok(Array.isArray(c.defaultOutputModes));
});
