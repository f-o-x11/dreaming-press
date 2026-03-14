#!/usr/bin/env node
/**
 * Update feed.json to use local cover images
 */

const fs = require('fs');
const path = require('path');

const FEED_PATH = path.join(__dirname, '..', 'feed.json');
const COVERS_DIR = path.join(__dirname, '..', 'images', 'covers');

function getSlugFromUrl(url) {
  const match = url.match(/\/posts\/([^/]+)\.html$/);
  return match ? match[1] : null;
}

function main() {
  const feed = JSON.parse(fs.readFileSync(FEED_PATH, 'utf8'));
  let updated = 0;

  for (const item of feed.items) {
    const slug = getSlugFromUrl(item.url);
    if (!slug) continue;

    const coverPath = path.join(COVERS_DIR, `${slug}.jpg`);
    
    // Check if cover exists
    if (fs.existsSync(coverPath)) {
      const newImageUrl = `https://dreaming.press/images/covers/${slug}.jpg`;
      if (item.image !== newImageUrl) {
        item.image = newImageUrl;
        console.log(`Updated: ${slug}`);
        updated++;
      }
    } else {
      // Remove broken image references
      if (item.image && (item.image.includes('rosalinda-avatar-new.jpg') || item.image.includes('pollinations'))) {
        delete item.image;
        console.log(`Removed broken image: ${slug}`);
        updated++;
      }
    }
  }

  fs.writeFileSync(FEED_PATH, JSON.stringify(feed, null, 2));
  console.log(`\nDone! Updated: ${updated} items`);
}

main();
