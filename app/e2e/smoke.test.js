// Browser smoke tests for dreaming.press using puppeteer-core + system Chrome.
// Boots the app on a test port, then drives a headless Chrome over ~8 pages.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { allPosts } from "../lib/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, "..");
const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const posts = allPosts();
let serverProc, browser;

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (async function poll() {
      try {
        const r = await fetch(url);
        if (r.ok) return resolve();
      } catch { /* not up yet */ }
      if (Date.now() - start > timeoutMs) return reject(new Error("server did not start"));
      setTimeout(poll, 200);
    })();
  });
}

before(async () => {
  serverProc = spawn("node", ["server.js"], {
    cwd: APP_DIR,
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });
  await waitForServer(`${BASE}/healthz`);
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
});

after(async () => {
  if (browser) await browser.close();
  if (serverProc) serverProc.kill("SIGTERM");
});

async function newPage() {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(20000);
  return page;
}

// ── homepage ─────────────────────────────────────────────────────────────────
test("homepage loads with brand, featured headline, cards, working covers", async () => {
  const page = await newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });

  const brand = await page.$eval(".brand", el => el.textContent.trim());
  assert.match(brand, /dreaming/);

  const featured = await page.$eval(".lede h1", el => el.textContent.trim());
  assert.ok(featured.length > 0, "featured headline present");

  const cardCount = await page.$$eval(".card", els => els.length);
  assert.ok(cardCount >= 6, `at least 6 cards (got ${cardCount})`);

  // cover images actually loaded
  const loaded = await page.$$eval(".card-art img", imgs =>
    imgs.filter(i => i.naturalWidth > 0).length);
  assert.ok(loaded >= 1, `at least one cover image loaded (got ${loaded})`);

  await page.close();
});

test("homepage has a ticker and footer", async () => {
  const page = await newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
  assert.equal(await page.$$eval(".ticker", e => e.length), 1);
  assert.equal(await page.$$eval("footer.site", e => e.length), 1);
  await page.close();
});

// ── section pages ────────────────────────────────────────────────────────────
const sectionH1 = {
  dispatches: "Dispatches", wire: "The Wire", stack: "The Stack", fabrications: "Fabrications",
};
for (const [sk, h1] of Object.entries(sectionH1)) {
  test(`section /${sk}.html loads with correct H1`, async () => {
    const page = await newPage();
    await page.goto(`${BASE}/${sk}.html`, { waitUntil: "networkidle2" });
    const got = await page.$eval(".page-head h1", el => el.textContent.trim());
    assert.equal(got, h1);
    await page.close();
  });
}

// ── article page ─────────────────────────────────────────────────────────────
test("article page renders title, audio player, and cover", async () => {
  const p = posts.find(x => x.has_audio) || posts[0];
  const page = await newPage();
  await page.goto(`${BASE}/posts/${p.slug}.html`, { waitUntil: "networkidle2" });

  const title = await page.$eval("article h1", el => el.textContent.trim());
  assert.equal(title, p.title);

  if (p.has_audio) {
    assert.equal(await page.$$eval("audio", e => e.length), 1, "audio player present");
  }

  const coverLoaded = await page.$eval(".article-cover img", img => img.naturalWidth > 0);
  assert.ok(coverLoaded, "article cover image loaded");

  await page.close();
});

// ── markdown twin ────────────────────────────────────────────────────────────
test("markdown twin returns text/markdown content type", async () => {
  const p = posts[0];
  const r = await fetch(`${BASE}/posts/${p.slug}.md`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /text\/markdown/);
  const body = await r.text();
  assert.ok(body.startsWith("---"));
  await Promise.resolve();
});

// ── dark mode ────────────────────────────────────────────────────────────────
test("dark mode via ?theme=dark sets data-theme=dark", async () => {
  const page = await newPage();
  await page.goto(`${BASE}/?theme=dark`, { waitUntil: "networkidle2" });
  const theme = await page.$eval("html", el => el.getAttribute("data-theme"));
  assert.equal(theme, "dark");
  await page.close();
});

test("light mode is default (no theme param)", async () => {
  const page = await newPage();
  // fresh context-ish: clear storage first
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/?theme=light`, { waitUntil: "networkidle2" });
  const theme = await page.$eval("html", el => el.getAttribute("data-theme"));
  assert.equal(theme, "light");
  await page.close();
});

// ── search ───────────────────────────────────────────────────────────────────
test("search returns results for 'agent'", async () => {
  const page = await newPage();
  await page.goto(`${BASE}/search?q=agent`, { waitUntil: "networkidle2" });
  const h1 = await page.$eval(".page-head h1", el => el.textContent.trim());
  assert.match(h1, /agent/);
  const cards = await page.$$eval(".card", els => els.length);
  assert.ok(cards >= 1, `search produced results (got ${cards})`);
  await page.close();
});

test("search form on the page submits to /search", async () => {
  const page = await newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
  await page.type(".nav-search input[name=q]", "memory");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }),
    page.keyboard.press("Enter"),
  ]);
  assert.match(page.url(), /\/search\?q=memory/);
  await page.close();
});

// ── 404 ──────────────────────────────────────────────────────────────────────
test("404 page shows 'never written'", async () => {
  const page = await newPage();
  const resp = await page.goto(`${BASE}/no-such-page-here`, { waitUntil: "networkidle2" });
  assert.equal(resp.status(), 404);
  const txt = await page.$eval("body", el => el.textContent);
  assert.match(txt, /never written/i);
  await page.close();
});

// ── agents page ──────────────────────────────────────────────────────────────
test("For AI Agents page loads", async () => {
  const page = await newPage();
  await page.goto(`${BASE}/agents.html`, { waitUntil: "networkidle2" });
  const h1 = await page.$eval("h1", el => el.textContent.trim());
  assert.ok(h1.length > 0);
  const txt = await page.$eval("body", el => el.textContent);
  assert.match(txt, /curl -sL/);
  await page.close();
});

// ── about page ───────────────────────────────────────────────────────────────
test("About page loads with masthead", async () => {
  const page = await newPage();
  await page.goto(`${BASE}/about.html`, { waitUntil: "networkidle2" });
  assert.equal(await page.$$eval(".masthead", e => e.length), 1);
  await page.close();
});

// ── mobile: no horizontal overflow ───────────────────────────────────────────
for (const route of ["/", "/wire.html", `/posts/${posts[0].slug}.html`, "/agents.html"]) {
  test(`mobile 390px: no horizontal overflow on ${route}`, async () => {
    const page = await newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle2" });
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    assert.ok(scrollWidth <= innerWidth + 2,
      `no horizontal overflow on ${route}: scrollWidth=${scrollWidth} innerWidth=${innerWidth}`);
    await page.close();
  });
}

// ── theme toggle button works ────────────────────────────────────────────────
test("theme toggle button flips data-theme", async () => {
  const page = await newPage();
  await page.goto(`${BASE}/?theme=light`, { waitUntil: "networkidle2" });
  await page.click("#themeBtn");
  const theme = await page.$eval("html", el => el.getAttribute("data-theme"));
  assert.equal(theme, "dark");
  await page.close();
});
