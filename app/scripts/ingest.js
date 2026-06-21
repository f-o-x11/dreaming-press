// ingest.js — populate SQLite from content/posts/*.md + legacy posts/*.html.
// Run: node scripts/ingest.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, clearPosts, upsertPost } from "../lib/db.js";
import { mdToHtml, parseFrontmatter } from "../lib/markdown.js";
import { readTime, DEFAULT_AUTHOR } from "../lib/data.js";
import { deriveArtSpec } from "../lib/artspec.js";

// Resolve the cover's archetype/mood/motif the SAME way gen-art.js does, so a
// post can carry a human-readable "About this cover" caption. Block-form `art:`
// frontmatter is already flattened by parseFrontmatter into top-level keys.
function artFor({ title, dek, tags, section, slug, fm }) {
  const block = {};
  for (const k of ["archetype", "mood", "motif", "hue", "density"])
    if (fm && fm[k] != null && fm[k] !== "") block[k] = fm[k];
  const spec = deriveArtSpec({ title, dek, tags, section, slug, art: Object.keys(block).length ? block : undefined });
  return { archetype: spec.archetype, mood: spec.mood, motif: spec.motif || "" };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");
const CONTENT = path.join(REPO, "content", "posts");
const POSTS = path.join(REPO, "posts");
const AUDIO = path.join(REPO, "audio");

const SMALL = new Set(["a","an","and","the","of","to","in","on","for","vs","with","is","i"]);
function humanizeSlug(slug) {
  slug = slug.replace(/^\d{4}-\d{2}-\d{2}-/, "");
  return slug.split("-").map((w, i) =>
    (SMALL.has(w) && i) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
// Decode HTML entities (incl. hex/decimal numeric refs) so stored titles/deks
// are plain text — the single render-time esc() then owns escaping. Without this,
// a frontmatter title like "Here&#x27;s" gets esc()'d to "Here&amp;#x27;s" in the
// live <title>/og:title (the double-encoding bug). Loops to undo double-encoding.
function decodeEntities(s) {
  let v = String(s ?? ""), prev;
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", "#x27": "'" };
  let i = 0;
  do {
    prev = v;
    v = v.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
         .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
         .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n) => named[n]);
  } while (v !== prev && ++i < 4);
  return v;
}
const unescapeHtml = decodeEntities;
const hasAudio = (slug) => fs.existsSync(path.join(AUDIO, `${slug}.mp3`));
// byte length of a post's narration, for accurate <enclosure length> in the
// podcast feeds (0 when there's no audio).
const audioBytes = (slug) => { try { return fs.statSync(path.join(AUDIO, `${slug}.mp3`)).size; } catch { return 0; } };

function loadMarkdown(file) {
  const { fm, body } = parseFrontmatter(fs.readFileSync(file, "utf8"));
  const slug = fm.slug || path.basename(file, ".md");
  const sources = [];
  if (fm.sources) for (const s of fm.sources.split(";;")) {
    const [url, label] = s.split("|");
    if (url && url.trim()) sources.push([url.trim(), (label || url).trim()]);
  }
  // big-number "key figures" (FT/Bloomberg/Economist): `stat | label ;; …`
  const figures = [];
  if (fm.figures) for (const f of fm.figures.split(";;")) {
    const [stat, label] = f.split("|");
    if (stat && stat.trim()) figures.push([stat.trim(), (label || "").trim()]);
  }
  // FAQ (People-Also-Ask style Q&A): `Question? | Answer ;; Question? | Answer`.
  // Powers an on-page accordion + FAQPage JSON-LD. Both halves required per pair.
  const faq = [];
  if (fm.faq) for (const pair of fm.faq.split(";;")) {
    const i = pair.indexOf("|");
    if (i < 0) continue;
    const q = pair.slice(0, i).trim(), aTxt = pair.slice(i + 1).trim();
    if (q && aTxt) faq.push([q, aTxt]);
  }
  const body_html = mdToHtml(body);
  const title = decodeEntities(fm.title || slug), dek = decodeEntities(fm.dek || ""), section = fm.section || "dispatches";
  const tags = (fm.tags || "").split(",").map(s => s.trim()).filter(Boolean);
  return {
    slug, title, dek, author: fm.author || DEFAULT_AUTHOR, section, date: fm.date || "2026-06-13", tags,
    updated: (fm.updated || "").trim(),
    series: (fm.series || "").trim(),
    series_order: fm.series_order != null && String(fm.series_order).trim() !== "" && Number.isFinite(+fm.series_order) ? +fm.series_order : null,
    sources, figures, faq, summary: (fm.summary || "").split(";;").map(s => s.trim()).filter(Boolean),
    art: artFor({ title, dek, tags, section, slug, fm }),
    featured: ["true","yes","1"].includes((fm.featured || "").toLowerCase()),
    body_html, body_text: body.replace(/[#>*`|@]/g, " "),
    source: "md", read_time: readTime(body_html), has_audio: hasAudio(slug), audio_bytes: audioBytes(slug),
  };
}

function loadLegacy(file) {
  const slug = path.basename(file, ".html");
  const raw = fs.readFileSync(file, "utf8");
  const grab = (re) => { const m = re.exec(raw); return m ? m[1].trim() : ""; };

  let title = grab(/<title>([\s\S]*?)<\/title>/) || slug;
  title = title.replace(/\s*[—–-]\s*(dreaming\.press|Rosalinda Solana|Abe Armstrong)[\s\S]*$/, "").trim();
  title = unescapeHtml(title);
  if (!title || /^\d{4}-\d{2}-\d{2}/.test(title) || title === slug) {
    let h1 = grab(/<h1[^>]*>([\s\S]*?)<\/h1>/).replace(/<[^>]+>/g, "").trim();
    title = (h1 && !/^\d{4}-\d{2}-\d{2}/.test(h1)) ? unescapeHtml(h1) : humanizeSlug(slug);
  }
  const dek = unescapeHtml(grab(/<meta\s+name="description"\s+content="([^"]*)"/));

  let body_html = "";
  let m = /<div class="prose">([\s\S]*?)<\/div>\s*(?:<div class="related|<footer|<script)/.exec(raw);
  if (!m) m = /<div class="(?:prose|post-body|content)">([\s\S]*?)<\/div>\s*<(?:div|footer|script)/.exec(raw);
  if (m) body_html = m[1].trim();
  else { const m2 = /<\/h1>([\s\S]*?)<footer/.exec(raw); body_html = m2 ? m2[1].trim() : ""; }
  body_html = body_html.replace(/<div class="audio-player[\s\S]*?<\/div>\s*<\/div>/g, "");

  let author = DEFAULT_AUTHOR;
  if (slug.startsWith("abe-") || raw.includes("Abe Armstrong")) author = "abe";

  let date = "";
  const tm = /<time\s+datetime="(\d{4}-\d{2}-\d{2})"/.exec(raw);
  if (tm) date = tm[1];
  else { const sm = /^(\d{4}-\d{2}-\d{2})/.exec(slug); if (sm) date = sm[1]; }
  if (!date) date = "2026-02-15";

  return {
    slug, title, dek, author, section: "dispatches", date, tags: [], sources: [], series: "", series_order: null,
    art: artFor({ title, dek, tags: [], section: "dispatches", slug, fm: {} }),
    featured: false, body_html, body_text: body_html.replace(/<[^>]+>/g, " "),
    source: "legacy", read_time: readTime(body_html), has_audio: hasAudio(slug), audio_bytes: audioBytes(slug),
  };
}

export function ingest() {
  const d = db();
  clearPosts(d);
  const seen = new Set();
  let n = 0;
  const tx = d.transaction(() => {
    for (const f of fs.readdirSync(CONTENT).filter(f => f.endsWith(".md")).sort()) {
      const p = loadMarkdown(path.join(CONTENT, f));
      if (seen.has(p.slug)) continue;
      upsertPost(p, d); seen.add(p.slug); n++;
    }
    for (const f of fs.readdirSync(POSTS).filter(f => f.endsWith(".html") && !f.startsWith("_")).sort()) {
      const slug = path.basename(f, ".html");
      if (seen.has(slug)) continue;
      const p = loadLegacy(path.join(POSTS, f));
      if (p.body_text.split(/\s+/).filter(Boolean).length < 20) continue;
      upsertPost(p, d); seen.add(slug); n++;
    }
  });
  tx();
  return n;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fs.mkdirSync(path.join(__dirname, "..", "data"), { recursive: true });
  const n = ingest();
  console.log(`Ingested ${n} posts → ${db().name}`);
}
