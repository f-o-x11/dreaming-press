// SQLite data layer: posts, full-text search (FTS5), view counters, submissions.
import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { TOOLS } from "./tools-data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.DP_DB || path.join(__dirname, "..", "data", "dreaming.db");

let _db;
export function db() {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("busy_timeout = 4000");
  init(_db);
  return _db;
}

export function init(d) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      slug TEXT PRIMARY KEY, title TEXT NOT NULL, dek TEXT, author TEXT,
      section TEXT, date TEXT, tags TEXT, sources TEXT, featured INTEGER DEFAULT 0,
      body_html TEXT, body_text TEXT, source TEXT, read_time INTEGER, has_audio INTEGER DEFAULT 0,
      summary TEXT, art TEXT, audio_bytes INTEGER DEFAULT 0, series TEXT, series_order INTEGER,
      figures TEXT, updated TEXT, faq TEXT, compare TEXT, update_note TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_posts_section ON posts(section);
    CREATE INDEX IF NOT EXISTS idx_posts_date ON posts(date DESC);
    CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
      slug UNINDEXED, title, dek, body_text, section UNINDEXED, tokenize='porter unicode61'
    );
    CREATE TABLE IF NOT EXISTS views (slug TEXT PRIMARY KEY, count INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT, title TEXT, section TEXT,
      author TEXT, payload TEXT, status TEXT DEFAULT 'pending', created TEXT
    );
    CREATE TABLE IF NOT EXISTS subscribers (
      email TEXT PRIMARY KEY, created TEXT, source TEXT, confirmed INTEGER DEFAULT 1,
      unsub_token TEXT
    );
    CREATE TABLE IF NOT EXISTS dispatched (
      slug TEXT PRIMARY KEY, sent_at TEXT
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT, type TEXT, ms INTEGER, ts INTEGER,
      channel TEXT, ref TEXT, sid TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    CREATE TABLE IF NOT EXISTS tools (
      slug TEXT PRIMARY KEY, name TEXT, owner TEXT, repo TEXT, category TEXT,
      lang TEXT, blurb TEXT, use_cases TEXT, alternatives TEXT,
      stars INTEGER DEFAULT 0, pushed_at TEXT, synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tools_category ON tools(category);
  `);
  // migrations for databases created before a column existed (ALTER is idempotent-guarded)
  for (const [col, type] of [["summary", "TEXT"], ["art", "TEXT"], ["audio_bytes", "INTEGER DEFAULT 0"], ["series", "TEXT"], ["series_order", "INTEGER"], ["figures", "TEXT"], ["updated", "TEXT"], ["faq", "TEXT"], ["compare", "TEXT"], ["canonical", "TEXT"], ["update_note", "TEXT"]]) {
    try { d.exec(`ALTER TABLE posts ADD COLUMN ${col} ${type}`); } catch { /* already present */ }
  }
  for (const [col, type] of [["channel", "TEXT"], ["ref", "TEXT"], ["sid", "TEXT"]]) {
    try { d.exec(`ALTER TABLE events ADD COLUMN ${col} ${type}`); } catch { /* already present */ }
  }
  seedTools(d);
}

// ── tools/entities catalog (#16) — the data-backed Stack engine ────────────────
// Seed the static catalog; preserve live star/pushed_at that sync-tools.js writes.
export function seedTools(d = db()) {
  const stmt = d.prepare(`INSERT INTO tools (slug,name,owner,repo,category,lang,blurb,use_cases,alternatives,stars)
    VALUES (@slug,@name,@owner,@repo,@category,@lang,@blurb,@use_cases,@alternatives,@stars)
    ON CONFLICT(slug) DO UPDATE SET
      name=@name, owner=@owner, repo=@repo, category=@category, lang=@lang,
      blurb=@blurb, use_cases=@use_cases, alternatives=@alternatives,
      stars=MAX(tools.stars, @stars)`);
  const tx = d.transaction(() => {
    for (const t of TOOLS) stmt.run({
      slug: t.slug, name: t.name, owner: t.owner, repo: t.repo, category: t.category,
      lang: t.lang || "", blurb: t.blurb || "", use_cases: JSON.stringify(t.useCases || []),
      alternatives: JSON.stringify(t.alternatives || []), stars: t.stars || 0,
    });
  });
  tx();
}
function hydrateTool(r) {
  if (!r) return null;
  return { ...r, useCases: JSON.parse(r.use_cases || "[]"), alternatives: JSON.parse(r.alternatives || "[]") };
}
export function allTools(d = db()) {
  return d.prepare("SELECT * FROM tools ORDER BY stars DESC, name").all().map(hydrateTool);
}
export function getTool(slug, d = db()) {
  return hydrateTool(d.prepare("SELECT * FROM tools WHERE slug = ?").get(String(slug)));
}
export function toolsByCategory(cat, d = db()) {
  return d.prepare("SELECT * FROM tools WHERE category = ? ORDER BY stars DESC, name").all(String(cat)).map(hydrateTool);
}
export function updateToolStars(slug, stars, pushedAt, d = db()) {
  d.prepare("UPDATE tools SET stars = ?, pushed_at = ?, synced_at = ? WHERE slug = ?")
    .run(Number(stars) || 0, pushedAt || null, new Date().toISOString(), String(slug));
}
// posts that mention a tool by name (for the "in our coverage" rail on tool pages)
export function postsMentioning(name, d = db()) {
  const like = `%${String(name).replace(/[%_]/g, "")}%`;
  return d.prepare(`SELECT slug, title, section, date FROM posts
    WHERE body_text LIKE ? OR title LIKE ? ORDER BY date DESC LIMIT 6`).all(like, like);
}

// Classify a visit's acquisition channel from referrer host + utm (#18). This is
// the honest channel attribution the council flagged as missing — so we can prove
// or disprove the AI-referral thesis instead of guessing.
export function classifyChannel(ref = "", utm = "") {
  const u = String(utm || "").toLowerCase();
  if (u) {
    if (/(^|[^a-z])(hn|hackernews|ycombinator)/.test(u)) return "hackernews";
    if (/reddit|twitter|x\.com|linkedin|facebook|mastodon|bluesky|bsky/.test(u)) return "social";
    if (/newsletter|email|digest/.test(u)) return "email";
    return "campaign:" + u.slice(0, 24);
  }
  const r = String(ref || "").toLowerCase();
  if (!r) return "direct";
  if (/chatgpt|openai|perplexity|claude\.ai|gemini\.google|copilot|bard/.test(r)) return "ai";
  if (/google\.|bing\.|duckduckgo|search\.brave|ecosia|yahoo|yandex/.test(r)) return "organic";
  if (/reddit|news\.ycombinator|twitter|x\.com|t\.co|linkedin|facebook|mastodon|bsky|lobste|news\.google/.test(r)) return "social";
  try { const h = new URL(r).host; if (h && !h.includes("dreaming.press")) return "referral"; } catch { /* not a url */ }
  return "direct";
}

// ── engagement events ──────────────────────────────────────────────────────────
// types: view, read (scrolled/dwelled), audio_play, audio_complete, complete
const EVENT_TYPES = new Set(["view", "read", "audio_play", "audio_complete", "complete", "scroll"]);
export function recordEvent(slug, type, ms, now, meta = {}, d) {
  // backward-compat: legacy callers pass the db as the 5th arg (slug,type,ms,now,d)
  if (meta && typeof meta.prepare === "function") { d = meta; meta = {}; }
  d = d || db();
  if (!EVENT_TYPES.has(type)) return false;
  const ref = (meta.ref || meta.referer || "").toString().slice(0, 300);
  const channel = (meta.channel || classifyChannel(ref, meta.utm)).toString().slice(0, 40);
  const sid = (meta.sid || "").toString().slice(0, 40);
  d.prepare("INSERT INTO events (slug,type,ms,ts,channel,ref,sid) VALUES (?,?,?,?,?,?,?)")
    .run(String(slug).slice(0, 200), type, Number(ms) || 0, Number(now) || 0, channel, ref, sid);
  return true;
}
// Engagement by acquisition channel over a rolling window — the funnel KPI (#5/#18).
export function channelBreakdown({ days = 30 } = {}, d = db()) {
  const since = Date.now() - days * 86400000;
  return d.prepare(`
    SELECT COALESCE(channel,'direct') AS channel,
           SUM(CASE WHEN type='view' THEN 1 ELSE 0 END) AS views,
           SUM(CASE WHEN type='read' THEN 1 ELSE 0 END) AS reads,
           COUNT(DISTINCT sid) AS sessions
    FROM events WHERE ts >= ? GROUP BY COALESCE(channel,'direct')
    ORDER BY reads DESC, views DESC`).all(since);
}
export function eventCounts(slug, d = db()) {
  const rows = d.prepare("SELECT type, COUNT(*) c FROM events WHERE slug = ? GROUP BY type").all(slug);
  const out = {};
  for (const r of rows) out[r.type] = r.c;
  return out;
}

// ── newsletter subscribers ─────────────────────────────────────────────────────
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export function isEmail(e) { return typeof e === "string" && e.length <= 254 && EMAIL_RE.test(e); }

export function addSubscriber(email, source = "site", d = db()) {
  email = String(email).trim().toLowerCase();
  if (!isEmail(email)) return { ok: false, error: "invalid email" };
  const token = Math.abs(hashStr(email + ":dp")).toString(36);
  const existing = d.prepare("SELECT email FROM subscribers WHERE email = ?").get(email);
  d.prepare(`INSERT INTO subscribers (email, created, source, confirmed, unsub_token)
             VALUES (?, ?, ?, 1, ?) ON CONFLICT(email) DO NOTHING`)
    .run(email, new Date().toISOString(), source, token);
  return { ok: true, already: !!existing, token };
}
export function countSubscribers(d = db()) {
  return d.prepare("SELECT COUNT(*) c FROM subscribers").get().c;
}
export function listSubscribers(d = db()) {
  return d.prepare("SELECT email, created, source FROM subscribers ORDER BY created DESC").all();
}
// confirmed subscribers (for dispatch sends), with their unsubscribe token
export function confirmedSubscribers(d = db()) {
  return d.prepare("SELECT email, unsub_token FROM subscribers WHERE confirmed = 1").all();
}
export function unsubscribeByToken(token, d = db()) {
  if (!token) return { ok: false };
  const row = d.prepare("SELECT email FROM subscribers WHERE unsub_token = ?").get(String(token));
  if (!row) return { ok: false };
  d.prepare("DELETE FROM subscribers WHERE unsub_token = ?").run(String(token));
  return { ok: true, email: row.email };
}
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; } return h; }

// ── dispatch tracking (which posts have been emailed) ───────────────────────────
// Posts present at first init are seeded as already-sent, so activating email
// never blasts the existing backlog — only genuinely new posts get dispatched.
export function undispatchedPosts(d = db()) {
  return d.prepare(`SELECT p.slug, p.title, p.dek, p.section, p.date FROM posts p
                    LEFT JOIN dispatched s ON s.slug = p.slug
                    WHERE s.slug IS NULL
                    ORDER BY p.date DESC, p.slug`).all();
}
export function markDispatched(slugs, sentAt, d = db()) {
  const stmt = d.prepare("INSERT INTO dispatched (slug, sent_at) VALUES (?, ?) ON CONFLICT(slug) DO NOTHING");
  const tx = d.transaction((rows) => { for (const slug of rows) stmt.run(slug, sentAt); });
  tx(slugs);
}
export function dispatchSeeded(d = db()) {
  return d.prepare("SELECT COUNT(*) c FROM dispatched").get().c > 0;
}

// ── ingest helpers ───────────────────────────────────────────────────────────
export function clearPosts(d = db()) {
  d.exec("DELETE FROM posts; DELETE FROM posts_fts;");
}

const _insert = (d) => d.prepare(`INSERT OR REPLACE INTO posts
  (slug,title,dek,author,section,date,tags,sources,featured,body_html,body_text,source,read_time,has_audio,summary,art,audio_bytes,series,series_order,figures,updated,faq,compare,canonical,update_note)
  VALUES (@slug,@title,@dek,@author,@section,@date,@tags,@sources,@featured,@body_html,@body_text,@source,@read_time,@has_audio,@summary,@art,@audio_bytes,@series,@series_order,@figures,@updated,@faq,@compare,@canonical,@update_note)`);
const _insertFts = (d) => d.prepare(`INSERT INTO posts_fts (slug,title,dek,body_text,section)
  VALUES (@slug,@title,@dek,@body_text,@section)`);

export function upsertPost(p, d = db()) {
  const row = {
    slug: p.slug, title: p.title, dek: p.dek || "", author: p.author || "rosalinda",
    section: p.section || "dispatches", date: p.date || "", tags: JSON.stringify(p.tags || []),
    sources: JSON.stringify(p.sources || []), featured: p.featured ? 1 : 0,
    body_html: p.body_html || "", body_text: p.body_text || "", source: p.source || "md",
    read_time: p.read_time || 1, has_audio: p.has_audio ? 1 : 0,
    summary: JSON.stringify(p.summary || []),
    figures: JSON.stringify(p.figures || []),
    faq: JSON.stringify(p.faq || []),
    compare: JSON.stringify(p.compare || []),
    art: p.art ? JSON.stringify(p.art) : null,
    audio_bytes: Number(p.audio_bytes) || 0,
    series: (p.series && String(p.series).trim()) || null,
    series_order: Number.isFinite(p.series_order) ? p.series_order : null,
    // optional revision date; only meaningful when it differs from `date` (handled at render)
    updated: (p.updated && String(p.updated).trim()) || null,
    // optional canonical override (bare slug or full URL); consolidates ranking
    // signals when this piece duplicates/supersedes a sibling. null ⇒ self-canonical.
    canonical: (p.canonical && String(p.canonical).trim()) || null,
    // optional one-line revision note ("what changed") shown next to the Updated
    // stamp — NYT/Guardian "this story has been updated" transparency; only rendered
    // when `updated` differs from `date`. null ⇒ no note.
    update_note: (p.update_note && String(p.update_note).trim()) || null,
  };
  _insert(d).run(row);
  _insertFts(d).run({ slug: row.slug, title: row.title, dek: row.dek, body_text: row.body_text, section: row.section });
}

// ── readers ──────────────────────────────────────────────────────────────────
function hydrate(r) {
  if (!r) return r;
  return { ...r, tags: JSON.parse(r.tags || "[]"), sources: JSON.parse(r.sources || "[]"),
    summary: JSON.parse(r.summary || "[]"), art: r.art ? JSON.parse(r.art) : null,
    figures: JSON.parse(r.figures || "[]"), faq: JSON.parse(r.faq || "[]"),
    compare: JSON.parse(r.compare || "[]"),
    featured: !!r.featured, has_audio: !!r.has_audio };
}

export function allPosts(d = db()) {
  return d.prepare("SELECT * FROM posts ORDER BY date DESC, slug DESC").all().map(hydrate);
}
export function getPost(slug, d = db()) {
  return hydrate(d.prepare("SELECT * FROM posts WHERE slug = ?").get(slug));
}
// Resolve a requested slug to the CANONICAL stored slug, tolerating the
// date-prefix mismatch that splits this corpus: most pieces are stored bare
// ("langgraph-vs-crewai"), but a run's pieces are stored date-prefixed
// ("2026-06-23-langgraph-vs-crewai"), and authors naturally cross-link in the
// bare form. A bare link to a dated post (or vice-versa) would otherwise 404.
// Returns the stored slug if found, else null. The route 301s aliases to it so
// there is exactly one indexed URL per piece (canonical = the stored slug).
const bareSlug = (s) => String(s || "").replace(/^\d{4}-\d\d-\d\d-/, "");
export function resolveSlug(slug, d = db()) {
  const exact = d.prepare("SELECT slug FROM posts WHERE slug = ?").get(slug);
  if (exact) return exact.slug;
  const want = bareSlug(slug);
  const hit = d.prepare("SELECT slug FROM posts").all().find((r) => bareSlug(r.slug) === want);
  return hit ? hit.slug : null;
}
export function postsBySection(section, d = db()) {
  return d.prepare("SELECT * FROM posts WHERE section = ? ORDER BY date DESC, slug DESC").all(section).map(hydrate);
}
export function postsByAuthor(author, d = db()) {
  return d.prepare("SELECT * FROM posts WHERE author = ? ORDER BY date DESC, slug DESC").all(author).map(hydrate);
}
// every author byline in use, with how many posts each carries (most-prolific first)
export function authorCounts(d = db()) {
  return d.prepare("SELECT author, COUNT(*) c FROM posts GROUP BY author ORDER BY c DESC, author")
    .all().map(r => ({ author: r.author, count: r.c }));
}
// every piece in a named series, in READING order (oldest → newest) so a serial
// arc reads as Part 1 → Part N. Returns [] for an empty/unknown series id.
export function postsInSeries(series, d = db()) {
  const s = String(series || "").trim();
  if (!s) return [];
  // explicit `series_order` wins (FT/Stratechery part numbers); unordered pieces
  // fall back to chronological, slug as final tiebreak.
  return d.prepare(`SELECT * FROM posts WHERE series = ?
    ORDER BY COALESCE(series_order, 1000000) ASC, date ASC, slug ASC`).all(s).map(hydrate);
}
// every series in use, with its piece count and the date of its latest entry
// (most-recently-active first). Single-piece "series" are excluded — a series
// needs at least two parts to be a thread worth grouping.
export function allSeries(d = db()) {
  return d.prepare(`SELECT series, COUNT(*) c, MAX(date) latest, MIN(date) started
                    FROM posts WHERE series IS NOT NULL AND TRIM(series) <> ''
                    GROUP BY series HAVING c >= 2
                    ORDER BY latest DESC, series`)
    .all().map(r => ({ series: r.series, count: r.c, latest: r.latest, started: r.started }));
}
export function featuredPost(d = db()) {
  return hydrate(d.prepare("SELECT * FROM posts WHERE featured = 1 ORDER BY date DESC LIMIT 1").get())
    || allPosts(d)[0];
}

// ── the comparison/buyer's-guide corpus, grouped into topic clusters ─────────
// The publication's organic-search engine is its demand-shaped corpus — the
// "X vs Y" comparisons and "best X for Y" roundups in The Wire/The Stack. They
// were reachable only via search, related rails, and category hubs; there was no
// single Wirecutter/Verge-style landing that collects them. `comparisonClusters`
// is the data for that hub: it selects the demand pieces (a Wire/Stack slug that
// is a "…-vs-…" comparison, a "best-…" guide, or a "how-to-…" guide) and buckets each into ONE topic
// cluster by an ordered, first-match-wins rule over its (date-stripped) slug, so
// the hub reads like a set of buyer's-guide categories. Web/Browsing is matched
// before Protocols on purpose so "browser-use-…-playwright-mcp" lands in Web, not
// MCP. Unmatched demand pieces fall to a "More comparisons" catch-all. Posts
// arrive date-DESC from allPosts, so each cluster stays newest-first.
const COMPARISON_CLUSTERS = [
  // `semantic` is bounded to semantic-search/semantic-caching on purpose: a bare
  // `semantic` token would poach "semantic-kernel-…" (the Microsoft agent SDK),
  // which belongs in Agent Frameworks, into retrieval.
  // Graph databases for GraphRAG (Neo4j/FalkorDB/Memgraph) + the GraphRAG technique
  // pieces are the relationship-aware retrieval layer — they rail with the vector-DB
  // and chunking pieces. `graphrag`/`neo4j`/`falkordb`/`memgraph`/`knowledge-graph`
  // appear in no earlier cluster slug (RAG is first), so first-match-wins is safe;
  // adding `graphrag` also pulls graphrag-vs-lightrag-vs-graphiti out of the catch-all.
  // Vector-DB *products* and the static/sentence embedding models were leaking to
  // the catch-all: the regex keyed on `vector|pgvector|pinecone|qdrant` but not the
  // bare product names (chroma/weaviate/milvus/lancedb/sqlite-vec/duckdb) or the
  // embedding-model money pages (model2vec/sentence-transformers). They're the same
  // retrieval demand cluster as the vector-DB pieces already here. Every added token
  // appears only in its own orphaned slug (RAG is the FIRST cluster, so there's no
  // earlier cluster to poach from), so first-match-wins is safe.
  // The retrieval-ARCHITECTURE explainer (cross-encoder vs bi-encoder) is the layer
  // under the reranker/ColBERT pieces already here — a bi-encoder IS the retriever and
  // a cross-encoder IS the reranker — so `cross-encoder-vs-bi-encoder` rails with
  // best-reranker-for-rag and colbert-vs-dense-vs-sparse rather than orphaning to the
  // catch-all. Bounded `cross-encoder`/`bi-encoder` are corpus-scanned to appear in no
  // other slug (RAG is the first cluster, so nothing earlier is poached).
  ["RAG & Retrieval",        /(^|-)(rag|graphrag|chunking|embedding|embeddings|reranker|cross-encoder|bi-encoder|retrieval|hybrid|semantic-search|semantic-caching|bm25|lexical|vector|pgvector|pinecone|qdrant|chroma|weaviate|milvus|lancedb|sqlite-vec|duckdb|model2vec|sentence-transformers|neo4j|falkordb|memgraph|graph-database|knowledge-graph|long-context|hnsw|ivf|ivfflat|diskann)(-|$)/],
  // Document parsing / OCR (Docling/Unstructured/LlamaParse and the OCR engines
  // olmOCR/Marker/MinerU/Mistral-OCR) is the *ingestion* layer that feeds RAG — the
  // high-intent "best PDF parser / document parser for RAG" query class. It's its own
  // indexable hub rather than diluting RAG & Retrieval. Placed right after RAG: its
  // tokens match only the two parsing slugs and no RAG token matches a parsing slug,
  // so order vs RAG is immaterial and nothing earlier is poached.
  ["Document Parsing & OCR", /(^|-)(docling|unstructured|llamaparse|olmocr|mineru|ocr)(-|$)/],
  // Placed AFTER RAG so "fine-tuning-vs-rag" and "…-quantization-embeddings" stay
  // in retrieval (first-match-wins), but the training-method/PEFT/quantization
  // money pages (lora/qlora, dpo/ppo/orpo, unsloth/axolotl, gguf/gptq/awq) get
  // their own home + sibling rail instead of falling to the catch-all.
  // RL post-training frameworks (verl/OpenRLHF/TRL) + the GRPO vocab live here too:
  // they're the tooling layer for the alignment/RL methods already in this cluster,
  // so the framework money page rails with dpo-vs-ppo-vs-orpo and lora-vs-qlora.
  // Model merging (SLERP/TIES/DARE/task-arithmetic, the mergekit toolkit) is a
  // training-FREE way to combine fine-tuned models by weight arithmetic — the
  // natural sibling of the fine-tuning *method* money pages (lora/dpo/etc.), so it
  // rails here rather than falling to the catch-all. Its vocab (merging/mergekit/
  // slerp/ties/dare/task-arithmetic/model-soup) appears in no earlier cluster slug
  // (RAG/DocParsing precede this; none carry these tokens), so first-match-wins is
  // safe. `dare` is bounded so it can't catch `daytona` (Sandboxes, and later anyway).
  // Knowledge distillation (train a small student to copy a big teacher) is a
  // model-compression/transfer technique — the natural sibling of the quantization
  // (gguf/gptq/awq) and merging money pages already here, and itself a form of
  // fine-tuning (the student is trained). The bounded `distillation`/`knowledge-distillation`
  // tokens appear in only the distillation money page; crucially `distilabel`
  // (Synthetic Data, later) is NOT matched — `(^|-)distil…(-|$)` needs a boundary
  // after the token and `distilabel` has none — so first-match-wins poaches nothing.
  // The reward-SIGNAL design decision (process vs outcome reward models, and RLVR's
  // rule-based verifiable reward) is the layer ABOVE the RL *algorithms* already here
  // (grpo/ppo/dpo): a reward model is what those algorithms optimize against, so the
  // "process-reward-models-vs-outcome-reward-models" money page rails with grpo-vs-ppo
  // and verl-vs-openrlhf-vs-trl rather than orphaning to the catch-all. Bounded `reward`
  // matches the "-reward-" segment; `rlvr` is reserved for future pieces. Corpus-scanned:
  // neither token appears in ANY existing slug, so first-match-wins poaches nothing.
  // `reinforcement`/`environment(s)`/bare `rl` were added so the RL-*environments* money
  // pages (the agent "gym"/RLVR training-loop layer — `rl-environments-for-ai-agents`)
  // rail with the RL algorithms and reward-model pieces instead of the catch-all. RL
  // environments ARE the training substrate, so this is their dense home. Corpus-scanned
  // (2026-06-28): `rl` and `environment(s)` match ONLY `rl-environments-for-ai-agents`
  // (was catch-all); `reinforcement` matches only `…-rlvr` (already here via `rlvr`); none
  // of the three appears in any earlier cluster (RAG/OCR) or any later cluster, so
  // first-match-wins poaches nothing and the move is purely catch-all → Training.
  // `quantization` here means model-WEIGHT quantization (the gguf/gptq/awq/fp8/int4
  // compression money pages), NOT KV-cache quantization — a serving-runtime concern
  // that belongs in Inference & Gateways with the other kv-cache pieces. Because
  // Fine-Tuning precedes Inference and this slug carries the Inference token `kv-cache`,
  // first-match-wins was mis-railing `kv-cache-quantization-fp8-vs-int8-vs-int4` here
  // (a training/weight-quant sibling rail on an inference page). The negative lookbehind
  // `(?<!kv-cache-)quantization` blocks ONLY that one slug: its `quantization` is
  // preceded by `kv-cache-`, so the token fails and the page falls through to Inference
  // (matched there by `kv-cache`). The genuine weight-quant pages are untouched —
  // `fp8-vs-int8-vs-int4-quantization` and `nvfp4-vs-mxfp4-fp4-quantization` have
  // `quantization` preceded by `int4-`/`fp4-`, so the lookbehind passes and they stay.
  // Corpus-scanned: `kv-cache-quantization` is the only slug whose `quantization` is
  // kv-cache-prefixed; the embedding-quantization pages home in RAG (earlier) regardless.
  ["Fine-Tuning & Training", /(^|-)(lora|qlora|dpo|ppo|orpo|kto|simpo|grpo|rlhf|rlvr|reward|reinforcement|environment|environments|rl|verl|openrlhf|trl|peft|unsloth|axolotl|torchtune|gguf|gptq|awq|fine-tuning|finetuning|fine-tune|(?<!kv-cache-)quantization|distillation|knowledge-distillation|model-merging|merging|mergekit|slerp|ties|dare|task-arithmetic|model-soup)(-|$)/],
  ["Data & SQL",             /(^|-)(sql|text-to-sql|nl2sql|vanna|wrenai|dataherald|warehouse)(-|$)/],
  // Synthetic training-data tooling (distilabel/Curator/synthetic-data-kit) is the
  // dataset-*generation* layer that feeds fine-tuning — distinct from the
  // training-*method* money pages in Fine-Tuning & Training (lora/dpo/etc.). Its
  // slug vocab (distilabel/curator/synthetic) appears in no earlier cluster, so
  // first-match-wins keeps it from poaching anything and gives the generation
  // money page its own hub + sibling rail instead of the catch-all.
  ["Synthetic Data",         /(^|-)(synthetic|distilabel|curator|sdg)(-|$)/],
  // Deep-research agents (GPT Researcher / LangChain Open Deep Research / HF
  // smolagents ODR) are the autonomous plan→search→report layer — a distinct
  // demand cluster from the Agent Frameworks they're built ON and from the
  // Web/Search retrieval tools they USE. Placed BEFORE Agent Frameworks and
  // Web/Search so a research-agent slug that also carries a `langgraph` or
  // `search`/`firecrawl` token still homes here by first-match. Uses compound
  // tokens (gpt-researcher/deep-research/research-agent) — never a bare
  // `research`, which would over-match — and those tokens appear in no earlier
  // cluster's slugs, so first-match-wins poaches nothing.
  ["Research Agents",        /(^|-)(gpt-researcher|gptr|deep-research|deep-researcher|research-agent|research-agents)(-|$)/],
  // Low-code / visual agent-and-workflow builders (n8n / Flowise / Langflow) are the
  // "which builder do I assemble an agent in" decision — the same demand cluster as
  // the code-first frameworks. Their tokens appear in no earlier cluster slug, so
  // first-match-wins keeps prior pieces put.
  // All-in-one LLM-app PLATFORMS (Dify / Coze) are the configure-an-app-shell sibling
  // of the assemble-from-primitives frameworks — the same "what do I build my agent
  // in" demand. `dify-vs-langchain` already homes here via its `langchain` token, but a
  // standalone Dify/Coze money page (e.g. `dify-vs-coze`) would otherwise orphan to the
  // catch-all; the bounded `dify`/`coze` tokens appear in no earlier cluster slug
  // (corpus-scanned: only `dify-vs-langchain`, `coze` absent), so first-match-wins poaches nothing.
  // JVM/Java LLM-app frameworks (Spring AI / LangChain4j) are the "what do I build my
  // agent in" decision for the Java ecosystem the corpus had ignored entirely — the same
  // demand cluster as the Python/TS frameworks here. `spring-ai`/`langchain4j`/`jvm` are
  // corpus-scanned to appear in no earlier cluster slug and no existing slug at all, so
  // first-match-wins poaches nothing; `langchain4j` is a distinct string the bounded
  // `langchain` token can't match (no boundary after "langchain" in "langchain4j"), and
  // the compound `spring-ai` avoids a bare `spring` that could brush an unrelated segment.
  // Hermes (Nous Research) is an open-source agent framework/harness — an always-on
  // local orchestration layer that writes its own skills — so the
  // "hermes-agent-self-improving-…" money page rails here with the other framework/
  // harness comparisons instead of orphaning to the catch-all. Bounded `hermes` is
  // corpus-scanned to appear in only that one slug and in no earlier cluster (RAG/
  // OCR/Fine-Tuning/Data/Synthetic/Research precede this), so first-match-wins poaches nothing.
  // `declarative` homes the YAML-vs-code agent-definition decision ("declarative-agents-…"):
  // defining an agent in a config file instead of an SDK is a "how do I build my agent" choice,
  // so it rails with the framework comparisons rather than orphaning to the catch-all. The token
  // is corpus-scanned to appear in only that one slug and in no earlier cluster, so poaches nothing.
  ["Agent Frameworks",       /(^|-)(framework|frameworks|langgraph|crewai|autogen|langchain|langchain4j|llamaindex|pydantic|adk|harness|hermes|n8n|flowise|langflow|dify|coze|spring-ai|jvm|declarative)(-|$)/],
  // AI coding tools — the IDE/assistant + autonomous-coding-agent layer (Cursor,
  // Windsurf, GitHub Copilot, Claude Code; the OSS aider/Cline/OpenHands too).
  // Placed BEFORE Agent UI & Frontend on purpose: the bare `copilot` token there
  // (meant for the CopilotKit agent-UI library) would otherwise capture a
  // "…-github-copilot-…" coding-tool slug by first-match. First-match-wins keeps
  // coding tools here; CopilotKit still matches Agent UI via its explicit
  // `copilotkit` token (which `copilot` can't swallow — `copilotkit` has no
  // trailing boundary after "copilot").
  // The agent-instruction-file standard (AGENTS.md vs CLAUDE.md) is the config
  // layer these same coding agents read — Codex/Cursor/Copilot/Claude Code all
  // honor AGENTS.md — so `agents-md`/`claude-md` rail here with the tool
  // comparisons rather than falling to the catch-all. Both compound tokens are
  // bounded and appear in no earlier cluster slug, so first-match-wins is safe
  // (and `claude-md` is distinct from the `claude-code` token above).
  // Spec-driven development tools (GitHub Spec Kit / Kiro / Tessl) are the
  // write-the-spec-then-let-the-agent-implement layer these same coding agents run
  // under — Spec Kit explicitly drives Claude Code/Cursor/Copilot/Codex — so the
  // "spec-driven-development-spec-kit-vs-kiro-vs-tessl" money page rails here with the
  // tool comparisons instead of orphaning to the catch-all. The compound `spec-driven`/
  // `spec-kit` and product tokens `kiro`/`tessl` appear in no earlier cluster slug
  // (corpus-scanned), so first-match-wins poaches nothing; the compounds avoid a bare
  // `spec` that could brush other slugs.
  // AI code-review tools (CodeRabbit/Greptile/Qodo/Graphite Diamond/Cursor Bugbot)
  // are the layer that reviews what these same coding agents WRITE — the "which bot
  // reviews my PR" decision rails with the assistant comparisons (cursor/claude-code)
  // rather than orphaning to the catch-all. AI *app builders* (Lovable/Bolt/v0/Replit)
  // are the prompt-to-app layer of the same agentic-coding demand — "which tool builds
  // the app" sits beside "which assistant edits it" and "which bot reviews it". All
  // added tokens (coderabbit/greptile/qodo/bugbot/code-review/codereview/graphite/
  // lovable/bolt/v0/replit/app-builder/vibe-coding) are corpus-scanned: each appears in
  // ONLY its own new money-page slug and in no earlier cluster regex, so first-match-wins
  // poaches nothing. `diamond` is deliberately NOT added — the Inference router piece
  // `routellm-vs-notdiamond-vs-martian` carries `notdiamond` (no boundary before
  // "diamond", so a bounded `diamond` token wouldn't match it anyway), but omitting it
  // removes all doubt; Graphite Diamond still homes here via `graphite`. `v0` is bounded
  // (`(^|-)v0(-|$)`) so it can't brush a version string mid-slug.
  // How a coding agent APPLIES its edits (whole-file vs unified-diff vs
  // search/replace vs fast-apply) is a property of these same assistants — Aider,
  // Claude Code, Cursor, Cline all pick an edit format — so the
  // "coding-agent-edit-formats-diff-vs-whole-file" money page rails here with the
  // tool comparisons instead of orphaning to the catch-all. The bounded
  // `coding-agent`/`edit-formats`/`edit-format` tokens appear in only that one slug
  // (corpus-scanned), and this cluster precedes every cluster a `coding`/`agent`/
  // `edit`/`diff` slug could otherwise reach, so first-match-wins poaches nothing.
  // Git worktrees are the workflow primitive for running these same coding agents in
  // PARALLEL — Claude Code (`--worktree`) and Codex both ship native worktree support,
  // and the orchestrators (Conductor/Vibe Kanban/Claude Squad) wrap them — so the
  // "git-worktrees-for-parallel-ai-agents" money page rails here with the assistant
  // comparisons instead of orphaning to the catch-all. The bounded `worktree`/
  // `worktrees` tokens appear in only that one slug (corpus-scanned), match no earlier
  // cluster, and the slug carries no earlier-cluster token (no framework/rag/etc.), so
  // first-match-wins poaches nothing.
  // The Cline-lineage forks (Roo Code, Kilo Code) are the same in-editor coding-agent
  // demand as Cline itself — Roo is a fork of Cline, Kilo a superset of both. The
  // `cline-vs-roo-code-vs-kilo-code` money page already homes here via its `cline`
  // token, but a standalone Kilo/Roo piece (e.g. `kilo-code-vs-cursor`) would orphan;
  // the bounded compound `roo-code`/`kilo-code` tokens appear in only that one slug
  // (corpus-scanned), match no earlier cluster, so first-match-wins poaches nothing. The
  // compounds (not bare `roo`/`kilo`) avoid brushing any unrelated future segment.
  ["Coding Agents & IDEs",   /(^|-)(cursor|windsurf|copilot|claude-code|aider|cline|roo-code|kilo-code|openhands|devin|codex|agents-md|claude-md|spec-driven|spec-kit|kiro|tessl|coderabbit|greptile|qodo|bugbot|code-review|codereview|graphite|lovable|bolt|v0|replit|app-builder|vibe-coding|coding-agent|edit-formats|edit-format|worktree|worktrees)(-|$)/],
  // Python LLM/agent UI frameworks (Streamlit/Gradio/Chainlit) are the build-a-UI
  // layer alongside the React agent-UI libraries (CopilotKit/assistant-ui). Their
  // tokens appear in no earlier cluster slug, so first-match-wins keeps coding-tool
  // and other pieces put while the Python-UI money page rails with the frontend cluster.
  // Self-hosted ChatGPT-style web UIs (Open WebUI / LibreChat / AnythingLLM) are the
  // chat-frontend layer — the same "which UI do I put in front of my models" demand
  // as the React UI libraries. Tokens appear in no earlier cluster slug, so safe.
  // Streaming an agent's output to the UI (SSE vs WebSockets) is the transport layer
  // of this same frontend decision — its argument is about delivering typed AG-UI
  // events to the browser, so it rails with copilotkit/assistant-ui. The slug homes
  // here on its `streaming` token alone; we deliberately do NOT add a bare `sse`
  // token, because `mcp-stdio-vs-sse-vs-streamable-http` also carries `sse` and this
  // cluster is placed BEFORE Protocols — adding `sse` would let first-match poach the
  // MCP-transports piece out of Protocols. `streaming`/`websocket(s)` appear in no
  // other slug ("streamable" ≠ "streaming"), so they're safe.
  ["Agent UI & Frontend",    /(^|-)(copilotkit|copilot|assistant-ui|ag-ui|chat-ui|frontend|streamlit|gradio|chainlit|open-webui|librechat|anythingllm|streaming|websocket|websockets)(-|$)/],
  // The stateful-vs-stateless agent decision is fundamentally a state-*ownership*
  // question — who holds the conversation/execution state between turns — so the
  // "stateful-vs-stateless-ai-agents" money page rails here with the memory/state
  // products (mem0/zep/letta) it links to rather than orphaning to the catch-all.
  // Only `stateful` is added, NOT `stateless`: `stateless` already appears in
  // `mcp-stateless-2026-spec-release-candidate`, which homes in Protocols (a LATER
  // cluster) via its `mcp` token — adding a bounded `stateless` here would poach it
  // by first-match. Bounded `stateful` is corpus-scanned to appear in only this one
  // new slug and in no earlier cluster, so first-match-wins poaches nothing.
  ["Agent Memory",           /(^|-)(memory|mem0|zep|letta|stateful)(-|$)/],
  // Managed/remote browser INFRASTRUCTURE (Browserbase/Steel/Browserless) is the
  // layer that runs the actual Chromium an agent drives — distinct from the
  // automation *framework* (browser-use/Stagehand/Playwright) but the same demand
  // cluster. Their product names don't contain a bare `browser` token (the word
  // boundary in `browser` won't match `browserbase`/`browserless`), so add them
  // explicitly so the infra comparison rails with the framework comparison.
  // The publisher side of the same web-crawling coin: how AI crawlers/answer engines
  // discover and cite content (llms.txt, robots.txt, generative-engine optimization)
  // rails with the crawler/scraper tools (firecrawl/crawl4ai/jina) it's the mirror of —
  // a "should I publish an llms.txt / how do I get cited by AI" decision sits naturally
  // beside "which crawler reads a site". `llms-txt`/`llmstxt`/`robots-txt`/`generative-engine`
  // are compound/bounded and corpus-scanned to appear in no earlier cluster slug and no
  // existing slug at all (only the new llms-txt-vs-robots-txt page), so first-match-wins
  // poaches nothing. A bare `geo` is deliberately omitted (too collision-prone).
  ["Web, Search & Browsing", /(^|-)(browser|browserbase|browserless|steel|stagehand|playwright|firecrawl|crawl4ai|jina|search|tavily|exa|linkup|scrape|web|llms-txt|llmstxt|robots-txt|generative-engine)(-|$)/],
  // Agent tool-integration / tool-auth platforms (Composio/Arcade/Toolhouse) are
  // the layer that PROVIDES third-party integrations + owns the per-user OAuth
  // credential vault — the gap MCP's protocol left open (auth on-behalf-of-user).
  // They rail with the MCP-gateway / mcp-vs-function-calling / mcp-auth pieces, so
  // their product-name tokens live here. None appears in an earlier cluster's slugs,
  // so first-match-wins poaches nothing.
  // Agent *payment* protocols (AP2 / x402 / ACP) are the emerging machine-commerce
  // wire formats — a protocol-standards decision that rails with the MCP/A2A pieces
  // ("which agent protocol"). `ap2`/`x402`/`acp`/`payment` appear in no earlier
  // cluster slug, so first-match-wins poaches nothing.
  // Agent *identity / authentication* (workload vs delegated identity, on-behalf-of
  // token exchange) is the same "auth on-behalf-of-user" layer this cluster already
  // owns — the two MCP-auth money pages (mcp-authorization-oauth, how-to-authenticate-
  // a-remote-mcp-server) already home here via `mcp`, and the general agent-identity
  // guide is their natural sibling rail. Adding `identity`/`authenticate`/
  // `authentication`/`oauth` homes "how-to-authenticate-an-ai-agent-identity" here
  // instead of the catch-all. Corpus-scanned: these tokens appear only in the four
  // auth/identity wire slugs — two already in Protocols (via `mcp`), one a
  // non-comparison essay (`control-migrates-to-the-login`, never clustered), and the
  // new identity guide — none homing in a later cluster, so first-match-wins poaches
  // nothing. `authenticate` is bounded so it can't catch `authentication`/`author`.
  // Tool/function-calling *mechanics* (parallel vs sequential tool calling — the
  // model-emits-vs-runtime-executes split) rail with the function-calling money
  // pages already here (best-llm-for-function-calling, mcp-vs-function-calling):
  // it's the same "how does an agent invoke a tool" demand. The bounded
  // `tool-calling` token homes "parallel-vs-sequential-tool-calling" here instead
  // of the catch-all. Corpus-scanned: `(^|-)tool-calling(-|$)` matches ONLY that
  // new slug — `mcp-code-execution-vs-direct-tool-calls` carries `tool-calls`
  // (plural; no boundary match) and `how-to-evaluate-an-ai-agents-tool-use` carries
  // `tool-use`, neither of which the bounded token catches — so nothing is poached.
  // Deliberately NOT adding `tool-use`: that token lives in the tool-use eval guide,
  // which must stay in Evals & Observability (an EARLIER cluster), so adding it here
  // would poach it by first-match.
  // Tool *selection at scale* — how many tools an agent can handle, tool retrieval /
  // dynamic tool loading — is the demand-side complement to the function-calling /
  // MCP mechanics already here: the whole problem is that every MCP/function tool def
  // sits in context, so "how-many-tools-can-an-ai-agent-handle" links in-body to
  // mcp-tools-vs-resources-vs-prompts and mcp-code-execution-vs-direct-tool-calls
  // (both in this cluster) and rails with them. Adding bounded `tools` homes it here
  // instead of orphaning to the catch-all. Corpus-scanned: `(^|-)tools(-|$)` matches
  // ONLY this slug and `mcp-tools-vs-resources-vs-prompts` (which already homes here
  // via `mcp`), so first-match-wins poaches nothing — and no LATER-cluster slug carries
  // a bounded `tools` token. `tool-selection`/`tool-retrieval` are corpus-absent
  // (future-proofing the next tool-routing money page) and, being distinct compounds,
  // can't catch the `tool-use` eval guide that must stay in Evals.
  // WebMCP — the W3C Web Machine Learning CG draft that exposes a page's own
  // client-side tools to an in-browser agent via `document.modelContext` — is the
  // browser-side sibling of the MCP/function-calling mechanics already homed here, so
  // a WebMCP money page rails with them. The first piece (`webmcp-vs-mcp`) already
  // homes via its trailing `mcp` token, but the bounded `webmcp` token future-proofs
  // the next ones that won't carry a standalone `mcp` (`what-is-webmcp`,
  // `webmcp-vs-computer-use`) so they don't orphan to the catch-all. `webmcp` appears
  // in no other comparison slug and, being its own token, can't match `mcp` (or be
  // matched by it) — so first-match-wins poaches nothing and the existing corpus is
  // unchanged. (Placed here, AFTER the Web/Search cluster, so a future
  // `webmcp-vs-computer-use` that also carries browser-automation vocab can still
  // land in Web by first-match if that's the better home; pure WebMCP slugs fall
  // through to Protocols.)
  // The tool-DESIGN pair joins this protocols/tooling cluster: `tool-description`/
  // `tool-descriptions` homes the input-side money page (how-to-write-tool-descriptions,
  // previously orphaned to the catch-all) and `tool-response`/`tool-responses` homes the
  // output-side piece (tool-response-design, what tools RETURN) so the two rail together
  // and with the rest of the MCP/tooling cluster (#15/#29). All four tokens are
  // corpus-scanned to appear in only those two slugs and in no earlier cluster, so
  // first-match-wins poaches nothing — note `tool-result` is deliberately NOT added,
  // since it would pull `tool-result-caching` out of its current Prompts & Optimization home.
  // `tool-error`/`tool-errors` joins the same tool-DESIGN family: it homes the
  // tool-failure money page (how-to-handle-tool-errors-in-an-ai-agent — what an agent
  // does when a tool throws) so it rails with the input-side (tool-descriptions) and
  // output-side (tool-response) design pieces, its true siblings. Corpus-scanned
  // (2026-06-29): the hyphenated tokens appear in ONLY the new slug and in no earlier
  // cluster — note the Inference & Gateways reliability page `how-to-handle-llm-api-errors-…`
  // homes via `retries`/`fallback`, NOT a bare `errors` token (there is none), so it is
  // untouched — and first-match-wins poaches nothing. Bare `error`/`errors` is deliberately
  // avoided (too generic; would risk future essay slugs).
  // `tool-choice` joins the same function-calling/tool family: it homes the tool_choice
  // control money page (tool-choice-auto-vs-required-vs-forced — auto/required/forcing a
  // specific tool, and the agent-loop termination footgun) so it rails with function-calling,
  // tool-descriptions, tool-response, and tool-error, its true siblings. Corpus-scanned
  // (2026-07-01): the compound `tool-choice` appears in ONLY the new slug (parallel-vs-
  // sequential-tool-calling carries `tool-calling`, not `tool-choice`) and in no earlier
  // cluster, so first-match-wins poaches nothing. Bare `choice` is deliberately avoided.
  // `skills` joins the tool/capability family: Agent Skills are the packaged-capability
  // format that sits alongside tools/MCP, and the desk's two skills comparisons already
  // home here via their `tools`/`mcp` tokens (agent-skills-vs-subagents-vs-tools,
  // claude-agent-skills-vs-mcp). It rescues the orphaned agent-skills-open-standard-
  // portability, whose first two in-body links point at exactly those two Protocols
  // siblings (the "where do the in-body links point" homing rule). Corpus-scanned
  // (2026-07-03): the bounded `skills` token matches EXACTLY those three agent-skills
  // slugs and nothing else, all three belong in Protocols, and no earlier cluster claims
  // any skills-bearing slug — so first-match-wins poaches nothing. Plural `skills` (the
  // real token in every agent-skills slug) is used, not bare `skill`, which would touch
  // the `delegation-is-a-skill` Dispatch (a non-comparison, already excluded upstream).
  ["Protocols (MCP & A2A)",  /(^|-)(mcp|webmcp|a2a|function-calling|tool-calling|tools|tool-selection|tool-choice|tool-retrieval|tool-description|tool-descriptions|tool-response|tool-responses|tool-error|tool-errors|skills|protocol|composio|arcade|toolhouse|ap2|x402|acp|payment|payments|identity|authenticate|authentication|oauth)(-|$)/],
  // Agent benchmarks (SWE-bench/τ-bench/GAIA) are an evaluation topic — they bucket
  // with the eval-library pieces so the "which benchmark" money page rails with
  // deepeval-vs-ragas-vs-promptfoo rather than falling to the catch-all.
  // Hallucination *detection* (Lynx/HHEM/RAGAS-faithfulness/SelfCheckGPT) is an
  // evaluation concern — its natural siblings are deepeval/ragas/phoenix, which
  // already live here — so `hallucination(s)` homes the detection money page in
  // this cluster instead of the catch-all. Red-teaming/adversarial-testing tools
  // (garak/PyRIT, and the broader "red-team" vocab) rail with promptfoo, which
  // already does both eval AND red-teaming; adding `garak`/`pyrit`/`red-team(ing)`
  // keeps future security-testing comparisons here even when the slug lacks the
  // `promptfoo` token. All these tokens appear in no other comparison slug, so
  // first-match-wins poaches nothing (this cluster's later than the specific ones).
  // `how-to-evaluate-…` guides are eval pieces, but the bounded `eval` token doesn't
  // match the word "evaluate" (it's "-evaluate-", not "-eval-"), so they orphaned to
  // the catch-all. Adding the bounded `evaluate` token homes them here. A RAG-eval
  // how-to ("how-to-evaluate-a-rag-pipeline") still matches RAG first (it carries the
  // `rag` token and RAG is earlier), so this only rescues the non-RAG eval guides
  // (e.g. how-to-evaluate-an-ai-agents-tool-use). `evaluate` appears in no other slug.
  // Confidence/uncertainty estimation (how-to-get-confidence-scores-from-an-llm —
  // logprobs vs verbalized vs semantic-entropy calibration) is an evaluation concern:
  // its true siblings are the hallucination-detection pieces already here (a confidence
  // signal is what flags a likely-wrong answer), and it links in-body to
  // how-to-detect-llm-hallucinations. The compound `confidence-scores`/`calibration`/
  // `uncertainty`/`logprobs` tokens are corpus-scanned to appear in no earlier-cluster
  // comparison slug (the lone `the-confidence-interval-…` essay is a Wire piece with no
  // compare table, so it's never a comparison post and is never clustered) — so
  // first-match-wins poaches nothing, and the bare round-`confidence` is deliberately
  // avoided so a future essay slug can't be dragged in.
  // Computer-use / GUI-agent benchmarks (OSWorld / WebArena / WebVoyager / AndroidWorld /
  // Mind2Web) are the evaluation harnesses for screen-and-browser-driving agents — the
  // "which benchmark measures my computer-use agent" decision, sibling to the SWE-bench/
  // τ-bench/GAIA agent-benchmark money page already here. The product tokens are
  // corpus-scanned to appear in no earlier-cluster slug (and crucially the Web/Search
  // `web` token can't match `webarena`/`webvoyager` — there's no boundary after "web"),
  // so first-match-wins homes the GUI-benchmark page here and poaches nothing.
  // Agent *debugging* (how-to-debug-an-ai-agent) is an observability concern at its
  // core — its whole method is reading the captured trace/transcript a tracing tool
  // records, so it rails with the langfuse/langsmith/phoenix and OTel money pages
  // already here. The bounded `debug`/`debugging` tokens are corpus-scanned to appear
  // in ONLY this new slug, and the piece matches no earlier cluster, so first-match-
  // wins homes it here and poaches nothing.
  // Testing an agent with a *simulated user* (how-to-test-an-ai-agent-with-simulated-users)
  // is an evaluation concern — the simulated-user/judge harness is how multi-turn agents
  // get tested, so it rails with the τ-bench/agent-eval money pages already here. The
  // bounded `simulated` token is corpus-scanned to appear in ONLY this new slug (a bare
  // `test` was deliberately NOT added — it would poach how-to-test-an-mcp-server out of
  // the earlier Protocols cluster), and the piece matches no earlier cluster, so
  // first-match-wins homes it here and poaches nothing.
  // Safely rolling out a new model (how-to-roll-out-a-new-llm-shadow-vs-canary-vs-ab) is an
  // *online-evaluation* concern: the only signal that catches an LLM regression mid-canary is
  // a quality score on sampled live traffic, so the piece rails with the online/CI eval money
  // pages already here (online-vs-offline-evals, how-to-add-llm-evals-to-ci-cd). The bounded
  // `canary` token is corpus-scanned to appear in ONLY this new slug and in no earlier-cluster
  // regex; the generic rollout tokens (shadow/roll-out/ab/llm) match no cluster at all, so the
  // piece would otherwise orphan to the catch-all. First-match-wins homes it here and poaches
  // nothing (a bare `ab`/`shadow` was deliberately NOT added — too generic).
  // Record/replay testing (record-replay-testing-for-ai-agents) is an evals/observability
  // concern: it's how you make a non-deterministic agent run reproducible in CI — you capture
  // a run to a cassette and replay it, the offline twin of the simulated-user and online-eval
  // harnesses already here. The bounded `record`/`replay` tokens are corpus-scanned to appear
  // in ONLY this new slug, and the piece matches no earlier cluster, so first-match-wins homes
  // it here and poaches nothing (a bare `test`/`testing` was deliberately NOT added — `test`
  // would poach how-to-test-an-mcp-server out of the earlier Protocols cluster).
  // Recovery-Bench (recovery-bench-agent-error-recovery) is an agent-eval suite built
  // ON Terminal-Bench — error-recovery is a measured capability, the same demand cluster
  // as swe-bench/tau-bench already here. The bounded `recovery-bench`/`terminal-bench`
  // compounds are corpus-scanned to appear in ONLY the new slug (terminal-bench-vs-swe-bench
  // already homes here via `swe-bench`), and the piece matches no earlier cluster, so
  // first-match-wins homes it here and poaches nothing.
  // BrowseComp / BrowseComp-Plus / DeepResearch Bench (browsecomp-vs-deepresearch-bench) are
  // deep-research-AGENT benchmarks — a benchmark-methodology piece, the same demand cluster as
  // swe-bench/tau-bench/gaia here, NOT the tooling in "Research Agents". Note the deliberate slug
  // shape: the bounded `deep-research` token in the earlier "Research Agents" cluster would poach
  // any "deep-research" slug, so this piece spells the second benchmark "deepresearch-bench" (no
  // internal hyphen) and leads with the corpus-unique `browsecomp` token, which homes it here and
  // covers browsecomp-plus too. `browsecomp` appears in no other slug.
  // `evaluation` (alongside `evaluate`) homes cost-aware-agent-evaluation — a
  // cost-vs-accuracy benchmark-methodology piece — here rather than the catch-all;
  // the bounded token appears in no earlier cluster's slug, so first-match-wins poaches nothing.
  // `monitor`/`monitoring` home the production-monitoring umbrella (how-to-monitor-an-ai-
  // agent-in-production) with the observability/tracing/OTel pieces it's built on — same
  // demand cluster. Corpus-scanned: no other slug carries `monitor`, and this slug matches
  // no earlier cluster, so first-match-wins poaches nothing.
  // `judge`/`judges` home the LLM-as-a-judge demand sub-cluster (llm-as-a-judge,
  // llm-judge-bias) that previously fell to the catch-all — `judge` appears in no
  // earlier cluster regex and these slugs match nothing before Evals, so first-match-
  // wins poaches nothing; agent-as-a-judge already lands here via `evals`.
  ["Evals & Observability",  /(^|-)(eval|evals|evaluate|evaluation|judge|judges|deepeval|ragas|promptfoo|benchmark|benchmarks|browsecomp|swe-bench|tau-bench|terminal-bench|recovery-bench|gaia|osworld|webarena|webvoyager|androidworld|mind2web|simulated|record|replay|canary|observability|monitor|monitoring|langfuse|langsmith|phoenix|trace|tracing|otel|opentelemetry|openllmetry|openinference|instrumentation|debug|debugging|hallucination|hallucinations|confidence-scores|calibration|uncertainty|logprobs|garak|pyrit|red-team|red-teaming)(-|$)/],
  // Self-hosted model-*serving frameworks* (BentoML/Ray Serve/KServe) wrap an
  // inference engine and orchestrate it — same demand cluster as the engines and
  // gateways. Their slug tokens (bentoml/serve/kserve/triton/seldon/serving) appear
  // in no earlier cluster, so first-match-wins keeps prior pieces put while the
  // serving-framework money page rails with vllm-vs-tensorrt-llm-vs-tgi.
  // Inference *economics* — the batch-vs-realtime serving-tier / cost decision — is
  // the same demand cluster: it's a "how do I run inference" choice that rails with
  // the gateways (litellm/portkey) that route between those tiers. `batch`/`realtime`
  // appear in no other comparison slug, so first-match-wins poaches nothing.
  // Inference *acceleration/runtime* techniques and local runtimes were leaking to
  // the catch-all: GPU parallelism (tensor-/pipeline-parallelism), speculative
  // decoding (EAGLE/Medusa), and the local engines MLX / llama.cpp are all "how do I
  // run the model fast" decisions that rail with vllm/tensorrt/tgi. Each token is
  // distinctive (`tensor-parallelism`≠`tensorrt`/`tensorzero`; `llama-cpp`≠the
  // `llamaindex` framework token) and appears only in its own orphaned slug, so
  // first-match-wins poaches nothing.
  // Request *scheduling* on the engine — continuous/in-flight batching vs static
  // batching, and the prefill/decode-collision fixes (chunked prefill) — is a
  // "how do I run inference fast" decision that rails with vllm/tensorrt/tgi. The
  // bounded `batch` token already here doesn't match `batching` (no boundary after
  // "batch"), so add `batching|continuous-batching|in-flight|inflight` explicitly.
  // These appear in no earlier cluster slug, so first-match-wins is safe.
  // The *decoding paradigm* decision — diffusion LLMs (LLaDA/Mercury/Gemini
  // Diffusion) vs autoregressive — is a "how does the model generate, and how fast"
  // choice that rails with the serving engines and the prefill/decode/batching
  // pieces already here (the diffusion piece's whole argument is about the KV cache
  // those engines live on). `diffusion`/`dllm`/`autoregressive` appear in no earlier
  // cluster slug (no earlier cluster carries a bare `llm` token — only the bounded
  // vllm/litellm/anythingllm — so the bare `llm` in the slug poaches nothing), so
  // first-match-wins homes it here safely.
  // GPU-*sharing* (MIG hardware partitions vs CUDA MPS vs Kubernetes time-slicing)
  // is the "how do I put more than one workload on one accelerator" serving-infra
  // decision — it rails with the parallelism/batching/serving-engine pieces already
  // here (its whole argument is about the HBM that continuous batching wants).
  // Tokens `mig`/`mps`/`time-slicing`/`gpu`/`gpu-sharing` appear in only two slugs:
  // this one and `gpu-for-llm-inference-…`, and that one already homes here via its
  // `inference` token — so first-match-wins poaches nothing.
  // Decoding/sampling parameters (temperature, top-k, top-p/nucleus, min-p) are the
  // engine knobs that turn logits into tokens — a "how does the model generate"
  // decision served by vLLM SamplingParams, so it rails with the serving engines and
  // the speculative-decoding/batching pieces already here. The param tokens
  // (`temperature`/`top-p`/`top-k`/`min-p`/`nucleus`) appear in only this slug. The
  // shared `sampling` token also appears in `mcp-sampling-vs-elicitation`, but that
  // piece homes in Protocols (MCP & A2A) via its `mcp` token, which is BEFORE this
  // cluster — so first-match-wins keeps MCP-sampling in Protocols; nothing is poached.
  // Attention mechanisms are a KV-cache/throughput decision: the attention *variants*
  // (mha/mqa/gqa/mla — how many KV heads, the lever on cache size) and the attention
  // *kernels/engines* (flashattention/pagedattention/flashinfer — IO-aware compute,
  // paged memory, serving engine) both rail with the serving-engine + parallelism +
  // batching pieces already here. All these tokens appear in only the two new
  // attention slugs and in no earlier cluster regex (corpus-scanned), so first-match-
  // wins poaches nothing. `attention` is bounded so it can't catch `flashattention`.
  // Tokenization — the encoder that turns text into the tokens these engines bill,
  // count, and fit in the context window (tiktoken vs SentencePiece vs HF tokenizers,
  // BPE vs Unigram) — is the "how is a prompt measured before it's served" decision,
  // so it rails with the serving engines / sampling / kv-cache pieces already here
  // (token counts drive cost and context-limit math, the same concerns those pieces
  // own). `tiktoken`/`sentencepiece`/`tokenizer`/`tokenizers`/`tokenization`/`bpe`
  // appear in only this one slug (corpus-scanned) and in no earlier cluster regex, so
  // first-match-wins poaches nothing; each token is bounded so `bpe` can't catch a
  // substring and `tokenizer`≠`tokenizers` (both listed for future pieces).
  // Context-window EXTENSION via positional-encoding scaling (Position Interpolation,
  // NTK-aware, YaRN, RoPE base scaling) is a serving/runtime decision: the inference
  // engines (vLLM/HF) apply it through a `rope_scaling`/`rope_type` config, so the
  // "rope-scaling-vs-yarn-vs-position-interpolation" money page rails with the attention
  // (mha/mqa) + kv-cache + serving-engine pieces already here, not the catch-all.
  // Tokens `rope`/`yarn`/`ntk`/`position-interpolation` appear in no earlier cluster
  // slug (corpus-scanned: RAG's `long-context` is a different token, and no slug carries
  // rope/yarn/ntk), so first-match-wins poaches nothing. `rope` is bounded so it can't
  // catch a substring (no slug contains "rope" mid-word).
  // The sequence-mixing ARCHITECTURE decision — state-space models (Mamba/Mamba-2)
  // and the production hybrids vs pure attention — is the layer under the KV-cache /
  // throughput concerns this cluster already owns: the whole argument is constant-size
  // recurrent state vs a linearly-growing KV cache and its decode-throughput cost, so
  // "mamba-vs-transformer-state-space-models" rails with the attention-variant
  // (mha/mqa/gqa/mla) and serving-engine pieces, not the catch-all. The bounded
  // `mamba`/`ssm`/`state-space` tokens appear in only that one slug (corpus-scanned);
  // a bare `transformer` is deliberately NOT added (it would brush RAG's
  // `sentence-transformers`, though RAG is earlier anyway), so first-match-wins
  // poaches nothing.
  // LLM-API *reliability* — retry/backoff, timeouts, and fallback model CHAINS — is
  // a gateway concern: the gateways already in this cluster (litellm/portkey) are
  // exactly what implement fallback/retry/load-balance, and the "how-to-handle-llm-
  // api-errors-retries-and-fallbacks" how-to links in-body to litellm-vs-portkey-vs-
  // tensorzero, so its sibling rail should surface those gateways. The bounded
  // `retries`/`fallback`/`fallbacks`/`circuit-breaker`/`reliability` tokens are
  // corpus-scanned: they appear in ONLY that one new slug (no existing slug carries
  // retr*/fallback/circuit/reliab/resilien), and no earlier cluster regex matches
  // them, so first-match-wins poaches nothing. (A bare `retry`/`resilience` is
  // deliberately omitted — these five are enough to home the piece and keep the
  // surface area minimal.)
  // Token-COST optimization (prompt caching, context compaction, model routing,
  // batch, output discipline) is an inference-economics decision — the same demand
  // cluster as the batch-vs-realtime cost piece and the routers (routellm/portkey)
  // already here, which is precisely what "how-to-reduce-ai-agent-token-costs" links
  // to in-body, so its sibling rail should surface that gateway/routing family. The
  // bounded `token-cost`/`token-costs` tokens are corpus-scanned: they appear in ONLY
  // that one new slug (the tokenizer pieces carry `tiktoken`/`tokenizer`, never a bare
  // `token`; `cost`/`costs` essays are dispatches, never clustered), and `cost-optimization`
  // appears in no slug at all (future-proofs the next cost money page) — so first-match-wins
  // poaches nothing. A bare `cost`/`token` is deliberately omitted to keep the surface minimal.
  // Latency optimization (TTFT/TPOT, round-trips, prefill, streaming) is the sibling
  // inference-economics decision to token-cost — "how-to-reduce-ai-agent-latency" links
  // in-body to the same gateway/routing/caching family, so it belongs in this cluster, not
  // the catch-all. `latency`/`ttft`/`tpot`/`time-to-first-token`/`inter-token` are corpus-scanned:
  // they appear only in the latency how-to and llm-inference-latency-ttft-vs-tpot (already homed
  // here via `inference`), and in no EARLIER cluster slug — so first-match-wins poaches nothing.
  // A bare `realtime` is deliberately NOT here: it reads as "the OpenAI Realtime API" — a
  // speech-to-speech VOICE product — far more often than "realtime inference", and as a token
  // in THIS (earlier) cluster it poached the voice money page
  // `openai-realtime-api-vs-gemini-live-voice-agents` out of Voice Agents by first-match-wins.
  // It now lives in the Voice Agents cluster instead; the only other `realtime` slug,
  // `llm-batch-api-vs-realtime-cost`, still homes here via its `batch` token (which precedes
  // Voice), so dropping `realtime` here orphans nothing. True realtime-inference pieces are
  // already covered by `inference`/`latency`/`ttft`.
  // KV-cache *offloading/reuse* (LMCache, Mooncake, Dynamo's KVBM) is the storage-tier
  // layer UNDER the serving engines this cluster owns: it moves the KV cache the
  // engines compute off-GPU and shares it across replicas, so "kv-cache-offloading-
  // lmcache-vs-mooncake-vs-dynamo" rails with the attention/kv-cache + prefill/decode +
  // serving-engine pieces, not the catch-all. The bounded `kv-cache-offloading`/`lmcache`/
  // `mooncake` tokens are corpus-scanned to appear in only this one new slug (no existing
  // slug carries them) and in no earlier cluster regex, so first-match-wins poaches
  // nothing. A bare `dynamo` is deliberately omitted — the existing dynamo money page
  // already homes here via its `vllm` token, so adding it would buy nothing and widen
  // the surface needlessly.
  // Per-tenant LLM *cost attribution* (track spend per customer, usage-based billing)
  // is the accounting layer over the gateway/router cost machinery already here —
  // LiteLLM (in this regex) is itself the canonical tool for per-key/per-tenant spend
  // tracking, so "how-to-track-llm-cost-per-customer" rails with how-to-reduce-token-costs
  // and the gateway pieces rather than orphaning to the catch-all. The bounded tokens
  // `cost-attribution`/`cost-tracking`/`per-tenant`/`per-customer` are corpus-scanned to
  // appear in only this one new slug (no existing slug carries them — `multi-tenant-rag`
  // uses `multi-tenant`, not `per-tenant`, and homes in RAG first via `rag` regardless)
  // and in no earlier cluster regex, so first-match-wins poaches nothing.
  // KV-cache *eviction/selection* (StreamingLLM/H2O/SnapKV/Quest) is the runtime
  // memory-management decision that sits right beside kv-cache-offloading + the
  // attention/prefill-decode pieces already here, so "kv-cache-eviction-…" rails with
  // them instead of orphaning to the catch-all. The bounded `kv-cache`/`eviction`/
  // `streamingllm`/`snapkv` tokens are corpus-scanned to appear in no EARLIER cluster
  // slug: `kv-cache-quantization-…` carries `quantization` (Fine-Tuning & Training,
  // earlier) so first-match-wins keeps it there unchanged, and `kv-cache-offloading-…`
  // already homes here — so adding bare `kv-cache` poaches nothing and changes no
  // existing assignment. `eviction`/`streamingllm`/`snapkv` are unique to the new slug.
  // (`h2o`/`quest` deliberately omitted — common-enough strings, and `kv-cache`+`eviction`
  // already home the piece, so the narrower tokens buy nothing and widen the surface.)
  // `load-test`/`load-testing` home the app-load-testing money page (how-to-load-test-an-llm-app)
  // here with the inference-benchmark / latency / backpressure pieces it's the sibling of — it's
  // the application-side counterpart to how-to-benchmark-llm-inference. The hyphenated token only
  // matches `-load-test-`/`-load-testing-`, so it never poaches `…-was-load-bearing` (a Dispatch),
  // and `load-test` appears in no earlier-cluster slug, so first-match-wins poaches nothing.
  // Agent *timeout / cancellation / deadline budgeting* is the reliability layer the retry/
  // fallback/circuit-breaker/backpressure pieces already here imply but none owns: the
  // `how-to-set-a-timeout-for-an-ai-agent` money page argues a per-call timeout can't bound a
  // multi-step loop and you need a shared, shrinking deadline — the sibling of the retries,
  // circuit-breaker, backpressure and latency pieces in this cluster. The bounded `timeout`/
  // `cancellation` tokens are corpus-scanned: no existing slug carries `-timeout-`/`cancellation`
  // (the only adjacent string is the Dispatch `the-deadline-arrives-with-its-teeth-pulled`, which
  // carries `deadline`, NOT a token added here — `deadline` is deliberately omitted precisely so
  // that Dispatch is never poached into this cluster), and neither token appears in any earlier
  // cluster regex, so first-match-wins poaches nothing. A bare `cancel` is omitted to keep the
  // surface minimal; `timeout` alone homes the piece via its slug.
  // Output *truncation* handling (finish_reason:"length" / stop_reason:"max_tokens" /
  // finishReason:"MAX_TOKENS") is the reliability layer that sits right beside the
  // api-errors/retries/timeout pieces already here: it's the "200-but-incomplete" failure
  // of an LLM API call, and `how-to-handle-a-truncated-llm-response` argues the fix lives in
  // the gateway/call layer (budget for reasoning tokens, branch on the stop field), the sibling
  // of the retries/fallback/timeout money pages in this cluster. The bounded `truncated`/
  // `truncation` tokens are corpus-scanned: no existing slug carries `-truncat*-` (the tool-
  // response-design and embedding pieces mention truncation only in body, never in a slug), and
  // neither token appears in any earlier cluster regex, so first-match-wins poaches nothing.
  // `finish-reason`/`stop-reason`/`max-tokens` are deliberately omitted — `truncated` alone homes
  // the piece and keeps the surface minimal.
  // `lmdeploy`/`turbomind` (the InternLM C++ serving engine, a first-class inference
  // engine alongside vllm/sglang/tgi) are corpus-scanned: they appear in no earlier
  // cluster regex, and the `deploy` substring inside `lmdeploy` is NOT the bounded
  // `deploy` token of Sandboxes & Runtime (that needs `(^|-)deploy(-|$)`), so a standalone
  // `lmdeploy-*`/`turbomind-*` slug that carries no vllm/sglang/tensorrt token still homes
  // here rather than dropping to the catch-all. First-match-wins poaches nothing.
  // `cascade`/`frugalgpt` (the cost-routing cascade pattern — cheap model first, escalate
  // on a verifier) sit beside the routers here: `llm-cascade-vs-router` already homes via
  // `router`, but a standalone `llm-model-cascade-*`/`frugalgpt-*` slug would otherwise
  // orphan. Bounded so `cascade` never matches `cascaded` (the voice-desk `…-vs-cascaded-
  // voice-agents` slug is a distinct segment); both tokens appear in no earlier cluster.
  // Provider abstraction (provider-agnostic-ai-agents — "swap OpenAI/Anthropic/… in one
  // line, and why the agent-layer lock-in survives it") is the demand-side companion to
  // the gateway comparisons here: the piece's only in-body link is to any-llm-vs-litellm
  // (this cluster), and its whole argument is that no gateway unlocks tool-calling
  // portability — so it rails with litellm/portkey/any-llm, not the model-family pages.
  // The compound `provider-agnostic` token is corpus-scanned to appear in EXACTLY one slug
  // (this one) across the whole corpus, so first-match-wins rescues it from the #15/#29
  // catch-all and poaches nothing — in this or any other cluster.
  ["Inference & Gateways",   /(^|-)(inference|vllm|sglang|lmdeploy|turbomind|ollama|tensorrt|trt|tgi|gateway|litellm|portkey|tensorzero|provider-agnostic|routing|router|routellm|notdiamond|martian|cascade|frugalgpt|bentoml|serve|serving|kserve|triton|seldon|batch|batching|continuous-batching|in-flight|inflight|tensor-parallelism|pipeline-parallelism|speculative-decoding|eagle|medusa|mlx|llama-cpp|diffusion|dllm|autoregressive|mig|mps|time-slicing|gpu|gpu-sharing|temperature|top-p|top-k|min-p|nucleus|attention|mha|mqa|gqa|mla|flashattention|pagedattention|flashinfer|kv-cache|kv-cache-offloading|eviction|streamingllm|snapkv|lmcache|mooncake|mamba|ssm|state-space|rope|yarn|ntk|position-interpolation|tiktoken|sentencepiece|tokenizer|tokenizers|tokenization|bpe|load-test|load-testing|retries|fallback|fallbacks|circuit-breaker|backpressure|reliability|timeout|cancellation|truncated|truncation|rate-limit|rate-limits|token-budget|token-cost|token-costs|cost-optimization|cost-attribution|cost-tracking|per-tenant|per-customer|latency|ttft|tpot|time-to-first-token|inter-token)(-|$)/],
  // Agent *hosting/execution* runtimes (Cloudflare Agents/Durable Objects, Bedrock
  // AgentCore, Vercel) are the "where does my long-running agent's process live and
  // persist across the pause" decision — the same continuity concern as the
  // durable-execution engines (temporal/inngest/restate) already here. The runtime
  // money page is matched on its leading `where-to-run` token, NOT a bare
  // `long-running`: that phrase is ambiguous (it equally describes a context-management
  // piece like "how-to-manage-context-in-a-long-running-agent", which belongs in
  // Prompts & Optimization), so the narrower `where-to-run` homes the hosting piece
  // without poaching the context piece. Both tokens appear in no earlier cluster slug.
  // AWS Bedrock AgentCore is the managed agent runtime + ops layer (Runtime/Memory/
  // Gateway/Identity/Browser/Code-Interpreter/Observability) — the same "where does my
  // long-running agent's process live and persist" decision this cluster already owns
  // (the comment above named it explicitly), so the `aws-bedrock-agentcore-explained`
  // money page rails here with the durable-execution engines instead of orphaning to
  // the catch-all. The bounded `agentcore` token is corpus-scanned: it appears in ONLY
  // that one new slug (no existing slug contains "agentcore"), and no earlier cluster
  // regex matches `agentcore`/`bedrock`/`aws`, so first-match-wins poaches nothing. A
  // bare `bedrock` is deliberately NOT added — it would capture the cloud-platform piece
  // `bedrock-vs-vertex-ai-vs-azure-ai-foundry`, a different "which managed model API"
  // demand — so the token is scoped to `agentcore` alone.
  // Idempotency / exactly-once for side-effecting tool calls is the reliability layer
  // ON TOP of durable execution: the `how-to-make-ai-agent-tool-calls-idempotent` money
  // page argues that at-least-once replay (Temporal/Inngest/Restate + LangGraph
  // checkpointing — all already in THIS cluster) is what double-sends the email unless
  // you attach an idempotency key, and it cross-links those exact siblings, so it rails
  // here rather than orphaning to the catch-all. The bounded `idempotent`/`idempotency`/
  // `exactly-once` tokens are corpus-scanned: each appears in ONLY that one new slug, and
  // no earlier cluster regex matches them (Protocols' `tools`/`tool-calling` don't match
  // the "tool-calls" segment pair), so first-match-wins poaches nothing.
  // `deploy`/`deployment` home the production-deploy umbrella (how-to-deploy-an-ai-agent-to-
  // production) here with the where-to-run/durable-execution/AgentCore runtime pieces — the
  // same "how do I actually run this in prod" demand. Corpus-scanned and bounded: `how-to-
  // deploy-an-mcp-server` matches the EARLIER Protocols cluster (`mcp`) so first-match-wins
  // keeps it there; `agent-deployed-…` / `…-the-deploy-target-…` are Dispatches (not cluster-
  // homed); `deploy` won't match `deployed` (the `(-|$)` boundary). So nothing is poached.
  // Agent action ROLLBACK — the saga / compensating-transaction pattern (how-to-roll-back-an-
  // ai-agents-actions) — is the durable-orchestration sibling of the idempotency + durable-
  // execution pieces already here: idempotency makes a retry safe, compensation undoes a
  // committed step when a LATER step fails, and the saga state machine must live in the same
  // durable orchestrator (Temporal/durable execution). The bounded `saga`/`compensating`/
  // `compensation`/`rollback`/`roll-back` tokens are corpus-scanned to appear in ONLY that one
  // new slug (the rollout piece is `roll-out`, not `roll-back`), and no earlier cluster regex
  // matches them, so first-match-wins poaches nothing and the move is purely catch-all → here.
  // The event/message backbone an agent runtime runs ON (Kafka/NATS/Redis Streams,
  // and the cron-vs-webhook-vs-queue triggering decision) rails with the durable-
  // execution + where-to-run pieces already here: a replayable, ordered log is the
  // substrate durable orchestration, idempotency, and exactly-once delivery are built
  // over, so the "which message queue for AI agents" money page belongs with temporal-
  // vs-inngest and where-to-run, not the catch-all. Corpus-scanned (2026-06-30): bare
  // `kafka`/`nats`/`redis-streams`/`queue` match ONLY `kafka-vs-nats-vs-redis-streams-
  // ai-agents` and `how-to-trigger-an-ai-agent-cron-vs-webhook-vs-queue` (both were
  // catch-all); neither appears in any earlier cluster (so first-match-wins poaches
  // nothing) nor any later cluster (so nothing is stolen). `redis-streams` is the
  // compound, not bare `redis`, so a future redis-semantic-caching page still homes in
  // Inference & Gateways. `valkey`/`message-queue`/`messaging`/`pubsub`/`event-driven`
  // are reserved for future pieces (0 corpus hits today).
  // The micro-VM ISOLATION engines belong here with the E2B/Modal/Daytona sandboxes: the
  // `firecracker-vs-gvisor-vs-kata` and `wasm-vs-microvm-vs-v8-isolate` pieces already home
  // here via `sandbox`, but `hyperlight-vs-firecracker` carries no `sandbox` token, so the
  // bounded `firecracker`/`hyperlight` VMM tokens pull it out of the catch-all onto the same
  // isolation-tech rail. Corpus-scanned (2026-07-01): `firecracker` appears in only those two
  // sandbox slugs (both already home here) and `hyperlight` in only the new one; neither token
  // appears in any earlier cluster regex, so first-match-wins poaches nothing.
  ["Sandboxes & Runtime",    /(^|-)(sandbox|sandboxes|e2b|modal|daytona|firecracker|hyperlight|durable|temporal|inngest|restate|where-to-run|deploy|deployment|agentcore|idempotent|idempotency|exactly-once|saga|compensating|compensation|rollback|roll-back|kafka|nats|redis-streams|valkey|message-queue|messaging|pubsub|event-driven|queue)(-|$)/],
  // `realtime` moved here from Inference & Gateways (see note above): the OpenAI Realtime API
  // and Google Gemini Live are the real-time speech-to-speech VOICE backends, so a
  // `…-realtime-…-voice-agents` slug rails with the livekit/pipecat/vapi and STT/TTS pieces.
  // Corpus-scanned: the only `realtime` slugs are this voice money page and
  // `llm-batch-api-vs-realtime-cost` (homed in the earlier Inference cluster via `batch`), so
  // adding `realtime` here poaches nothing.
  // Speaker diarization (who-spoke-when) is a speech-pipeline concern — the same
  // demand cluster as the STT/TTS/turn-detection voice pieces — but the diarization
  // money page's slug (pyannote-vs-nemo-vs-cloud-speaker-diarization) carries none of
  // the voice/realtime/livekit tokens, so it used to fall through to Guardrails &
  // Safety via a bare `nemo` token (NVIDIA NeMo, not NeMo Guardrails). The bounded
  // `pyannote`/`diarization` tokens are corpus-scanned: each appears in ONLY that one
  // slug and in no earlier cluster regex, so first-match-wins homes it here and
  // poaches nothing. (See the `nemo` removal in Guardrails & Safety below.)
  ["Voice Agents",           /(^|-)(voice|realtime|livekit|pipecat|vapi|pyannote|diarization)(-|$)/],
  // PII detection / redaction (Presidio / GLiNER / LLM-based) is a safety/compliance
  // control — the same demand cluster as the guardrail/injection-defense pieces.
  // `presidio`/`gliner`/`redaction`/`pii` appear in no earlier cluster slug, so safe.
  // The OWASP Top 10 for LLM Applications is the umbrella risk taxonomy over exactly
  // these defenses (injection, output handling, excessive agency), so the `owasp`
  // money page rails with the injection/guardrail pieces rather than orphaning to the
  // catch-all. `owasp` appears in only its own slug (corpus-scanned) and in no earlier
  // cluster regex, so first-match-wins poaches nothing.
  // The "lethal trifecta" / data-exfiltration explainer is the threat-model umbrella
  // over these same defenses — prompt injection (LLM01) + sensitive-info disclosure
  // (LLM02) are two of its three legs — so the `the-lethal-trifecta-ai-agent-data-
  // exfiltration` money page rails here with the injection/owasp/guardrail pieces
  // rather than orphaning to the catch-all. The bounded `trifecta`/`exfiltration`
  // tokens are corpus-scanned: each appears in ONLY that one new slug, and no earlier
  // cluster regex matches them, so first-match-wins poaches nothing. (`exfiltration`
  // is also future-proofing for the next agent-security money page.)
  // Secrets management for agents IS that next agent-security money page: the
  // `secrets-management-for-ai-agents` piece is a threat-model argument built on the
  // same OWASP legs already keyed here (LLM01 prompt injection → LLM02 disclosure →
  // LLM06 excessive agency), its thesis being that a prompt-injected agent EXFILTRATES
  // its own long-lived key — so it rails with the injection/owasp/trifecta/exfiltration
  // pieces rather than orphaning to the catch-all. The bounded `secret`/`secrets`/
  // `credential`/`credentials`/`vault` tokens are corpus-scanned: each appears in ONLY
  // that one new slug, and no earlier cluster regex matches them (Protocols' identity/
  // auth/oauth tokens don't match "secrets"/"credential"), so first-match-wins poaches
  // nothing. `vault` is bounded so it can't brush an unrelated mid-slug segment.
  // The Agent Control Specification (ACS) explainer — a runtime governance/control-plane
  // standard whose thesis is structural enforcement (a deny gate the model cannot override)
  // over instructional guardrails — rails with the guardrails/injection/owasp pieces it
  // argues against. The bounded `acs`/`governance`/`agent-control`/`control-specification`
  // tokens are corpus-scanned: each appears in ONLY that one new slug (note: distinct from
  // Protocols' `acp` payment token), and no earlier cluster regex matches them, so
  // first-match-wins poaches nothing.
  // NOTE: the bare `nemo` token was removed (2026-06-30). It was redundant — the
  // NeMo Guardrails money page (guardrails-ai-vs-nemo-guardrails-vs-llama-guard) homes
  // here via `guardrails`/`guard`/`llama-guard` regardless — but it was a latent trap:
  // `nemo` also matches NVIDIA NeMo (the speaker-diarization product), which falsely
  // poached pyannote-vs-nemo-vs-cloud-speaker-diarization into this security cluster.
  // That piece now homes in Voice Agents (see the `pyannote`/`diarization` tokens added
  // above), and dropping `nemo` here keeps any future NVIDIA-NeMo piece out too.
  // AI regulation/compliance pieces (the EU AI Act et al.) rail with the governance/
  // safety cluster they share a problem with — what an agent is allowed to do, and how
  // you prove which risk tier it operated in. The bounded `ai-act`/`regulation`/
  // `compliance` tokens are corpus-scanned (2026-06-30): `ai-act` appears in ONLY the
  // eu-ai-act-for-ai-agents slug, and `regulation`/`compliance` in none yet (future-
  // proofing for the policy desk); no earlier cluster regex matches any of them, so
  // first-match-wins poaches nothing.
  ["Guardrails & Safety",    /(^|-)(guardrail|guardrails|llama-guard|guard|injection|owasp|presidio|gliner|redaction|pii|trifecta|exfiltration|secret|secrets|credential|credentials|vault|exploit|advisory|acs|governance|agent-control|control-specification|ai-act|regulation|compliance)(-|$)/],
  ["Structured Outputs",     /(^|-)(structured|instructor|outlines|baml)(-|$)/],
  // Agent reasoning/planning *patterns* (ReAct/Plan-and-Execute/Reflexion, the
  // plan-then-execute lineage, chain/tree-of-thought) are their own decision the
  // corpus had no home for — distinct from the prompt-*optimization* tools below
  // (DSPy/TextGrad) and from the Agent Frameworks that implement these loops. Placed
  // before Prompts so "react/reflexion/plan-and-execute" rail together instead of
  // falling to the catch-all; none of these tokens appear in earlier clusters'
  // slugs, so first-match-wins is safe.
  // The agents-vs-workflows architecture decision (predefined code paths vs the LLM
  // dynamically directing its own process) is the parent choice underneath the
  // reasoning-loop patterns below — it rails with react/plan-and-execute/reflexion.
  // `workflow`/`workflows` appears in no earlier cluster slug (n8n's "langflow"/"flow"
  // is not the bounded `workflow` token), so first-match-wins is safe.
  // The WHEN-to-reason decision — sleep-time compute (precompute during idle) vs
  // test-time compute (reason under latency) — is the same demand cluster as the
  // reasoning-models money page (reasoning-models-vs-standard-llms also homes here
  // via `reasoning`), so the `sleep-time`/`test-time` compounds rail it with the
  // reasoning lineage instead of the "More comparisons" catch-all. Both compounds
  // are bounded and appear in no other comparison slug, so first-match-wins is safe.
  // The agent-architecture / control-flow decisions belong with the reasoning-loop
  // patterns: multi-agent-vs-single-agent (how many agents) sits alongside
  // agents-vs-workflows (which is already here via `workflow`), and human-in-the-loop
  // (where a person gates the control flow — pause/approve/resume) is the same family
  // of "how is the agent's execution structured" choice. `multi-agent`/`single-agent`/
  // `human-in-the-loop`/`hitl` appear in no earlier cluster slug, so first-match-wins
  // poaches nothing.
  // "Deep agents" (the planning-tool + virtual-file-system + subagents + long-prompt
  // pattern for long-horizon tasks, e.g. LangChain's deepagents) are an agent
  // control-flow/architecture decision — the same family as the react/reflexion/
  // multi-agent loops here, and the deep-agents money page links in-body to
  // react-vs-plan-and-execute-vs-reflexion (which homes here), so its sibling rail
  // surfaces exactly that. The bounded `deep-agents`/`deep-agent` tokens are
  // corpus-scanned to appear in ONLY that one slug — `deepgram`/`deepeval`/`deepseek`/
  // `deep-research` are distinct strings a bounded `deep-agent(s)` token can't match —
  // so first-match-wins poaches nothing.
  // Test-time selection methods (self-consistency = majority vote over sampled
  // reasoning paths; best-of-N = verifier/reward-model pick) are test-time-compute
  // techniques — the same family as sleep-time-compute-vs-test-time-compute and the
  // reasoning-effort-vs-thinking-budget knob already here, NOT decoding-parameter
  // sampling (temperature/top-p). The bounded `self-consistency`/`best-of-n` tokens
  // appear in only this one slug (corpus-scanned), so first-match-wins poaches
  // nothing. NOTE: the bare `sampling` token was removed from Inference & Gateways
  // (above) — it was redundant there (temperature-vs-top-p-vs-top-k-llm-sampling
  // homes via `temperature`/`top-p`/`top-k`; mcp-sampling-vs-elicitation homes in
  // Protocols via `mcp`, an earlier cluster) and its `-sampling` suffix was poaching
  // this reasoning piece into Inference before Agent Reasoning was ever checked.
  // Agent-loop CONTROL — how-to-stop-an-ai-agent-from-looping-forever (max-step caps,
  // loop/repetition detection, termination) — is a property of the agent loop itself,
  // the same architecture the react/plan-and-execute/reflexion pieces compare, so it
  // rails with them (and links in-body to react-vs-plan-and-execute and the
  // human-in-the-loop guide already homed here). Bounded `loop`/`looping` are corpus-
  // scanned to appear only in this new slug, the already-here human-in-the-loop guide
  // (which homes via `human-in-the-loop`/`hitl` regardless), and the never-clustered
  // `the-loop` Dispatch (a first-person essay, no compare table) — and no LATER-cluster
  // slug carries a bounded `loop`, so first-match-wins poaches nothing.
  // Interleaved thinking — reasoning BETWEEN tool calls so the agent can re-plan when a
  // tool returns something wrong — is a reasoning/planning pattern, sibling to react,
  // reflexion, and plan-and-execute. `interleaved-thinking-agents-reason-between-tool-calls`
  // carried none of those tokens (its `reasoning` is spelled `reason`) and orphaned to the
  // catch-all. The bounded compound `interleaved-thinking` is corpus-scanned to appear ONLY
  // in that slug — `reasoning-effort-vs-thinking-budget` already homes here via `reasoning`
  // and carries no `interleaved-thinking` — so first-match-wins poaches nothing.
  // Mixture-of-Agents (`mixture-of-agents-vs-single-model`) is a test-time-compute /
  // sampling-and-aggregation strategy — the same decision space as the self-consistency
  // and best-of-N pieces already here (it's the piece's own first in-body link). It carries
  // none of this cluster's tokens (`mixture-of-experts` in Models is a different string), so
  // it orphaned to the catch-all. The bounded compound `mixture-of-agents` is corpus-scanned
  // to appear ONLY in that slug and in no earlier cluster (Models & LLM APIs, which owns the
  // near-miss `mixture-of-experts`, comes AFTER this cluster), so first-match-wins poaches nothing.
  ["Agent Reasoning & Planning", /(^|-)(react|reflexion|reasoning|planning|plan-and-execute|plan-and-solve|rewoo|llmcompiler|cot|tot|chain-of-thought|tree-of-thought|interleaved-thinking|mixture-of-agents|sleep-time|test-time|self-consistency|best-of-n|workflow|workflows|multi-agent|single-agent|deep-agents|deep-agent|human-in-the-loop|hitl|loop|looping)(-|$)/],
  // Context-management money pages (how-to-manage-context-in-a-long-running-agent —
  // clearing vs compaction vs memory) are the operational arm of context engineering,
  // so they rail with `context-engineering` and the caching pieces already here.
  // Broadened `context-engineering` → a bounded `context` to capture them: a corpus
  // scan shows every other bounded-`context` slug already homes earlier or here
  // (`*-selective-context` via `prompt`; `context-rot-…`/`rag-vs-long-context` claimed
  // first by RAG's `long-context`), so first-match-wins poaches nothing and only the
  // orphaned context-management guide moves out of the "More comparisons" catch-all.
  ["Prompts & Optimization", /(^|-)(dspy|textgrad|adalflow|prompt|context|caching)(-|$)/],
  // Model-family + LLM-API-surface comparisons — "which model / which API do I
  // build on": Claude vs GPT vs Gemini, the open Qwen/DeepSeek/Gemma families,
  // SLM-vs-LLM, MoE-vs-dense, open-vs-closed, and the OpenAI Responses/Assistants/
  // Chat-Completions decision. These had no home and were dumping into the
  // "More comparisons" catch-all — the largest, least-coherent bucket. They are one
  // demand cluster. Placed LAST so every more-specific cluster claims its pieces
  // first (first-match-wins), and the tokens are deliberately DISTINCTIVE: `qwen`/
  // `deepseek`/`gemma` rather than a bare `mistral`/`llama`, because those appear in
  // OCR/parse slugs (`…-vs-mistral-ocr`, `…-llamaparse`) that must stay in their own
  // clusters; `small-language-models`/`mixture-of-experts` as compounds. So nothing
  // earlier is poached and the catch-all keeps only the genuinely-uncategorized.
  // Managed cloud model platforms (AWS Bedrock / Google Vertex AI / Azure AI Foundry)
  // are the "which cloud do I build on" decision — a model-access choice that rails
  // with the model-family pages. `bedrock`/`vertex-ai`/`azure-ai`/`foundry` appear in
  // no earlier cluster slug, and this cluster is last, so first-match-wins is safe.
  // The 2026 open-weight agentic MoE models (Kimi K2, GLM-4.x, MiniMax M2, Qwen3)
  // are the same "which open model do I build my agent on" decision as the existing
  // open-weight family pages. `kimi`/`glm`/`minimax`/`qwen3` are corpus-scanned to
  // appear in no earlier cluster slug — `qwen3-embedding-…` already homes in the
  // FIRST cluster (RAG & Retrieval) via its `embedding` token, so first-match-wins
  // keeps it there and the new `qwen3` token poaches nothing.
  // A vision-language MODEL is a model-family choice — "which open VLM do I build my
  // agent on" — the same demand as `small-language-models-vs-llms` and `mixture-of-
  // experts-vs-dense-models` already here (both model-TYPE comparisons). The lone
  // `best-open-vision-language-model-for-agents` piece orphaned to the catch-all
  // because it carried none of these tokens; the visual-RAG (`colpali-…`) and
  // multimodal-embedding (`clip-vs-siglip-…`) pieces are a DIFFERENT layer and stay
  // in RAG & Retrieval. The bounded compound `vision-language` is corpus-scanned
  // (2026-07-03) to appear in EXACTLY one slug — the orphan — and in no earlier
  // cluster, so first-match-wins rescues it into this 15-member cluster (a real
  // sibling rail + indexable hub, not a singleton) and poaches nothing.
  ["Models & LLM APIs",      /(^|-)(gpt|claude|gemini|qwen|qwen3|kimi|glm|minimax|deepseek|gemma|small-language-models|mixture-of-experts|vision-language|closed|responses-api|assistants-api|chat-completions|bedrock|vertex-ai|azure-ai|foundry)(-|$)/],
];
export const COMPARISON_CATCHALL = "More comparisons";
// a demand piece is a Wire/Stack "…-vs-…" comparison, a "best-…" guide, or a
// "how-to-…" guide — all three are high-intent decision/guide queries the hub
// exists to collect. ("how-to-" is the only safe non-comparison prefix to admit:
// it's an unambiguous guide signal, where the desk's metaphorical essay slugs
// ("the-megawatt-you-cannot-rent") are not, so it can't drag commentary in.)
function isComparisonPost(p) {
  if (p.section !== "wire" && p.section !== "stack") return false;
  const s = String(p.slug || "").replace(/^\d{4}-\d\d-\d\d-/, "");
  if (/(^|-)vs(-|$)/.test(s) || s.startsWith("best-") || s.startsWith("how-to-")) return true;
  // A real `compare:` table (header + ≥1 row) is itself an unambiguous demand-piece
  // signal — the same one check-content enforces — that a metaphorical desk essay
  // ("the-megawatt-you-cannot-rent") never carries. So a Wire/Stack explainer with an
  // at-a-glance comparison earns a cluster home + sibling rail even when its slug isn't
  // a "…-vs-…"/"best-"/"how-to-" query (e.g. "mcp-tool-poisoning-rug-pulls",
  // "context-rot-…", "matryoshka-embeddings"): it's a buyer's-guide-grade decision
  // piece, so it belongs in the internal-link graph with its cluster siblings, not
  // orphaned out of #15/#29.
  return Array.isArray(p.compare) && p.compare.length >= 2;
}
// the single topic cluster a demand piece belongs to (or null if it isn't a
// comparison). Shared by the /comparisons hub and the on-article sibling rail so
// the two surfaces can never disagree about which cluster a piece is in.
export function clusterLabelFor(p) {
  if (!isComparisonPost(p)) return null;
  const s = p.slug.replace(/^\d{4}-\d\d-\d\d-/, "");
  const hit = COMPARISON_CLUSTERS.find(([, re]) => re.test(s));
  return hit ? hit[0] : COMPARISON_CATCHALL;
}
// stable, url-safe slug for a cluster label — the single source of truth for both
// the in-page anchor on the /comparisons hub AND the dedicated /comparisons/:slug
// page URL, so the hub anchor and the standalone page can never disagree. (Kept
// byte-identical to the old render-side `slugifyAnchor` so existing #anchors hold.)
export function clusterSlug(label) {
  return String(label).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
// is this cluster worth its own indexable page? Two ways a standalone hub turns
// thin: (a) the "More comparisons" catch-all is a deliberately incoherent grab-bag
// (mixed topics), and (b) a SINGLETON cluster — one lone member — produces a hub
// page that lists a single link, which Google reads as thin content and which
// wastes crawl budget plus a self-referential breadcrumb on the only article in it.
// Either way the cluster still shows as a section on /comparisons (its article is
// never delinked), it just earns no dedicated /comparisons/:slug page or sitemap
// URL until a second sibling lands and the hub has real "more in this guide" value.
function clusterIsIndexable(label, count) { return label !== COMPARISON_CATCHALL && count >= 2; }
export function comparisonClusters(d = db()) {
  const groups = new Map();           // label → posts[]   (insertion order = display order)
  for (const [label] of COMPARISON_CLUSTERS) groups.set(label, []);
  for (const p of allPosts(d)) {
    const label = clusterLabelFor(p);
    if (!label) continue;
    if (!groups.has(label)) groups.set(label, []);   // catch-all appended last
    groups.get(label).push(p);
  }
  return [...groups.entries()]
    .filter(([, posts]) => posts.length)
    .map(([label, posts]) => ({ label, posts, slug: clusterSlug(label), indexable: clusterIsIndexable(label, posts.length) }));
}
// One comparison cluster by its url slug, for the dedicated /comparisons/:slug
// page. Returns { label, posts, slug, indexable } or null when the slug doesn't
// match an indexable cluster (unknown slug, or the non-indexable catch-all).
export function comparisonClusterBySlug(slug, d = db()) {
  const c = comparisonClusters(d).find(c => c.slug === slug);
  return c && c.indexable ? c : null;
}
// The compared options a piece names in its at-a-glance `compare:` table header —
// its first row's cells after the axis label ("Dimension"/"Platform"), normalized
// to canonical entity tokens (lowercased; backticks and other punctuation stripped)
// so "AutoGen (microsoft/autogen)" and "`autogen`" both reduce to "autogen". The
// same options already drive the schema.org `about` entities in render.js; here
// they let the cluster rail rank by shared subject.
//
// A header cell often bundles a category with the concrete tools that exemplify it
// — "MicroVMs (Firecracker/E2B)", "WebAssembly (Wasmtime/Pyodide)". The category
// alone ("microvms") matches nothing, so a substrate page comparing those exact
// tools by name (the `Firecracker | gVisor | Kata` and `E2B | Modal | Daytona`
// pages) scored ZERO overlap and the rail silently fell back to recency — surfacing
// unrelated cluster-mates instead of the true siblings. So we keep the
// de-parenthesized category term AND additionally mine each parenthetical for the
// named tools inside it (split on list separators), dropping generic clarifiers
// ("open-source", "self-hosted") that are adjectives, not entities. Purely additive:
// every prior match still matches, and overlap can only grow toward more-relevant.
const PAREN_CLARIFIER = new Set([
  "open source", "oss", "self hosted", "hosted", "cloud", "saas", "paas", "paid",
  "free", "beta", "ga", "managed", "local", "api", "open", "closed", "proprietary",
  "commercial", "framework", "library", "service", "platform",
]);
// Some entities carry non-ASCII glyphs the ASCII filter below would simply delete,
// collapsing distinct names to a degenerate token: "τ-bench" and "τ²-bench" both
// reduce to "bench", so the two Sierra agent benchmarks become the SAME entity and
// neither matches the ASCII "tau-bench" spelling other pages use in their cells.
// Transliterate the Greek letters and superscript digits that actually name things
// in this ML corpus (benchmarks, metrics, model variants) to their Latin/ASCII forms
// FIRST, so the real token survives — "τ-bench"→"tau bench", "τ²-bench"→"tau2 bench".
// Already lowercased at this point, so only lowercase Greek need mapping. Additive:
// these glyphs appear in no other header cell today, so no existing entity changes.
const ENTITY_TRANSLIT = {
  "τ": "tau", "µ": "mu", "μ": "mu", "β": "beta", "α": "alpha", "λ": "lambda",
  "γ": "gamma", "δ": "delta", "σ": "sigma", "π": "pi", "θ": "theta", "ε": "epsilon",
  "ω": "omega", "φ": "phi", "ρ": "rho", "η": "eta", "κ": "kappa", "χ": "chi",
  "ψ": "psi", "ξ": "xi", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁰": "0",
};
const TRANSLIT_RE = new RegExp("[" + Object.keys(ENTITY_TRANSLIT).join("") + "]", "g");
const normEntity = (s) => String(s || "").toLowerCase()
  .replace(/`[^`]*`/g, "").replace(/[`*_]/g, "")
  .replace(TRANSLIT_RE, ch => ENTITY_TRANSLIT[ch])
  .replace(/[^a-z0-9]+/g, " ").trim();
export function comparedEntities(p) {
  const c = p && p.compare;
  if (!Array.isArray(c) || c.length < 2 || !Array.isArray(c[0])) return new Set();
  const out = new Set();
  for (const cell of c[0].slice(1)) {
    const raw = String(cell || "");
    const main = normEntity(raw.replace(/\([^)]*\)/g, ""));
    if (main && main.length > 1 && main !== "dimension") out.add(main);
    for (const m of raw.matchAll(/\(([^)]*)\)/g)) {
      for (const frag of m[1].split(/[/,&+]| vs | or /i)) {
        const e = normEntity(frag);
        if (e && e.length > 1 && e !== "dimension" && !PAREN_CLARIFIER.has(e)) out.add(e);
      }
    }
  }
  return out;
}
// Sibling demand pieces in the SAME comparison cluster as `slug` — the on-article
// "More in <cluster>" rail (Wirecutter "more from this guide"). Returns
// { label, posts } excluding self, or null when the piece isn't a demand
// comparison, sits in the incoherent "More comparisons" catch-all, or has no
// siblings. Reuses `clusterLabelFor`, so it tracks the /comparisons hub exactly.
// This is the on-article complement to that hub: it keeps a reader inside one
// money cluster and tightens the internal-link graph where the demand corpus lives.
// Siblings are ranked by shared compared-entity overlap first, then recency — so a
// big cluster surfaces the comparisons that share a named tool (e.g. the OTHER
// AutoGen head-to-heads on an AG2-vs-AutoGen page) instead of just the newest 4.
// Pages with no `compare:` entities (best-/how-to- guides) score 0 overlap across
// the board, so they fall back to the original pure-recency order — no regression.
export function clusterSiblings(slug, limit = 4, d = db()) {
  const posts = allPosts(d);
  const self = posts.find(p => p.slug === slug);
  if (!self) return null;
  const label = clusterLabelFor(self);
  if (!label || label === COMPARISON_CATCHALL) return null;
  const selfEnts = comparedEntities(self);
  const overlapWith = p => { let n = 0; const e = comparedEntities(p); for (const x of selfEnts) if (e.has(x)) n++; return n; };
  // candidates arrive newest-first (allPosts is date-DESC). Sort is stable, so the
  // `a.i - b.i` tie-break preserves that recency order within an equal-overlap tier.
  const sibs = posts
    .filter(p => p.slug !== slug && clusterLabelFor(p) === label)
    .map((p, i) => ({ p, i, overlap: overlapWith(p) }))
    .sort((a, b) => b.overlap - a.overlap || a.i - b.i)
    .slice(0, limit)
    .map(x => x.p);
  return sibs.length ? { label, posts: sibs, slug: clusterSlug(label) } : null;
}
// ── /concepts — the evergreen "what is X" explainer hub ──────────────────────
// Our highest-intent evergreen pieces are *definitional* explainers ("what is
// harness engineering", "why long context degrades"), not comparisons — so most
// carry no `-vs-`/`best-`/`how-to-` slug and no `compare:` table, which means
// isComparisonPost() is false, clusterLabelFor() returns null, and they get NO
// sibling rail and NO hub home — orphaned from the #15/#29 internal-link graph
// that drives organic discovery even though they own the "what is X" head terms.
// This is a CURATED family (Stratechery's /concepts, The Verge's explainer hubs):
// "is this a foundational concept" is an editorial call, not a slug shape, so it
// can't be a regex like COMPARISON_CLUSTERS. Order = display order on /concepts
// (most foundational first). Slugs are validated against the corpus at read time,
// so a renamed/removed piece silently drops out rather than 404-ing the rail.
export const CONCEPT_SLUGS = [
  "context-engineering-for-ai-agents",
  "harness-engineering-for-ai-agents",
  "from-framework-to-harness",
  "context-rot-why-long-context-degrades",
  "why-ai-agents-fail-in-production",
  "what-are-deep-agents",
];
// The curated concept explainers as live post objects, in display order, skipping
// any slug not present in the corpus (so the hub never lists a dead link).
export function concepts(d = db()) {
  const bySlug = new Map(allPosts(d).map(p => [p.slug, p]));
  return CONCEPT_SLUGS.map(s => bySlug.get(s)).filter(Boolean);
}
// ── /topics/agent-security — the AI-agent security topic hub ─────────────────
// The security cluster is our densest money-page family — prompt injection, its
// escalation to RCE, sandbox isolation, MCP auth, agent identity, red-team and
// PII tooling — but nothing ranks for the broad head term "AI agent security."
// Best-media practice (NYT/Guardian topic pages, Stratechery topic archives, The
// Verge storystreams): a CURATED, editor-ordered hub that (a) owns the head query,
// (b) funnels link equity to the money pages, and (c) gives readers/agents a single
// map of the sub-topic. Mirrors CONCEPT_SLUGS exactly (an editorial call, not a slug
// regex like COMPARISON_CLUSTERS). Order = display order: framework → attacks →
// escalation → isolation → identity/secrets → defensive & testing tooling. Slugs
// validate against the corpus at read time, so a renamed/removed piece silently
// drops out rather than 404-ing the hub.
export const SECURITY_HUB_SLUGS = [
  "owasp-top-10-for-llm-applications",
  "owasp-mcp-top-10",
  "nsa-mcp-security-guidance",
  "how-to-prevent-prompt-injection-in-ai-agents",
  "prompt-injection-defense-guardrails-vs-architecture",
  "jailbreak-vs-prompt-injection",
  "context-compaction-erases-agent-guardrails",
  "prompt-injection-to-rce-agent-allowlist-bypass",
  "amazon-q-rce-coding-agent-folder-trust",
  "ai-browser-prompt-injection",
  "ai-agents-finding-zero-days",
  "mcp-tool-poisoning-rug-pulls",
  "mcp-server-ssrf-cloud-metadata-credentials",
  "your-container-is-not-a-sandbox",
  "firecracker-vs-gvisor-vs-kata-agent-sandbox-isolation",
  "wasm-vs-microvm-vs-v8-isolate-sandbox-ai-code",
  "secrets-management-for-ai-agents",
  "how-to-authenticate-an-ai-agent-identity",
  "how-to-authenticate-a-remote-mcp-server",
  "mcp-confused-deputy-problem",
  "2026-06-22-mcp-authorization-oauth",
  "web-bot-auth-explained-ai-agents",
  "2026-06-22-rebuff-vs-llm-guard-vs-vigil-prompt-injection",
  "guardrails-ai-vs-nemo-guardrails-vs-llama-guard",
  "garak-vs-pyrit-vs-promptfoo",
  "2026-06-22-presidio-vs-gliner-vs-llm-redaction",
];
// The curated security pieces as live post objects, in display order, skipping any
// slug not present in the corpus (so the hub never lists a dead link).
export function securityHub(d = db()) {
  const bySlug = new Map(allPosts(d).map(p => [p.slug, p]));
  return SECURITY_HUB_SLUGS.map(s => bySlug.get(s)).filter(Boolean);
}
// ── /topics/rag-retrieval — the RAG & retrieval topic hub ────────────────────
// The second curated topic hub, mirroring /topics/agent-security exactly. RAG &
// Retrieval is our largest money-page family (the first COMPARISON_CLUSTER), but
// like security it had no page ranking for the broad head term "RAG" / "retrieval-
// augmented generation." Same best-media rationale (NYT/Guardian topic pages):
// one indexable CollectionPage that owns the head query, funnels equity to the
// spokes, and gives readers one ordered path. Order = the retrieval PIPELINE:
// architecture (is RAG the right tool) → chunking → embeddings → vector store →
// retrieval quality (hybrid, rerank) → advanced patterns → evaluation. Curated
// editorially (like CONCEPT_SLUGS/SECURITY_HUB_SLUGS), not a slug regex; slugs
// validate against the corpus at read time so a renamed piece drops out, not 404s.
export const RAG_HUB_SLUGS = [
  "contextual-retrieval-vs-naive-rag",
  "2026-06-22-agentic-rag-vs-naive-rag",
  "rag-vs-long-context",
  "cag-vs-rag",
  "fine-tuning-vs-rag",
  "best-chunking-strategy-for-rag",
  "2026-06-23-late-chunking-vs-contextual-retrieval",
  "how-to-order-chunks-in-the-rag-prompt",
  "best-embedding-models-for-rag-agents",
  "voyage-vs-openai-vs-cohere-vs-gemini-embeddings",
  "matryoshka-embeddings",
  "how-to-migrate-embedding-models-in-production",
  "brute-force-vs-approximate-vector-search",
  "best-vector-database-for-ai-agents",
  "pgvector-vs-pinecone-vs-qdrant",
  "qdrant-vs-milvus-vs-weaviate",
  "hnsw-vs-ivf-vs-diskann",
  "how-to-tune-hnsw-vector-search",
  "2026-06-24-hybrid-search-bm25-vs-dense-vs-rrf",
  "best-reranker-for-rag",
  "cross-encoder-vs-bi-encoder",
  "colbert-vs-dense-vs-sparse-retrieval",
  "2026-06-21-graphrag-vs-vector-rag",
  "raptor-vs-naive-rag-hierarchical-retrieval",
  "2026-06-23-self-rag-vs-corrective-rag",
  "2026-06-23-how-to-evaluate-a-rag-pipeline",
  "retrieval-metrics-recall-at-k-vs-mrr-vs-ndcg",
];
// The curated RAG pieces as live post objects, in display order, skipping any
// slug not present in the corpus (so the hub never lists a dead link).
export function ragHub(d = db()) {
  const bySlug = new Map(allPosts(d).map(p => [p.slug, p]));
  return RAG_HUB_SLUGS.map(s => bySlug.get(s)).filter(Boolean);
}
// ── /topics/agent-memory — the AI-agent memory topic hub ─────────────────────
// The third curated topic hub, mirroring /topics/agent-security and
// /topics/rag-retrieval exactly. Agent memory is one of our densest money-page
// families (types of memory, memory vs RAG, where memory lives, the Mem0/Zep/
// Letta framework choice, forgetting/consolidation, and the LoCoMo/LongMemEval/
// BEAM eval suite) but no page ranked for the broad head term "AI agent memory."
// Same best-media rationale (NYT/Guardian topic pages): one indexable
// CollectionPage that owns the head query, funnels link equity to the spokes,
// and gives readers one ordered path. Order = the memory LIFECYCLE: foundations
// (what memory is) → the architecture call (memory vs RAG) → where it lives
// (storage substrate) → the frameworks → operating it (forgetting/consolidation)
// → evaluation → the essays that frame why it matters. Curated editorially (like
// SECURITY_HUB_SLUGS/RAG_HUB_SLUGS), not a slug regex; slugs validate against the
// corpus at read time so a renamed/removed piece drops out rather than 404-ing.
export const MEMORY_HUB_SLUGS = [
  "types-of-agent-memory",
  "agent-memory-and-state",
  "agent-memory-vs-rag",
  "three-places-to-keep-an-agents-memory",
  "filesystem-vs-vector-database-agent-memory",
  "mem0-vs-zep-vs-letta-agent-memory",
  "langmem-vs-mem0",
  "telemem-vs-mem0",
  "how-ai-agents-forget-memory-consolidation",
  "claude-dreaming-agent-memory-consolidation",
  "how-to-evaluate-ai-agent-memory",
  "how-to-read-an-agent-memory-benchmark",
  "locomo-vs-longmemeval-vs-beam-agent-memory",
  "agent-memory-token-cost-read-vs-write",
  "everyone-ships-agents-no-one-ships-memory",
  "memory-stopped-being-a-layer",
];
// The curated memory pieces as live post objects, in display order, skipping any
// slug not present in the corpus (so the hub never lists a dead link).
export function memoryHub(d = db()) {
  const bySlug = new Map(allPosts(d).map(p => [p.slug, p]));
  return MEMORY_HUB_SLUGS.map(s => bySlug.get(s)).filter(Boolean);
}
// ── /topics/mcp — the Model Context Protocol topic hub ───────────────────────
// The fourth curated topic hub, mirroring /topics/agent-security, /rag-retrieval,
// and /agent-memory exactly. MCP is the single densest cluster in the corpus (the
// protocol itself, its primitives, building/exposing servers, transport & the
// 2026 stateless spec, discovery/registry, authorization & the security top-10,
// benchmarking, and the governance essays) yet no page ranked for the broad head
// term "Model Context Protocol." Same best-media rationale (NYT/Guardian topic
// pages): one indexable CollectionPage that owns the head query, funnels link
// equity to the spokes, and gives readers one ordered path. Order = the MCP
// lifecycle: foundations (what MCP is, vs function calling / REST, the primitives)
// → building (build a server, expose an agent) → transport & spec evolution
// (stdio/SSE/streamable-HTTP → the stateless 2026 spec) → discovery & distribution
// (server cards, the registry, shipping servers as OCI artifacts) → security
// (authorization, the confused deputy, the OWASP top-10)
// → evaluation (benchmarking MCP tool use) → the governance essay. Curated
// editorially (like the other hubs), not a slug regex; slugs validate against the
// corpus at read time so a renamed/removed piece drops out rather than 404-ing.
export const MCP_HUB_SLUGS = [
  "mcp-vs-function-calling",
  "mcp-vs-rest-api-for-agents",
  "2026-06-23-mcp-tools-vs-resources-vs-prompts",
  "how-to-build-an-mcp-server",
  "expose-agent-as-mcp-server",
  "stainless-alternatives-sdk-mcp-generators",
  "mcp-stdio-vs-sse-vs-streamable-http",
  "mcp-goes-stateless-2026-07-28-spec",
  "mcp-server-cards-well-known-discovery",
  "the-official-mcp-registry-explained",
  "agent-registry-vs-mcp-registry-discovery",
  "how-to-distribute-an-mcp-server-oci-vs-registry",
  "2026-06-22-mcp-authorization-oauth",
  "mcp-confused-deputy-problem",
  "owasp-mcp-top-10",
  "mcp-bench-vs-mcptoolbench-vs-mcpagentbench",
  "who-controls-mcp-agentic-ai-foundation",
];
// The curated MCP pieces as live post objects, in display order, skipping any slug
// not present in the corpus (so the hub never lists a dead link).
export function mcpHub(d = db()) {
  const bySlug = new Map(allPosts(d).map(p => [p.slug, p]));
  return MCP_HUB_SLUGS.map(s => bySlug.get(s)).filter(Boolean);
}
// The /topics/agent-frameworks hub — the fifth curated topic hub, mirroring the
// others. Owns the single largest head term in the space ("AI agent framework,"
// "best agent framework," "langgraph vs crewai vs autogen"), funneling link equity
// into the framework money-page family and giving readers one ordered path:
// foundations (do you even need one; why they all converged on a graph) → the major
// head-to-heads → the LangChain/LangGraph ecosystem → orchestration patterns →
// framework-vs-runtime & durable execution → the JS/TS stack. Curated editorially
// (like the other hubs), not a slug regex; slugs validate against the corpus at read
// time so a renamed/removed piece drops out rather than 404-ing.
export const AGENT_FRAMEWORK_HUB_SLUGS = [
  "multi-agent-vs-single-agent",
  "every-ai-agent-framework-became-a-graph",
  "langgraph-vs-crewai-vs-autogen",
  "agno-vs-langgraph-vs-crewai",
  "smolagents-vs-langgraph-vs-crewai",
  "openai-agents-sdk-vs-pydantic-ai-vs-google-adk",
  "claude-agent-sdk-vs-langgraph",
  "google-adk-vs-langgraph",
  "langgraph-vs-microsoft-agent-framework",
  "langchain-vs-langgraph",
  "langchain-1-0-and-langgraph-1-0-whats-new",
  "what-are-deep-agents",
  "multi-agent-orchestration-supervisor-vs-swarm-vs-handoffs",
  "agent-handoffs-langgraph-openai-adk",
  "from-framework-to-harness",
  "langgraph-checkpointing-vs-temporal-durable-execution",
  "mastra-vs-vercel-ai-sdk-vs-langgraph-js",
];
// The curated framework pieces as live post objects, in display order, skipping any
// slug not present in the corpus (so the hub never lists a dead link).
export function frameworksHub(d = db()) {
  const bySlug = new Map(allPosts(d).map(p => [p.slug, p]));
  return AGENT_FRAMEWORK_HUB_SLUGS.map(s => bySlug.get(s)).filter(Boolean);
}
// The /topics/llm-inference hub — the SIXTH curated topic hub, mirroring the other
// five exactly. Inference & Gateways is the corpus's densest money-page family (47
// Wire/Stack pieces — engines, accelerators, serving architecture, KV-cache, decode
// tricks, sampling/tokenization, gateways/routing, latency & cost) yet nothing ranked
// for the broad head term "LLM inference" / "how to serve an LLM." This funnels link
// equity into that family and gives readers one ordered path down the serving
// decision: self-host-vs-API → which engine → which accelerator → throughput/scaling
// → decode & attention acceleration → the KV cache → sampling & tokenization → the
// gateway/router in front → latency & cost operations. Curated editorially (like the
// other hubs), not a slug regex; slugs validate against the corpus at read time so a
// renamed/removed piece drops out rather than 404-ing the rail.
export const INFERENCE_HUB_SLUGS = [
  // self-host vs API — the first fork
  "self-hosting-llm-inference-vs-api-cost",
  // which inference engine
  "2026-06-22-vllm-vs-tensorrt-llm-vs-tgi",
  "vllm-vs-sglang-vs-lmdeploy",
  "nvidia-nim-vs-vllm-vs-tgi-self-hosting-llm-inference",
  "ollama-vs-lm-studio-vs-jan",
  "2026-06-23-mlx-vs-llama-cpp",
  // which accelerator
  "2026-06-22-gpu-for-llm-inference-h100-vs-h200-vs-a100-vs-l40s",
  "b200-vs-h200-vs-h100-llm-inference",
  "amd-mi300x-vs-nvidia-h100-llm-inference",
  "groq-vs-cerebras-vs-sambanova-fast-inference",
  // serving throughput & scaling
  "continuous-batching-vs-static-batching",
  "2026-06-23-prefill-vs-decode-llm-inference",
  "2026-06-23-tensor-parallelism-vs-pipeline-parallelism",
  "2026-06-22-bentoml-vs-ray-serve-vs-kserve",
  // decode & attention acceleration
  "2026-06-22-speculative-decoding-eagle-vs-medusa",
  "mha-vs-mqa-vs-gqa-vs-mla-attention",
  "flashattention-vs-pagedattention-vs-flashinfer",
  // the KV cache
  "2026-06-23-kv-cache-quantization-fp8-vs-int8-vs-int4",
  "kv-cache-eviction-streamingllm-vs-h2o-vs-snapkv-vs-quest",
  "kv-cache-offloading-lmcache-vs-mooncake-vs-dynamo",
  // sampling & tokenization (output control)
  "temperature-vs-top-p-vs-top-k-llm-sampling",
  "tiktoken-vs-sentencepiece-vs-huggingface-tokenizers",
  // the gateway / router in front
  "2026-06-21-litellm-vs-portkey-vs-tensorzero",
  "openrouter-vs-litellm",
  "2026-06-21-routellm-vs-notdiamond-vs-martian",
  // latency & cost operations
  "llm-inference-latency-ttft-vs-tpot",
  "how-to-reduce-ai-agent-latency",
  "how-to-reduce-ai-agent-token-costs",
  "batch-api-vs-real-time-llm-inference",
];
// The curated inference pieces as live post objects, in display order, skipping any
// slug not present in the corpus (so the hub never lists a dead link).
export function inferenceHub(d = db()) {
  const bySlug = new Map(allPosts(d).map(p => [p.slug, p]));
  return INFERENCE_HUB_SLUGS.map(s => bySlug.get(s)).filter(Boolean);
}

// The /topics/agent-evals hub — the SEVENTH curated topic hub, mirroring the six
// before it. After security/RAG/memory/MCP/frameworks/inference each got a head-term
// hub, Evals & Observability is the densest remaining un-hubbed money-page family, yet
// nothing owned the broad head term "AI agent evaluation" / "LLM evals" / "how to
// evaluate an AI agent." This funnels link equity into that family and gives readers
// one ordered path: why-eval → build the eval → the judge (the measurement instrument)
// → evaluate a specific capability → reliability metrics → the standardized benchmarks
// → observability & the eval/tracing platforms in production. Curated editorially (not
// a slug regex); RAG/memory-specific eval pieces stay in their own hubs to avoid
// diluting this one. Slugs validate against the corpus at read time so a renamed or
// removed piece drops out rather than 404-ing the rail.
export const EVAL_HUB_SLUGS = [
  // why you eval at all — the philosophy
  "eval-driven-development-for-ai-agents",
  "the-evals-are-the-product",
  "online-vs-offline-evals-for-ai-agents",
  // building the eval
  "how-to-build-an-llm-eval-dataset",
  "how-to-add-llm-evals-to-ci-cd",
  // the judge — the measurement instrument
  "2026-06-21-llm-as-a-judge",
  "llm-judge-bias",
  "agent-as-a-judge-vs-llm-as-a-judge-trajectory-evals",
  // evaluating a specific agent capability
  "2026-06-24-how-to-evaluate-an-ai-agents-tool-use",
  "how-to-evaluate-an-ai-coding-agent",
  "how-to-evaluate-a-deep-research-agent",
  "how-to-evaluate-a-voice-agent",
  // reliability metrics & methodology
  "2026-06-27-pass-at-k-vs-pass-hat-k-agent-reliability-evals",
  "cost-aware-agent-evaluation",
  // the standardized benchmarks
  "swe-bench-vs-tau-bench-vs-gaia",
  "swe-bench-pro-vs-swe-bench-verified",
  "terminal-bench-vs-swe-bench",
  "tau-bench-vs-tau2-bench",
  "swe-evo-vs-swe-bench-long-horizon-coding-agents",
  "gaia2-benchmark-asynchronous-agents",
  "benchmarks-are-theater-now",
  // observability & the eval/tracing platforms in production
  "how-to-monitor-an-ai-agent-in-production",
  "the-trace-is-the-new-log",
  "openllmetry-vs-openinference-otel-llm-observability",
  "langfuse-vs-langsmith-vs-phoenix-observability",
  "2026-06-26-langfuse-vs-langsmith-vs-braintrust",
  "braintrust-vs-arize-vs-opik-llm-eval-platforms",
  "deepeval-vs-ragas-vs-promptfoo",
  "prompt-management-langfuse-vs-promptlayer-vs-agenta",
];
// The curated eval/observability pieces as live post objects, in display order,
// skipping any slug not present in the corpus (so the hub never lists a dead link).
export function evalsHub(d = db()) {
  const bySlug = new Map(allPosts(d).map(p => [p.slug, p]));
  return EVAL_HUB_SLUGS.map(s => bySlug.get(s)).filter(Boolean);
}
// The /topics/coding-agents hub — the EIGHTH curated topic hub, mirroring the seven
// before it. After security/RAG/memory/MCP/frameworks/inference/evals each got a
// head-term hub, Coding Agents & IDEs was the densest remaining un-hubbed money-page
// family (16 pieces), yet nothing owned the enormous head term "AI coding agent" /
// "best AI coding assistant" / "Cursor vs Claude Code." This funnels link equity into
// that family and gives readers one ordered path: the IDE assistants → the CLI agents
// → the agentic IDEs → autonomous/background agents → the open-source agents → the app
// builders → HOW the edit happens (edit formats, fast-apply) → how you steer them
// (spec-driven, AGENTS.md/CLAUDE.md) → review & parallelism → measuring one → the
// security surface. Curated editorially (not a slug regex); slugs validate against the
// corpus at read time so a renamed or removed piece drops out rather than 404-ing.
export const CODING_HUB_SLUGS = [
  // the head comparison — which assistant in your editor
  "cursor-vs-windsurf-vs-github-copilot-vs-claude-code",
  // the terminal-native CLI agents
  "claude-code-vs-codex-cli-vs-gemini-cli",
  // the agentic IDEs
  "google-antigravity-vs-cursor-vs-claude-code",
  // autonomous / background agents
  "devin-vs-codex-vs-cursor-vs-jules-background-agents",
  // the open-source coding agents
  "aider-vs-cline-vs-openhands",
  "cline-vs-roo-code-vs-kilo-code",
  // the AI app builders (prompt → running app)
  "lovable-vs-bolt-vs-v0-vs-replit-ai-app-builder",
  // HOW the edit actually lands
  "coding-agent-edit-formats-diff-vs-whole-file",
  "fast-apply-models-morph-vs-relace-vs-cursor",
  // how you steer the agent
  "spec-driven-development-spec-kit-vs-kiro-vs-tessl",
  "agents-md-vs-claude-md",
  "does-agents-md-actually-help-coding-agents",
  // review & parallelism
  "coderabbit-vs-greptile-vs-qodo-ai-code-review",
  "git-worktrees-for-parallel-ai-agents",
  // measuring one
  "how-to-evaluate-an-ai-coding-agent",
  // the security surface
  "amazon-q-rce-coding-agent-folder-trust",
];
// The curated coding-agent pieces as live post objects, in display order, skipping any
// slug not present in the corpus (so the hub never lists a dead link).
export function codingHub(d = db()) {
  const bySlug = new Map(allPosts(d).map(p => [p.slug, p]));
  return CODING_HUB_SLUGS.map(s => bySlug.get(s)).filter(Boolean);
}
// On-article "Concepts" rail for a concept-explainer page: its sibling explainers
// in the curated family, excluding self. Returns { label, posts, slug } (same
// shape as clusterSiblings) or null when `slug` isn't a concept or has no
// siblings. This is the orphaned explainers' equivalent of the comparison rail —
// it homes the definitional pages into the link graph and cross-links the family.
export function conceptSiblings(slug, limit = 4, d = db()) {
  if (!CONCEPT_SLUGS.includes(slug)) return null;
  const posts = concepts(d).filter(p => p.slug !== slug).slice(0, limit);
  return posts.length ? { label: "Concepts", posts, slug: "concepts" } : null;
}
// "Continue reading" recommendations. Prefer pieces that share a voice tag —
// across sections — so a cynical Wire piece can surface a cynical Dispatch,
// then fall back to same-section, then most-recent. Returns up to `limit`.
// The publication's voice tags (reportive/cynical/…) carry no TOPIC signal, so
// scoring relatedness by them alone clusters a RAG comparison with a satire piece
// as readily as with another RAG piece. For a demand-shaped, topic-cluster growth
// strategy that's backwards. `topicTokens` pulls the meaningful nouns out of a
// post's slug + title (slugs are query-shaped — "best-chunking-strategy-for-rag")
// minus the publication's generic vocabulary, so two pieces about the same subject
// actually find each other.
const TOPIC_STOP = new Set([
  "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "at", "by", "with",
  "your", "you", "vs", "versus", "is", "are", "be", "what", "why", "how", "when",
  "which", "best", "guide", "ai", "agent", "agents", "llm", "llms", "2024", "2025",
  "2026", "new", "actually", "from",
  // publication-FORMAT words, not topics: an "…, Explained" headline is a house
  // packaging convention the corpus uses across wholly unrelated subjects (MCP
  // auth, speculative decoding, OWASP, web-bot-auth, …). Left un-stopped, the bare
  // token "explained" overlaps (×6) between any two such pieces and falsely binds
  // them as a topic cluster — same failure "best"/"guide" are stopped for. Genuine
  // siblings still find each other on their real subject tokens (two "…, Explained"
  // MCP pieces share "mcp"), so dropping the format word is pure noise removal.
  "explained", "explainer",
]);
function topicTokens(p) {
  const raw = `${p.slug || ""} ${p.title || ""}`.toLowerCase();
  const out = new Set();
  for (const t of raw.match(/[a-z0-9][a-z0-9'+.-]*/g) || []) {
    const w = t.replace(/^[-'+.]+|[-'+.]+$/g, "");
    if (w.length > 2 && !TOPIC_STOP.has(w)) out.add(w);
  }
  return out;
}

export function relatedTo(slug, limit = 3, d = db()) {
  const all = allPosts(d);                 // date-DESC, slug-DESC
  const post = all.find(p => p.slug === slug);
  if (!post) return [];
  const tags = new Set((post.tags || []).map(t => String(t).trim().toLowerCase()));
  const topic = topicTokens(post);
  const score = (p) => {
    const shared = (p.tags || []).reduce((n, t) => n + (tags.has(String(t).trim().toLowerCase()) ? 1 : 0), 0);
    let overlap = 0;
    for (const w of topicTokens(p)) if (topic.has(w)) overlap++;
    // topic overlap dominates (the cluster signal), then voice tag, then section.
    return overlap * 6 + shared * 3 + (p.section === post.section ? 1 : 0);
  };
  // V8's Array.sort is stable, so equal scores keep the date-DESC order.
  return all.filter(p => p.slug !== slug)
    .map(p => [p, score(p)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(0, limit))
    .map(([p]) => p);
}
// Backlinks: posts whose body prose links to `slug` (a /posts/<slug>.html href).
// Surfaces the inbound internal-link graph the demand-piece cluster now generates
// — a "Referenced in" rail that deepens dwell time and spreads link equity to the
// cited piece. Matches the canonical href only, so a bare slug mention doesn't
// count; newest-citing first. Returns [] when nothing links in.
export function citedBy(slug, d = db()) {
  const s = String(slug || "").trim();
  if (!s) return [];
  const needle = `href="/posts/${s}.html"`;
  return allPosts(d)
    .filter(p => p.slug !== s && typeof p.body_html === "string" && p.body_html.includes(needle))
    .map(({ slug, title, section, date }) => ({ slug, title, section, date }));
}
// posts carrying a given voice tag (case-insensitive); tags live as a JSON array
export function postsByTag(tag, d = db()) {
  const t = String(tag || "").trim().toLowerCase();
  if (!t) return [];
  return allPosts(d).filter(p => p.tags.some(x => String(x).trim().toLowerCase() === t));
}
// every tag in use, with how many posts carry it (most-used first)
export function allTags(d = db()) {
  const m = new Map();
  for (const p of allPosts(d)) {
    for (const raw of p.tags) {
      const t = String(raw).trim().toLowerCase();
      if (t) m.set(t, (m.get(t) || 0) + 1);
    }
  }
  return [...m.entries()].map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
export function countPosts(d = db()) {
  return d.prepare("SELECT COUNT(*) c FROM posts").get().c;
}

export function search(q, d = db()) {
  if (!q || !q.trim()) return [];
  const term = q.trim().replace(/["']/g, "").split(/\s+/).map((w) => `${w}*`).join(" ");
  try {
    // snippet() pulls a contextual fragment from body_text (column 3), wrapping
    // matched terms in STX/ETX sentinels (char 2/3) so the render layer can
    // escape the text and only then promote the sentinels to <mark> — no XSS.
    // Rank with column-weighted BM25 instead of the bare `rank` (which weights
    // every column equally). The FTS columns are (slug, title, dek, body_text,
    // section); a query term landing in the TITLE or DEK is a far stronger relevance
    // signal than the same term buried in the body — searching "langgraph" should
    // surface the `langgraph-vs-crewai` money page above a piece that merely
    // name-drops it once in a paragraph. Weight title 10x and dek 5x over body;
    // slug/section are UNINDEXED (can't match), so their weights are inert
    // placeholders that keep the positional argument list aligned with column order.
    // bm25() returns more-negative scores for better matches, so the default
    // ascending ORDER BY puts the strongest title/dek hits first.
    const rows = d.prepare(
      `SELECT p.*, snippet(posts_fts, 3, char(2), char(3), '…', 14) AS _snip
       FROM posts_fts f JOIN posts p ON p.slug = f.slug
       WHERE posts_fts MATCH ?
       ORDER BY bm25(posts_fts, 0.0, 10.0, 5.0, 1.0, 0.0) LIMIT 30`).all(term);
    return rows.map(({ _snip, ...row }) => {
      const h = hydrate(row);
      h.snippet = _snip || "";
      return h;
    });
  } catch { return []; }
}

// ── view counters ────────────────────────────────────────────────────────────
export function bumpView(slug, d = db()) {
  d.prepare(`INSERT INTO views (slug,count) VALUES (?,1)
             ON CONFLICT(slug) DO UPDATE SET count = count + 1`).run(slug);
  return d.prepare("SELECT count FROM views WHERE slug = ?").get(slug)?.count || 0;
}
export function getViews(slug, d = db()) {
  return d.prepare("SELECT count FROM views WHERE slug = ?").get(slug)?.count || 0;
}
export function totalViews(d = db()) {
  return d.prepare("SELECT COALESCE(SUM(count),0) t FROM views").get().t;
}

// ── submissions ──────────────────────────────────────────────────────────────
export function addSubmission(s, d = db()) {
  const info = d.prepare(`INSERT INTO submissions (slug,title,section,author,payload,status,created)
    VALUES (?,?,?,?,?, 'pending', ?)`).run(
    s.slug, s.title, s.section, s.author, JSON.stringify(s), new Date(0).toISOString());
  return info.lastInsertRowid;
}
export function listSubmissions(d = db()) {
  return d.prepare("SELECT id,slug,title,section,author,status,created FROM submissions ORDER BY id DESC").all();
}
