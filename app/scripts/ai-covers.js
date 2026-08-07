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
const MODEL = process.env.DP_IMAGE_MODEL || "gpt-image-1";
// keyless open-source fallback: Pollinations serves FLUX (open-weights) free,
// no account — so illustrative covers work even with no OpenAI key at all.
const FALLBACK = (process.env.DP_IMAGE_FALLBACK || "pollinations") === "pollinations";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMG = path.resolve(__dirname, "..", "..", "images");
const DRY = process.argv.includes("--dry");
const argN = process.argv.indexOf("--limit");
const LIMIT = argN > -1 ? parseInt(process.argv[argN + 1]) || 3 : 3;
const argS = process.argv.indexOf("--slug");
const ONLY = argS > -1 ? process.argv[argS + 1] : null;
// --force re-illustrates even already-done posts (use to replace old covers that
// rendered garbled fake text before the prompt was hardened).
const FORCE = process.argv.includes("--force");
const RECENT_DAYS = 3;

const d = db();
// Source of truth for "already illustrated" is a COMMITTED manifest, so every
// machine (laptop, server, sandbox) sees the same done-set and nothing is ever
// re-billed. Each machine's DB marker is a secondary local record. On the
// server, generated files go to the untracked images-ai/ dir (git reset-proof)
// and the serving layer prefers it.
const MANIFEST = path.join(IMG, "ai-covers.json");
const AI_DIR = path.resolve(__dirname, "..", "..", "images-ai");
const manifest = (() => { try { return new Set(JSON.parse(fs.readFileSync(MANIFEST, "utf8"))); } catch { return new Set(); } })();
const done = (slug) => !FORCE && (manifest.has(slug) ||
  d.prepare("SELECT 1 FROM dispatched WHERE slug = ?").get(`aicover:${slug}`));
const mark = (slug) => {
  d.prepare("INSERT INTO dispatched (slug, sent_at) VALUES (?, ?) ON CONFLICT(slug) DO NOTHING")
    .run(`aicover:${slug}`, new Date().toISOString());
  manifest.add(slug);
  try { fs.writeFileSync(MANIFEST, JSON.stringify([...manifest].sort(), null, 1)); } catch { /* read-only ok */ }
};
// In a git checkout that hard-resets on deploy (the server), tracked images/
// would be wiped — write there only when the tree is safe (env opt-in), else
// to the durable untracked images-ai/ overlay.
const OUT_DIR = process.env.DP_AI_COVERS_TRACKED === "1" ? IMG : (fs.mkdirSync(AI_DIR, { recursive: true }), AI_DIR);

// AI image models render GARBLED fake text whenever the idea mentions words,
// wordmarks, labels, or signage (e.g. a motif of "a product wordmark" produced a
// giant nonsense "VEETIE BONKNI" cover). Neutralize those cues so covers stay
// clean and abstract, and end with a forceful no-text instruction.
function sanitizeMotif(m) {
  if (!m) return m;
  return m
    .replace(/\b(word\s?marks?|logotypes?|logos?|nameplates?|monograms?|headlines?|captions?|title cards?|banners?|billboards?|signs?|signage|labels?|tags?|lettering|letterforms?|letters?|typography|typefaces?|fonts?|text|words?|numbers?|digits?)\b/gi, "abstract solid block")
    .replace(/\b(reads?|says?|spelled?|spelling|written|typed|inscribed|printed)\b/gi, "shows");
}
function promptFor(p) {
  let art = {};
  try { art = typeof p.art === "string" ? JSON.parse(p.art) : (p.art || {}); } catch { /* none */ }
  // Do NOT pass the literal article title — image models (esp. the flux fallback)
  // try to render it as a heading and produce garbled fake text. Describe only the
  // visual concept, drawn from the (sanitized) motif or dek.
  const motif = sanitizeMotif((art.motif || "").trim());
  const theme = sanitizeMotif((p.dek || "").trim()).slice(0, 160);
  return `Editorial illustration for a modern tech publication, conceptual and metaphorical ` +
    `(The Economist / The Verge cover style). ` +
    (motif ? `Central visual idea: ${motif}. ` : theme ? `Concept: ${theme}. ` : ``) +
    `Style: flat vector shapes with subtle grain, warm paper background (#f4f1ea), 2-3 accent colors, ` +
    `clean and uncluttered, generous negative space. ` +
    `CRITICAL: the image must contain absolutely NO text, letters, numbers, words, wordmarks, logos, ` +
    `captions, headings, or typography of any kind — depict any label, screen, book, or sign as a ` +
    `completely blank featureless surface with no characters on it.`;
}

const cutoff = new Date(Date.now() - RECENT_DAYS * 86400000).toISOString().slice(0, 10);
// Every section needs a cover, but the demand pieces get illustrated FIRST.
// This used to hard-filter to ["wire","stack"], which silently guaranteed that a
// Dispatch or Fabrication could never be illustrated at all: combined with the
// RECENT_DAYS window it aged them out of eligibility before anything ran, so those
// posts kept the "cover rendering" placeholder SVG permanently. That was invisible
// while both desks were dormant (2026-07-06 / 2026-06-20) and surfaced the moment
// they resumed. Order instead of exclude — the same shape ai-narrate.js already
// uses (its `priority()` ranks wire first without dropping any section). Array
// .sort is stable, so date-DESC order from allPosts() is preserved within each tier.
const coverPriority = (p) => (["wire", "stack"].includes(p.section) ? 0 : 1);
let pool = allPosts()
  .filter(p => (p.date || "") >= cutoff && !done(p.slug))
  .sort((a, b) => coverPriority(a) - coverPriority(b));
if (ONLY) pool = allPosts().filter(p => p.slug === ONLY);
const targets = pool.slice(0, LIMIT);

if (!targets.length) { console.log("[ai-covers] nothing new to illustrate."); process.exit(0); }
if (!KEY && !FALLBACK) { console.log(`[ai-covers] ${targets.length} candidates, no OPENAI_API_KEY and fallback disabled — generative art stays.`); process.exit(0); }

async function generate(prompt) {
  if (KEY) {
    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, prompt, size: "1536x1024", quality: "medium", n: 1 }),
    });
    if (r.ok) {
      const j = await r.json();
      const b64 = j.data?.[0]?.b64_json;
      if (b64) return { buf: Buffer.from(b64, "base64"), provider: MODEL };
    } else {
      console.error(`  openai ${r.status}: ${(await r.text()).slice(0, 100)} — trying fallback`);
    }
  }
  if (FALLBACK) {
    const u = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 800))}?width=1536&height=1024&model=flux&nologo=true&seed=${Math.floor(Math.random() * 1e6)}`;
    const r = await fetch(u, { signal: AbortSignal.timeout(90000) });
    if (r.ok) return { buf: Buffer.from(await r.arrayBuffer()), provider: "flux/pollinations" };
    console.error(`  pollinations ${r.status}`);
  }
  return null;
}

let ok = 0;
for (const p of targets) {
  const prompt = promptFor(p);
  if (DRY) { console.log(`[dry] ${p.slug}: ${prompt.slice(0, 120)}…`); continue; }
  try {
    const g = await generate(prompt);
    if (!g) { console.error(`✗ ${p.slug}: all providers failed`); continue; }
    const png = path.join(OUT_DIR, `${p.slug}.png`);
    fs.writeFileSync(png, g.buf);
    // regenerate the negotiated formats so AVIF/WebP match the new art
    try {
      const sharp = (await import("sharp")).default;
      await sharp(png).resize(1200, 800, { fit: "cover" }).png().toFile(png + ".tmp");
      fs.renameSync(png + ".tmp", png);
      await sharp(png).webp({ quality: 72 }).toFile(path.join(OUT_DIR, `${p.slug}.webp`));
      await sharp(png).avif({ quality: 50, effort: 3 }).toFile(path.join(OUT_DIR, `${p.slug}.avif`));
    } catch { /* sharp unavailable (prod runtime) — PNG alone still serves */ }
    mark(p.slug); ok++;
    console.log(`✓ ${p.slug} — illustrated (${g.provider})`);
  } catch (e) { console.error(`✗ ${p.slug}: ${e.message}`); }
}
console.log(`[ai-covers] ${ok}/${targets.length} covers generated.`);
