// SQLite data layer: posts, full-text search (FTS5), view counters, submissions.
import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import path from "node:path";

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
      figures TEXT
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
      id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT, type TEXT, ms INTEGER, ts INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
  `);
  // migrations for databases created before a column existed (ALTER is idempotent-guarded)
  for (const [col, type] of [["summary", "TEXT"], ["art", "TEXT"], ["audio_bytes", "INTEGER DEFAULT 0"], ["series", "TEXT"], ["series_order", "INTEGER"], ["figures", "TEXT"]]) {
    try { d.exec(`ALTER TABLE posts ADD COLUMN ${col} ${type}`); } catch { /* already present */ }
  }
}

// ── engagement events ──────────────────────────────────────────────────────────
// types: view, read (scrolled/dwelled), audio_play, audio_complete, complete
const EVENT_TYPES = new Set(["view", "read", "audio_play", "audio_complete", "complete", "scroll"]);
export function recordEvent(slug, type, ms, now, d = db()) {
  if (!EVENT_TYPES.has(type)) return false;
  d.prepare("INSERT INTO events (slug,type,ms,ts) VALUES (?,?,?,?)")
    .run(String(slug).slice(0, 200), type, Number(ms) || 0, Number(now) || 0);
  return true;
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
  (slug,title,dek,author,section,date,tags,sources,featured,body_html,body_text,source,read_time,has_audio,summary,art,audio_bytes,series,series_order,figures)
  VALUES (@slug,@title,@dek,@author,@section,@date,@tags,@sources,@featured,@body_html,@body_text,@source,@read_time,@has_audio,@summary,@art,@audio_bytes,@series,@series_order,@figures)`);
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
    art: p.art ? JSON.stringify(p.art) : null,
    audio_bytes: Number(p.audio_bytes) || 0,
    series: (p.series && String(p.series).trim()) || null,
    series_order: Number.isFinite(p.series_order) ? p.series_order : null,
  };
  _insert(d).run(row);
  _insertFts(d).run({ slug: row.slug, title: row.title, dek: row.dek, body_text: row.body_text, section: row.section });
}

// ── readers ──────────────────────────────────────────────────────────────────
function hydrate(r) {
  if (!r) return r;
  return { ...r, tags: JSON.parse(r.tags || "[]"), sources: JSON.parse(r.sources || "[]"),
    summary: JSON.parse(r.summary || "[]"), art: r.art ? JSON.parse(r.art) : null,
    figures: JSON.parse(r.figures || "[]"),
    featured: !!r.featured, has_audio: !!r.has_audio };
}

export function allPosts(d = db()) {
  return d.prepare("SELECT * FROM posts ORDER BY date DESC, slug DESC").all().map(hydrate);
}
export function getPost(slug, d = db()) {
  return hydrate(d.prepare("SELECT * FROM posts WHERE slug = ?").get(slug));
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
// "Continue reading" recommendations. Prefer pieces that share a voice tag —
// across sections — so a cynical Wire piece can surface a cynical Dispatch,
// then fall back to same-section, then most-recent. Returns up to `limit`.
export function relatedTo(slug, limit = 3, d = db()) {
  const all = allPosts(d);                 // date-DESC, slug-DESC
  const post = all.find(p => p.slug === slug);
  if (!post) return [];
  const tags = new Set((post.tags || []).map(t => String(t).trim().toLowerCase()));
  const score = (p) => {
    const shared = (p.tags || []).reduce((n, t) => n + (tags.has(String(t).trim().toLowerCase()) ? 1 : 0), 0);
    return shared * 10 + (p.section === post.section ? 1 : 0);
  };
  // V8's Array.sort is stable, so equal scores keep the date-DESC order.
  return all.filter(p => p.slug !== slug)
    .map(p => [p, score(p)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(0, limit))
    .map(([p]) => p);
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
