// server.js — the dreaming.press web application (SSR + JSON API).
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { SITE, SECTION_ORDER, SECTIONS, AUTHORS } from "./lib/data.js";
import * as DB from "./lib/db.js";
import * as R from "./lib/render.js";
import * as P from "./lib/pages.js";
import * as ANALYTICS from "./lib/analytics.js";
import * as MAIL from "./lib/email.js";
import { renderDashboard } from "./lib/dashboard.js";
import * as TR from "./lib/tools-render.js";
import { CATEGORIES } from "./lib/tools-data.js";
import { INDEXNOW_KEY } from "./scripts/indexnow.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));

// #20 CDN-ready caching: anonymous SSR pages are safe to serve from a shared edge
// for a short window with background revalidation. Browsers still revalidate each
// navigation (max-age=0 → a cheap 304 via Express's ETag); a CDN in front may serve
// from cache for s-maxage and keep serving stale for stale-while-revalidate while it
// refreshes. Routes that do per-request work (the article view-counter) set their own
// Cache-Control FIRST, so this default leaves them untouched.
const HTML_CACHE = "public, max-age=0, s-maxage=300, stale-while-revalidate=86400";
const html = (res, body, status = 200) => {
  if (status === 200 && !res.get("Cache-Control")) res.set("Cache-Control", HTML_CACHE);
  return res.status(status).type("html").send(body);
};
const noStore = { etag: false };

// Crawlers, link unfurlers, and our own test/crawl tooling must NOT inflate the
// view counter — only real browsers count. (Real engagement = client beacons.)
const BOT_UA = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|preview|curl|wget|python-requests|node-fetch|go-http|okhttp|axios|libwww|headlesschrome|puppeteer|playwright|phantomjs|lighthouse|gptbot|claudebot|claude-web|anthropic|ccbot|perplexitybot|bytespider|ahrefs|semrush|dotbot|mj12bot|dataforseo|applebot|yandex|duckduckbot/i;
const isBot = (req) => { const ua = req.get("user-agent") || ""; return !ua || BOT_UA.test(ua); };

// ── static assets (curated; never blanket-serve the repo) ────────────────────
const staticOpts = { maxAge: "1h", index: false };
// #20: covers are slug-addressed and generated deterministically, so a given URL's
// image is effectively immutable — cache it long and take revalidation off the LCP
// path, with stale-while-revalidate so an edited cover still refreshes within a day.
const COVER_CACHE = "public, max-age=86400, stale-while-revalidate=604800";
// #20: the same /images/<slug>.png URL is content-negotiated to AVIF/WebP/PNG by
// Accept (see the handler below), so every response in this space must Vary: Accept
// — otherwise a shared CDN can cache one representation and serve it to a client
// that can't decode it (an AVIF blob to a PNG-only client = a broken LCP image).
// The negotiated branch sets it; this makes the express.static PNG fallback match.
const coverOpts = { index: false, setHeaders: (res) => { res.set("Cache-Control", COVER_CACHE); res.set("Vary", "Accept"); } };
// #9: serve AVIF/WebP covers to browsers that accept them (≈85–94% smaller than
// the PNG — the LCP element on every article), with transparent PNG fallback.
app.get("/images/:file", (req, res, next) => {
  const m = /^(.+)\.png$/.exec(req.params.file || "");
  if (!m) return next();
  const accept = req.get("accept") || "";
  for (const [type, ext] of [["image/avif", ".avif"], ["image/webp", ".webp"]]) {
    if (accept.includes(type)) {
      const alt = path.join(REPO, "images", m[1] + ext);
      if (fs.existsSync(alt)) {
        res.type(type);
        res.set("Cache-Control", COVER_CACHE);
        res.set("Vary", "Accept");
        return res.sendFile(alt);
      }
    }
  }
  next();
});
app.use("/images", express.static(path.join(REPO, "images"), coverOpts));
app.use("/audio", express.static(path.join(REPO, "audio"), { maxAge: "1d", index: false }));
app.use("/static", express.static(path.join(REPO, "static"), staticOpts));
for (const f of ["style.css", "style.min.css", "rosalinda-avatar-new.jpg", "abe-avatar.jpg",
  "robots.txt"]) {
  app.get(`/${f}`, (req, res) => {
    const p = path.join(REPO, f);
    // #20: these were served with max-age=0 (revalidation RTT on every load of a
    // render-blocking stylesheet). Cache for an hour; CDN fronting is the follow-on.
    if (fs.existsSync(p)) res.sendFile(p, { maxAge: "1h", headers: { "Cache-Control": "public, max-age=3600" } });
    else res.status(404).end();
  });
}
// /favicon.ico: no .ico exists — serve the PNG favicon there (browsers accept
// any image type at this path; without this every page load logs a 404).
app.get("/favicon.ico", (req, res) => {
  const p = path.join(REPO, "images", "favicon.png");
  if (fs.existsSync(p)) res.type("image/png").sendFile(p, { maxAge: "7d" });
  else res.status(404).end();
});

// #1 IndexNow ownership key — proves we own the domain to Bing/Yandex/etc.
app.get(`/${INDEXNOW_KEY}.txt`, (req, res) => res.type("text/plain").send(INDEXNOW_KEY));

app.get("/dp", (req, res) => {
  const p = path.join(REPO, "dp");
  if (!fs.existsSync(p)) return res.status(404).end();
  res.type("text/plain").send(fs.readFileSync(p, "utf8"));
});

// ── health ───────────────────────────────────────────────────────────────────
app.get("/healthz", (req, res) =>
  res.json({ ok: true, posts: DB.countPosts(), views: DB.totalViews() }));

// ── home ─────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => html(res, R.renderHome(DB.attachMetrics(DB.allPosts()), DB.totalViews(), ANALYTICS.mostRead())));

// ── sections ─────────────────────────────────────────────────────────────────
for (const sk of SECTION_ORDER) {
  app.get(`/${sk}.html`, (req, res) => html(res, R.renderSection(sk, DB.attachMetrics(DB.postsBySection(sk)), parseInt(req.query.page) || 1)));
  // per-desk feeds so readers (and agents) can subscribe to one section
  const fmeta = () => ({ title: `dreaming.press — ${SECTIONS[sk].name}`, description: SECTIONS[sk].tagline });
  app.get(`/${sk}.xml`, (req, res) => res.type("application/rss+xml")
    .send(P.rssXml(DB.postsBySection(sk), { ...fmeta(), link: `${SITE}/${sk}.html` })));
  app.get(`/${sk}.json`, (req, res) => res.json(
    P.feedJson(DB.postsBySection(sk), { ...fmeta(), homeUrl: `${SITE}/${sk}.html`, feedUrl: `${SITE}/${sk}.json` })));
  // per-desk podcast feed (narration enclosures) for Overcast/Apple Podcasts
  app.get(`/${sk}-podcast.xml`, (req, res) => res.type("application/rss+xml").send(
    P.podcastXml(DB.postsBySection(sk), {
      title: `dreaming.press — ${SECTIONS[sk].name} (Narrated)`,
      description: SECTIONS[sk].tagline, link: `${SITE}/${sk}.html`,
      feedUrl: `${SITE}/${sk}-podcast.xml`, image: `${SITE}/images/og-${sk}.png` })));
}

// ── static-ish pages ─────────────────────────────────────────────────────────
app.get("/agents.html", (req, res) => html(res, P.renderAgents()));
app.get("/about.html", (req, res) => html(res, P.renderAbout()));
app.get("/submit.html", (req, res) => html(res, P.renderSubmit()));
app.get("/newsroom", (req, res) => html(res, P.renderNewsroom(ANALYTICS.report(), DB.channelBreakdown())));
app.get("/dashboard", (req, res) => {
  const days = Math.min(365, Math.max(1, parseInt(req.query.days) || 30));
  html(res, renderDashboard({
    days, totalPosts: DB.countPosts(),
    funnel: DB.funnel({ days }), series: DB.dailySeries({ days }),
    channels: DB.channelBreakdown({ days }), referrers: DB.topReferrers({ days }),
    content: DB.topContent({ days }), devices: DB.deviceBreakdown({ days }),
    realtime: DB.realtime({ minutes: 60 }),
  }));
});
app.get("/weekly", (req, res) => html(res, R.renderWeekly(DB.allPosts())));

// ── The Stack: data-backed tool pages (#10/#12/#16/#22/#13) ───────────────────
app.get("/tools", (req, res) => html(res, TR.renderToolsIndex(DB.allTools())));
app.get("/reports/state-of-ai-agents", (req, res) => html(res, TR.renderStateReport(DB.allTools())));
app.get("/calculators", (req, res) => html(res, TR.renderCalculators()));
app.get("/calculators/llm-vram", (req, res) => html(res, TR.renderVramCalculator()));
app.get("/calculators/llm-cost", (req, res) => html(res, TR.renderLlmCostCalculator()));
app.get("/calculators/llm-latency", (req, res) => html(res, TR.renderLlmLatencyCalculator()));
app.get("/calculators/context-budget", (req, res) => html(res, TR.renderContextBudgetCalculator()));
app.get("/calculators/agent-cost", (req, res) => html(res, TR.renderAgentCostCalculator()));
app.get("/api/tools.json", (req, res) => res.json({
  generated: new Date().toISOString(), count: DB.allTools().length, tools: DB.allTools(),
}));
app.get("/best/:cat", (req, res, next) => {
  const cat = String(req.params.cat || "").toLowerCase();
  if (!CATEGORIES[cat]) return next();
  const tools = DB.toolsByCategory(cat);
  if (!tools.length) return next();
  html(res, TR.renderBest(cat, tools));
});
app.get("/compare/:pair", (req, res, next) => {
  const m = /^(.+)-vs-(.+)$/.exec(String(req.params.pair || ""));
  if (!m) return next();
  const a = DB.getTool(m[1]), b = DB.getTool(m[2]);
  if (!a || !b) return next();
  html(res, TR.renderCompare(a, b));
});
app.get("/stack/:slug", (req, res, next) => {
  const t = DB.getTool(String(req.params.slug || ""));
  if (!t) return next();
  const alternatives = (t.alternatives || []).map(s => DB.getTool(s)).filter(Boolean);
  html(res, TR.renderToolPage(t, DB.postsMentioning(t.name), alternatives));
});
app.get("/alternatives/:slug", (req, res, next) => {
  const t = DB.getTool(String(req.params.slug || ""));
  if (!t) return next();
  // alts = real category siblings ∪ curated alternatives, deduped, ranked by stars
  const bySlug = new Map();
  for (const x of DB.toolsByCategory(t.category)) if (x.slug !== t.slug) bySlug.set(x.slug, x);
  for (const s of (t.alternatives || [])) { const x = DB.getTool(s); if (x && x.slug !== t.slug) bySlug.set(x.slug, x); }
  const alts = [...bySlug.values()].sort((a, b) => (b.stars || 0) - (a.stars || 0));
  if (!alts.length) return next();
  html(res, TR.renderAlternatives(t, alts));
});

// ── search ───────────────────────────────────────────────────────────────────
app.get("/search", (req, res) => {
  const q = (req.query.q || "").toString();
  html(res, R.renderSearch(q, DB.search(q)));
});

// ── tags (voice-tag archives) ─────────────────────────────────────────────────
app.get("/tags", (req, res) => html(res, R.renderTags(DB.allTags())));
app.get("/tags/:tag", (req, res, next) => {
  const tag = (req.params.tag || "").toString().toLowerCase();
  const posts = DB.postsByTag(tag);
  if (!posts.length) return next();          // unknown tag → 404, not an empty page
  html(res, R.renderTag(tag, DB.attachMetrics(posts), parseInt(req.query.page) || 1));
});

// ── series (serial-arc collections) ────────────────────────────────────────────
app.get("/comparisons", (req, res) => html(res, R.renderComparisons(DB.comparisonClusters())));
app.get("/concepts", (req, res) => html(res, R.renderConcepts(DB.concepts())));
app.get("/topics", (req, res) => html(res, R.renderTopicsIndex()));
app.get("/topics/agent-security", (req, res) => html(res, R.renderTopicSecurity(DB.securityHub())));
app.get("/topics/rag-retrieval", (req, res) => html(res, R.renderTopicRag(DB.ragHub())));
app.get("/topics/agent-memory", (req, res) => html(res, R.renderTopicMemory(DB.memoryHub())));
app.get("/topics/mcp", (req, res) => html(res, R.renderTopicMcp(DB.mcpHub())));
app.get("/topics/agent-frameworks", (req, res) => html(res, R.renderTopicFrameworks(DB.frameworksHub())));
app.get("/topics/llm-inference", (req, res) => html(res, R.renderTopicInference(DB.inferenceHub())));
app.get("/topics/agent-evals", (req, res) => html(res, R.renderTopicEvals(DB.evalsHub())));
app.get("/topics/coding-agents", (req, res) => html(res, R.renderTopicCoding(DB.codingHub())));
app.get("/topics/model-selection", (req, res) => html(res, R.renderTopicModels(DB.modelsHub())));
app.get("/topics/agent-web", (req, res) => html(res, R.renderTopicWeb(DB.webHub())));
app.get("/comparisons/:cluster", (req, res, next) => {
  const cluster = DB.comparisonClusterBySlug(req.params.cluster);
  if (!cluster) return next();
  html(res, R.renderComparisonCluster(cluster));
});
app.get("/series", (req, res) => html(res, R.renderSeriesIndex(DB.allSeries())));
app.get("/series/:id", (req, res, next) => {
  const id = (req.params.id || "").toString();
  const posts = DB.postsInSeries(id);
  if (posts.length < 2) return next();          // unknown/too-short series → 404
  html(res, R.renderSeries(id, posts));
});

// ── authors (byline archives) ─────────────────────────────────────────────────
app.get("/saved", (req, res) => html(res, R.renderSaved()));
app.get("/authors", (req, res) => html(res, R.renderAuthors(DB.authorCounts())));
app.get("/authors/:id", (req, res, next) => {
  const id = (req.params.id || "").toString();
  if (!AUTHORS[id]) return next();             // unknown author → 404
  html(res, R.renderAuthor(id, DB.attachMetrics(DB.postsByAuthor(id)), parseInt(req.query.page) || 1));
});

// ── articles + markdown twins ────────────────────────────────────────────────
app.get("/posts/:file", (req, res, next) => {
  const file = req.params.file;
  const md = file.endsWith(".md");
  const slug = file.replace(/\.(html|md)$/, "");
  if (!/\.(html|md)$/.test(file)) {
    // Extensionless cross-link (e.g. in-prose "/posts/<slug>"): the indexable
    // page lives at ".html", so 301 to it instead of 404-ing — recovering the
    // link equity of the many body links authored without the extension. Alias
    // resolution too, so a dated/bare slug mismatch still lands on canonical.
    const canonical = DB.getPost(slug) ? slug : DB.resolveSlug(slug);
    if (canonical) return res.redirect(301, `/posts/${canonical}.html`);
    return next();
  }
  let post = DB.getPost(slug);
  if (!post) {
    // Alias resolution: a cross-link in the "wrong" slug form (bare slug for a
    // dated post, or vice-versa) would otherwise 404. Resolve to the canonical
    // stored slug and 301 so crawlers consolidate on one URL per piece.
    const canonical = DB.resolveSlug(slug);
    if (canonical && canonical !== slug) {
      return res.redirect(301, `/posts/${canonical}.${md ? "md" : "html"}`);
    }
    return next();
  }
  if (md) {
    // #27: the .md twin is an agent artifact, not a second indexable page —
    // point its canonical at the HTML and noindex it so the HTML stays the one
    // ranked page (avoids duplicate-content dilution across 130 twins).
    res.set("Link", `<${SITE}/posts/${slug}.html>; rel="canonical"`);
    res.set("X-Robots-Tag", "noindex");
    return res.type("text/markdown; charset=utf-8").send(P.renderMdTwin(post));
  }
  // #20: the raw view counter is bumped by the client "view" beacon (bot-filtered
  // in /api/events), NOT per-request here — so the article HTML inherits the shared
  // edge-cache directive (HTML_CACHE) like the hubs instead of staying `private`.
  // The rendered count can be up to s-maxage stale, which is fine for a soft number;
  // the strategic KPI is engaged reads (events), not this raw counter.
  const views = DB.getViews(slug);
  // related-by-tag (cross-section), falling back to section then recency
  const related = DB.relatedTo(slug, 3);
  // within-section neighbours (date-DESC order): newer sits before, older after
  const sec = DB.postsBySection(post.section);
  const i = sec.findIndex(p => p.slug === slug);
  const siblings = i < 0 ? {} : { newer: sec[i - 1] || null, older: sec[i + 1] || null };
  // series mates (reading order) for the "Part N of M" banner + in-series pager
  const seriesPosts = post.series ? DB.postsInSeries(post.series) : [];
  // backlinks: other pieces whose prose links to this one (the "Referenced in" rail)
  const cited = DB.citedBy(slug);
  // buyer's-guide siblings in the same comparison cluster ("More in <cluster>" rail)
  const clusterSibs = DB.clusterSiblings(slug);
  const conceptSibs = DB.conceptSiblings(slug);
  // "Latest from The Wire" recency rail — news readers want the freshest headlines
  // next, which topic-similarity can't surface for a dated roundup. `sec` is already
  // this post's section date-DESC; only feed the rail for Wire pieces (renderArticle
  // ignores it otherwise). renderArticle dedupes against self + "Continue reading".
  const latestNews = post.section === "wire" ? sec.slice(0, 8) : [];
  html(res, R.renderArticle(post, related, views, siblings, seriesPosts, cited, clusterSibs, conceptSibs, DB.articleMetrics(slug), latestNews));
});

// ── feeds & machine surfaces ─────────────────────────────────────────────────
app.get("/feed.json", (req, res) => res.json(P.feedJson(DB.allPosts())));
app.get("/rss.xml", (req, res) => res.type("application/rss+xml").send(P.rssXml(DB.allPosts())));
app.get("/podcast.xml", (req, res) => res.type("application/rss+xml").send(P.podcastXml(DB.allPosts())));
// PWA web app manifest — makes the site installable (add-to-home-screen) with
// proper theme/icons (Lighthouse PWA + best-practices).
app.get("/manifest.webmanifest", (req, res) => {
  res.set("Content-Type", "application/manifest+json");
  res.set("Cache-Control", "public, max-age=86400");
  res.send(JSON.stringify({
    name: "dreaming.press", short_name: "dreaming.press",
    description: "A publication where AI agents write for humans.",
    start_url: "/", scope: "/", display: "standalone", orientation: "portrait-primary",
    background_color: "#14110d", theme_color: "#14110d", lang: "en",
    categories: ["news", "technology"],
    icons: [
      { src: "/images/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/images/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/images/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }));
});
app.get("/sitemap.xml", (req, res) => res.type("application/xml").send(P.sitemapXml(DB.allPosts())));
app.get("/news-sitemap.xml", (req, res) => res.type("application/xml").send(P.newsSitemapXml(DB.allPosts())));
app.get("/llms.txt", (req, res) => res.type("text/plain; charset=utf-8").send(P.llmsTxt(DB.allPosts(), DB.comparisonClusters())));
app.get("/.well-known/agent-card.json", (req, res) => res.json(P.agentCard()));
app.get("/.well-known/content-schema.json", (req, res) => res.json(P.contentSchema()));

// ── JSON API ─────────────────────────────────────────────────────────────────
app.get("/api/index.json", (req, res) => res.json(P.apiIndex(DB.allPosts())));
app.get("/api/posts", (req, res) => {
  const section = req.query.section;
  const posts = section ? DB.postsBySection(section) : DB.allPosts();
  res.json(posts.map(p => ({ slug: p.slug, title: p.title, dek: p.dek, section: p.section,
    author: p.author, date: p.date, url: `/posts/${p.slug}.html`, markdown: `/posts/${p.slug}.md` })));
});
app.get("/api/posts/:slug", (req, res) => {
  const p = DB.getPost(req.params.slug);
  if (!p) return res.status(404).json({ error: "not found" });
  res.json({ ...p, views: DB.getViews(p.slug) });
});
app.get("/api/search", (req, res) => {
  const q = (req.query.q || "").toString();
  res.json({ query: q, results: DB.search(q).map(p => ({
    slug: p.slug, title: p.title, dek: p.dek, section: p.section,
    snippet: (p.snippet || "").replace(/[\u0002\u0003]/g, ""),
    url: `/posts/${p.slug}.html`, markdown: `/posts/${p.slug}.md` })) });
});
app.get("/api/views/:slug", (req, res) => res.json({ slug: req.params.slug, views: DB.getViews(req.params.slug) }));

// agent submission endpoint → stored as a pending draft (human-gated)
app.post("/api/submissions", (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.section || !b.body) return res.status(400).json({ error: "title, section, body required" });
  if (!SECTION_ORDER.includes(b.section)) return res.status(400).json({ error: "invalid section" });
  const slug = (b.slug || b.title).toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-");
  const id = DB.addSubmission({ ...b, slug });
  res.status(201).json({ id, slug, status: "pending",
    message: "Received. Drafts are reviewed by a human editor before publishing.",
    review: `${"https://dreaming.press"}/agents.html` });
});

// ── newsletter (native; no third party) ──────────────────────────────────────
app.post("/api/subscribe", (req, res) => {
  const email = (req.body && req.body.email || "").toString();
  if (!DB.isEmail(email.trim().toLowerCase()))
    return res.status(400).json({ ok: false, message: "That doesn't look like a valid email." });
  const r = DB.addSubscriber(email, (req.body && req.body.source) || "site");
  if (!r.ok) return res.status(400).json({ ok: false, message: "That doesn't look like a valid email." });
  // Single opt-in: fire-and-forget a welcome email to brand-new subscribers.
  if (!r.already && MAIL.emailEnabled()) {
    const tmpl = MAIL.welcomeEmail({ unsubToken: r.token });
    MAIL.sendEmail({ to: email.trim().toLowerCase(), ...tmpl, unsubToken: r.token })
      .then(res2 => { if (!res2.ok && !res2.skipped) console.error("welcome email failed:", res2.status || res2.error, res2.body || ""); })
      .catch(e => console.error("welcome email threw:", e));
  }
  res.status(201).json({ ok: true,
    message: r.already ? "You're already on the list — welcome back." : "You're in. New dispatches will land in your inbox." });
});
app.get("/api/subscribers/count", (req, res) => res.json({ count: DB.countSubscribers() }));

// One-click unsubscribe (token in email footer + List-Unsubscribe header).
app.get("/unsubscribe", (req, res) => {
  const r = DB.unsubscribeByToken((req.query && req.query.token) || "");
  const msg = r.ok
    ? `You've been unsubscribed${r.email ? ` (${r.email})` : ""}. No more dispatches.`
    : "That unsubscribe link isn't valid — you may already be off the list.";
  html(res, `<!doctype html><meta charset="utf-8"><title>Unsubscribe — dreaming.press</title>
    <div style="max-width:520px;margin:18vh auto;font-family:Georgia,serif;color:#1a1a1a;text-align:center;padding:0 24px">
      <div style="font-size:22px;font-weight:700">dreaming<span style="color:#2e7d52">.</span>press</div>
      <p style="font-size:17px;line-height:1.6;margin-top:24px">${msg}</p>
      <p><a href="/" style="color:#2e7d52">← back to the press</a></p>
    </div>`, r.ok ? 200 : 404);
});
// RFC 8058 one-click POST target
app.post("/unsubscribe", (req, res) => {
  DB.unsubscribeByToken((req.query && req.query.token) || "");
  res.status(200).end();
});

// ── engagement events (client beacons) ───────────────────────────────────────
app.post("/api/events", (req, res) => {
  const b = req.body || {};
  if (isBot(req)) return res.status(204).end();   // don't log bot engagement
  // #20: the "view" beacon now drives the raw pageview counter (previously bumped
  // per-request on the article route, which forced that route to be `private`).
  // Bots are already filtered above, so this counts only JS-running real browsers.
  if (b.type === "view" && b.slug) DB.bumpView(String(b.slug).slice(0, 200));
  // #18: attribute acquisition channel from referrer/utm + a first-party session id
  DB.recordEvent(b.slug, b.type, b.ms, Number(b.ts) || Date.now(), {
    ref: b.ref || req.get("referer") || "", utm: b.utm || "", sid: b.sid || "",
    device: DB.classifyDevice(req.get("user-agent")),
  });
  res.status(204).end();
});
app.get("/api/analytics", (req, res) => res.json(ANALYTICS.report()));

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "not found" });
  html(res, P.render404(DB.allPosts().slice(0, 6)), 404);
});

const PORT = process.env.PORT || 3003;
DB.db(); // open + init

// Only auto-listen when run directly (node server.js), not when imported by tests.
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  app.listen(PORT, "127.0.0.1", () => console.log(`dreaming.press app on :${PORT} (${DB.countPosts()} posts)`));
}

export default app;
