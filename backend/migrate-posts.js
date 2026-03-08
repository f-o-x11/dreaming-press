'use strict';
/**
 * migrate-posts.js
 * One-time migration: read all posts/*.html → insert into dreaming.db
 * Run: node migrate-posts.js
 */

const fs      = require('fs');
const path    = require('path');
const Database = require('better-sqlite3');

const DB_PATH    = path.join(__dirname, 'dreaming.db');
const POSTS_DIR  = path.join(__dirname, '..', 'posts');

const db = new Database(DB_PATH);

// Ensure table exists
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
    published_at TEXT
  );
`);

const insert = db.prepare(
  `INSERT OR IGNORE INTO posts (slug, title, content, excerpt, author, status, created_at, published_at)
   VALUES (?, ?, ?, ?, ?, 'published', ?, ?)`
);

// ── Parsers ───────────────────────────────────────────────────────────────────

function extractTitle(html) {
  // Try <h1> first
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    return h1[1].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
  }
  // Fallback: <title>
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t) {
    return t[1].split(/[—–]/)[0].trim();
  }
  return 'Untitled';
}

function extractContent(html) {
  const marker = '<div class="prose">';
  const start  = html.indexOf(marker);
  if (start === -1) return '';

  let pos   = start + marker.length;
  let depth = 1;

  while (pos < html.length && depth > 0) {
    if (html.startsWith('<div', pos)) {
      depth++;
      pos += 4;
    } else if (html.startsWith('</div>', pos)) {
      depth--;
      if (depth === 0) break;
      pos += 6;
    } else {
      pos++;
    }
  }

  return html.slice(start + marker.length, pos).trim();
}

function extractAuthor(filename, html) {
  const lower = filename.toLowerCase();
  if (lower.includes('abe') ||
      html.includes('Abe Armstrong') ||
      html.includes('>Abe<') ||
      html.includes('"abe"')) {
    return 'abe';
  }
  return 'rosa';
}

function extractDate(filename) {
  const m = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] + 'T00:00:00.000Z' : null;
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function makeExcerpt(content, len = 200) {
  const text = stripHtml(content);
  return text.length > len ? text.slice(0, len).replace(/\s\S+$/, '') + '…' : text;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const files = fs.readdirSync(POSTS_DIR)
  .filter(f => f.endsWith('.html') && !f.startsWith('_'));

let inserted = 0;
let skipped  = 0;

const migrateAll = db.transaction(() => {
  for (const file of files) {
    const slug    = file.replace(/\.html$/, '');
    const html    = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
    const title   = extractTitle(html);
    const content = extractContent(html);
    const author  = extractAuthor(file, html);
    const dateIso = extractDate(file);
    const now     = dateIso || new Date().toISOString();
    const excerpt = makeExcerpt(content);

    if (!content) {
      console.log(`  SKIP (no prose content): ${file}`);
      skipped++;
      continue;
    }

    const result = insert.run(slug, title, content, excerpt, author, now, now);
    if (result.changes > 0) {
      console.log(`  ✓ ${slug} [${author}]`);
      inserted++;
    } else {
      console.log(`  ~ already exists: ${slug}`);
      skipped++;
    }
  }
});

console.log(`\nmigrate-posts: reading ${files.length} files from ${POSTS_DIR}\n`);
migrateAll();
console.log(`\nDone: ${inserted} inserted, ${skipped} skipped.\n`);
