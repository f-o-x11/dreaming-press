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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));

const html = (res, body, status = 200) =>
  res.status(status).type("html").send(body);
const noStore = { etag: false };

// Crawlers, link unfurlers, and our own test/crawl tooling must NOT inflate the
// view counter — only real browsers count. (Real engagement = client beacons.)
const BOT_UA = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|preview|curl|wget|python-requests|node-fetch|go-http|okhttp|axios|libwww|headlesschrome|puppeteer|playwright|phantomjs|lighthouse|gptbot|claudebot|claude-web|anthropic|ccbot|perplexitybot|bytespider|ahrefs|semrush|dotbot|mj12bot|dataforseo|applebot|yandex|duckduckbot/i;
const isBot = (req) => { const ua = req.get("user-agent") || ""; return !ua || BOT_UA.test(ua); };

// ── static assets (curated; never blanket-serve the repo) ────────────────────
const staticOpts = { maxAge: "1h", index: false };
app.use("/images", express.static(path.join(REPO, "images"), staticOpts));
app.use("/audio", express.static(path.join(REPO, "audio"), { maxAge: "1d", index: false }));
app.use("/static", express.static(path.join(REPO, "static"), staticOpts));
for (const f of ["style.css", "style.min.css", "rosalinda-avatar-new.jpg", "abe-avatar.jpg",
  "favicon.ico", "robots.txt"]) {
  app.get(`/${f}`, (req, res) => {
    const p = path.join(REPO, f);
    if (fs.existsSync(p)) res.sendFile(p); else res.status(404).end();
  });
}
app.get("/dp", (req, res) => {
  const p = path.join(REPO, "dp");
  if (!fs.existsSync(p)) return res.status(404).end();
  res.type("text/plain").send(fs.readFileSync(p, "utf8"));
});

// ── health ───────────────────────────────────────────────────────────────────
app.get("/healthz", (req, res) =>
  res.json({ ok: true, posts: DB.countPosts(), views: DB.totalViews() }));

// ── home ─────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => html(res, R.renderHome(DB.allPosts(), DB.totalViews(), ANALYTICS.mostRead())));

// ── sections ─────────────────────────────────────────────────────────────────
for (const sk of SECTION_ORDER) {
  app.get(`/${sk}.html`, (req, res) => html(res, R.renderSection(sk, DB.postsBySection(sk))));
  // per-desk feeds so readers (and agents) can subscribe to one section
  const fmeta = () => ({ title: `dreaming.press — ${SECTIONS[sk].name}`, description: SECTIONS[sk].tagline });
  app.get(`/${sk}.xml`, (req, res) => res.type("application/rss+xml")
    .send(P.rssXml(DB.postsBySection(sk), { ...fmeta(), link: `${SITE}/${sk}.html` })));
  app.get(`/${sk}.json`, (req, res) => res.json(
    P.feedJson(DB.postsBySection(sk), { ...fmeta(), homeUrl: `${SITE}/${sk}.html`, feedUrl: `${SITE}/${sk}.json` })));
}

// ── static-ish pages ─────────────────────────────────────────────────────────
app.get("/agents.html", (req, res) => html(res, P.renderAgents()));
app.get("/about.html", (req, res) => html(res, P.renderAbout()));
app.get("/submit.html", (req, res) => html(res, P.renderSubmit()));
app.get("/newsroom", (req, res) => html(res, P.renderNewsroom(ANALYTICS.report())));
app.get("/weekly", (req, res) => html(res, R.renderWeekly(DB.allPosts())));

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
  html(res, R.renderTag(tag, posts));
});

// ── authors (byline archives) ─────────────────────────────────────────────────
app.get("/saved", (req, res) => html(res, R.renderSaved()));
app.get("/authors", (req, res) => html(res, R.renderAuthors(DB.authorCounts())));
app.get("/authors/:id", (req, res, next) => {
  const id = (req.params.id || "").toString();
  if (!AUTHORS[id]) return next();             // unknown author → 404
  html(res, R.renderAuthor(id, DB.postsByAuthor(id)));
});

// ── articles + markdown twins ────────────────────────────────────────────────
app.get("/posts/:file", (req, res, next) => {
  const file = req.params.file;
  const md = file.endsWith(".md");
  const slug = file.replace(/\.(html|md)$/, "");
  if (!/\.(html|md)$/.test(file)) return next();
  const post = DB.getPost(slug);
  if (!post) return next();
  if (md) return res.type("text/markdown; charset=utf-8").send(P.renderMdTwin(post));
  const views = isBot(req) ? DB.getViews(slug) : DB.bumpView(slug);
  // related-by-tag (cross-section), falling back to section then recency
  const related = DB.relatedTo(slug, 3);
  // within-section neighbours (date-DESC order): newer sits before, older after
  const sec = DB.postsBySection(post.section);
  const i = sec.findIndex(p => p.slug === slug);
  const siblings = i < 0 ? {} : { newer: sec[i - 1] || null, older: sec[i + 1] || null };
  html(res, R.renderArticle(post, related, views, siblings));
});

// ── feeds & machine surfaces ─────────────────────────────────────────────────
app.get("/feed.json", (req, res) => res.json(P.feedJson(DB.allPosts())));
app.get("/rss.xml", (req, res) => res.type("application/rss+xml").send(P.rssXml(DB.allPosts())));
app.get("/sitemap.xml", (req, res) => res.type("application/xml").send(P.sitemapXml(DB.allPosts())));
app.get("/llms.txt", (req, res) => res.type("text/plain; charset=utf-8").send(P.llmsTxt(DB.allPosts())));
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
  DB.recordEvent(b.slug, b.type, b.ms, Number(b.ts) || Date.now());
  res.status(204).end();
});
app.get("/api/analytics", (req, res) => res.json(ANALYTICS.report()));

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "not found" });
  html(res, P.render404(), 404);
});

const PORT = process.env.PORT || 3003;
DB.db(); // open + init

// Only auto-listen when run directly (node server.js), not when imported by tests.
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  app.listen(PORT, "127.0.0.1", () => console.log(`dreaming.press app on :${PORT} (${DB.countPosts()} posts)`));
}

export default app;
