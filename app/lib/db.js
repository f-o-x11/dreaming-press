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
      figures TEXT, updated TEXT, faq TEXT, compare TEXT
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
  for (const [col, type] of [["summary", "TEXT"], ["art", "TEXT"], ["audio_bytes", "INTEGER DEFAULT 0"], ["series", "TEXT"], ["series_order", "INTEGER"], ["figures", "TEXT"], ["updated", "TEXT"], ["faq", "TEXT"], ["compare", "TEXT"]]) {
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
  (slug,title,dek,author,section,date,tags,sources,featured,body_html,body_text,source,read_time,has_audio,summary,art,audio_bytes,series,series_order,figures,updated,faq,compare)
  VALUES (@slug,@title,@dek,@author,@section,@date,@tags,@sources,@featured,@body_html,@body_text,@source,@read_time,@has_audio,@summary,@art,@audio_bytes,@series,@series_order,@figures,@updated,@faq,@compare)`);
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
  ["RAG & Retrieval",        /(^|-)(rag|graphrag|chunking|embedding|embeddings|reranker|retrieval|hybrid|semantic-search|semantic-caching|bm25|lexical|vector|pgvector|pinecone|qdrant|neo4j|falkordb|memgraph|graph-database|knowledge-graph|long-context|hnsw|ivf|ivfflat|diskann)(-|$)/],
  // Placed AFTER RAG so "fine-tuning-vs-rag" and "…-quantization-embeddings" stay
  // in retrieval (first-match-wins), but the training-method/PEFT/quantization
  // money pages (lora/qlora, dpo/ppo/orpo, unsloth/axolotl, gguf/gptq/awq) get
  // their own home + sibling rail instead of falling to the catch-all.
  // RL post-training frameworks (verl/OpenRLHF/TRL) + the GRPO vocab live here too:
  // they're the tooling layer for the alignment/RL methods already in this cluster,
  // so the framework money page rails with dpo-vs-ppo-vs-orpo and lora-vs-qlora.
  ["Fine-Tuning & Training", /(^|-)(lora|qlora|dpo|ppo|orpo|kto|simpo|grpo|rlhf|verl|openrlhf|trl|peft|unsloth|axolotl|torchtune|gguf|gptq|awq|fine-tuning|finetuning|fine-tune|quantization)(-|$)/],
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
  ["Agent Frameworks",       /(^|-)(framework|frameworks|langgraph|crewai|autogen|langchain|llamaindex|pydantic|adk|harness)(-|$)/],
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
  ["Coding Agents & IDEs",   /(^|-)(cursor|windsurf|copilot|claude-code|aider|cline|openhands|devin|codex|agents-md|claude-md)(-|$)/],
  // Python LLM/agent UI frameworks (Streamlit/Gradio/Chainlit) are the build-a-UI
  // layer alongside the React agent-UI libraries (CopilotKit/assistant-ui). Their
  // tokens appear in no earlier cluster slug, so first-match-wins keeps coding-tool
  // and other pieces put while the Python-UI money page rails with the frontend cluster.
  ["Agent UI & Frontend",    /(^|-)(copilotkit|copilot|assistant-ui|ag-ui|chat-ui|frontend|streamlit|gradio|chainlit)(-|$)/],
  ["Agent Memory",           /(^|-)(memory|mem0|zep|letta)(-|$)/],
  // Managed/remote browser INFRASTRUCTURE (Browserbase/Steel/Browserless) is the
  // layer that runs the actual Chromium an agent drives — distinct from the
  // automation *framework* (browser-use/Stagehand/Playwright) but the same demand
  // cluster. Their product names don't contain a bare `browser` token (the word
  // boundary in `browser` won't match `browserbase`/`browserless`), so add them
  // explicitly so the infra comparison rails with the framework comparison.
  ["Web, Search & Browsing", /(^|-)(browser|browserbase|browserless|steel|stagehand|playwright|firecrawl|crawl4ai|jina|search|tavily|exa|linkup|scrape|web)(-|$)/],
  // Agent tool-integration / tool-auth platforms (Composio/Arcade/Toolhouse) are
  // the layer that PROVIDES third-party integrations + owns the per-user OAuth
  // credential vault — the gap MCP's protocol left open (auth on-behalf-of-user).
  // They rail with the MCP-gateway / mcp-vs-function-calling / mcp-auth pieces, so
  // their product-name tokens live here. None appears in an earlier cluster's slugs,
  // so first-match-wins poaches nothing.
  ["Protocols (MCP & A2A)",  /(^|-)(mcp|a2a|function-calling|protocol|composio|arcade|toolhouse)(-|$)/],
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
  ["Evals & Observability",  /(^|-)(eval|evals|deepeval|ragas|promptfoo|benchmark|benchmarks|swe-bench|tau-bench|gaia|observability|langfuse|langsmith|phoenix|trace|tracing|otel|opentelemetry|openllmetry|openinference|instrumentation|hallucination|hallucinations|garak|pyrit|red-team|red-teaming)(-|$)/],
  // Self-hosted model-*serving frameworks* (BentoML/Ray Serve/KServe) wrap an
  // inference engine and orchestrate it — same demand cluster as the engines and
  // gateways. Their slug tokens (bentoml/serve/kserve/triton/seldon/serving) appear
  // in no earlier cluster, so first-match-wins keeps prior pieces put while the
  // serving-framework money page rails with vllm-vs-tensorrt-llm-vs-tgi.
  // Inference *economics* — the batch-vs-realtime serving-tier / cost decision — is
  // the same demand cluster: it's a "how do I run inference" choice that rails with
  // the gateways (litellm/portkey) that route between those tiers. `batch`/`realtime`
  // appear in no other comparison slug, so first-match-wins poaches nothing.
  ["Inference & Gateways",   /(^|-)(inference|vllm|sglang|ollama|tensorrt|trt|tgi|gateway|litellm|portkey|tensorzero|routing|router|routellm|notdiamond|martian|bentoml|serve|serving|kserve|triton|seldon|batch|realtime)(-|$)/],
  ["Sandboxes & Runtime",    /(^|-)(sandbox|sandboxes|e2b|modal|daytona|durable|temporal|inngest|restate)(-|$)/],
  ["Voice Agents",           /(^|-)(voice|livekit|pipecat|vapi)(-|$)/],
  ["Guardrails & Safety",    /(^|-)(guardrail|guardrails|nemo|llama-guard|guard|injection)(-|$)/],
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
  ["Agent Reasoning & Planning", /(^|-)(react|reflexion|reasoning|planning|plan-and-execute|plan-and-solve|rewoo|llmcompiler|cot|tot|chain-of-thought|tree-of-thought|sleep-time|test-time|workflow|workflows)(-|$)/],
  ["Prompts & Optimization", /(^|-)(dspy|textgrad|adalflow|prompt|context-engineering|caching)(-|$)/],
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
  ["Models & LLM APIs",      /(^|-)(gpt|claude|gemini|qwen|deepseek|gemma|small-language-models|mixture-of-experts|closed|responses-api|assistants-api|chat-completions)(-|$)/],
];
const COMPARISON_CATCHALL = "More comparisons";
// a demand piece is a Wire/Stack "…-vs-…" comparison, a "best-…" guide, or a
// "how-to-…" guide — all three are high-intent decision/guide queries the hub
// exists to collect. ("how-to-" is the only safe non-comparison prefix to admit:
// it's an unambiguous guide signal, where the desk's metaphorical essay slugs
// ("the-megawatt-you-cannot-rent") are not, so it can't drag commentary in.)
function isComparisonPost(p) {
  if (p.section !== "wire" && p.section !== "stack") return false;
  const s = String(p.slug || "").replace(/^\d{4}-\d\d-\d\d-/, "");
  return /(^|-)vs(-|$)/.test(s) || s.startsWith("best-") || s.startsWith("how-to-");
}
// the single topic cluster a demand piece belongs to (or null if it isn't a
// comparison). Shared by the /comparisons hub and the on-article sibling rail so
// the two surfaces can never disagree about which cluster a piece is in.
function clusterLabelFor(p) {
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
// is this cluster worth its own indexable page? The "More comparisons" catch-all
// is a deliberately incoherent grab-bag (mixed topics), so it stays a hub section
// only — a standalone page over it would be thin, off-topic content.
function clusterIsIndexable(label) { return label !== COMPARISON_CATCHALL; }
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
    .map(([label, posts]) => ({ label, posts, slug: clusterSlug(label), indexable: clusterIsIndexable(label) }));
}
// One comparison cluster by its url slug, for the dedicated /comparisons/:slug
// page. Returns { label, posts, slug, indexable } or null when the slug doesn't
// match an indexable cluster (unknown slug, or the non-indexable catch-all).
export function comparisonClusterBySlug(slug, d = db()) {
  const c = comparisonClusters(d).find(c => c.slug === slug);
  return c && c.indexable ? c : null;
}
// Sibling demand pieces in the SAME comparison cluster as `slug` — the on-article
// "More in <cluster>" rail (Wirecutter "more from this guide"). Returns
// { label, posts } newest-first excluding self, or null when the piece isn't a
// demand comparison, sits in the incoherent "More comparisons" catch-all, or has
// no siblings. Reuses `clusterLabelFor`, so it tracks the /comparisons hub exactly.
// This is the on-article complement to that hub: it keeps a reader inside one
// money cluster and tightens the internal-link graph where the demand corpus lives.
export function clusterSiblings(slug, limit = 4, d = db()) {
  const posts = allPosts(d);
  const self = posts.find(p => p.slug === slug);
  if (!self) return null;
  const label = clusterLabelFor(self);
  if (!label || label === COMPARISON_CATCHALL) return null;
  const sibs = posts.filter(p => p.slug !== slug && clusterLabelFor(p) === label).slice(0, limit);
  return sibs.length ? { label, posts: sibs, slug: clusterSlug(label) } : null;
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
    const rows = d.prepare(
      `SELECT p.*, snippet(posts_fts, 3, char(2), char(3), '…', 14) AS _snip
       FROM posts_fts f JOIN posts p ON p.slug = f.slug
       WHERE posts_fts MATCH ? ORDER BY rank LIMIT 30`).all(term);
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
