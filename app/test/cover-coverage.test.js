// cover-coverage.test.js — guards that every ESTABLISHED post ships its committed
// .png cover. Closes a real failure: a post's hero, og:image, Twitter card, and
// media-session artwork all point at `/images/<slug>.png` (lib/render.js
// `coverUrl`), so a post committed without its cover breaks every preview surface.
//
// ARCHITECTURE NOTE (why this is grace-windowed): covers are now generated on the
// SERVER (scripts/ai-covers.js) and committed back on the next deploy — the cloud
// newsroom writes the .md first, the .png lands minutes later. So a brand-new post
// is legitimately cover-less at test time. A hard requirement here would (and did,
// 2026-07-16→18) block EVERY newsroom push, since its quality gate is `npm test`
// green. The server also serves a branded placeholder for a cover-less post
// (server.js /images/:file), so nothing 404s in that window. We therefore require
// the .png only for posts older than GRACE_DAYS, which still catches the real bug
// (an established post whose cover generation permanently failed).
//
// WebP/AVIF are a best-effort optimization (optimize-covers.js, sharp = a
// devDependency the server can't run under `npm install --omit=dev`). The image
// route negotiates them only when present and falls back to the .png otherwise, so
// a missing .webp/.avif is never a broken image — it's just a larger one. Not gated.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", ".."); // app/test → app → repo root
const POSTS = path.join(REPO, "content", "posts");
const IMAGES = path.join(REPO, "images");
const GRACE_DAYS = 4; // server has many ~10-min deploy cycles to generate the cover

function postDate(file) {
  try {
    const head = fs.readFileSync(path.join(POSTS, file), "utf8").slice(0, 800);
    const m = /^date:\s*["']?(\d{4}-\d{2}-\d{2})/m.exec(head);
    return m ? m[1] : null;
  } catch { return null; }
}

test("every established post has its committed .png cover (hero + og:image base)", () => {
  const posts = fs.readdirSync(POSTS).filter((f) => f.endsWith(".md"));
  assert.ok(posts.length > 0, "expected at least one post");
  const have = new Set(fs.readdirSync(IMAGES));
  const cutoffMs = Date.now() - GRACE_DAYS * 86400000;

  const missing = [];
  for (const f of posts) {
    const slug = f.replace(/\.md$/, "");
    if (have.has(slug + ".png")) continue;
    // exempt brand-new posts — their cover is generated server-side post-push.
    const d = postDate(f);
    const ts = d ? Date.parse(d + "T12:00:00Z") : 0;
    if (ts && ts >= cutoffMs) continue;
    missing.push(slug + ".png");
  }

  assert.deepEqual(
    missing,
    [],
    `${missing.length} established post(s) missing their .png cover (older than ${GRACE_DAYS}d, ` +
      `so the server should have generated it). The og:image/hero/Twitter card fall back to a ` +
      `placeholder but never get the real art. Run on a machine with sharp: cd app && ` +
      `node scripts/ai-covers.js --force --slug <slug> (or gen-art.js). Missing:\n  ` +
      missing.join("\n  ")
  );
});

// Informational: report WebP/AVIF optimization coverage without failing the build
// (the server can't produce them; the image route falls back to .png cleanly).
test("WebP/AVIF optimization coverage (informational, non-blocking)", () => {
  const posts = fs.readdirSync(POSTS).filter((f) => f.endsWith(".md"));
  const have = new Set(fs.readdirSync(IMAGES));
  let missingWebp = 0, missingAvif = 0;
  for (const f of posts) {
    const slug = f.replace(/\.md$/, "");
    if (!have.has(slug + ".webp")) missingWebp++;
    if (!have.has(slug + ".avif")) missingAvif++;
  }
  if (missingWebp || missingAvif) {
    console.log(`  [cover-opt] ${missingWebp} posts without .webp, ${missingAvif} without .avif ` +
      `(served as .png — run scripts/optimize-covers.js on a machine with sharp to shrink them).`);
  }
  assert.ok(true);
});
