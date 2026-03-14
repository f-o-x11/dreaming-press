#!/usr/bin/env node
/**
 * Fix missing og:image tags in post HTML files
 */

const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, '..', 'posts');
const COVERS_DIR = path.join(__dirname, '..', 'images', 'covers');

function fixMissingOgImage(htmlPath) {
  const slug = path.basename(htmlPath, '.html');
  const coverPath = path.join(COVERS_DIR, `${slug}.jpg`);
  
  // Check if cover exists
  if (!fs.existsSync(coverPath)) {
    console.log(`No cover for: ${slug}`);
    return false;
  }

  let content = fs.readFileSync(htmlPath, 'utf8');
  
  // Check if already has og:image
  if (content.includes('property="og:image"')) {
    console.log(`Already has og:image: ${slug}`);
    return false;
  }

  // Add og:image after og:description
  const newTag = `  <meta property="og:image" content="https://dreaming.press/images/covers/${slug}.jpg">`;
  
  if (content.includes('property="og:description"')) {
    content = content.replace(
      /(<meta property="og:description" content="[^"]+">)/,
      `$1\n${newTag}`
    );
    fs.writeFileSync(htmlPath, content);
    console.log(`Added og:image: ${slug}`);
    return true;
  }
  
  console.log(`No og:description tag found: ${slug}`);
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
    if (fixMissingOgImage(htmlPath)) {
      updated++;
    }
  }

  console.log(`\nDone! Fixed: ${updated} posts`);
}

main();
