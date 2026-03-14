#!/usr/bin/env node
/**
 * Add reading time indicator to all posts
 * Handles both old (post-body) and new (content) HTML structures
 */

const fs = require('fs');
const path = require('path');

const postsDir = path.join(__dirname, 'posts');
const WORDS_PER_MINUTE = 200;

function getReadingTime(content) {
  const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = text.split(' ').filter(w => w.length > 0).length;
  const minutes = Math.ceil(wordCount / WORDS_PER_MINUTE);
  return minutes < 1 ? 1 : minutes;
}

function addReadingTimeToPost(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  
  // Skip if already has reading time
  if (html.includes('reading-time')) {
    return { status: 'skip', reason: 'already has' };
  }
  
  // Find content for word count - try both structures
  let contentMatch = html.match(/<div class="post-body">([\s\S]*?)<\/div>\s*(?:<footer|<div class="post-footer|<\/article)/);
  if (!contentMatch) {
    contentMatch = html.match(/<div class="content">([\s\S]*?)<\/div>\s*<footer/);
  }
  
  if (!contentMatch) {
    return { status: 'skip', reason: 'no content found' };
  }
  
  const readingTime = getReadingTime(contentMatch[1]);
  let updated = html;
  
  // Try new structure first (span.author)
  if (html.includes('class="author"')) {
    updated = html.replace(
      /(<span class="author">[^<]+<\/span>)/,
      `$1\n      <span class="reading-time">${readingTime} min read</span>`
    );
  }
  // Try old structure (post-meta with time)
  else if (html.includes('class="post-meta"')) {
    updated = html.replace(
      /(<time datetime="[^"]*">[^<]+<\/time>)/,
      `$1\n        <span class="reading-time">${readingTime} min read</span>`
    );
  }
  
  if (updated === html) {
    return { status: 'skip', reason: 'no insert point' };
  }
  
  fs.writeFileSync(filePath, updated);
  return { status: 'updated', minutes: readingTime };
}

// Process all posts
const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.html'));
let updated = 0;
let skipped = 0;

for (const file of files) {
  const result = addReadingTimeToPost(path.join(postsDir, file));
  if (result.status === 'updated') {
    console.log(`✓ ${file}: ${result.minutes} min read`);
    updated++;
  } else {
    skipped++;
  }
}

console.log(`\nUpdated: ${updated} | Skipped: ${skipped} | Total: ${files.length}`);
