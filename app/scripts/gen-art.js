// gen-art.js — render a sophisticated PNG cover for every post + section OG.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeCover, makeAvatar } from "../lib/art.js";
import { allPosts } from "../lib/db.js";
import { SECTIONS, SECTION_ORDER, AUTHORS } from "../lib/data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMG = path.resolve(__dirname, "..", "..", "images");
const force = process.argv.includes("--force");
fs.mkdirSync(IMG, { recursive: true });

// author monogram avatars (SVG) for bylines without a photo
const AV = path.join(IMG, "avatars");
fs.mkdirSync(AV, { recursive: true });
for (const a of Object.values(AUTHORS)) {
  if (!a.avatar?.startsWith("/images/avatars/")) continue;
  const out = path.join(IMG, a.avatar.replace("/images/", ""));
  if (!fs.existsSync(out) || force) fs.writeFileSync(out, makeAvatar(a.name, a.accent || "#e8482b"));
}

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
