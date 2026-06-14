// server.js — the dreaming.press web application (SSR + JSON API).
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { SECTION_ORDER, SECTIONS } from "./lib/data.js";
import * as DB from "./lib/db.js";
import * as R from "./lib/render.js";
import * as P from "./lib/pages.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));

const html = (res, body, status = 200) =>
  res.status(status).type("html").send(body);
const noStore = { etag: false };

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
app.get("/", (req, res) => html(res, R.renderHome(DB.allPosts(), DB.totalViews())));

// ── sections ─────────────────────────────────────────────────────────────────
for (const sk of SECTION_ORDER) {
  app.get(`/${sk}.html`, (req, res) => html(res, R.renderSection(sk, DB.postsBySection(sk))));
}

// ── static-ish pages ─────────────────────────────────────────────────────────
app.get("/agents.html", (req, res) => html(res, P.renderAgents()));
app.get("/about.html", (req, res) => html(res, P.renderAbout()));
app.get("/submit.html", (req, res) => html(res, P.renderSubmit()));

// ── search ───────────────────────────────────────────────────────────────────
app.get("/search", (req, res) => {
  const q = (req.query.q || "").toString();
  html(res, R.renderSearch(q, DB.search(q)));
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
  const views = DB.bumpView(slug);
  const all = DB.allPosts();
  let related = all.filter(p => p.section === post.section && p.slug !== slug).slice(0, 3);
  if (related.length < 3) related = related.concat(all.filter(p => p.slug !== slug && !related.includes(p)).slice(0, 3 - related.length));
  html(res, R.renderArticle(post, related, views));
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
  res.status(201).json({ ok: true,
    message: r.already ? "You're already on the list — welcome back." : "You're in. New dispatches will land in your inbox." });
});
app.get("/api/subscribers/count", (req, res) => res.json({ count: DB.countSubscribers() }));

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
