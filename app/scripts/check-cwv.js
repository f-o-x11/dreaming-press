// check-cwv.js — a Core Web Vitals / page-weight budget gate for CI (#27).
// Static checks (no browser): every article's hero cover must carry the LCP
// hints (fetchpriority + intrinsic dimensions), HTML stays lean, and cover byte
// weight is budgeted. Cover weight is a WARNING until AVIF/WebP (#9) lands, then
// flip COVER_FAIL=true to make it a hard gate.
//   node scripts/check-cwv.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as DB from "../lib/db.js";
import { renderArticle } from "../lib/render.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMG = path.resolve(__dirname, "..", "..", "images");
const HTML_BUDGET = 90_000;     // bytes of SSR HTML per article
const COVER_BUDGET_KB = 250;    // LCP image transfer budget
const COVER_FAIL = false;       // set true once #9 (AVIF/WebP) ships

let fail = 0, warn = 0, n = 0;
for (const p of DB.allPosts().slice(0, 30)) {
  n++;
  const html = renderArticle(p, DB.relatedTo(p.slug, 3), 0, {}, []);
  if (html.length > HTML_BUDGET) { fail++; console.error(`✗ ${p.slug}: HTML ${(html.length / 1024 | 0)}KB > ${HTML_BUDGET / 1024}KB`); }
  // window must clear a long alt=title; the <img> tag itself is what we check
  const coverImg = (/<figure class="article-cover">\s*<img[^>]*>/.exec(html) || [""])[0];
  if (!/fetchpriority="high"/.test(coverImg)) { fail++; console.error(`✗ ${p.slug}: hero cover missing fetchpriority`); }
  if (!/width="\d+"/.test(coverImg) || !/height="\d+"/.test(coverImg)) { fail++; console.error(`✗ ${p.slug}: hero cover missing width/height (CLS)`); }
  const cover = path.join(IMG, `${p.slug}.webp`);
  const png = path.join(IMG, `${p.slug}.png`);
  const f = fs.existsSync(cover) ? cover : (fs.existsSync(png) ? png : null);
  if (f) {
    const kb = fs.statSync(f).size / 1024;
    if (kb > COVER_BUDGET_KB) { if (COVER_FAIL) { fail++; console.error(`✗ ${p.slug}: cover ${kb | 0}KB > ${COVER_BUDGET_KB}KB`); } else { warn++; } }
  }
}
console.log(`CWV budget: ${n} articles checked, ${fail} failures, ${warn} cover-weight warnings (AVIF/WebP #9 pending).`);
process.exit(fail > 0 ? 1 : 0);
