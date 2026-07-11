import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFacts } from "../lib/facts.js";
import { renderFacts } from "../lib/render.js";

test("buildFacts computes real, non-fabricated figures", () => {
  const f = buildFacts();
  assert.ok(f.publication.totalArticles > 0, "has articles");
  assert.equal(
    f.publication.totalArticles,
    Object.values(f.publication.bySection).reduce((a, b) => a + b, 0),
    "section counts sum to total (no invented rows)"
  );
  assert.ok(f.toolDirectory.trackedTools > 0, "has tools");
  assert.equal(
    f.toolDirectory.totalGitHubStars,
    f.toolDirectory.tools.reduce((a, t) => a + t.stars, 0),
    "total stars = sum of tool stars"
  );
  assert.ok(f.publication.neuralNarratedPct >= 0 && f.publication.neuralNarratedPct <= 1, "pct in [0,1]");
  assert.match(f.license, /creativecommons/, "CC licensed");
  assert.ok(f.generated, "carries a generated timestamp");
});

test("tools are sorted by stars descending", () => {
  const t = buildFacts().toolDirectory.tools;
  for (let i = 1; i < t.length; i++) assert.ok(t[i - 1].stars >= t[i].stars, "descending stars");
});

test("renderFacts emits a Dataset node pointing at the JSON distribution", () => {
  const h = renderFacts(buildFacts());
  assert.match(h, /"@type":\s*"Dataset"/);
  assert.match(h, /"contentUrl":\s*"https:\/\/dreaming\.press\/api\/facts\.json"/);
  assert.match(h, /creativecommons\.org\/licenses\/by\/4\.0/);
  assert.match(h, /\/api\/facts\.json/); // human link to the raw data
});
