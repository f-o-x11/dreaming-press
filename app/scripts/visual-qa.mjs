// visual-qa.mjs — browser-based visual regression harness (runs every loop).
// Boots the app, drives headless Chrome across key pages at desktop + mobile
// widths, and ASSERTS layout truths that presence-checks can't see:
//   · nav items never wrap mid-label / baselines align
//   · footer link columns share one row (no orphaned column below a giant one)
//   · no horizontal overflow at any viewport
//   · no doubled metric words ("reads reads"), no template artifacts
//   · zero console errors
// Saves screenshots to /tmp/dp-vqa-*.png for the design council / eyeballing.
//   node scripts/visual-qa.mjs [--base http://127.0.0.1:PORT]
import { spawn } from "node:child_process";
import fs from "node:fs";
import puppeteer from "puppeteer-core";

// Prefer an explicit env override, then common system paths, then a Playwright
// browser bundle (CI/sandboxes ship Chromium under PLAYWRIGHT_BROWSERS_PATH).
function findPlaywrightChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  try {
    for (const d of fs.readdirSync(root)) {
      if (!/^chromium(?:-|$)/.test(d)) continue;           // full chromium build, not headless_shell
      const bin = `${root}/${d}/chrome-linux/chrome`;
      if (fs.existsSync(bin)) return bin;
    }
  } catch { /* root absent — fall through */ }
  return null;
}
const CHROME = [
  process.env.CHROME_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium",
  findPlaywrightChromium(),
].find(p => p && fs.existsSync(p));
if (!CHROME) { console.log("visual-qa: no Chrome found — skipping (not failing)"); process.exit(0); }

const argBase = process.argv.indexOf("--base");
let BASE = argBase > -1 ? process.argv[argBase + 1] : "";
let server = null;
if (!BASE) {
  const PORT = 3113;
  server = spawn("node", ["server.js"], { env: { ...process.env, PORT }, stdio: "ignore" });
  BASE = `http://127.0.0.1:${PORT}`;
  await new Promise(r => setTimeout(r, 2500));
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 120)); });

let fails = 0, checks = 0;
const ok = (cond, label) => { checks++; console.log((cond ? "✓" : "✗") + " " + label); if (!cond) fails++; };

async function auditPage(path, width, shotName) {
  await page.setViewport({ width, height: 900 });
  await page.goto(BASE + path, { waitUntil: "networkidle2", timeout: 30000 });
  const r = await page.evaluate(() => {
    const out = { navWraps: [], footerRows: 0, footerColTops: [], hScroll: false, badText: [] };
    // 1. nav items must be single-line (height ≈ one line box)
    for (const a of document.querySelectorAll(".nav-sections a")) {
      const cs = getComputedStyle(a);
      if (cs.display === "none") continue;
      const lh = parseFloat(cs.lineHeight) || 18;
      if (a.getBoundingClientRect().height > lh * 1.9) out.navWraps.push(a.textContent.trim());
    }
    // 2. footer columns must share one row
    const cols = document.querySelectorAll("footer.site .f-cols > div");
    const tops = [...cols].map(c => Math.round(c.getBoundingClientRect().top));
    out.footerColTops = tops;
    out.footerRows = new Set(tops.map(t => Math.round(t / 40))).size; // 40px tolerance buckets
    // 3. horizontal overflow
    out.hScroll = document.documentElement.scrollWidth > window.innerWidth + 2;
    // 4. template artifacts / doubled words.
    // Two scopes. `[object Object]` and doubled metric words are never legitimate
    // anywhere, so they scan the whole page. But `undefined` / `NaN` are ordinary
    // English/technical words an author will legitimately write ("what's still
    // undefined", "undefined behavior", "returns NaN") — a naive full-page match
    // false-positives on that prose. These artifacts only ever LEAK from string
    // interpolation in UI chrome (stat pills, digest rows, kickers, rails), never
    // from author markdown — so scan them over the page with the author-authored
    // regions (article body, FAQ, takeaway) removed.
    const body = document.body.innerText;
    for (const pat of [/\breads reads\b/i, /\bviews views\b/i, /\[object Object\]/]) {
      const m = body.match(pat); if (m) out.badText.push(m[0]);
    }
    let chromeText = body;
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll(".article-body, #faq, .faq, .takeaway").forEach((e) => e.remove());
    // innerText needs a rendered node — attach the clone offscreen, read, detach.
    clone.style.position = "absolute"; clone.style.left = "-99999px"; clone.setAttribute("aria-hidden", "true");
    document.documentElement.appendChild(clone);
    try { chromeText = clone.innerText; } finally { clone.remove(); }
    for (const pat of [/\bundefined\b/, /\bNaN(?![a-zA-Z])/]) {
      const m = chromeText.match(pat); if (m) out.badText.push(m[0]);
    }
    // 5. homepage editorial dedupe (council QA checklist): no story placed twice
    // outside the ticker/most-read rails; count title-level anchors only.
    if (location.pathname === "/") {
      const slugs = [];
      for (const a of document.querySelectorAll("h1 > a, h2 > a, h3 > a, h4 > a, a.wire-row")) {
        if (a.closest(".ticker") || a.closest(".most-read")) continue;
        const m = (a.getAttribute("href") || "").match(/^\/posts\/([a-z0-9-]+)\.html$/);
        if (m) slugs.push(m[1]);
      }
      out.dupStories = [...new Set(slugs.filter((s, i) => slugs.indexOf(s) !== i))];
    }
    // 6. article template must carry the design/Article.dc.html signature elements
    // (numbered breadcrumb, "section · N min read" kicker, public stat-pill row,
    // takeaway box, the audio player, and the Up-next card). If the render pipeline
    // silently drops one, the article page regresses off the shipped redesign — fail loudly.
    if (location.pathname.startsWith("/posts/")) {
      out.articleMissing = [];
      for (const [sel, label] of [
        ["nav.breadcrumb", "breadcrumb"],
        [".article-kicker", "kicker (section · min read)"],
        [".stat-pill", "public stat-pill row"],
        [".takeaway", "takeaway box"],
        [".audio-player", "audio player"],
        [".up-next", "Up-next card"],
      ]) if (!document.querySelector(sel)) out.articleMissing.push(label);
      // Conditional fidelity checks — fire ONLY when the element is present, so a
      // post that legitimately lacks a compare table or sources never trips them.
      // They lock in two more design/Article.dc.html signatures against silent drift:
      // the at-a-glance table must stay scroll-wrapped (its horizontal-overflow guard),
      // and every source must render as a numbered reference (the green "01 02 03" list).
      out.articleRegressions = [];
      const cmp = document.querySelector(".compare-table");
      if (cmp && !cmp.closest(".cmp-scroll"))
        out.articleRegressions.push("at-a-glance table not scroll-wrapped (.cmp-scroll)");
      const srcList = document.querySelector(".source-list");
      if (srcList && !srcList.querySelector(".src-n"))
        out.articleRegressions.push("sources not numbered (.src-n)");
      // The dark pill audio player (design/Article.dc.html) renders its own transport
      // over a headless <audio> only once neural narration exists — so guard it ONLY
      // when the .audio-live variant is present, and require the seekable track that
      // distinguishes the pill from native controls.
      const liveAudio = document.querySelector(".audio-player .audio-live");
      if (liveAudio && !liveAudio.querySelector(".ac-track"))
        out.articleRegressions.push("dark-pill audio player missing seek track (.ac-track)");
      // The "How this article is doing — live, public" metrics grid is gated on >=30
      // reads, so it's absent on fresh posts — guard its head + tiles ONLY when it renders.
      const doing = document.querySelector(".article-doing");
      if (doing && !(doing.querySelector(".ad-head") && doing.querySelector(".ad-grid .ad-tile")))
        out.articleRegressions.push("live-metrics grid missing head/tiles (.ad-head/.ad-tile)");
      // AI assistants (Kimi/Perplexity/Yuanbao/Doubao) are the publication's real front
      // door, and FAQPage JSON-LD is what hands them a citable answer verbatim — so when
      // an on-page FAQ accordion renders, its structured-data twin MUST ship too. Guard it
      // ONLY when the .faq section is present (posts without a faq: line legitimately omit
      // both), and require a ld+json blob that actually declares @type FAQPage — a silent
      // drop of the schema would cost us the citation without touching the visible page.
      if (document.querySelector(".faq")) {
        const hasFaqSchema = [...document.querySelectorAll('script[type="application/ld+json"]')]
          .some((s) => /"@type"\s*:\s*"FAQPage"/.test(s.textContent || ""));
        if (!hasFaqSchema)
          out.articleRegressions.push("on-page FAQ missing FAQPage JSON-LD (AI-citability regression)");
      }
    }
    // 7. Global Tech News must carry the design/Global-Tech-News.dc.html signature:
    // a NUMBERED daily digest (01…) under a "Top stories" kicker, each row a titled
    // story link. Mirrors the Article.dc.html fidelity gate so the page literally
    // named after the design can't silently regress to a plain card grid. Gated on
    // the digest having rendered stories (a `.wire-digest` section) so the rare
    // between-cycles empty state — a legitimate <p> fallback — never false-fails.
    if (location.pathname === "/global-tech-news" && document.querySelector(".wire-digest")) {
      out.digestMissing = [];
      for (const [sel, label] of [
        [".dg-row", "numbered digest rows (.dg-row)"],
        [".dg-n", "green digest index (.dg-n)"],
        [".dg-title", "digest story links (.dg-title)"],
      ]) if (!document.querySelector(sel)) out.digestMissing.push(label);
      out.digestRegressions = [];
      // the index must read as the design's zero-padded two-digit "01, 02, 03…"
      const firstN = document.querySelector(".dg-row .dg-n");
      if (firstN && !/^\d{2}$/.test(firstN.textContent.trim()))
        out.digestRegressions.push("digest index not zero-padded two-digit (.dg-n)");
      // the "Top stories" kicker heads the ranked lead, same as the mockup
      const heads = [...document.querySelectorAll(".wire-digest .section-head h2")].map((h) => h.textContent.trim());
      if (!heads.includes("Top stories"))
        out.digestRegressions.push("missing 'Top stories' section head");
      // the dark audio "briefing" pill is conditional (renders only with >=2 narrated
      // stories, no fabricated timing) — guard it ONLY when present, and require the
      // play-all transport + its queue island that make it a working player, not a stub.
      const brief = document.querySelector(".wd-briefing");
      if (brief && !(brief.querySelector(".playall-btn") && document.querySelector("#playall-data")))
        out.digestRegressions.push("briefing pill missing play-all button/queue (.playall-btn/#playall-data)");
    }
    return out;
  });
  const w = width >= 1000 ? "desktop" : "mobile";
  ok(r.navWraps.length === 0, `${path} ${w}: nav labels single-line${r.navWraps.length ? " (wrapped: " + r.navWraps.join(", ") + ")" : ""}`);
  if (width >= 1000) ok(r.footerRows <= 1, `${path} ${w}: footer columns on one row (rows=${r.footerRows})`);
  ok(!r.hScroll, `${path} ${w}: no horizontal overflow`);
  ok(r.badText.length === 0, `${path} ${w}: no template artifacts${r.badText.length ? " (" + r.badText.join(", ") + ")" : ""}`);
  if (r.dupStories) ok(r.dupStories.length === 0, `${path} ${w}: no story placed twice${r.dupStories.length ? " (" + r.dupStories.slice(0, 3).join(", ") + ")" : ""}`);
  if (r.articleMissing) ok(r.articleMissing.length === 0, `${path} ${w}: Article.dc.html elements present${r.articleMissing.length ? " (missing: " + r.articleMissing.join(", ") + ")" : ""}`);
  if (r.articleRegressions) ok(r.articleRegressions.length === 0, `${path} ${w}: Article.dc.html fidelity${r.articleRegressions.length ? " (" + r.articleRegressions.join(", ") + ")" : ""}`);
  if (r.digestMissing) ok(r.digestMissing.length === 0, `${path} ${w}: Global-Tech-News.dc.html elements present${r.digestMissing.length ? " (missing: " + r.digestMissing.join(", ") + ")" : ""}`);
  if (r.digestRegressions) ok(r.digestRegressions.length === 0, `${path} ${w}: Global-Tech-News.dc.html fidelity${r.digestRegressions.length ? " (" + r.digestRegressions.join(", ") + ")" : ""}`);
  if (shotName) await page.screenshot({ path: `/tmp/dp-vqa-${shotName}.png`, fullPage: shotName.includes("full") });
}

// pull a real article slug
await page.goto(BASE + "/api/index.json", { waitUntil: "networkidle2" });
const idx = JSON.parse(await page.evaluate(() => document.body.innerText));
// Prefer a narrated post so the Move 12 audio session (mini-player mounts to
// document.body on load) is audited for overflow + console errors every run.
const slug = (idx.posts.find(p => p.has_audio) || idx.posts[0]).slug;
// Also audit the newest COMPARISON piece — its 3–4 column at-a-glance table is
// the single widest chrome the corpus renders and the highest horizontal-overflow
// risk on mobile, yet the narrated/newest pick above is often a narrow tool
// highlight or wire roundup that carries no table. Match the house comparison
// shapes (an "X vs Y" slug/title, or a best-/how-to- lead) so a fresh compare
// table is exercised every run, not just when one happens to land at index 0.
const isCompare = (p) => /-vs-|(?:^|-)best-|^how-to-/.test(p.slug) || /\bvs\.?\b/i.test(p.title || "");
const freshSlug = (idx.posts.find(isCompare) || idx.posts[0]).slug;

await auditPage("/", 1440, "home-desktop");
await auditPage("/", 390, "home-mobile");
await auditPage(`/posts/${slug}.html`, 1440, "article-desktop");
await auditPage(`/posts/${slug}.html`, 390, "article-mobile");
if (freshSlug !== slug) {
  await auditPage(`/posts/${freshSlug}.html`, 1440, "article-fresh-desktop");
  await auditPage(`/posts/${freshSlug}.html`, 390, "article-fresh-mobile");
}
await auditPage("/wire.html", 1440, null);
await auditPage("/global-tech-news", 1440, null);
await auditPage("/global-tech-news", 390, null);
await auditPage("/tools", 1440, null);
await auditPage("/founders", 1440, null);
await auditPage("/founders", 390, null);
await auditPage("/dashboard", 1440, null);

ok(consoleErrors.length === 0, `zero console errors${consoleErrors.length ? " (" + consoleErrors[0] + " …)" : ""}`);

await browser.close();
if (server) server.kill();
console.log(`\nvisual-qa: ${checks - fails}/${checks} checks passed`);
process.exit(fails > 0 ? 1 : 0);
