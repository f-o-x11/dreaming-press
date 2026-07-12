// indexnow.js — instantly notify IndexNow-participating search engines (Bing,
// Yandex, Seznam, Naver) about the site's URLs (#1, the half that needs no
// account — Google ignores IndexNow but the GSC verification meta is in place
// for when the owner adds a token). Runs on the server during deploy.
//   node scripts/indexnow.js [--all]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, allPosts } from "../lib/db.js";
import { sitemapXml } from "../lib/pages.js";
import { SITE } from "../lib/data.js";

export const INDEXNOW_KEY = process.env.DP_INDEXNOW_KEY || "96a260fd1aec2ff08f6f11a91f19111c";

const host = SITE.replace(/^https?:\/\//, "");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE = path.join(__dirname, "..", "data", "indexnow-state.json");

// Submit only NEW or CHANGED URLs (content-signature dedupe) so a 40-post/day
// freshness engine pings Bing/Yandex/Naver/Seznam on every publish AND refresh —
// without re-submitting hundreds of unchanged URLs on every 10-minute deploy.
// A post's signature is its date+updated (so an `updated` bump re-submits it — the
// council's "ping on refresh"); evergreen non-post URLs (hubs, tools, /facts) carry
// a weekly bucket so they refresh ~once a week, not 144x/day. --all ignores dedupe.
export async function submit({ all = false } = {}) {
  db();
  const sitemap = sitemapXml(allPosts());
  const allUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const sigByUrl = new Map();
  for (const p of allPosts()) sigByUrl.set(`${SITE}/posts/${p.slug}.html`, `${p.date || ""}|${p.updated || p.date || ""}`);
  const weekBucket = `w${Math.floor(Date.now() / (7 * 86400000))}`;
  const sigFor = (u) => sigByUrl.get(u) || weekBucket;    // non-post URLs refresh weekly
  const prev = (() => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return {}; } })();
  const changed = all ? allUrls : allUrls.filter(u => prev[u] !== sigFor(u));
  const urlList = changed;
  if (!urlList.length) { console.log("[indexnow] nothing changed to submit."); return; }
  // persist the new signatures so unchanged URLs aren't re-pinged next run
  const next = { ...prev }; for (const u of allUrls) next[u] = sigFor(u);
  try { fs.mkdirSync(path.dirname(STATE), { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(next)); } catch { /* read-only ok */ }
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
