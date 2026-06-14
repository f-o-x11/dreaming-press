// crawl.mjs — crawl EVERY page of the running app and assert health.
// Catches content corruption (repeated blocks), missing bodies, broken covers,
// missing audio, malformed structure. Usage: BASE=http://127.0.0.1:3099 node e2e/crawl.mjs
// (boots its own server on PORT 3097 if BASE not given).
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let BASE = process.env.BASE;
let child;
if (!BASE) {
  const PORT = 3097;
  BASE = `http://127.0.0.1:${PORT}`;
  child = spawn("node", ["server.js"], { cwd: path.join(__dirname, ".."), env: { ...process.env, PORT }, stdio: "ignore" });
  await new Promise(r => setTimeout(r, 1500));
}

const fails = [];
const ok = [];
const fail = (page, msg) => fails.push(`${page}  ✗ ${msg}`);

async function get(p) {
  const res = await fetch(BASE + p);
  const body = await res.text();
  return { status: res.status, ctype: res.headers.get("content-type") || "", body };
}

function count(hay, needle) { return hay.split(needle).length - 1; }

// detect a sentence (>40 chars) repeated 3+ times = corruption
function hasRepeatedBlock(html) {
  const paras = [...html.matchAll(/<p[^>]*>([\s\S]{40,400}?)<\/p>/g)].map(m => m[1].replace(/<[^>]+>/g, "").trim());
  const counts = {};
  for (const t of paras) { if (t.length > 40) counts[t] = (counts[t] || 0) + 1; }
  const worst = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return worst && worst[1] >= 3 ? worst : null;
}

async function checkArticle(post) {
  const page = `/posts/${post.slug}.html`;
  const { status, body } = await get(page);
  if (status !== 200) return fail(page, `status ${status}`);
  if (!body.includes("<!DOCTYPE html>")) fail(page, "no doctype");
  // exactly one byline / one hero cover (corruption signature = many)
  const bylines = count(body, 'class="article-byline"');
  if (bylines !== 1) fail(page, `article-byline x${bylines} (expected 1 — corruption?)`);
  const covers = count(body, 'class="article-cover"');
  if (covers !== 1) fail(page, `article-cover x${covers} (expected 1)`);
  // dek should appear ≤ 5 times (1 hero + ≤3 related cards + og/meta)
  const heroDek = count(body, 'class="dek"');
  if (heroDek > 5) fail(page, `dek class x${heroDek} (too many — corruption?)`);
  // repeated-paragraph detector
  const rep = hasRepeatedBlock(body);
  if (rep) fail(page, `paragraph repeated x${rep[1]}: "${rep[0].slice(0, 50)}…"`);
  // cover + audio references
  if (!body.includes(`/images/${post.slug}.png`)) fail(page, "cover png not referenced");
  // body has real content
  const bodyMatch = /<div class="article-body[^"]*">([\s\S]*?)<div class="article-foot"/.exec(body);
  const words = bodyMatch ? bodyMatch[1].replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length : 0;
  if (words < 30) fail(page, `body only ${words} words`);
  // markdown twin
  const md = await get(`/posts/${post.slug}.md`);
  if (md.status !== 200) fail(page + " (.md)", `md status ${md.status}`);
  else if (!md.body.startsWith("---")) fail(page + " (.md)", "md missing frontmatter");
  if (fails.length === 0 || !fails[fails.length - 1].startsWith(page)) ok.push(page);
}

// ── run ──────────────────────────────────────────────────────────────────────
const idx = await get("/api/index.json");
const posts = JSON.parse(idx.body).posts;
console.log(`Crawling ${posts.length} articles + static pages against ${BASE}…`);

for (const post of posts) await checkArticle(post);

const staticPages = [
  ["/", "where AI agents write"],
  ["/dispatches.html", "Dispatches"],
  ["/wire.html", "The Wire"],
  ["/stack.html", "The Stack"],
  ["/fabrications.html", "Fabrications"],
  ["/agents.html", "For AI Agents"],
  ["/about.html", "About"],
  ["/submit.html", "Is your AI writing"],
  ["/search?q=agent", "result"],
  ["/feed.json", '"items"'],
  ["/rss.xml", "<rss"],
  ["/sitemap.xml", "<urlset"],
  ["/llms.txt", "dreaming.press"],
  ["/.well-known/agent-card.json", "skills"],
  ["/api/index.json", "publication"],
];
for (const [p, needle] of staticPages) {
  const { status, body } = await get(p);
  if (status !== 200) fail(p, `status ${status}`);
  else if (!body.includes(needle)) fail(p, `missing "${needle}"`);
  else ok.push(p);
}
// 404 must 404
const nf = await get("/this-does-not-exist-zzz");
if (nf.status !== 404) fail("/404", `expected 404, got ${nf.status}`);
else ok.push("/404");

console.log(`\n✓ ${ok.length} pages OK`);
if (fails.length) {
  console.log(`\n✗ ${fails.length} FAILURES:`);
  for (const f of fails) console.log("  " + f);
}
if (child) child.kill();
process.exit(fails.length ? 1 : 0);
