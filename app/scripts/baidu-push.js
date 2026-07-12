// baidu-push.js — push new/changed URLs to Baidu's index (GEO move #18). Baidu +
// Tencent Yuanbao + Doubao are already top referrers here, and IndexNow does NOT
// reach Baidu — this is the only fast path in. Mirrors indexnow.js: content-
// signature dedupe so unchanged URLs aren't re-pushed every deploy. INERT without
// DP_BAIDU_TOKEN (obtained by registering the site in Baidu Ziyuan / 站长平台) — it
// no-ops cleanly until the owner adds the token, so it's safe to wire into deploy.
//   DP_BAIDU_TOKEN=... node scripts/baidu-push.js [--all]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, allPosts } from "../lib/db.js";
import { sitemapXml } from "../lib/pages.js";
import { SITE } from "../lib/data.js";

const TOKEN = process.env.DP_BAIDU_TOKEN || "";
const host = SITE.replace(/^https?:\/\//, "");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE = path.join(__dirname, "..", "data", "baidu-push-state.json");

export async function push({ all = false } = {}) {
  if (!TOKEN) { console.log("[baidu-push] DP_BAIDU_TOKEN unset — skipping (register at ziyuan.baidu.com)."); return; }
  db();
  const allUrls = [...sitemapXml(allPosts()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const sigByUrl = new Map();
  for (const p of allPosts()) sigByUrl.set(`${SITE}/posts/${p.slug}.html`, `${p.date || ""}|${p.updated || p.date || ""}`);
  const weekBucket = `w${Math.floor(Date.now() / (7 * 86400000))}`;
  const sigFor = (u) => sigByUrl.get(u) || weekBucket;
  const prev = (() => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return {}; } })();
  const urlList = all ? allUrls : allUrls.filter(u => prev[u] !== sigFor(u));
  if (!urlList.length) { console.log("[baidu-push] nothing changed to push."); return; }
  const next = { ...prev }; for (const u of allUrls) next[u] = sigFor(u);
  try { fs.mkdirSync(path.dirname(STATE), { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(next)); } catch { /* read-only ok */ }
  try {
    const r = await fetch(`http://data.zz.baidu.com/urls?site=${host}&token=${TOKEN}`, {
      method: "POST", headers: { "Content-Type": "text/plain" }, body: urlList.slice(0, 2000).join("\n"),
    });
    const body = await r.text().catch(() => "");
    console.log(`[baidu-push] pushed ${urlList.length} URLs → HTTP ${r.status} ${body.slice(0, 120)}`);
  } catch (e) { console.error("[baidu-push] failed:", e.message); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await push({ all: process.argv.includes("--all") });
}
