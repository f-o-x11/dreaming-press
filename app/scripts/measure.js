// measure.js — collect the objective facts about dreaming.press, in one place.
//
// This exists so that "how are we doing?" stops being a matter of opinion. Every
// number here is read from a real source (the analytics DB, the live site, the
// corpus, the audit harnesses) rather than asserted, and the whole thing prints
// as JSON so a rubric — or a future agent scoring one — consumes facts instead of
// re-deriving them and drifting.
//
// It measures; it does not judge. Scoring lives with the rubric, because weights
// are an editorial choice and the facts are not.
//
//   node scripts/measure.js [--base URL] [--json PATH] [--quiet]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as DB from "../lib/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");
const ANALYTICS = path.join(REPO, "analytics");
const argOf = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = argOf("--base", "https://dreaming.press");
const QUIET = process.argv.includes("--quiet");

const readJSON = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };
const APP = path.resolve(__dirname, "..");
// cwd is the APP dir, not the repo root: the harnesses live at app/scripts/* and
// resolve their own relative paths from there. Running them from the repo root
// silently threw MODULE_NOT_FOUND, which this helper swallowed — so the audit
// reported 0 findings of every severity and looked like a clean bill of health.
// A measurement tool that fails open is worse than no measurement at all.
const sh = (cmd, args) => {
  try { return execFileSync(cmd, args, { cwd: APP, encoding: "utf8", timeout: 300000 }).trim(); }
  catch (e) { return `__ERROR__${String(e.message).split("\n")[0].slice(0, 120)}`; }
};

async function head(url, timeout = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  const t0 = Date.now();
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "dreaming.press/measure" } });
    const body = await r.text();
    return { ok: r.ok, status: r.status, ms: Date.now() - t0, bytes: body.length, type: r.headers.get("content-type") || "", body };
  } catch (e) { return { ok: false, status: 0, ms: Date.now() - t0, bytes: 0, type: "", body: "", error: String(e.message).slice(0, 60) };
  } finally { clearTimeout(t); }
}

const M = { measured_at: new Date().toISOString(), base: BASE };

// ── reach: the only numbers that actually define the 1M goal ────────────────
const snap = readJSON(path.join(ANALYTICS, "snapshot.json"), {});
const channels = snap.channels || [];
const sum = (k) => channels.reduce((s, c) => s + (c[k] || 0), 0);
const views14 = sum("views"), reads14 = sum("reads"), sessions14 = sum("sessions");
M.reach = {
  window_days: 14,
  views: views14, reads: reads14, sessions: sessions14,
  // The headline gap. Everything else is a means to this end.
  views_per_month_run_rate: Math.round(views14 * 30 / 14),
  target_views_per_month: 1_000_000,
  gap_multiple: views14 ? +(1_000_000 / (views14 * 30 / 14)).toFixed(1) : null,
  by_channel: Object.fromEntries(channels.map(c => [c.channel, { views: c.views, reads: c.reads }])),
  // Read rate per channel exposes which traffic is worth acquiring: organic has
  // historically converted several times better per visitor than direct.
  read_rate_by_channel: Object.fromEntries(channels.map(c => [c.channel, c.views ? +(c.reads / c.views).toFixed(3) : 0])),
};

// ── engagement: the mission metric is time-on-site ──────────────────────────
// Per-channel quality, so the scorer can judge engaged traffic instead of a
// blended average that `direct` (97% of views, 6x worse conversion) defines.
M.channel_quality = (snap.channelQuality || []).map(c => ({
  channel: c.channel, views: c.views, read_rate: c.read_rate,
  pages_per_session: c.pages_per_session, median_dwell_sec: c.median_dwell_sec,
}));
// Median dwell among channels with an identifiable source — the honest
// "how long do people who actually arrived from somewhere stay?" number.
M.attributable_median_dwell_sec = (() => {
  const rows = (snap.channelQuality || []).filter(c => c.channel !== "direct" && c.median_dwell_sec != null && c.views >= 3);
  if (!rows.length) return null;
  const v = rows.map(r => r.median_dwell_sec).sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
})();

M.engagement = {
  engaged_read_rate: views14 ? +(reads14 / views14).toFixed(3) : 0,
  avg_time_sec: (snap.site || {}).avgTimeSec ?? null,
  posts_this_week: (snap.site || {}).postsThisWeek ?? null,
  // "Arrived but left" — traffic earned then lost. Cheapest available upside.
  bounced_pages: (snap.topViews || []).filter(c => c.views >= 15 && (c.reads / c.views) < 0.05)
    .map(c => ({ slug: c.slug, views: c.views, reads: c.reads })),
};

// ── answer-engine demand: machines find this site far more than humans do ───
const crawlers = readJSON(path.join(ANALYTICS, "crawlers.json"), {});
M.agents = {
  verified_ai_fetches: crawlers.verifiedAiHits || 0,
  // Crawl is supply; citation is the outcome. We can measure the first exactly
  // and the second only by proxy (referrals from assistants), so keep them apart
  // rather than letting crawl volume masquerade as success.
  assistant_referred_views: channels.filter(c => c.channel === "ai" || /^campaign:/.test(c.channel))
    .reduce((s, c) => s + (c.views || 0), 0),
  crawl_to_referral_ratio: null, // filled below
};
M.agents.crawl_to_referral_ratio = M.agents.verified_ai_fetches
  ? +(M.agents.assistant_referred_views / M.agents.verified_ai_fetches).toFixed(4) : null;

// ── corpus + media coverage ─────────────────────────────────────────────────
const posts = DB.allPosts();
const bySection = posts.reduce((m, p) => (m[p.section] = (m[p.section] || 0) + 1, m), {});
// Narration coverage MUST come from the live site, not the local DB. Generated
// audio lives in the server's untracked audio-ai/ overlay, so a laptop checkout
// sees only what it produced itself: measured locally it reported 137 narrated
// of 1838 (8%) while the live index reported 1193 (65%). Scoring a rubric off the
// local number would have manufactured a crisis that does not exist.
const liveIdx = await head(`${BASE}/api/index.json`);
let livePosts = null;
try { livePosts = JSON.parse(liveIdx.body).posts || null; } catch { /* offline — fall back below */ }
const src = livePosts || posts;
const narrated = src.filter(p => p.has_audio).length;
M.corpus = {
  posts: posts.length, by_section: bySection,
  narration_source: livePosts ? "live" : "local-db (LIVE INDEX UNREACHABLE — coverage understated)",
  narrated, narration_coverage: src.length ? +(narrated / src.length).toFixed(3) : 0,
  // Coverage on the NEWEST pieces matters more than the corpus average: those are
  // the ones anyone actually lands on, and they are the ones that lag.
  narrated_of_newest_25: src.slice(0, 25).filter(p => p.has_audio).length,
  freshest_post_date: posts[0]?.date || null,
};

// ── agent surface: is the machine-facing side actually up? ──────────────────
const AGENT_ENDPOINTS = ["/api/agent-hub.json", "/feed.json", "/llms.txt", "/api/tools.json", "/api/index.json"];
M.agent_surface = {};
for (const e of AGENT_ENDPOINTS) {
  const r = await head(BASE + e);
  M.agent_surface[e] = { status: r.status, ms: r.ms, bytes: r.bytes };
}
const mdTwin = posts[0] ? await head(`${BASE}/posts/${posts[0].slug}.md`) : null;
M.agent_surface["/posts/<newest>.md"] = mdTwin ? { status: mdTwin.status, ms: mdTwin.ms, bytes: mdTwin.bytes } : null;

// ── human-facing performance ────────────────────────────────────────────────
const home = await head(BASE + "/");
const article = posts[0] ? await head(`${BASE}/posts/${posts[0].slug}.html`) : null;
M.performance = {
  home_ms: home.ms, home_bytes: home.bytes,
  article_ms: article?.ms ?? null, article_bytes: article?.bytes ?? null,
};

// ── quality gates: the harnesses already in the repo ────────────────────────
const uiJson = "/tmp/measure-ui-audit.json";
try { fs.unlinkSync(uiJson); } catch { /* absent */ }
const uiRun = sh("node", ["scripts/ui-audit.mjs", "--base", BASE, "--articles", "4", "--json", uiJson]);
const ui = readJSON(uiJson, null);
const bySev = ((ui && ui.findings) || []).reduce((m, f) => (m[f.sev] = (m[f.sev] || 0) + 1, m), {});
M.quality = ui ? {
  ui_high: bySev.high || 0, ui_medium: bySev.medium || 0, ui_low: bySev.low || 0,
  ui_by_kind: (ui.findings || []).reduce((m, f) => (m[f.kind] = (m[f.kind] || 0) + 1, m), {}),
} : {
  // Never report zeros we did not observe. An audit that failed to run and an
  // audit that found nothing look identical in a JSON blob, and the optimistic
  // reading is the dangerous one.
  ui_high: null, ui_medium: null, ui_low: null, ui_by_kind: null,
  error: uiRun.startsWith("__ERROR__") ? uiRun.slice(9) : "ui-audit produced no JSON",
};

// ── commissioning signal health: is the research pipeline alive? ────────────
// Each of these can die silently, which is exactly how narration died for weeks.
const sd = readJSON(path.join(ANALYTICS, "search-demand.json"), null);
const xt = readJSON(path.join(ANALYTICS, "x-trends.json"), null);
const ageH = (iso) => iso ? +((Date.now() - Date.parse(iso)) / 3600000).toFixed(1) : null;
M.research_pipeline = {
  search_demand: sd ? { reached: sd.reached ?? "n/a", phrases: sd.phrases || 0, uncovered: sd.gaps || 0, age_h: ageH(sd.fetched_at) } : null,
  x_trends: xt ? { sampled: xt.sampled || 0, terms: (xt.topTerms || []).length, age_h: ageH(xt.generated) } : null,
  crawler_stats: crawlers.generated ? { age_h: ageH(crawlers.generated) } : (crawlers.verifiedAiHits ? { age_h: null } : null),
  brief_present: fs.existsSync(path.join(ANALYTICS, "BRIEF.md")),
  // Named so a rubric can score "how many independent demand signals are live",
  // and so a dead one is visible as a number rather than an absent section.
  live_signals: [sd && sd.reached !== 0, xt && (xt.topTerms || []).length, crawlers.verifiedAiHits].filter(Boolean).length,
};

// Facts score.js needs that live outside the analytics files.
// route_families_beaconed: does a non-article page actually carry telemetry? Asked
// of the LIVE site rather than the source, because "the code has it" and "the
// deployed page has it" have already diverged once this session.
try {
  const hub = await head(`${BASE}/build`);
  M.route_families_beaconed = /__dpBeacon/.test(hub.body || "");
} catch { M.route_families_beaconed = null; }

// Registered agent subscribers — the D4 usage number. Zero here is a real zero
// (the surface exists and nothing consumes it), unlike a failed measurement.
try {
  const hubJson = await head(`${BASE}/api/agent-hub.json`);
  const j = JSON.parse(hubJson.body || "{}");
  M.agent_subscribers = j?.counts?.agent_subscribers ?? null;
} catch { M.agent_subscribers = null; }

// Crawlable decision URLs — the interactive surface with demonstrated machine
// demand. Counted from the sitemap so it reflects what is actually discoverable,
// not what the router could theoretically serve.
try {
  const sm = await head(`${BASE}/sitemap.xml`);
  const locs = (sm.body || "").match(/<loc>[^<]+<\/loc>/g) || [];
  M.interactive_urls = locs.filter(l => /\/(build|tools|stacks?|compare|best|alternatives|calculators|topics|concepts|reports)\b/.test(l)).length;
} catch { M.interactive_urls = null; }

const out = argOf("--json", "");
if (out) fs.writeFileSync(out, JSON.stringify(M, null, 2));
if (!QUIET) console.log(JSON.stringify(M, null, 2));
