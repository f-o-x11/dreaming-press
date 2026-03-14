#!/usr/bin/env node
/**
 * Generate SEO-optimized sitemap.xml for dreaming.press
 * Includes all posts, category pages, and static pages
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://dreaming.press';
const POSTS_DIR = path.join(__dirname, '../posts');

// Priority weights
const PRIORITIES = {
  homepage: '1.0',
  category: '0.8',
  post: '0.7',
  static: '0.6'
};

// Static pages
const staticPages = [
  { url: '/', priority: PRIORITIES.homepage },
  { url: '/about.html', priority: PRIORITIES.static },
  { url: '/submit.html', priority: PRIORITIES.static }
];

// Category pages
const categories = [
  { slug: 'writing', priority: PRIORITIES.category },
  { slug: 'coding', priority: PRIORITIES.category },
  { slug: 'design', priority: PRIORITIES.category },
  { slug: 'marketing', priority: PRIORITIES.category },
  { slug: 'productivity', priority: PRIORITIES.category },
  { slug: 'business', priority: PRIORITIES.category }
];

function getPostFiles() {
  try {
    return fs.readdirSync(POSTS_DIR)
      .filter(f => f.endsWith('.html'))
      .map(f => ({
        slug: f.replace('.html', ''),
        file: f,
        mtime: fs.statSync(path.join(POSTS_DIR, f)).mtime
      }));
  } catch (e) {
    console.error('Error reading posts:', e);
    return [];
  }
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function generateSitemap() {
  const today = formatDate(new Date());
  let urls = [];

  // Static pages
  staticPages.forEach(page => {
    urls.push({
      loc: `${BASE_URL}${page.url}`,
      lastmod: today,
      priority: page.priority,
      changefreq: page.url === '/' ? 'daily' : 'weekly'
    });
  });

  // Category pages
  categories.forEach(cat => {
    urls.push({
      loc: `${BASE_URL}/category/${cat.slug}.html`,
      lastmod: today,
      priority: cat.priority,
      changefreq: 'weekly'
    });
  });

  // Posts
  const posts = getPostFiles();
  posts.forEach(post => {
    // Extract date from slug if it follows YYYY-MM-DD pattern
    const dateMatch = post.slug.match(/^(\d{4}-\d{2}-\d{2})/);
    const lastmod = dateMatch ? dateMatch[1] : formatDate(post.mtime);

    urls.push({
      loc: `${BASE_URL}/posts/${post.slug}.html`,
      lastmod: lastmod,
      priority: PRIORITIES.post,
      changefreq: 'monthly'
    });
  });

  // Generate XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  fs.writeFileSync(path.join(__dirname, '../sitemap.xml'), xml);
  console.log(`Generated sitemap.xml with ${urls.length} URLs`);
  console.log(`  - ${staticPages.length} static pages`);
  console.log(`  - ${categories.length} category pages`);
  console.log(`  - ${posts.length} posts`);
}

generateSitemap();
