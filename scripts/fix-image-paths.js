#!/usr/bin/env node
/**
 * Update og:image tags to use /images/ instead of /images/covers/
 */

const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, '..', 'posts');

function updatePostImage(htmlPath) {
  let content = fs.readFileSync(htmlPath, 'utf8');
  
  // Replace /images/covers/ with /images/
  if (content.includes('/images/covers/')) {
    content = content.replace(/\/images\/covers\//g, '/images/');
    fs.writeFileSync(htmlPath, content);
    const slug = path.basename(htmlPath, '.html');
    console.log(`Updated: ${slug}`);
    return true;
  }
  
  return false;
}

// Main
function main() {
  const htmlFiles = fs.readdirSync(POSTS_DIR)
    .filter(f => f.endsWith('.html'))
    .sort();

  let updated = 0;

  for (const file of htmlFiles) {
    const htmlPath = path.join(POSTS_DIR, file);
    if (updatePostImage(htmlPath)) {
      updated++;
    }
  }

  console.log(`\nDone! Updated: ${updated} posts`);
}

main();
