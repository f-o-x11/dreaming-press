// ai-narrate.js — automatic neural narration for new posts via OpenAI TTS
// (gpt-4o-mini-tts). Fixes the structural gap where Kokoro only ran on the
// owner's laptop, so newsroom posts shipped with the robotic browser fallback.
// Mirrors ai-covers.js: committed manifest = cross-machine done-set; on the
// server output goes to the untracked audio-ai/ overlay (git-reset-proof);
// INERT without OPENAI_API_KEY. A few posts per run, newest first.
//   OPENAI_API_KEY=... node scripts/ai-narrate.js [--limit N] [--slug <slug>] [--dry]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
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

// ── engine selection ────────────────────────────────────────────────────────
// This script used to be OpenAI-only, which made narration a single point of
// vendor failure: OpenAI has been hard billing-limit blocked since July, so it
// produced nothing, silently, and every post since 2026-07-25 shipped with the
// browser's robotic SpeechSynthesis fallback ("READ ALOUD IN YOUR BROWSER").
// ai-covers.js already had a free fallback (pollinations/flux) — narration had
// none. Kokoro-82M (Apache 2.0, tts/kokoro_synth.py) is that fallback: local,
// keyless, unmetered, with a unique blended voice per byline.
// OpenAI stays the preferred path when a key exists (faster, no CPU cost on a
// 2-core box); Kokoro is what runs the other 100% of the time.
const KOKORO_DIR = path.resolve(__dirname, "..", "..", "tts");
const KOKORO_PY = path.join(KOKORO_DIR, ".venv", "bin", "python");
const KOKORO_SCRIPT = path.join(KOKORO_DIR, "kokoro_synth.py");
const kokoroReady = () => fs.existsSync(KOKORO_PY) && fs.existsSync(KOKORO_SCRIPT) &&
  fs.existsSync(path.join(KOKORO_DIR, "kokoro-v1.0.onnx"));
const ENGINE = process.env.DP_TTS_ENGINE || (KEY ? "openai" : (kokoroReady() ? "kokoro" : "none"));

// Kokoro peaks around 1GB RSS regardless of chunk size (the cost is activations,
// not weights — the int8 model measured the same), and gil-vm has 1.9GB total
// with node already holding ~660MB. Generating under memory pressure would push
// the web server into swap or get it OOM-killed, so narration yields rather than
// risk the site: it is a nice-to-have, the site is not.
const MIN_FREE_MB = parseInt(process.env.DP_TTS_MIN_FREE_MB || "900", 10);
function availableMB() {
  try {
    const mi = fs.readFileSync("/proc/meminfo", "utf8");
    const avail = /MemAvailable:\s+(\d+) kB/.exec(mi);
    const swap = /SwapFree:\s+(\d+) kB/.exec(mi);
    if (!avail) return Infinity;
    return (parseInt(avail[1], 10) + (swap ? parseInt(swap[1], 10) : 0)) / 1024;
  } catch { return Infinity; } // not Linux (laptop) — no guard needed
}

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

// Kokoro writes the mp3 itself (it streams PCM straight into ffmpeg so the whole
// waveform is never in memory), so this returns a path-written flag rather than a
// Buffer like the OpenAI path does. `nice` keeps it off the web server's back.
function synthKokoro(text, author, outPath) {
  const r = spawnSync("nice", ["-n", "19", KOKORO_PY, KOKORO_SCRIPT], {
    input: JSON.stringify({ text, author, out: outPath }),
    encoding: "utf8", timeout: 20 * 60 * 1000, maxBuffer: 4 * 1024 * 1024,
  });
  if (r.error) throw new Error(`kokoro: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`kokoro exit ${r.status}: ${String(r.stderr || "").trim().split("\n").pop()}`);
  if (!fs.existsSync(outPath)) throw new Error("kokoro produced no file");
  return fs.statSync(outPath).size;
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

// --backfill narrates the WHOLE corpus, newest-first, ignoring the 3-day window —
// used to close the historical coverage gap (the loop's audio lever). Priority:
// news (wire) + how-tos (stack) + app highlights first, since those are what
// readers actually hit; then everything else. Still honours --limit for batching.
const BACKFILL = process.argv.includes("--backfill");
const cutoff = new Date(Date.now() - RECENT_DAYS * 86400000).toISOString().slice(0, 10);
const priority = (p) => (p.section === "wire" ? 0 : /^tool-highlight-/.test(p.slug) ? 1 : p.section === "stack" ? 2 : 3);
let pool;
if (ONLY) pool = allPosts().filter(p => p.slug === ONLY);
else if (BACKFILL) pool = allPosts().filter(p => !done(p.slug))
  .sort((a, b) => priority(a) - priority(b) || (b.date || "").localeCompare(a.date || ""));
else pool = allPosts().filter(p => (p.date || "") >= cutoff && !done(p.slug))
  .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
const targets = pool.slice(0, LIMIT);

if (!targets.length) { console.log("[ai-narrate] nothing new to narrate."); process.exit(0); }
// --dry previews the batch (ordering, sizes) without a key — useful for planning
// a backfill locally where OPENAI_API_KEY is absent.
if (DRY) { for (const p of targets) console.log(`[dry] ${p.slug} (${p.section}, ${ENGINE}, ~${narrationText(p).length} chars)`); process.exit(0); }
if (ENGINE === "none") { console.log(`[ai-narrate] ${targets.length} candidates, but no engine (no OPENAI_API_KEY and no local Kokoro) — browser TTS stays.`); process.exit(0); }
if (ENGINE === "kokoro" && availableMB() < MIN_FREE_MB) {
  console.log(`[ai-narrate] skipped — only ${availableMB().toFixed(0)}MB free, need ${MIN_FREE_MB}MB. The site comes first; next run will retry.`);
  process.exit(0);
}

let ok = 0;
for (const p of targets) {
  try {
    const out = path.join(OUT_DIR, `${p.slug}.mp3`);
    let bytes;
    if (ENGINE === "kokoro") {
      bytes = synthKokoro(narrationText(p), p.author, out);
    } else {
      const buf = await synth(narrationText(p), voiceFor(p.author));
      fs.writeFileSync(out, buf); bytes = buf.length;
    }
    mark(p.slug); ok++;
    console.log(`✓ ${p.slug} — narrated (${ENGINE}, ${(bytes / 1024 / 1024).toFixed(1)}MB)`);
  } catch (e) { console.error(`✗ ${p.slug}: ${e.message}`); }
}
console.log(`[ai-narrate] ${ok}/${targets.length} narrations generated via ${ENGINE}.`);
