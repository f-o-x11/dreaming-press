// cover-coverage.test.js — guards that EVERY published post ships its committed
// cover image. This closes a recurring real failure: a post can be written and
// committed while its generated cover never gets added, so the live site serves a
// post whose hero image, og:image, Twitter card, AND media-session artwork all
// 404 — every one of those surfaces points at `/images/<slug>.png` (see
// lib/render.js `coverUrl`). It happened in production to `openai-apps-sdk-vs-mcp`
// and `what-are-deep-agents` (markdown shipped, covers didn't), which is why this
// guard exists. art.test.js already proves the cover GENERATOR works; this proves
// the generated artifact actually made it into the repo for each post.
//
// The deploy serves Accept-negotiated WebP/AVIF (#9), so all three formats are
// required: a missing .png is a broken image, a missing .webp/.avif means the
// optimize step was skipped and the negotiated path falls back or breaks. The
// routine runs gen-art.js + optimize-covers.js before `npm test`, so a green tree
// always has the full set; a red one tells you exactly which step to re-run.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", ".."); // app/test → app → repo root
const POSTS = path.join(REPO, "content", "posts");
const IMAGES = path.join(REPO, "images");

// The cover filename is the post filename with `.md` swapped for the format ext —
// a flat 1:1 mapping on the full (date-prefixed) slug, mirroring coverUrl(slug).
const FORMATS = [".png", ".webp", ".avif"];

test("every published post has a committed cover in all served formats", () => {
  const posts = fs.readdirSync(POSTS).filter((f) => f.endsWith(".md"));
  assert.ok(posts.length > 0, "expected at least one post");
  const have = new Set(fs.readdirSync(IMAGES));

  const missing = [];
  for (const f of posts) {
    const slug = f.replace(/\.md$/, "");
    for (const ext of FORMATS) {
      if (!have.has(slug + ext)) missing.push(slug + ext);
    }
  }

  assert.deepEqual(
    missing,
    [],
    `${missing.length} cover file(s) missing — a post shipped without its cover, so its ` +
      `hero/og:image/Twitter card would 404. Run: cd app && node scripts/gen-art.js && ` +
      `node scripts/optimize-covers.js, then commit the new images/. Missing:\n  ` +
      missing.join("\n  ")
  );
});

test("the .png cover (hero + og:image base) exists for every post", () => {
  // Stricter, isolated assertion on the one format every social/preview surface
  // hard-codes — kept separate so a WebP/AVIF gap and a true broken-image bug
  // report as distinct failures.
  const posts = fs.readdirSync(POSTS).filter((f) => f.endsWith(".md"));
  const have = new Set(fs.readdirSync(IMAGES));
  const missingPng = posts
    .map((f) => f.replace(/\.md$/, ".png"))
    .filter((png) => !have.has(png));
  assert.deepEqual(missingPng, [], `posts missing their og:image .png cover: ${missingPng.join(", ")}`);
});
