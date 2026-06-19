// gen-art.js — render a sophisticated PNG cover for every post + section OG.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeCover, makeAvatar } from "../lib/art.js";
import { allPosts } from "../lib/db.js";
import { SECTIONS, SECTION_ORDER, AUTHORS } from "../lib/data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMG = path.resolve(__dirname, "..", "..", "images");
const POSTS = path.resolve(__dirname, "..", "..", "content", "posts");
const force = process.argv.includes("--force");
fs.mkdirSync(IMG, { recursive: true });

// Optional LLM art-director block in a post's frontmatter, e.g.:
//   art:
//     archetype: division
//     mood: ominous
//     hue: 220
//     motif: a chip emitting a tracking beacon across a border
// Returns an object (or null) merged into the post before makeCover().
function readArtSpec(slug) {
  const f = path.join(POSTS, `${slug}.md`);
  if (!fs.existsSync(f)) return null;
  const src = fs.readFileSync(f, "utf8");
  const fm = /^---\n([\s\S]*?)\n---/.exec(src);
  if (!fm) return null;
  const lines = fm[1].split("\n");
  const i = lines.findIndex(l => /^art:\s*(\{.*\})?\s*$/.test(l));
  if (i < 0) return null;
  // inline JSON form: art: { ... }
  const inline = /^art:\s*(\{.*\})\s*$/.exec(lines[i]);
  if (inline) { try { return JSON.parse(inline[1]); } catch { return null; } }
  // indented block form
  const out = {};
  for (let k = i + 1; k < lines.length; k++) {
    const m = /^[ \t]+([a-z_]+):\s*(.+?)\s*$/i.exec(lines[k]);
    if (!m) break;
    let v = m[2].replace(/^["']|["']$/g, "");
    if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
    out[m[1]] = v;
  }
  return Object.keys(out).length ? out : null;
}

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
  const art = readArtSpec(p.slug);
  fs.writeFileSync(out, makeCover(art ? { ...p, art } : p));
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
