// gen-art.js — render a sophisticated PNG cover for every post + section OG.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeCover } from "../lib/art.js";
import { allPosts } from "../lib/db.js";
import { SECTIONS, SECTION_ORDER } from "../lib/data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMG = path.resolve(__dirname, "..", "..", "images");
const force = process.argv.includes("--force");
fs.mkdirSync(IMG, { recursive: true });

let made = 0;
const posts = allPosts();
for (const p of posts) {
  const out = path.join(IMG, `${p.slug}.png`);
  if (fs.existsSync(out) && !force) continue;
  fs.writeFileSync(out, makeCover(p.slug, p.title, p.section));
  made++;
  if (made % 10 === 0) console.log(`  …${made}`);
}
for (const sk of SECTION_ORDER) {
  const out = path.join(IMG, `og-${sk}.png`);
  if (fs.existsSync(out) && !force) continue;
  fs.writeFileSync(out, makeCover(`section-${sk}`, SECTIONS[sk].name, sk));
  made++;
}
console.log(`Generated ${made} covers.`);
