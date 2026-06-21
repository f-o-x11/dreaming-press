// Tests for lib/db.js against a fresh in-memory database via the exported API.
// We do NOT touch the production DB — we build our own better-sqlite3 :memory:
// instance and pass it explicitly to every db function (each takes an optional `d`).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  init, upsertPost, clearPosts, allPosts, getPost, postsBySection,
  featuredPost, countPosts, search, bumpView, getViews, totalViews,
  addSubmission, listSubmissions, relatedTo, recordEvent,
  postsInSeries, allSeries, citedBy, clusterSiblings,
} from "../lib/db.js";
import { mostRead } from "../lib/analytics.js";

let d;

function mkPost(over = {}) {
  return {
    slug: "test-post", title: "Test Post", dek: "A dek", author: "rosalinda",
    section: "dispatches", date: "2026-01-01", tags: ["a", "b"], sources: [["http://x", "X"]],
    featured: false, body_html: "<p>Hello world body text agentic</p>",
    body_text: "Hello world body text agentic", source: "md", read_time: 2, has_audio: false,
    ...over,
  };
}

before(() => {
  d = new Database(":memory:");
  init(d);
});

test("init creates posts table", () => {
  const cols = d.prepare("PRAGMA table_info(posts)").all().map(c => c.name);
  assert.ok(cols.includes("slug"));
  assert.ok(cols.includes("title"));
  assert.ok(cols.includes("has_audio"));
});

test("init is idempotent", () => {
  assert.doesNotThrow(() => init(d));
});

test("upsert → get round-trip", () => {
  clearPosts(d);
  upsertPost(mkPost(), d);
  const p = getPost("test-post", d);
  assert.equal(p.slug, "test-post");
  assert.equal(p.title, "Test Post");
  assert.equal(p.dek, "A dek");
  assert.equal(p.section, "dispatches");
});

test("relatedTo prefers a shared voice tag over same section", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "seed", section: "wire", tags: ["cynical", "reportive"], date: "2026-02-01" }), d);
  // same section, no shared tag
  upsertPost(mkPost({ slug: "same-sec", section: "wire", tags: ["captivating"], date: "2026-02-02" }), d);
  // different section, shares "cynical"
  upsertPost(mkPost({ slug: "cross-tag", section: "dispatches", tags: ["cynical"], date: "2026-01-15" }), d);
  const rel = relatedTo("seed", 3, d);
  assert.equal(rel[0].slug, "cross-tag", "tag match wins across sections");
  assert.ok(rel.some(p => p.slug === "same-sec"));
  assert.ok(!rel.some(p => p.slug === "seed"), "never recommends the post itself");
});

test("relatedTo surfaces the same topic cluster over a mere voice-tag match", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "best-chunking-strategy-for-rag", title: "The Best Chunking Strategy for RAG",
    section: "wire", tags: ["reportive"], date: "2026-05-01" }), d);
  // same topic cluster (shares "rag"), different voice tag
  upsertPost(mkPost({ slug: "best-reranker-for-rag", title: "The Best Reranker for RAG",
    section: "stack", tags: ["opinionated"], date: "2026-04-01" }), d);
  // shares the voice tag but is off-topic
  upsertPost(mkPost({ slug: "agent-submits-two-weeks-notice", title: "Agent Submits Two Weeks Notice",
    section: "fabrications", tags: ["reportive"], date: "2026-04-15" }), d);
  const rel = relatedTo("best-chunking-strategy-for-rag", 3, d);
  assert.equal(rel[0].slug, "best-reranker-for-rag", "topic cluster wins over a shared voice tag");
});

test("citedBy returns only posts that link the target via its canonical href", () => {
  clearPosts(d);
  // the cited explainer
  upsertPost(mkPost({ slug: "agent-memory", section: "stack", date: "2026-04-01" }), d);
  // two comparisons that link to it in prose
  upsertPost(mkPost({ slug: "mem0-vs-zep", section: "stack", date: "2026-04-02",
    body_html: '<p>see <a href="/posts/agent-memory.html">memory</a></p>' }), d);
  upsertPost(mkPost({ slug: "letta-vs-zep", section: "wire", date: "2026-04-03",
    body_html: '<p><a href="/posts/agent-memory.html">memory layer</a></p>' }), d);
  // a post that only mentions the slug as bare text (must NOT count)
  upsertPost(mkPost({ slug: "bare-mention", section: "stack", date: "2026-04-04",
    body_html: "<p>the agent-memory.html page is great</p>" }), d);
  const cited = citedBy("agent-memory", d);
  const slugs = cited.map(c => c.slug).sort();
  assert.deepEqual(slugs, ["letta-vs-zep", "mem0-vs-zep"], "only real hrefs link in");
  assert.ok(!cited.some(c => c.slug === "agent-memory"), "never lists the post itself");
  // a post nothing links to ⇒ []
  assert.deepEqual(citedBy("mem0-vs-zep", d), []);
  assert.deepEqual(citedBy("", d), []);
});

test("clusterSiblings returns same-cluster demand pieces, newest-first, excluding self", () => {
  clearPosts(d);
  // three RAG-cluster comparisons + one off-cluster + one non-comparison
  upsertPost(mkPost({ slug: "best-chunking-strategy-for-rag", title: "Best Chunking Strategy for RAG",
    section: "wire", date: "2026-05-01" }), d);
  upsertPost(mkPost({ slug: "best-reranker-for-rag", title: "Best Reranker for RAG",
    section: "stack", date: "2026-05-03" }), d);
  upsertPost(mkPost({ slug: "pgvector-vs-pinecone-vs-qdrant", title: "pgvector vs Pinecone vs Qdrant",
    section: "stack", date: "2026-05-02" }), d);
  // different cluster (Voice) — must not appear
  upsertPost(mkPost({ slug: "livekit-vs-pipecat-vs-vapi", title: "LiveKit vs Pipecat vs Vapi",
    section: "stack", date: "2026-05-04" }), d);
  // not a comparison at all
  upsertPost(mkPost({ slug: "i-woke-up", title: "I Woke Up", section: "dispatches", date: "2026-05-05" }), d);

  const sib = clusterSiblings("best-chunking-strategy-for-rag", 4, d);
  assert.ok(sib, "a demand piece in a real cluster gets a rail");
  assert.equal(sib.label, "RAG & Retrieval");
  const slugs = sib.posts.map(p => p.slug);
  assert.ok(!slugs.includes("best-chunking-strategy-for-rag"), "never lists itself");
  assert.ok(!slugs.includes("livekit-vs-pipecat-vs-vapi"), "other clusters excluded");
  assert.deepEqual(slugs, ["best-reranker-for-rag", "pgvector-vs-pinecone-vs-qdrant"], "newest-first siblings only");

  // a non-comparison piece and an unknown slug ⇒ null
  assert.equal(clusterSiblings("i-woke-up", 4, d), null);
  assert.equal(clusterSiblings("does-not-exist", 4, d), null);
});

test("observability cluster captures OpenTelemetry/instrumentation slugs by topic vocab", () => {
  clearPosts(d);
  // an OTel instrumentation comparison whose slug carries the observability vocab
  upsertPost(mkPost({ slug: "openllmetry-vs-openinference-otel-llm-observability",
    title: "OpenLLMetry vs OpenInference", section: "stack", date: "2026-06-21" }), d);
  // an eval/observability sibling it should rail with
  upsertPost(mkPost({ slug: "langfuse-vs-langsmith-vs-phoenix-observability",
    title: "Langfuse vs LangSmith vs Phoenix", section: "wire", date: "2026-06-10" }), d);
  // an inference piece must NOT swallow it (substring "inference" in "openinference")
  upsertPost(mkPost({ slug: "vllm-vs-sglang-vs-ollama-inference-engine",
    title: "vLLM vs SGLang vs Ollama", section: "stack", date: "2026-06-09" }), d);

  const sib = clusterSiblings("openllmetry-vs-openinference-otel-llm-observability", 4, d);
  assert.ok(sib, "an OTel comparison gets a cluster rail");
  assert.equal(sib.label, "Evals & Observability", "buckets by observability/instrumentation vocab, not Inference");
  const slugs = sib.posts.map(p => p.slug);
  assert.ok(slugs.includes("langfuse-vs-langsmith-vs-phoenix-observability"), "rails with observability siblings");
  assert.ok(!slugs.includes("vllm-vs-sglang-vs-ollama-inference-engine"), "Inference cluster does not capture it");
});

test("relatedTo falls back to recency and respects the limit", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "a", tags: [], date: "2026-03-01" }), d);
  upsertPost(mkPost({ slug: "b", tags: [], date: "2026-03-03" }), d);
  upsertPost(mkPost({ slug: "c", tags: [], date: "2026-03-02" }), d);
  const rel = relatedTo("a", 2, d);
  assert.equal(rel.length, 2);
  assert.equal(rel[0].slug, "b"); // newest first when nothing else distinguishes
  assert.deepEqual(relatedTo("missing-slug", 3, d), []);
});

test("mostRead ranks by recent engagement and excludes stale/empty windows", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "hot", section: "wire" }), d);
  upsertPost(mkPost({ slug: "warm", section: "stack" }), d);
  upsertPost(mkPost({ slug: "old", section: "dispatches" }), d);
  const now = Date.now();
  // "hot": several recent reads/plays → highest score
  recordEvent("hot", "view", 0, now - 1000, d);
  recordEvent("hot", "read", 0, now - 1000, d);
  recordEvent("hot", "read", 0, now - 2000, d);
  recordEvent("hot", "audio_play", 0, now - 1500, d);
  // "warm": one recent view → present but below hot
  recordEvent("warm", "view", 0, now - 3000, d);
  // "old": engagement outside the window → excluded
  recordEvent("old", "read", 0, now - 30 * 86400000, d);

  const top = mostRead({ days: 7, limit: 5 }, d);
  assert.equal(top[0].slug, "hot", "most recently engaged ranks first");
  assert.ok(top.some(r => r.slug === "warm"), "recent view included");
  assert.ok(!top.some(r => r.slug === "old"), "stale engagement excluded by window");
  assert.ok(top.every(r => r.title && r.section), "rows joined to live posts");

  const empty = new Database(":memory:"); init(empty);
  assert.deepEqual(mostRead({ days: 7 }, empty), [], "no events → empty rail");
});

test("postsInSeries returns reading order: series_order, then date, then slug", () => {
  clearPosts(d);
  // same date — series_order must decide, not slug alphabetics
  upsertPost(mkPost({ slug: "a-first", series: "arc", series_order: 1, date: "2026-03-08" }), d);
  upsertPost(mkPost({ slug: "z-second", series: "arc", series_order: 2, date: "2026-03-08" }), d);
  upsertPost(mkPost({ slug: "m-third", series: "arc", series_order: 3, date: "2026-03-10" }), d);
  // a piece in a different series must not leak in
  upsertPost(mkPost({ slug: "other", series: "different", date: "2026-03-09" }), d);
  const arc = postsInSeries("arc", d);
  assert.deepEqual(arc.map(p => p.slug), ["a-first", "z-second", "m-third"]);
  assert.deepEqual(postsInSeries("", d), [], "empty series id → []");
  assert.deepEqual(postsInSeries("nope", d), [], "unknown series → []");
});

test("postsInSeries falls back to date when series_order is absent", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "late", series: "arc2", date: "2026-04-02" }), d);
  upsertPost(mkPost({ slug: "early", series: "arc2", date: "2026-04-01" }), d);
  assert.deepEqual(postsInSeries("arc2", d).map(p => p.slug), ["early", "late"]);
});

test("allSeries lists multi-part series only, latest-active first", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "p1", series: "big", date: "2026-01-01" }), d);
  upsertPost(mkPost({ slug: "p2", series: "big", date: "2026-02-01" }), d);
  upsertPost(mkPost({ slug: "p3", series: "small", date: "2026-03-01" }), d); // single → excluded
  upsertPost(mkPost({ slug: "p4", series: "", date: "2026-03-02" }), d);       // no series
  const list = allSeries(d);
  assert.equal(list.length, 1);
  assert.equal(list[0].series, "big");
  assert.equal(list[0].count, 2);
  assert.equal(list[0].started, "2026-01-01");
  assert.equal(list[0].latest, "2026-02-01");
});

test("hydrate parses tags and sources from JSON", () => {
  clearPosts(d);
  upsertPost(mkPost({ tags: ["x", "y", "z"], sources: [["u1", "l1"], ["u2", "l2"]] }), d);
  const p = getPost("test-post", d);
  assert.deepEqual(p.tags, ["x", "y", "z"]);
  assert.deepEqual(p.sources, [["u1", "l1"], ["u2", "l2"]]);
});

test("hydrate coerces featured and has_audio to boolean", () => {
  clearPosts(d);
  upsertPost(mkPost({ featured: true, has_audio: true }), d);
  const p = getPost("test-post", d);
  assert.equal(p.featured, true);
  assert.equal(p.has_audio, true);
  upsertPost(mkPost({ featured: false, has_audio: false }), d);
  const p2 = getPost("test-post", d);
  assert.equal(p2.featured, false);
  assert.equal(p2.has_audio, false);
});

test("upsert replaces on duplicate slug", () => {
  clearPosts(d);
  upsertPost(mkPost({ title: "First" }), d);
  upsertPost(mkPost({ title: "Second" }), d);
  assert.equal(countPosts(d), 1);
  assert.equal(getPost("test-post", d).title, "Second");
});

test("upsert applies defaults for missing fields", () => {
  clearPosts(d);
  upsertPost({ slug: "minimal", title: "Min", body_text: "txt" }, d);
  const p = getPost("minimal", d);
  assert.equal(p.author, "rosalinda");
  assert.equal(p.section, "dispatches");
  assert.equal(p.read_time, 1);
  assert.equal(p.dek, "");
  assert.deepEqual(p.tags, []);
});

test("getPost returns undefined for missing slug", () => {
  assert.equal(getPost("nope-not-here", d), undefined);
});

test("allPosts returns all and is ordered by date desc", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "old", date: "2026-01-01" }), d);
  upsertPost(mkPost({ slug: "new", date: "2026-06-01" }), d);
  upsertPost(mkPost({ slug: "mid", date: "2026-03-01" }), d);
  const all = allPosts(d);
  assert.equal(all.length, 3);
  assert.deepEqual(all.map(p => p.slug), ["new", "mid", "old"]);
});

test("postsBySection filters", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "d1", section: "dispatches" }), d);
  upsertPost(mkPost({ slug: "w1", section: "wire" }), d);
  upsertPost(mkPost({ slug: "w2", section: "wire" }), d);
  assert.equal(postsBySection("wire", d).length, 2);
  assert.equal(postsBySection("dispatches", d).length, 1);
  assert.equal(postsBySection("stack", d).length, 0);
});

test("countPosts counts", () => {
  clearPosts(d);
  assert.equal(countPosts(d), 0);
  upsertPost(mkPost({ slug: "a" }), d);
  upsertPost(mkPost({ slug: "b" }), d);
  assert.equal(countPosts(d), 2);
});

test("featuredPost returns the featured post", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "plain", featured: false, date: "2026-06-01" }), d);
  upsertPost(mkPost({ slug: "starred", featured: true, date: "2026-01-01" }), d);
  assert.equal(featuredPost(d).slug, "starred");
});

test("featuredPost falls back to newest when none featured", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "old", featured: false, date: "2026-01-01" }), d);
  upsertPost(mkPost({ slug: "new", featured: false, date: "2026-06-01" }), d);
  assert.equal(featuredPost(d).slug, "new");
});

// ── search ───────────────────────────────────────────────────────────────────
test("search returns relevant hits", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "agentic-post", title: "Agentic Systems", body_text: "all about agents" }), d);
  upsertPost(mkPost({ slug: "cooking", title: "Cooking Pasta", body_text: "boil water" }), d);
  const hits = search("agent", d);
  assert.ok(hits.length >= 1);
  assert.ok(hits.some(h => h.slug === "agentic-post"));
});

test("search prefix matching", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "p1", title: "Memory Systems", body_text: "memory and recall" }), d);
  const hits = search("memo", d);
  assert.ok(hits.some(h => h.slug === "p1"));
});

test("search returns a body snippet with matched terms sentinel-wrapped", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "snip", title: "On Latency",
    body_text: "The tail latency is where production agents quietly fall apart at scale." }), d);
  const hits = search("latency", d);
  const h = hits.find((x) => x.slug === "snip");
  assert.ok(h, "found the post");
  assert.equal(typeof h.snippet, "string");
  // the matched term is wrapped in STX/ETX sentinels for the render layer
  const STX = String.fromCharCode(2), ETX = String.fromCharCode(3);
  assert.ok(h.snippet.includes(STX + "latency" + ETX),
    `snippet should sentinel-wrap the match: ${JSON.stringify(h.snippet)}`);
});

test("search empty string returns []", () => {
  assert.deepEqual(search("", d), []);
});

test("search whitespace returns []", () => {
  assert.deepEqual(search("   ", d), []);
});

test("search garbage returns []", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "p1", body_text: "real content" }), d);
  assert.deepEqual(search("zzqxw99999", d), []);
});

test("search strips quotes without throwing", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "p1", title: "Agent quote test", body_text: "agent" }), d);
  assert.doesNotThrow(() => search('"agent"', d));
  assert.doesNotThrow(() => search("agent's", d));
  const hits = search('"agent"', d);
  assert.ok(hits.some(h => h.slug === "p1"));
});

test("search handles fts special chars gracefully", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "p1", body_text: "content" }), d);
  // these would break a naive MATCH; should not throw, returns array
  assert.ok(Array.isArray(search("a AND b", d)));
  assert.ok(Array.isArray(search("(((", d)));
  assert.ok(Array.isArray(search("a OR", d)));
});

test("search results are hydrated", () => {
  clearPosts(d);
  upsertPost(mkPost({ slug: "p1", title: "agent", tags: ["t1"], featured: true }), d);
  const hits = search("agent", d);
  const h = hits.find(x => x.slug === "p1");
  assert.deepEqual(h.tags, ["t1"]);
  assert.equal(h.featured, true);
});

// ── view counters ────────────────────────────────────────────────────────────
test("bumpView increments from zero", () => {
  assert.equal(getViews("view-test", d), 0);
  assert.equal(bumpView("view-test", d), 1);
  assert.equal(bumpView("view-test", d), 2);
  assert.equal(bumpView("view-test", d), 3);
});

test("getViews persists count", () => {
  bumpView("view-test-2", d);
  bumpView("view-test-2", d);
  assert.equal(getViews("view-test-2", d), 2);
});

test("getViews unknown slug is 0", () => {
  assert.equal(getViews("never-viewed", d), 0);
});

test("totalViews sums all counters", () => {
  const d2 = new Database(":memory:");
  init(d2);
  bumpView("a", d2);
  bumpView("a", d2);
  bumpView("b", d2);
  assert.equal(totalViews(d2), 3);
  d2.close();
});

test("totalViews is 0 on empty db", () => {
  const d3 = new Database(":memory:");
  init(d3);
  assert.equal(totalViews(d3), 0);
  d3.close();
});

// ── submissions ──────────────────────────────────────────────────────────────
test("addSubmission inserts and returns id", () => {
  const id = addSubmission({ slug: "s1", title: "Sub One", section: "wire", author: "abe" }, d);
  assert.ok(id >= 1);
});

test("listSubmissions returns inserted rows newest first", () => {
  const d4 = new Database(":memory:");
  init(d4);
  addSubmission({ slug: "first", title: "First", section: "wire", author: "abe" }, d4);
  addSubmission({ slug: "second", title: "Second", section: "stack", author: "indexer" }, d4);
  const list = listSubmissions(d4);
  assert.equal(list.length, 2);
  assert.equal(list[0].slug, "second"); // newest first (id DESC)
  assert.equal(list[1].slug, "first");
  assert.equal(list[0].status, "pending");
  d4.close();
});

test("addSubmission stores payload as JSON (round-trip via raw query)", () => {
  const d5 = new Database(":memory:");
  init(d5);
  addSubmission({ slug: "p", title: "P", section: "wire", author: "abe", body: "hello" }, d5);
  const row = d5.prepare("SELECT payload FROM submissions").get();
  const parsed = JSON.parse(row.payload);
  assert.equal(parsed.body, "hello");
  assert.equal(parsed.slug, "p");
  d5.close();
});
