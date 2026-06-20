// indexnow.js — instantly notify IndexNow-participating search engines (Bing,
// Yandex, Seznam, Naver) about the site's URLs (#1, the half that needs no
// account — Google ignores IndexNow but the GSC verification meta is in place
// for when the owner adds a token). Runs on the server during deploy.
//   node scripts/indexnow.js [--all]
import { db, allPosts } from "../lib/db.js";
import { sitemapXml } from "../lib/pages.js";
import { SITE } from "../lib/data.js";

export const INDEXNOW_KEY = process.env.DP_INDEXNOW_KEY || "96a260fd1aec2ff08f6f11a91f19111c";

const host = SITE.replace(/^https?:\/\//, "");

// recent posts (last 3 days) by default — avoids re-submitting the whole site on
// every deploy; --all submits everything (use sparingly, e.g. first run).
export async function submit({ all = false } = {}) {
  db();
  const sitemap = sitemapXml(allPosts());
  const allUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const cutoff = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  const recentSlugs = new Set(allPosts().filter(p => (p.date || "") >= cutoff).map(p => `${SITE}/posts/${p.slug}.html`));
  const urlList = all ? allUrls : allUrls.filter(u => recentSlugs.has(u) || !u.includes("/posts/"));
  if (!urlList.length) { console.log("[indexnow] nothing to submit."); return; }
  try {
    const r = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`, urlList: urlList.slice(0, 10000) }),
    });
    console.log(`[indexnow] submitted ${urlList.length} URLs → HTTP ${r.status}`);
  } catch (e) { console.error("[indexnow] failed:", e.message); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await submit({ all: process.argv.includes("--all") });
}
