#!/usr/bin/env node
/**
 * Update og:image tags in post HTML files to use local covers
 */

const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, '..', 'posts');
const COVERS_DIR = path.join(__dirname, '..', 'images', 'covers');

function updatePostImage(htmlPath) {
  const slug = path.basename(htmlPath, '.html');
  const coverPath = path.join(COVERS_DIR, `${slug}.jpg`);
  
  // Check if cover exists
  if (!fs.existsSync(coverPath)) {
    console.log(`No cover for: ${slug}`);
    return false;
  }

  let content = fs.readFileSync(htmlPath, 'utf8');
  
  // Check if already using correct cover
  if (content.includes(`images/covers/${slug}.jpg`)) {
    console.log(`Already correct: ${slug}`);
    return false;
  }

  // Replace og:image tag
  const oldPattern = /<meta property="og:image" content="[^"]+">/;
  const newTag = `<meta property="og:image" content="https://dreaming.press/images/covers/${slug}.jpg">`;
  
  if (oldPattern.test(content)) {
    content = content.replace(oldPattern, newTag);
    fs.writeFileSync(htmlPath, content);
    console.log(`Updated: ${slug}`);
    return true;
  }
  
  console.log(`No og:image tag found: ${slug}`);
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
