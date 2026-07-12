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
export function aggregate(lines, { pathAllow = null } = {}) {
  const acc = new Map(); // name -> {hits, firstSeen, lastSeen, paths:Map}
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
    if (!e) { e = { hits: 0, firstSeen: date, lastSeen: date, paths: new Map() }; acc.set(bot.name, e); }
    e.hits++;
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
    hits: e.hits, firstSeen: e.firstSeen, lastSeen: e.lastSeen,
    topPaths: [...e.paths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([p, n]) => ({ path: p, hits: n })),
  })).sort((a, b) => b.hits - a.hits);
  const aiHits = bots.filter(b => b.category === "ai").reduce((s, b) => s + b.hits, 0);
  return { windowStart: minDate, windowEnd: maxDate, totalHits: bots.reduce((s, b) => s + b.hits, 0), aiHits, aiEngines: bots.filter(b => b.category === "ai").length, bots };
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

// Prefer a dedicated per-vhost log (host-pure: every line IS dreaming.press).
// Fall back to the shared access.log, which we must attribute by URL path.
function nginxLogPaths() {
  if (process.env.DP_NGINX_LOGS) return { paths: process.env.DP_NGINX_LOGS.split(":"), hostPure: process.env.DP_HOST_PURE === "1" };
  const dir = "/var/log/nginx";
  const pick = (re) => { try { return fs.readdirSync(dir).filter(f => re.test(f)).sort().map(f => path.join(dir, f)); } catch { return []; } };
  const dedicated = pick(/^dreaming\.press\.access\.log/);
  if (dedicated.length) return { paths: dedicated, hostPure: true };
  return { paths: pick(/^access\.log/), hostPure: false };
}

function main() {
  const { paths, hostPure } = nginxLogPaths();
  if (!paths.length) { console.log("[crawler-stats] no nginx logs found — skipping (leaving any existing crawlers.json)."); return; }
  // Host-pure log: count every request. Shared log: only dreaming.press URLs.
  const stats = aggregate(readLogs(paths), { pathAllow: hostPure ? null : DP_PATH });
  if (!stats.bots.length) { console.log("[crawler-stats] no crawler hits found — skipping."); return; }
  const out = path.resolve(__dirname, "..", "..", "analytics");
  fs.mkdirSync(out, { recursive: true });
  const scope = hostPure
    ? "dreaming.press (host-verified per-vhost log)"
    : "dreaming.press content URLs (attributed from a shared server log — a conservative floor; homepage/asset hits it can't disambiguate are excluded)";
  fs.writeFileSync(path.join(out, "crawlers.json"), JSON.stringify({ generated: new Date().toISOString(), scope, hostPure, logsScanned: paths.length, ...stats }, null, 1));
  console.log(`[crawler-stats] crawlers.json — ${stats.aiHits} AI hits / ${stats.totalHits} total from ${stats.aiEngines} engines (${hostPure ? "host-pure" : "path-attributed"}, window ${stats.windowStart}…${stats.windowEnd}).`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
