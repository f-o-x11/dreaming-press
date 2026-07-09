// eval-harness.js — a repeatable quality score for dreaming.press across the
// dimensions that matter (UX, art, audio, structure, article quality, analytics).
// Each dimension is scored 0–10 from measurable signals; the weighted mean is the
// overall /10. Appends every run to eval-log.jsonl so the self-improvement loop
// can prove each cycle raised the score before deploying.
//   node scripts/eval-harness.js            # print + append to eval-log.jsonl
//   node scripts/eval-harness.js --quiet    # append only
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as DB from "../lib/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");
const IMG = path.join(REPO, "images");
const AUDIO = path.join(REPO, "audio");
const SRC = (f) => { try { return fs.readFileSync(path.join(REPO, "app", f), "utf8"); } catch { return ""; } };
const has = (dir, name) => { try { return fs.existsSync(path.join(dir, name)); } catch { return false; } };
const clamp = (n) => Math.max(0, Math.min(10, n));

DB.db();
const posts = DB.allPosts();
const N = Math.max(1, posts.length);
const render = SRC("lib/render.js") + SRC("lib/pages.js");
const server = SRC("server.js");
const artspec = SRC("lib/artspec.js");

// ── UX: how good is the reading + navigation experience ───────────────────────
function scoreUX() {
  const feats = {
    search: /\/search/.test(server),
    related: /relatedTo|class="related"/.test(render),
    toc: /class="toc"/.test(render),
    breadcrumb: /BreadcrumbList/.test(render),
    readingProgress: /reading-progress|rpBar/.test(render),
    skipLink: /skip-link/.test(render),
    darkTheme: /THEME_BOOT|data-theme|prefers-color-scheme/.test(render),
    mobileViewport: /width=device-width/.test(render),
    share: /share-btn|intent\/tweet/.test(render),
    savedForLater: /\/saved|save-btn/.test(render),
    takeaway: /takeaway/.test(render),
    audioPlayer: /audio-player/.test(render),
  };
  const hits = Object.values(feats).filter(Boolean).length;
  return { score: clamp((hits / Object.keys(feats).length) * 10), detail: feats };
}

// ── Art: covers present, content-driven, modern formats ───────────────────────
function scoreArt() {
  const withCover = posts.filter(p => has(IMG, `${p.slug}.png`)).length;
  const withWebp = posts.filter(p => has(IMG, `${p.slug}.webp`)).length;
  const withAvif = posts.filter(p => has(IMG, `${p.slug}.avif`)).length;
  const withArtSpec = posts.filter(p => p.art && String(p.art).length > 2).length;
  const contentDriven = /deriveArtSpec|archetype/.test(artspec);
  const s = 4 * (withCover / N) + 2 * (withWebp / N) + 2 * (withAvif / N) + (contentDriven ? 1 : 0) + (withArtSpec / N);
  return { score: clamp(s), detail: { coverPct: +(withCover / N).toFixed(2), webpPct: +(withWebp / N).toFixed(2), avifPct: +(withAvif / N).toFixed(2), artSpecPct: +(withArtSpec / N).toFixed(2), contentDriven } };
}

// ── Audio: listenability (pre-rendered neural narration = full credit;
// universal in-browser Web Speech "Listen" = half credit — every post listenable).
function scoreAudio() {
  const withAudio = posts.filter(p => has(AUDIO, `${p.slug}.mp3`)).length;
  const clientTTS = /data-tts|ttsListen|speechSynthesis/.test(render);
  const coverage = posts.reduce((s, p) => s + (has(AUDIO, `${p.slug}.mp3`) ? 1 : (clientTTS ? 0.5 : 0)), 0) / N;
  return { score: clamp(coverage * 10), detail: { neuralPct: +(withAudio / N).toFixed(2), clientTTS, listenableCoverage: +coverage.toFixed(2) } };
}

// ── Structure: SEO, schema, feeds, internal linking, machine surfaces ─────────
function scoreStructure() {
  const feats = {
    sitemap: /sitemapXml/.test(render),
    newsArticleSchema: /NewsArticle/.test(render),
    breadcrumbSchema: /BreadcrumbList/.test(render),
    itemListSchema: /ItemList/.test(render),
    canonicalMd: /rel="canonical"/.test(server + render),
    llmsTxt: /llmsTxt/.test(render),
    jsonFeed: /feedJson/.test(render),
    rss: /rssXml/.test(render),
    toolEngine: /\/stack\/:slug|renderToolPage/.test(server + render),
    clusters: /cluster|comparisonClusters/.test(server + render),
    indexnow: /indexnow|INDEXNOW/.test(server),
  };
  const hits = Object.values(feats).filter(Boolean).length;
  return { score: clamp((hits / Object.keys(feats).length) * 10), detail: feats };
}

// asArr: allPosts() hydrates tags/sources into real arrays, but ingested rows may
// hold JSON strings — accept either (the earlier harness JSON.parse'd arrays and
// mis-scored tags as 0).
const asArr = (v) => Array.isArray(v) ? v : (() => { try { return JSON.parse(v || "[]"); } catch { return []; } })();

// ── Article quality: depth, deks, sources, tags ───────────────────────────────
function scoreQuality() {
  const words = posts.map(p => (p.body_text || "").split(/\s+/).filter(Boolean).length);
  const median = words.slice().sort((a, b) => a - b)[Math.floor(words.length / 2)] || 0;
  const withDek = posts.filter(p => (p.dek || "").trim().length > 10).length;
  const nonFiction = posts.filter(p => ["wire", "stack"].includes(p.section));
  const withSources = nonFiction.filter(p => asArr(p.sources).length > 0).length;
  const withTags = posts.filter(p => asArr(p.tags).length > 0).length;
  const depth = Math.min(1, median / 900);          // ~900 words = full marks
  const sourceRate = nonFiction.length ? withSources / nonFiction.length : 1;
  const s = 4 * depth + 2 * (withDek / N) + 3 * sourceRate + 1 * (withTags / N);
  return { score: clamp(s), detail: { medianWords: median, dekPct: +(withDek / N).toFixed(2), sourceRateNonFiction: +sourceRate.toFixed(2), tagPct: +(withTags / N).toFixed(2) } };
}

// ── Analytics: instrumentation + honest reporting + dashboard ─────────────────
function scoreAnalytics() {
  const feats = {
    engagementEvents: /recordEvent|\/api\/events/.test(server),
    channelAttribution: /channelBreakdown|classifyChannel/.test(SRC("lib/db.js")),
    sessionId: /sid|sessionStorage/.test(render),
    botFilter: /isBot|BOT_UA/.test(server),
    engagedReadsKPI: /engaged reads/.test(render),
    dashboard: /\/dashboard|renderDashboard/.test(server + render),
    timeseries: /timeseries|byDay|dailySeries/.test(SRC("lib/analytics.js") + SRC("lib/db.js")),
    referrers: /topReferrers|ref\b/.test(SRC("lib/analytics.js") + SRC("lib/db.js")),
  };
  const hits = Object.values(feats).filter(Boolean).length;
  return { score: clamp((hits / Object.keys(feats).length) * 10), detail: feats };
}

const dims = {
  ux: { w: 0.20, ...scoreUX() },
  art: { w: 0.12, ...scoreArt() },
  audio: { w: 0.10, ...scoreAudio() },
  structure: { w: 0.20, ...scoreStructure() },
  quality: { w: 0.23, ...scoreQuality() },
  analytics: { w: 0.15, ...scoreAnalytics() },
};
const overall = +Object.values(dims).reduce((s, d) => s + d.w * d.score, 0).toFixed(2);

const result = {
  ts: new Date().toISOString(),
  posts: N,
  overall,
  dimensions: Object.fromEntries(Object.entries(dims).map(([k, d]) => [k, { score: +d.score.toFixed(2), weight: d.w, detail: d.detail }])),
};
fs.appendFileSync(path.join(__dirname, "..", "eval-log.jsonl"), JSON.stringify(result) + "\n");

if (!process.argv.includes("--quiet")) {
  console.log(`\ndreaming.press eval — ${result.ts}   (${N} posts)`);
  console.log(`OVERALL: ${overall}/10\n`);
  for (const [k, d] of Object.entries(dims)) console.log(`  ${k.padEnd(11)} ${d.score.toFixed(1)}/10  (w=${d.w})`);
  console.log("");
}
export { result };
