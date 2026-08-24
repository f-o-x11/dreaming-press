// server.js — the dreaming.press web application (SSR + JSON API).
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { SITE, SECTION_ORDER, SECTIONS, AUTHORS } from "./lib/data.js";
import * as DB from "./lib/db.js";
import { resolveTool } from "./lib/tool-resolve.js";
import * as AS from "./lib/agent-surfaces.js";
import * as R from "./lib/render.js";
import { dpBundle, dpBundleHash } from "./lib/render.js";
import * as P from "./lib/pages.js";
import * as ANALYTICS from "./lib/analytics.js";
import * as MAIL from "./lib/email.js";
import { renderDashboard, renderCrawlers, renderDataset } from "./lib/dashboard.js";
import { buildFacts } from "./lib/facts.js";
import { buildClaims } from "./lib/claims.js";
import { agentToolsDataset } from "./lib/datasets.js";
import { findPermutation, indexablePermutations, isIndexable, permutationJson } from "./lib/permutations.js";
import { liveBadge, renderEmbed, stackCardSvg } from "./lib/embed.js";
import * as TR from "./lib/tools-render.js";
import * as SB from "./lib/stack-builder.js";
import { CATEGORIES } from "./lib/tools-data.js";
import { INDEXNOW_KEY } from "./scripts/indexnow.js";
import { handleMcp, mcpManifest, MCP_TOOLS } from "./lib/mcp.js";
import { isSafeWebhookUrl } from "./lib/agent-subs.js";
import { floorState, EDITION_UTC_HOUR } from "./lib/newsroom.js";

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

// CORS for the machine surface. Registered once over the read-only GET routes an
// agent may legitimately fetch from a browser context (feeds, manifests, public
// datasets) rather than sprinkled through handlers, where the next route added
// would silently miss it.
// Deliberately NOT applied to POST /api/events or POST /api/agents/subscribe:
// those mutate state, and a wildcard origin on a write endpoint invites any page
// on the internet to forge beacons or register webhooks in a reader's name.
const AGENT_READ_ROUTES = [
  "/feed.json", "/rss.xml", "/podcast.xml", "/llms.txt",
  "/api/index.json", "/api/tools.json", "/api/agent-hub.json", "/api/stack.json",
  "/api/crawlers.json", "/api/crawl-yield.json", "/api/facts.json", "/api/claims.json", "/api/analytics", "/data/agent-tools.json",
];
// Empty-corpus guard. If a rebuild ever leaves the posts table empty, every page
// still renders 200 with nothing in it — which is worse than an error, because
// crawlers cache an empty page and readers see a working site with no content.
// A 503 with Retry-After is the honest answer: temporarily unavailable, come back.
// Cheap: one cached count, re-checked at most once a second.
let _emptyCheckAt = 0, _emptyCorpus = false;
app.use((req, res, next) => {
  if (req.path.startsWith("/api/") || req.path === "/healthz") return next();
  const now = Date.now();
  if (now - _emptyCheckAt > 1000) {
    _emptyCheckAt = now;
    try { _emptyCorpus = DB.countPosts() === 0; } catch { _emptyCorpus = false; }
  }
  if (!_emptyCorpus) return next();
  res.status(503).set("Retry-After", "120").type("text/plain")
    .send("dreaming.press is rebuilding its index. Back in a moment.");
});

app.use(AGENT_READ_ROUTES, (req, res, next) => {
  // HEAD belongs here with GET: it is a safe read, clients use it to check size
  // and freshness before pulling a feed, and omitting it made the headers look
  // absent to any `curl -I` probe.
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Max-Age": "86400",
  });
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

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
  // images-ai/ is the durable overlay for server-generated illustrative covers
  // (untracked, survives the deploy's git reset) — it wins over the committed art.
  const roots = [path.join(REPO, "images-ai"), path.join(REPO, "images")];
  for (const [type, ext] of [["image/avif", ".avif"], ["image/webp", ".webp"], ["image/png", ".png"]]) {
    if (ext !== ".png" && !accept.includes(type)) continue;
    for (const root of roots) {
      const alt = path.join(root, m[1] + ext);
      const isOverlay = root.endsWith("images-ai");
      if ((isOverlay || ext !== ".png") && fs.existsSync(alt)) {
        res.type(type);
        res.set("Cache-Control", COVER_CACHE);
        res.set("Vary", "Accept");
        return res.sendFile(alt);
      }
    }
  }
  // Content ships ahead of the server's ai-covers.js pass (which writes the real
  // cover into images-ai/ and commits it on the next deploy). In that handoff
  // window a brand-new post has no cover file yet — rather than 404 the hero,
  // og:image, and card thumbnails on the newest, most-promoted piece, serve a
  // brand placeholder. Kept on a SHORT cache (Vary: Accept) so the real cover,
  // which wins in the negotiation above, takes over within minutes of landing.
  if (!fs.existsSync(path.join(REPO, "images", m[1] + ".png"))) {
    res.type("image/svg+xml");
    res.set("Cache-Control", "public, max-age=120");
    res.set("Vary", "Accept");
    return res.sendFile(path.join(REPO, "static", "cover-placeholder.svg"));
  }
  next();
});
app.use("/images", express.static(path.join(REPO, "images"), coverOpts));
// audio-ai/ is the durable overlay for server-generated narration (untracked,
// survives the deploy's git reset) — it wins over the committed audio/.
app.use("/audio", express.static(path.join(REPO, "audio-ai"), { maxAge: "1d", index: false, fallthrough: true }));
app.use("/audio", express.static(path.join(REPO, "audio"), { maxAge: "1d", index: false }));
app.use("/static", express.static(path.join(REPO, "static"), staticOpts));
for (const f of ["style.css", "style.min.css", "rosalinda-avatar-new.jpg", "abe-avatar.jpg",
  "robots.txt", "BingSiteAuth.xml"]) {
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
// The shared client bundle. Content-hashed in the URL, so it can be cached for a
// year and still never serve stale code — the hash changes when the code does.
app.get("/dp.js", (req, res) => {
  const hash = dpBundleHash();
  res.set({
    "Content-Type": "application/javascript; charset=utf-8",
    "Cache-Control": req.query.v === hash ? "public, max-age=31536000, immutable" : "public, max-age=300",
    "ETag": `W/"${hash}"`,
  });
  if (req.get("if-none-match") === `W/"${hash}"`) return res.status(304).end();
  res.send(dpBundle());
});
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
app.get("/", (req, res) => {
  const posts = DB.attachMetrics(DB.allPosts());
  // per-story dwell metrics for the digest/how-tos (top slice only — cheap)
  const metrics = {};
  for (const p of posts.slice(0, 30)) metrics[p.slug] = DB.articleMetrics(p.slug);
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const playsToday = DB.db().prepare("SELECT COUNT(*) c FROM events WHERE type='audio_play' AND ts >= ?").get(dayStart.getTime())?.c || 0;
  html(res, R.renderHome(posts, DB.totalViews(), ANALYTICS.mostRead(), DB.siteStats(),
    { metrics, tools: DB.allTools(), playsToday }));
});

// ── sections ─────────────────────────────────────────────────────────────────
for (const sk of SECTION_ORDER) {
  app.get(`/${sk}.html`, (req, res) => html(res, R.renderSection(sk, DB.attachMetrics(DB.postsBySection(sk)), parseInt(req.query.page) || 1, 30, DB.siteStats())));
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
app.get("/subscribe", (req, res) => html(res, P.renderSubscribe(DB.countSubscribers(), DB.allPosts().slice(0, 3))));
// Apps — the app-highlights shelf (redesign nav): pieces reviewing concrete
// web/iOS apps for founders (tool-highlight-* slugs and app-tagged stack posts).
app.get("/apps", (req, res) => {
  const posts = DB.attachMetrics(DB.allPosts().filter(p =>
    /^tool-highlight-|-app-highlight|^app-highlight-/.test(p.slug) ||
    (p.section === "stack" && /\bapp\b|\bapps\b/i.test(p.title))));
  const pool = posts.length ? posts : DB.attachMetrics(DB.postsBySection("stack"));
  html(res, R.renderApps(pool, parseInt(req.query.page) || 1));
});
app.get("/newsroom", (req, res) => html(res, P.renderNewsroom(ANALYTICS.report(), DB.channelBreakdown(), floorState())));
// Live newsroom-floor state — the /newsroom page polls this to animate the desks.
app.get("/api/newsroom.json", (req, res) => res.set("Cache-Control", "public, max-age=15").json(floorState()));
// Named ranges rather than a raw day count, because "YTD" and "all time" are not
// fixed numbers of days and asking a reader to compute one is silly. `days=` is
// still honoured so existing links and the JSON endpoint keep working.
function resolveRange(q) {
  const key = String(q.range || "").toLowerCase();
  const firstPost = DB.allPosts().map(p => p.date).filter(Boolean).sort()[0];
  const daysSince = (iso) => Math.max(1, Math.ceil((Date.now() - Date.parse(iso + "T00:00:00Z")) / 86400000));
  const jan1 = `${new Date().getUTCFullYear()}-01-01`;
  if (key === "7d") return { days: 7, label: "Last 7 days", range: "7d" };
  if (key === "30d") return { days: 30, label: "Last 30 days", range: "30d" };
  if (key === "ytd") return { days: daysSince(jan1), label: "Year to date", range: "ytd" };
  if (key === "all") return { days: firstPost ? daysSince(firstPost) : 3650, label: "All time", range: "all" };
  // Explicit ?days= keeps working; the cap is now the site's own age rather than
  // 365, so "all time" is not silently truncated as the archive grows.
  const raw = parseInt(q.days);
  if (raw > 0) { const d = Math.min(3650, raw); return { days: d, label: `Last ${d} days`, range: "" }; }
  return { days: 30, label: "Last 30 days", range: "30d" };
}

app.get("/dashboard", (req, res) => {
  const { days, label: rangeLabel, range } = resolveRange(req.query);
  html(res, renderDashboard({
    days, rangeLabel, range, totalPosts: DB.countPosts(),
    funnel: DB.funnel({ days }),
    // Same window, shifted back one full period — the basis for every delta.
    prevFunnel: DB.funnel({ days, offsetDays: days }),
    series: DB.dailySeries({ days }),
    channels: DB.channelBreakdown({ days }), referrers: DB.topReferrers({ days }),
    assistants: DB.assistantBreakdown({ days }),
    content: DB.topContent({ days }), devices: DB.deviceBreakdown({ days }),
    sections: DB.sectionBreakdown({ days }),
    pages: DB.topPages({ days, limit: 15 }),
    nav: DB.navBySurface({ days, limit: 12 }),
    quality: DB.engagementByChannel({ days }),
    audience: {
      // confirmedSubscribers() returns the ROWS, not a count.
      subscribers: DB.countSubscribers(), confirmed: DB.confirmedSubscribers().length,
      agents: DB.countAgentSubs(),
    },
    // crawlers panel is now IP-verified (crawler-stats.js checks each hit against
    // vendors' published ranges), so only confirmed-real crawls hit the headline.
    crawlers: readCrawlers(),
    realtime: DB.realtime({ minutes: 60 }),
  }));
});
// /crawlers — the crawl-to-click ledger as a permanent, linkable, machine-readable
// page. It was a 404 while the data behind it was the site's most distinctive
// asset: the join between IP-verified crawler fetches and real referred sessions.
const readCrawlYield = () => {
  try { return JSON.parse(fs.readFileSync(path.join(REPO, "analytics", "crawl-yield.json"), "utf8")); }
  catch { return null; }
};
// /data/agent-tools — the live dataset. A page whose numbers move daily is one an
// answer engine has to come back for.
app.get("/data/agent-tools", (req, res) => {
  const days = Math.min(180, Math.max(1, parseInt(req.query.days) || 30));
  html(res, renderDataset(agentToolsDataset({ days, limit: 0 })));
});
app.get("/data/agent-tools.json", (req, res) => {
  const days = Math.min(180, Math.max(1, parseInt(req.query.days) || 30));
  res.set("Cache-Control", "public, max-age=1800").json(agentToolsDataset({ days, limit: 0 }));
});
app.get("/crawlers", (req, res) => html(res, renderCrawlers(readCrawlYield(), readCrawlers())));
app.get("/api/crawl-yield.json", (req, res) => {
  const y = readCrawlYield();
  if (!y) return res.status(404).json({ error: "crawl-yield not generated yet" });
  res.set("Cache-Control", "public, max-age=1800").json(y);
});
app.get("/weekly", (req, res) => html(res, R.renderWeekly(DB.allPosts())));
// Global Tech News — the dated daily digest (design/Global-Tech-News.dc.html):
// today's wire, ranked by real engaged reads, for the answer engines that are our
// front door. Distinct from /wire.html (the full section archive).
app.get("/global-tech-news", (req, res) => html(res, R.renderGlobalTechNews(DB.attachMetrics(DB.postsBySection("wire")), DB.siteStats())));

// ── The Stack: data-backed tool pages (#10/#12/#16/#22/#13) ───────────────────
app.get("/tools", (req, res) => html(res, TR.renderToolsIndex(DB.allTools())));
app.get("/build", (req, res) => html(res, TR.renderStackBuilder(DB.allTools())));
app.get("/stacks", (req, res) => html(res, TR.renderStackGallery(DB.allTools())));
// A three-layer permutation URL (/stacks/a+b+c). Checked BEFORE the curated
// :slug route so a combination key never collides with a curated stack name.
app.get("/stacks/:key.json", (req, res, next) => {
  if (!String(req.params.key).includes("+")) return next();
  const p = findPermutation(req.params.key, DB.allTools());
  if (!p) return res.status(404).json({ error: "no such stack combination" });
  res.set("Cache-Control", "public, max-age=1800").json(permutationJson(p));
});
app.get("/stacks/:key", (req, res, next) => {
  if (!String(req.params.key).includes("+")) return next();   // curated slug — fall through
  const p = findPermutation(req.params.key, DB.allTools());
  if (!p) return next();
  html(res, TR.renderPermutation(p, { indexable: isIndexable(p.key, DB.allTools()) }));
});
app.get("/stacks/:slug", (req, res, next) => {
  const s = TR.getStack(req.params.slug);
  if (!s) return next();
  html(res, TR.renderStackPage(s, DB.allTools()));
});
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
app.get("/api/tools.csv", (req, res) => res.type("text/csv; charset=utf-8")
  .set("Cache-Control", "public, max-age=1800")
  .set("Content-Disposition", 'inline; filename="dreaming-press-ai-tools.csv"')
  .send(TR.toolsCsv(DB.allTools())));
// per-tool machine record (referenced from each /stack/<slug> "agent-readable" line)
app.get("/api/tools/:slug.json", (req, res) => {
  const t = DB.getTool(req.params.slug);
  if (!t) return res.status(404).json({ error: "not found" });
  res.set("Cache-Control", "public, max-age=1800");
  res.json(t);
});
// Citable original-data endpoint (growth plan #8): real, computed facts about the
// AI-tooling landscape + this publication. CC-BY so answer engines / other sites
// can quote the numbers with attribution — original data earns citations + links.
app.get("/api/facts.json", (req, res) => {
  res.set("Cache-Control", "public, max-age=1800");
  res.json(buildFacts());
});
app.get("/facts", (req, res) => html(res, R.renderFacts(buildFacts())));
// embeddable live-stats badge (enhancement #19) — every embed is a backlink.
app.get("/embed/stats.svg", (req, res) => {
  res.type("image/svg+xml").set("Cache-Control", "public, max-age=600")
    .set("Access-Control-Allow-Origin", "*").send(liveBadge(DB.siteStats(), DB.countPosts()));
});
app.get("/embed", (req, res) => html(res, renderEmbed(R.head, R.masthead, R.footer, liveBadge(DB.siteStats(), DB.countPosts()))));
// Embeddable "my AI agent stack" card — the Stack Explorer backlink loop.
app.get("/embed/stack.svg", (req, res) => {
  const { sel, pref } = SB.parseStackQuery(req.query);
  const { items } = SB.resolveStack(sel, pref, DB.allTools());
  res.type("image/svg+xml; charset=utf-8").set("Cache-Control", "public, max-age=3600")
    .set("Access-Control-Allow-Origin", "*").send(stackCardSvg(items));
});
app.get("/best", (req, res) => html(res, TR.renderBestIndex(DB.allTools())));
app.get("/best/:cat", (req, res, next) => {
  const cat = String(req.params.cat || "").toLowerCase();
  if (!CATEGORIES[cat]) return next();
  const tools = DB.toolsByCategory(cat);
  if (!tools.length) return next();
  html(res, TR.renderBest(cat, tools));
});
app.get("/compare", (req, res) => html(res, TR.renderCompareIndex(DB.allTools())));
app.get("/compare/:pair", (req, res, next) => {
  const m = /^(.+)-vs-(.+)$/.exec(String(req.params.pair || ""));
  if (!m) return next();
  const a = DB.getTool(m[1]), b = DB.getTool(m[2]);
  if (!a || !b) return next();
  html(res, TR.renderCompare(a, b));
});
// Agents guess this URL shape from npm package names in article prose
// (/stack/@upstash/mcp-server and friends — 152 logged 404s). Two segments are
// accepted so the scoped form reaches the resolver at all; Express would
// otherwise never match it.
app.get("/stack/:scope/:name", (req, res, next) => {
  const raw = `${req.params.scope}/${req.params.name}`;
  const { match } = resolveTool(raw);
  if (match) return res.redirect(301, `/stack/${match.slug}`);
  return next();
});
app.get("/stack/:slug", (req, res, next) => {
  const t = DB.getTool(String(req.params.slug || ""));
  if (!t) {
    // A miss gets one resolution attempt before falling through to 404.
    const { match } = resolveTool(String(req.params.slug || ""));
    if (match) return res.redirect(301, `/stack/${match.slug}`);
    return next();
  }
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
// Move 9 — /founders is now a first-class hub. The old cluster URL 301s to it so
// existing links + the previous nav target don't 404. Registered before the
// /comparisons/:cluster param route so the redirect wins.
app.get("/founders", (req, res) => html(res, R.renderFoundersHub(
  DB.attachMetrics(DB.allPosts()), DB.comparisonClusterBySlug("ai-for-founders"), DB.countSubscribers())));
app.get("/comparisons/ai-for-founders", (req, res) => res.redirect(301, "/founders"));
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
  // Freshness rail feed — the freshest sibling a reader wants next, which topic-
  // similarity can't surface for a dated roundup (Wire) or a specific build (Stack).
  // `sec` is already this post's section date-DESC; feed it for the two freshness-
  // driven desks (renderArticle labels + gates by section, ignoring it otherwise).
  // renderArticle dedupes against self + "Continue reading".
  const latestNews = (post.section === "wire" || post.section === "stack") ? sec.slice(0, 8) : [];
  // Weekly-edition neighbours: the "The Founder's Wire, Week of …" roundups are the
  // desk's top pieces by engaged reads, but each is a standalone post with no
  // `series:` field — so a reader on one edition had no path to the adjacent weeks.
  // Detect the house edition pattern within the (already-loaded, date-DESC) section
  // list and hand renderArticle the neighbouring editions for a chronological pager.
  // Skipped for explicit-series posts so a piece never renders two pagers.
  let editionSibs = null;
  if (!post.series && i >= 0 && /Founder.?s\s+Wire,\s+Week of/i.test(post.title || "")) {
    const eds = sec.filter(p => /Founder.?s\s+Wire,\s+Week of/i.test(p.title || ""));
    const ei = eds.findIndex(p => p.slug === slug);
    if (ei >= 0) editionSibs = { newer: eds[ei - 1] || null, older: eds[ei + 1] || null };
  }
  html(res, R.renderArticle(post, related, views, siblings, seriesPosts, cited, clusterSibs, conceptSibs, DB.articleMetrics(slug), latestNews, DB.siteStats(), editionSibs));
});

// ── feeds & machine surfaces ─────────────────────────────────────────────────
// JSON feed — supports agent polling: ?since=<ISO8601|YYYY-MM-DD> returns only
// items published after that instant, ?section= filters a desk, ?limit= caps.
app.get("/feed.json", (req, res) => {
  let posts = DB.allPosts();
  const section = SECTIONS[req.query.section] ? String(req.query.section) : null;
  if (section) posts = posts.filter((p) => p.section === section);
  const since = req.query.since ? Date.parse(String(req.query.since)) : NaN;
  if (!Number.isNaN(since)) posts = posts.filter((p) => Date.parse(`${p.date}T${String(EDITION_UTC_HOUR).padStart(2, "0")}:00:00Z`) > since);
  // Default the page size. Uncapped this returned all 1,838 items / 1.46MB on
  // every poll — for a cursor feed whose whole purpose is "what changed since
  // X?", that is a denial of usefulness to exactly the agents it was built for.
  // Explicit ?limit= still wins, up to 500.
  const limit = req.query.limit ? Math.min(500, Math.max(1, parseInt(req.query.limit) || 100)) : 100;
  const total = posts.length;
  posts = posts.slice(0, limit);
  res.set("Cache-Control", "public, max-age=300");
  res.json({ ...P.feedJson(posts), _limit: limit, _returned: posts.length, _matched: total });
});
// /api/claims.json — the corpus as atomic, addressable, dated claims. Built for
// the retrieval bots that fetch a page because someone asked a question: each
// record deep-links to the exact anchor that renders it, so a citation can be
// checked rather than trusted.
app.get("/api/claims.json", (req, res) => {
  const limit = Math.min(2000, Math.max(1, parseInt(req.query.limit) || 200));
  res.set("Cache-Control", "public, max-age=900").json(buildClaims({
    limit,
    since: /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.since || "")) ? String(req.query.since) : "",
    type: ["figure", "qa", "comparison"].includes(String(req.query.type)) ? String(req.query.type) : "",
    q: String(req.query.q || "").slice(0, 80),
  }));
});
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
    background_color: "#141311", theme_color: "#141311", lang: "en",
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
app.get("/llms.txt", (req, res) => res.type("text/plain; charset=utf-8").send(P.llmsTxt(DB.attachMetrics(DB.allPosts()), DB.comparisonClusters())));
app.get("/llms-full.txt", (req, res) =>
  res.type("text/plain; charset=utf-8").send(AS.llmsFullTxt(DB.allPosts())));
app.get("/openapi.json", (req, res) => res.json(AS.openApiSpec()));

// Agents POST to "/" to probe for a JSON-RPC endpoint — 86 logged POSTs from
// AgenstryBot, KunlunYaochi-Probe, ChatGPT-User and Perplexity, every one
// answered with a 7KB HTML 404 page. (GET / has never 404ed: 356 GETs from those
// same two assistants all returned 200. The homepage was never broken.)
//
// This site HAS the endpoint they are looking for, at /mcp. A 404 says "nothing
// here"; 405 with an Allow header says "wrong method, and here is the right
// door". When the probe is JSON-RPC-shaped, the reply is JSON-RPC-shaped too —
// error -32601 with the endpoint in `data` — because a client speaking JSON-RPC
// can parse that and retry, whereas prose is a dead end.
app.post("/", (req, res) => {
  const b = req.body;
  const isRpc = b && typeof b === "object" && (b.jsonrpc === "2.0" || typeof b.method === "string");
  res.set("Allow", "GET, HEAD");
  res.set("Link", '<https://dreaming.press/mcp>; rel="service-desc"');
  if (isRpc) {
    return res.status(405).json({
      jsonrpc: "2.0",
      id: b.id ?? null,
      error: { code: -32601, message: "This is the site root, not the RPC endpoint.",
        data: { mcp_endpoint: `${SITE}/mcp`, manifest: `${SITE}/.well-known/mcp.json` } },
    });
  }
  res.status(405).json({
    error: "method_not_allowed",
    message: "GET / returns the homepage. POST is not accepted here.",
    looking_for_an_api: {
      mcp_endpoint: `${SITE}/mcp`,
      mcp_manifest: `${SITE}/.well-known/mcp.json`,
      openapi: `${SITE}/openapi.json`,
      full_index: `${SITE}/llms-full.txt`,
    },
  });
});
// ads.txt is requested by ad/verification crawlers (39 logged 404s). This site
// sells no ads, and the IAB spec treats an empty authorised-sellers list as the
// explicit statement of exactly that — which is better than a 404, because a 404
// only says "we did not answer".
app.get("/ads.txt", (req, res) =>
  res.type("text/plain; charset=utf-8").send("# dreaming.press sells no advertising and authorises no sellers.\n"));
app.get("/.well-known/agent-card.json", (req, res) => res.json(P.agentCard()));
// agents.txt — a machine-readable welcome for AI agents/answer engines (GEO).
app.get(["/.well-known/agents.txt", "/agents.txt"], (req, res) => {
  const p = path.join(REPO, ".well-known", "agents.txt");
  if (fs.existsSync(p)) res.type("text/plain").set("Cache-Control", "public, max-age=3600").sendFile(p);
  else res.status(404).end();
});
app.get("/.well-known/content-schema.json", (req, res) => res.json(P.contentSchema()));

// ── Model Context Protocol: a read-only MCP server so any AI agent/client can
// query the corpus directly (search + read articles, list tools, get facts).
// Streamable-HTTP transport: POST one JSON-RPC 2.0 message (or a batch). GET
// returns the discovery manifest. GEO council #24.
app.get("/.well-known/mcp.json", (req, res) => res.set("Cache-Control", "public, max-age=3600").json(mcpManifest()));
app.get("/mcp", (req, res) => {
  // Streamable HTTP says a GET carrying `Accept: text/event-stream` is a request
  // to OPEN AN SSE STREAM, not to fetch a document. Answering it with 200
  // application/json is the worst of both: a compliant client sees success and
  // then waits forever for frames that will never come. This server has no
  // server-initiated messages to push, so the honest answer is 405 — "I do not
  // offer that", which clients handle — while a plain GET keeps returning the
  // manifest for humans and simple probes.
  if (/text\/event-stream/i.test(req.get("accept") || "")) {
    return res.status(405).set("Allow", "POST").json({
      error: "SSE streaming is not supported; POST JSON-RPC to /mcp instead.",
    });
  }
  res.set("Cache-Control", "public, max-age=3600").json(mcpManifest());
});
app.post("/mcp", (req, res) => {
  const body = req.body;
  if (Array.isArray(body)) { // JSON-RPC batch
    const out = body.map(handleMcp).filter((r) => r !== null);
    return out.length ? res.json(out) : res.status(202).end();
  }
  const r = handleMcp(body);
  return r === null ? res.status(202).end() : res.json(r);
});

// ── JSON API ─────────────────────────────────────────────────────────────────
app.get("/api/index.json", (req, res) => res.json(P.apiIndex(DB.allPosts())));
app.get("/api/articles.json", (req, res) => {
  const section = SECTIONS[req.query.section] ? req.query.section : null;
  const limit = Math.min(2000, Math.max(1, parseInt(req.query.limit) || 2000));
  res.set("Cache-Control", "public, max-age=1800").json(P.apiArticles(DB.allPosts(), { section, limit }));
});
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

// ── for AI agents: pull everything + subscribe programmatically ───────────────
// One manifest of every data endpoint + subscribe options — an agent hits this
// once and discovers the whole surface.
app.get("/api/agent-hub.json", (req, res) => {
  res.set("Cache-Control", "public, max-age=600").json(
    P.agentHub({ posts: DB.allPosts().length, tools: DB.allTools().length, agentSubs: DB.countAgentSubs() }));
});
// GET = docs (how to subscribe). POST = register.
app.get("/api/agents/subscribe", (req, res) => res.json({
  how: "POST JSON to this URL to register. Provide a webhook (POSTed on publish), an email, or both. No auth. Or just poll /feed.json?since=<ISO8601>.",
  body: { webhook: "https URL (public)", email: "you@example.com", sections: ["wire", "stack"] },
  poll: `${SITE}/feed.json?since=<ISO8601>`, hub: `${SITE}/api/agent-hub.json`,
  example: `curl -X POST ${SITE}/api/agents/subscribe -H 'content-type: application/json' -d '{"webhook":"https://your.app/hook"}'`,
}));
app.post("/api/agents/subscribe", (req, res) => {
  const b = req.body || {};
  const webhook = (b.webhook || b.url || "").toString().trim();
  const email = (b.email || "").toString().trim().toLowerCase();
  const sections = Array.isArray(b.sections) ? b.sections.filter((s) => SECTIONS[s]) : null;
  if (!webhook && !email) return res.status(400).json({ ok: false, error: "provide a webhook URL, an email, or both", poll: `${SITE}/feed.json?since=<ISO8601>` });
  const out = { ok: true, poll: `${SITE}/feed.json?since=${new Date().toISOString()}`, hub: `${SITE}/api/agent-hub.json` };
  if (webhook) {
    if (!isSafeWebhookUrl(webhook)) return res.status(400).json({ ok: false, error: "webhook must be a public http(s) URL (no localhost/private hosts)" });
    const r = DB.addAgentSub({ kind: "webhook", endpoint: webhook, sections });
    out.webhook = { id: r.id, token: r.token, already: r.already, unsubscribe: `${SITE}/api/agents/unsubscribe`,
      note: "We POST { type, items: [...] } here when new posts publish. Keep the token to unsubscribe." };
  }
  if (email) {
    if (!DB.isEmail(email)) return res.status(400).json({ ok: false, error: "invalid email" });
    const r = DB.addSubscriber(email, "agent");
    DB.addAgentSub({ kind: "email", endpoint: email, sections });
    out.email = { subscribed: r.ok, already: r.already };
  }
  res.status(201).json(out);
});
app.post("/api/agents/unsubscribe", (req, res) => {
  const b = req.body || {};
  const r = DB.removeAgentSub((b.id || "").toString(), (b.token || "").toString());
  res.status(r.ok ? 200 : 404).json({ ok: r.ok, message: r.ok ? "unsubscribed" : "no matching subscription (check id + token)" });
});

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
  // `page:`-prefixed keys are route families (from pageBeacon), not posts. They
  // must not reach bumpView, which writes to the posts table — a page view would
  // otherwise silently create or inflate a row for a slug that is not an article.
  const isPageKey = typeof b.slug === "string" && b.slug.startsWith("page:");
  if (b.type === "view" && b.slug && !isPageKey) DB.bumpView(String(b.slug).slice(0, 200));
  // #18: attribute acquisition channel from referrer/utm + a first-party session id
  // A `nav` event carries its SURFACE in `ref`, not a referrer. Passing an
  // explicit channel stops classifyChannel() from reading that surface name as a
  // referring host and inventing a traffic source that does not exist.
  const isNav = b.type === "nav";
  DB.recordEvent(b.slug, b.type, b.ms, Number(b.ts) || Date.now(), {
    ...(isNav ? { channel: "internal-nav" } : {}),
    ref: b.ref || req.get("referer") || "", utm: b.utm || "", sid: b.sid || "",
    device: DB.classifyDevice(req.get("user-agent")),
  });
  res.status(204).end();
});
app.get("/api/analytics", (req, res) => res.json(ANALYTICS.report()));
// Agent Stack Explorer as data: an agent can request a recommended stack and act
// on it. ?framework=langgraph&memory=none&pref=oss → resolved stack JSON.
app.get("/api/stack.json", (req, res) => {
  const { sel, pref } = SB.parseStackQuery(req.query);
  const out = SB.stackJson(sel, pref, DB.allTools());
  out.generated = new Date().toISOString();
  out.explorer = `${SITE}/build`;
  res.set("Cache-Control", "public, max-age=1800").json(out);
});
// AI-crawler activity from nginx logs (written by scripts/crawler-stats.js in the
// deploy, committed back in analytics/). Cached in-process, refreshed by mtime.
let _crawlerCache = { mtime: 0, data: null };
function readCrawlers() {
  try {
    const p = path.join(REPO, "analytics", "crawlers.json");
    const m = fs.statSync(p).mtimeMs;
    if (m !== _crawlerCache.mtime) _crawlerCache = { mtime: m, data: JSON.parse(fs.readFileSync(p, "utf8")) };
    return _crawlerCache.data;
  } catch { return null; }
}
app.get("/api/crawlers.json", (req, res) => {
  const c = readCrawlers();
  if (!c) return res.status(404).json({ error: "crawler stats not generated yet" });
  res.set("Cache-Control", "public, max-age=1800").json({
    method: "AI/search-engine hits are IP-verified against each vendor's official published crawler ranges (OpenAI, Google, Bing, Perplexity). Bots whose owners publish no IP list carry verifiable:false and are excluded from verifiedAiHits.",
    ...c,
  });
});

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
