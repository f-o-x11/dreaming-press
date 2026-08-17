import { test } from "node:test";
import assert from "node:assert/strict";
import { footer } from "../lib/render.js";
import { renderAbout } from "../lib/pages.js";

// Route-family telemetry. 640 of ~2,476 URLs reported nothing before this — the
// hubs were invisible to every report even though /build is the most-crawled path
// on the domain. These guard the two invariants that make the rollup trustworthy.

test("footer carries the page beacon on every page that renders one", () => {
  const html = footer();
  assert.match(html, /__dpBeacon/, "page beacon present");
  assert.match(html, /page:/, "emits under the page: namespace");
  assert.match(html, /sendBeacon/, "actually posts");
});

test("the page beacon self-suppresses so article pages keep their richer events", () => {
  // The article beacon renders earlier in the document and claims the flag first.
  // Without this guard an article would emit BOTH a slug view and a page: view,
  // double-counting every article in the funnel.
  const html = footer();
  assert.match(html, /if\(window\.__dpBeacon\)return/, "guards on the shared flag");
});

test("article paths are excluded from route-family collapse", () => {
  // /posts/* must fall through to the article beacon, never be rewritten into a
  // family key — otherwise 1,838 distinct articles collapse into one bucket.
  const html = footer();
  assert.match(html, /\\\/posts\\\//, "posts pattern present in the family table");
  assert.match(html, /FAM\[i\]\[1\]===null\)return/, "null family means: emit nothing here");
});

test("high-cardinality routes collapse to a family, not a raw URL", () => {
  const html = footer();
  for (const fam of ["/compare/:pair", "/stack/:tool", "/best/:cat", "/topics/:topic"]) {
    assert.ok(html.includes(fam), `collapses to ${fam}`);
  }
});

test("a non-article page renders the beacon end to end", () => {
  const html = renderAbout();
  assert.match(html, /__dpBeacon/, "a real page render carries telemetry");
});
