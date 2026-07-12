// crawler-stats.js — parse nginx access logs for AI-crawler / answer-engine
// activity and write analytics/crawlers.json. This is the proof the GEO work is
// landing: which AI engines (GPTBot, ClaudeBot, PerplexityBot, Google-Extended,
// Bytespider, Baiduspider…) are actually reading dreaming.press, how often, and
// when they were last here. Runs on the server in the deploy (root can read
// /var/log/nginx); the deploy commits analytics/ back to GitHub so the app can
// render it publicly on /dashboard. Radical transparency, real data, on-brand.
//   node scripts/crawler-stats.js          # reads /var/log/nginx/access.log*
//   DP_NGINX_LOGS=/path/to/access.log node scripts/crawler-stats.js
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ordered most-specific-first so overlapping tokens resolve correctly
// (OAI-SearchBot before GPTBot's home url, Applebot-Extended before Applebot).
// cat: "ai" = LLM / answer-engine crawler, "search" = traditional search.
export const BOTS = [
  { name: "OAI-SearchBot", re: /OAI-SearchBot/i, cat: "ai", home: "https://openai.com/searchbot", label: "ChatGPT Search (OpenAI)" },
  { name: "ChatGPT-User", re: /ChatGPT-User/i, cat: "ai", home: "https://openai.com/bot", label: "ChatGPT (user browsing)" },
  { name: "GPTBot", re: /GPTBot/i, cat: "ai", home: "https://openai.com/gptbot", label: "GPTBot (OpenAI)" },
  { name: "Claude-SearchBot", re: /Claude-SearchBot/i, cat: "ai", home: "https://www.anthropic.com", label: "Claude Search (Anthropic)" },
  { name: "Claude-User", re: /Claude-User/i, cat: "ai", home: "https://www.anthropic.com", label: "Claude (user browsing)" },
  { name: "ClaudeBot", re: /ClaudeBot|anthropic-ai/i, cat: "ai", home: "https://www.anthropic.com", label: "ClaudeBot (Anthropic)" },
  { name: "PerplexityBot", re: /PerplexityBot|Perplexity-User/i, cat: "ai", home: "https://www.perplexity.ai/bot", label: "Perplexity" },
  { name: "Google-Extended", re: /Google-Extended/i, cat: "ai", home: "https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers", label: "Gemini / Vertex (Google-Extended)" },
  { name: "Applebot-Extended", re: /Applebot-Extended/i, cat: "ai", home: "https://support.apple.com/en-us/119829", label: "Apple Intelligence" },
  { name: "Bytespider", re: /Bytespider/i, cat: "ai", home: "https://bytedance.com", label: "ByteDance / Doubao" },
  { name: "Amazonbot", re: /Amazonbot/i, cat: "ai", home: "https://developer.amazon.com/amazonbot", label: "Amazon (Alexa / Rufus)" },
  { name: "CCBot", re: /CCBot/i, cat: "ai", home: "https://commoncrawl.org/ccbot", label: "Common Crawl (feeds many LLMs)" },
  { name: "Meta-ExternalAgent", re: /Meta-ExternalAgent|FacebookBot|meta-externalfetcher/i, cat: "ai", home: "https://developers.facebook.com/docs/sharing/bot", label: "Meta AI" },
  { name: "MistralAI", re: /MistralAI/i, cat: "ai", home: "https://mistral.ai", label: "Mistral AI" },
  { name: "cohere-ai", re: /cohere-(ai|training-data-crawler)/i, cat: "ai", home: "https://cohere.com", label: "Cohere" },
  { name: "DuckAssistBot", re: /DuckAssistBot/i, cat: "ai", home: "https://duckduckgo.com/duckassistbot", label: "DuckDuckGo AI" },
  { name: "YouBot", re: /YouBot/i, cat: "ai", home: "https://about.you.com", label: "You.com" },
  { name: "Diffbot", re: /Diffbot/i, cat: "ai", home: "https://www.diffbot.com", label: "Diffbot" },
  { name: "PetalBot", re: /PetalBot/i, cat: "ai", home: "https://webmaster.petalsearch.com/site/petalbot", label: "Petal / Huawei" },
  { name: "YandexAdditional", re: /YandexAdditional/i, cat: "ai", home: "https://yandex.com", label: "YandexGPT" },
  { name: "Applebot", re: /Applebot/i, cat: "search", home: "https://support.apple.com/en-us/119829", label: "Applebot (Siri / Spotlight)" },
  { name: "Googlebot", re: /Googlebot/i, cat: "search", home: "https://developers.google.com/search", label: "Googlebot" },
  { name: "Bingbot", re: /bingbot/i, cat: "search", home: "https://www.bing.com/webmasters", label: "Bingbot" },
  { name: "Baiduspider", re: /Baiduspider/i, cat: "search", home: "https://www.baidu.com", label: "Baidu" },
  { name: "YandexBot", re: /YandexBot/i, cat: "search", home: "https://yandex.com", label: "Yandex" },
  { name: "Sogou", re: /Sogou/i, cat: "search", home: "https://www.sogou.com", label: "Sogou" },
  { name: "YisouSpider", re: /YisouSpider/i, cat: "search", home: "https://www.yisou.com", label: "Yisou" },
];

const MONTHS = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
// nginx combined time: 12/Jul/2026:14:03:11 +0000 → 2026-07-12 (date only, sortable)
function isoDate(t) {
  const m = /(\d{2})\/([A-Za-z]{3})\/(\d{4})/.exec(t || "");
  return m && MONTHS[m[2]] ? `${m[3]}-${MONTHS[m[2]]}-${m[1]}` : null;
}

// Match a User-Agent to at most one bot (first in priority order). Fixes the
// naive double-count where the UA names the bot twice (token + home URL).
function matchBot(ua) {
  for (const b of BOTS) if (b.re.test(ua)) return b;
  return null;
}

// ── Anti-spoof: verify a hit's source IP against the vendor's OWN published
// crawler IP ranges. A "GPTBot" User-Agent is just a text label anyone can send;
// only an IP inside OpenAI's published list is really OpenAI. Vendors that don't
// publish ranges (Anthropic, ByteDance) are marked unverifiable, not counted as
// real. This is the industry-standard way to filter crawler impersonators.
export const ipToInt = (ip) => ip.split(".").reduce((a, o) => ((a << 8) >>> 0) + (+o), 0) >>> 0;
export function cidrMatch(ip, cidr) {
  const [base, bitsStr] = String(cidr).split("/"); const bits = +bitsStr;
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(base || "") || !/^\d+\.\d+\.\d+\.\d+$/.test(ip || "")) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipToInt(ip) & mask) === (ipToInt(base) & mask);
}
// bot name -> vendor list key(s) whose official IP ranges authoritatively cover it
export const BOT_LISTS = { GPTBot: ["oai_gptbot"], "OAI-SearchBot": ["oai_search"], "ChatGPT-User": ["oai_chatgpt"], Googlebot: ["google"], Bingbot: ["bing"], PerplexityBot: ["perplexity"] };
const VENDOR_URLS = {
  oai_gptbot: ["https://openai.com/gptbot.json"],
  oai_search: ["https://openai.com/searchbot.json", "https://openai.com/oai-searchbot.json"],
  oai_chatgpt: ["https://openai.com/chatgpt-user.json"],
  google: ["https://developers.google.com/static/search/apis/ipranges/googlebot.json"],
  bing: ["https://www.bing.com/toolbox/bingbot.json"],
  perplexity: ["https://www.perplexity.ai/perplexitybot.json"],
};

async function fetchPrefixes(urls) {
  for (const u of urls) {
    try {
      const r = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(12000) });
      if (!r.ok) continue;
      const j = await r.json();
      const pre = (j.prefixes || j.data?.prefixes || []).map((p) => p.ipv4Prefix).filter(Boolean);
      if (pre.length) return pre;
    } catch { /* try next url */ }
  }
  return [];
}

// Load vendor ranges, cached to analytics/crawler-ranges.json (24h TTL) so we
// don't hammer the vendor endpoints on every 10-min deploy and still work if a
// fetch transiently fails. Returns { key: [cidr,…] }.
async function loadRanges(cacheDir) {
  const cachePath = path.join(cacheDir, "crawler-ranges.json");
  try {
    const c = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    if (c.fetched && (Date.now() - new Date(c.fetched).getTime()) < 24 * 3600 * 1000 && c.ranges) return c.ranges;
  } catch { /* no/expired cache */ }
  const ranges = {};
  for (const key of Object.keys(VENDOR_URLS)) ranges[key] = await fetchPrefixes(VENDOR_URLS[key]);
  const anyLoaded = Object.values(ranges).some((r) => r.length);
  if (anyLoaded) { try { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(cachePath, JSON.stringify({ fetched: new Date().toISOString(), ranges }, null, 0)); } catch { /* best effort */ } }
  return ranges;
}

// This box is a SHARED server: one nginx access.log captures every vhost
// (eliasarcade.com, gilallouche.com, zoegallery, dreaming.press…). The combined
// log format carries no Host, so when we read the shared log we must attribute by
// URL: only paths that exist on dreaming.press count. A dedicated per-vhost log
// (dreaming.press.access.log) is host-pure and needs no filter — see main().
export const DP_PATH = /^\/(posts\/|stack\/|reports\/|tools|calculators|fabrications|the-wire|weekly|dashboard|series\/|authors|api\/(facts|tools|index|posts|crawlers|search|analytics)|embed|mcp|agents\.txt|llms\.txt|feed\.json|sitemap\.xml|news-sitemap\.xml|\.well-known\/agents)/i;

// Pure core: aggregate an iterable of raw nginx-combined log lines. Exported so
// tests can feed synthetic lines without touching the filesystem. When
// `pathAllow` is set, only requests whose path matches it are counted (used to
// attribute the shared log to dreaming.press); pass null for a host-pure log.
export function aggregate(lines, { pathAllow = null, verify = null } = {}) {
  const acc = new Map(); // name -> {hits, verified, firstSeen, lastSeen, paths:Map}
  let minDate = null, maxDate = null;
  for (const line of lines) {
    if (!line) continue;
    const ua = (/"([^"]*)"\s*$/.exec(line) || [])[1];
    if (!ua) continue;
    const bot = matchBot(ua);
    if (!bot) continue;
    const reqPath = (/"(?:GET|POST|HEAD) ([^ ?"]+)/.exec(line) || [])[1] || "";
    if (pathAllow && !pathAllow.test(reqPath)) continue; // not a dreaming.press URL
    const date = isoDate((/\[([^\]]+)\]/.exec(line) || [])[1]);
    if (date) { if (!minDate || date < minDate) minDate = date; if (!maxDate || date > maxDate) maxDate = date; }
    let e = acc.get(bot.name);
    if (!e) { e = { hits: 0, verified: 0, firstSeen: date, lastSeen: date, paths: new Map() }; acc.set(bot.name, e); }
    e.hits++;
    if (verify && verify((line.split(" ")[0] || ""), bot.name)) e.verified++;
    if (date) { if (!e.firstSeen || date < e.firstSeen) e.firstSeen = date; if (!e.lastSeen || date > e.lastSeen) e.lastSeen = date; }
    // Count real content paths only for "top pages": drop static assets and the
    // exploit-scan targets (/.env, /.git, wp-login…) that UA-spoofing scanners hit.
    if (reqPath && !/\.(png|webp|avif|jpg|svg|css|js|ico|mp3|xml|txt|json)$/i.test(reqPath)
        && !/(^\/\.|\/\.env|\/\.git|\/wp-|\.php$|rclone|\/\.aws|\/config|\/vendor\/|\/\.well-known\/(?!agents))/i.test(reqPath))
      e.paths.set(reqPath, (e.paths.get(reqPath) || 0) + 1);
  }
  const meta = BOTS.reduce((m, b) => (m[b.name] = b, m), {});
  const bots = [...acc.entries()].map(([name, e]) => ({
    name, label: meta[name].label, category: meta[name].cat, home: meta[name].home,
    hits: e.hits, verifiedHits: e.verified, firstSeen: e.firstSeen, lastSeen: e.lastSeen,
    topPaths: [...e.paths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([p, n]) => ({ path: p, hits: n })),
  })).sort((a, b) => b.hits - a.hits);
  const aiHits = bots.filter(b => b.category === "ai").reduce((s, b) => s + b.hits, 0);
  return { windowStart: minDate, windowEnd: maxDate, totalHits: bots.reduce((s, b) => s + b.hits, 0), aiHits, aiEngines: bots.filter(b => b.category === "ai").length, bots };
}

// Merge two aggregate() results covering DISJOINT time ranges (shared historical
// log + host-pure per-vhost log). No double-count because the per-vhost access_log
// directive routes dreaming.press requests to the dedicated log from its creation.
export function mergeStats(a, b) {
  const byName = new Map();
  for (const s of [a, b]) for (const bt of s.bots) {
    const e = byName.get(bt.name);
    if (!e) { byName.set(bt.name, { ...bt, topPaths: bt.topPaths.map((p) => ({ ...p })) }); continue; }
    e.hits += bt.hits; e.verifiedHits = (e.verifiedHits || 0) + (bt.verifiedHits || 0);
    if (bt.firstSeen && (!e.firstSeen || bt.firstSeen < e.firstSeen)) e.firstSeen = bt.firstSeen;
    if (bt.lastSeen && (!e.lastSeen || bt.lastSeen > e.lastSeen)) e.lastSeen = bt.lastSeen;
    const pm = new Map(e.topPaths.map((p) => [p.path, p.hits]));
    for (const p of bt.topPaths) pm.set(p.path, (pm.get(p.path) || 0) + p.hits);
    e.topPaths = [...pm.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([path, hits]) => ({ path, hits }));
  }
  const bots = [...byName.values()].sort((x, y) => y.hits - x.hits);
  const dates = [a.windowStart, a.windowEnd, b.windowStart, b.windowEnd].filter(Boolean).sort();
  return {
    windowStart: dates[0] || null, windowEnd: dates[dates.length - 1] || null,
    totalHits: bots.reduce((s, b) => s + b.hits, 0),
    aiHits: bots.filter(b => b.category === "ai").reduce((s, b) => s + b.hits, 0),
    aiEngines: bots.filter(b => b.category === "ai").length, bots,
  };
}

// Read every available nginx access log (current + rotated + gzipped) as lines.
function* readLogs(globPaths) {
  for (const p of globPaths) {
    try {
      const buf = fs.readFileSync(p);
      const text = p.endsWith(".gz") ? zlib.gunzipSync(buf).toString("utf8") : buf.toString("utf8");
      for (const line of text.split("\n")) yield line;
    } catch { /* unreadable/rotated-away — skip */ }
  }
}

// The host-pure per-vhost log (dreaming.press.access.log*) and the shared log
// cover disjoint time ranges: adding the access_log directive moved dreaming.press
// requests off the shared log onto the dedicated one. So read BOTH — dedicated
// with no filter (every line is dreaming.press), shared attributed by URL path.
function nginxLogPaths() {
  if (process.env.DP_NGINX_LOGS) {
    const p = process.env.DP_NGINX_LOGS.split(":");
    return process.env.DP_HOST_PURE === "1" ? { shared: [], dedicated: p } : { shared: p, dedicated: [] };
  }
  const dir = "/var/log/nginx";
  const pick = (re) => { try { return fs.readdirSync(dir).filter(f => re.test(f)).sort().map(f => path.join(dir, f)); } catch { return []; } };
  return { shared: pick(/^access\.log/), dedicated: pick(/^dreaming\.press\.access\.log/) };
}

async function main() {
  const { shared, dedicated } = nginxLogPaths();
  if (!shared.length && !dedicated.length) { console.log("[crawler-stats] no nginx logs found — skipping (leaving any existing crawlers.json)."); return; }
  const out = path.resolve(__dirname, "..", "..", "analytics");
  const ranges = await loadRanges(out);
  const rangesLoaded = Object.fromEntries(Object.entries(ranges).map(([k, v]) => [k, v.length > 0]));
  // verify(ip, botName): true only if the source IP is in the bot's vendor ranges.
  const verify = (ip, name) => (BOT_LISTS[name] || []).some(k => (ranges[k] || []).some(c => cidrMatch(ip, c)));
  const stats = mergeStats(
    aggregate(readLogs(shared), { pathAllow: DP_PATH, verify }),
    aggregate(readLogs(dedicated), { pathAllow: null, verify }),
  );
  if (!stats.bots.length) { console.log("[crawler-stats] no crawler hits found — skipping."); return; }
  // A bot is IP-verifiable only if it has a vendor list AND that list loaded.
  for (const b of stats.bots) b.verifiable = (BOT_LISTS[b.name] || []).length > 0 && (BOT_LISTS[b.name] || []).every(k => rangesLoaded[k]);
  const verifiedAiHits = stats.bots.filter(b => b.category === "ai" && b.verifiable).reduce((s, b) => s + (b.verifiedHits || 0), 0);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "crawlers.json"), JSON.stringify({
    generated: new Date().toISOString(),
    scope: "dreaming.press only (shared-log hits attributed by URL + host-pure per-vhost log); AI-engine counts IP-verified against vendors' published crawler ranges",
    verifiedAiHits, logsScanned: shared.length + dedicated.length, ...stats,
  }, null, 1));
  console.log(`[crawler-stats] crawlers.json — ${verifiedAiHits} IP-VERIFIED AI hits (of ${stats.aiHits} claimed) from ${stats.bots.filter(b => b.verifiable && b.verifiedHits).length} verified engines, window ${stats.windowStart}…${stats.windowEnd}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
