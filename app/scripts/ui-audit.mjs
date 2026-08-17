// ui-audit.mjs — whole-site layout audit in a real browser.
//
// visual-qa.mjs asserts a fixed set of known truths on a handful of pages (nav
// doesn't wrap, footer is one row, no overflow). This is the complement: it
// SWEEPS every page type, every section and a sample of real articles at four
// viewports and looks for classes of breakage that no one thought to assert.
//
// It exists because two bugs shipped that a presence-check could never catch:
//   · both fixed gutter rails kept floating after the article body ended, so
//     they painted on top of "Continue reading", the subscribe band and the
//     footer (the body's bottom was 2470px above the viewport, rails still at
//     top:96)
//   · `.provenance` was the one direct child of <article> with no screen CSS,
//     so it bled the full viewport while all 20 of its siblings sat at 640px
// Both are geometry facts. You only see them by measuring rectangles.
//
// Checks per page/viewport:
//   overflow   — the document scrolls horizontally
//   escape     — a block escapes the measure its siblings share
//   collision  — a fixed/sticky element overlaps real content underneath it
//   images     — an <img> resolved to nothing (naturalWidth 0)
//   clipped    — text is cut off by its own container
//   tap        — interactive targets under 24px on mobile
//   console    — page logged errors
//
// Advisory by default (report + exit 0) so it can run every loop without
// blocking a push; --strict exits non-zero when anything at or above the
// severity floor is found, for use as a gate.
//   node scripts/ui-audit.mjs [--base URL] [--strict] [--articles N] [--json PATH]
import { spawn } from "node:child_process";
import fs from "node:fs";
import puppeteer from "puppeteer-core";

function findPlaywrightChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  try {
    for (const d of fs.readdirSync(root)) {
      if (!/^chromium(?:-|$)/.test(d)) continue;
      const bin = `${root}/${d}/chrome-linux/chrome`;
      if (fs.existsSync(bin)) return bin;
    }
  } catch { /* absent */ }
  return null;
}
const CHROME = [
  process.env.CHROME_PATH, process.env.PUPPETEER_EXECUTABLE_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium",
  findPlaywrightChromium(),
].find(p => p && fs.existsSync(p));
if (!CHROME) { console.log("ui-audit: no Chrome found — skipping (not failing)"); process.exit(0); }

const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : dflt; };
const STRICT = process.argv.includes("--strict");
const N_ARTICLES = parseInt(arg("--articles", "6"), 10);
const JSON_OUT = arg("--json", "");

let BASE = arg("--base", "");
let server = null;
if (!BASE) {
  const PORT = 3117;
  server = spawn("node", ["server.js"], { env: { ...process.env, PORT }, stdio: "ignore" });
  BASE = `http://127.0.0.1:${PORT}`;
  await new Promise(r => setTimeout(r, 2500));
}

// 390 = iPhone; 768 = tablet/tablet-portrait; 1280 = the breakpoint where the
// gutter rails switch on (1240) plus margin; 1600 = a typical wide desktop, the
// width at which the rail collision was reported.
const VIEWPORTS = [
  { w: 390, h: 844, name: "mobile" },
  { w: 768, h: 1024, name: "tablet" },
  { w: 1280, h: 900, name: "desktop" },
  { w: 1600, h: 900, name: "wide" },
];

const findings = [];
const add = (f) => findings.push(f);

// The page-level probe. Runs inside the browser; returns plain data only.
// Everything here is geometry — the point is to catch what assertions miss.
const PROBE = () => {
  const out = { overflow: null, escapes: [], collisions: [], ghosts: [], images: [], clipped: [], tap: [] };
  const vw = window.innerWidth, vh = window.innerHeight;
  const de = document.documentElement;

  if (de.scrollWidth > vw + 1) {
    // name the widest offender so the report points at a fix, not a symptom
    let worst = null;
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const over = Math.round(r.right - vw);
      if (over > 1 && (!worst || over > worst.over)) {
        worst = { over, sel: (el.tagName + "." + (el.className || "")).toString().slice(0, 60) };
      }
    }
    out.overflow = { scrollWidth: de.scrollWidth, vw, worst };
  }

  // ESCAPE — inside a container whose children share a common measure, flag any
  // child dramatically wider than the median. That is how .provenance was found:
  // 20 siblings at 640px, one at 1600px. Full-bleed is sometimes deliberate, so
  // only report when the child is a clear outlier against its own siblings.
  for (const parent of document.querySelectorAll("article, main, .wrap")) {
    const kids = [...parent.children].filter(c => {
      if (["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT"].includes(c.tagName)) return false;
      const r = c.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (kids.length < 4) continue;
    const widths = kids.map(c => c.getBoundingClientRect().width).sort((a, b) => a - b);
    const median = widths[Math.floor(widths.length / 2)];
    if (median <= 0 || median > vw * 0.92) continue; // parent isn't a measured column
    for (const c of kids) {
      const r = c.getBoundingClientRect();
      if (r.width > median * 1.5 && r.width > vw * 0.92) {
        out.escapes.push({
          sel: (c.tagName + "." + (c.className || "")).toString().slice(0, 60),
          width: Math.round(r.width), median: Math.round(median), left: Math.round(r.left),
        });
      }
    }
  }

  // COLLISION — a fixed/sticky element painted over real content.
  //
  // The subtlety: overlaying content is the whole JOB of some chrome. A sticky
  // masthead, a mobile tab bar and a toast are all SUPPOSED to sit on top of the
  // page as it scrolls under them. A first cut of this check flagged 94 of those
  // and zero real bugs. Two filters separate intent from accident:
  //   1. edge-docked full-bleed chrome (spans ~the whole viewport width and is
  //      pinned to the top or bottom) is a bar, and bars overlay by design;
  //   2. a small allowlist of deliberate floating pills (toast, audio bars, tray).
  // What survives is the accidental kind: something narrow, parked mid-viewport,
  // sitting on text — exactly the shape of the gutter-rail bug this was built for
  // (208px wide, top:96, painting over "Continue reading").
  const INTENTIONAL = /\b(toast|playall-bar|resume-bar|cmp-tray|upnext-bar|reading-progress|mtabbar|masthead|skip-link)\b/;
  const floaters = [...document.querySelectorAll("body *")].filter(el => {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "sticky") return false;
    if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.05) return false;
    const r = el.getBoundingClientRect();
    if (!(r.width > 40 && r.height > 24 && r.top < vh && r.bottom > 0)) return false;
    if (INTENTIONAL.test(el.className || "") || INTENTIONAL.test(el.id || "")) return false;
    const fullBleed = r.width >= vw * 0.9;
    const docked = r.top <= 2 || r.bottom >= vh - 2;
    if (fullBleed && docked) return false;
    // The sharpest signal, and the one that separates the two /tools-style false
    // positives from the real rail bug: an OPAQUE floater is a surface — content
    // scrolling beneath it is hidden, which is what a sticky filter bar or bar
    // chrome is for. A TRANSPARENT floater has no surface, so overlapping content
    // shows straight through it and the two are legible at once. That is the
    // visual mess a reader actually sees, and it is what the gutter rails did
    // (background: none, painted over "Continue reading").
    const bg = cs.backgroundColor || "";
    const m = /rgba?\(([^)]+)\)/.exec(bg);
    const alpha = m ? (m[1].split(",")[3] === undefined ? 1 : parseFloat(m[1].split(",")[3])) : 0;
    if (alpha >= 0.85) return false;
    return true;
  });
  for (const f of floaters) {
    const r = f.getBoundingClientRect();
    const pts = [[0.25, 0.3], [0.5, 0.5], [0.75, 0.7]].map(([fx, fy]) =>
      [r.left + r.width * fx, r.top + r.height * fy]);
    for (const [x, y] of pts) {
      if (x < 1 || y < 1 || x > vw - 1 || y > vh - 1) continue;
      const stack = document.elementsFromPoint(x, y);
      const iSelf = stack.findIndex(e => e === f || f.contains(e));
      if (iSelf < 0) continue;
      const under = stack.slice(iSelf + 1).find(e => {
        if (!e || e === document.body || e === de) return false;
        if (f.contains(e) || e.contains(f)) return false;
        const t = (e.textContent || "").trim();
        return (t.length > 12 && e.children.length === 0) || e.tagName === "IMG" || e.tagName === "A";
      });
      if (under) {
        out.collisions.push({
          floater: (f.tagName + "." + (f.className || "")).toString().slice(0, 50),
          over: (under.tagName + "." + (under.className || "")).toString().slice(0, 50),
          text: (under.textContent || "").trim().slice(0, 45),
        });
        break; // one report per floater is enough to act on
      }
    }
  }

  // GHOST — an element carrying the [hidden] attribute that still renders. The UA
  // sheet's `[hidden]{display:none}` is the weakest rule in the cascade, so ANY
  // author `display` declaration silently defeats it and the element is painted
  // while every script that reads `.hidden` still believes it is invisible. Two
  // shipped this way (the article up-next pill and the /tools compare tray), each
  // permanently on screen over real content, each with perfectly correct reveal
  // logic that nothing was listening to. Cheap to check, impossible to eyeball.
  for (const el of document.querySelectorAll("[hidden]")) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.display !== "none" && r.width > 0 && r.height > 0) {
      out.ghosts.push({
        sel: (el.tagName + "." + (el.className || el.id || "")).toString().slice(0, 55),
        display: cs.display,
      });
    }
  }

  for (const img of document.querySelectorAll("img")) {
    const r = img.getBoundingClientRect();
    if (r.width > 0 && img.complete && img.naturalWidth === 0) {
      out.images.push((img.getAttribute("src") || "").slice(0, 90));
    }
  }

  // CLIPPED — a leaf whose text overflows a container that hides the overflow.
  for (const el of document.querySelectorAll("h1,h2,h3,p,li,td,button,a,span")) {
    if (el.children.length) continue;
    const t = (el.textContent || "").trim();
    if (t.length < 8) continue;
    const cs = getComputedStyle(el);
    if (cs.overflow === "hidden" && cs.textOverflow !== "ellipsis" && !cs.webkitLineClamp?.match(/\d/)) {
      if (el.scrollWidth > el.clientWidth + 4 || el.scrollHeight > el.clientHeight + 4) {
        out.clipped.push({ sel: (el.tagName + "." + (el.className || "")).slice(0, 45), text: t.slice(0, 40) });
      }
    }
  }

  if (vw <= 480) {
    for (const el of document.querySelectorAll("a,button,input,select,[role=button]")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (getComputedStyle(el).visibility === "hidden") continue;
      // WCAG 2.5.8 exempts links set INLINE in a sentence — you cannot enlarge one
      // without wrecking the line box around it, and the spec says so. Flagging
      // them was noise that buried the real offenders (standalone nav/footer
      // links), so only judge targets that stand on their own.
      if (el.tagName === "A" && el.closest(".article-body, p")) continue;
      if (r.height < 24 || r.width < 24) {
        out.tap.push({ sel: (el.tagName + "." + (el.className || "")).slice(0, 45),
          size: `${Math.round(r.width)}x${Math.round(r.height)}`, text: (el.textContent || "").trim().slice(0, 25) });
      }
    }
  }
  return out;
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
let consoleErrors = [];
page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 140)); });
page.on("pageerror", e => consoleErrors.push("pageerror: " + String(e.message).slice(0, 140)));

// Scroll the whole page before probing: the rail collision only appears once you
// are past the article body, and lazy content/reveal scripts need the scroll too.
async function sweepScroll() {
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (const f of [0.25, 0.5, 0.75, 0.9]) {
      window.scrollTo(0, h * f);
      await new Promise(r => setTimeout(r, 180));
    }
  });
  await new Promise(r => setTimeout(r, 250));
}

async function auditPage(path, label) {
  for (const vp of VIEWPORTS) {
    consoleErrors = [];
    await page.setViewport({ width: vp.w, height: vp.h });
    let r;
    try {
      await page.goto(BASE + path, { waitUntil: "networkidle2", timeout: 45000 });
      await sweepScroll();
      r = await page.evaluate(PROBE);
    } catch (e) {
      add({ sev: "high", kind: "load", page: path, label, vp: vp.name, detail: String(e.message).slice(0, 120) });
      continue;
    }
    const at = { page: path, label, vp: vp.name };
    if (r.overflow) {
      add({ sev: "high", kind: "overflow", ...at,
        detail: `scrollWidth ${r.overflow.scrollWidth} > ${r.overflow.vw}` +
          (r.overflow.worst ? ` — widest: ${r.overflow.worst.sel} (+${r.overflow.worst.over}px)` : "") });
    }
    for (const e of r.escapes) {
      add({ sev: "high", kind: "escape", ...at,
        detail: `${e.sel} is ${e.width}px while its siblings sit at ${e.median}px (left ${e.left})` });
    }
    for (const c of r.collisions) {
      add({ sev: "high", kind: "collision", ...at,
        detail: `${c.floater} paints over ${c.over} "${c.text}"` });
    }
    for (const g of r.ghosts) {
      add({ sev: "high", kind: "ghost", ...at,
        detail: `${g.sel} has [hidden] but renders (display:${g.display}) — CSS is overriding the attribute` });
    }
    for (const s of r.images) add({ sev: "medium", kind: "image", ...at, detail: `broken img ${s}` });
    for (const c of r.clipped) add({ sev: "low", kind: "clipped", ...at, detail: `${c.sel} "${c.text}"` });
    for (const t of r.tap.slice(0, 4)) add({ sev: "low", kind: "tap", ...at, detail: `${t.sel} ${t.size} "${t.text}"` });
    // The 404 probe navigates to a URL that is SUPPOSED to 404, and the browser
    // logs that status as a console error. Reporting it would train everyone to
    // ignore the console check, so drop the one error the test itself causes.
    const expected404 = label === "404";
    for (const e of [...new Set(consoleErrors)].slice(0, 3)) {
      if (expected404 && /404 \(Not Found\)/.test(e)) continue;
      add({ sev: "medium", kind: "console", ...at, detail: e });
    }
  }
}

// Every page type the site ships, plus a live sample of real articles per section
// (a template bug shows up on one article and every article, so sampling across
// sections beats auditing one hand-picked URL).
const STATIC_PAGES = [
  ["/", "home"], ["/global-tech-news", "global tech news"], ["/wire.html", "section:wire"],
  ["/stack.html", "section:stack"], ["/dispatches.html", "section:dispatches"],
  ["/fabrications.html", "section:fabrications"], ["/tools", "tools"], ["/apps", "apps"],
  ["/build", "build"], ["/stacks", "stacks"], ["/comparisons", "comparisons"],
  ["/calculators", "calculators"], ["/concepts", "concepts"], ["/topics", "topics"],
  ["/newsroom", "newsroom"], ["/dashboard", "dashboard"], ["/subscribe", "subscribe"],
  ["/about.html", "about"], ["/search?q=agent", "search"], ["/this-page-does-not-exist", "404"],
];

let articles = [];
try {
  const res = await fetch(`${BASE}/api/index.json`);
  const idx = await res.json();
  const bySec = new Map();
  for (const p of idx.posts || []) {
    if (!bySec.has(p.section)) bySec.set(p.section, []);
    bySec.get(p.section).push(p);
  }
  // round-robin across sections so every template variant gets covered
  const queues = [...bySec.values()];
  while (articles.length < N_ARTICLES && queues.some(q => q.length)) {
    for (const q of queues) {
      if (!q.length || articles.length >= N_ARTICLES) continue;
      const p = q.shift();
      articles.push([`/posts/${p.slug}.html`, `article:${p.section}`]);
    }
  }
} catch { /* index unavailable — static pages still audited */ }

const TARGETS = [...STATIC_PAGES, ...articles];
console.log(`ui-audit: ${TARGETS.length} pages x ${VIEWPORTS.length} viewports = ${TARGETS.length * VIEWPORTS.length} audits\n`);
let n = 0;
for (const [path, label] of TARGETS) {
  n++;
  process.stdout.write(`  [${String(n).padStart(2)}/${TARGETS.length}] ${label} ${path}`.padEnd(72));
  const before = findings.length;
  await auditPage(path, label);
  const found = findings.length - before;
  console.log(found ? `  ${found} issue${found > 1 ? "s" : ""}` : "  ok");
}

await browser.close();
if (server) server.kill();

const SEV = { high: 0, medium: 1, low: 2 };
findings.sort((a, b) => SEV[a.sev] - SEV[b.sev] || a.kind.localeCompare(b.kind));
const byKind = findings.reduce((m, f) => (m[f.kind] = (m[f.kind] || 0) + 1, m), {});

console.log(`\n${"=".repeat(72)}\nui-audit: ${findings.length} findings across ${TARGETS.length} pages`);
console.log(Object.entries(byKind).map(([k, v]) => `${k}:${v}`).join("  ") || "clean");

// Group identical (kind, detail) pairs — a template bug repeats on every article
// and every viewport, and 40 copies of one line buries the other findings.
const groups = new Map();
for (const f of findings) {
  const key = `${f.sev}|${f.kind}|${f.detail}`;
  if (!groups.has(key)) groups.set(key, { ...f, pages: new Set(), vps: new Set() });
  groups.get(key).pages.add(f.label);
  groups.get(key).vps.add(f.vp);
}
console.log("");
for (const g of groups.values()) {
  const where = [...g.pages].slice(0, 4).join(", ") + (g.pages.size > 4 ? ` +${g.pages.size - 4} more` : "");
  console.log(`[${g.sev.toUpperCase()}] ${g.kind}: ${g.detail}`);
  console.log(`        on ${where}  @ ${[...g.vps].join("/")}`);
}

if (JSON_OUT) {
  fs.writeFileSync(JSON_OUT, JSON.stringify({ base: BASE, pages: TARGETS.length, findings }, null, 2));
  console.log(`\nwrote ${JSON_OUT}`);
}

const blocking = findings.filter(f => f.sev === "high").length;
if (STRICT && blocking) { console.error(`\nui-audit: ${blocking} high-severity finding(s) — failing (--strict)`); process.exit(1); }
console.log(`\nui-audit: ${blocking} high-severity, ${findings.length - blocking} other.`);
