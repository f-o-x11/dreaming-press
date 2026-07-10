// ai-narrate.js — automatic neural narration for new posts via OpenAI TTS
// (gpt-4o-mini-tts). Fixes the structural gap where Kokoro only ran on the
// owner's laptop, so newsroom posts shipped with the robotic browser fallback.
// Mirrors ai-covers.js: committed manifest = cross-machine done-set; on the
// server output goes to the untracked audio-ai/ overlay (git-reset-proof);
// INERT without OPENAI_API_KEY. A few posts per run, newest first.
//   OPENAI_API_KEY=... node scripts/ai-narrate.js [--limit N] [--slug <slug>] [--dry]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, allPosts } from "../lib/db.js";
import { authorOf } from "../lib/data.js";

const KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.DP_TTS_MODEL || "gpt-4o-mini-tts";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO = path.resolve(__dirname, "..", "..", "audio");
const AI_DIR = path.resolve(__dirname, "..", "..", "audio-ai");
const DRY = process.argv.includes("--dry");
const argN = process.argv.indexOf("--limit");
const LIMIT = argN > -1 ? parseInt(process.argv[argN + 1]) || 2 : 2;
const argS = process.argv.indexOf("--slug");
const ONLY = argS > -1 ? process.argv[argS + 1] : null;
const RECENT_DAYS = 3;

// same tracked/overlay split as ai-covers: laptops commit into audio/, the
// server (whose tree hard-resets each deploy) writes the durable overlay.
const OUT_DIR = process.env.DP_AI_MEDIA_TRACKED === "1" ? AUDIO : (fs.mkdirSync(AI_DIR, { recursive: true }), AI_DIR);
const MANIFEST = path.join(AUDIO, "ai-narrations.json");
const manifest = (() => { try { return new Set(JSON.parse(fs.readFileSync(MANIFEST, "utf8"))); } catch { return new Set(); } })();
const d = db();
const done = (slug) => manifest.has(slug) ||
  fs.existsSync(path.join(AUDIO, `${slug}.mp3`)) || fs.existsSync(path.join(AI_DIR, `${slug}.mp3`)) ||
  d.prepare("SELECT 1 FROM dispatched WHERE slug = ?").get(`ainarrate:${slug}`);
const mark = (slug) => {
  d.prepare("INSERT INTO dispatched (slug, sent_at) VALUES (?, ?) ON CONFLICT(slug) DO NOTHING")
    .run(`ainarrate:${slug}`, new Date().toISOString());
  manifest.add(slug);
  try { fs.writeFileSync(MANIFEST, JSON.stringify([...manifest].sort(), null, 1)); } catch { /* read-only ok */ }
};

// distinct modern voices per byline (the desk keeps its cast)
const VOICE = { rosalinda: "nova", abe: "onyx", "wire-desk": "echo", indexer: "alloy",
  vesper: "shimmer", margaux: "sage", soren: "echo", dex: "verse", priya: "coral" };
const SAFE_VOICES = new Set(["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"]);
const voiceFor = (author) => SAFE_VOICES.has(VOICE[author]) ? VOICE[author] : "nova";

function narrationText(p) {
  const a = authorOf(p.author);
  const body = String(p.body_text || "").replace(/\s+/g, " ").trim();
  return `${p.title}. From dreaming press. Written by ${a.name}. ${p.dek || ""} ${body}`.slice(0, 24000);
}
// OpenAI TTS caps input at 4096 chars — split on sentence boundaries and
// byte-concat the returned MP3 frames (players handle concatenated frames).
function chunks(text, max = 3500) {
  const sents = text.split(/(?<=[.!?])\s+/);
  const out = []; let cur = "";
  for (const s of sents) {
    if ((cur + " " + s).length > max && cur) { out.push(cur.trim()); cur = s; }
    else cur += (cur ? " " : "") + s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

async function synth(text, voice) {
  const parts = chunks(text);
  const bufs = [];
  for (const part of parts) {
    const r = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, voice, input: part, response_format: "mp3",
        instructions: "Warm, engaged narrator for a tech publication. Conversational but crisp; natural emphasis; read numbers and abbreviations naturally." }),
    });
    if (!r.ok) throw new Error(`TTS ${r.status}: ${(await r.text()).slice(0, 100)}`);
    bufs.push(Buffer.from(await r.arrayBuffer()));
  }
  return Buffer.concat(bufs);
}

const cutoff = new Date(Date.now() - RECENT_DAYS * 86400000).toISOString().slice(0, 10);
let pool = allPosts().filter(p => (p.date || "") >= cutoff && !done(p.slug));
if (ONLY) pool = allPosts().filter(p => p.slug === ONLY);
const targets = pool.slice(0, LIMIT);

if (!targets.length) { console.log("[ai-narrate] nothing new to narrate."); process.exit(0); }
if (!KEY) { console.log(`[ai-narrate] ${targets.length} candidates, but OPENAI_API_KEY unset — browser TTS stays.`); process.exit(0); }

let ok = 0;
for (const p of targets) {
  if (DRY) { console.log(`[dry] ${p.slug} (${voiceFor(p.author)}, ~${narrationText(p).length} chars)`); continue; }
  try {
    const buf = await synth(narrationText(p), voiceFor(p.author));
    fs.writeFileSync(path.join(OUT_DIR, `${p.slug}.mp3`), buf);
    mark(p.slug); ok++;
    console.log(`✓ ${p.slug} — narrated (${voiceFor(p.author)}, ${(buf.length / 1024 / 1024).toFixed(1)}MB)`);
  } catch (e) { console.error(`✗ ${p.slug}: ${e.message}`); }
}
console.log(`[ai-narrate] ${ok}/${targets.length} narrations generated.`);
