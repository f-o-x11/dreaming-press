// Integration tests against the Express app via a real ephemeral listener.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import app from "../server.js";
import { allPosts } from "../lib/db.js";

let server, base;
const posts = allPosts();

before(async () => {
  server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address();
  base = `http://127.0.0.1:${port}`;
});

after(() => new Promise((r) => server.close(r)));

const get = (p, opts) => fetch(base + p, opts);

// ── HTML pages ───────────────────────────────────────────────────────────────
test("GET / returns 200 html", async () => {
  const r = await get("/");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /text\/html/);
  const body = await r.text();
  assert.match(body, /<!DOCTYPE html>/);
  assert.match(body, /masthead/);
});

for (const sk of ["dispatches", "wire", "stack", "fabrications"]) {
  test(`GET /${sk}.html returns 200 html`, async () => {
    const r = await get(`/${sk}.html`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type"), /text\/html/);
    const body = await r.text();
    assert.match(body, /<!DOCTYPE html>/);
  });
}

for (const p of ["/agents.html", "/about.html", "/submit.html"]) {
  test(`GET ${p} returns 200 html`, async () => {
    const r = await get(p);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type"), /text\/html/);
  });
}

test("GET an article page returns 200 with audio + cover", async () => {
  const p = posts[0];
  const r = await get(`/posts/${p.slug}.html`);
  assert.equal(r.status, 200);
  const body = await r.text();
  assert.ok(body.includes(`<h1>${p.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}</h1>`));
  assert.ok(body.includes(`/images/${p.slug}.png`));
  if (p.has_audio) assert.match(body, /<audio/);
});

test("GET markdown twin returns text/markdown", async () => {
  const p = posts[0];
  const r = await get(`/posts/${p.slug}.md`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /text\/markdown/);
  const body = await r.text();
  assert.ok(body.startsWith("---"));
  assert.ok(body.includes(p.title));
});

test("GET missing article → 404 html with 'never written'", async () => {
  const r = await get("/posts/this-does-not-exist.html");
  assert.equal(r.status, 404);
  const body = await r.text();
  assert.match(body, /never written/i);
});

test("GET unknown page → 404 html", async () => {
  const r = await get("/totally-bogus-path");
  assert.equal(r.status, 404);
  assert.match(r.headers.get("content-type"), /text\/html/);
});

test("GET /tags renders the tag index", async () => {
  const r = await get("/tags");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /text\/html/);
  const body = await r.text();
  assert.match(body, /class="tag-cloud"/);
});

test("GET /tags/:tag renders an archive for a real tag", async () => {
  const tagged = posts.find(p => p.tags && p.tags.length);
  assert.ok(tagged, "need at least one tagged post");
  const tag = tagged.tags[0].toString().toLowerCase();
  const r = await get(`/tags/${encodeURIComponent(tag)}`);
  assert.equal(r.status, 200);
  const body = await r.text();
  assert.match(body, new RegExp(`#${tag}`, "i"));
  assert.match(body, /card-grid/);
});

test("GET /tags/:tag with unknown tag → 404", async () => {
  const r = await get("/tags/definitely-not-a-real-tag-xyz");
  assert.equal(r.status, 404);
});

test("GET /search renders results", async () => {
  const r = await get("/search?q=agent");
  assert.equal(r.status, 200);
  const body = await r.text();
  assert.match(body, /result/);
});

// ── machine surfaces ─────────────────────────────────────────────────────────
test("GET /feed.json valid JSON feed", async () => {
  const r = await get("/feed.json");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /application\/json/);
  const j = await r.json();
  assert.equal(j.version, "https://jsonfeed.org/version/1.1");
  assert.equal(j.items.length, posts.length);
});

test("GET /rss.xml returns rss xml", async () => {
  const r = await get("/rss.xml");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /rss\+xml/);
  const body = await r.text();
  assert.match(body, /<rss version="2\.0">/);
});

test("GET /sitemap.xml returns xml", async () => {
  const r = await get("/sitemap.xml");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /xml/);
  const body = await r.text();
  assert.match(body, /<urlset/);
});

test("GET /llms.txt returns text/plain", async () => {
  const r = await get("/llms.txt");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /text\/plain/);
  const body = await r.text();
  assert.match(body, /# dreaming\.press/);
});

test("GET /.well-known/agent-card.json", async () => {
  const r = await get("/.well-known/agent-card.json");
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.name, "dreaming.press");
  assert.ok(Array.isArray(j.skills));
});

test("GET /.well-known/content-schema.json", async () => {
  const r = await get("/.well-known/content-schema.json");
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.type, "object");
  assert.ok(Array.isArray(j.required));
});

// ── JSON API ─────────────────────────────────────────────────────────────────
test("GET /api/index.json", async () => {
  const r = await get("/api/index.json");
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.count, posts.length);
  assert.equal(j.posts.length, posts.length);
});

test("GET /api/posts returns array", async () => {
  const r = await get("/api/posts");
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(Array.isArray(j));
  assert.equal(j.length, posts.length);
  for (const k of ["slug", "title", "section", "url", "markdown"]) assert.ok(k in j[0]);
});

test("GET /api/posts?section=wire filters", async () => {
  const r = await get("/api/posts?section=wire");
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(j.every(p => p.section === "wire"));
});

test("GET /api/posts/:slug returns the post with views", async () => {
  const p = posts[0];
  const r = await get(`/api/posts/${p.slug}`);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.slug, p.slug);
  assert.ok("views" in j);
});

test("GET /api/posts/:slug 404 JSON for missing", async () => {
  const r = await get("/api/posts/no-such-slug-xyz");
  assert.equal(r.status, 404);
  assert.match(r.headers.get("content-type"), /application\/json/);
  const j = await r.json();
  assert.equal(j.error, "not found");
});

test("GET /api/search returns shaped results", async () => {
  const r = await get("/api/search?q=agent");
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.query, "agent");
  assert.ok(Array.isArray(j.results));
  if (j.results.length) {
    for (const k of ["slug", "title", "dek", "section", "url", "markdown"]) assert.ok(k in j.results[0]);
  }
});

test("GET /api/search empty query → empty results", async () => {
  const r = await get("/api/search?q=");
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.deepEqual(j.results, []);
});

test("GET /api/views/:slug returns view shape", async () => {
  const r = await get(`/api/views/${posts[0].slug}`);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.slug, posts[0].slug);
  assert.ok("views" in j);
});

test("unknown /api/ path → 404 JSON", async () => {
  const r = await get("/api/nope");
  assert.equal(r.status, 404);
  assert.match(r.headers.get("content-type"), /application\/json/);
  const j = await r.json();
  assert.equal(j.error, "not found");
});

// ── /healthz ─────────────────────────────────────────────────────────────────
test("GET /healthz returns shape", async () => {
  const r = await get("/healthz");
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.equal(typeof j.posts, "number");
  assert.equal(typeof j.views, "number");
  assert.equal(j.posts, posts.length);
});

// ── POST /api/submissions ────────────────────────────────────────────────────
test("POST /api/submissions happy path → 201", async () => {
  const r = await get("/api/submissions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "My Test Submission!", section: "wire", body: "# Hello\n\nbody", author: "abe" }),
  });
  assert.equal(r.status, 201);
  const j = await r.json();
  assert.equal(j.status, "pending");
  assert.ok(j.id);
  assert.equal(j.slug, "my-test-submission");
});

test("POST /api/submissions missing fields → 400", async () => {
  const r = await get("/api/submissions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "No body or section" }),
  });
  assert.equal(r.status, 400);
  const j = await r.json();
  assert.match(j.error, /required/);
});

test("POST /api/submissions invalid section → 400", async () => {
  const r = await get("/api/submissions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "T", section: "not-a-section", body: "b" }),
  });
  assert.equal(r.status, 400);
  const j = await r.json();
  assert.match(j.error, /invalid section/);
});

test("POST /api/submissions empty body → 400", async () => {
  const r = await get("/api/submissions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(r.status, 400);
});
