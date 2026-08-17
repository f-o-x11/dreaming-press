// Tests for lib/pages.js — static pages, md twins, feeds, machine surfaces.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EDITION_UTC_HOUR } from "../lib/newsroom.js";
import { allPosts, comparisonClusters } from "../lib/db.js";
import {
  renderAgents, renderAbout, renderSubmit, render404, renderMdTwin,
  feedJson, rssXml, sitemapXml, newsSitemapXml, toolSitemapEntries, apiIndex, llmsTxt, contentSchema, agentCard,
} from "../lib/pages.js";
import { SITE, SECTION_ORDER, AUTHORS, authorOf, authorKey, esc } from "../lib/data.js";
import { TOOLS, CATEGORIES } from "../lib/tools-data.js";
import { STACKS } from "../lib/stack-builder.js";

const posts = allPosts();
// data-backed Stack URLs the sitemap now also emits: /tools + /reports +
// /tools + /reports/state-of-ai-agents + /calculators/llm-vram + /calculators/llm-cost
// + /calculators/llm-latency + /calculators/context-budget
// + per-tool + best/category + one "<tool> alternatives" page per tool with ≥1
// category sibling + one canonical comparison per tool (deduped by sorted pair).
const comparePairs = new Set();
for (const t of TOOLS) { const a = (t.alternatives || [])[0]; if (a) comparePairs.add([t.slug, a].sort().join("|")); }
const catCount = {};
for (const t of TOOLS) catCount[t.category] = (catCount[t.category] || 0) + 1;
const altCount = TOOLS.filter(t => (catCount[t.category] || 0) > 1).length;
// 8 fixed tool pages: /tools, /reports/state-of-ai-agents, /calculators (hub) + 5 calculators
// + /build + /stacks (2) + /compare + /best hub indexes (2) + one page per curated stack
const TOOL_URLS = 8 + 2 + 2 + STACKS.length + TOOLS.length + Object.keys(CATEGORIES).length + altCount + comparePairs.size;

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

    // no raw html tags left in the markdown *prose* (after frontmatter). Fenced and
    // inline code legitimately contain angle-brackets (e.g. a JSX `<h1>` example in a
    // how-to), and the twin now preserves code verbatim, so exclude code regions from
    // the guard — its intent is "no un-rendered HTML in prose", not "no `<` anywhere".
    const body = md.slice(secondFence + 5);
    const prose = body.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");
    assert.doesNotMatch(prose, /<\/?(p|div|h[1-4]|strong|em|a|ul|ol|li|blockquote|img|pre|code|table|tr|td|th|span)\b[^>]*>/i,
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
    // Tied to the constant, not a literal hour: posts carry a date and the time
    // is a convention, but it must be the TRUE convention (when the edition
    // actually files) or every ?since= cursor consumer is off by hours.
    assert.match(it.date_published, new RegExp(`T${String(EDITION_UTC_HOUR).padStart(2, "0")}:00:00Z$`));
    assert.ok(it.section, "section is a first-class field, not tags[0] by convention");
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
// posts that point their canonical at a SIBLING are consolidated away — they must
// not advertise their own URL in the sitemap (only the canonical target should).
const awayCount = posts.filter(p => {
  const c = p.canonical ? String(p.canonical).trim() : "";
  if (!c) return false;
  const target = /^https?:\/\//.test(c) ? c : `${SITE}/posts/${c.replace(/\.html$/, "")}.html`;
  return target !== `${SITE}/posts/${p.slug}.html`;
}).length;

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
  // one byline-archive page per distinct canonical author key in the corpus
  const authorPages = new Set(posts.map(p => authorKey(p.author))).size;
  // home + 4 sections + comparisons + concepts + topics (index) + topics/agent-security + topics/rag-retrieval + topics/agent-memory + topics/mcp + topics/agent-frameworks + topics/llm-inference + topics/agent-evals + topics/coding-agents + topics/model-selection + topics/agent-web + global-tech-news + weekly + authors + series + tags + agents + about + crawlers + cluster pages + author pages + series pages + N posts
  // the 15 counts the static hubs; /crawlers joined them when the crawl-to-click
  // ledger got a permanent URL (it is a data page, not a tool page, so it belongs
  // in the fixed list rather than in toolSitemapEntries).
  assert.equal(locs, 1 + SECTION_ORDER.length + 15 + 6 + clusterPages + authorPages + multiSeries + TOOL_URLS + (posts.length - awayCount));
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

test("sitemapXml declares each article's cover via the image-sitemap extension", () => {
  const xml = sitemapXml(posts);
  // namespace is declared (so the <image:*> tags validate)
  assert.match(xml, /xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/);
  // every post URL carries exactly one <image:image> with its canonical cover loc + title
  for (const p of posts.slice(0, 5)) {
    const re = new RegExp(
      `<loc>${SITE.replace(/[.]/g, "\\.")}/posts/${p.slug}\\.html</loc>` +
      `<lastmod>[^<]+</lastmod>` +
      `<image:image><image:loc>${SITE.replace(/[.]/g, "\\.")}/images/${p.slug}\\.png</image:loc>` +
      `<image:title>[^<]*</image:title></image:image>`);
    assert.match(xml, re, `post ${p.slug} declares its cover image`);
  }
  // one <image:image> per post, and no more (hubs/section pages stay image-less)
  const imgs = (xml.match(/<image:image>/g) || []).length;
  assert.equal(imgs, posts.length - awayCount, "exactly one cover image per article, none on hubs (canonicalized-away excluded)");
  // image titles are XML-escaped (no raw & or < leaking into the feed)
  const titles = xml.match(/<image:title>([^<]*)<\/image:title>/g) || [];
  assert.ok(titles.every(t => !/[<>]/.test(t.replace(/^<image:title>|<\/image:title>$/g, ""))), "titles escaped");
});

test("sitemapXml excludes a canonicalized-away post and keeps its canonical target", () => {
  // two dupes point their canonical at a live target; only the target is indexable
  const fixture = [
    { slug: "the-target", title: "T", date: "2026-07-01", section: "wire", author: "wire-desk" },
    { slug: "dupe-bare", title: "D1", date: "2026-07-01", section: "wire", author: "wire-desk", canonical: "the-target" },
    { slug: "dupe-html", title: "D2", date: "2026-07-01", section: "wire", author: "wire-desk", canonical: "the-target.html" },
    { slug: "dupe-url", title: "D3", date: "2026-07-01", section: "wire", author: "wire-desk", canonical: `${SITE}/posts/the-target.html` },
    { slug: "self-canon", title: "S", date: "2026-07-01", section: "wire", author: "wire-desk", canonical: "self-canon" },
  ];
  const xml = sitemapXml(fixture);
  assert.ok(xml.includes(`<loc>${SITE}/posts/the-target.html</loc>`), "canonical target is listed");
  assert.ok(xml.includes(`<loc>${SITE}/posts/self-canon.html</loc>`), "a self-canonical page is NOT excluded");
  for (const away of ["dupe-bare", "dupe-html", "dupe-url"]) {
    assert.ok(!xml.includes(`<loc>${SITE}/posts/${away}.html</loc>`), `${away} (canonical → sibling) is excluded`);
  }
});

test("newsSitemapXml excludes canonicalized-away posts from the news window", () => {
  const fixture = [
    { slug: "news-target", title: "T", date: "2026-07-01", section: "wire" },
    { slug: "news-dupe", title: "D", date: "2026-07-01", section: "wire", canonical: "news-target" },
  ];
  const xml = newsSitemapXml(fixture, "2026-07-01");
  assert.ok(xml.includes(`${SITE}/posts/news-target.html`), "canonical target appears in news sitemap");
  assert.ok(!xml.includes(`${SITE}/posts/news-dupe.html`), "canonicalized-away dupe is kept out of Google News");
});

// ── newsSitemapXml (Google News) ─────────────────────────────────────────────
test("newsSitemapXml is a well-formed news urlset with the news namespace", () => {
  const xml = newsSitemapXml(posts);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /xmlns:news="http:\/\/www\.google\.com\/schemas\/sitemap-news\/0\.9"/);
  assert.match(xml, /<\/urlset>$/);
  // every entry carries the required news child nodes
  const items = (xml.match(/<news:news>/g) || []).length;
  if (items > 0) {
    assert.equal((xml.match(/<news:publication_date>/g) || []).length, items, "each entry has a publication_date");
    assert.equal((xml.match(/<news:title>/g) || []).length, items, "each entry has a title");
    assert.ok(xml.includes("<news:name>dreaming.press</news:name>"));
    assert.ok(xml.includes("<news:language>en</news:language>"));
  }
});

test("newsSitemapXml includes only the last 48h window, anchored to the freshest post, and excludes satire", () => {
  const fx = [
    { slug: "fresh-today", title: "Fresh & Bold", section: "wire", date: "2026-06-28" },
    { slug: "yesterday", title: "Yesterday's News", section: "stack", date: "2026-06-27" },
    { slug: "two-days", title: "Two Days Back", section: "wire", date: "2026-06-26" },
    { slug: "stale", title: "Old Piece", section: "wire", date: "2026-06-20" },
    { slug: "satire-fresh", title: "Today's Satire", section: "fabrications", date: "2026-06-28" },
  ];
  const xml = newsSitemapXml(fx);
  assert.ok(xml.includes(`${SITE}/posts/fresh-today.html`), "today's wire piece is listed");
  assert.ok(xml.includes(`${SITE}/posts/yesterday.html`), "yesterday is within the 48h window");
  assert.ok(xml.includes(`${SITE}/posts/two-days.html`), "two days back is within the window");
  assert.ok(!xml.includes(`${SITE}/posts/stale.html`), "a week-old piece is outside the window");
  assert.ok(!xml.includes(`${SITE}/posts/satire-fresh.html`), "fresh satire is excluded from news");
  // title is XML-escaped, not raw
  assert.ok(xml.includes("<news:title>Fresh &amp; Bold</news:title>"), "title is escaped");
  // newest first
  assert.ok(xml.indexOf("fresh-today") < xml.indexOf("two-days"), "entries are newest-first");
});

test("newsSitemapXml respects an explicit now anchor and yields an empty-but-valid urlset when nothing is recent", () => {
  const fx = [{ slug: "old", title: "Old", section: "wire", date: "2026-01-01" }];
  const xml = newsSitemapXml(fx, "2026-06-28");
  assert.match(xml, /xmlns:news=/);
  assert.ok(!xml.includes("<news:news>"), "no entries when the only post predates the window");
  assert.match(xml, /<\/urlset>$/);
});

test("sitemapXml stamps section + cluster hubs with their own freshest piece, not the global latest", () => {
  const xml = sitemapXml(posts);
  const lastmodOf = (loc) => {
    const m = new RegExp(`<loc>${loc.replace(/[.\\/]/g, "\\$&")}</loc><lastmod>([^<]+)</lastmod>`).exec(xml);
    return m && m[1];
  };
  const dateOf = (p) => (p.updated || p.date || "").slice(0, 10);
  const freshest = (list) => list.map(dateOf).filter(Boolean).sort().pop();
  // every section index page carries the freshest date among its OWN section's posts
  for (const s of SECTION_ORDER) {
    const want = freshest(posts.filter((p) => (p.section || "") === s));
    if (want) assert.equal(lastmodOf(`${SITE}/${s}.html`), want, `${s}.html lastmod = freshest piece in ${s}`);
  }
  // every indexable cluster hub carries the freshest date among its OWN cluster's posts
  for (const c of comparisonClusters().filter((c) => c.indexable)) {
    assert.equal(lastmodOf(`${SITE}/comparisons/${c.slug}`), freshest(c.posts), `cluster ${c.slug} lastmod = its freshest piece`);
  }
  // every author byline-archive is present and carries the freshest date among that
  // author's OWN pieces — the same anti-inflation rule, applied to the E-E-A-T pages
  const byAuthor = new Map();
  for (const p of posts) {
    const key = authorKey(p.author);
    if (!byAuthor.has(key)) byAuthor.set(key, []);
    byAuthor.get(key).push(p);
  }
  for (const [key, own] of byAuthor) {
    assert.equal(lastmodOf(`${SITE}/authors/${encodeURIComponent(key)}`), freshest(own), `author ${key} lastmod = their freshest piece`);
  }
  // the point of the change: at least one hub is OLDER than the global latest
  // (proof the date is content-accurate, not the inflated build-wide newest).
  const globalLatest = freshest(posts);
  const clusterMods = comparisonClusters().filter((c) => c.indexable).map((c) => freshest(c.posts));
  assert.ok(clusterMods.some((d) => d && d < globalLatest), "some cluster hub is fresher-dated than the whole corpus, i.e. not inflated to global latest");
});

test("toolSitemapEntries dates Stack pages from live tool data, not the post latest", () => {
  const fallback = "2026-06-27"; // the post-derived `latest` the old code stamped on every tool URL
  // one tool freshly synced, the rest undated — proves per-page data-driven dating
  const dated = TOOLS[0];
  const rows = TOOLS.map((t, i) => ({
    slug: t.slug, category: t.category,
    synced_at: i === 0 ? "2026-06-01T12:00:00Z" : null, pushed_at: null,
  }));
  const entries = toolSitemapEntries(rows, fallback);
  const lastmodOf = loc => entries.find(e => e.loc === `${SITE}${loc}`)?.lastmod;
  // every entry carries a lastmod, and the URL set matches what the sitemap emits
  assert.equal(entries.length, TOOL_URLS, "same tool URL set as the sitemap counts");
  assert.ok(entries.every(e => e.lastmod), "every tool URL has a lastmod");
  // the dated tool's own /stack page carries its synced date
  assert.equal(lastmodOf(`/stack/${dated.slug}`), "2026-06-01");
  // the catalog-wide pages track the freshest tool date (NOT the post fallback)
  assert.equal(lastmodOf(`/tools`), "2026-06-01");
  // the whole point: with a real catalog date present, NO tool URL inherits the
  // (newer) post `latest` — they're all dated from the data instead.
  assert.ok(entries.every(e => e.lastmod <= "2026-06-01"), "no tool URL inflated to the post latest");
  // before any sync (no tool dates), every tool URL falls back to the post latest
  const undated = toolSitemapEntries(TOOLS.map(t => ({ slug: t.slug, category: t.category })), fallback);
  assert.ok(undated.every(e => e.lastmod === fallback), "no catalog dates ⇒ fallback everywhere");
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

test("llmsTxt surfaces the ten curated topic hubs", () => {
  const txt = llmsTxt(posts);
  assert.match(txt, /### Topic hubs/);
  for (const slug of ["mcp", "agent-frameworks", "rag-retrieval", "agent-memory",
    "llm-inference", "agent-evals", "agent-security", "coding-agents", "model-selection", "agent-web"]) {
    assert.ok(txt.includes(`${SITE}/topics/${slug}`), `missing topic hub ${slug}`);
  }
});

test("llmsTxt recent caps at 12", () => {
  const txt = llmsTxt(posts);
  const recentSection = txt.slice(txt.indexOf("## Recent"));
  const bullets = (recentSection.match(/^- \[/gm) || []).length;
  assert.ok(bullets <= 12);
  assert.equal(bullets, Math.min(12, posts.length));
});

test("llmsTxt omits Most-read when posts carry no engagement", () => {
  // The bare allPosts() fixture has no reads attached (the sitemap-style caller),
  // so the section must self-omit rather than print a cold or fabricated list.
  const txt = llmsTxt(posts);
  assert.ok(!txt.includes("## Most-read"));
});

test("llmsTxt surfaces Most-read, ranked by reads, when metrics are attached", () => {
  const withReads = posts.slice(0, 8).map((p, i) => ({ ...p, reads: (8 - i) * 5 }));
  const txt = llmsTxt(withReads);
  assert.match(txt, /## Most-read/);
  const section = txt.slice(txt.indexOf("## Most-read"), txt.indexOf("## Recent"));
  // highest-reads post leads the ranked list
  assert.ok(section.includes(`${SITE}/posts/${withReads[0].slug}.md`));
  const firstBullet = section.indexOf("- [");
  const topIdx = section.indexOf(withReads[0].slug);
  const lowIdx = section.indexOf(withReads[7].slug);
  assert.ok(topIdx > firstBullet && (lowIdx === -1 || topIdx < lowIdx), "top-read post must rank above lower-read posts");
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
