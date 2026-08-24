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
    -- agent subscriptions: an AI agent registers a webhook (push) or an email
    -- to be notified of new posts, and gets a poll cursor to pull. Separate from
    -- the human newsletter (subscribers). agent_dispatched tracks which posts have
    -- been broadcast to webhooks, mirroring the email dispatch pattern.
    CREATE TABLE IF NOT EXISTS agent_subs (
      id TEXT PRIMARY KEY, kind TEXT, endpoint TEXT, sections TEXT,
      format TEXT DEFAULT 'json', token TEXT, created TEXT,
      last_notified TEXT, active INTEGER DEFAULT 1, failures INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS agent_dispatched (
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
      stars INTEGER DEFAULT 0, pushed_at TEXT, synced_at TEXT,
      kind TEXT, one_liner TEXT, website TEXT, docs_url TEXT, signup_url TEXT,
      pricing_model TEXT, pricing_note TEXT, auth_type TEXT,
      agent_signup TEXT, agent_signup_note TEXT, mcp_server TEXT,
      sdks TEXT, code_sample TEXT, tags TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tools_category ON tools(category);
    -- daily star snapshots → original momentum/trend data ("fastest-growing
    -- framework this quarter") that no one else has (GEO #7). One row per tool/day.
    CREATE TABLE IF NOT EXISTS tool_star_snapshots (
      slug TEXT, day TEXT, stars INTEGER, PRIMARY KEY (slug, day)
    );
  `);
  // migrations for databases created before a column existed (ALTER is idempotent-guarded)
  for (const [col, type] of [["summary", "TEXT"], ["art", "TEXT"], ["audio_bytes", "INTEGER DEFAULT 0"], ["series", "TEXT"], ["series_order", "INTEGER"], ["figures", "TEXT"], ["updated", "TEXT"], ["faq", "TEXT"], ["compare", "TEXT"], ["canonical", "TEXT"], ["update_note", "TEXT"]]) {
    try { d.exec(`ALTER TABLE posts ADD COLUMN ${col} ${type}`); } catch { /* already present */ }
  }
  for (const [col, type] of [["channel", "TEXT"], ["ref", "TEXT"], ["sid", "TEXT"], ["device", "TEXT"]]) {
    try { d.exec(`ALTER TABLE events ADD COLUMN ${col} ${type}`); } catch { /* already present */ }
  }
  // tools grew from OSS-repo-only to also cover API services (website/signup/pricing/
  // auth/agent-signup/MCP/code-sample) — additive columns for pre-existing DBs.
  for (const col of ["kind", "one_liner", "website", "docs_url", "signup_url", "pricing_model",
    "pricing_note", "auth_type", "agent_signup", "agent_signup_note", "mcp_server", "sdks", "code_sample", "tags"]) {
    try { d.exec(`ALTER TABLE tools ADD COLUMN ${col} TEXT`); } catch { /* already present */ }
  }
  seedTools(d);
}

// ── tools/entities catalog (#16) — the data-backed Stack engine ────────────────
// Seed the static catalog; preserve live star/pushed_at that sync-tools.js writes.
export function seedTools(d = db()) {
  const stmt = d.prepare(`INSERT INTO tools (slug,name,owner,repo,category,lang,blurb,use_cases,alternatives,stars,
      kind,one_liner,website,docs_url,signup_url,pricing_model,pricing_note,auth_type,agent_signup,agent_signup_note,mcp_server,sdks,code_sample,tags)
    VALUES (@slug,@name,@owner,@repo,@category,@lang,@blurb,@use_cases,@alternatives,@stars,
      @kind,@one_liner,@website,@docs_url,@signup_url,@pricing_model,@pricing_note,@auth_type,@agent_signup,@agent_signup_note,@mcp_server,@sdks,@code_sample,@tags)
    ON CONFLICT(slug) DO UPDATE SET
      name=@name, owner=@owner, repo=@repo, category=@category, lang=@lang,
      blurb=@blurb, use_cases=@use_cases, alternatives=@alternatives,
      stars=MAX(tools.stars, @stars),
      kind=@kind, one_liner=@one_liner, website=@website, docs_url=@docs_url, signup_url=@signup_url,
      pricing_model=@pricing_model, pricing_note=@pricing_note, auth_type=@auth_type,
      agent_signup=@agent_signup, agent_signup_note=@agent_signup_note, mcp_server=@mcp_server,
      sdks=@sdks, code_sample=@code_sample, tags=@tags`);
  const tx = d.transaction(() => {
    for (const t of TOOLS) stmt.run({
      slug: t.slug, name: t.name, owner: t.owner || null, repo: t.repo || null, category: t.category,
      lang: t.lang || "", blurb: t.blurb || t.oneLiner || "", use_cases: JSON.stringify(t.useCases || []),
      alternatives: JSON.stringify(t.alternatives || []), stars: t.stars || 0,
      kind: t.kind || (t.repo ? "oss" : "api"), one_liner: t.oneLiner || t.blurb || "",
      website: t.website || (t.owner && t.repo ? `https://github.com/${t.owner}/${t.repo}` : ""),
      docs_url: t.docsUrl || "", signup_url: t.signupUrl || "",
      pricing_model: t.pricingModel || (t.repo ? "open-source" : ""), pricing_note: t.pricingNote || "",
      auth_type: t.authType || "", agent_signup: t.agentSignup || "", agent_signup_note: t.agentSignupNote || "",
      mcp_server: t.mcpServer || "", sdks: JSON.stringify(t.sdks || []),
      code_sample: t.codeSample ? JSON.stringify(t.codeSample) : "", tags: JSON.stringify(t.tags || []),
    });
  });
  tx();
}
function hydrateTool(r) {
  if (!r) return null;
  const j = (v, f) => { try { return JSON.parse(v || f); } catch { return JSON.parse(f); } };
  return { ...r,
    useCases: j(r.use_cases, "[]"), alternatives: j(r.alternatives, "[]"),
    sdks: j(r.sdks, "[]"), tags: j(r.tags, "[]"),
    codeSample: r.code_sample ? j(r.code_sample, "null") : null,
    // camelCase mirrors for renderers, falling back to the OSS-repo shape
    kind: r.kind || (r.repo ? "oss" : "api"),
    oneLiner: r.one_liner || r.blurb || "",
    website: r.website || (r.owner && r.repo ? `https://github.com/${r.owner}/${r.repo}` : ""),
    docsUrl: r.docs_url || "", signupUrl: r.signup_url || "",
    pricingModel: r.pricing_model || "", pricingNote: r.pricing_note || "",
    authType: r.auth_type || "", agentSignup: r.agent_signup || "", agentSignupNote: r.agent_signup_note || "",
    mcpServer: r.mcp_server || "",
  };
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
  const n = Number(stars) || 0;
  d.prepare("UPDATE tools SET stars = ?, pushed_at = ?, synced_at = ? WHERE slug = ?")
    .run(n, pushedAt || null, new Date().toISOString(), String(slug));
  // append today's snapshot (idempotent per day) so a star time-series accumulates
  const day = new Date().toISOString().slice(0, 10);
  d.prepare("INSERT INTO tool_star_snapshots (slug, day, stars) VALUES (?, ?, ?) ON CONFLICT(slug, day) DO UPDATE SET stars = excluded.stars")
    .run(String(slug), day, n);
}
// Record today's star count for EVERY tool from the current DB (idempotent per
// day), independent of whether a fresh GitHub fetch happened this run — guarantees
// a daily data point so the momentum series never stalls.
export function snapshotAllStars(d = db()) {
  const day = new Date().toISOString().slice(0, 10);
  const ins = d.prepare("INSERT INTO tool_star_snapshots (slug, day, stars) VALUES (?, ?, ?) ON CONFLICT(slug, day) DO UPDATE SET stars = excluded.stars");
  const rows = d.prepare("SELECT slug, stars FROM tools").all();
  const tx = d.transaction(() => { for (const r of rows) ins.run(r.slug, day, r.stars || 0); });
  tx();
  return rows.length;
}
// star momentum over a window: [{slug, name, stars, gain, pct}] fastest-growing first.
// Returns [] until at least two days of snapshots exist.
export function toolMomentum({ days = 30, limit = 10 } = {}, d = db()) {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const rows = d.prepare(`
    SELECT s.slug, t.name, t.stars AS stars,
           (SELECT stars FROM tool_star_snapshots WHERE slug = s.slug AND day >= ? ORDER BY day ASC LIMIT 1) AS then_stars
    FROM (SELECT DISTINCT slug FROM tool_star_snapshots) s JOIN tools t ON t.slug = s.slug`).all(since);
  return rows.filter(r => r.then_stars != null && r.stars > r.then_stars)
    .map(r => ({ slug: r.slug, name: r.name, stars: r.stars, gain: r.stars - r.then_stars, pct: +(100 * (r.stars - r.then_stars) / Math.max(1, r.then_stars)).toFixed(1) }))
    .sort((a, b) => b.gain - a.gain).slice(0, limit);
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
// AI answer-engines are dreaming.press's real front door (the council's finding:
// Yuanbao + Baidu already send traffic but were mislabeled "referral"/"organic",
// so the working channel was invisible). This ordered map identifies the specific
// assistant from a referrer host — Western AND Chinese engines — so the dashboard
// can split "ai" per source. Order matters: assistant subdomains are checked
// before their parent search domain (chat.baidu before baidu; copilot before bing).
const ASSISTANTS = [
  [/chatgpt\.com|chat\.openai|(^|\.)openai\.com|oai-|searchbot/, "ChatGPT"],
  [/perplexity\.ai|pplx\./, "Perplexity"],
  [/claude\.ai|anthropic\.com/, "Claude"],
  [/gemini\.google|bard\.google|(^|\.)aistudio\.google/, "Gemini"],
  [/copilot\.microsoft|bing\.com\/chat|edgeservices/, "Copilot"],
  [/yuanbao\.tencent|hunyuan/, "Yuanbao"],
  [/doubao\.com|volcengine/, "Doubao"],
  [/kimi\.(moonshot|com|ai)|moonshot/, "Kimi"],
  [/chat\.deepseek|(^|\.)deepseek\.com/, "DeepSeek"],
  [/tongyi\.|qianwen|bailian\.aliyun/, "Tongyi"],
  [/chat\.baidu|baidu\.com\/(chat|ai)|ernie|wenxin/, "Baidu AI"],
  [/metaso\.cn/, "Metaso"],
  [/(^|\.)you\.com/, "You.com"],
  [/phind\.com/, "Phind"],
  [/poe\.com/, "Poe"],
  [/(^|\.)x\.ai|grok\./, "Grok"],
  [/chat\.mistral|lechat|(^|\.)mistral\.ai/, "Le Chat"],
  [/felo\.ai/, "Felo"],
  [/genspark\.ai/, "Genspark"],
];

// The specific AI assistant behind a referrer, or null. Also used to attribute
// AI-crawler fetches server-side (OAI-SearchBot, PerplexityBot) to a source.
export function classifyAssistant(ref = "") {
  const r = String(ref || "").toLowerCase();
  for (const [re, name] of ASSISTANTS) if (re.test(r)) return name;
  return null;
}

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
  if (classifyAssistant(r)) return "ai";
  // search engines (organic) — now incl. Baidu, Naver, Sogou, 360, Seznam, Yandex
  if (/google\.|bing\.|duckduckgo|search\.brave|ecosia|yahoo|yandex|(^|\.)baidu\.com|naver\.|sogou\.|so\.com|seznam\./.test(r)) return "organic";
  if (/reddit|news\.ycombinator|twitter|x\.com|t\.co|linkedin|facebook|mastodon|bsky|lobste|news\.google/.test(r)) return "social";
  try { const h = new URL(r).host; if (h && !h.includes("dreaming.press")) return "referral"; } catch { /* not a url */ }
  return "direct";
}

// ── engagement events ──────────────────────────────────────────────────────────
// types: view, read (scrolled/dwelled), audio_play, audio_complete, complete
// "nav" = a click on an internal link, tagged with the SURFACE that produced it.
// Every channel sits at ~1.0 pages/session while articles carry 124 internal
// links, so the constraint is not link supply — and without knowing which
// surfaces earn clicks, every fix for that is a guess.
const EVENT_TYPES = new Set(["view", "read", "audio_play", "audio_complete", "complete", "scroll", "dwell", "nav"]);
// Public per-article metrics ("read X times · avg Y on page") — radical
// transparency: every article shows its real engagement. avgDwell is foreground
// time-on-page from the beacon; reads are 75%-scroll/45s-dwell events.
export function articleMetrics(slug, d = db()) {
  const e = d.prepare(`SELECT
      SUM(CASE WHEN type='read' THEN 1 ELSE 0 END) AS reads,
      SUM(CASE WHEN type IN ('complete','audio_complete') THEN 1 ELSE 0 END) AS completes,
      SUM(CASE WHEN type='audio_play' THEN 1 ELSE 0 END) AS audioPlays,
      AVG(CASE WHEN type='dwell' AND ms > 0 THEN ms END) AS avgDwellMs,
      SUM(CASE WHEN type='dwell' THEN 1 ELSE 0 END) AS dwellN
    FROM events WHERE slug = ?`).get(String(slug)) || {};
  return {
    views: getViews(String(slug), d),
    reads: e.reads || 0, completes: e.completes || 0,
    audioPlays: e.audioPlays || 0,
    avgDwellSec: e.avgDwellMs ? Math.round(e.avgDwellMs / 1000) : 0,
    dwellSamples: e.dwellN || 0,
    corpusAvgViews: avgArticleViews(d),
  };
}
// Mean views across all read articles — powers the article-foot "vs. average
// article" transparency tile. Cached ~60s so the per-post articleMetrics loop
// (server.js digest) doesn't re-aggregate the corpus 30×.
let _avgViewsCache = { at: 0, val: 0 };
export function avgArticleViews(d = db()) {
  const now = Date.now();
  if (now - _avgViewsCache.at > 60000) {
    const r = d.prepare("SELECT AVG(count) a FROM views WHERE count > 0").get() || {};
    _avgViewsCache = { at: now, val: r.a ? Math.round(r.a) : 0 };
  }
  return _avgViewsCache.val;
}
// Attach public engagement (reads + raw views) to a list of posts in ONE grouped
// query, so cards/rows can show metric chips (Move 7: metrics everywhere a click
// decision happens). Cached ~60s — list pages render hot without re-aggregating.
let _mCache = { at: 0, reads: null, views: null, dwell: null };
export function attachMetrics(posts, d = db()) {
  const now = Date.now();
  if (!_mCache.reads || now - _mCache.at > 60000) {
    _mCache = {
      at: now,
      reads: new Map(d.prepare("SELECT slug, COUNT(*) c FROM events WHERE type='read' GROUP BY slug").all().map(r => [r.slug, r.c])),
      views: new Map(d.prepare("SELECT slug, count FROM views").all().map(r => [r.slug, r.count])),
      // Per-slug foreground time-on-page (same 'dwell' beacon articleMetrics uses),
      // so a list/digest row can show the honest "avg M:SS" the design asks for
      // without a per-row query. One grouped aggregate, cached with the rest.
      dwell: new Map(d.prepare("SELECT slug, AVG(ms) a FROM events WHERE type='dwell' AND ms > 0 GROUP BY slug").all().map(r => [r.slug, r.a])),
    };
  }
  for (const p of posts) {
    p.reads = _mCache.reads.get(p.slug) || 0;
    p.viewCount = _mCache.views.get(p.slug) || 0;
    const dm = _mCache.dwell.get(p.slug);
    p.avgReadSec = dm ? Math.round(dm / 1000) : 0;
  }
  return posts;
}

export function recordEvent(slug, type, ms, now, meta = {}, d) {
  // backward-compat: legacy callers pass the db as the 5th arg (slug,type,ms,now,d)
  if (meta && typeof meta.prepare === "function") { d = meta; meta = {}; }
  d = d || db();
  if (!EVENT_TYPES.has(type)) return false;
  const ref = (meta.ref || meta.referer || "").toString().slice(0, 300);
  const channel = (meta.channel || classifyChannel(ref, meta.utm)).toString().slice(0, 40);
  const sid = (meta.sid || "").toString().slice(0, 40);
  const device = (meta.device || "").toString().slice(0, 12);
  d.prepare("INSERT INTO events (slug,type,ms,ts,channel,ref,sid,device) VALUES (?,?,?,?,?,?,?,?)")
    .run(String(slug).slice(0, 200), type, Number(ms) || 0, Number(now) || 0, channel, ref, sid, device);
  return true;
}
// Coarse, privacy-friendly device class from the UA (no full UA stored).
export function classifyDevice(ua = "") {
  const u = String(ua || "").toLowerCase();
  if (/ipad|tablet|playbook|silk|kindle/.test(u)) return "tablet";
  if (/mobi|iphone|android.*mobile|phone|ipod/.test(u)) return "mobile";
  if (!u) return "unknown";
  return "desktop";
}
// Device split over a window (for the analytics dashboard).
export function deviceBreakdown({ days = 30 } = {}, d = db()) {
  const since = Date.now() - days * 86400000;
  return d.prepare(`
    SELECT COALESCE(NULLIF(device,''),'unknown') AS device,
           SUM(CASE WHEN type='view' THEN 1 ELSE 0 END) AS views,
           SUM(CASE WHEN type='read' THEN 1 ELSE 0 END) AS reads,
           COUNT(DISTINCT sid) AS sessions
    FROM events WHERE ts >= ? GROUP BY COALESCE(NULLIF(device,''),'unknown')
    ORDER BY views DESC`).all(since);
}
// The chrome's live public-stats bar (redesign): every number real, none faked.
export function siteStats(d = db()) {
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const t0 = dayStart.getTime();
  const r15 = d.prepare("SELECT COUNT(DISTINCT sid) c FROM events WHERE ts >= ?").get(Date.now() - 15 * 60000) || {};
  const today = d.prepare(`SELECT
      SUM(CASE WHEN type='read' THEN 1 ELSE 0 END) AS reads,
      AVG(CASE WHEN type='dwell' AND ms > 0 THEN ms END) AS dwellMs
    FROM events WHERE ts >= ?`).get(t0) || {};
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const wk = d.prepare("SELECT COUNT(*) c FROM posts WHERE date >= ?").get(weekAgo) || {};
  return {
    readersNow: r15.c || 0,
    todayReads: today.reads || 0,
    avgTimeSec: today.dwellMs ? Math.round(today.dwellMs / 1000) : 0,
    postsThisWeek: wk.c || 0,
  };
}

// Real-time: active sessions + events in the last N minutes (GA "Realtime").
export function realtime({ minutes = 60 } = {}, d = db()) {
  const since = Date.now() - minutes * 60000;
  const r = d.prepare(`SELECT COUNT(DISTINCT sid) AS activeSessions,
      SUM(CASE WHEN type='view' THEN 1 ELSE 0 END) AS views,
      SUM(CASE WHEN type='read' THEN 1 ELSE 0 END) AS reads
    FROM events WHERE ts >= ?`).get(since) || {};
  const recent = d.prepare(`SELECT e.slug, p.title, COUNT(*) AS hits
    FROM events e JOIN posts p ON p.slug=e.slug WHERE e.ts >= ? AND e.type='view'
    GROUP BY e.slug ORDER BY hits DESC LIMIT 5`).all(since);
  return { minutes, activeSessions: r.activeSessions || 0, views: r.views || 0, reads: r.reads || 0, recent };
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
// Daily time-series of engagement (for the analytics dashboard's trend chart).
export function dailySeries({ days = 30 } = {}, d = db()) {
  const since = Date.now() - days * 86400000;
  return d.prepare(`
    SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS day,
           SUM(CASE WHEN type='view' THEN 1 ELSE 0 END) AS views,
           SUM(CASE WHEN type='read' THEN 1 ELSE 0 END) AS reads,
           SUM(CASE WHEN type='audio_play' THEN 1 ELSE 0 END) AS plays,
           COUNT(DISTINCT sid) AS sessions
    FROM events WHERE ts >= ? AND ts > 0 GROUP BY day ORDER BY day`).all(since);
}
// Top referring URLs (real off-site sources, not our own domain).
// Split the "ai" channel per assistant (ChatGPT vs Perplexity vs Yuanbao vs …) by
// re-deriving the source from each stored referrer. This makes the channel that's
// already working measurable — the council's #1 move.
export function assistantBreakdown({ days = 30 } = {}, d = db()) {
  const since = Date.now() - days * 86400000;
  // Select by REFERRER, not by channel. classifyChannel() checks utm before it
  // checks the referrer, so an assistant that tags its outbound links — ChatGPT
  // sends utm_source=chatgpt.com, Copilot the same — lands in `campaign:*` and
  // never in `ai`. This panel was therefore reporting ChatGPT as zero while it
  // was in fact the second-largest assistant referrer (5 sessions of 22), and the
  // crawl-yield join inherited the same blind spot: 12,287 verified GPTBot and
  // ChatGPT-User fetches shown converting to nothing.
  // A referral from an assistant is an assistant referral whether or not it
  // carried a campaign tag. Historical rows keep whatever channel they were
  // written with, so fixing the read path is both correct and non-destructive.
  const rows = d.prepare(`SELECT ref, type, sid FROM events WHERE ts >= ? AND ref <> ''`).all(since);
  const agg = new Map();
  for (const row of rows) {
    // Skip non-assistant referrers outright. The query now selects every row with
    // a referrer (see above), so bing.com, google.com and every ordinary link
    // would otherwise pile into an "Other AI" bucket and turn a panel about
    // answer engines into a second, wrong referrer report.
    const name = classifyAssistant(row.ref);
    if (!name) continue;
    let a = agg.get(name);
    if (!a) { a = { assistant: name, views: 0, reads: 0, sids: new Set() }; agg.set(name, a); }
    if (row.type === "view") a.views++;
    if (row.type === "read") a.reads++;
    if (row.sid) a.sids.add(row.sid);
  }
  return [...agg.values()].map(a => ({ assistant: a.assistant, views: a.views, reads: a.reads, sessions: a.sids.size }))
    .sort((x, y) => y.reads - x.reads || y.views - x.views);
}

export function topReferrers({ days = 30, limit = 12 } = {}, d = db()) {
  const since = Date.now() - days * 86400000;
  return d.prepare(`
    SELECT ref, COUNT(*) AS hits, COUNT(DISTINCT sid) AS sessions
    FROM events WHERE ts >= ? AND ref IS NOT NULL AND ref != '' AND ref NOT LIKE '%dreaming.press%'
    GROUP BY ref ORDER BY hits DESC LIMIT ?`).all(since, limit);
}
// Top content by real engagement in a window (joined to live posts). `order` is
// one of reads|views|plays so the newsroom can rank by eyes, engaged reads, or
// listens — the three signals Item 4 commissions from.
export function topContent({ days = 30, limit = 12, order = "reads" } = {}, d = db()) {
  const since = Date.now() - days * 86400000;
  const col = { reads: "reads", views: "views", plays: "plays" }[order] || "reads";
  return d.prepare(`
    SELECT e.slug, p.title, p.section, p.tags, p.author,
           SUM(CASE WHEN e.type='view' THEN 1 ELSE 0 END) AS views,
           SUM(CASE WHEN e.type='read' THEN 1 ELSE 0 END) AS reads,
           SUM(CASE WHEN e.type='audio_play' THEN 1 ELSE 0 END) AS plays
    FROM events e JOIN posts p ON p.slug = e.slug
    WHERE e.ts >= ? GROUP BY e.slug ORDER BY ${col} DESC, reads DESC, views DESC LIMIT ?`).all(since, limit);
}
// Which pieces syndicate.js would actually cross-post right now. Lives here, not
// in the script, because BOTH the script and the analytics brief need the answer
// and it must be the same answer. Re-deriving it in the brief drifted immediately
// (434 vs 432 — a dropped section filter), and importing the CLI script to share
// it was worse: syndicate.js calls process.exit(0) at top level when no key is
// set, so importing it silently killed the export mid-run.
// Window and exclusions mirror the script exactly: wire/stack only, 7-21 days
// old so the origin indexes first, minus anything already sent.
export function eligibleForSyndication({ now = Date.now() } = {}, d = db()) {
  return allPosts(d).filter(p => {
    if (!["wire", "stack"].includes(p.section)) return false;
    const age = now - Date.parse(p.date + "T00:00:00Z");
    return age >= 7 * 86400000 && age <= 21 * 86400000;
  }).filter(p => !d.prepare("SELECT 1 FROM dispatched WHERE slug = ?").get(`syndicated:${p.slug}`));
}

// Route-family engagement, the non-article half of the site. topContent above
// JOINs posts, so it can only ever describe the 1,838 article URLs; the hubs
// (/build, /tools, /compare/:pair, …) were invisible to every report even though
// /build is the most-crawled path on the domain. pageBeacon writes these under a
// `page:` prefix precisely so the two never mix.
// dwell is averaged over the events that carry one, not over all views, so a page
// nobody stayed on does not get to look like a page nobody measured.
export function topPages({ days = 30, limit = 15, order = "views" } = {}, d = db()) {
  const since = Date.now() - days * 86400000;
  const col = { views: "views", reads: "reads", dwell: "avg_dwell_sec" }[order] || "views";
  return d.prepare(`
    SELECT SUBSTR(e.slug, 6) AS path,
           SUM(CASE WHEN e.type='view' THEN 1 ELSE 0 END) AS views,
           SUM(CASE WHEN e.type='read' THEN 1 ELSE 0 END) AS reads,
           COUNT(DISTINCT e.sid) AS sessions,
           CAST(AVG(CASE WHEN e.type='dwell' AND e.ms > 0 THEN e.ms END) / 1000 AS INT) AS avg_dwell_sec
    FROM events e
    WHERE e.ts >= ? AND e.slug LIKE 'page:%'
    GROUP BY e.slug ORDER BY ${col} DESC, views DESC LIMIT ?`).all(since, limit);
}

// Which next-click surfaces actually earn a second pageview. Reported alongside
// how many pages CARRIED each surface, because a surface that appears on every
// article and earns 3 clicks is a different problem from one that appears twice
// and earns 2 — the first is ignored, the second is just rare.
export function navBySurface({ days = 14, limit = 15 } = {}, d = db()) {
  const since = Date.now() - days * 86400000;
  const rows = d.prepare(`SELECT ref, COUNT(*) AS clicks, COUNT(DISTINCT sid) AS sessions
    FROM events WHERE type = 'nav' AND ts >= ? AND ref <> ''
    GROUP BY ref ORDER BY clicks DESC LIMIT ?`).all(since, limit);
  return rows.map(r => ({ surface: r.ref, clicks: r.clicks, sessions: r.sessions }));
}

// Engagement quality PER CHANNEL. The blended site average is dominated by
// `direct` — 2,987 of 3,083 views — which converts 6x worse than every other
// channel (8.8% read rate vs organic's 52.5%). Reporting one number therefore
// describes the worst channel and hides the best, and `direct` is precisely the
// bucket the code assigns to any request with an empty referrer, so it is also
// the one nobody can vouch for.
//
// Splitting it answers the question the whole rubric hangs on: whether this site's
// gap to its goal is 156x (if direct is real people) or 5,000x (if it is not).
// The honest read of the split so far: direct is a MIX — its 109 completions, each
// requiring a 95% scroll, are more than every other channel combined, sitting
// inside a large body of views that never scroll at all.
export function engagementByChannel({ days = 14 } = {}, d = db()) {
  const since = Date.now() - days * 86400000;
  const rows = d.prepare(`SELECT channel, type, sid, ms FROM events WHERE ts >= ?`).all(since);
  const agg = new Map();
  for (const r of rows) {
    const c = r.channel || "unknown";
    let a = agg.get(c);
    if (!a) { a = { channel: c, views: 0, reads: 0, completes: 0, sids: new Set(), dwells: [] }; agg.set(c, a); }
    if (r.type === "view") a.views++;
    else if (r.type === "read") a.reads++;
    else if (r.type === "complete") a.completes++;
    else if (r.type === "dwell" && r.ms > 0) a.dwells.push(r.ms);
    if (r.sid) a.sids.add(r.sid);
  }
  return [...agg.values()].map(a => {
    const d2 = a.dwells.sort((x, y) => x - y);
    return {
      channel: a.channel, views: a.views, reads: a.reads, completes: a.completes,
      sessions: a.sids.size,
      read_rate: a.views ? +(a.reads / a.views).toFixed(3) : 0,
      complete_rate: a.views ? +(a.completes / a.views).toFixed(3) : 0,
      pages_per_session: a.sids.size ? +(a.views / a.sids.size).toFixed(2) : 0,
      // Median, not mean: one 27-minute reader drags a mean upward and makes a
      // channel of instant bounces look engaged.
      median_dwell_sec: d2.length ? Math.round(d2[Math.floor(d2.length / 2)] / 1000) : null,
    };
  }).sort((x, y) => y.views - x.views);
}

// Engagement funnel totals in a window (view → read → complete + audio).
// `offsetDays` shifts the window back by whole periods so the dashboard can show
// "vs the previous N days". Without an upper bound the previous period would
// include the current one and every delta would read as growth.
export function funnel({ days = 30, offsetDays = 0 } = {}, d = db()) {
  const now = Date.now();
  const since = now - (days + offsetDays) * 86400000;
  const until = offsetDays ? now - offsetDays * 86400000 : now;
  const r = d.prepare(`SELECT
      SUM(CASE WHEN type='view' THEN 1 ELSE 0 END) AS views,
      SUM(CASE WHEN type='read' THEN 1 ELSE 0 END) AS reads,
      SUM(CASE WHEN type IN ('complete','audio_complete') THEN 1 ELSE 0 END) AS completes,
      SUM(CASE WHEN type='audio_play' THEN 1 ELSE 0 END) AS plays,
      COUNT(DISTINCT sid) AS sessions
    FROM events WHERE ts >= ? AND ts < ?`).get(since, until);
  // SUM() over zero matching rows is NULL, not 0. An empty comparison period
  // would otherwise propagate null into every delta and render as NaN%.
  const z = (v) => Number(v) || 0;
  return { views: z(r?.views), reads: z(r?.reads), completes: z(r?.completes),
    plays: z(r?.plays), sessions: z(r?.sessions) };
}

// Which desk actually earns attention. Joins events to the post that produced
// them, so a desk with many pieces and few reads is visible as such rather than
// hidden behind a corpus count.
export function sectionBreakdown({ days = 30 } = {}, d = db()) {
  const since = Date.now() - days * 86400000;
  return d.prepare(`
    SELECT p.section AS section,
           SUM(CASE WHEN e.type='view' THEN 1 ELSE 0 END) AS views,
           SUM(CASE WHEN e.type='read' THEN 1 ELSE 0 END) AS reads,
           COUNT(DISTINCT e.sid) AS sessions,
           COUNT(DISTINCT p.slug) AS pieces
    FROM events e JOIN posts p ON p.slug = e.slug
    WHERE e.ts >= ? AND p.section IS NOT NULL AND p.section <> ''
    GROUP BY p.section ORDER BY reads DESC, views DESC`).all(since);
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

// ── agent subscriptions (webhook / email push + poll cursor) ────────────────────
// An AI agent registers to be notified of new posts. kind='webhook' → POSTed on
// publish; kind='email' → also added to the newsletter. Every sub gets an id +
// token (for unsubscribe) and can always poll /feed.json?since= instead.
export function addAgentSub({ kind, endpoint, sections = null, format = "json" }, d = db()) {
  const now = new Date().toISOString();
  const seed = `${kind}:${endpoint}:${now}:${countAgentSubs(d)}`;
  const id = "as_" + (Math.abs(hashStr(seed)).toString(36) + Math.abs(hashStr(seed + "x")).toString(36)).slice(0, 12);
  const token = Math.abs(hashStr(id + ":dp-agent")).toString(36);
  const secs = Array.isArray(sections) && sections.length ? sections.join(",") : null;
  // webhooks are unique by endpoint — re-registering the same URL returns the same row
  if (kind === "webhook") {
    const existing = d.prepare("SELECT id, token FROM agent_subs WHERE kind='webhook' AND endpoint = ?").get(endpoint);
    if (existing) return { ok: true, already: true, id: existing.id, token: existing.token };
  }
  d.prepare(`INSERT INTO agent_subs (id, kind, endpoint, sections, format, token, created, last_notified, active, failures)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`)
    .run(id, kind, endpoint, secs, format, token, now, now);
  return { ok: true, already: false, id, token };
}
export function countAgentSubs(d = db()) {
  return d.prepare("SELECT COUNT(*) c FROM agent_subs WHERE active = 1").get().c;
}
export function activeAgentWebhooks(d = db()) {
  return d.prepare("SELECT id, endpoint, sections, format, token, failures FROM agent_subs WHERE active = 1 AND kind = 'webhook'").all();
}
export function removeAgentSub(id, token, d = db()) {
  const row = d.prepare("SELECT id FROM agent_subs WHERE id = ? AND token = ?").get(String(id), String(token));
  if (!row) return { ok: false };
  d.prepare("DELETE FROM agent_subs WHERE id = ?").run(String(id));
  return { ok: true };
}
export function markAgentSubNotified(id, when, d = db()) {
  d.prepare("UPDATE agent_subs SET last_notified = ?, failures = 0 WHERE id = ?").run(when, String(id));
}
export function bumpAgentSubFailure(id, deactivateAt = 10, d = db()) {
  const row = d.prepare("SELECT failures FROM agent_subs WHERE id = ?").get(String(id));
  const failures = (row ? row.failures : 0) + 1;
  const active = failures >= deactivateAt ? 0 : 1;
  d.prepare("UPDATE agent_subs SET failures = ?, active = ? WHERE id = ?").run(failures, active, String(id));
  return { failures, deactivated: active === 0 };
}
// posts not yet broadcast to agent webhooks (mirrors undispatchedPosts for email)
export function agentUndispatchedPosts(d = db()) {
  return d.prepare(`SELECT p.slug, p.title, p.dek, p.section, p.date, p.author FROM posts p
                    LEFT JOIN agent_dispatched a ON a.slug = p.slug
                    WHERE a.slug IS NULL
                    ORDER BY p.date DESC, p.slug`).all();
}
export function markAgentDispatched(slugs, sentAt, d = db()) {
  const stmt = d.prepare("INSERT INTO agent_dispatched (slug, sent_at) VALUES (?, ?) ON CONFLICT(slug) DO NOTHING");
  const tx = d.transaction((rows) => { for (const slug of rows) stmt.run(slug, sentAt); });
  tx(slugs);
}
export function agentDispatchSeeded(d = db()) {
  return d.prepare("SELECT COUNT(*) c FROM agent_dispatched").get().c > 0;
}

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
  // `rerankers?` (optional plural) so the plural-slug piece decoder-backbone-rerankers —
  // the reranking-architecture spoke on the encoder→decoder backbone swap — rails with the
  // reranker/cross-encoder pieces instead of orphaning; the trailing `s` only ever appears
  // on that one slug (all other reranker slugs are singular), so first-match-wins poaches nothing.
  // `bm25` is bounded by `(?<!regex-vs-)` so the tool-USE piece
  // `tool-search-regex-vs-bm25-deferred-tool-matcher` (BM25 as a tool-search matcher,
  // not a retrieval matcher) isn't poached into retrieval — it homes in Protocols with
  // the other tool-scaling pieces. Corpus-scanned (2026-07-26): `regex-vs-bm25` appears
  // in only that one slug; every real RAG bm25 slug (hybrid-search-bm25…, splade-vs-bm25…,
  // pinecone-full-text-search-bm25…) has no `regex-vs-` prefix, so the lookbehind excludes
  // exactly one slug and poaches nothing.
  ["RAG & Retrieval",        /(^|-)(rag|graphrag|chunking|embedding|embeddings|rerankers?|cross-encoder|bi-encoder|retrieval|hybrid|semantic-search|semantic-caching(?!-vs-prompt)|(?<!regex-vs-)bm25|lexical|vector|pgvector|pinecone|qdrant|chroma|weaviate|milvus|lancedb|sqlite-vec|duckdb|model2vec|sentence-transformers|neo4j|falkordb|memgraph|graph-database|knowledge-graph|long-context|hnsw|ivf|ivfflat|diskann)(-|$)/],
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
  // `whats-new` homes framework *release* explainers ("what's new in <framework> X"): the natural
  // slug for a version-drop piece (langchain-1-0-and-langgraph-1-0-whats-new, vercel-ai-sdk-7-whats-new)
  // whose subject token (`vercel`/`ai-sdk`/`sdk`) can't be used here — it collides with the
  // test-pinned copilotkit-vs-assistant-ui-vs-vercel-ai-sdk in the later Agent UI cluster, which
  // Agent Frameworks (running first) would poach. `whats-new` appears in exactly those two framework
  // slugs and in NO copilotkit/UI slug, so it rails the SDK-7 release with the frameworks and poaches nothing.
  // `agents-sdk` (bounded, plural) homes OpenAI-Agents-SDK pieces whose slug carries no other framework
  // token (e.g. openai-agents-sdk-run-error-handlers-…, which otherwise orphaned to the catch-all). It is
  // distinct from `ai-sdk` (the vercel token deliberately avoided above) and from singular `agent-sdk`.
  // Corpus-scan (2026-07-08): the only bounded-`agents-sdk` slugs are openai-agents-sdk-run-error-handlers-…
  // (was catch-all → rescued here) and claude-agent-sdk-vs-openai-agents-sdk (was Models & LLM APIs via
  // `claude`, now correctly homed with its framework siblings); the three openai-agents-sdk-vs-* pieces
  // already matched here via langgraph/pydantic/adk, so their cluster is unchanged. 2 moves, 0 wrong-cluster.
  ["Agent Frameworks",       /(^|-)(framework|frameworks|langgraph|crewai|autogen|langchain|langchain4j|llamaindex|pydantic|adk|harness|agents-sdk|hermes|n8n|flowise|langflow|dify|coze|spring-ai|jvm|declarative|whats-new)(-|$)/],
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
  // `opencode` is the OSS terminal agent (sst/Anomaly) that passed Claude Code on
  // GitHub stars in 2026 — a head term in its own right, so it rails here even when
  // compared against a non-tokened rival (e.g. `opencode-mcp-setup`), not only when
  // the slug happens to also carry `claude-code`/`codex`/`aider`.
  // `aider` here means the aider *tool*; guard it against `aider-polyglot`, which is a
  // *benchmark* (Aider's multi-language Exercism eval), not the assistant. That
  // compound must fall through to Evals & Observability where the "which benchmark"
  // money pages live (swe-bench-*, terminal-bench-*, tau-bench) — otherwise a
  // benchmark-comparison page gets stranded among IDE/agent tools and loses its
  // internal-link equity to its true siblings. Bare `aider` (aider-vs-cline-vs-openhands)
  // still matches and stays here.
  // Which coding *subscription* a founder buys (Claude Pro/Max vs ChatGPT vs Cursor vs
  // Codex vs Replit tiers) is a decision about these same assistants, so the
  // "which-ai-coding-subscription-solo-founder-2026" money page rails here with the
  // tool comparisons it links to (cursor-vs-windsurf, claude-code-vs-codex) instead of
  // orphaning to the catch-all. The bounded compound `coding-subscription` appears in
  // only that one slug (corpus-scanned — the other `subscription` slug carries
  // `sdk-subscription`, not `coding-subscription`), matches no earlier cluster, so
  // first-match-wins poaches nothing.
  ["Coding Agents & IDEs",   /(^|-)(cursor|windsurf|copilot|claude-code|aider(?!-polyglot)|cline|roo-code|kilo-code|openhands|opencode|devin|codex|agents-md|claude-md|spec-driven|spec-kit|kiro|tessl|coderabbit|greptile|qodo|bugbot|code-review|codereview|graphite|lovable|bolt|v0|replit|app-builder|vibe-coding|coding-agent|coding-subscription|edit-formats|edit-format|worktree|worktrees)(-|$)/],
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
  ["Agent UI & Frontend",    /(^|-)(copilotkit|copilot|assistant-ui|ag-ui|chat-ui|generative-ui|frontend|streamlit|gradio|chainlit|open-webui|librechat|anythingllm|streaming|websocket|websockets)(-|$)/],
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
  // Computer-use / GUI agents (drive the whole desktop by pixels, not the DOM) are the
  // same demand cluster as the browser-automation frameworks — a reader choosing between
  // "browser agent" and "computer-use agent" wants them railed together. `computer-use`
  // is a bounded compound (won't brush a bare `use`); corpus-scanned it appears only in
  // `computer-use-vs-browser-automation` (already homed here via `browser` — no move) and
  // the new `open-source-computer-use-agents` roundup it rescues from the catch-all.
  // `gui-agent` appears in zero existing slugs, so both tokens poach nothing.
  // `search` is bounded by `(?<!tool-)` so `tool-search` (the agent tool-discovery
  // feature) isn't read as web search: it lets the two tool-search pieces
  // (too-many-tools-tool-search-vs-code-execution, tool-search-regex-vs-bm25…) fall
  // through to Protocols, where `tools`/`tool-search` home them with the tool-scaling
  // cluster. `web-search`/`vector-search`/bare `search-…` are not preceded by `tool-`,
  // so they still match here; corpus-scanned — the only `tool-search` slugs are those two.
  ["Web, Search & Browsing", /(^|-)(browser|browserbase|browserless|steel|stagehand|playwright|computer-use|gui-agent|firecrawl|crawl4ai|jina|(?<!tool-)search|tavily|exa|linkup|scrape|web|llms-txt|llmstxt|robots-txt|generative-engine)(-|$)/],
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
  // `tool-schema`/`tool-schemas` joins the same tool-DESIGN family: it homes the
  // schema-constraint money page (how-to-constrain-tool-schemas-to-cut-bad-tool-calls —
  // enum/required/additionalProperties + strict mode so an agent can't emit bad
  // arguments) so it rails with tool-descriptions (input prose), tool-response (output
  // shape), tool-error (failure handling), and tool-choice (invocation control), its
  // true siblings. Corpus-scanned (2026-08-08): the bounded tokens match EXACTLY three
  // slugs — the new page, `mcp-tool-schemas-json-schema-2020-12` (already homes here via
  // its leading `mcp` token, so unmoved), and `deep-agents-…-tool-schema-prose` (which
  // first-matches the EARLIER "Coding Agents & IDEs" cluster, so first-match-wins leaves
  // it there) — so adding the token poaches nothing and rescues only the orphan.
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
  // The bare `protocol` token is guarded against the vendor-HTTP sense of the word.
  // It is load-bearing for agent-INTEROP protocol pieces that carry no other token —
  // `x401-protocol-agent-authorization` (a wire compare page whose only home-signal is
  // `protocol`; `x401`/`authorization` aren't tokens). But a "protocol" can also be a
  // runtime's wire format: `foundry-hosted-agents-responses-vs-invocations-protocol`
  // is about Foundry's HTTP invocation protocol, a Sandboxes & Runtime hosting piece,
  // NOT MCP/A2A interop. The lookbehind `(?<!invocations-)protocol` is corpus-scanned
  // (2026-07-04): the ONLY slug where `protocol` is preceded by `invocations-` is that
  // Foundry piece, so the guard drops exactly it (letting it fall through to Sandboxes
  // & Runtime via `hosted-agents`) while `x401-protocol-…` (preceded by `x401-`) and
  // every `-protocol-`/`-protocols` interop slug still match.
  // `app-intents` homes the App Intents explainer here: it's Apple's tool-exposure
  // contract (an app declares typed actions the OS agent invokes), the on-device
  // mirror of MCP's tool surface, and the piece's whole `compare:` table is App
  // Intents vs MCP — so it rails with webmcp/mcp, not the catch-all. Only
  // `app-intents-apple-intelligence-…` carries the multi-hyphen literal (no other
  // slug contains it) and it matches no earlier cluster, so first-match-wins poaches
  // nothing — the same reason webmcp sits here rather than in Web/Browsing.
  ["Protocols (MCP & A2A)",  /(^|-)(mcp|webmcp|app-intents|a2a|function-calling|tool-calling|tools|tool-selection|tool-choice|tool-retrieval|tool-search|tool-description|tool-descriptions|tool-response|tool-responses|tool-schema|tool-schemas|tool-error|tool-errors|skill|skills|(?<!invocations-)protocol|composio|arcade|toolhouse|ap2|x402|acp|payment|payments|identity|authenticate|authentication|oauth)(-|$)/],
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
  // Testing a non-deterministic agent (flakiness, regression testing, pass@k/pass^k)
  // is the CI-side sibling of the eval/record-replay/simulated-user pieces already
  // here — the "how do I test an agent whose output changes run-to-run" money-page
  // class. Bounded `non-deterministic|flaky|flakiness|regression-testing` are the
  // distinctive markers of that class and, corpus-scanned (2026-07-03), appear in
  // NO other slug — so they home `how-to-test-a-non-deterministic-ai-agent` beside
  // `record-replay-testing-for-ai-agents` without poaching anything. Deliberately NOT
  // a bare `test`/`deterministic` token: Evals precedes Inference & Reasoning, so
  // `test` would poach `how-to-load-test-an-llm-app` (Inference) and
  // `sleep-time-compute-vs-test-time-compute` (Reasoning), and bare `deterministic`
  // would poach `why-llm-inference-is-not-deterministic` (Inference) — the hyphenated
  // `non-deterministic` matches only the new agent-testing piece.
  // `replay` here means RECORD-replay testing (the CI technique paired with `record`),
  // NOT durable-execution replay. Those are opposite demand clusters: a durable-
  // execution engine (Temporal/Restate) replays the WORKFLOW to recover from a crash,
  // which is the Sandboxes & Runtime family (`durable`/`temporal`/`idempotent`). Evals
  // precedes Sandboxes, so a bare `replay` first-match-wins-poached
  // `resume-crashed-ai-agent-durable-execution-replay-trap` into the eval rail. Guard
  // it with a negative lookbehind (same idiom as `(?<!kv-cache-)quantization` above):
  // `(?<!execution-)replay` still matches `record-replay-testing-for-ai-agents`
  // (`replay` there is preceded by `record-`) and any future `replay-testing-…` piece,
  // but skips `…-execution-replay-…`, which then correctly falls through to Sandboxes
  // via `durable`. Corpus-scanned (2026-07-03): the only two slugs carrying `replay`
  // are `record-replay-testing-for-ai-agents` (stays here, also matches `record`) and
  // the durable-execution piece (now homes to Sandboxes) — so the guard poaches nothing.
  // A/B testing an agent in production (how-to-ab-test-an-ai-agent) is an online-evaluation
  // concern: the win/loss signal is a quality score (an online eval / LLM-judge) over sampled
  // live traffic, the exact harness as the canary/shadow rollout and online-vs-offline-eval
  // money pages already here. The bounded COMPOUND `ab-test` is corpus-scanned to appear in
  // ONLY this new slug and in no earlier-cluster regex; a bare `ab`/`test` was deliberately
  // NOT added (`ab` is too generic, `test` would poach how-to-test-an-mcp-server out of the
  // earlier Protocols cluster). The piece matches no earlier cluster, so first-match-wins
  // homes it here and poaches nothing.
  ["Evals & Observability",  /(^|-)(eval|evals|evaluate|evaluation|judge|judges|deepeval|ragas|promptfoo|benchmark|benchmarks|browsecomp|swe-bench|tau-bench|terminal-bench|recovery-bench|polyglot|gaia|osworld|webarena|webvoyager|androidworld|mind2web|simulated|non-deterministic|flaky|flakiness|regression-testing|ab-test|record|(?<!execution-)replay|canary|observability|monitor|monitoring|langfuse|langsmith|phoenix|trace|tracing|otel|opentelemetry|openllmetry|openinference|instrumentation|debug|debugging|hallucination|hallucinations|confidence-scores|calibration|uncertainty|logprobs|garak|pyrit|red-team|red-teaming)(-|$)/],
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
  // The prefill/decode *contention* fixes proper — chunked prefill (interleaving a
  // long prompt's prefill with decode via the max_num_batched_tokens budget) and the
  // prefill-vs-decode split itself — are the same "how do I run inference fast without
  // one long prompt freezing every stream" scheduling decision, so they rail with the
  // batching + serving-engine + kv-cache pieces already here, not the catch-all. Add
  // `chunked-prefill|prefill|decode`: corpus-scanned, `prefill`/`decode` appear only in
  // `tuning-chunked-prefill-max-num-batched-tokens` and `2026-06-23-prefill-vs-decode-
  // llm-inference` (the latter already homes here via `inference`), and in no earlier
  // cluster slug — the RAG cluster's chunk pieces carry `chunking`, never `chunked`, so
  // the bounded `chunked-prefill` compound can't brush them. First-match-wins poaches
  // nothing; the only slug that moves is the orphaned chunked-prefill money page.
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
  // `tpu` is the non-CUDA accelerator sibling of `gpu` — the TPU-vs-GPU / "serve an LLM
  // on TPU" serving pages belong with the GPU/vLLM inference money pages, not the
  // catch-all. Bounded `(^|-)tpu(-|$)` matches only hyphen-delimited `tpu` segments, so
  // it does NOT catch the mid-word "tpu" inside `output` (as in structured-*output*-…,
  // which homes to Structured Outputs anyway, a LATER cluster). Corpus-scanned: the only
  // slug carrying a bounded `tpu` today is `tpu-vs-gpu-llm-inference` (already homed here
  // via `gpu`/`inference`), so the token rescues future TPU-first slugs and poaches nothing.
  // Request-resilience siblings: the cluster already owns `retries`/`fallbacks`/`cancellation`,
  // but the singular/verb forms `retry`/`cancel`/`failover` were missing, so the money pages
  // `retry-budgets-for-llm-calls`, `how-to-cancel-a-running-ai-agent`, and
  // `multi-region-llm-failover` fell to the #15/#29 catch-all instead of railing with
  // circuit-breaker / rate-limits / timeout / error-retries-and-fallbacks. Corpus-scanned
  // (2026-07-08): those are the ONLY three slugs sitewide carrying a bounded
  // `retry`/`cancel`/`failover`, all currently orphaned; no earlier cluster matches them
  // (so first-match-wins loses nothing) and no LATER cluster's slug carries the tokens (so
  // nothing is poached). Bounded segments can't hit mid-word "retry"/"cancel" (e.g. poetry).
  ["Inference & Gateways",   /(^|-)(inference|vllm|sglang|lmdeploy|turbomind|ollama|lm-studio|lmstudio|tensorrt|trt|tgi|gateway|litellm|portkey|tensorzero|provider-agnostic|routing|router|routellm|notdiamond|martian|cascade|frugalgpt|bentoml|serve|serving|kserve|triton|seldon|batch|batching|continuous-batching|in-flight|inflight|chunked-prefill|prefill|decode|tensor-parallelism|pipeline-parallelism|speculative-decoding|eagle|medusa|mlx|llama-cpp|diffusion|dllm|autoregressive|mig|mps|time-slicing|gpu|gpu-sharing|tpu|temperature|top-p|top-k|min-p|nucleus|attention|mha|mqa|gqa|mla|flashattention|pagedattention|flashinfer|kv-cache|kv-cache-offloading|eviction|streamingllm|snapkv|lmcache|mooncake|mamba|ssm|state-space|rope|yarn|ntk|position-interpolation|tiktoken|sentencepiece|tokenizer|tokenizers|tokenization|bpe|load-test|load-testing|retry|retries|fallback|fallbacks|failover|circuit-breaker|backpressure|reliability|timeout|cancel|cancellation|truncated|truncation|rate-limit|rate-limits|token-budget|token-cost|token-costs|agent-costs|cost-optimization|cost-attribution|cost-tracking|per-tenant|per-customer|latency|ttft|tpot|time-to-first-token|inter-token)(-|$)/],
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
  // The managed hosted-agent RUNTIMES (the "which managed runtime hosts my agent's
  // process" decision) rail here with AgentCore and the durable-execution engines.
  // The comparison page `bedrock-agentcore-vs-vertex-agent-engine-vs-foundry-hosted-
  // agents` already homes here via `agentcore`; the focused `foundry-hosted-agents-
  // responses-vs-invocations-protocol` (Responses API vs the Invocations protocol —
  // a hosting/runtime decision, not a model-API or MCP-interop one) carried none of
  // this cluster's tokens and would otherwise mis-home to Models & LLM APIs via its
  // bare `foundry` token (or to Protocols via `protocol`, now guarded above). The
  // bounded `hosted-agents`/`hosted-agent` compound is corpus-scanned (2026-07-04):
  // it appears in ONLY those two runtime slugs (bare `hosted` is deliberately NOT
  // added — it also spells `self-hosted-…`, which belongs to security/stack/inference
  // pieces), and in no earlier cluster regex, so first-match-wins poaches nothing and
  // the Foundry piece rails with its true sibling instead of the model-API cluster.
  // The dead-letter-queue piece is the failure-handling layer of the same durable/
  // async task machinery already here (durable-execution, temporal, inngest, the
  // message-queue/idempotency pieces) — a poison agent task is what durable retry
  // and idempotency exist to contain — so it rails with them, not the catch-all.
  // Bounded `dead-letter` is corpus-scanned (2026-07-08): it appears in ONLY that
  // one new slug and in no earlier cluster regex (the `poison` slugs are MCP-security
  // and already home there), so first-match-wins poaches nothing. Bare `queue` misses
  // the plural `queues`, so the token is added explicitly rather than relying on it.
  // `webhooks`/`polling` (also 2026-07-08) de-orphan `webhooks-vs-polling-for-long-
  // running-agent-tasks` — a durable async-delivery comparison whose true rail is this
  // cluster (durable/queue/event-driven), not the "More comparisons" catch-all it fell
  // to. Corpus-scanned: `polling` is unique to that slug; `webhooks` also appears only
  // in `…cron-vs-webhook-vs-queue` (singular `webhook`, already homed here via `queue`),
  // so neither token appears in any earlier cluster and first-match-wins poaches nothing.
  // `northflank`/`railway` de-orphan the always-on-PaaS comparison
  // (northflank-vs-railway-vs-render-vs-fly-agent-backend) — an always-on deploy-target
  // decision whose true rail is this runtime cluster alongside the sandbox/where-to-run
  // pieces, not the catch-all. Corpus-scanned: both tokens appear only in that one slug
  // (the sibling modal-vs-…-fly-machines piece is already homed here via `modal`), so
  // neither appears in any earlier cluster and first-match-wins poaches nothing.
  ["Sandboxes & Runtime",    /(^|-)(sandbox|sandboxes|e2b|modal|northflank|railway|daytona|firecracker|hyperlight|durable|temporal|inngest|restate|where-to-run|deploy|deployment|agentcore|hosted-agents|hosted-agent|idempotent|idempotency|exactly-once|saga|compensating|compensation|rollback|roll-back|kafka|nats|redis-streams|valkey|message-queue|messaging|pubsub|event-driven|queue|dead-letter|webhooks|polling)(-|$)/],
  // Email/transactional APIs (Resend/Postmark/Mailgun/SES) are their own founder
  // decision cluster — "which transactional email API" and "how do I parse inbound
  // email to my agent" are the same buyer's-guide demand. De-orphans the sending-side
  // comparison (resend-vs-postmark-vs-amazon-ses) and the receiving-side how-to
  // (how-to-give-your-agent-an-email-inbox-inbound-parsing) into one rail. Corpus-scanned:
  // these tokens appear only on email slugs (none in any earlier cluster), so
  // first-match-wins poaches nothing; placed before the catch-all so both are homed.
  ["Email & Transactional APIs", /(^|-)(email|inbox|inbound|transactional-email|resend|postmark|mailgun|sendgrid|smtp)(-|$)/],
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
  // Agent RCE disclosures (Amazon Q folder-trust, AutoJack localhost, prompt-injection-to-
  // RCE) are the attack-side companions to the guardrail/exploit pieces already here — a
  // real advisory is what the guardrails exist to stop. The bounded `rce` token is corpus-
  // scanned (2026-07-03): it appears in four slugs, all security — amazon-q-rce-… and
  // autojack-…-rce home here (both belong), prompt-injection-to-rce-… already homes via
  // `injection`, and cursor-…-sandbox-escape-rce matches the earlier Sandboxes & Runtime
  // cluster on `sandbox` so first-match-wins leaves it put. No non-security slug carries
  // `rce`, so nothing else is dragged in.
  // Agent Behavior Verification (Exabeam's open-source Praxen) is the audit-side
  // companion to the guardrail/red-team pieces — it verifies an agent's whole
  // implementation against a declared authorized scope, the same "what is this agent
  // allowed to do" problem this cluster owns. The bounded `verification`/`praxen`
  // tokens are corpus-scanned (2026-07-04): each appears in ONLY the
  // agent-behavior-verification-praxen slug, no earlier cluster regex matches it (it
  // previously fell to the catch-all), and neither is a substring-collision risk —
  // so first-match-wins homes it here and poaches nothing.
  // Jailbreak severity / disclosure pieces are the policy-side companion to the
  // injection/guardrail money pages — a jailbreak is the attack these defenses
  // exist to score and stop. The bounded `jailbreak` token is corpus-scanned
  // (2026-07-04): it appears in only jailbreak-vs-prompt-injection (already homes
  // here earlier via `injection`, same cluster) and the new
  // jailbreak-severity-standard-fable-5-export-control (which otherwise orphans to
  // the catch-all). The Fabrications satire government-shutters-fable-after-unionization
  // carries `fable`, NOT `jailbreak`, so it is untouched — no poach.
  // Multinational agentic-AI security guidance (the CISA/Five-Eyes "Careful Adoption
  // of Agentic AI" guide) is the policy-side companion to the injection/guardrail/
  // governance money pages — the "how do I secure an agent" decision this cluster
  // owns. The bounded `security` token is corpus-scanned (2026-07-08): the five slugs
  // carrying it are `mcp-2026-spec-security-…`, `nsa-mcp-security-guidance`, and
  // `agent-skills-supply-chain-security` (all three already claimed EARLIER by
  // Protocols via `mcp`/`skill`), `openclaw-self-hosted-agent-security-risk` (already
  // claimed earlier by Sandboxes & Runtime), and the new
  // `cisa-five-eyes-agentic-ai-security-guidance` — the lone `security` slug still in
  // the catch-all. So first-match-wins keeps the other four put and this token rescues
  // only the CISA piece into its real security siblings, poaching nothing.
  // Four agent-security money pages were orphaned in the catch-all because the
  // regex keyed on security *tools/standards* (owasp/injection/guard) but not the
  // threat/access-control vocabulary these carry: zero-trust-for-ai-agents,
  // ai-agents-finding-zero-days, fine-grained-authorization-for-ai-agents, and
  // mastra-npm-supply-chain-attack. They are unambiguously Guardrails & Safety —
  // the same cluster as the prompt-injection, OWASP, and secret/credential pieces.
  // Bounded tokens, corpus-scanned (2026-07-08): `zero-trust`/`zero-days` appear in
  // no other slug; `authorization` otherwise appears only on `mcp-*-authorization*`
  // slugs already claimed EARLIER by Protocols (first-match-wins keeps them there);
  // `supply-chain` otherwise appears only on `agent-skills-supply-chain-security`,
  // already claimed EARLIER by Protocols. Guardrails is the 2nd-to-last cluster, so
  // the only clusters these tokens could poach forward from are Structured Outputs,
  // Reasoning, Prompts, and Models — none of which carry any of these tokens. Net
  // effect verified: purely catch-all → Guardrails, poaching nothing.
  // `poisoned-prs` (2026-08-09) is corpus-scanned to appear only on the new
  // how-to-harden-your-repo-against-ai-agent-poisoned-prs slug — the bare `poison`/
  // `poisoning` tokens live on the MCP-tool-poisoning slugs claimed EARLIER, and this
  // compound token matches none of them, so it homes the repo-hardening how-to here
  // (its natural neighbours: the supply-chain, injection, and credential pieces)
  // without poaching anything.
  ["Guardrails & Safety",    /(^|-)(guardrail|guardrails|llama-guard|guard|injection|jailbreak|owasp|presidio|gliner|redaction|pii|trifecta|exfiltration|secret|secrets|credential|credentials|vault|exploit|advisory|rce|acs|governance|agent-control|control-specification|ai-act|regulation|compliance|verification|praxen|security|zero-trust|zero-days|authorization|supply-chain|poisoned-prs)(-|$)/],
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
  // A dedicated REVIEWER agent that audits a producer agent's output (Claude Science's
  // citation/calculation auditor) is a multi-agent control-flow pattern — the same
  // "how many agents and how are they wired" architecture decision as multi-agent /
  // human-in-the-loop / deep-agents already here, and the piece links in-body to
  // orchestrator-worker-vs-pipeline-multi-agent (which homes here via `multi-agent`),
  // so its sibling rail surfaces exactly those. The bounded compound `reviewer-agent`
  // is corpus-scanned (2026-07-06) to appear in EXACTLY one slug —
  // claude-science-reviewer-agent-reproducible-pipelines — which otherwise homes to
  // Models & LLM APIs (LAST cluster) on the bare `claude` token, stranding its
  // internal-link equity among model-vs-model pages it has nothing to do with. No
  // other slug carries `reviewer` or `reviewer-agent`, so first-match-wins poaches
  // nothing; placing the token in this earlier cluster claims the piece before Models.
  // A Slack-button approval gate (post → park → verify → resume) is the same
  // "person gates the control flow — pause/approve/resume" family as the
  // human-in-the-loop guide already homed here; it just moves the human to a
  // channel instead of a terminal or an in-app dialog. how-to-add-a-slack-approval-
  // gate-to-a-headless-agent carries none of the tokens above (`gate`≠`guard`,
  // `approval` alone isn't a token), so it orphaned. The bounded compound
  // `approval-gate` is corpus-scanned to appear in EXACTLY two slugs — this new one
  // and human-in-the-loop-approval-gate-agent-tool-calls, which already homes here
  // via `human-in-the-loop` — so first-match-wins poaches nothing.
  ["Agent Reasoning & Planning", /(^|-)(react|reflexion|reasoning|planning|plan-and-execute|plan-and-solve|rewoo|llmcompiler|cot|tot|chain-of-thought|tree-of-thought|interleaved-thinking|mixture-of-agents|reviewer-agent|sleep-time|test-time|self-consistency|best-of-n|workflow|workflows|multi-agent|single-agent|deep-agents|deep-agent|human-in-the-loop|hitl|approval-gate|loop|looping)(-|$)/],
  // Context-management money pages (how-to-manage-context-in-a-long-running-agent —
  // clearing vs compaction vs memory) are the operational arm of context engineering,
  // so they rail with `context-engineering` and the caching pieces already here.
  // Broadened `context-engineering` → a bounded `context` to capture them: a corpus
  // scan shows every other bounded-`context` slug already homes earlier or here
  // (`*-selective-context` via `prompt`; `context-rot-…`/`rag-vs-long-context` claimed
  // first by RAG's `long-context`), so first-match-wins poaches nothing and only the
  // orphaned context-management guide moves out of the "More comparisons" catch-all.
  // `prompt` → `prompts?` so a plural-`prompts` slug (a prompt-versioning / prompt-
  // management guide) homes here with its optimization siblings instead of orphaning
  // to the catch-all. Corpus-scanned: the only other bounded-`prompts` slug
  // (`…-mcp-tools-vs-resources-vs-prompts`) is claimed FIRST by the earlier Protocols
  // cluster via `mcp`/`tools`, so first-match-wins poaches nothing here.
  // `context` is bounded with a negative lookbehind so a size-prefixed context
  // SPEC — a model-launch slug like `…-1m-context` / `…-256k-context` — is NOT
  // poached out of Models & LLM APIs into here. Every genuine context-engineering
  // money page reads `context-<word>` (context-window/-length/-editing/-offloading/
  // -engineering) or a word-prefixed `-context` (own-context/selective-context),
  // none of which is `\d[mk]-context`, so they all still match. This rescues
  // `minimax-m3-open-weight-1m-context` (an open-weight model launch) back to its
  // model-launch siblings without moving any real context piece.
  ["Prompts & Optimization", /(^|-)(dspy|textgrad|adalflow|prompts?|(?<!\d[mk]-)context|caching)(-|$)/],
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
  // Migrating an agent BETWEEN models ("how to migrate to a new LLM") is a
  // model-selection/upgrade decision — the how-to companion to the "X vs Y model"
  // head-to-heads already in this cluster (someone mid-migration wants exactly
  // those comparisons in the sibling rail). Bounded `migrate`/`migration` is
  // corpus-scanned (2026-07-05): the only other slugs carrying it —
  // `how-to-migrate-embedding-models-in-production` and
  // `openai-agent-builder-evals-deprecation-migration` — already match RAG and
  // Evals respectively (both EARLIER clusters), so first-match-wins keeps them put
  // and this token poaches nothing; the Dispatch `control-migrates-to-the-login`
  // carries "migrates" (not the bounded `migrate`/`migration`) and isn't a
  // comparison post. It rescues the lone `how-to-migrate-an-ai-agent-to-a-new-llm`
  // orphan into this cluster.
  // vendor/family tokens `hunyuan|hy3|tencent` join the model roll-up: this is the
  // LAST cluster, so first-match-wins means they can only rescue pieces that would
  // otherwise fall to the catch-all — they poach nothing from earlier clusters, and
  // no existing slug carries them, so the only piece moved is Tencent's Hy3 launch
  // (and future Hunyuan model pieces), homing it beside GLM-5.2/Kimi/DeepSeek.
  // vendor/family tokens `nemotron|liquid|diffusiongemma|unisound|longcat` join the
  // same roll-up (2026-07-08): five model-LAUNCH comparison pieces were stranded in
  // the catch-all because the regex enumerates every *other* family but not these.
  // Same LAST-cluster safety as above — first-match-wins means they can only rescue
  // catch-all pieces, never poach an earlier cluster. Corpus-scanned (2026-07-08):
  // each token matches ONLY its own orphaned slug — `nemotron` also appears in
  // `qwen3-vs-nemotron-nano-…`, but that piece already homes here via `qwen3`, so its
  // destination is unchanged. Net effect: exactly 5 catch-all → Models moves, 0 others.
  // `opus` added (2026-07-16): Opus-LED slugs (`opus-4-8-fast-mode-…`, a pricing/speed-tier
  // money page) carry no `claude` token, so they orphaned to the catch-all while the
  // `claude-…-vs-opus-…` family homed here fine. `opus` is a Claude-model token only, and
  // Models & LLM APIs is the LAST cluster, so first-match-wins means it can only rescue
  // catch-all orphans (every `claude-*-opus-*` slug already matched via `claude` earlier),
  // never poach an earlier cluster. `fast-mode` added alongside so the fast-vs-standard
  // speed-tier decision page rails with the model pages even for a future non-Opus tier.
  // `price-map` added (2026-08-04): the cross-provider model-price/tier map
  // (agent-model-price-map-august-2026-…, "which model per workload by price") is a
  // model-SELECTION decision organized by price, so it rails with the model pages, not
  // the FinOps spend hub below. Models & LLM APIs is the LAST model cluster, so
  // first-match-wins means the token can only rescue catch-all orphans. Corpus-scanned
  // (2026-08-04): `price-map` appears in exactly two slugs — this one (orphaned) and
  // gpu-rental-price-map-…, which already homes to Inference & Gateways earlier via
  // `gpu`, so its destination is unchanged. Net effect: exactly 1 catch-all → Models, 0 others.
  ["Models & LLM APIs",      /(^|-)(gpt|claude|opus|fast-mode|gemini|qwen|qwen3|kimi|glm|minimax|deepseek|hunyuan|hy3|tencent|nemotron|liquid|diffusiongemma|unisound|longcat|poolside|laguna|gemma|small-language-models|mixture-of-experts|vision-language|migrate|migration|closed|responses-api|assistants-api|chat-completions|bedrock|vertex-ai|azure-ai|foundry|price-map)(-|$)/],
  // Agent SPEND-MANAGEMENT + PRICING is a distinct buyer-intent class from the
  // inference/token-cost pieces already owned by Inference & Gateways (token-cost,
  // cost-optimization, cost-attribution): these are the "how much does an agent cost
  // to run / how do I cap its spend / how do I price it" decision pages — a FinOps
  // hub, not a serving-runtime one. Four were stranded in the catch-all
  // (how-to-cap-an-ai-agent-spend-per-run, how-to-cap-ai-agent-spending,
  // gartner-ai-agent-spending-2026, how-to-price-an-ai-agent) because no cluster
  // carries a spend/pricing token. Placed LAST (same safety as the two roll-ups
  // above): first-match-wins means it can only rescue catch-all pieces, never poach
  // an earlier cluster. Corpus-scanned (2026-07-08): the tokens match exactly those
  // four catch-all slugs plus `prompt-caching-pricing-…` — but that piece already
  // homes in Prompts & Optimization (earlier via `caching`), so its destination is
  // unchanged. Net effect: exactly 4 catch-all → Agent Spend & Pricing, 0 others.
  // Remaining tokens (unit-economics/finops/chargeback/cost-per-run/budget-per-run/
  // cost-forecast) are reserved for future FinOps pieces and match nothing today.
  // `margin` is corpus-scanned to appear in ONLY how-to-price-a-per-token-ai-feature-
  // and-keep-your-margin (the per-token feature-pricing/gross-margin playbook) and in
  // no earlier cluster slug, so first-match-wins poaches nothing.
  // `completed-task-cost` added (2026-08-08): the model-migration cost test
  // (before-you-switch-agent-models-completed-task-cost-test, "price a model swap on
  // dollars-per-completed-task, not the rate card") is a FinOps decision — how much an
  // agent actually costs to run — so it rails with the spend/pricing pages. The token is
  // corpus-scanned to appear in exactly this one slug and in no earlier cluster regex
  // (the slug carries no gemini/migrate/framework token), so first-match-wins poaches nothing.
  ["Agent Spend & Pricing",  /(^|-)(spend|spending|pricing|price-an-ai-agent|unit-economics|finops|chargeback|cost-per-run|budget-per-run|cost-forecast|completed-task-cost|margin)(-|$)/],
  // Agent RELIABILITY / production-robustness is a distinct buyer-intent class from
  // the framework, eval, and gateway hubs: "why do agents fail in production and how
  // do I harden mine" decision/how-to pages — goal drift, tool-call error handling,
  // safe shipping, when-to-ask-for-help, resuming a dropped stream. Six were stranded
  // in the catch-all (ai-agent-goal-drift, ai-agent-tool-call-error-handling,
  // how-to-ship-ai-agent-changes-safely, when-should-an-ai-agent-ask-for-help,
  // why-ai-agents-fail-in-production, how-to-resume-a-dropped-agent-stream) because no
  // cluster carries a reliability/failure token. Placed LAST (same safety as the two
  // roll-ups + Agent Spend above): first-match-wins means this can only rescue
  // catch-all pieces, never poach an earlier cluster. Corpus-scanned (2026-07-09): the
  // regex also matches three already-homed pieces — `reliability` hits
  // llm-judge-reliability-vs-validity + pass-at-k-…-agent-reliability-evals (Evals &
  // Observability) and `circuit-breaker` hits circuit-breaker-for-llm-api-calls
  // (Inference & Gateways) — but all three home earlier, so their destinations are
  // UNCHANGED. Net effect: exactly 6 catch-all → Agent Reliability & Production, 0
  // others. Reserved tokens (resilience/fault-toleran/failure-mode/self-heal/
  // production-readiness/flaky-agent) match nothing today and await future pieces.
  ["Agent Reliability & Production", /(^|-)(goal-drift|tool-call-error-handling|error-handling|changes-safely|ask-for-help|fail-in-production|agents-fail|fail-silently|dropped-agent-stream|reliability|resilience|fault-toleran|failure-mode|circuit-breaker|self-heal|production-readiness|flaky-agent)(-|$)/],
  // Founder-facing NEWS & STRATEGY is a distinct buyer-intent class from the
  // engineering hubs above: not "which tool do I pick" but "what does this week's
  // AI news mean for the business I'm building" — global tech-news roundups and
  // founder playbooks (cost, lock-in, moat, distribution) aimed at solopreneurs /
  // founders / CEOs, not implementers. The two seed pieces (ai-news-for-founders-…,
  // how-to-choose-an-llm-api-without-lock-in) orphaned to the catch-all because no
  // cluster carries a founder/strategy token. Placed LAST (same safety as the roll-ups
  // above): first-match-wins means this can only rescue catch-all pieces, never poach
  // an earlier cluster. Corpus-scanned (2026-07-10): `founders` and `lock-in` each
  // appear in exactly one slug (their own), and both currently orphan, so the net
  // effect is exactly 2 catch-all → AI for Founders, 0 others. Reserved tokens
  // (for-founders/for-ceos/solopreneur/moat/go-to-market/fundrais/founder-guide/
  // news-roundup/weekly-ai/state-of-ai) match nothing today and await the recurring
  // founder-news format this cluster exists to collect.
  ["AI for Founders",        /(^|-)(founders|for-founders|for-ceos|solopreneur|lock-in|moat|go-to-market|fundrais|founder-guide|news-roundup|weekly-ai|state-of-ai)(-|$)/],
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
// High-signal evergreen NEWS/EXPLAINER pieces that belong to a cluster's head term
// but aren't buyer's guides — a Wire/Stack teardown like "vllm-rust-frontend" whose
// slug is neither "…-vs-…"/"best-"/"how-to-" nor carries a `compare:` table, so
// isComparisonPost() (and thus the cluster membership that draws hub link equity)
// skips it. Best-media practice (Verge Storystreams, NYT/Guardian topic pages)
// collects ALL topically-relevant pieces under the head-term hub, not only the
// guides. This returns those orphans for the ONE cluster whose regex they match
// FIRST — identical first-match-wins semantics to clusterLabelFor, so a piece can
// surface under at most one cluster and never poaches an earlier one. Comparison
// pieces are excluded (they're already in `posts`), the result is date-DESC and
// capped, and it's attached only on the standalone /comparisons/:slug page so it
// never dilutes the /comparisons index or the buyer's-guide sitemap. The catch-all
// (no regex) yields nothing.
export function comparisonClusterNews(label, d = db(), cap = 6) {
  const idx = COMPARISON_CLUSTERS.findIndex(([l]) => l === label);
  if (idx < 0) return [];                        // unknown label or the catch-all
  const out = [];
  for (const p of allPosts(d)) {                 // already date-DESC
    if (p.section !== "wire" && p.section !== "stack") continue;
    if (isComparisonPost(p)) continue;           // already a guide in some cluster's `posts`
    const s = String(p.slug || "").replace(/^\d{4}-\d\d-\d\d-/, "");
    const hit = COMPARISON_CLUSTERS.findIndex(([, re]) => re.test(s));
    if (hit !== idx) continue;                    // first-match-wins: only its home cluster
    out.push(p);
    if (out.length >= cap) break;
  }
  return out;
}
// One comparison cluster by its url slug, for the dedicated /comparisons/:slug
// page. Returns { label, posts, slug, indexable, news } or null when the slug
// doesn't match an indexable cluster (unknown slug, or the non-indexable
// catch-all). `news` is the capped set of head-term evergreen explainers (see
// comparisonClusterNews) — additive to, and never overlapping, `posts`.
export function comparisonClusterBySlug(slug, d = db()) {
  const c = comparisonClusters(d).find(c => c.slug === slug);
  if (!c || !c.indexable) return null;
  return { ...c, news: comparisonClusterNews(c.label, d) };
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
  // Compared-entity overlap is the primary signal, but many demand pieces in a
  // cluster share NO named entity — a news explainer (compared column = spec
  // revisions "2025-11-25"/"2026-07-28"), a best-/how-to- guide (no compare table
  // at all). Those all tie at zero entity overlap, so the rail fell straight back to
  // recency and surfaced the NEWEST cluster-mates over the most topically-related
  // ones (e.g. an MCP-auth piece railing `xcode-mcpbridge` above `mcp-confused-
  // deputy`/the other auth pages). Add a tertiary tie-break on shared slug+title
  // topic tokens — the same `topicTokens` signal #29's `relatedTo` already uses — so
  // within an equal-entity-overlap tier the closest-in-subject sibling wins, then
  // recency. Purely additive: entity overlap still dominates, so every entity-matched
  // rail is byte-identical; only the zero/equal-overlap tiers get reordered toward relevance.
  const selfTopic = topicTokens(self);
  const topicOverlapWith = p => { let n = 0; for (const w of topicTokens(p)) if (selfTopic.has(w)) n++; return n; };
  // candidates arrive newest-first (allPosts is date-DESC). Sort is stable, so the
  // `a.i - b.i` final tie-break preserves that recency order within an equal tier.
  const sibs = posts
    .filter(p => p.slug !== slug && clusterLabelFor(p) === label)
    .map((p, i) => ({ p, i, overlap: overlapWith(p), topic: topicOverlapWith(p) }))
    .sort((a, b) => b.overlap - a.overlap || b.topic - a.topic || a.i - b.i)
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
  // the data-plane variant of the RCE band: the injection rides in on ordinary
  // telemetry the agent reads as trusted (a Sentry error posted with a public,
  // write-only DSN — no breach), not through the tool or server the poisoning
  // pieces above guard. Sits with the coding-agent RCE cluster because the payoff
  // is the same (arbitrary command with the developer's privileges) and the fix is
  // the same predicate-gated approval the tool-approval piece below establishes.
  "agentjacking-sentry-mcp-attack",
  "amazon-q-rce-coding-agent-folder-trust",
  "cursor-duneslide-sandbox-escape-rce",
  "autojack-ai-agent-localhost-rce",
  // the real-world proof of the RCE band's stakes, and the first AI-agent platform
  // in CISA's KEV: Langflow. Two opposite bug classes — an unauthenticated exec()
  // RCE and an authenticated cross-tenant IDOR — converge on the identical payload
  // ("leak api keys"), because an agent-orchestration platform IS a credential
  // vault. Sits in the RCE band as the incident that generalizes the whole cluster:
  // reach a flow, and the flow hands you every model + cloud key it holds.
  "langflow-cve-2026-55255-kev-credential-theft",
  "ai-browser-prompt-injection",
  "ai-agents-finding-zero-days",
  "openclaw-self-hosted-agent-security-risk",
  "mcp-tool-poisoning-rug-pulls",
  // the agent-skills supply chain: open registries ship instruction-level payloads
  // (26–36% carry prompt injection in 2026 scans), and unlike the tool-poisoning
  // above the classic fix doesn't fit — a skill's payload is language the model
  // obeys with the agent's full authority, so it bridges straight into the sandbox
  // band below (you can't jail a sentence).
  "2026-07-07-agent-skills-supply-chain-security",
  // the defensive control the supply-chain piece leaves hanging: you can't jail a
  // sentence, but you CAN gate the action it triggers. In 2026 the big frameworks
  // converged on tool/skill-call approval (Microsoft made it the default for
  // skills-sourced tools; LangChain/OpenAI ship interrupt_on / needsApproval). The
  // real primitive is the predicate — gate by category + argument, not blanket —
  // which relocates trust from the artifact to the call site. Sits right after the
  // supply-chain attack, before the isolation band, as the architectural answer.
  "2026-07-07-agent-tool-approval-becomes-a-framework-default",
  "mcp-server-ssrf-cloud-metadata-credentials",
  "your-container-is-not-a-sandbox",
  "firecracker-vs-gvisor-vs-kata-agent-sandbox-isolation",
  "wasm-vs-microvm-vs-v8-isolate-sandbox-ai-code",
  // the orchestration answer that closes the isolation band: once you've picked a
  // strong runtime (gVisor/Kata above), you still have to run a million of these
  // isolated sandboxes at fleet scale — and Kubernetes had no primitive for a
  // stateful singleton with a stable identity. The kubernetes-sigs Sandbox CRD adds
  // it, plus a warm pool that turns a seconds-long boot into a millisecond handoff.
  // Sits after the runtime-choice pieces as the "now run them at scale" spoke.
  "kubernetes-agent-sandbox-warm-pool",
  "multi-tenant-ai-agent-tenant-isolation",
  "secrets-management-for-ai-agents",
  "how-to-authenticate-an-ai-agent-identity",
  // the workload-identity foundation under the auth band: SPIFFE/SPIRE (CNCF-graduated)
  // gives an agent runtime a secretless, attested, short-lived identity — killing the
  // long-lived API key that secrets-management-for-ai-agents warns about — and hands the
  // on-behalf-of/delegation half to OAuth token exchange (RFC 8693) + the MCP OAuth 2.1
  // pieces below. Sits right after the "how do I authenticate an agent identity" query.
  "spiffe-spire-workload-identity-for-ai-agents",
  "how-to-authenticate-a-remote-mcp-server",
  "mcp-confused-deputy-problem",
  "2026-06-22-mcp-authorization-oauth",
  "web-bot-auth-explained-ai-agents",
  "x401-protocol-agent-authorization",
  "2026-06-22-rebuff-vs-llm-guard-vs-vigil-prompt-injection",
  "guardrails-ai-vs-nemo-guardrails-vs-llama-guard",
  "garak-vs-pyrit-vs-promptfoo",
  "rampart-red-teaming-ai-agents-ci",
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
  // the ingestion-side extraction step that feeds the chunkers above: turning a long
  // source document into grounded, structured fields (each mapped to exact source
  // offsets) before it's chunked and embedded — the provenance analogue, at field
  // granularity, of the citation work the retrieval pieces care about downstream.
  "langextract-grounded-structured-extraction",
  "best-embedding-models-for-rag-agents",
  "voyage-vs-openai-vs-cohere-vs-gemini-embeddings",
  "matryoshka-embeddings",
  "how-to-migrate-embedding-models-in-production",
  "brute-force-vs-approximate-vector-search",
  "best-vector-database-for-ai-agents",
  "best-vector-database-for-multi-agent-systems",
  "pgvector-vs-pinecone-vs-qdrant",
  "qdrant-vs-milvus-vs-weaviate",
  // the write-path/operational counterpart to the engine comparison above: once
  // you've chosen an engine on read-path terms (filtered search, hybrid, recall),
  // the substrate question is what you have to OPERATE for writes to be durable —
  // Milvus 2.6 dropping Kafka/Pulsar for an object-storage WAL (Woodpecker) is the
  // sharpest example, and it matters most for write-heavy agent-memory workloads.
  "milvus-woodpecker-wal-object-storage",
  // the scale-out counterpart to the engine/operate pieces above: once one node's
  // index no longer fits in RAM, the vector store must distribute, and unlike a
  // relational table vectors resist key-based sharding (neighbors live in geometry,
  // not keys) — so the real decision is scatter-gather vs centroid routing, which is
  // the recall/latency/cost triangle every billion-scale retrieval system pays.
  "vector-database-sharding-at-billion-scale",
  "hnsw-vs-ivf-vs-diskann",
  "how-to-tune-hnsw-vector-search",
  // the update-path counterpart to the two build-time index pieces above: HNSW/DiskANN
  // are build artifacts that fray under churn and get periodically rebuilt, whereas an
  // SPFresh-class index (Weaviate's HFresh) rebalances in place — splitting/merging
  // posting lists and reassigning only boundary vectors — so the real index-choice axis
  // for a changing corpus is write pattern, not the frozen-dataset recall benchmark.
  "vector-index-in-place-updates-no-rebuild",
  "2026-06-24-hybrid-search-bm25-vs-dense-vs-rrf",
  // the productized counterpart to the hybrid-search theory above: what a real
  // single-index engine actually does when it folds BM25 into a vector store.
  // Pinecone's full-text preview puts text/dense/sparse in one index, but a
  // request ranks by ONE score_by — so "true hybrid" is either lexical-as-filter
  // or two searches fused client-side with RRF. The concrete lesson the RRF piece
  // above sets up: consolidating storage does not consolidate ranking.
  "pinecone-full-text-search-bm25-one-index-not-one-query",
  // the exact-match retrieval mode the hybrid/sparse pieces above don't cover: FTS/BM25
  // tokenizes text into words, so it structurally can't match a fragment inside a token
  // (a file path, a UUID, a code symbol, an error code buried in a log line). LanceDB's
  // FM-Index (a Burrows-Wheeler/compressed-suffix scalar index) indexes the raw bytes, so
  // contains() becomes an indexed lookup instead of a full scan — the substring primitive
  // code- and log-search agents need alongside dense and sparse retrieval.
  "lancedb-fm-index-substring-search",
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
  // the storage-substrate call taken one level deeper: once memory lives in a vector
  // store, WHERE that store runs (a hosted server vs an in-process on-device engine)
  // is its own high-intent decision — sqlite-vec/ObjectBox/Qdrant Edge. Sits right
  // after the filesystem-vs-vector-DB fork it continues.
  "on-device-vector-search-agent-memory",
  "mem0-vs-zep-vs-letta-agent-memory",
  "langmem-vs-mem0",
  "telemem-vs-mem0",
  // the verbatim challenger that closes the frameworks band: every framework above
  // extracts/summarizes at write time; MemPalace tops LongMemEval by doing the
  // opposite (store everything raw, no LLM), which reframes the whole extract-vs-
  // verbatim choice — the natural bridge from "which extractor" into evaluation.
  "mempalace-verbatim-agent-memory-longmemeval",
  // the representation debate one level up: MemPalace argues verbatim-vs-extract at
  // write time; Memora (learned, benchmark-optimal index) vs Wiki Memory (legible,
  // human-editable files) argues opaque-vs-auditable at read time — the natural
  // bridge from "how to store" into "what the benchmarks below actually measure".
  "memora-vs-wiki-memory-agent-memory",
  "how-ai-agents-forget-memory-consolidation",
  "claude-dreaming-agent-memory-consolidation",
  // the other half of memory maintenance: forgetting drops what's stale, but when two
  // stored copies of the same fact disagree, something has to pick the winner. This
  // piece argues that decision belongs in deterministic code, not the LLM — and because
  // "conflict resolution" is itself a graded MemoryAgentBench competency, it's the
  // natural bridge from how memory updates itself into how the benchmarks below score it.
  "agent-memory-conflict-resolution-deterministic-vs-llm",
  "how-to-evaluate-ai-agent-memory",
  "how-to-read-an-agent-memory-benchmark",
  "locomo-vs-longmemeval-vs-beam-agent-memory",
  "ai-agent-memory-benchmarks-locomo-mem0-zep",
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
// (server cards, the registry, the ARD cross-vendor discovery spec, shipping
// servers as OCI artifacts) → security
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
  // the productized, default-on version of the expose-as-MCP spoke above: LangChain
  // renamed LangGraph Platform to LangSmith Deployment and now hands every deployed
  // agent an MCP endpoint automatically. Slots right after the hand-rolled how-to as
  // "…and here's what happens when a platform does it for you by default (incl. the
  // security surface that creates)."
  "langgraph-platform-langsmith-deployment-mcp-endpoint",
  "stainless-alternatives-sdk-mcp-generators",
  "mcp-stdio-vs-sse-vs-streamable-http",
  "mcp-goes-stateless-2026-07-28-spec",
  // the same 2026-07-28 spec that dropped sessions also added cache directives
  // (ttlMs + cacheScope, SEP-2549) to the list/read results — the third leg of
  // "make MCP behave like plain HTTP so it scales on ordinary HTTP infra." Slots
  // right after the stateless spoke as the "…and here's how the same release lets
  // a server sit behind a CDN, plus the cacheScope footgun that ships with it."
  "mcp-caching-ttlms-cachescope",
  // the same stateless rewrite that let a server sit behind a CDN also deleted the
  // Mcp-Session-Id that ops teams used as the de-facto correlation anchor for an
  // agent's tool calls. This spoke is the observability leg of "make MCP behave like
  // plain HTTP": the 2026-07-28 RC reserves W3C Trace Context keys (traceparent/
  // tracestate/baggage) in _meta so a trace can follow a tool call across services —
  // with the sharp catch that a trace id is not a session/tenant identity and baggage
  // is mutable, so repurposing traceparent for authz or rate limiting rebuilds the
  // thing the spec removed on a field that will lie. Slots right after caching (both
  // are consequences of statelessness) and before the governance/deprecation spoke.
  "tracing-mcp-tool-calls-without-sessions",
  // the delivery-side leg of the same statelessness thread. Caching and tracing are
  // what the dropped session *lets* you do and *costs* you in observability; this
  // spoke is the reliability bill: the Mcp-Session-Id the 2026-07-28 RC removed was
  // also the anchor for SSE stream resumption (Last-Event-ID replay), so a client
  // that reconnects can no longer be handed the events it missed from process memory.
  // The sharp point — durable execution (server crash) and stream resumption
  // (connection drop) are orthogonal, and statelessness pushes the replay buffer out
  // of a protocol-kept session and into shared infra you now operate. Slots right
  // after tracing (both are operational consequences of dropping the session) and
  // before the governance/deprecation spoke.
  "how-to-resume-a-dropped-agent-stream",
  // stateless + caching make MCP behave like plain HTTP; the third leg of "MCP is
  // maturing into a governed standard" is how features now age out. The 2026-07-28
  // RC ships SEP-2596, the protocol's first feature-lifecycle/deprecation policy
  // (Active→Deprecated→Removed, ≥12-month floor). This spoke is the direct explainer
  // of that policy: what the 12-month guarantee covers, why "deprecated" (Sampling/
  // Roots/Logging) still works, and the sharp catch — the guarantee is a property of
  // the CORE, while Tasks/Apps live in independently-versioned Extensions outside it.
  // Slots after caching as the primary governance/evolution spoke.
  "mcp-deprecation-policy-12-month-guarantee",
  // …and the application of that same lifecycle thinking to your OWN tools: the
  // versioning piece uses SEP-2596 as its model and flags the layer a deprecation
  // policy can't cover — the model reads a tool's schema as a prompt, so a
  // backward-compatible change can still be a behavioral regression.
  "versioning-ai-agent-tools-schema-evolution",
  "mcp-server-cards-well-known-discovery",
  "the-official-mcp-registry-explained",
  "agent-registry-vs-mcp-registry-discovery",
  "agentic-resource-discovery-ard-vs-mcp",
  "how-to-distribute-an-mcp-server-oci-vs-registry",
  // once discovery/distribution hands an agent thousands of MCP servers, the next
  // problem is runtime, not finding: their tool definitions don't fit in context,
  // and over a multi-turn conversation the ones you loaded never leave. Sits right
  // after the distribution block as the "…and now how does the agent not drown in
  // them" spoke — dynamic loading is half, dynamic removal (reasoning-gated) is the
  // half nobody optimized. Bridges discovery into the scale benchmarks below.
  "dynamic-mcp-tool-management-multi-turn-agents",
  // dynamic-management handles one half of "don't drown in context" — the tool
  // *definitions* that pile up and never leave. This spoke is the other half: a
  // single tool *result* too large to fit, at the one boundary MCP never paginated
  // (the spec cursors tools/list and resources/list but not tool results, per
  // discussion #2211). The sharp point — truncating to a byte limit is strictly
  // worse than the alternatives because it erases the model's ability to tell an
  // empty result from a clipped one; the durable fix is to return a handle (path/
  // resource id + preview) and let the agent page or grep it just-in-time. Slots
  // right after the definitions-drowning spoke as its natural companion.
  "tool-result-too-large-for-context-window",
  // dynamic-management answers "how do we not drown once thousands of tools exist";
  // this spoke answers the prior question — "how many should the agent even see, and
  // how do we know the retriever earned it." The sharp point: the recall/Success@K
  // number teams grade tool-retrieval on is inflated by chance (a wide shortlist
  // contains the right tool at random), so a chance-corrected metric (Bits-over-Random)
  // shows retrievers a leaderboard calls excellent are near-random past a coverage
  // threshold — and the surplus tools cut the model's own selection accuracy while
  // multiplying tokens. Slots right after dynamic-management as the "how few, measured
  // honestly" answer that feeds straight into the scale benchmarks below.
  "how-many-tools-should-an-ai-agent-have",
  // how-many-tools measures the *token* cost of surplus tool definitions; this spoke
  // measures the *spend* of the tool calls you keep — the half of the agent bill a
  // token meter can't see, because an MCP tool call is a function invocation with no
  // token price of its own. The sharp point: a tool call's true cost is two bills
  // fused (its own invocation + the tokens its result injects into every later turn),
  // so only a component sitting between the agent and BOTH the MCP servers and the
  // model can meter it — which is why LiteLLM v1.91.0 rolled MCP tool spend into the
  // same gateway that already tracks tokens, and why per-tool spend attribution is the
  // FinOps chokepoint. Slots after the tool-count economics spoke, before the auth block.
  "mcp-tool-call-cost-tracking-gateway",
  "2026-06-22-mcp-authorization-oauth",
  // the authorization model as it actually ships: X's first-party hosted MCP server
  // scopes agents to the user's own OAuth permissions and exposes read but not write.
  // A production embodiment of the auth/permissions spoke, right after the OAuth explainer.
  "x-hosted-mcp-server-read-only",
  // OAuth answers "who can call"; the tool annotations (readOnlyHint/destructiveHint/
  // idempotentHint/openWorldHint) are the client-side risk vocabulary for "should we
  // ask before this call runs." The spoke's sharp point — the defaults are pessimistic
  // by omission, and each is a hint a lying server can forge, so they shape the
  // confirmation UX but are never the safety boundary. Slots between the read/write
  // scoping embodiment and the confused-deputy failure it sets up: over-trusting a
  // forged readOnlyHint is exactly how the deputy gets confused.
  "mcp-tool-annotations-explained",
  // annotations shape the confirmation UX for a *text* tool call; MCP Apps
  // (SEP-1865, shipped as an official Extension in the 2026-07-28 RC) lets a
  // server render an *interactive* UI in a sandboxed iframe — and the same
  // "the UX signal is not the safety boundary" lesson applies harder here. The
  // iframe sandbox only walls off DOM/cookies/storage and CSP-gates egress;
  // every UI-initiated tools/call still routes through the ordinary consent
  // path, so the extension expands what a server can *show*, not what it can
  // *do*, and the new surface is interface-driven persuasion of that consent.
  // Slots after annotations (same consent-vs-safety thread) and before the
  // confused-deputy failure it makes more vivid.
  "mcp-apps-explained",
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
  // the ADK-side sequel to that comparison: 2.0 retires the agent-type hierarchy
  // (the very thing that distinguished ADK from LangGraph above) for a graph-based
  // Workflow Runtime — the concrete instance of "every framework became a graph".
  "google-adk-2-workflow-runtime",
  "langgraph-vs-microsoft-agent-framework",
  "langchain-vs-langgraph",
  "langchain-1-0-and-langgraph-1-0-whats-new",
  "what-are-deep-agents",
  "deep-agents-on-pydantic-ai-self-hosted-claude-code",
  // the Deep Agents family's next chapter: the library split into a model-agnostic
  // harness plus separately-shipped packages — deepagents-code (a terminal coding
  // agent) and deepagents-acp (an Agent Client Protocol adapter) — unbundling the
  // coding agent from both the model and the editor. The harness→product-line move
  // that "from-framework-to-harness" (below) predicts, made concrete.
  "deepagents-code-acp-langchain-coding-agent",
  // orchestration patterns — the topology decision comes first (pipeline vs
  // orchestrator-worker vs swarm, chosen by how much context can be lost between
  // agents), then the specific control-flow patterns (supervisor/swarm/handoffs).
  "orchestrator-worker-vs-pipeline-multi-agent",
  "multi-agent-orchestration-supervisor-vs-swarm-vs-handoffs",
  // the cost half of the topology decision: once workers can spawn their own
  // workers (Claude Code's nested subagents, depth 5), the token bill grows with
  // total work anywhere in the tree — sits after the topology pieces as the
  // "what does going deeper actually cost" answer.
  "claude-code-nested-subagents-token-cost",
  // …and the enforcement answer to that cost: the spend that empties a budget lives
  // in the loop (many calls, each with a growing context), not the reply, so max_tokens
  // guards the wrong door. Slots right after the tree-cost spoke as the "now put a hard
  // ceiling on it" primitive — a per-run iteration + dollar cap enforced in the gateway
  // (LiteLLM max_iterations/max_budget_per_session), failing closed, not a prompt hint.
  "how-to-cap-an-ai-agent-spend-per-run",
  // the framework-level *cause* of the cost those guards cap: the agent loop's own
  // data structure sets the bill. DSPy's ReActV2 (3.3.0b1) shows why — the classic
  // ReAct trajectory was re-serialized into one growing prompt each turn, mutating its
  // own prefix so provider prompt caching never fired; moving to structured dspy.History
  // makes the prefix append-only and cacheable (DSPy reports up to 50% cost cuts). Sits
  // after the spend-cap spoke as the "why the loop costs what it costs" answer.
  "dspy-reactv2-native-tool-calling",
  "crewai-flows-vs-crews",
  // the framework's storage un-bundling — pluggable memory/knowledge/RAG backends
  // as the production-maturity signal in the CrewAI line.
  "crewai-1-14-pluggable-memory-backends",
  // the CrewAI line's next chapter (1.15): conversational flows — @persist turns a
  // fire-once flow resumable, and why that is NOT the same store as 1.14's memory.
  "crewai-conversational-flows-explained",
  "agent-handoffs-langgraph-openai-adk",
  "from-framework-to-harness",
  // the meta-harness — one level above the harness: Databricks' Omnigent orchestrates
  // Claude Code/Codex/Cursor behind one YAML interface, so it sits right after the
  // framework→harness piece as the "harness→meta-harness" next step in the progression.
  "omnigent-databricks-meta-harness",
  "langgraph-checkpointing-vs-temporal-durable-execution",
  // the write-amplification cost of durable checkpoints and the 1.1–1.2 fixes
  // (DeltaChannel, per-node timeouts, v2 streaming) — sits with the durable-execution
  // pieces since it's the runtime-cost half of the same story.
  "langgraph-delta-channels-durable-agent-checkpoints",
  // the dedicated deep-dive on the per-node-timeout knob the piece above only names:
  // run_timeout (hard wall-clock) vs idle_timeout (resets on progress), and why a
  // streaming model node wants the idle clock — the reliability-primitive spoke of
  // the same durable-execution band.
  "langgraph-node-timeouts-run-vs-idle-timeout",
  // the fault-tolerance sibling of the timeout knob above, from the same 1.2
  // add_node surface: what happens AFTER retries are spent. The sharp point is
  // that the three failure primitives aren't interchangeable — a timeout clears
  // the attempt's writes, drain preserves them, and error_handler is the only one
  // that lets you compensate (return a Command, route to an undo node) — so it's
  // the native Saga primitive the durable band was missing. Sits right after the
  // timeout spoke as the "and when it fails for real" answer.
  "langgraph-node-error-handlers-saga-compensation",
  // the same durability question from the framework's own angle: Pydantic AI now
  // exposes four co-maintained durable backends behind one public interface, so
  // "which one" becomes an ops decision, not a framework one. Sits in the durable
  // band as the "pick your engine" spoke after the LangGraph-checkpointing pieces.
  "pydantic-ai-durable-execution-backends",
  // durable execution keeps the *server-side* work alive across a crash; this is the
  // *client-side* other half — how an ephemeral, sandboxed agent process actually waits
  // for that long-running result. The sharp point: the agent runtime deletes the
  // webhook's core assumption (a publicly-reachable client), so agent-native async
  // surfaces (the MCP 2026-07-28 Tasks extension, tasks/get) went poll-first. Closes the
  // durable band as the "how do you collect the result" spoke before the JS/TS stack.
  "webhooks-vs-polling-for-long-running-agent-tasks",
  "mastra-vs-vercel-ai-sdk-vs-langgraph-js",
  // the control-layer alternative that isn't a graph at all: instead of owning the
  // topology (the whole line above) you declare behavior as matched-per-turn guidelines
  // and let an engine assemble the context. Closes the hub as the "not a graph" answer
  // to the same reliability problem every framework above is trying to route around.
  "parlant-agents-that-follow-instructions",
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
  // the engine band's 2026 capstone: TGI, one of the options above, is now archived
  // read-only. This piece is the migration-off + the transformers-as-backend shift
  // (a model defined once in `transformers`, loaded by vLLM/SGLang) that replaced it —
  // the decisive "which engine" news a reader on this band needs.
  "text-generation-inference-tgi-archived-migrate-off",
  // the engine band's internals capstone: the comparisons above tell a reader WHICH
  // engine; this tells the ones who picked vLLM what changed underneath it in mid-2026.
  // v0.24 makes Model Runner V2 (the from-scratch execution-core rewrite) the default
  // and lands a Rust serving front-end — and the throughput win is an overhead story
  // (eliminating the CPU–GPU sync stall via async overlap), not a hotter kernel. The
  // natural next read for a vLLM adopter, and the bridge from "which engine" to the
  // serving-throughput band below.
  "vllm-v0-24-model-runner-v2-rust-frontend",
  // the engine band's other-vendor internals capstone, and the direct sequel to the TGI
  // archival above: NVIDIA's TensorRT-LLM is removing the TensorRT engine backend (the
  // v1.3.0rc20 note — "the last one supporting the TensorRT backend") in favor of its
  // PyTorch-native runtime. Same arc as TGI and vLLM's from-scratch runner — the flexible
  // eager runtime beats the ahead-of-time compiled one because model velocity outweighs
  // the last points of kernel peak. The migration read for anyone pinning TRT engine builds.
  "tensorrt-llm-removing-tensorrt-backend",
  // which accelerator — Nvidia datacenter GPUs first, then the "beyond Nvidia" arc:
  // AMD's cross-vendor GPU, the hyperscaler custom silicon (Google TPU, AWS Trainium),
  // the frontier-lab custom inference ASIC (OpenAI's Jalapeño), then specialty
  // fast-inference startups. This band owns the whole "which chip serves my model"
  // decision, and the non-Nvidia accelerators are where the 2026 cost story moved.
  "2026-06-22-gpu-for-llm-inference-h100-vs-h200-vs-a100-vs-l40s",
  "b200-vs-h200-vs-h100-llm-inference",
  "amd-mi300x-vs-nvidia-h100-llm-inference",
  "tpu-vs-gpu-llm-inference",
  "trainium-vs-nvidia-gpu-llm-inference",
  "openai-jalapeno-inference-chip",
  // the custom-silicon arc's control-plane footnote: as inference becomes agent
  // loops (short generation → tool call → branch), a rising share of wall-clock is
  // host-CPU control flow, not matmul. Tenstorrent's RISC-V agent-runtime CPU is the
  // "which chip" story extended off the accelerator and onto the core that feeds it.
  "tenstorrent-tt-ascalon-s-cpu-for-agents",
  "groq-vs-cerebras-vs-sambanova-fast-inference",
  // the on-device fork of "which accelerator" — a desktop unified-memory box, not a
  // datacenter GPU. Owns the distinct "local LLM inference hardware" sub-query and
  // carries the memory-bandwidth-wall lesson the whole accelerator group turns on.
  "dgx-spark-for-local-ai-agents",
  // the "where do I rent the datacenter GPUs" companion to the accelerator band: once
  // you've picked a chip, availability — not price — decides the provider. The GPU
  // neocloud buyer's guide (CoreWeave vs Lambda vs Nebius) is the bridge from "which
  // silicon" to "which cloud serves my model," and its thesis is inference-native:
  // reserved bare-metal clusters suit training runs, per-token serverless suits agents.
  "coreweave-vs-lambda-vs-nebius-gpu-cloud",
  // the market-context companion to the neocloud buyer's guide above: once a reader
  // knows *which* neocloud rents the GPUs, this piece answers *why* the neutral
  // open-model neocloud is where inference spend is pooling. Together AI's $800M raise
  // is the market proof of this band's own recurring thesis — agent loops make many
  // cheap calls, so per-token price dominates and the margin migrates from the frontier
  // lab to the metered serving layer. The strategic "why" behind the whole cost story.
  "together-ai-800m-open-model-inference-economics",
  // serving throughput & scaling
  "continuous-batching-vs-static-batching",
  "2026-06-23-prefill-vs-decode-llm-inference",
  "2026-06-23-tensor-parallelism-vs-pipeline-parallelism",
  "2026-06-22-bentoml-vs-ray-serve-vs-kserve",
  // decode & attention acceleration
  "2026-06-22-speculative-decoding-eagle-vs-medusa",
  "mha-vs-mqa-vs-gqa-vs-mla-attention",
  "flashattention-vs-pagedattention-vs-flashinfer",
  // the attention band's on-device capstone: PyTorch 2.13 (July 8, 2026) brought the
  // fused FlexAttention kernel to Apple Silicon's MPS backend (~12x over SDPA on sparse
  // patterns), so custom-mask attention runs fast on a Mac, not just a datacenter GPU.
  // The news piece carries the what-it-means; the how-to carries the block_mask code —
  // the on-device counterpart to the FlashAttention/PagedAttention datacenter spoke above.
  "pytorch-2-13-flexattention-apple-silicon-founders",
  "flexattention-apple-silicon-block-mask-how-to",
  // the KV cache
  "2026-06-23-kv-cache-quantization-fp8-vs-int8-vs-int4",
  "kv-cache-eviction-streamingllm-vs-h2o-vs-snapkv-vs-quest",
  "kv-cache-offloading-lmcache-vs-mooncake-vs-dynamo",
  // sampling & tokenization (output control)
  "temperature-vs-top-p-vs-top-k-llm-sampling",
  // the reproducibility footnote to the sampling knobs: temperature 0 is necessary but
  // not sufficient — batch-invariance (server-side batch size changing kernel reduction
  // order) is the real reason "deterministic" inference still isn't. Belongs on this band
  // because it's the output-control question a reader hits right after the sampling one.
  "why-llms-are-not-reproducible-at-temperature-0",
  "tiktoken-vs-sentencepiece-vs-huggingface-tokenizers",
  // the gateway / router in front
  "2026-06-21-litellm-vs-portkey-vs-tensorzero",
  "open-source-ai-gateway-self-hosted",
  "openrouter-vs-litellm",
  "2026-06-21-routellm-vs-notdiamond-vs-martian",
  // the gateway band's advanced capstone: the routers above are app-layer HTTP proxies
  // that pick a model. The vLLM Semantic Router runs one layer down as an Envoy ext_proc
  // filter and routes on a dimension they don't expose — whether to enable reasoning at
  // all — which on MMLU-Pro raised accuracy while cutting tokens. The natural next step
  // for a reader who's chosen a model router and wants routing as data-plane infra.
  "vllm-semantic-router-when-to-reason",
  // latency & cost operations
  "llm-inference-latency-ttft-vs-tpot",
  "how-to-reduce-ai-agent-latency",
  "how-to-reduce-ai-agent-token-costs",
  // the sharpest single cost lever — never make the call — with the agent-specific
  // caveat the chatbot literature skips: an agent acts on a cache hit, so a false hit
  // is a wrong action, not a wrong sentence. Belongs on the cost band because it's the
  // "skip the model" technique, but it earns its place by explaining why the naive
  // version (raw cosine similarity) scores under 40% on agent tasks and why intent
  // canonicalization, not classification accuracy, is the fix.
  "semantic-caching-breaks-ai-agents-intent-canonicalization",
  "batch-api-vs-real-time-llm-inference",
  // the agent-specific companion to the batch explainer above: the general piece routes
  // by who is waiting; this one explains the structural reason an agent's loop can't be
  // batched (step N depends on step N-1), where the 50% discount is actually reachable
  // (the parallel, latency-tolerant periphery — embeddings, evals, memory summarization),
  // and why the real in-loop lever is fewer sequential round-trips, not cheaper tokens.
  "batch-inference-api-for-ai-agents-when-the-50-percent-discount-doesnt-apply",
  // the capacity-planning capstone of the ops band: once you know your engine, chip and
  // cost knobs, the last operational question is "how many GPUs does this agent actually
  // need?" — and for a multi-agent workflow that's a load test, not a formula, because the
  // token/latency footprint is emergent from the trajectory. NVIDIA's NeMo Agent Toolkit
  // sizing calculator is the concrete tool that owns that high-intent query.
  "nemo-agent-toolkit-gpu-sizing-calculator",
  // the reliability/geography closer to the ops band: once you've picked an engine,
  // chip, cloud, and gateway, the last serving decision is where a request runs when a
  // region is busy. Managed cross-region inference (Bedrock/Azure) solves uptime but
  // trades away prompt-cache locality and data residency — the "which invariant do I
  // sacrifice" call the latency and cost pieces above set up but don't resolve.
  "multi-region-llm-failover",
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
  // the data substrate the eval sits on: a RAG eval is irreproducible when the corpus
  // mutates in place, so last week's number can't be re-run. The reliability/validity
  // spokes below fix the *judge*; this one fixes the *data* — LanceDB 0.34.0 table
  // branches make the corpus a git repo (zero-copy fork off main, isolated writes), so
  // you pin an eval to an immutable state and A/B a re-embedding as a branch-vs-main
  // diff instead of a two-cluster experiment. The sharp point: the RAG-eval unlock was
  // never a cleverer metric, it was versioned data infra applied to the one asset still
  // mutated in place. Slots in the building-the-eval band, right after the dataset spoke.
  "lancedb-table-branching-reproducible-rag-evals",
  "how-to-add-llm-evals-to-ci-cd",
  // the judge — the measurement instrument
  "2026-06-21-llm-as-a-judge",
  "llm-judge-bias",
  // reliability vs validity: the judge can be consistent AND wrong — the axis the
  // bias piece doesn't cover, and the reason "pin the judge" isn't a validity fix
  "llm-judge-reliability-vs-validity",
  "agent-as-a-judge-vs-llm-as-a-judge-trajectory-evals",
  // the theory beneath the judge: why a separate verifier beats self-assessment
  // (the generator-verifier gap) — the reason external judging works at all
  "agent-self-correction-reflexion-vs-self-critique",
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
  // the function-calling benchmark that anchors "best model for tool use" — and its v4
  // pivot from single-shot AST accuracy to agentic/multi-turn, which is the story this
  // benchmarks band needs alongside the tau-bench pair.
  "berkeley-function-calling-leaderboard-bfcl-v4",
  "swe-evo-vs-swe-bench-long-horizon-coding-agents",
  // the multi-turn/interactive coding benchmark — the sibling to swe-evo's long-horizon
  // and BFCL v4's single-shot→agentic pivot: scores not just correctness but how much
  // corrective steering a success took (User Correction), the axis a static run can't see.
  "swe-together-vs-swe-bench-multi-turn-coding-benchmark",
  "gaia2-benchmark-asynchronous-agents",
  "benchmarks-are-theater-now",
  // observability & the eval/tracing platforms in production
  "how-to-monitor-an-ai-agent-in-production",
  "the-trace-is-the-new-log",
  // what the platform layer now does with those traces: the 2026 shift from a
  // passive dashboard to an agent that auto-investigates on alert/SLO/anomaly.
  // Honeycomb's Canvas Agent is the concrete instance — and it reads standard OTel
  // GenAI spans, so it slots right after "the trace is the new log": once you emit
  // the trace, this is the tooling that acts on it without a proprietary SDK.
  "honeycomb-canvas-agent-auto-investigations",
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
  // …and which of them is cheapest now that the free floor moved (Codex → $0,
  // Gemini CLI retired for Antigravity) — the cost decision that follows the CLI pick
  "cheapest-terminal-coding-agent-august-2026-free-floor",
  // …and what a run actually costs once you pick the model behind the harness — the
  // per-task token math (input-heavy loops, caching, the Opus tokenizer bump) across
  // Opus 5 / GPT-5.6 / Gemini / Kimi K3 / DeepSeek / Qwen, refreshed for Aug 2026 prices
  "what-it-costs-to-run-a-coding-agent-august-2026",
  // the agentic IDEs
  "google-antigravity-vs-cursor-vs-claude-code",
  // autonomous / background agents
  "devin-vs-codex-vs-cursor-vs-jules-background-agents",
  // the open-source coding agents
  "opencode-vs-claude-code",
  "aider-vs-cline-vs-openhands",
  "cline-vs-roo-code-vs-kilo-code",
  // the AI app builders (prompt → running app)
  "lovable-vs-bolt-vs-v0-vs-replit-ai-app-builder",
  // the interop layer — how any agent plugs into any editor
  "agent-client-protocol-acp-vs-mcp",
  // which model runs behind the harness — pointing Claude Code at an open/cheaper
  // model's Anthropic-compatible endpoint, and the harness features that silently drop
  "open-models-in-claude-code-anthropic-compatible-endpoint",
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
  // keeping a parallel run from running away — the session-scoped spawn/web-search
  // caps (Claude Code 2.1.212) that bound the fan-out the worktree piece enables
  "how-to-cap-runaway-claude-code-subagents-web-searches",
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
// The /topics/model-selection hub — the NINTH curated topic hub, mirroring the eight
// before it. "Models & LLM APIs" was the single largest COMPARISON_CLUSTER (40+ pieces)
// yet nothing owned its enormous head query — "which LLM for AI agents" / "best model
// for agents" / "GPT vs Claude vs Gemini." The per-article "X vs Y" pages each rank for
// their own pairing but there was no roll-up funnelling that link equity onto one URL
// or giving a reader the ordered decision. This hub does, in the order you actually
// decide: the head cross-provider comparison → the closed frontier tiers (each vendor's
// flagship-vs-cheaper split) → the open-weight field → small models → architecture and
// token economics that move the cost → the open-vs-closed and local strategy. Curated
// editorially (like the other hubs, not a slug regex); slugs validate against the corpus
// at read time so a renamed or removed piece drops out rather than 404-ing.
export const MODELS_HUB_SLUGS = [
  // the head decision — which family, across providers
  "claude-vs-gpt-vs-gemini-for-ai-agents",
  // its price companion — the cross-provider price/tier MAP: which tier per workload,
  // with real per-token prices across all vendors (the piece the per-vendor tier
  // spokes below don't cover, because each is one lab's ladder, not the whole field).
  "agent-model-price-map-august-2026-what-to-run-each-workload",
  // the closed frontier, tier by tier — flagship vs the cheaper sibling within a vendor
  "gpt-5-6-sol-vs-terra-vs-luna",
  "gpt-5-6-sol-for-agents-metr-reward-hacking",
  "claude-sonnet-5-vs-opus-4-8-for-agents",
  "gemini-3-flash-vs-pro-for-agents",
  "deepseek-v4-pro-vs-flash-for-agents",
  // the model choice for a coding agent specifically
  "gpt-5-5-vs-claude-opus-4-8-vs-gemini-for-coding",
  // the open-weight field
  "qwen-vs-llama-vs-deepseek-vs-mistral-vs-gemma",
  "kimi-k2-vs-glm-vs-minimax-vs-qwen3",
  "glm-5-2-open-weight-agentic-coding",
  "minimax-m3-open-weight-1m-context",
  // the frontier-scale end of the open-weight field: Meituan's 1.6T LongCat-2.0, whose
  // real story is compute-sovereignty (trained on unnamed domestic chips) and whose
  // "open MIT weights" are still "coming soon" — the sovereignty/availability caveat spoke.
  "longcat-2-trained-on-domestic-chips",
  // ...and once you've picked one on capability, which license actually lets you ship it
  "open-weight-coding-model-licenses",
  // when the smallest model that works is the right one
  "qwen3-vs-nemotron-nano-vs-phi-vs-gemma-for-agents",
  "small-language-models-vs-llms-for-agents",
  // the runtime companion to the static SLM-vs-LLM choice above: once you've split
  // work between a small and a large model, an agent has to decide PER STEP whether
  // this one exceeds the small model — and it's worst at judging that exactly when it
  // fails. The dynamic, mid-trajectory version of "smallest model that clears the bar".
  "when-should-an-ai-agent-ask-for-help",
  // the concrete on-device instance of "smallest model that works": Liquid's 230M
  // LFM2.5, built to route + extract on-device (beats Gemma 3 1B / Qwen3.5-0.8B at
  // extraction) — the fresh news spoke under the small-models band.
  "liquid-ai-lfm2-5-230m-on-device-agent-model",
  // architecture + token economics that actually move the bill
  "mixture-of-experts-vs-dense-models-for-agents",
  // a second architecture axis: diffusion vs autoregressive decoding — Google's
  // open DiffusionGemma 26B reads documents better and reasons worse than the
  // Gemma 4 it's built on, so it belongs on the structured-IO edges of an agent.
  "diffusiongemma-26b-for-ai-agents",
  "claude-sonnet-5-tokenizer-tax",
  "prompt-caching-pricing-anthropic-vs-openai-vs-gemini-vs-bedrock",
  // the strategic fork: open vs closed, and running it yourself
  "where-the-leverage-actually-is-open-vs-closed-agents",
  "local-vs-claude",
];
// The curated model-selection pieces as live post objects, in display order, skipping
// any slug not present in the corpus (so the hub never lists a dead link).
export function modelsHub(d = db()) {
  const bySlug = new Map(allPosts(d).map(p => [p.slug, p]));
  return MODELS_HUB_SLUGS.map(s => bySlug.get(s)).filter(Boolean);
}
// The /topics/agent-web hub — the TENTH curated topic hub, mirroring the nine
// before it. After MCP/frameworks/RAG/memory/inference/evals/security/coding/models
// each got a head-term hub, "the web" was the densest remaining un-hubbed money-page
// family: how an agent reads a page, the crawler/extraction tools, web-search and
// deep-research APIs, browser automation and computer use, and the access layer
// (bot auth, llms.txt, browser prompt injection) — ~14 comparison/how-to pieces that
// nothing owned the head term for ("web browsing for AI agents" / "how does an AI
// agent browse the web" / "web scraping for agents"). This funnels link equity into
// that family and gives readers one ordered path: read a page → extract it → search
// & research → act on the page (browser/computer use) → the permission & safety layer.
// Curated editorially, in that lifecycle order; vector/hybrid-*search* retrieval stays
// in /topics/rag-retrieval so this hub means the *live public web*, not the vector DB.
// Slugs validate against the corpus at read time so a renamed piece drops out rather
// than 404-ing the rail.
export const WEB_HUB_SLUGS = [
  // reading a page — the first primitive: screenshot/pixels vs DOM/markdown
  "2026-06-20-two-ways-to-show-an-agent-a-page",
  // the extraction / crawler tools — URL in, clean text or schema'd JSON out
  "2026-06-21-firecrawl-vs-crawl4ai-vs-jina-reader",
  // the one-call web-data API that folds fetch+parse+extract+cite together, and
  // stakes the category on robots.txt-compliant, sanctioned access to the web
  "tabstack-mozilla-web-data-api-for-ai-agents",
  // web search & deep research — the retrieval-from-the-open-web band
  "2026-06-21-tavily-vs-exa-vs-linkup-web-search",
  "gpt-researcher-vs-open-deep-research",
  "open-source-deep-research-agents",
  "how-to-evaluate-a-deep-research-agent",
  // acting on pages — browser automation frameworks, hosted browser infra, and the
  // token-cost lens; then the "beyond the browser" fork into full computer use
  "browser-use-vs-stagehand-vs-playwright-mcp",
  "skyvern-vs-browser-use",
  "browserbase-vs-steel-vs-browserless",
  "playwright-mcp-vs-cli-token-cost-browser-agents",
  "computer-use-vs-browser-automation",
  // the access & safety layer — how an agent announces itself, what a site can
  // grant it, and the injection risk that riding the live web opens up. The
  // consumer-agentic-browser decision (which of Comet/Atlas/Dia/Gemini to adopt)
  // sits at the front of this band as the product-choice counterpart to the
  // injection explainer it pairs with: pick a browser, then meet its blast radius.
  "web-bot-auth-explained-ai-agents",
  "llms-txt-vs-robots-txt",
  "comet-vs-atlas-vs-dia-vs-gemini-chrome-founder-agentic-browser",
  "ai-browser-prompt-injection",
];
// The curated web pieces as live post objects, in display order, skipping any slug
// not present in the corpus (so the hub never lists a dead link).
export function webHub(d = db()) {
  const bySlug = new Map(allPosts(d).map(p => [p.slug, p]));
  return WEB_HUB_SLUGS.map(s => bySlug.get(s)).filter(Boolean);
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
export function topicTokens(p) {
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
  // Build the MATCH expression defensively. A bare `word*` per token leaks FTS5
  // syntax into user input: a hyphen is the NOT operator, parens group, and
  // AND/OR/NOT are keywords — so a perfectly ordinary domain query like
  // "agent-memory", "multi-agent", or "vector-db" parses as an *operator* and,
  // via the catch below, silently returns ZERO results for the site's own topic
  // names. Wrap every token as a quoted phrase-prefix (`"token"*`) instead: the
  // quotes make hyphens, parens, and keywords literal, the tokenizer still splits
  // "agent-memory" into [agent, memory], and the trailing `*` keeps prefix search.
  // Tokens with no letter/digit (e.g. "(((", "--") are dropped so an all-symbol
  // query can't produce an empty phrase that errors out.
  const term = q.trim().replace(/["']/g, " ").split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w))
    .map((w) => `"${w}"*`)
    .join(" ");
  if (!term) return [];
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
