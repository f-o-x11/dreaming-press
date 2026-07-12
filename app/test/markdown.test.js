// Exhaustive tests for lib/markdown.js — mdToHtml, inline, parseFrontmatter.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mdToHtml, inline, parseFrontmatter, headingSlug, splitCells } from "../lib/markdown.js";

// ── splitCells() — compare-table row parsing with escaped pipes ───────────────
test("splitCells: splits on unescaped pipes and trims", () => {
  assert.deepEqual(splitCells("Metric | Cosine | Dot product"), ["Metric", "Cosine", "Dot product"]);
});

test("splitCells: a backslash-escaped pipe stays inside one cell", () => {
  // technical comparison cells carry literal pipes (formulas, bit ranges); without
  // the escape, ingest would split "Sum of |a-b|" into spurious extra columns.
  assert.deepEqual(
    splitCells("Manhattan | Sum of \\|a-b\\| | rare"),
    ["Manhattan", "Sum of |a-b|", "rare"]
  );
  // a row with only escaped pipes is a single cell, not three
  assert.deepEqual(splitCells("1\\|2\\|4-bit"), ["1|2|4-bit"]);
});

// ── inline() ─────────────────────────────────────────────────────────────────
test("inline: plain text passes through", () => {
  assert.equal(inline("hello world"), "hello world");
});

test("inline: escapes < > & \"", () => {
  assert.equal(inline("a < b & c > d"), "a &lt; b &amp; c &gt; d");
  assert.equal(inline('say "hi"'), "say &quot;hi&quot;");
});

test("inline: bold", () => {
  assert.equal(inline("a **bold** b"), "a <strong>bold</strong> b");
});

test("inline: italic", () => {
  assert.equal(inline("a *italic* b"), "a <em>italic</em> b");
});

test("inline: italic at start of string", () => {
  assert.equal(inline("*italic* tail"), "<em>italic</em> tail");
});

test("inline: code span", () => {
  assert.equal(inline("use `code` here"), "use <code>code</code> here");
});

test("inline: bold does not eat italic", () => {
  const r = inline("**b** and *i*");
  assert.match(r, /<strong>b<\/strong>/);
  assert.match(r, /<em>i<\/em>/);
});

test("inline: link", () => {
  assert.equal(inline("[text](http://x.com)"), '<a href="http://x.com">text</a>');
});

test("inline: image", () => {
  assert.equal(inline("![alt](http://x.com/i.png)"), '<img src="http://x.com/i.png" alt="alt">');
});

test("inline: image with empty alt", () => {
  assert.equal(inline("![](http://x.com/i.png)"), '<img src="http://x.com/i.png" alt="">');
});

test("inline: multiple bolds", () => {
  assert.equal(inline("**a** **b**"), "<strong>a</strong> <strong>b</strong>");
});

test("inline: code with special chars escaped", () => {
  assert.equal(inline("`a<b>c`"), "<code>a&lt;b&gt;c</code>");
});

test("inline: empty string", () => {
  assert.equal(inline(""), "");
});

test("inline: ampersand entity-safe", () => {
  assert.match(inline("Tom & Jerry"), /Tom &amp; Jerry/);
});

// ── headings ─────────────────────────────────────────────────────────────────
for (let lvl = 1; lvl <= 4; lvl++) {
  test(`mdToHtml: h${lvl} heading carries a slug id`, () => {
    const out = mdToHtml(`${"#".repeat(lvl)} Heading ${lvl}`);
    assert.equal(out, `<h${lvl} id="heading-${lvl}">Heading ${lvl}</h${lvl}>`);
  });
}

test("mdToHtml: heading with inline formatting", () => {
  // the rendered text keeps the formatting; the id is slugified from plain text
  const out = mdToHtml("## A **bold** title");
  assert.equal(out, '<h2 id="a-bold-title">A <strong>bold</strong> title</h2>');
});

test("mdToHtml: duplicate headings get distinct ids", () => {
  const out = mdToHtml("## Setup\n\ntext\n\n## Setup");
  assert.match(out, /<h2 id="setup">Setup<\/h2>/);
  assert.match(out, /<h2 id="setup-2">Setup<\/h2>/);
});

test("mdToHtml: heading id strips a link to its text", () => {
  const out = mdToHtml("## Why [MCP](/posts/mcp-vs-function-calling.html) wins");
  assert.match(out, /<h2 id="why-mcp-wins">/);
  // the visible heading still links out
  assert.match(out, /<a href="\/posts\/mcp-vs-function-calling\.html">MCP<\/a>/);
});

// ── headingSlug() ────────────────────────────────────────────────────────────
test("headingSlug: lowercases and hyphenates", () => {
  assert.equal(headingSlug("The Agent Payment Stack"), "the-agent-payment-stack");
});

test("headingSlug: strips emphasis/code markers and punctuation", () => {
  assert.equal(headingSlug("Connection **versus** `instruction`!"), "connection-versus-instruction");
});

test("headingSlug: empty/symbol-only text falls back to 'section'", () => {
  assert.equal(headingSlug("***"), "section");
  assert.equal(headingSlug(""), "section");
});

test("headingSlug: dedupes via the seen map", () => {
  const seen = new Map();
  assert.equal(headingSlug("Setup", seen), "setup");
  assert.equal(headingSlug("Setup", seen), "setup-2");
  assert.equal(headingSlug("Setup", seen), "setup-3");
});

test("mdToHtml: five hashes is not a heading", () => {
  const out = mdToHtml("##### too deep");
  assert.match(out, /<p>/);
  assert.doesNotMatch(out, /<h5>/);
});

// ── paragraphs ───────────────────────────────────────────────────────────────
test("mdToHtml: single paragraph", () => {
  assert.equal(mdToHtml("Just a line."), "<p>Just a line.</p>");
});

test("mdToHtml: paragraph joins wrapped lines", () => {
  assert.equal(mdToHtml("line one\nline two"), "<p>line one line two</p>");
});

test("mdToHtml: blank line splits paragraphs", () => {
  const out = mdToHtml("para one\n\npara two");
  assert.equal(out, "<p>para one</p>\n<p>para two</p>");
});

test("mdToHtml: leading/trailing blank lines ignored", () => {
  assert.equal(mdToHtml("\n\nhi\n\n"), "<p>hi</p>");
});

// ── bold/italic/code in body ─────────────────────────────────────────────────
test("mdToHtml: paragraph with bold", () => {
  assert.equal(mdToHtml("a **b** c"), "<p>a <strong>b</strong> c</p>");
});

// ── blockquote ───────────────────────────────────────────────────────────────
test("mdToHtml: blockquote single line", () => {
  assert.equal(mdToHtml("> quoted"), "<blockquote>quoted</blockquote>");
});

test("mdToHtml: blockquote multi-line joins", () => {
  assert.equal(mdToHtml("> line a\n> line b"), "<blockquote>line a line b</blockquote>");
});

test("mdToHtml: blockquote with inline", () => {
  assert.equal(mdToHtml("> *em* text"), "<blockquote><em>em</em> text</blockquote>");
});

// ── pullquote ────────────────────────────────────────────────────────────────
test("mdToHtml: pullquote >>", () => {
  assert.equal(mdToHtml(">> big idea"), '<p class="pullquote">big idea</p>');
});

test("mdToHtml: pullquote vs blockquote distinct", () => {
  const pq = mdToHtml(">> x");
  const bq = mdToHtml("> x");
  assert.match(pq, /pullquote/);
  assert.doesNotMatch(bq, /pullquote/);
});

// ── horizontal rules ─────────────────────────────────────────────────────────
for (const hr of ["---", "***", "___"]) {
  test(`mdToHtml: hr "${hr}"`, () => {
    assert.equal(mdToHtml(hr), "<hr>");
  });
}

// ── unordered lists ──────────────────────────────────────────────────────────
test("mdToHtml: ul with dash", () => {
  assert.equal(mdToHtml("- a\n- b"), "<ul><li>a</li><li>b</li></ul>");
});

test("mdToHtml: ul with asterisk", () => {
  assert.equal(mdToHtml("* a\n* b"), "<ul><li>a</li><li>b</li></ul>");
});

test("mdToHtml: ul item with inline formatting", () => {
  assert.equal(mdToHtml("- **bold** item"), "<ul><li><strong>bold</strong> item</li></ul>");
});

test("mdToHtml: single-item list", () => {
  assert.equal(mdToHtml("- only"), "<ul><li>only</li></ul>");
});

// ── ordered lists ────────────────────────────────────────────────────────────
test("mdToHtml: ol", () => {
  assert.equal(mdToHtml("1. a\n2. b"), "<ol><li>a</li><li>b</li></ol>");
});

test("mdToHtml: ol arbitrary numbers", () => {
  assert.equal(mdToHtml("3. a\n7. b"), "<ol><li>a</li><li>b</li></ol>");
});

// ── fenced code ──────────────────────────────────────────────────────────────
test("mdToHtml: fenced code block", () => {
  assert.equal(mdToHtml("```\ncode line\n```"), "<pre><code>code line</code></pre>");
});

test("mdToHtml: fenced code preserves multiple lines", () => {
  assert.equal(mdToHtml("```\na\nb\n```"), "<pre><code>a\nb</code></pre>");
});

test("mdToHtml: fenced code escapes html", () => {
  assert.equal(mdToHtml("```\n<div>&\n```"), "<pre><code>&lt;div&gt;&amp;</code></pre>");
});

test("mdToHtml: fenced code does not process markdown inside", () => {
  const out = mdToHtml("```\n**not bold**\n```");
  assert.match(out, /\*\*not bold\*\*/);
  assert.doesNotMatch(out, /<strong>/);
});

test("mdToHtml: fenced code with language tag still works", () => {
  const out = mdToHtml("```js\nlet x=1;\n```");
  assert.match(out, /<pre><code>/);
  assert.match(out, /let x=1;/);
});

// ── tables ───────────────────────────────────────────────────────────────────
test("mdToHtml: simple table", () => {
  const out = mdToHtml("| A | B |\n| - | - |\n| 1 | 2 |");
  assert.match(out, /<table>/);
  assert.match(out, /<th>A<\/th>/);
  assert.match(out, /<th>B<\/th>/);
  assert.match(out, /<td>1<\/td>/);
  assert.match(out, /<td>2<\/td>/);
  assert.match(out, /<\/table>/);
});

test("mdToHtml: table with inline formatting in cells", () => {
  const out = mdToHtml("| **A** | B |\n| - | - |\n| x | y |");
  assert.match(out, /<th><strong>A<\/strong><\/th>/);
});

test("mdToHtml: table multiple body rows", () => {
  const out = mdToHtml("| A |\n| - |\n| 1 |\n| 2 |");
  const tdCount = (out.match(/<td>/g) || []).length;
  assert.equal(tdCount, 2);
});

// ── @repo cards ──────────────────────────────────────────────────────────────
test("mdToHtml: repo card full spec", () => {
  const out = mdToHtml("@repo{cool-repo|https://github.com/x/cool-repo|A neat tool|Python|1234}");
  assert.match(out, /repo-card/);
  assert.match(out, /cool-repo/);
  assert.match(out, /A neat tool/);
  assert.match(out, /Python/);
  assert.match(out, /1234/);
  assert.match(out, /x\/cool-repo/);
});

test("mdToHtml: repo card with missing fields", () => {
  const out = mdToHtml("@repo{name|https://github.com/a/b}");
  assert.match(out, /repo-card/);
  assert.match(out, /name/);
});

test("mdToHtml: repo card escapes url", () => {
  const out = mdToHtml('@repo{n|https://github.com/a/b"x|d|L|9}');
  assert.match(out, /&quot;/);
});

test("mdToHtml: repo card desc supports inline", () => {
  const out = mdToHtml("@repo{n|https://github.com/a/b|see **this**|Go|5}");
  assert.match(out, /<strong>this<\/strong>/);
});

// ── html passthrough ─────────────────────────────────────────────────────────
test("mdToHtml: raw html line passes through", () => {
  assert.equal(mdToHtml("<div>raw</div>"), "<div>raw</div>");
});

test("mdToHtml: line starting with <http is treated as paragraph not html", () => {
  const out = mdToHtml("<http://x.com>");
  assert.match(out, /<p>/);
});

// ── escaping in paragraphs ───────────────────────────────────────────────────
test("mdToHtml: paragraph escapes special chars", () => {
  assert.equal(mdToHtml("a & b"), "<p>a &amp; b</p>");
});

// ── mixed document ───────────────────────────────────────────────────────────
test("mdToHtml: mixed document structure", () => {
  const src = "# Title\n\nIntro paragraph.\n\n- one\n- two\n\n> a quote\n\n```\ncode\n```";
  const out = mdToHtml(src);
  assert.match(out, /<h1 id="title">Title<\/h1>/);
  assert.match(out, /<p>Intro paragraph\.<\/p>/);
  assert.match(out, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(out, /<blockquote>a quote<\/blockquote>/);
  assert.match(out, /<pre><code>code<\/code><\/pre>/);
});

test("mdToHtml: empty input yields empty string", () => {
  assert.equal(mdToHtml(""), "");
});

test("mdToHtml: whitespace-only input yields empty string", () => {
  assert.equal(mdToHtml("   \n  \n"), "");
});

test("mdToHtml: list immediately after paragraph", () => {
  const out = mdToHtml("intro\n\n- item");
  assert.match(out, /<p>intro<\/p>/);
  assert.match(out, /<ul><li>item<\/li><\/ul>/);
});

test("mdToHtml: paragraph stops at heading", () => {
  const out = mdToHtml("text\n# Heading");
  assert.match(out, /<p>text<\/p>/);
  assert.match(out, /<h1 id="heading">Heading<\/h1>/);
});

// ── parseFrontmatter ─────────────────────────────────────────────────────────
test("parseFrontmatter: basic", () => {
  const { fm, body } = parseFrontmatter("---\ntitle: Hello\nsection: wire\n---\nBody here");
  assert.equal(fm.title, "Hello");
  assert.equal(fm.section, "wire");
  assert.equal(body, "Body here");
});

test("parseFrontmatter: no frontmatter returns raw body", () => {
  const { fm, body } = parseFrontmatter("Just body text");
  assert.deepEqual(fm, {});
  assert.equal(body, "Just body text");
});

test("parseFrontmatter: missing closing --- returns raw body", () => {
  const raw = "---\ntitle: Broken\nno closing";
  const { fm, body } = parseFrontmatter(raw);
  assert.deepEqual(fm, {});
  assert.equal(body, raw);
});

test("parseFrontmatter: value with colon preserved", () => {
  const { fm } = parseFrontmatter("---\nurl: http://x.com:8080/p\n---\nb");
  assert.equal(fm.url, "http://x.com:8080/p");
});

test("parseFrontmatter: trims keys and values", () => {
  const { fm } = parseFrontmatter("---\n  key  :  value  \n---\nb");
  assert.equal(fm.key, "value");
});

test("parseFrontmatter: strips one layer of matching surrounding quotes", () => {
  // a quoted scalar stores the inner string, not literal quote chars
  assert.equal(parseFrontmatter(`---\ntitle: "X vs Y"\n---\nb`).fm.title, "X vs Y");
  assert.equal(parseFrontmatter("---\ntitle: 'X vs Y'\n---\nb").fm.title, "X vs Y");
  // an internal quote that isn't a wrapper is left intact
  assert.equal(parseFrontmatter(`---\ntitle: "X" vs Y\n---\nb`).fm.title, `"X" vs Y`);
  // mismatched quotes are not stripped
  assert.equal(parseFrontmatter(`---\ntitle: "X vs Y'\n---\nb`).fm.title, `"X vs Y'`);
  // a colon-bearing value (e.g. a URL) survives — first colon splits, no quotes to strip
  assert.equal(parseFrontmatter("---\nsources: https://x.com/p | Label\n---\nb").fm.sources, "https://x.com/p | Label");
});

test("parseFrontmatter: line without colon ignored", () => {
  const { fm } = parseFrontmatter("---\nnocolonhere\ntitle: T\n---\nb");
  assert.equal(fm.title, "T");
  assert.equal(Object.keys(fm).length, 1);
});

test("parseFrontmatter: strips leading newlines from body", () => {
  const { body } = parseFrontmatter("---\na: b\n---\n\n\nBody");
  assert.equal(body, "Body");
});

test("parseFrontmatter: empty frontmatter block", () => {
  const { fm, body } = parseFrontmatter("---\n---\nBody");
  assert.deepEqual(fm, {});
  assert.equal(body, "Body");
});

test("parseFrontmatter: multiple keys", () => {
  const { fm } = parseFrontmatter("---\na: 1\nb: 2\nc: 3\n---\nx");
  assert.equal(fm.a, "1");
  assert.equal(fm.b, "2");
  assert.equal(fm.c, "3");
});

// ── mispasted frontmatter table rows in the body are dropped (no literal leak) ─
test("mdToHtml: a body-embedded compare: row is dropped, not rendered as literal text", () => {
  const html = mdToHtml("Intro para.\n\ncompare: Dimension | A | B ;; Cost | low | high\n\nOutro para.");
  assert.ok(!html.includes("compare:"), `compare: line leaked as literal text: ${html}`);
  assert.ok(html.includes("Intro para.") && html.includes("Outro para."), "surrounding prose must survive");
});

test("mdToHtml: a figures: row mispasted into the body is dropped", () => {
  const html = mdToHtml("figures: 90% | cache hit rate ;; 3x | faster");
  assert.ok(!html.includes("figures:"), `figures: line leaked: ${html}`);
});

test("mdToHtml: real prose beginning with 'compare' is NOT dropped", () => {
  const html = mdToHtml("compare the two options carefully before you commit.");
  assert.ok(html.includes("compare the two options"), "prose must not be stripped");
});
