import { test } from "node:test";
import assert from "node:assert/strict";
import { footer, dpBundle } from "../lib/render.js";
import { renderAbout } from "../lib/pages.js";

// Route-family telemetry. 640 of ~2,476 URLs reported nothing before this — the
// hubs were invisible to every report even though /build is the most-crawled path
// on the domain. These guard the two invariants that make the rollup trustworthy.

test("every page loads the shared bundle, and the bundle carries the page beacon", () => {
  // The beacon moved from inline-on-every-page into /dp.js (17KB of inline script
  // per page was pushing articles past the CWV weight budget, and re-sending it on
  // every pageview taxed exactly the second-page click this site needs). The
  // assertions follow the code rather than the delivery mechanism.
  assert.match(footer(), /src="\/dp\.js\?v=/, "page loads the bundle");
  const js = dpBundle();
  assert.match(js, /__dpBeacon/, "page beacon present");
  assert.match(js, /page:/, "emits under the page: namespace");
  assert.match(js, /sendBeacon/, "actually posts");
});

test("the page beacon self-suppresses so article pages keep their richer events", () => {
  // The article beacon renders earlier in the document and claims the flag first.
  // Without this guard an article would emit BOTH a slug view and a page: view,
  // double-counting every article in the funnel.
  assert.match(dpBundle(), /if\(window\.__dpBeacon\)return/, "guards on the shared flag");
});

test("article paths are excluded from route-family collapse", () => {
  // /posts/* must fall through to the article beacon, never be rewritten into a
  // family key — otherwise 1,838 distinct articles collapse into one bucket.
  const js = dpBundle();
  assert.match(js, /\\\/posts\\\//, "posts pattern present in the family table");
  assert.match(js, /FAM\[i\]\[1\]===null\)return/, "null family means: emit nothing here");
});

test("high-cardinality routes collapse to a family, not a raw URL", () => {
  const js = dpBundle();
  for (const fam of ["/compare/:pair", "/stack/:tool", "/best/:cat", "/topics/:topic"]) {
    assert.ok(js.includes(fam), `collapses to ${fam}`);
  }
});

test("a non-article page loads the bundle that carries telemetry", () => {
  assert.match(renderAbout(), /src="\/dp\.js\?v=/, "a real page render pulls the bundle");
  assert.match(dpBundle(), /__dpBeacon/, "the bundle carries telemetry");
});

// assistantBreakdown must classify by REFERRER, not by channel. ChatGPT and
// Copilot tag their outbound links with utm_source, and classifyChannel checks
// utm before referrer — so those referrals land in `campaign:*`. Selecting on
// channel='ai' therefore reported the second-largest assistant referrer as zero,
// and the crawl-yield join inherited it: 12,287 ChatGPT-family fetches shown
// converting to nothing.
import { assistantBreakdown, recordEvent, db, allPosts } from "../lib/db.js";

test("assistantBreakdown counts an assistant referral even when it carries a utm tag", () => {
  const now = Date.now();
  const d = db();
  d.prepare("DELETE FROM events WHERE sid LIKE 'test-ab-%'").run();
  // exactly the shape ChatGPT sends: assistant referrer AND a campaign tag
  recordEvent("x", "view", 0, now, { ref: "https://chatgpt.com/", utm: "chatgpt.com", sid: "test-ab-1" }, d);
  // an ordinary search referrer must NOT be counted as an assistant
  recordEvent("x", "view", 0, now, { ref: "https://www.bing.com/search", sid: "test-ab-2" }, d);

  const rows = assistantBreakdown({ days: 1 }, d);
  const chatgpt = rows.find(r => r.assistant === "ChatGPT");
  assert.ok(chatgpt && chatgpt.views >= 1, "utm-tagged ChatGPT referral is counted");
  assert.ok(!rows.some(r => /bing/i.test(r.assistant) || r.assistant === "Other AI"),
    "search referrers are not swept into the assistant panel");

  d.prepare("DELETE FROM events WHERE sid LIKE 'test-ab-%'").run();
});

// Addressable claims. The endpoint publishes deep links; the renderer must emit
// the anchors they point at. These two are built from the SAME claimFragment()
// helper precisely so they cannot drift — the first run shipped 18 of 60 links
// pointing at nothing because compare rows had no id.
import { buildClaims } from "../lib/claims.js";
import { claimFragment, renderArticle } from "../lib/render.js";

test("claimFragment is deterministic and namespaced by kind", () => {
  assert.equal(claimFragment("fig", "H100 hourly price", 1), "fig-h100-hourly-price");
  assert.equal(claimFragment("fig", "H100 hourly price", 9), claimFragment("fig", "H100 hourly price", 1),
    "same text must yield the same fragment regardless of position");
  assert.match(claimFragment("cmp", "", 3), /^cmp-n3$/, "empty text falls back to an index, never an empty id");
});

test("claims parse hydrated arrays, not just frontmatter strings", () => {
  // db.js hydrates figures/faq/compare into arrays of cell arrays. Stringifying
  // those yields "a,b,c" which still parses and silently glues each value onto
  // its own definition — the first build of this endpoint did exactly that.
  const c = buildClaims({ limit: 400 });
  const fig = c.claims.find(x => x.type === "figure");
  if (fig) {
    assert.ok(!/,/.test(fig.value.slice(0, 4)) || fig.statement,
      "value and statement are separate fields, not one comma-joined blob");
    assert.ok(fig.statement !== undefined, "figure carries its definition");
  }
  const cmp = c.claims.find(x => x.type === "comparison");
  if (cmp) assert.ok(cmp.subject && Object.keys(cmp.attributes).length, "comparison has a subject and attributes");
});

test("every published claim deep-links to an anchor the article actually renders", () => {
  const c = buildClaims({ limit: 40 });
  const bySlug = new Map();
  let checked = 0;
  for (const claim of c.claims) {
    const slug = claim.id.split("#")[0];
    if (!bySlug.has(slug)) {
      const p = allPosts().find(x => x.slug === slug);
      bySlug.set(slug, p ? renderArticle(p, [], 0, {}) : "");
    }
    const html = bySlug.get(slug);
    if (!html) continue;
    checked++;
    assert.ok(html.includes(`id="${claim.anchor}"`),
      `claim ${claim.id} (${claim.type}) points at an anchor that is not rendered`);
  }
  assert.ok(checked > 0, "fixture should yield at least one claim to verify");
});
