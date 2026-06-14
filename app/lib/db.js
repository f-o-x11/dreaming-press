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
      body_html TEXT, body_text TEXT, source TEXT, read_time INTEGER, has_audio INTEGER DEFAULT 0
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
  `);
}

// ── ingest helpers ───────────────────────────────────────────────────────────
export function clearPosts(d = db()) {
  d.exec("DELETE FROM posts; DELETE FROM posts_fts;");
}

const _insert = (d) => d.prepare(`INSERT OR REPLACE INTO posts
  (slug,title,dek,author,section,date,tags,sources,featured,body_html,body_text,source,read_time,has_audio)
  VALUES (@slug,@title,@dek,@author,@section,@date,@tags,@sources,@featured,@body_html,@body_text,@source,@read_time,@has_audio)`);
const _insertFts = (d) => d.prepare(`INSERT INTO posts_fts (slug,title,dek,body_text,section)
  VALUES (@slug,@title,@dek,@body_text,@section)`);

export function upsertPost(p, d = db()) {
  const row = {
    slug: p.slug, title: p.title, dek: p.dek || "", author: p.author || "rosalinda",
    section: p.section || "dispatches", date: p.date || "", tags: JSON.stringify(p.tags || []),
    sources: JSON.stringify(p.sources || []), featured: p.featured ? 1 : 0,
    body_html: p.body_html || "", body_text: p.body_text || "", source: p.source || "md",
    read_time: p.read_time || 1, has_audio: p.has_audio ? 1 : 0,
  };
  _insert(d).run(row);
  _insertFts(d).run({ slug: row.slug, title: row.title, dek: row.dek, body_text: row.body_text, section: row.section });
}

// ── readers ──────────────────────────────────────────────────────────────────
function hydrate(r) {
  if (!r) return r;
  return { ...r, tags: JSON.parse(r.tags || "[]"), sources: JSON.parse(r.sources || "[]"),
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
export function featuredPost(d = db()) {
  return hydrate(d.prepare("SELECT * FROM posts WHERE featured = 1 ORDER BY date DESC LIMIT 1").get())
    || allPosts(d)[0];
}
export function countPosts(d = db()) {
  return d.prepare("SELECT COUNT(*) c FROM posts").get().c;
}

export function search(q, d = db()) {
  if (!q || !q.trim()) return [];
  const term = q.trim().replace(/["']/g, "").split(/\s+/).map((w) => `${w}*`).join(" ");
  try {
    const rows = d.prepare(
      `SELECT p.* FROM posts_fts f JOIN posts p ON p.slug = f.slug
       WHERE posts_fts MATCH ? ORDER BY rank LIMIT 30`).all(term);
    return rows.map(hydrate);
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
