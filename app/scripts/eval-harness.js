// eval-harness.js — a repeatable quality score for dreaming.press, v2.
//
// v1 was a feature-PRESENCE checklist: almost every signal was a boolean that
// was already true, so the score saturated at ~9.5 and could not move — it had
// stopped measuring anything real ("the eval is the product" trap). v2 grades
// every dimension on CONTINUOUS measurements against the site's actual north
// star (the owner's standing directive: optimize for visitors + time-on-site,
// nothing else) so the number can honestly climb as real work lands.
//
// Weighting follows the north star: ENGAGEMENT (the next-click + dwell levers)
// and AUDIO (listen-while-doing → long sessions) carry the most weight because
// they are what turns a visit into time-on-site. Dimensions the site is already
// excellent at (SEO/structure, content depth) still score high — v2 does not
// fake a low baseline; it exposes the genuine gaps (audio coverage, internal
// linking, proven reader outcomes) that a saturated checklist was hiding.
//
//   node scripts/eval-harness.js            # print + append to eval-log.jsonl
//   node scripts/eval-harness.js --quiet    # append only
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as DB from "../lib/db.js";
import { renderSection, renderTag, renderAuthor, renderTopicMcp, renderHome } from "../lib/render.js";
import { render404, renderMdTwin } from "../lib/pages.js";
import { renderToolPage, renderCompare, renderBest } from "../lib/tools-render.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");
const IMG = path.join(REPO, "images");
const AUDIO = path.join(REPO, "audio");
const AUDIO_AI = path.join(REPO, "audio-ai");
const SRC = (f) => { try { return fs.readFileSync(path.join(REPO, "app", f), "utf8"); } catch { return ""; } };
const has = (dir, name) => { try { return fs.existsSync(path.join(dir, name)); } catch { return false; } };
const hasAudio = (slug) => has(AUDIO, `${slug}.mp3`) || has(AUDIO_AI, `${slug}.mp3`);
const clamp = (n) => Math.max(0, Math.min(10, n));
const pct = (n) => +(n).toFixed(3);
// linear ramp: 0 at floor, 10 at target (full marks), clamped
const ramp = (v, target, floor = 0) => clamp(((v - floor) / (target - floor)) * 10);

DB.db();
const posts = DB.allPosts();
const N = Math.max(1, posts.length);
const render = SRC("lib/render.js") + SRC("lib/pages.js");
const server = SRC("server.js");
const artspec = SRC("lib/artspec.js");

// freshness clock: measure "recent" relative to the newest post, not wall-clock,
// so the score is reproducible in a sandbox with a frozen corpus.
const maxDate = posts.map(p => p.date || "").sort().slice(-1)[0] || "2026-01-01";
const md = new Date(maxDate);
const daysAgo = (d) => (md - new Date(d || maxDate)) / 86400000;
const asArr = (v) => Array.isArray(v) ? v : (() => { try { return JSON.parse(v || "[]"); } catch { return []; } })();

// real reader outcomes, when the deploy has exported them (analytics/snapshot.json).
// Absent in a fresh sandbox DB — treated as "unknown" (neutral), never as zero,
// so code work is never penalised for a lack of live traffic.
const snapshot = (() => { try { return JSON.parse(fs.readFileSync(path.join(REPO, "analytics", "snapshot.json"), "utf8")); } catch { return null; } })();

const isHowTo = (p) => p.section === "stack" || /^tool-highlight-/.test(p.slug) ||
  /^how[ -]to|tutorial|guide|step[ -]by[ -]step|walkthrough/i.test(p.title + " " + (p.dek || ""));
// any in-body link to another page on the site (path-absolute, not protocol-relative
// "//" and not a bare "#" anchor) — this is the next-click surface that keeps a
// reader on the site. Counts /posts, /stack, /topics, /compare, /best, /tools, etc.
const internalLinks = (p) => ((p.body_html || "").match(/href="\/(?!\/)[a-z][^"#]*"/gi) || []).length;

// ── ENGAGEMENT (north star: next-click + dwell) ───────────────────────────────
// Every visit should chain to another read and be measured publicly. Scores the
// levers the loop can actually move: internal-link density, related-content
// surface, public per-article metrics, and (when present) real dwell/pages-per.
function scoreEngagement() {
  const links = posts.map(internalLinks);
  const avgLinks = links.reduce((a, b) => a + b, 0) / N;
  const deadEndFrac = links.filter(x => x === 0).length / N;   // posts with NO next click
  const relatedShown = /relatedTo|class="related"/.test(render);
  const publicMetrics = /public-metrics|articleMetrics/.test(render) && /data-slug/.test(render);
  const dwellTracked = /'dwell'|"dwell"/.test(SRC("lib/render.js") + SRC("lib/db.js"));

  // link density: full marks at avg >= 8 internal links AND < 5% dead-ends
  const density = 0.6 * ramp(avgLinks, 8) + 0.4 * ramp(1 - deadEndFrac, 0.95, 0.6);
  const surfaces = 10 * ((relatedShown ? 0.4 : 0) + (publicMetrics ? 0.35 : 0) + (dwellTracked ? 0.25 : 0));

  // real outcome (bonus when measured): avg dwell seconds vs a 90s target
  let outcome = null, outScore = null;
  if (snapshot?.site?.avgTimeSec != null) { outcome = snapshot.site.avgTimeSec; outScore = ramp(outcome, 90); }
  else if (snapshot?.funnel) { const f = snapshot.funnel; outScore = ramp(f.reads / Math.max(1, f.views), 0.35) ; }

  // base = levers (60% density, 40% surfaces); if outcome known, blend it in at 30%
  const base = 0.6 * density + 0.4 * surfaces;
  const score = outScore == null ? base : 0.7 * base + 0.3 * outScore;
  return { score: clamp(score), detail: {
    avgInternalLinks: +avgLinks.toFixed(2), deadEndFrac: pct(deadEndFrac),
    relatedShown, publicMetrics, dwellTracked,
    avgDwellSec: outcome, outcomeScored: outScore != null,
  } };
}

// ── AUDIO (listen-while-doing → long sessions; owner's active priority) ────────
function scoreAudio() {
  const withAudio = posts.filter(p => hasAudio(p.slug)).length;
  const recent = posts.filter(p => daysAgo(p.date) <= 30);
  const recentAudio = recent.filter(p => hasAudio(p.slug)).length;
  const neuralCoverage = withAudio / N;                          // whole corpus
  const recentCoverage = recent.length ? recentAudio / recent.length : 0;
  const clientTTS = /data-tts|ttsListen|speechSynthesis/.test(render);
  const modernModel = /gpt-4o-mini-tts|tts-1-hd|kokoro/i.test(SRC("scripts/ai-narrate.js"));
  // corpus coverage to 85% = full; recent (last 30d) coverage to 90% = full.
  // recent weighted equally — a news product's newest pieces must be listenable.
  const score = 0.45 * ramp(neuralCoverage, 0.85) + 0.45 * ramp(recentCoverage, 0.9) + (modernModel ? 1 : 0);
  return { score: clamp(score), detail: {
    neuralPct: pct(neuralCoverage), recentPct: pct(recentCoverage),
    narrated: withAudio, recentNarrated: `${recentAudio}/${recent.length}`, clientTTS, modernModel,
  } };
}

// ── CONTENT (depth + sourcing + freshness/cadence + how-to mix) ───────────────
function scoreContent() {
  const words = posts.map(p => (p.body_text || "").split(/\s+/).filter(Boolean).length);
  const median = words.slice().sort((a, b) => a - b)[Math.floor(words.length / 2)] || 0;
  const nonFiction = posts.filter(p => ["wire", "stack"].includes(p.section));
  const withSources = nonFiction.filter(p => asArr(p.sources).length > 0).length;
  const sourceRate = nonFiction.length ? withSources / nonFiction.length : 1;
  const last7 = posts.filter(p => daysAgo(p.date) <= 7).length;
  const last60 = posts.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 60);
  const howToShare = last60.length ? last60.filter(isHowTo).length / last60.length : 0;

  const depth = ramp(median, 900);                 // ~900 words = full
  const sources = ramp(sourceRate, 0.98);
  const cadence = ramp(last7, 21);                  // ~3 posts/day = full
  const mix = ramp(howToShare, 0.45);              // ~45% how-to/tutorial = full
  const score = 0.30 * depth + 0.25 * sources + 0.25 * cadence + 0.20 * mix;
  return { score: clamp(score), detail: {
    medianWords: median, sourceRateNonFiction: pct(sourceRate),
    postsLast7: last7, howToShareLast60: pct(howToShare),
  } };
}

// ── UX (reading + navigation experience) ──────────────────────────────────────
function scoreUX() {
  const feats = {
    search: /\/search/.test(server),
    toc: /class="toc"/.test(render),
    readingProgress: /reading-progress|rpBar/.test(render),
    skipLink: /skip-link/.test(render),
    darkTheme: /THEME_BOOT|data-theme|prefers-color-scheme/.test(render),
    mobileViewport: /width=device-width/.test(render),
    share: /share-btn|intent\/tweet/.test(render),
    savedForLater: /\/saved|save-btn/.test(render),
    audioPlayer: /audio-player/.test(render),
    notFoundRecovery: (() => { try { const h = render404(posts.slice(0, 6)); return /role="search"/.test(h) && (h.match(/\/posts\//g) || []).length >= 3; } catch { return false; } })(),
    noRenderBlockingFontCss: (() => {
      try {
        const h = renderSection("wire", DB.postsBySection("wire"), 1);
        const head = h.slice(0, h.indexOf("</head>") + 7).replace(/<noscript>[\s\S]*?<\/noscript>/gi, "");
        const links = head.match(/<link\b[^>]*\brel=("|')stylesheet\1[^>]*>/gi) || [];
        const foreign = links.filter(l => /href=("|')https?:\/\//i.test(l));
        return foreign.every(l => /media=("|')print\1/i.test(l) && /onload=/i.test(l));
      } catch { return false; }
    })(),
    listingsPaginated: (() => {
      try {
        const cnt = (h) => (h.match(/\/posts\//g) || []).length;
        return cnt(renderSection("wire", DB.postsBySection("wire"), 1)) <= 90;
      } catch { return false; }
    })(),
  };
  const hits = Object.values(feats).filter(Boolean).length;
  return { score: clamp((hits / Object.keys(feats).length) * 10), detail: feats };
}

// ── STRUCTURE (SEO, schema, feeds, machine surfaces) ──────────────────────────
function scoreStructure() {
  const feats = {
    sitemap: /sitemapXml/.test(render),
    newsArticleSchema: /NewsArticle/.test(render),
    breadcrumbSchema: /BreadcrumbList/.test(render),
    itemListSchema: /ItemList/.test(render),
    canonical: /rel="canonical"/.test(server + render),
    llmsTxt: /llmsTxt/.test(render),
    jsonFeed: /feedJson/.test(render),
    rss: /rssXml/.test(render),
    toolEngine: /\/stack\/:slug|renderToolPage/.test(server + render),
    clusters: /cluster|comparisonClusters/.test(server + render),
    indexnow: /indexnow|INDEXNOW/.test(server),
    webManifest: /manifest\.webmanifest/.test(server) && /rel="manifest"/.test(render),
  };
  const hits = Object.values(feats).filter(Boolean).length;
  return { score: clamp((hits / Object.keys(feats).length) * 10), detail: feats };
}

// ── ART (covers present, modern formats, content-driven + real imagery) ───────
function scoreArt() {
  const withCover = posts.filter(p => has(IMG, `${p.slug}.png`)).length;
  const withWebp = posts.filter(p => has(IMG, `${p.slug}.webp`)).length;
  const withAvif = posts.filter(p => has(IMG, `${p.slug}.avif`)).length;
  const contentDriven = /deriveArtSpec|archetype/.test(artspec);
  // real (photographic/illustrative, model-generated) covers vs procedural
  // gradients: read the covers manifest for the model-generated set.
  const realSet = (() => { try { const j = JSON.parse(fs.readFileSync(path.join(IMG, "ai-covers.json"), "utf8")); return new Set(Array.isArray(j) ? j : Object.keys(j)); } catch { return new Set(); } })();
  const realPct = posts.filter(p => realSet.has(p.slug)).length / N;
  const s = 3 * (withCover / N) + 2 * (withWebp / N) + 2 * (withAvif / N) + (contentDriven ? 1 : 0) + 2 * ramp(realPct, 0.6) / 10;
  return { score: clamp(s), detail: {
    coverPct: pct(withCover / N), webpPct: pct(withWebp / N), avifPct: pct(withAvif / N),
    realImageryPct: pct(realPct), contentDriven,
  } };
}

// ── DISCOVERABILITY (GEO/AEO — being the source AI answer engines cite) ───────
// The site's real front door is AI answer engines (ChatGPT/Perplexity/Gemini +
// Baidu/Yuanbao). This grades citation-readiness: FAQ/answer units on every
// template, machine files, freshness signals, entity authority, and crawler access.
function scoreDiscoverability() {
  const hasFAQ = (fn) => { try { return /"@type":"FAQPage"/.test(fn()); } catch { return false; } };
  const oneTool = posts.length && DB.allTools ? DB.allTools()[0] : null;
  const cat = oneTool?.category;
  const catTools = cat ? DB.toolsByCategory(cat) : [];
  const faq = {
    tool: oneTool ? hasFAQ(() => renderToolPage(oneTool, [], catTools.filter(t => t.slug !== oneTool.slug).slice(0, 3))) : false,
    compare: catTools.length >= 2 ? hasFAQ(() => renderCompare(catTools[0], catTools[1])) : false,
    best: cat ? hasFAQ(() => renderBest(cat, catTools)) : false,
    hub: hasFAQ(() => renderTopicMcp(DB.mcpHub ? DB.mcpHub() : [])),
    section: hasFAQ(() => renderSection("wire", DB.postsBySection("wire"), 1)),
    home: hasFAQ(() => renderHome(posts.slice(0, 30), 0, [], null, { tools: DB.allTools ? DB.allTools() : [] })),
  };
  const faqCoverage = Object.values(faq).filter(Boolean).length / Object.keys(faq).length;

  const toolsSrc = SRC("lib/tools-render.js");
  const robots = (() => { try { return fs.readFileSync(path.join(REPO, "robots.txt"), "utf8"); } catch { return ""; } })();
  const mdTwin = (() => { try { const rich = posts.find(p => (p.faq && String(p.faq).length > 4)); return rich ? renderMdTwin(rich) : ""; } catch { return ""; } })();
  const hasFile = (p) => { try { return fs.existsSync(path.join(REPO, p)); } catch { return false; } };

  const machine = {
    llmsTxt: /llmsTxt/.test(render), aiCrawlers: /GPTBot/.test(robots), chineseCrawlers: /Baiduspider/.test(robots),
    agentsTxt: hasFile(".well-known/agents.txt") || /agents\.txt/.test(server),
    mdTwinRich: /## Key takeaways/.test(mdTwin) || /## FAQ/.test(mdTwin),
    indexnowRefresh: /content-signature|weekBucket|sigFor/.test(SRC("scripts/indexnow.js")),
    baiduPush: hasFile("app/scripts/baidu-push.js"),
  };
  const machineScore = Object.values(machine).filter(Boolean).length / Object.keys(machine).length;

  const freshness = /verified-stamp/.test(toolsSrc) && /dateModified/.test(toolsSrc);
  const entity = {
    editorPerson: /editor-person/.test(render), speakable: /speakable/.test(render),
    citableDataset: /"@type": "Dataset"|Dataset/.test(render), sameAs: /sameAs/.test(render),
  };
  const entityScore = Object.values(entity).filter(Boolean).length / Object.keys(entity).length;
  // front-loaded answer capsule (takeaway before body) on articles
  const answerCapsule = /\$\{takeawayBlock\}\s*\n\$\{audioBlock\}/.test(SRC("lib/render.js"));

  const score = 10 * (0.34 * faqCoverage + 0.24 * machineScore + 0.14 * (freshness ? 1 : 0) + 0.18 * entityScore + 0.10 * (answerCapsule ? 1 : 0));
  return { score: clamp(score), detail: {
    faqCoverage: pct(faqCoverage), faq, machineScore: pct(machineScore), machine,
    freshness, entityScore: pct(entityScore), answerCapsule,
  } };
}

const dims = {
  engagement:     { w: 0.25, ...scoreEngagement() },
  audio:          { w: 0.15, ...scoreAudio() },
  content:        { w: 0.18, ...scoreContent() },
  discoverability:{ w: 0.12, ...scoreDiscoverability() },
  ux:             { w: 0.12, ...scoreUX() },
  structure:      { w: 0.10, ...scoreStructure() },
  art:            { w: 0.08, ...scoreArt() },
};
const overall = +Object.values(dims).reduce((s, d) => s + d.w * d.score, 0).toFixed(2);

const result = {
  ts: new Date().toISOString(),
  version: 2,
  posts: N,
  overall,
  dimensions: Object.fromEntries(Object.entries(dims).map(([k, d]) => [k, { score: +d.score.toFixed(2), weight: d.w, detail: d.detail }])),
};
fs.appendFileSync(path.join(__dirname, "..", "eval-log.jsonl"), JSON.stringify(result) + "\n");

if (!process.argv.includes("--quiet")) {
  console.log(`\ndreaming.press eval v2 — ${result.ts}   (${N} posts)`);
  console.log(`OVERALL: ${overall}/10\n`);
  for (const [k, d] of Object.entries(dims)) console.log(`  ${k.padEnd(11)} ${d.score.toFixed(1)}/10  (w=${d.w})   ${JSON.stringify(d.detail).slice(0, 90)}`);
  console.log("");
}
export { result };
