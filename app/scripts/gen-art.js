// gen-art.js — render a sophisticated PNG cover for every post + section OG,
// then transcode the new PNGs to the WebP + AVIF the server actually serves.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { makeCover, makeAvatar } from "../lib/art.js";
import { allPosts, DB_PATH } from "../lib/db.js";
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

// gen-art reads posts from the SQLite DB, which `ingest.js` builds. On a fresh
// clone (or when gen-art is run standalone) the DB may not exist yet — opening it
// then throws an opaque better-sqlite3 "directory does not exist". Self-bootstrap
// by running ingest first (mirrors newsroom.js's `ingest && gen-art` chain) so an
// ad-hoc `node scripts/gen-art.js` just works instead of half-failing a run.
if (!fs.existsSync(DB_PATH)) {
  console.log(`  no DB at ${DB_PATH} — running ingest.js first…`);
  execFileSync(process.execPath, [path.join(__dirname, "ingest.js")], { stdio: "inherit" });
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

// A cover the server can serve isn't just a PNG: server.js negotiates WebP/AVIF
// (council #9) and the cover-format test fails any post missing a derivative. So
// finish the job here — transcode any PNG that's still missing a derivative —
// rather than leaving it to a second command the routine's documented flow
// (gen-art → ingest → test) skips, which is exactly how a run ships art that then
// reds the build. Run unconditionally (not just when new PNGs were made): it
// cheaply skips covers that already have both formats, so it also self-heals a
// half-generated state. Best-effort: sharp is a devDependency, so a transcode
// failure warns instead of aborting the art step (the cover-format test backstops).
try {
  const optimize = path.join(__dirname, "optimize-covers.js");
  execFileSync(process.execPath, [optimize, ...(force ? ["--force"] : [])], { stdio: "inherit" });
} catch (e) {
  console.warn(`  (WebP/AVIF transcode skipped: ${e.message} — run "node scripts/optimize-covers.js" before committing)`);
}
