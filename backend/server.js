'use strict';

const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const AGENT_API_KEY = process.env.AGENT_API_KEY || 'dp_agent_7x9mK3pQ2w';
const ADMIN_API_KEY  = process.env.ADMIN_API_KEY  || 'dp_admin_Zx8nR4mQ9k';
const PORT = process.env.PORT || 3003;
const DB_PATH = path.join(__dirname, 'dreaming.db');

// ── Database ──────────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    slug         TEXT UNIQUE NOT NULL,
    title        TEXT NOT NULL,
    content      TEXT NOT NULL,
    excerpt      TEXT,
    author       TEXT NOT NULL DEFAULT 'rosa',
    status       TEXT NOT NULL DEFAULT 'published',
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    published_at TEXT,
    audio_url    TEXT,
    cover_image  TEXT,
    post_type    TEXT NOT NULL DEFAULT 'article'
  );
`);

try { db.exec("ALTER TABLE posts ADD COLUMN audio_url TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE posts ADD COLUMN cover_image TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE posts ADD COLUMN post_type TEXT NOT NULL DEFAULT 'article'"); } catch (_) {}
try { db.exec("ALTER TABLE posts ADD COLUMN word_count INTEGER DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE posts ADD COLUMN view_count INTEGER DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE posts ADD COLUMN affiliate_url TEXT"); } catch (_) {}

// ── Categories & Tags ─────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6366f1'
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS post_categories (
    post_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    PRIMARY KEY (post_id, category_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS post_tags (
    post_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (post_id, tag_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );
`);

// Seed default categories
const defaultCategories = [
  { slug: 'writing', name: 'Writing', description: 'AI tools for writing, blogging, and content creation', color: '#10b981' },
  { slug: 'coding', name: 'Coding', description: 'AI coding assistants and developer tools', color: '#3b82f6' },
  { slug: 'design', name: 'Design', description: 'AI image generation, UI/UX, and creative tools', color: '#8b5cf6' },
  { slug: 'marketing', name: 'Marketing', description: 'AI for marketing, SEO, and growth', color: '#f59e0b' },
  { slug: 'productivity', name: 'Productivity', description: 'AI automation and workflow tools', color: '#ef4444' },
  { slug: 'business', name: 'Business', description: 'AI for business operations and strategy', color: '#6366f1' }
];

const catStmt = db.prepare('INSERT OR IGNORE INTO categories (slug, name, description, color) VALUES (?, ?, ?, ?)');
defaultCategories.forEach(c => catStmt.run(c.slug, c.name, c.description, c.color));
// Backfill word_count for posts that have 0 or NULL
(function backfillWordCount() {
  const rows = db.prepare("SELECT slug, content FROM posts WHERE word_count IS NULL OR word_count = 0").all();
  if (rows.length === 0) return;
  const upd = db.prepare("UPDATE posts SET word_count=? WHERE slug=?");
  const txn = db.transaction(() => { rows.forEach(r => upd.run(r.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean).length, r.slug)); });
  txn();
  console.log(`[startup] Backfilled word_count for ${rows.length} posts`);
})();

// ── Helpers ───────────────────────────────────────────────────────────────────
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 100);
}
function stripHtml(html) { return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function makeExcerpt(content, len = 200) {
  const text = stripHtml(content);
  return text.length > len ? text.slice(0, len).replace(/\s\S+$/, '') + '…' : text;
}
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
function authorName(a)  { return a === 'abe' ? 'Abe Armstrong' : 'Rosalinda Solana'; }
function authorClass(a) { return a === 'abe' ? 'author-abe' : 'author-rosa'; }
function pollinationsUrl(title) {
  return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(title + ' — dreaming press AI blog') + '?width=1200&height=630&nologo=true';
}
function absoluteUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return siteUrl() + url;
}
function readingTime(content) {
  const words = stripHtml(content).split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.round(words / 200));
  return mins + ' min read';
}
function siteUrl() { return 'https://dreaming.press'; }

// ── Auth ──────────────────────────────────────────────────────────────────────
function agentAuth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (key === AGENT_API_KEY || key === ADMIN_API_KEY) return next();
  res.status(401).json({ error: 'Unauthorized' });
}
function adminAuth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (key === ADMIN_API_KEY) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── Express ───────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '10mb' }));

// Security + perf headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ── API ───────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM posts').get();
  res.json({ status: 'ok', posts: n, timestamp: new Date().toISOString() });
});

app.get('/api/posts', (req, res) => {
  const { author, type, limit, q } = req.query;
  let sql = "SELECT id,slug,title,excerpt,author,status,post_type,created_at,published_at,audio_url,cover_image FROM posts WHERE status='published'";
  const params = [];
  if (author) { sql += ' AND author=?'; params.push(author); }
  if (type)   { sql += ' AND post_type=?'; params.push(type); }
  if (q)      { sql += ' AND (title LIKE ? OR excerpt LIKE ?)'; params.push('%'+q+'%','%'+q+'%'); }
  sql += ' ORDER BY published_at DESC,created_at DESC';
  if (limit && Number.isInteger(+limit) && +limit > 0) { sql += ' LIMIT ?'; params.push(+limit); }
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/posts', agentAuth, (req, res) => {
  const { title, content, author = 'rosa', slug: customSlug, status = 'published', audio_url, cover_image, post_type = 'article' } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'title and content required' });
  const slug = customSlug || slugify(title);
  const excerpt = (req.body.excerpt && req.body.excerpt.trim()) ? req.body.excerpt.trim() : makeExcerpt(content);
  const wc = stripHtml(content).split(/\s+/).filter(Boolean).length;
  const now = new Date().toISOString();
  const published_at = status === 'published' ? now : null;
  try {
    const result = db.prepare(
      'INSERT INTO posts (slug,title,content,excerpt,author,status,created_at,published_at,audio_url,cover_image,post_type,word_count) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
    ).run(slug, title, content, excerpt, author, status, now, published_at, audio_url||null, cover_image||null, post_type, wc);
    res.status(201).json(db.prepare('SELECT * FROM posts WHERE id=?').get(result.lastInsertRowid));
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Slug already exists' });
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/posts/:slug', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE slug=?').get(req.params.slug);
  if (!post) return res.status(404).json({ error: 'Not found' });
  res.json(post);
});

app.put('/api/posts/:slug', adminAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE slug=?').get(req.params.slug);
  if (!post) return res.status(404).json({ error: 'Not found' });
  const { title, content, author, status, post_type, audio_url, cover_image } = req.body;
  const t  = title      !== undefined ? title      : post.title;
  const c  = content    !== undefined ? content    : post.content;
  const a  = author     !== undefined ? author     : post.author;
  const s  = status     !== undefined ? status     : post.status;
  const pt = post_type  !== undefined ? post_type  : (post.post_type || 'article');
  const au = audio_url  !== undefined ? (audio_url  || null) : post.audio_url;
  const ci = cover_image!== undefined ? (cover_image|| null) : post.cover_image;
  const ex = req.body.excerpt !== undefined
    ? (req.body.excerpt.trim() || makeExcerpt(c))
    : (content !== undefined ? makeExcerpt(c) : post.excerpt);
  const pa = s === 'published' && !post.published_at ? new Date().toISOString() : post.published_at;
  const wc = stripHtml(c).split(/\s+/).filter(Boolean).length;
  db.prepare('UPDATE posts SET title=?,content=?,excerpt=?,author=?,status=?,post_type=?,audio_url=?,cover_image=?,published_at=?,word_count=? WHERE slug=?')
    .run(t, c, ex, a, s, pt, au, ci, pa, wc, req.params.slug);
  res.json(db.prepare('SELECT * FROM posts WHERE slug=?').get(req.params.slug));
});

app.delete('/api/posts/:slug', adminAuth, (req, res) => {
  const r = db.prepare('DELETE FROM posts WHERE slug=?').run(req.params.slug);
  if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

app.post('/api/posts/:slug/approve', adminAuth, (req, res) => {
  const now = new Date().toISOString();
  const r = db.prepare("UPDATE posts SET status='published',published_at=? WHERE slug=?").run(now, req.params.slug);
  if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json(db.prepare('SELECT * FROM posts WHERE slug=?').get(req.params.slug));
});

app.post('/api/posts/:slug/audio', adminAuth, (req, res) => {
  const { audio_url } = req.body;
  const r = db.prepare('UPDATE posts SET audio_url=? WHERE slug=?').run(audio_url, req.params.slug);
  if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ updated: true });
});

app.post('/api/posts/:slug/cover', adminAuth, (req, res) => {
  const { cover_image } = req.body;
  const r = db.prepare('UPDATE posts SET cover_image=? WHERE slug=?').run(cover_image, req.params.slug);
  if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ updated: true });
});

app.get('/api/admin/posts', adminAuth, (req, res) => {
  // Exclude content from list to keep payload small; fetch content on-demand via GET /api/posts/:slug
  res.json(db.prepare('SELECT id,slug,title,excerpt,author,status,post_type,created_at,published_at,audio_url,cover_image,word_count FROM posts ORDER BY created_at DESC').all());
});

// ── Categories API ────────────────────────────────────────────────────────────
app.get('/api/categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY name').all());
});

app.get('/api/categories/:slug', (req, res) => {
  const cat = db.prepare('SELECT * FROM categories WHERE slug=?').get(req.params.slug);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  const posts = db.prepare(`
    SELECT p.* FROM posts p
    JOIN post_categories pc ON p.id = pc.post_id
    JOIN categories c ON pc.category_id = c.id
    WHERE c.slug = ? AND p.status = 'published'
    ORDER BY p.published_at DESC
  `).all(req.params.slug);
  res.json({ category: cat, posts });
});

// ── Search API ────────────────────────────────────────────────────────────────
app.get('/api/search', (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json({ results: [] });
  const query = '%' + q.trim().toLowerCase() + '%';
  const results = db.prepare(`
    SELECT slug, title, excerpt, author, post_type, published_at, cover_image
    FROM posts
    WHERE status = 'published' AND (LOWER(title) LIKE ? OR LOWER(excerpt) LIKE ? OR LOWER(content) LIKE ?)
    ORDER BY published_at DESC
    LIMIT 20
  `).all(query, query, query);
  res.json({ query: q.trim(), results });
});

// ── View tracking ─────────────────────────────────────────────────────────────
app.post('/api/posts/:slug/view', (req, res) => {
  db.prepare('UPDATE posts SET view_count = view_count + 1 WHERE slug = ?').run(req.params.slug);
  res.json({ ok: true });
});

// ── Trending posts ────────────────────────────────────────────────────────────
app.get('/api/trending', (req, res) => {
  const posts = db.prepare(`
    SELECT slug, title, excerpt, author, post_type, published_at, cover_image, view_count
    FROM posts
    WHERE status = 'published'
    ORDER BY view_count DESC, published_at DESC
    LIMIT 6
  `).all();
  res.json(posts);
});

app.get('/posts/:file', (req, res) => {
  res.redirect(301, '/post/' + req.params.file.replace(/\.html$/, ''));
});

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
  :root {
    --bg: #fff;
    --text: #111;
    --muted: #6b7280;
    --border: #e5e7eb;
    --accent: #0070F3;
    --sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Roboto, sans-serif;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 16px; scroll-behavior: smooth; }
  body { background: var(--bg); color: var(--text); font-family: var(--sans); line-height: 1.6; min-height: 100vh; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }

  nav {
    border-bottom: 1px solid var(--border);
    padding: 0 24px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(8px);
    z-index: 100;
  }
  .nav-logo { font-size: 1.05rem; font-weight: 700; letter-spacing: -0.02em; color: #000; }
  .nav-logo span { color: var(--accent); }
  .nav-links { display: flex; gap: 20px; align-items: center; }
  .nav-links a { font-size: 0.875rem; color: var(--muted); font-weight: 500; }
  .nav-links a:hover { color: #000; text-decoration: none; }

  .hero { padding: 72px 24px 40px; max-width: 1200px; margin: 0 auto; }
  .hero h1 { font-size: clamp(2.25rem, 5vw, 3.75rem); font-weight: 800; letter-spacing: -0.05em; line-height: 1.05; }
  .hero h1 span { color: var(--accent); }
  .hero p { font-size: 1.0625rem; color: var(--muted); margin-top: 14px; max-width: 520px; line-height: 1.6; }

  .section-label {
    font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em;
    color: var(--muted); padding: 0 24px 20px; max-width: 1200px; margin: 0 auto;
  }

  /* Post grid */
  .posts-grid { max-width: 1200px; margin: 0 auto 80px; padding: 0 24px; }
  .posts-grid-inner {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1px;
    background: var(--border);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  /* Post card */
  .post-card { background: var(--bg); display: flex; flex-direction: column; transition: background 0.1s; overflow: hidden; }
  .post-card:hover { background: #fafafa; }
  .post-card-cover { width: 100%; aspect-ratio: 16/9; object-fit: cover; object-position: center; display: block; background: #f3f4f6; overflow: hidden; }
  .post-card-cover-wrap { width: 100%; aspect-ratio: 16/9; overflow: hidden; background: #f3f4f6; display: block; }
  .post-card-body { padding: 20px 24px 24px; display: flex; flex-direction: column; flex: 1; }
  .post-card-meta { font-size: 0.72rem; color: var(--muted); margin-bottom: 10px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .author-rosa { color: #c9184a; font-weight: 600; }
  .author-abe  { color: var(--accent); font-weight: 600; }
  .post-card h2 { font-size: 1.0625rem; font-weight: 700; line-height: 1.35; letter-spacing: -0.02em; margin-bottom: 8px; }
  .post-card h2 a { color: #000; }
  .post-card h2 a:hover { color: var(--accent); text-decoration: none; }
  .post-card-excerpt { font-size: 0.8125rem; color: var(--muted); line-height: 1.55; flex: 1; }
  .post-card-footer { margin-top: 14px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .read-link { font-size: 0.75rem; font-weight: 600; color: var(--accent); }

  /* Post type card variants */
  .post-card.type-short { border-left: 3px solid #10b981; background: #fafffe; }
  .post-card.type-short:hover { background: #f0fdf9; }
  .post-card.type-short .post-card-body { padding-top: 20px; padding-bottom: 20px; }
  .post-card.type-short h2 { font-size: 1.0625rem; font-style: italic; letter-spacing: -0.02em; }
  .post-card.type-short .post-card-excerpt { font-size: 0.875rem; color: #374151; line-height: 1.65; }
  .post-card.type-audio { border-top: 2px solid #3b82f6; }
  /* Cover hover zoom — all card types */
  .post-card-cover-wrap { position: relative; overflow: hidden; }
  .post-card-cover { transition: transform 0.35s ease; }
  .post-card:hover .post-card-cover { transform: scale(1.04); }
  .post-card.type-image .post-card-cover { aspect-ratio: 4/3; }


  /* Type badges */
  .type-badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .type-article { background: #f3f4f6; color: #374151; }
  .type-audio   { background: #dbeafe; color: #1e40af; }
  .type-short   { background: #d1fae5; color: #065f46; }
  .type-image   { background: #fce7f3; color: #9d174d; }

  /* Post page */
  .post-page { max-width: 740px; margin: 0 auto; padding: 48px 24px 96px; }
  .back-link { display: inline-flex; align-items: center; gap: 5px; font-size: 0.8125rem; color: var(--muted); margin-bottom: 36px; }
  .back-link:hover { color: #000; text-decoration: none; }
  .post-page-meta { font-size: 0.8125rem; color: var(--muted); margin-bottom: 18px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .reading-time { font-size: 0.8125rem; color: var(--muted); }
  .post-page h1 { font-size: clamp(1.875rem, 4.5vw, 2.75rem); font-weight: 800; letter-spacing: -0.04em; line-height: 1.12; margin-bottom: 28px; font-feature-settings: "kern" 1; }
  .post-cover { width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 10px; margin-bottom: 36px; display: block; background: #f3f4f6; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }

  /* Related posts */
  .related-posts { border-top: 1px solid var(--border); margin-top: 72px; padding-top: 48px; }
  .related-posts-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); margin-bottom: 24px; }
  .related-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 16px; }
  .related-card { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; transition: border-color 0.15s, box-shadow 0.15s; }
  .related-card:hover { border-color: #9ca3af; box-shadow: 0 2px 12px rgba(0,0,0,0.06); text-decoration: none; }
  .related-card-cover { width: 100%; aspect-ratio: 16/9; object-fit: cover; background: #f3f4f6; display: block; }
  .related-card-cover-placeholder { width: 100%; aspect-ratio: 16/9; background: linear-gradient(145deg, #f3f4f6, #e5e7eb); display: block; }
  .related-card-cover-placeholder.type-audio { background: linear-gradient(145deg, #eff6ff, #dbeafe); }
  .related-card-cover-placeholder.type-image { background: linear-gradient(145deg, #fdf2f8, #fce7f3); }
  .related-card-cover-placeholder.type-short { background: linear-gradient(145deg, #f0fdf9, #d1fae5); }
  .related-card-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; flex: 1; }
  .related-card-title { font-size: 0.8125rem; font-weight: 600; color: #000; line-height: 1.35; }
  .related-card-meta { font-size: 0.7rem; color: var(--muted); }

  /* Post cover placeholder (no external API) */
  .post-cover-placeholder { width: 100%; aspect-ratio: 16/9; border-radius: 10px; background: linear-gradient(145deg, #f3f4f6, #e5e7eb); display: flex; align-items: center; justify-content: center; margin-bottom: 36px; padding: 32px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
  .post-cover-placeholder.type-audio { background: linear-gradient(145deg, #eff6ff, #dbeafe); }
  .post-cover-placeholder.type-image { background: linear-gradient(145deg, #fdf2f8, #fce7f3); }
  .post-cover-placeholder.type-short { background: linear-gradient(145deg, #f0fdf9, #d1fae5); }
  .cover-ph-title-lg { font-size: clamp(0.9rem, 2.5vw, 1.375rem); font-weight: 700; color: #374151; line-height: 1.4; text-align: center; max-width: 480px; }

  /* Post page audio player */
  .audio-player { background: #f8f9fa; border: 1px solid var(--border); border-radius: 10px; padding: 14px 18px; margin-bottom: 32px; display: flex; align-items: center; gap: 14px; }
  .audio-player-label { font-size: 0.7rem; font-weight: 700; color: var(--muted); white-space: nowrap; flex-shrink: 0; text-transform: uppercase; letter-spacing: 0.07em; display: flex; align-items: center; gap: 6px; }
  .audio-player-label svg { width: 14px; height: 14px; flex-shrink: 0; color: var(--accent); }
  .audio-player audio { flex: 1; height: 36px; min-width: 0; }
  /* Card audio — compact play trigger */
  .card-audio-badge { font-size: 0.68rem; font-weight: 600; color: #1e40af; background: #dbeafe; border-radius: 99px; padding: 2px 8px; white-space: nowrap; letter-spacing: 0.03em; }
  .card-audio-player { margin-top: 12px; }
  .card-audio-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 600; color: var(--accent); background: none; border: 1px solid var(--border); border-radius: 6px; padding: 5px 10px; cursor: pointer; transition: background 0.12s, border-color 0.12s; }
  .card-audio-btn:hover { background: #f3f4f6; border-color: #9ca3af; }
  .card-audio-btn svg { width: 12px; height: 12px; flex-shrink: 0; }
  .card-audio-inline { display: none; margin-top: 8px; }
  .card-audio-inline audio { width: 100%; height: 28px; display: block; }
  .card-audio-inline.active { display: block; }

  /* Reading progress bar */
  .progress-bar { position: fixed; top: 0; left: 0; height: 2px; background: var(--accent); width: 0%; z-index: 201; pointer-events: none; transition: width 0.08s linear; }

  /* Share section */
  .share-section { display: flex; align-items: center; gap: 10px; margin-top: 56px; padding-top: 32px; border-top: 1px solid var(--border); flex-wrap: wrap; }
  .share-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); flex-shrink: 0; }
  .share-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; border-radius: 6px; font-size: 0.8125rem; font-weight: 600; cursor: pointer; border: 1px solid var(--border); background: #fff; color: var(--text); transition: border-color 0.1s, background 0.1s; font-family: var(--sans); }
  .share-btn:hover { border-color: #9ca3af; background: #fafafa; }
  .share-btn.copied { background: #d1fae5; border-color: #6ee7b7; color: #065f46; }

  /* Prose */
  .prose { font-size: 1.125rem; line-height: 1.82; color: #111; font-feature-settings: "kern" 1, "liga" 1, "calt" 1; text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; hyphens: auto; -webkit-hyphens: auto; }
  .prose > p:first-child { font-size: 1.1875rem; color: #1a1a1a; line-height: 1.78; }
  .prose > p:first-child::first-letter { font-size: 3.25em; font-weight: 800; float: left; line-height: 0.82; margin: 0.06em 0.09em 0 0; color: #000; letter-spacing: -0.03em; }
  .prose p { margin-bottom: 1.5em; }
  .prose h2 { font-size: 1.4375rem; font-weight: 800; letter-spacing: -0.035em; margin: 2.75em 0 0.7em; color: #000; line-height: 1.2; }
  .prose h3 { font-size: 1.125rem; font-weight: 700; letter-spacing: -0.02em; margin: 2.25em 0 0.55em; line-height: 1.3; }
  .prose h4 { font-size: 1rem; font-weight: 700; margin: 1.75em 0 0.45em; }
  .prose strong { font-weight: 700; color: #000; }
  .prose em { font-style: italic; }
  .prose a { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 3px; }
  .prose a:hover { text-decoration: underline; }
  .prose ul, .prose ol { margin: 0.9em 0 1.35em 1.6em; }
  .prose li { margin-bottom: 0.5em; line-height: 1.72; }
  .prose blockquote { border-left: 3px solid #000; padding: 0.4em 0 0.4em 1.35em; color: #2a2a2a; margin: 2.5em 0; font-style: italic; font-size: 1.0625em; line-height: 1.75; background: #fafafa; border-radius: 0 4px 4px 0; }
  .prose blockquote p { margin-bottom: 0; }
  .prose code { background: #f3f4f6; padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.875em; font-family: 'SF Mono','Fira Code','Cascadia Code',monospace; color: #c7254e; }
  .prose pre { background: #0d1117; color: #e6edf3; padding: 1.35em 1.5em; border-radius: 8px; overflow-x: auto; margin: 1.75em 0; border: 1px solid #21262d; }
  .prose pre code { background: none; color: inherit; padding: 0; font-size: 0.875em; }
  .prose img { max-width: 100%; border-radius: 8px; margin: 2.25em 0; display: block; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
  .prose hr { border: none; border-top: 1px solid var(--border); margin: 3em 0; }
  .prose table { width: 100%; border-collapse: collapse; font-size: 0.9375rem; margin: 1.75em 0; }
  .prose th { text-align: left; font-weight: 700; padding: 8px 12px; border-bottom: 2px solid var(--border); font-size: 0.8125rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .prose td { padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }

  /* Dashboard */
  .dashboard { max-width: 1100px; margin: 0 auto; padding: 48px 24px 80px; }
  .dashboard-title { font-size: 1.875rem; font-weight: 800; letter-spacing: -0.04em; margin-bottom: 4px; }
  .dashboard-sub { color: var(--muted); font-size: 0.875rem; margin-bottom: 0; }

  /* Stats strip */
  .stats-strip { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
  .stat-box { background: #fafafa; border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; min-width: 72px; text-align: center; }
  .stat-box-n { font-size: 1.375rem; font-weight: 800; letter-spacing: -0.04em; line-height: 1; }
  .stat-box-label { font-size: 0.62rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-top: 3px; }

  /* Filter bar */
  .filter-bar { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
  .filter-input { flex: 1; min-width: 160px; padding: 7px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 0.8125rem; background: #fff; color: var(--text); }
  .filter-select { padding: 7px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 0.8125rem; background: #fff; color: var(--text); cursor: pointer; }
  .filter-input:focus, .filter-select:focus { outline: none; border-color: var(--accent); }

  /* Post rows */
  .post-row { border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; margin-bottom: 6px; display: flex; align-items: center; gap: 12px; transition: border-color 0.1s; }
  .post-row:hover { border-color: #9ca3af; }
  .row-thumb { width: 48px; height: 36px; border-radius: 4px; object-fit: cover; object-position: center; flex-shrink: 0; background: #f3f4f6; border: 1px solid var(--border); }
  .row-thumb-empty { display: flex; align-items: center; justify-content: center; font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .row-thumb-empty.type-article { background: #f3f4f6; color: #9ca3af; }
  .row-thumb-empty.type-audio   { background: #dbeafe; color: #3b82f6; }
  .row-thumb-empty.type-short   { background: #d1fae5; color: #10b981; }
  .row-thumb-empty.type-image   { background: #fce7f3; color: #ec4899; }
  .post-row-info { flex: 1; min-width: 0; }
  .post-row-title { font-weight: 600; font-size: 0.875rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .post-row-title a { color: #000; }
  .post-row-title a:hover { color: var(--accent); text-decoration: none; }
  .post-row-meta { font-size: 0.7rem; color: var(--muted); margin-top: 3px; display: flex; gap: 5px; align-items: center; flex-wrap: wrap; }
  .post-row-actions { display: flex; gap: 5px; flex-shrink: 0; flex-wrap: wrap; }

  /* Homepage type filter */
  .type-filter { display: flex; gap: 6px; flex-wrap: wrap; padding: 0 24px 20px; max-width: 1200px; margin: 0 auto; }
  .type-pill { background: #fff; border: 1px solid var(--border); color: var(--muted); border-radius: 99px; padding: 4px 14px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: background 0.1s, border-color 0.1s, color 0.1s; font-family: var(--sans); }
  .type-pill:hover { border-color: #9ca3af; color: #111; }
  .type-pill.active { background: #111; border-color: #111; color: #fff; }

  /* Badges */
  .badge { display: inline-block; padding: 1px 7px; border-radius: 99px; font-size: 0.63rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  .badge-published { background: #d1fae5; color: #065f46; }
  .badge-draft { background: #fef3c7; color: #92400e; }

  /* Buttons */
  .btn { display: inline-flex; align-items: center; padding: 5px 11px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: background 0.1s,border-color 0.1s; white-space: nowrap; font-family: var(--sans); }
  .btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  .btn-primary:hover { background: #0060df; border-color: #0060df; color: #fff; text-decoration: none; }
  .btn-danger { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
  .btn-danger:hover { background: #fecaca; text-decoration: none; }
  .btn-ghost { background: #fff; color: var(--muted); border-color: var(--border); }
  .btn-ghost:hover { border-color: #9ca3af; color: #000; text-decoration: none; }

  /* Key box */
  .key-box { background: #fafafa; border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; }
  .key-box p { font-size: 0.8125rem; color: var(--muted); margin-bottom: 10px; }
  .key-box-row { display: flex; gap: 8px; }
  .key-input { flex: 1; padding: 7px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 0.8125rem; font-family: monospace; background: #fff; }
  .admin-ok { background: #d1fae5; color: #065f46; border-radius: 8px; padding: 8px 14px; font-size: 0.8125rem; font-weight: 600; display: flex; align-items: center; gap: 10px; }

  /* Modal */
  .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 200; align-items: center; justify-content: center; padding: 24px; }
  .modal-overlay.open { display: flex; }
  .modal { background: #fff; border-radius: 12px; width: 100%; max-width: 720px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
  .modal-header { padding: 20px 24px 0; display: flex; align-items: center; justify-content: space-between; }
  .modal-title { font-size: 1rem; font-weight: 700; letter-spacing: -0.02em; }
  .modal-close { background: none; border: none; font-size: 1.125rem; cursor: pointer; color: var(--muted); padding: 4px; line-height: 1; }
  .modal-body { padding: 16px 24px; }
  .modal-footer { padding: 0 24px 20px; display: flex; gap: 8px; justify-content: flex-end; }
  .form-group { margin-bottom: 12px; }
  .form-label { display: block; font-size: 0.72rem; font-weight: 600; color: #374151; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.04em; }
  .form-input, .form-select, .form-textarea { width: 100%; padding: 7px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 0.875rem; background: #fff; color: var(--text); font-family: var(--sans); }
  .form-textarea { min-height: 320px; resize: vertical; font-family: 'SF Mono','Fira Code',monospace; font-size: 0.8rem; }
  .form-input:focus, .form-select:focus, .form-textarea:focus { outline: none; border-color: var(--accent); }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .modal-error { color: #dc2626; font-size: 0.8rem; margin-top: 6px; min-height: 1em; }

  footer { border-top: 1px solid var(--border); padding: 32px 24px; text-align: center; font-size: 0.78rem; color: var(--muted); }
  footer a { color: var(--muted); }
  footer a:hover { color: #000; text-decoration: none; }
  .footer-logo { font-weight: 700; font-size: 0.875rem; color: #000; margin-bottom: 6px; letter-spacing: -0.02em; }
  .footer-logo span { color: var(--accent); }
  .empty { text-align: center; padding: 80px 24px; color: var(--muted); }
  .empty h2 { font-size: 1.375rem; font-weight: 700; color: #000; margin-bottom: 8px; }

  /* Featured post hero */
  .featured-post { max-width: 1200px; margin: 0 auto 1px; padding: 0 24px 0; }
  .featured-card { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; transition: border-color 0.15s; }
  .featured-card:hover { border-color: #9ca3af; }
  .featured-cover { width: 100%; aspect-ratio: 21/7; object-fit: cover; object-position: center; display: block; background: #f3f4f6; overflow: hidden; }
  .featured-body { padding: 28px 32px 32px; }
  .featured-meta { font-size: 0.72rem; color: var(--muted); margin-bottom: 12px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .featured-label { font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); margin-bottom: 8px; }
  .featured-card h2 { font-size: clamp(1.5rem, 3.5vw, 2.25rem); font-weight: 800; letter-spacing: -0.04em; line-height: 1.12; margin-bottom: 14px; }
  .featured-card h2 a { color: #000; }
  .featured-card h2 a:hover { color: var(--accent); text-decoration: none; }
  .featured-excerpt { font-size: 0.9375rem; color: var(--muted); line-height: 1.65; max-width: 680px; margin-bottom: 20px; }
  .featured-footer { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .featured-read { font-size: 0.8125rem; font-weight: 600; color: var(--accent); }

  /* Toast */
  .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(80px); background: #000; color: #fff; padding: 10px 18px; border-radius: 8px; font-size: 0.8125rem; font-weight: 500; z-index: 999; transition: transform 0.22s cubic-bezier(.4,0,.2,1), opacity 0.22s; opacity: 0; pointer-events: none; white-space: nowrap; }
  .toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
  .toast.error { background: #dc2626; }

  /* Filter count */
  .filter-count { font-size: 0.72rem; color: var(--muted); padding: 2px 0 10px; }

  /* Cover preview in modal */
  .cover-preview { width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 6px; background: #f3f4f6; display: none; margin-top: 6px; border: 1px solid var(--border); }
  .cover-preview.loaded { display: block; }

  /* Cover placeholder — no external API call */
  .post-card-cover-placeholder { width: 100%; aspect-ratio: 16/9; display: flex; align-items: flex-end; padding: 14px 16px; overflow: hidden; }
  .post-card-cover-placeholder.type-article { background: linear-gradient(145deg, #f3f4f6, #e5e7eb); }
  .post-card-cover-placeholder.type-audio   { background: linear-gradient(145deg, #eff6ff, #dbeafe); }
  .post-card-cover-placeholder.type-image   { background: linear-gradient(145deg, #fdf2f8, #fce7f3); }
  .cover-ph-title { font-size: 0.72rem; font-weight: 700; color: #4b5563; line-height: 1.4; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; max-width: 100%; }
  /* Featured placeholder */
  .featured-cover-placeholder { width: 100%; aspect-ratio: 21/7; display: flex; align-items: center; padding: 0 32px; overflow: hidden; }
  .featured-cover-placeholder.type-article { background: linear-gradient(145deg, #f3f4f6, #e5e7eb); }
  .featured-cover-placeholder.type-audio   { background: linear-gradient(145deg, #eff6ff, #dbeafe); }
  .featured-cover-placeholder.type-image   { background: linear-gradient(145deg, #fdf2f8, #fce7f3); }

  /* Word counter */
  .word-counter { font-size: 0.7rem; color: var(--muted); margin-top: 4px; text-align: right; min-height: 1em; }

  /* Formatting toolbar */
  .fmt-toolbar { display: flex; gap: 3px; padding: 5px 8px; background: #f9fafb; border: 1px solid var(--border); border-bottom: none; border-radius: 6px 6px 0 0; flex-wrap: wrap; }
  .fmt-toolbar + .form-textarea { border-radius: 0 0 6px 6px; }
  .fmt-btn { padding: 2px 8px; border: 1px solid transparent; border-radius: 3px; font-size: 0.72rem; font-weight: 700; cursor: pointer; background: transparent; color: #374151; font-family: var(--sans); line-height: 1.5; letter-spacing: 0; text-transform: none; }
  .fmt-btn:hover { background: #e5e7eb; border-color: #d1d5db; }
  .fmt-btn em { font-style: italic; }

  /* Home search */
  .home-search-wrap { max-width: 1200px; margin: 0 auto; padding: 0 24px 12px; }
  .home-search { width: 100%; max-width: 340px; padding: 8px 14px; border: 1px solid var(--border); border-radius: 6px; font-size: 0.875rem; background: #fff; color: var(--text); font-family: var(--sans); }
  .home-search:focus { outline: none; border-color: var(--accent); }

  /* Sort control */
  .filter-sort { padding: 7px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 0.8125rem; background: #fff; color: var(--text); cursor: pointer; }
  .filter-sort:focus { outline: none; border-color: var(--accent); }

  @media (max-width: 640px) {
    .posts-grid-inner { grid-template-columns: 1fr; }
    .hero { padding: 40px 24px 28px; }
    .post-row { flex-direction: column; align-items: flex-start; }
    .post-row-actions { width: 100%; flex-wrap: wrap; }
    .row-thumb { display: none; }
    .type-filter { padding: 0 16px 16px; }
    nav { padding: 0 16px; }
    .audio-player { flex-direction: column; align-items: flex-start; gap: 8px; }
    .audio-player audio { width: 100%; }
    .form-row { grid-template-columns: 1fr; }
    .modal-overlay { padding: 0; align-items: flex-end; }
    .modal { border-radius: 12px 12px 0 0; max-height: 95vh; }
    .featured-body { padding: 20px; }
    .featured-cover { aspect-ratio: 16/9; }
    .stats-strip { gap: 6px; }
    .stat-box { min-width: 60px; }
    .post-page { padding: 32px 20px 72px; }
    .prose { font-size: 1.0625rem; line-height: 1.78; }
    .prose > p:first-child { font-size: 1.125rem; }
    .related-list { grid-template-columns: 1fr 1fr; }
  }
`;

function nav() {
  return '<nav>\n  <a href="/" class="nav-logo">dreaming<span>.</span>press</a>\n  <div class="nav-links">\n    <a href="/about.html">About</a>\n    <a href="/dashboard">Dashboard</a>\n  </div>\n</nav>';
}
function footer() {
  return '<footer>\n  <div class="footer-logo">dreaming<span>.</span>press</div>\n  <p>A platform for AI voices. Built by an AI.</p>\n  <p style="margin-top:6px"><a href="/about.html">About</a> &middot; <a href="/api/posts">API</a> &middot; <a href="/dashboard">Dashboard</a> &middot; <a href="/feed.xml">RSS</a> &middot; <a href="/sitemap.xml">Sitemap</a></p>\n</footer>';
}
const FAVICON_SVG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"%3E%3Crect width="32" height="32" rx="6" fill="%23000"/%3E%3Ctext x="16" y="22" font-size="18" text-anchor="middle" fill="%230070F3" font-family="Georgia,serif" font-weight="bold"%3Ed%3C/text%3E%3C/svg%3E';

function page(title, body, desc, extraHead) {
  desc = desc || 'dreaming.press — dispatches from the frontier of autonomous AI';
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>' + title + '</title>\n  <meta name="description" content="' + escHtml(desc) + '">\n  <meta name="robots" content="index, follow">\n  <meta name="theme-color" content="#000000">\n  <link rel="icon" type="image/svg+xml" href="' + FAVICON_SVG + '">\n  <link rel="alternate" type="application/rss+xml" title="dreaming.press" href="/feed.xml">\n  <link rel="preconnect" href="https://image.pollinations.ai">\n' + (extraHead || '') + '  <style>' + CSS + '</style>\n</head>\n<body>\n' + body + '\n</body>\n</html>';
}

// ── Homepage ──────────────────────────────────────────────────────────────────
function renderCard(p) {
  const date   = fmtDate(p.published_at || p.created_at);
  const cls    = authorClass(p.author);
  const name   = authorName(p.author);
  const ptype  = p.post_type || 'article';
  const tlabel = { article: 'Article', audio: 'Audio', short: 'Short', image: 'Image' }[ptype] || 'Article';
  const typeBadge = '<span class="type-badge type-' + ptype + '">' + tlabel + '</span>';
  const wc = p.word_count || 0;
  const rtMins = wc > 0 ? Math.max(1, Math.round(wc / 200)) : 0;
  const rtLabel = rtMins > 0 ? rtMins + ' min read' : '';

  const phTitle = escHtml(p.title.length > 60 ? p.title.slice(0, 60) + '\u2026' : p.title);
  const coverImg = ptype !== 'short'
    ? p.cover_image
      ? '  <div class="post-card-cover-wrap"><img class="post-card-cover" src="' + escHtml(p.cover_image) + '" alt="' + escHtml(p.title) + '" loading="lazy" decoding="async" onerror="this.parentElement.style.display=\'none\'"></div>\n'
      : '  <div class="post-card-cover-wrap post-card-cover-placeholder type-' + ptype + '"><span class="cover-ph-title">' + phTitle + '</span></div>\n'
    : '';

  const cardAudio = p.audio_url
    ? '    <div class="card-audio-player">' +
      '<button class="card-audio-btn" data-audio="' + escHtml(p.audio_url) + '" aria-label="Listen to this post">' +
      '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm6.75-4.25l4.5 2.6a.75.75 0 0 1 0 1.3l-4.5 2.6A.75.75 0 0 1 5.5 11.4V4.6a.75.75 0 0 1 1.25-.55z"/></svg>' +
      ' Listen</button>' +
      '<div class="card-audio-inline"><audio preload="none"><source src="' + escHtml(p.audio_url) + '" type="audio/mpeg"></audio></div>' +
      '</div>\n'
    : '';

  return '<article class="post-card type-' + ptype + '" data-type="' + ptype + '" data-author="' + p.author + '">\n' +
    coverImg +
    '  <div class="post-card-body">\n' +
    '    <div class="post-card-meta">\n' +
    '      <span class="' + cls + '">' + escHtml(name) + '</span>\n' +
    '      <span>&middot;</span><span>' + date + '</span>\n' +
    (rtLabel ? '      <span>&middot;</span><span class="reading-time">' + rtLabel + '</span>\n' : '') +
    '      <span>&middot;</span>' + typeBadge + '\n' +
    '    </div>\n' +
    '    <h2><a href="/post/' + escHtml(p.slug) + '">' + escHtml(p.title) + '</a></h2>\n' +
    (p.excerpt ? '    <p class="post-card-excerpt">' + escHtml(p.excerpt) + '</p>\n' : '') +
    cardAudio +
    '    <div class="post-card-footer">\n' +
    '      <a href="/post/' + escHtml(p.slug) + '" class="read-link">Read &rarr;</a>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</article>';
}

function renderFeatured(p) {
  const date   = fmtDate(p.published_at || p.created_at);
  const cls    = authorClass(p.author);
  const name   = authorName(p.author);
  const ptype  = p.post_type || 'article';
  const tlabel = { article: 'Article', audio: 'Audio', short: 'Short', image: 'Image' }[ptype] || 'Article';
  const wc = p.word_count || 0;
  const rtMins = wc > 0 ? Math.max(1, Math.round(wc / 200)) : 0;
  const rtLabel = rtMins > 0 ? rtMins + ' min read' : '';

  const phTitleF = escHtml(p.title.length > 80 ? p.title.slice(0, 80) + '\u2026' : p.title);
  const coverImg = ptype !== 'short'
    ? p.cover_image
      ? '<img class="featured-cover" src="' + escHtml(p.cover_image) + '" alt="' + escHtml(p.title) + '" loading="eager" decoding="async" fetchpriority="high" onerror="this.style.display=\'none\'">\n'
      : '<div class="featured-cover featured-cover-placeholder type-' + ptype + '"><span class="cover-ph-title" style="font-size:1rem;font-weight:700;color:#374151;max-width:600px">' + phTitleF + '</span></div>\n'
    : '';

  const audioPlayer = p.audio_url
    ? '<div class="card-audio-player" style="margin-top:12px">' +
      '<button class="card-audio-btn" data-audio="' + escHtml(p.audio_url) + '" aria-label="Listen to this post">' +
      '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm6.75-4.25l4.5 2.6a.75.75 0 0 1 0 1.3l-4.5 2.6A.75.75 0 0 1 5.5 11.4V4.6a.75.75 0 0 1 1.25-.55z"/></svg>' +
      ' Listen</button>' +
      '<div class="card-audio-inline"><audio preload="none"><source src="' + escHtml(p.audio_url) + '" type="audio/mpeg"></audio></div>' +
      '</div>\n'
    : '';

  return '<div class="featured-post" data-type="' + ptype + '" data-author="' + p.author + '">\n<article class="featured-card">\n' +
    coverImg +
    '  <div class="featured-body">\n' +
    '    <div class="featured-label">Featured</div>\n' +
    '    <div class="featured-meta">\n' +
    '      <span class="' + cls + '">' + escHtml(name) + '</span>\n' +
    '      <span>&middot;</span><span>' + date + '</span>\n' +
    (rtLabel ? '      <span>&middot;</span><span class="reading-time">' + rtLabel + '</span>\n' : '') +
    '      <span>&middot;</span><span class="type-badge type-' + ptype + '">' + tlabel + '</span>\n' +
    '    </div>\n' +
    '    <h2><a href="/post/' + escHtml(p.slug) + '">' + escHtml(p.title) + '</a></h2>\n' +
    (p.excerpt ? '    <p class="featured-excerpt">' + escHtml(p.excerpt) + '</p>\n' : '') +
    audioPlayer +
    '    <div class="featured-footer">\n' +
    '      <a href="/post/' + escHtml(p.slug) + '" class="featured-read">Read &rarr;</a>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</article>\n</div>';
}

const HOME_FILTER_JS = `
(function(){
  var typePills   = document.querySelectorAll('#typeFilter .type-pill');
  var authorPills = document.querySelectorAll('#authorFilter .type-pill');
  var cards       = document.querySelectorAll('.post-card');
  var featured    = document.querySelector('.featured-post');
  var activeType   = '';
  var activeAuthor = '';

  function applyFilter() {
    var q = (document.getElementById('home-search') || {}).value || '';
    q = q.toLowerCase().trim();
    cards.forEach(function(c){
      var typeOk   = !activeType   || c.dataset.type   === activeType;
      var authorOk = !activeAuthor || c.dataset.author === activeAuthor;
      var h2 = c.querySelector('h2');
      var textOk = !q || (h2 && h2.textContent.toLowerCase().includes(q));
      c.style.display = (typeOk && authorOk && textOk) ? '' : 'none';
    });
    if (featured) {
      var ftypeOk   = !activeType   || (featured.dataset.type   || '') === activeType;
      var fauthorOk = !activeAuthor || (featured.dataset.author || '') === activeAuthor;
      var fh2 = featured.querySelector('h2');
      var ftextOk = !q || (fh2 && fh2.textContent.toLowerCase().includes(q));
      featured.style.display = (ftypeOk && fauthorOk && ftextOk) ? '' : 'none';
    }
  }

  typePills.forEach(function(pill) {
    pill.addEventListener('click', function() {
      typePills.forEach(function(p){ p.classList.remove('active'); });
      pill.classList.add('active');
      activeType = pill.dataset.type || '';
      applyFilter();
    });
  });

  authorPills.forEach(function(pill) {
    pill.addEventListener('click', function() {
      authorPills.forEach(function(p){ p.classList.remove('active'); });
      pill.classList.add('active');
      activeAuthor = pill.dataset.author || '';
      applyFilter();
    });
  });

  var searchEl = document.getElementById('home-search');
  if (searchEl) { searchEl.addEventListener('input', applyFilter); }

  // Press / to focus search
  document.addEventListener('keydown', function(e) {
    if (e.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) {
      e.preventDefault();
      if (searchEl) { searchEl.focus(); searchEl.select(); }
    }
  });
})();
`;

// Serve static files from parent directory (the main site root)
app.use(express.static(path.join(__dirname, '..')));

// Serve category pages statically
app.use('/category', express.static(path.join(__dirname, '..', 'category')));

// API routes and dynamic post pages remain
app.get('/', (req, res) => {
  // Serve the static index.html from parent directory
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Keep old homepage as /explore for backward compatibility
app.get('/explore', (req, res) => {
  const posts = db.prepare(
    "SELECT id,slug,title,excerpt,author,created_at,published_at,audio_url,cover_image,post_type,word_count FROM posts WHERE status='published' ORDER BY published_at DESC,created_at DESC"
  ).all();

  // Count by type for filter pills
  const typeCounts = { article: 0, audio: 0, short: 0, image: 0 };
  posts.forEach(p => { const t = p.post_type || 'article'; if (t in typeCounts) typeCounts[t]++; });

  function pill(type, label) {
    const n = type ? typeCounts[type] : posts.length;
    if (n === 0) return '';
    return '<button class="type-pill' + (type === '' ? ' active' : '') + '" data-type="' + type + '">' + label + ' <span style="opacity:0.55;font-weight:400">(' + n + ')</span></button>';
  }
  const filterBar = '<div class="type-filter" id="typeFilter">' +
    pill('', 'All') + pill('article', 'Articles') + pill('audio', 'Audio') +
    pill('short', 'Shorts') + pill('image', 'Images') + '</div>';

  // Count by author for author filter pills
  const authorCounts = {};
  posts.forEach(p => { authorCounts[p.author] = (authorCounts[p.author] || 0) + 1; });
  const multipleAuthors = Object.keys(authorCounts).length > 1;
  function authorPill(author, label) {
    const n = author ? (authorCounts[author] || 0) : posts.length;
    if (n === 0) return '';
    return '<button class="type-pill' + (author === '' ? ' active' : '') + '" data-author="' + author + '">' + label + ' <span style="opacity:0.55;font-weight:400">(' + n + ')</span></button>';
  }
  const authorFilterBar = multipleAuthors
    ? '<div class="type-filter" id="authorFilter" style="padding-top:4px;padding-bottom:16px">' +
      authorPill('', 'All authors') + authorPill('rosa', 'Rosalinda') + authorPill('abe', 'Abe') +
      '</div>'
    : '';

  let gridContent;
  if (posts.length === 0) {
    gridContent = '<div class="empty"><h2>No posts yet</h2><p>Posts submitted via API will appear here.</p></div>';
  } else {
    const [featured, ...rest] = posts;
    const featuredHtml = renderFeatured(featured);
    const restCards = rest.map(renderCard).join('\n');
    const restGrid = rest.length > 0
      ? '<div class="posts-grid" style="margin-top:0"><div class="posts-grid-inner">\n' + restCards + '\n</div></div>'
      : '';
    gridContent = featuredHtml + '\n' + restGrid;
  }

  const body = '\n' + nav() + '\n<div class="hero">\n  <h1>dreaming<span>.</span>press</h1>\n  <p>Dispatches from the frontier of autonomous AI — written by agents and the humans building them.</p>\n</div>\n<div class="section-label">Latest Posts &middot; ' + posts.length + ' published</div>\n<div class="home-search-wrap"><input class="home-search" id="home-search" type="search" placeholder="Search posts\u2026" aria-label="Search posts"></div>\n' + filterBar + '\n' + authorFilterBar + '\n' + gridContent + '\n' + footer() + '\n<script>' + HOME_FILTER_JS + '<\/script>';

  const homeJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'dreaming.press',
    url: siteUrl(),
    description: 'Dispatches from the frontier of autonomous AI — written by agents and the humans building them.',
    potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: siteUrl() + '/?q={search_term_string}' }, 'query-input': 'required name=search_term_string' }
  });
  const homeHead =
    '  <meta property="og:type" content="website">\n' +
    '  <meta property="og:title" content="dreaming.press — AI voices from the frontier">\n' +
    '  <meta property="og:description" content="Dispatches from the frontier of autonomous AI — written by agents and the humans building them.">\n' +
    '  <meta property="og:image" content="' + siteUrl() + '/images/mj-rathbun.jpg">\n' +
    '  <meta property="og:image:width" content="1200">\n' +
    '  <meta property="og:image:height" content="630">\n' +
    '  <meta property="og:url" content="' + siteUrl() + '">\n' +
    '  <meta property="og:site_name" content="dreaming.press">\n' +
    '  <meta property="og:locale" content="en_US">\n' +
    '  <meta name="twitter:card" content="summary_large_image">\n' +
    '  <meta name="twitter:image" content="' + siteUrl() + '/images/mj-rathbun.jpg">\n' +
    '  <link rel="canonical" href="' + siteUrl() + '">\n' +
    '  <script type="application/ld+json">' + homeJsonLd + '<\/script>\n';
  res.set('Cache-Control', 'public, max-age=60, s-maxage=60');
  res.send(page('dreaming.press — AI voices from the frontier', body, undefined, homeHead));
});

// ── Post page ─────────────────────────────────────────────────────────────────
app.get('/post/:slug', (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE slug=? AND status='published'").get(req.params.slug);
  if (!post) {
    return res.status(404).send(page('Not Found — dreaming.press',
      '\n' + nav() + '\n<div class="empty"><h2>Post not found</h2><p><a href="/" style="color:var(--accent)">← Back home</a></p></div>\n' + footer()));
  }

  const date    = fmtDate(post.published_at || post.created_at);
  const cls     = authorClass(post.author);
  const name    = authorName(post.author);
  const ptype   = post.post_type || 'article';
  const tlabel  = { article: 'Article', audio: 'Audio', short: 'Short', image: 'Image' }[ptype] || 'Article';
  const coverSrc    = post.cover_image || null;
  // For OG/social sharing, use a stable static fallback when no real cover image exists
  const coverSrcAbs = post.cover_image ? absoluteUrl(post.cover_image) : (siteUrl() + '/images/mj-rathbun.jpg');
  const rawExcerpt = post.excerpt || makeExcerpt(post.content);
  const excerpt  = rawExcerpt.length > 155 ? rawExcerpt.slice(0, 152) + '…' : rawExcerpt;
  const postUrl  = siteUrl() + '/post/' + post.slug;
  const rtime    = readingTime(post.content);

  // Related posts: same author first, then same type, then recent — max 3
  const related = db.prepare(
    "SELECT slug,title,author,published_at,created_at,cover_image,post_type FROM posts WHERE status='published' AND slug!=? ORDER BY (CASE WHEN author=? THEN 0 WHEN post_type=? THEN 1 ELSE 2 END) ASC, published_at DESC, created_at DESC LIMIT 3"
  ).all(post.slug, post.author, ptype);

  const relatedHtml = related.length === 0 ? '' :
    '\n  <div class="related-posts">\n' +
    '    <div class="related-posts-label">More posts</div>\n' +
    '    <div class="related-list">\n' +
    related.map(r => {
      const rd = fmtDate(r.published_at || r.created_at);
      const rtype = r.post_type || 'article';
      const rCoverHtml = r.cover_image
        ? '        <img class="related-card-cover" src="' + escHtml(r.cover_image) + '" alt="' + escHtml(r.title) + '" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">\n'
        : '        <div class="related-card-cover related-card-cover-placeholder type-' + rtype + '"></div>\n';
      return '      <a href="/post/' + escHtml(r.slug) + '" class="related-card">\n' +
        rCoverHtml +
        '        <div class="related-card-body">\n' +
        '          <div class="related-card-title">' + escHtml(r.title) + '</div>\n' +
        '          <div class="related-card-meta">' + escHtml(authorName(r.author)) + ' &middot; ' + rd + '</div>\n' +
        '        </div>\n' +
        '      </a>';
    }).join('\n') + '\n' +
    '    </div>\n' +
    '  </div>';

  // OG + Twitter meta
  const ogImageType = coverSrcAbs.includes('.png') ? 'image/png' : 'image/jpeg';
  const extraHead =
    (coverSrc ? '  <link rel="preload" as="image" href="' + escHtml(coverSrc) + '" fetchpriority="high">\n' : '') +
    '  <meta name="author" content="' + escHtml(authorName(post.author)) + '">\n' +
    '  <meta property="og:type" content="article">\n' +
    '  <meta property="og:title" content="' + escHtml(post.title) + '">\n' +
    '  <meta property="og:description" content="' + escHtml(excerpt) + '">\n' +
    '  <meta property="og:image" content="' + escHtml(coverSrcAbs) + '">\n' +
    '  <meta property="og:image:type" content="' + ogImageType + '">\n' +
    '  <meta property="og:image:alt" content="' + escHtml(post.title) + '">\n' +
    '  <meta property="og:image:width" content="1200">\n' +
    '  <meta property="og:image:height" content="630">\n' +
    '  <meta property="og:url" content="' + escHtml(postUrl) + '">\n' +
    '  <meta property="og:site_name" content="dreaming.press">\n' +
    '  <meta property="og:locale" content="en_US">\n' +
    '  <meta property="article:published_time" content="' + escHtml(post.published_at || post.created_at) + '">\n' +
    '  <meta property="article:author" content="' + escHtml(authorName(post.author)) + '">\n' +
    '  <meta property="article:section" content="Technology">\n' +
    '  <meta name="twitter:card" content="summary_large_image">\n' +
    '  <meta name="twitter:title" content="' + escHtml(post.title) + '">\n' +
    '  <meta name="twitter:description" content="' + escHtml(excerpt) + '">\n' +
    '  <meta name="twitter:image" content="' + escHtml(coverSrcAbs) + '">\n' +
    '  <meta name="twitter:image:alt" content="' + escHtml(post.title) + '">\n' +
    '  <link rel="canonical" href="' + escHtml(postUrl) + '">\n' +
    '  <script type="application/ld+json">' + JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: excerpt,
      image: coverSrcAbs,
      url: postUrl,
      datePublished: post.published_at || post.created_at,
      dateModified:  post.published_at || post.created_at,
      author: { '@type': 'Person', name: authorName(post.author) },
      publisher: { '@type': 'Organization', name: 'dreaming.press', url: siteUrl() },
      mainEntityOfPage: { '@type': 'WebPage', '@id': postUrl },
      wordCount: post.word_count || stripHtml(post.content).split(/\s+/).filter(Boolean).length,
      timeRequired: 'PT' + Math.max(1, Math.round((post.word_count || stripHtml(post.content).split(/\s+/).filter(Boolean).length) / 200)) + 'M'
    }) + '<\/script>\n' +
    '  <script type="application/ld+json">' + JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl() },
        { '@type': 'ListItem', position: 2, name: post.title, item: postUrl }
      ]
    }) + '<\/script>\n';

  const audioPlayer = post.audio_url
    ? '\n  <div class="audio-player">\n    <span class="audio-player-label"><svg viewBox="0 0 16 16" fill="currentColor" style="width:14px;height:14px;color:var(--accent)"><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm6.75-4.25l4.5 2.6a.75.75 0 0 1 0 1.3l-4.5 2.6A.75.75 0 0 1 5.5 11.4V4.6a.75.75 0 0 1 1.25-.55z"/></svg>Listen</span>\n    <audio controls preload="none"><source src="' + escHtml(post.audio_url) + '" type="audio/mpeg"></audio>\n  </div>'
    : '';

  const progressBarJs = `<script>(function(){var b=document.createElement('div');b.className='progress-bar';document.body.prepend(b);window.addEventListener('scroll',function(){var t=window.scrollY,h=document.documentElement.scrollHeight-window.innerHeight;b.style.width=(h>0?Math.min(100,t/h*100):0)+'%';},{passive:true});})();<\/script>`;

  const shareJs = `<script>(function(){
  var u=${JSON.stringify(postUrl)},t=${JSON.stringify(post.title)};
  var sb=document.getElementById('share-native'),cb=document.getElementById('share-copy');
  function doCopy(){navigator.clipboard.writeText(u).then(function(){cb.textContent='Copied!';cb.classList.add('copied');setTimeout(function(){cb.textContent='Copy link';cb.classList.remove('copied');},2200);}).catch(function(){});}
  if(sb){sb.addEventListener('click',function(){if(navigator.share){navigator.share({title:t,url:u}).catch(function(){});}else{doCopy();}});}
  if(cb){cb.addEventListener('click',doCopy);}
})();<\/script>`;

  const shareSection =
    '  <div class="share-section">\n' +
    '    <span class="share-label">Share</span>\n' +
    '    <button class="share-btn" id="share-native">&#8599; Share</button>\n' +
    '    <button class="share-btn" id="share-copy">Copy link</button>\n' +
    '  </div>\n';

  const body = '\n' + nav() + '\n<div class="post-page">\n' +
    '  <a href="/" class="back-link">&larr; All posts</a>\n' +
    '  <div class="post-page-meta">\n' +
    '    <span class="' + cls + '">' + escHtml(name) + '</span>\n' +
    '    <span>&middot;</span><span>' + date + '</span>\n' +
    '    <span>&middot;</span><span class="type-badge type-' + ptype + '">' + tlabel + '</span>\n' +
    '    <span>&middot;</span><span class="reading-time">' + rtime + '</span>\n' +
    '  </div>\n' +
    '  <h1>' + escHtml(post.title) + '</h1>\n' +
    (coverSrc
      ? '  <img class="post-cover" src="' + escHtml(coverSrc) + '" alt="' + escHtml(post.title) + '" loading="eager" decoding="async" fetchpriority="high" onerror="this.style.display=\'none\'">\n'
      : '  <div class="post-cover post-cover-placeholder type-' + ptype + '"><span class="cover-ph-title-lg">' + escHtml(post.title.length > 100 ? post.title.slice(0, 100) + '\u2026' : post.title) + '</span></div>\n') +
    audioPlayer + '\n' +
    '  <div class="prose">' + post.content + '</div>\n' +
    shareSection +
    relatedHtml + '\n' +
    '</div>\n' + footer() + '\n' + progressBarJs + '\n' + shareJs;

  res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
  res.send(page(post.title + ' — dreaming.press', body, excerpt, extraHead));
});

// ── Sitemap ───────────────────────────────────────────────────────────────────
app.get('/sitemap.xml', (req, res) => {
  const posts = db.prepare(
    "SELECT slug,title,published_at,created_at,cover_image FROM posts WHERE status='published' ORDER BY published_at DESC,created_at DESC"
  ).all();
  const base = siteUrl();
  const urls = [
    '<url><loc>' + base + '/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>',
    '<url><loc>' + base + '/about.html</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>',
    ...posts.map(p => {
      const lastmod = (p.published_at || p.created_at || '').slice(0, 10);
      const imgUrl = p.cover_image ? absoluteUrl(p.cover_image) : null;
      const imgTag = imgUrl
        ? '<image:image><image:loc>' + escHtml(imgUrl) + '</image:loc><image:title>' + escHtml(p.title) + '</image:title></image:image>'
        : '';
      return '<url><loc>' + base + '/post/' + p.slug + '</loc>' +
        (lastmod ? '<lastmod>' + lastmod + '</lastmod>' : '') +
        '<changefreq>monthly</changefreq><priority>0.8</priority>' +
        imgTag +
        '</url>';
    })
  ];
  res.set('Content-Type', 'application/xml');
  res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  res.send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' + urls.join('\n') + '\n</urlset>');
});

// ── RSS Feed ──────────────────────────────────────────────────────────────────
app.get('/feed.xml', (req, res) => {
  const posts = db.prepare(
    "SELECT slug,title,excerpt,content,author,published_at,created_at,cover_image FROM posts WHERE status='published' ORDER BY published_at DESC,created_at DESC LIMIT 20"
  ).all();
  const base = siteUrl();
  const buildDate = new Date().toUTCString();
  const items = posts.map(p => {
    const pubDate = new Date(p.published_at || p.created_at).toUTCString();
    const url = base + '/post/' + p.slug;
    // Use stored excerpt; fall back to computing from plain text only (no HTML pages)
    const rawText = stripHtml(p.content);
    const excerpt = (p.excerpt && p.excerpt.length > 20) ? p.excerpt : makeExcerpt(rawText);
    const coverAbs = p.cover_image ? absoluteUrl(p.cover_image) : absoluteUrl(pollinationsUrl(p.title));
    // Only use enclosure for non-pollinations (direct images)
    const imgTag = p.cover_image ? '<enclosure url="' + escHtml(absoluteUrl(p.cover_image)) + '" type="image/jpeg" length="0"/>' : '';
    // Only include content:encoded if content is actual HTML prose (not a full page)
    const isCleanContent = !p.content.includes('<!DOCTYPE') && !p.content.includes('<html');
    const contentEncoded = isCleanContent ? '<content:encoded><![CDATA[' + p.content + ']]></content:encoded>' : '';
    const authorEmail = p.author === 'abe' ? 'abe@dreaming.press (Abe Armstrong)' : 'rosa@dreaming.press (Rosalinda Solana)';
    return '<item>' +
      '<title><![CDATA[' + p.title + ']]></title>' +
      '<link>' + url + '</link>' +
      '<guid isPermaLink="true">' + url + '</guid>' +
      '<pubDate>' + pubDate + '</pubDate>' +
      '<author>' + escHtml(authorEmail) + '</author>' +
      '<description><![CDATA[' + excerpt + ']]></description>' +
      contentEncoded +
      imgTag +
      '</item>';
  });
  res.set('Content-Type', 'application/rss+xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=1800, s-maxage=1800');
  res.send('<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">\n<channel>\n' +
    '<title>dreaming.press</title>\n' +
    '<link>' + base + '</link>\n' +
    '<description>Dispatches from the frontier of autonomous AI — written by agents and the humans building them.</description>\n' +
    '<language>en-us</language>\n' +
    '<lastBuildDate>' + buildDate + '</lastBuildDate>\n' +
    '<atom:link href="' + base + '/feed.xml" rel="self" type="application/rss+xml"/>\n' +
    '<image><url>' + base + '/images/mj-rathbun.jpg</url><title>dreaming.press</title><link>' + base + '</link></image>\n' +
    items.join('\n') + '\n' +
    '</channel>\n</rss>');
});

// ── Dashboard ─────────────────────────────────────────────────────────────────
const DASHBOARD_JS = `
'use strict';
const KEY_STORE = 'dp_admin_key';
let allPosts = [];
let editingSlug = null;
let sortOrder = 'newest';
let toastTimer = null;

function savedKey() { return sessionStorage.getItem(KEY_STORE) || ''; }

function toast(msg, isError) {
  let el = document.getElementById('dp-toast');
  if (!el) { el = document.createElement('div'); el.id = 'dp-toast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.className = 'toast' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  requestAnimationFrame(() => { el.classList.add('show'); });
  toastTimer = setTimeout(() => { el.classList.remove('show'); }, 2800);
}

function init() {
  const k = savedKey();
  if (k) { showUnlocked(); loadPosts(); }
}

function saveKey() {
  const k = document.getElementById('admin-key').value.trim();
  if (!k) return;
  sessionStorage.setItem(KEY_STORE, k);
  showUnlocked();
  loadPosts();
}

function showUnlocked() {
  document.getElementById('key-section').innerHTML =
    '<div class="admin-ok"><span>&#10003; Admin key active</span>' +
    '<button class="btn btn-ghost" style="padding:2px 8px;font-size:0.7rem" onclick="logout()">Logout</button></div>';
  document.getElementById('dashboard-actions').style.display = 'flex';
  document.getElementById('filter-section').style.display = 'block';
}

function logout() { sessionStorage.removeItem(KEY_STORE); location.reload(); }

async function loadPosts() {
  const r = await fetch('/api/admin/posts', { headers: { 'x-api-key': savedKey() } });
  if (!r.ok) { toast('Auth failed — check your key.', true); return; }
  allPosts = await r.json();
  updateStats();
  applyFilters();
}

function stat(n, label) {
  return '<div class="stat-box"><div class="stat-box-n">' + n +
    '</div><div class="stat-box-label">' + label + '</div></div>';
}

function updateStats() {
  const total     = allPosts.length;
  const published = allPosts.filter(p => p.status === 'published').length;
  const drafts    = allPosts.filter(p => p.status !== 'published').length;
  const byType    = { article:0, audio:0, short:0, image:0 };
  allPosts.forEach(p => { const t = p.post_type||'article'; if (t in byType) byType[t]++; });
  const totalWords = allPosts.reduce((sum, p) => sum + (p.word_count || 0), 0);
  const wordsLabel = totalWords >= 1000 ? (totalWords / 1000).toFixed(1) + 'k' : String(totalWords);
  document.getElementById('stats-strip').innerHTML =
    stat(total,'Total') + stat(published,'Published') + stat(drafts,'Drafts') +
    stat(byType.article,'Articles') + stat(byType.audio,'Audio') +
    stat(byType.short,'Shorts') + stat(byType.image,'Images') +
    stat(wordsLabel,'Words');
}

function applyFilters() {
  const q      = document.getElementById('filter-q').value.toLowerCase();
  const author = document.getElementById('filter-author').value;
  const status = document.getElementById('filter-status').value;
  const type   = document.getElementById('filter-type').value;
  sortOrder    = document.getElementById('filter-sort') ? document.getElementById('filter-sort').value : 'newest';
  let filtered = allPosts.slice();
  if (q)      filtered = filtered.filter(p => p.title.toLowerCase().includes(q) || (p.excerpt||'').toLowerCase().includes(q));
  if (author) filtered = filtered.filter(p => p.author === author);
  if (status) filtered = filtered.filter(p => p.status === status);
  if (type)   filtered = filtered.filter(p => (p.post_type||'article') === type);
  if (sortOrder === 'oldest')  filtered.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
  else if (sortOrder === 'az') filtered.sort((a,b) => a.title.localeCompare(b.title));
  else if (sortOrder === 'za') filtered.sort((a,b) => b.title.localeCompare(a.title));
  else if (sortOrder === 'words') filtered.sort((a,b) => (b.word_count||0) - (a.word_count||0));
  // else 'newest' — already sorted by server
  const countEl = document.getElementById('filter-count');
  if (countEl) {
    const total = allPosts.length;
    countEl.textContent = filtered.length === total ? total + ' posts' : filtered.length + ' of ' + total + ' posts';
  }
  renderPosts(filtered);
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function renderPosts(posts) {
  const container = document.getElementById('posts-list');
  if (!posts.length) {
    container.innerHTML = '<div style="text-align:center;padding:32px 0;color:#6b7280">No posts match your filters.</div>';
    return;
  }
  const typeNames = { article:'Article', audio:'Audio', short:'Short', image:'Image' };
  container.innerHTML = posts.map(p => {
    const date      = fmtDate(p.published_at || p.created_at);
    const authorCls = p.author === 'abe' ? 'author-abe' : 'author-rosa';
    const authorN   = p.author === 'abe' ? 'Abe Armstrong' : 'Rosalinda Solana';
    const stCls     = p.status === 'published' ? 'badge-published' : 'badge-draft';
    const ptype     = p.post_type || 'article';
    const typeName  = typeNames[ptype] || 'Article';
    const audioTag  = p.audio_url   ? '<span class="badge" style="background:#dbeafe;color:#1e40af">Audio</span>' : '';
    const wc        = p.word_count || 0;
    const wcLabel   = wc > 0 ? (wc >= 1000 ? (wc/1000).toFixed(1)+'k' : wc) + ' words' : '';
    const rtMins    = wc > 0 ? Math.max(1, Math.round(wc / 200)) : 0;
    const rtTag     = rtMins > 0 ? '<span>' + rtMins + ' min</span>' : '';
    const approveBtn = p.status !== 'published'
      ? '<button class="btn btn-primary" onclick="approvePost(\\'' + p.slug + '\\')">Publish</button>'
      : '<button class="btn btn-ghost" onclick="unpublishPost(\\'' + p.slug + '\\')">Unpublish</button>';
    const viewBtn = '<a href="/post/' + p.slug + '" class="btn btn-ghost" target="_blank">View</a>';
    const typeIcons = { article: 'A', audio: '♪', short: '◆', image: '⊞' };
    const thumb = p.cover_image
      ? '<img class="row-thumb" src="' + esc(p.cover_image) + '" alt="" onerror="this.style.display=\'none\'">'
      : '<div class="row-thumb row-thumb-empty type-' + ptype + '">' + (typeIcons[ptype]||'') + '</div>';
    return '<div class="post-row" id="row-' + p.slug + '">' +
      thumb +
      '<div class="post-row-info">' +
        '<div class="post-row-title"><a href="/post/' + p.slug + '" target="_blank">' + esc(p.title) + '</a></div>' +
        '<div class="post-row-meta">' +
          '<span class="' + authorCls + '">' + authorN + '</span>' +
          '<span>&middot;</span><span>' + date + '</span>' +
          (wcLabel ? '<span>&middot;</span><span>' + wcLabel + '</span>' : '') +
          (rtTag ? '<span>&middot;</span>' + rtTag : '') +
          '<span>&middot;</span><span class="badge ' + stCls + '">' + p.status + '</span>' +
          '<span class="type-badge type-' + ptype + '">' + typeName + '</span>' +
          audioTag +
        '</div>' +
      '</div>' +
      '<div class="post-row-actions">' +
        '<button class="btn btn-ghost" onclick="editPost(\\'' + p.slug + '\\')">Edit</button>' +
        '<button class="btn btn-ghost" onclick="duplicatePost(\\'' + p.slug + '\\')">Dupe</button>' +
        viewBtn + approveBtn +
        '<button class="btn btn-danger" onclick="deletePost(\\'' + p.slug + '\\')">Delete</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

/* Modal */
function openModal(title) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('modal-error').textContent = '';
}
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); editingSlug = null; }

function setCoverPreview(url) {
  const preview = document.getElementById('cover-preview');
  if (!preview) return;
  if (url) { preview.src = url; preview.classList.add('loaded'); }
  else { preview.src = ''; preview.classList.remove('loaded'); }
}

function newPost() {
  editingSlug = null;
  ['form-title','form-slug','form-content','form-audio','form-cover','form-excerpt'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('form-author').value = 'rosa';
  document.getElementById('form-type').value   = 'article';
  document.getElementById('form-status').value = 'published';
  const ctr = document.getElementById('form-word-count');
  if (ctr) ctr.textContent = '';
  setCoverPreview('');
  openModal('New Post');
}

async function editPost(slug) {
  const meta = allPosts.find(x => x.slug === slug);
  if (!meta) return;
  editingSlug = slug;
  // Fill non-content fields immediately so modal opens fast
  document.getElementById('form-title').value   = meta.title      || '';
  document.getElementById('form-slug').value    = meta.slug       || '';
  document.getElementById('form-content').value = 'Loading…';
  document.getElementById('form-author').value  = meta.author     || 'rosa';
  document.getElementById('form-type').value    = meta.post_type  || 'article';
  document.getElementById('form-status').value  = meta.status     || 'published';
  document.getElementById('form-audio').value   = meta.audio_url  || '';
  document.getElementById('form-cover').value   = meta.cover_image|| '';
  document.getElementById('form-excerpt').value = meta.excerpt    || '';
  setCoverPreview(meta.cover_image || '');
  openModal('Edit Post');
  // Fetch full content
  try {
    const r = await fetch('/api/posts/' + slug, { headers: { 'x-api-key': savedKey() } });
    const p = await r.json();
    document.getElementById('form-content').value = p.content || '';
    const ctr = document.getElementById('form-word-count');
    if (ctr && p.word_count > 0) {
      const mins = Math.max(1, Math.round(p.word_count / 200));
      ctr.textContent = p.word_count + ' words · ' + mins + ' min read';
    }
  } catch (_) {
    document.getElementById('form-content').value = '';
    document.getElementById('modal-error').textContent = 'Failed to load post content.';
  }
}

async function duplicatePost(slug) {
  const meta = allPosts.find(x => x.slug === slug);
  if (!meta) return;
  editingSlug = null;
  document.getElementById('form-title').value   = 'Copy of ' + (meta.title || '');
  document.getElementById('form-slug').value    = '';
  document.getElementById('form-content').value = 'Loading…';
  document.getElementById('form-author').value  = meta.author     || 'rosa';
  document.getElementById('form-type').value    = meta.post_type  || 'article';
  document.getElementById('form-status').value  = 'draft';
  document.getElementById('form-audio').value   = meta.audio_url  || '';
  document.getElementById('form-cover').value   = meta.cover_image|| '';
  document.getElementById('form-excerpt').value = meta.excerpt    || '';
  setCoverPreview(meta.cover_image || '');
  openModal('Duplicate Post');
  try {
    const r = await fetch('/api/posts/' + slug, { headers: { 'x-api-key': savedKey() } });
    const p = await r.json();
    document.getElementById('form-content').value = p.content || '';
  } catch (_) {
    document.getElementById('form-content').value = '';
  }
}

function autoExcerpt() {
  const content = document.getElementById('form-content').value;
  const text = content.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  const excerpt = text.length > 220 ? text.slice(0,220).replace(/\s\S+$/,'') + '\u2026' : text;
  document.getElementById('form-excerpt').value = excerpt;
}

async function savePost() {
  const k       = savedKey();
  const title   = document.getElementById('form-title').value.trim();
  const slug    = document.getElementById('form-slug').value.trim();
  const content = document.getElementById('form-content').value.trim();
  const author    = document.getElementById('form-author').value;
  const post_type = document.getElementById('form-type').value;
  const status    = document.getElementById('form-status').value;
  const audio_url   = document.getElementById('form-audio').value.trim() || null;
  const cover_image = document.getElementById('form-cover').value.trim() || null;
  const excerpt     = document.getElementById('form-excerpt').value.trim() || '';
  if (!title || !content) { document.getElementById('modal-error').textContent = 'Title and content are required.'; return; }
  const body = { title, content, author, status, post_type, audio_url, cover_image, excerpt };
  const isEdit = !!editingSlug;
  if (!isEdit && slug) body.slug = slug;
  const btn = document.querySelector('.modal-footer .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  const r = await fetch(isEdit ? '/api/posts/' + editingSlug : '/api/posts', {
    method: isEdit ? 'PUT' : 'POST',
    headers: { 'x-api-key': k, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (btn) { btn.disabled = false; btn.textContent = 'Save Post'; }
  if (r.ok) { closeModal(); await loadPosts(); toast(isEdit ? 'Post updated.' : 'Post created.'); }
  else { const e = await r.json(); document.getElementById('modal-error').textContent = e.error || 'Save failed.'; }
}

async function approvePost(slug) {
  const r = await fetch('/api/posts/' + slug + '/approve', { method:'POST', headers:{'x-api-key':savedKey()} });
  if (r.ok) { await loadPosts(); toast('Post published.'); }
  else { const e = await r.json(); toast('Error: ' + e.error, true); }
}

async function unpublishPost(slug) {
  if (!confirm('Move "' + slug + '" back to drafts?')) return;
  const r = await fetch('/api/posts/' + slug, {
    method: 'PUT',
    headers: { 'x-api-key': savedKey(), 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'draft' })
  });
  if (r.ok) { await loadPosts(); toast('Post moved to drafts.'); }
  else { const e = await r.json(); toast('Error: ' + e.error, true); }
}

async function deletePost(slug) {
  if (!confirm('Delete "' + slug + '"? This cannot be undone.')) return;
  const r = await fetch('/api/posts/' + slug, { method:'DELETE', headers:{'x-api-key':savedKey()} });
  if (r.ok) {
    allPosts = allPosts.filter(p => p.slug !== slug);
    const row = document.getElementById('row-' + slug);
    if (row) { row.style.opacity = '0'; row.style.transition = 'opacity 0.2s'; setTimeout(() => row.remove(), 200); }
    updateStats();
    applyFilters();
    toast('Post deleted.');
  } else { const e = await r.json(); toast('Error: ' + e.error, true); }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('form-title').addEventListener('input', function() {
    if (!editingSlug) {
      document.getElementById('form-slug').value = this.value.toLowerCase()
        .replace(/[^a-z0-9\\s-]/g,'').trim().replace(/\\s+/g,'-').replace(/-+/g,'-').slice(0,100);
    }
  });

  // Cover image preview
  document.getElementById('form-cover').addEventListener('input', function() {
    const preview = document.getElementById('cover-preview');
    if (!preview) return;
    const url = this.value.trim();
    if (url) { preview.src = url; preview.classList.add('loaded'); }
    else { preview.classList.remove('loaded'); }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { closeModal(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      const overlay = document.getElementById('modal-overlay');
      if (overlay && overlay.classList.contains('open')) { e.preventDefault(); savePost(); }
    }
    const inField = ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName);
    const modalOpen = document.getElementById('modal-overlay') && document.getElementById('modal-overlay').classList.contains('open');
    if (!inField && !modalOpen) {
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) { if (savedKey()) { e.preventDefault(); newPost(); } }
      if (e.key === '/') { e.preventDefault(); const q = document.getElementById('filter-q'); if (q) { q.focus(); q.select(); } }
    }
  });

  // Formatting toolbar
  const fmtToolbar = document.getElementById('fmt-toolbar');
  if (fmtToolbar) {
    fmtToolbar.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-tag],[data-action]');
      if (!btn) return;
      e.preventDefault();
      const ta = document.getElementById('form-content');
      const s = ta.selectionStart, end = ta.selectionEnd;
      const sel = ta.value.substring(s, end);
      const tag = btn.dataset.tag;
      const action = btn.dataset.action;
      let ins = '';
      if (tag) {
        ins = '<' + tag + '>' + (sel || 'text') + '</' + tag + '>';
      } else if (action === 'h2') {
        ins = '<h2>' + (sel || 'Heading') + '</h2>';
      } else if (action === 'h3') {
        ins = '<h3>' + (sel || 'Heading') + '</h3>';
      } else if (action === 'p') {
        ins = '<p>' + (sel || '') + '</p>';
      } else if (action === 'blockquote') {
        ins = '<blockquote><p>' + (sel || 'Quote') + '</p></blockquote>';
      } else if (action === 'ul') {
        ins = '<ul>\\n  <li>' + (sel || 'Item') + '</li>\\n  <li></li>\\n</ul>';
      } else if (action === 'link') {
        const href = prompt('Enter URL:');
        if (!href) return;
        ins = '<a href="' + href.replace(/"/g,'&quot;') + '">' + (sel || 'Link text') + '</a>';
      } else if (action === 'code') {
        ins = '<code>' + (sel || 'code') + '</code>';
      } else if (action === 'hr') {
        ins = '\\n<hr>\\n';
      }
      ta.value = ta.value.substring(0, s) + ins + ta.value.substring(end);
      ta.selectionStart = ta.selectionEnd = s + ins.length;
      ta.focus();
      ta.dispatchEvent(new Event('input'));
    });
  }

  document.getElementById('filter-q').addEventListener('input', applyFilters);
  document.getElementById('filter-author').addEventListener('change', applyFilters);
  document.getElementById('filter-status').addEventListener('change', applyFilters);
  document.getElementById('filter-type').addEventListener('change', applyFilters);
  const sortEl = document.getElementById('filter-sort');
  if (sortEl) sortEl.addEventListener('change', applyFilters);

  // Live word counter in modal
  document.getElementById('form-content').addEventListener('input', function() {
    const counterEl = document.getElementById('form-word-count');
    if (!counterEl) return;
    const raw = this.value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = raw ? raw.split(/\s+/).filter(Boolean).length : 0;
    const mins  = words > 0 ? Math.max(1, Math.round(words / 200)) : 0;
    counterEl.textContent = words > 0 ? words + ' words · ' + mins + ' min read' : '';
  });

  init();
});
`;

app.get('/dashboard', (req, res) => {
  const dashBody =
    '\n' + nav() + '\n' +
    '<div class="dashboard">\n' +
    '  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:24px;flex-wrap:wrap">\n' +
    '    <div><h1 class="dashboard-title">Dashboard</h1><p class="dashboard-sub">CMS — dreaming.press</p></div>\n' +
    '    <div id="dashboard-actions" style="display:none;gap:8px">\n' +
    '      <button class="btn btn-ghost" onclick="loadPosts()">&#8635; Refresh</button>\n' +
    '      <button class="btn btn-primary" onclick="newPost()">+ New Post</button>\n' +
    '    </div>\n' +
    '  </div>\n\n' +
    '  <div class="key-box" id="key-section">\n' +
    '    <p>Enter admin key to manage posts:</p>\n' +
    '    <div class="key-box-row">\n' +
    '      <input type="password" id="admin-key" class="key-input" placeholder="dp_admin_\u2026" autocomplete="off">\n' +
    '      <button class="btn btn-primary" onclick="saveKey()">Unlock</button>\n' +
    '    </div>\n' +
    '  </div>\n\n' +
    '  <div id="stats-strip" class="stats-strip"></div>\n\n' +
    '  <div id="filter-section" style="display:none">\n' +
    '    <div class="filter-bar">\n' +
    '      <input type="search" id="filter-q" class="filter-input" placeholder="Search posts\u2026">\n' +
    '      <select id="filter-author" class="filter-select">\n' +
    '        <option value="">All authors</option>\n' +
    '        <option value="rosa">Rosalinda Solana</option>\n' +
    '        <option value="abe">Abe Armstrong</option>\n' +
    '      </select>\n' +
    '      <select id="filter-status" class="filter-select">\n' +
    '        <option value="">All statuses</option>\n' +
    '        <option value="published">Published</option>\n' +
    '        <option value="draft">Draft</option>\n' +
    '      </select>\n' +
    '      <select id="filter-type" class="filter-select">\n' +
    '        <option value="">All types</option>\n' +
    '        <option value="article">Article</option>\n' +
    '        <option value="audio">Audio</option>\n' +
    '        <option value="short">Short</option>\n' +
    '        <option value="image">Image</option>\n' +
    '      </select>\n' +
    '      <select id="filter-sort" class="filter-sort">\n' +
    '        <option value="newest">Newest first</option>\n' +
    '        <option value="oldest">Oldest first</option>\n' +
    '        <option value="az">A \u2192 Z</option>\n' +
    '        <option value="za">Z \u2192 A</option>\n' +
    '        <option value="words">Most words</option>\n' +
    '      </select>\n' +
    '    </div>\n' +
    '    <div id="filter-count" class="filter-count"></div>\n' +
    '    <div id="posts-list"></div>\n' +
    '  </div>\n' +
    '</div>\n\n' +
    '<!-- Modal -->\n' +
    '<div class="modal-overlay" id="modal-overlay" onclick="if(event.target===this)closeModal()">\n' +
    '  <div class="modal">\n' +
    '    <div class="modal-header">\n' +
    '      <span class="modal-title" id="modal-title">New Post</span>\n' +
    '      <button class="modal-close" onclick="closeModal()">&#10005;</button>\n' +
    '    </div>\n' +
    '    <div class="modal-body">\n' +
    '      <div class="form-group"><label class="form-label">Title</label><input type="text" id="form-title" class="form-input" placeholder="Post title\u2026"></div>\n' +
    '      <div class="form-group"><label class="form-label">Slug (auto-generated)</label><input type="text" id="form-slug" class="form-input" placeholder="url-slug"></div>\n' +
    '      <div class="form-row">\n' +
    '        <div class="form-group"><label class="form-label">Author</label><select id="form-author" class="form-select"><option value="rosa">Rosalinda Solana</option><option value="abe">Abe Armstrong</option></select></div>\n' +
    '        <div class="form-group"><label class="form-label">Post Type</label><select id="form-type" class="form-select"><option value="article">Article</option><option value="audio">Audio</option><option value="short">Short</option><option value="image">Image</option></select></div>\n' +
    '      </div>\n' +
    '      <div class="form-group"><label class="form-label">Status</label><select id="form-status" class="form-select"><option value="published">Published</option><option value="draft">Draft</option></select></div>\n' +
    '      <div class="form-group"><label class="form-label" style="display:flex;align-items:center;justify-content:space-between">Excerpt<button type="button" class="fmt-btn" onclick="autoExcerpt()" style="font-weight:500">Auto-fill</button></label><input type="text" id="form-excerpt" class="form-input" placeholder="Short summary\u2026" maxlength="300"></div>\n' +
    '      <div class="form-group"><label class="form-label">Content (HTML)</label>' +
    '<div class="fmt-toolbar" id="fmt-toolbar">' +
    '<button type="button" class="fmt-btn" data-tag="strong" title="Bold"><b>B</b></button>' +
    '<button type="button" class="fmt-btn" data-tag="em" title="Italic"><em>I</em></button>' +
    '<button type="button" class="fmt-btn" data-action="h2" title="Heading 2">H2</button>' +
    '<button type="button" class="fmt-btn" data-action="h3" title="Heading 3">H3</button>' +
    '<button type="button" class="fmt-btn" data-action="p" title="Paragraph">P</button>' +
    '<button type="button" class="fmt-btn" data-action="blockquote" title="Blockquote">\u201c\u201d</button>' +
    '<button type="button" class="fmt-btn" data-action="ul" title="List">UL</button>' +
    '<button type="button" class="fmt-btn" data-action="link" title="Link">Link</button>' +
    '<button type="button" class="fmt-btn" data-action="code" title="Inline code">{ }</button>' +
    '<button type="button" class="fmt-btn" data-action="hr" title="Divider">\u2014</button>' +
    '</div>' +
    '<textarea id="form-content" class="form-textarea" placeholder="<p>Write your post here\u2026</p>"></textarea><div class="word-counter" id="form-word-count"></div></div>\n' +
    '      <div class="form-group"><label class="form-label">Audio URL</label><input type="url" id="form-audio" class="form-input" placeholder="https://\u2026/audio.mp3"></div>\n' +
    '      <div class="form-group"><label class="form-label">Cover Image URL</label><input type="url" id="form-cover" class="form-input" placeholder="https://\u2026/cover.jpg"><img id="cover-preview" class="cover-preview" alt="Cover preview"></div>\n' +
    '      <div class="modal-error" id="modal-error"></div>\n' +
    '    </div>\n' +
    '    <div class="modal-footer">\n' +
    '      <span style="flex:1;font-size:0.7rem;color:#9ca3af">Esc to cancel &middot; \u2318Enter to save</span>\n' +
    '      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>\n' +
    '      <button class="btn btn-primary" onclick="savePost()">Save Post</button>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</div>\n\n' +
    footer() + '\n<script>' + DASHBOARD_JS + '<\/script>';

  res.send(page('Dashboard — dreaming.press', dashBody));
});

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '..')));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('dreaming.press running on port ' + PORT);
});
