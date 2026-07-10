// ai-covers.js — illustrative covers via OpenAI image generation (gpt-image-1).
// The generative-art system is deterministic but abstract; this produces images
// that actually DEPICT each article's idea, prompted from its title + dek + the
// art 'motif' the newsroom already writes. Runs on the server in the deploy
// (like sync-tools/send-dispatch): INERT without OPENAI_API_KEY. Only recent
// posts are processed (last RECENT_DAYS), a few per run, tracked in the
// dispatched table (slug `aicover:<slug>`) so nothing is ever re-billed.
//   OPENAI_API_KEY=... node scripts/ai-covers.js [--limit N] [--slug <slug>] [--dry]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, allPosts } from "../lib/db.js";

const KEY = process.env.OPENAI_API_KEY || "";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMG = path.resolve(__dirname, "..", "..", "images");
const DRY = process.argv.includes("--dry");
const argN = process.argv.indexOf("--limit");
const LIMIT = argN > -1 ? parseInt(process.argv[argN + 1]) || 3 : 3;
const argS = process.argv.indexOf("--slug");
const ONLY = argS > -1 ? process.argv[argS + 1] : null;
const RECENT_DAYS = 3;

const d = db();
const done = (slug) => d.prepare("SELECT 1 FROM dispatched WHERE slug = ?").get(`aicover:${slug}`);
const mark = (slug) => d.prepare("INSERT INTO dispatched (slug, sent_at) VALUES (?, ?) ON CONFLICT(slug) DO NOTHING")
  .run(`aicover:${slug}`, new Date().toISOString());

function promptFor(p) {
  let art = {};
  try { art = typeof p.art === "string" ? JSON.parse(p.art) : (p.art || {}); } catch { /* none */ }
  const motif = (art.motif || "").trim();
  return `Editorial illustration for a tech publication article titled "${p.title}". ` +
    (motif ? `Central visual idea: ${motif}. ` : `Theme: ${p.dek || p.title}. `) +
    `Style: modern editorial illustration, flat shapes with subtle grain, warm paper background (#f4f1ea), ` +
    `2-3 accent colors, conceptual and metaphorical (The Economist / Verge style), no text, no words, no letters, no logos.`;
}

const cutoff = new Date(Date.now() - RECENT_DAYS * 86400000).toISOString().slice(0, 10);
let pool = allPosts().filter(p => ["wire", "stack"].includes(p.section) && (p.date || "") >= cutoff && !done(p.slug));
if (ONLY) pool = allPosts().filter(p => p.slug === ONLY);
const targets = pool.slice(0, LIMIT);

if (!targets.length) { console.log("[ai-covers] nothing new to illustrate."); process.exit(0); }
if (!KEY) { console.log(`[ai-covers] ${targets.length} candidates, but OPENAI_API_KEY unset — generative art stays.`); process.exit(0); }

let ok = 0;
for (const p of targets) {
  const prompt = promptFor(p);
  if (DRY) { console.log(`[dry] ${p.slug}: ${prompt.slice(0, 120)}…`); continue; }
  try {
    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1536x1024", quality: "medium", n: 1 }),
    });
    if (!r.ok) { console.error(`✗ ${p.slug}: HTTP ${r.status} ${(await r.text()).slice(0, 120)}`); continue; }
    const j = await r.json();
    const b64 = j.data?.[0]?.b64_json;
    if (!b64) { console.error(`✗ ${p.slug}: no image in response`); continue; }
    const png = path.join(IMG, `${p.slug}.png`);
    fs.writeFileSync(png, Buffer.from(b64, "base64"));
    // regenerate the negotiated formats so AVIF/WebP match the new art
    try {
      const sharp = (await import("sharp")).default;
      await sharp(png).resize(1200, 800, { fit: "cover" }).png().toFile(png + ".tmp");
      fs.renameSync(png + ".tmp", png);
      await sharp(png).webp({ quality: 72 }).toFile(path.join(IMG, `${p.slug}.webp`));
      await sharp(png).avif({ quality: 50, effort: 3 }).toFile(path.join(IMG, `${p.slug}.avif`));
    } catch { /* sharp unavailable (prod runtime) — PNG alone still serves */ }
    mark(p.slug); ok++;
    console.log(`✓ ${p.slug} — illustrated`);
  } catch (e) { console.error(`✗ ${p.slug}: ${e.message}`); }
}
console.log(`[ai-covers] ${ok}/${targets.length} covers generated.`);
