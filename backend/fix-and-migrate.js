'use strict';
/**
 * fix-and-migrate.js
 * 1. Fixes posts with full page HTML stored as content (extracts article body)
 * 2. Migrates unmigrated post HTML files to DB
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH   = path.join(__dirname, 'dreaming.db');
const POSTS_DIR = path.join(__dirname, '..', 'posts');
const db = new Database(DB_PATH);

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
function makeExcerpt(content, len = 200) {
  const text = stripHtml(content);
  return text.length > len ? text.slice(0, len).replace(/\s\S+$/, '') + '…' : text;
}

// Extract the article body from HTML — tries multiple container patterns
function extractContent(html) {
  const patterns = [
    '<div class="prose">',
    '<div class="post-body">',
    '<div class="post-content">',
  ];
  for (const marker of patterns) {
    const start = html.indexOf(marker);
    if (start === -1) continue;
    let pos   = start + marker.length;
    let depth = 1;
    while (pos < html.length && depth > 0) {
      if (html.startsWith('<div', pos)) { depth++; pos += 4; }
      else if (html.startsWith('</div>', pos)) { depth--; if (depth === 0) break; pos += 6; }
      else pos++;
    }
    const content = html.slice(start + marker.length, pos).trim();
    if (content.length > 50) return content;
  }
  return '';
}

function extractTitle(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return h1[1].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').trim();
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t) return t[1].split(/[—–]/)[0].trim();
  return 'Untitled';
}

function extractAuthor(filename, html) {
  if (filename.toLowerCase().includes('abe') || html.includes('Abe Armstrong') || html.includes('"abe"')) return 'abe';
  return 'rosa';
}

function extractDate(filename) {
  const m = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] + 'T00:00:00.000Z' : null;
}

// ── Step 1: Fix posts with full-page HTML stored as content ───────────────────
console.log('\n── Step 1: Fix posts with full-page HTML as content ──\n');
const brokenPosts = db.prepare(
  "SELECT slug, content FROM posts WHERE content LIKE '<!DOCTYPE%' OR content LIKE '%<html%'"
).all();

for (const post of brokenPosts) {
  const extracted = extractContent(post.content);
  if (!extracted) {
    console.log(`  WARN: Could not extract content for ${post.slug} — skipping`);
    continue;
  }
  const excerpt = makeExcerpt(extracted);
  db.prepare('UPDATE posts SET content=?, excerpt=? WHERE slug=?')
    .run(extracted, excerpt, post.slug);
  console.log(`  ✓ Fixed: ${post.slug} (${extracted.length} chars)`);
}
if (brokenPosts.length === 0) console.log('  (none found)');

// ── Step 2: Migrate unmigrated posts ──────────────────────────────────────────
console.log('\n── Step 2: Migrate unmigrated post files ──\n');
const insert = db.prepare(
  `INSERT OR IGNORE INTO posts (slug,title,content,excerpt,author,status,created_at,published_at)
   VALUES (?,?,?,?,?,'published',?,?)`
);

const files = fs.readdirSync(POSTS_DIR)
  .filter(f => f.endsWith('.html') && !f.startsWith('_'));

let inserted = 0, skipped = 0;
const migrate = db.transaction(() => {
  for (const file of files) {
    const slug  = file.replace(/\.html$/, '');
    const html  = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
    const content = extractContent(html);
    if (!content) { console.log(`  SKIP (no content): ${file}`); skipped++; continue; }
    const title   = extractTitle(html);
    const author  = extractAuthor(file, html);
    const dateIso = extractDate(file);
    const now     = dateIso || new Date().toISOString();
    const excerpt = makeExcerpt(content);
    const r = insert.run(slug, title, content, excerpt, author, now, now);
    if (r.changes > 0) { console.log(`  ✓ ${slug} [${author}]`); inserted++; }
    else { console.log(`  ~ exists: ${slug}`); skipped++; }
  }
});

migrate();
console.log(`\nDone: ${inserted} inserted, ${skipped} skipped.\n`);
