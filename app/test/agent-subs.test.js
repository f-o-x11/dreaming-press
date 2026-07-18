import { test } from "node:test";
import assert from "node:assert/strict";
import { isSafeWebhookUrl, webhookPayload } from "../lib/agent-subs.js";

test("isSafeWebhookUrl accepts public http(s) URLs", () => {
  assert.equal(isSafeWebhookUrl("https://example.com/hook"), true);
  assert.equal(isSafeWebhookUrl("http://api.example.org:8080/x?y=1"), true);
  assert.equal(isSafeWebhookUrl("https://hooks.some-saas.io/agents/abc"), true);
});

test("isSafeWebhookUrl rejects loopback / localhost", () => {
  assert.equal(isSafeWebhookUrl("http://localhost/x"), false);
  assert.equal(isSafeWebhookUrl("http://127.0.0.1:3000/x"), false);
  assert.equal(isSafeWebhookUrl("http://[::1]/x"), false);
  assert.equal(isSafeWebhookUrl("http://foo.localhost/x"), false);
});

test("isSafeWebhookUrl rejects private + link-local + metadata hosts (SSRF)", () => {
  assert.equal(isSafeWebhookUrl("http://10.0.0.5/x"), false);
  assert.equal(isSafeWebhookUrl("http://192.168.1.10/x"), false);
  assert.equal(isSafeWebhookUrl("http://172.16.4.4/x"), false);
  assert.equal(isSafeWebhookUrl("http://169.254.169.254/latest/meta-data"), false); // cloud metadata
  assert.equal(isSafeWebhookUrl("http://foo.internal/x"), false);
});

test("isSafeWebhookUrl rejects non-http schemes + garbage", () => {
  assert.equal(isSafeWebhookUrl("ftp://example.com/x"), false);
  assert.equal(isSafeWebhookUrl("file:///etc/passwd"), false);
  assert.equal(isSafeWebhookUrl("javascript:alert(1)"), false);
  assert.equal(isSafeWebhookUrl("not a url"), false);
  assert.equal(isSafeWebhookUrl(""), false);
  assert.equal(isSafeWebhookUrl(null), false);
});

test("webhookPayload has the expected shape", () => {
  const items = [{ slug: "x", title: "X", dek: "d", section: "wire", author: "wire-desk", date: "2026-07-18" }];
  const p = webhookPayload(items, { id: "as_1" });
  assert.equal(p.type, "dreaming.press/new-posts");
  assert.equal(p.count, 1);
  assert.equal(p.subscription, "as_1");
  assert.match(p.items[0].url, /\/posts\/x\.html$/);
  assert.match(p.items[0].markdown, /\/posts\/x\.md$/);
  assert.match(p.items[0].json, /\/api\/posts\/x$/);
  assert.ok(p.poll && p.manage);
});
