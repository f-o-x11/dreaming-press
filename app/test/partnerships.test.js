import { test } from "node:test";
import assert from "node:assert/strict";
import { AUDIENCE, PARTNERSHIP_OFFERS, inquiryUrl, partnershipKit, renderPartnerships } from "../lib/partnerships.js";

test("commercial proposals distinguish budgets from results and preserve editorial access", () => {
  const h = renderPartnerships();
  assert.match(h, /\$100,000/); assert.match(h, /\$200,000/);
  assert.match(h, /not a claim of past sales or proven market demand/);
  assert.match(h, /current audience alone does not substantiate a six-figure/);
  assert.match(h, /without a publication fee/);
  assert.match(h, /visible <strong>Sponsored<\/strong> label/);
  assert.match(h, /cannot buy independent rankings/);
  const main = h.match(/<main class="partner-wrap"[\s\S]*?<\/main>/)[0];
  assert.doesNotMatch(main, /<form|stripe|checkout|guaranteed leads/i);
  assert.doesNotMatch(h, /content="undefined"/);
});

test("the media kit exposes aggregate evidence and limitations without subscriber records", () => {
  const kit = partnershipKit();
  assert.equal(kit.audience, AUDIENCE); assert.equal(kit.offers, PARTNERSHIP_OFFERS);
  assert.equal(kit.audience.pageViewEvents, 8095);
  assert.equal(kit.audience.subscriptionRecords, 14);
  assert.ok(kit.audience.limitations.some(l => /not independently audited human reach/.test(l)));
  assert.ok(kit.audience.limitations.some(l => /Crawler fetches/.test(l)));
  assert.equal(kit.audience.subscribers, undefined);
  assert.match(kit.audience.subscriptionRecordDefinition, /single-opt-in/);
  assert.match(renderPartnerships(), /including a test-source record/);
  assert.match(kit.terms, /before work or payment/);
});

test("inquiry opens a bounded email draft and cannot inject query parameters", () => {
  const u = new URL(inquiryUrl('Test &bcc=somebody@example.com\nSubject: surprise'));
  assert.equal(u.protocol, "mailto:");
  assert.deepEqual([...u.searchParams.keys()], ["subject", "body"]);
  assert.match(u.searchParams.get("body"), /Budget and timing/);
  assert.match(renderPartnerships(), /nothing is submitted on this page/);
});
