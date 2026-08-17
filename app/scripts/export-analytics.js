// export-analytics.js — write the dashboard's insights into the repo so the
// cloud newsroom (whose sandbox cannot reach dreaming.press — egress-blocked)
// gets REAL numbers from git and commissions from them. Runs on the server in
// the deploy; the deploy then commits analytics/ back to GitHub.
//   node scripts/export-analytics.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as DB from "../lib/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "..", "..", "analytics");
fs.mkdirSync(OUT, { recursive: true });

// AI-crawler demand: which of our pages the real (IP-verified) answer-engine
// crawlers actually fetch, so the newsroom commissions MORE of what ChatGPT &
// friends are ingesting. This is the "research before writing" the desk needs —
// GPTBot pulling a topic hard is a signal to go deeper on that topic.
function crawlerDemand() {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(OUT, "crawlers.json"), "utf8"));
    const verified = (c.bots || []).filter(b => b.category === "ai" && b.verifiable && b.verifiedHits > 0);
    const paths = new Map();
    // Include the interactive hubs, not just prose. The old filter kept only
    // /posts|/stack|/compare|/best|/reports, which dropped 3230 of 4197 crawled
    // hits — and buried the single most-pulled content destination on the site:
    // /build at 497 fetches, 4x the top article (/posts/coreweave-vs-lambda-vs-
    // nebius at 124). Answer engines pulling the stack-builder that hard is a
    // commissioning signal in its own right: agents want the TOOL, not only the
    // write-up. Infrastructure noise stays out — /api/* (1951 hits on
    // /api/events alone), manifests, feeds and tag indexes are not topics.
    const CONTENT = /^\/posts\/|^\/stack\/|^\/compare\/|^\/best\/|^\/reports\/|^\/build|^\/tools|^\/calculators|^\/stacks|^\/topics\/|^\/concepts/;
    const NOISE = /^\/api\/|^\/\.well-known|\.(json|xml|webmanifest|txt|png|jpg|svg|ico|css|js|mp3)$/;
    for (const b of (c.bots || [])) for (const p of (b.topPaths || [])) if (CONTENT.test(p.path) && !NOISE.test(p.path)) paths.set(p.path, (paths.get(p.path) || 0) + p.hits);
    const top = [...paths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    return { verifiedAiHits: c.verifiedAiHits || 0, engines: verified.map(b => `${b.label} ${b.verifiedHits}`), topCrawled: top };
  } catch { return null; }
}

const days = 14;
const snap = {
  generated: new Date().toISOString(),
  windowDays: days,
  site: DB.siteStats(),
  funnel: DB.funnel({ days }),
  channels: DB.channelBreakdown({ days }),
  assistants: DB.assistantBreakdown({ days }),
  devices: DB.deviceBreakdown({ days }),
  topContent: DB.topContent({ days, limit: 15 }),
  topListens: DB.topContent({ days, limit: 10, order: "plays" }),
  topViews: DB.topContent({ days, limit: 10, order: "views" }),
  topPages: DB.topPages({ days, limit: 15, order: "views" }),
  referrers: DB.topReferrers({ days, limit: 10 }),
};
fs.writeFileSync(path.join(OUT, "snapshot.json"), JSON.stringify(snap, null, 1));

// a compact natural-language brief the newsroom reads first
const host = (u) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return String(u).slice(0, 40); } };
const secCount = {};
for (const c of snap.topContent) if (c.reads >= 1) secCount[c.section] = (secCount[c.section] || 0) + 1;

// ── winning-pattern extraction ──────────────────────────────────────────────
// Look at what actually wins (reads + listens) and pull out the recurring
// signals — format, section mix, and the words in winning titles — so the desk
// gets concrete "write more like THESE" directives, not vague advice.
const TITLE_STOP = new Set("the a an and or of to in for on with is are be this that your you how what why vs it new not just does which need into from when will been who your our can get got out now use using make your they them has have want here more most than then only also very much really".split(" "));
function winningPatterns(items) {
  const winners = items.filter(c => (c.reads || 0) >= 1 || (c.plays || 0) >= 1);
  const fmt = { "how-to": 0, comparison: 0, "best/list": 0, "tool/app highlight": 0, question: 0, news: 0 };
  const terms = new Map(); const secs = {};
  for (const c of winners) {
    const t = (c.title || "").toLowerCase();
    if (/how to|how-to|guide|tutorial|steps?\b/.test(t)) fmt["how-to"]++;
    if (/ vs\.? | versus |—.*or |compare/.test(t)) fmt.comparison++;
    if (/\bbest\b|top \d|\d+ (ways|tools|tips)/.test(t)) fmt["best/list"]++;
    if (/highlight|tool:|app:|meet /.test(t)) fmt["tool/app highlight"]++;
    if (/\?$/.test(c.title || "")) fmt.question++;
    if (/launch|raises|ships?|released?|now|just|update/.test(t)) fmt.news++;
    secs[c.section] = (secs[c.section] || 0) + 1;
    for (const w of t.replace(/[^a-z0-9\s-]/g, " ").split(/\s+/)) {
      if (w.length < 3 || w.length > 22 || TITLE_STOP.has(w) || /^\d+$/.test(w)) continue;
      terms.set(w, (terms.get(w) || 0) + 1);
    }
  }
  const topFmt = Object.entries(fmt).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const topTerms = [...terms.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  return { topFmt, topTerms, secs };
}
// Dedup by slug before counting formats. topListens overlaps topContent almost
// completely (9 of 10 slugs shared, 25 entries → 16 unique), so concatenating
// them counted the same winners twice and inflated whichever format the narrated
// pieces happened to use. The brief was telling the desk "news (7) beats how-to
// (5)" off a tally that, deduped, is a tie. This number steers ~34 commissions a
// day — it has to be honest.
const pat = winningPatterns([...new Map([...snap.topContent, ...snap.topListens].map(c => [c.slug, c])).values()]);

const lines = [
  `# Analytics brief — auto-exported ${snap.generated.slice(0, 16)}Z (last ${days} days)`,
  ``,
  `READ THIS FIRST, COMMISSION FROM IT. Real reader data from dreaming.press/dashboard.`,
  `The mission is visitors + time-on-site: make MORE of what already earns reads and listens.`,
  ``,
  `- Funnel: ${snap.funnel.views} views → ${snap.funnel.reads} engaged reads → ${snap.funnel.completes} completes · ${snap.funnel.sessions} sessions.`,
  `- Channels: ${snap.channels.map(c => `${c.channel} ${c.reads}r/${c.views}v`).join(" · ") || "none yet"}.`,
  `- AI assistants (our real front door): ${snap.assistants.map(a => `${a.assistant} ${a.reads}r/${a.views}v`).join(" · ") || "none detected yet"}.`,
  `- Referrers: ${snap.referrers.map(r => host(r.ref)).join(", ") || "none yet"}.`,
  `- Engaged-read winners by section: ${Object.entries(secCount).map(([s, n]) => `${s}=${n}`).join(", ") || "no reads yet"}.`,
  ``,
  `## Top by engaged reads (eyes that stayed)`,
  ...(snap.topContent.filter(c => c.reads >= 1).slice(0, 10).map(c => `- [${c.section}] "${c.title}" — ${c.reads} reads, ${c.views} views, ${c.plays} listens`)) ,
  ...(snap.topContent.every(c => c.reads < 1) ? [`- (no engaged reads in-window yet — commission from crawler demand + X trends below)`] : []),
  ``,
  `## Top by listens (audio is now on every piece — Item 1)`,
  ...(snap.topListens.filter(c => c.plays >= 1).slice(0, 8).map(c => `- [${c.section}] "${c.title}" — ${c.plays} listens, ${c.reads} reads`)),
  ...(snap.topListens.every(c => c.plays < 1) ? [`- (no listens in-window yet — promote the audio player; narration ships automatically)`] : []),
  ``,
  // The hubs, which no report could see until route-family telemetry shipped.
  // Kept separate from the article table on purpose: a tool page and an article
  // are different products with different jobs, and averaging them hides both.
  ...(() => {
    const pages = snap.topPages || [];
    if (!pages.length) return [];
    return [
      `## Hubs and tools (non-article routes)`,
      `The interactive surfaces. /build is the most-crawled path on the whole domain,`,
      `so what these earn from humans is the other half of the picture.`,
      ...pages.slice(0, 8).map(p => `- ${p.path} — ${p.views} views, ${p.reads} reads, ${p.sessions} sessions${p.avg_dwell_sec ? `, avg ${p.avg_dwell_sec}s` : ""}`),
      `ACTION: a hub out-earning articles per view is a signal to build MORE tools and`,
      `fewer posts; the reverse means the tools need entry points, not more surface.`,
      ``,
    ];
  })(),
  `## Top by raw views (eyes that arrived)`,
  ...(snap.topViews.filter(c => c.views >= 1).slice(0, 6).map(c => `- [${c.section}] "${c.title}" — ${c.views} views, ${c.reads} reads`)),
  ``,
  // The brief listed top-by-reads and top-by-views separately and never subtracted
  // one from the other — so the pieces that PULLED traffic and then lost it were
  // invisible, even though that gap is the sharpest time-on-site signal in the
  // file. Two Founder's Wire editions, same section and same format, sit 5x apart
  // on read rate (413v/28r = 6.8% vs 155v/2r = 1.3%), and one piece took 36 views
  // to zero reads. That is a headline/opening problem on a piece that already
  // proved it can attract clicks — the cheapest possible win, because the hard
  // part (getting them there) already worked.
  ...(() => {
    const bounced = (snap.topViews || [])
      .filter(c => c.views >= 15 && (c.reads / c.views) < 0.05)
      .sort((a, b) => b.views - a.views).slice(0, 5);
    if (!bounced.length) return [];
    return [
      `## Arrived but left (fix these openings first)`,
      `These pulled real traffic and then lost it. The click already worked, so the`,
      `problem is the first screen: headline promise not paid off fast enough, or no`,
      `skimmable answer above the fold. Rewriting an opening is cheaper than earning`,
      `new traffic — and these pages already have the traffic.`,
      ...bounced.map(c => `- [${c.section}] "${c.title}" — ${c.views} views but only ${c.reads} engaged reads (${(100 * c.reads / c.views).toFixed(1)}%)`),
      `ACTION: pick the top one, rewrite its opening to answer the title's question in`,
      `the first two sentences, and keep the URL. Compare its read rate next run.`,
      ``,
    ];
  })(),
  `## WRITE MORE LIKE THESE (the winning pattern)`,
  `- Winning formats: ${pat.topFmt.length ? pat.topFmt.map(([f, n]) => `${f} (${n})`).join(", ") : "not enough data — default to how-tos, comparisons, tool highlights"}.`,
  `- Winning section mix: ${Object.entries(pat.secs).map(([s, n]) => `${s}=${n}`).join(", ") || "n/a"}.`,
  `- Words that recur in winning titles: ${pat.topTerms.map(([w, n]) => `${w}(${n})`).join(", ") || "n/a"}.`,
  `- ACTION: pick a winning format above, aim it at a recurring winning term, and ship the next piece in that cluster today. Cross-link it to the winner it echoes.`,
  `- If AI-assistant referrers appear (chatgpt/perplexity/yuanbao/baidu), front-load a skimmable, citable answer near the top.`,
  `- Reads but low completes → tighten the opening. High completes → write the follow-up.`,
];

// ── trending on X (folds Gil's X account in — see x-trends.js) ───────────────
try {
  const xt = JSON.parse(fs.readFileSync(path.join(OUT, "x-trends.json"), "utf8"));
  const ageH = (Date.now() - Date.parse(xt.generated)) / 3600000;
  if (xt.topTerms && xt.topTerms.length && ageH < 72) {
    lines.push(
      ``,
      `## Trending on X right now (${xt.sampled} recent posts sampled, ${Math.round(ageH)}h ago)`,
      `Hot terms: ${xt.topTerms.slice(0, 15).map(t => `${t.term}(${t.count})`).join(", ")}.`,
      xt.hashtags.length ? `Hashtags: ${xt.hashtags.slice(0, 10).map(t => t.term).join(", ")}.` : ``,
      `High-engagement posts to react to / cite:`,
      ...xt.topPosts.slice(0, 5).map(p => `- "${p.text}" — ${p.url}`),
      `ACTION: where an X-hot term overlaps a proven winner above, that's the highest-value piece to write next — timely AND format-validated. We can also post the piece to X.`,
    );
  }
} catch { /* x-trends.json absent (token not set / inert) — skip */ }

// ── uncovered search demand (see search-demand.js) ──────────────────────────
// Every other section of this brief looks at the audience we already have: what
// won here, what crawlers pulled, what was loud on X. This is the only one that
// looks at people who have not arrived yet — real autocomplete phrases, filtered
// to the ones no post in the corpus answers. With organic at 20 reads/39 views
// against 3016 direct, this is the channel with the most headroom.
try {
  const sd = JSON.parse(fs.readFileSync(path.join(OUT, "search-demand.json"), "utf8"));
  const ageH = (Date.now() - Date.parse(sd.fetched_at)) / 3600000;
  if (sd.reached === 0) {
    // Say it out loud rather than just omitting the section — an absent section is
    // indistinguishable from "no gaps found", and this signal dying quietly is
    // exactly the failure mode worth surfacing.
    lines.push(``, `- Search-demand signal UNAVAILABLE (no autocomplete engine reachable at ${sd.fetched_at}). Commission from the sections above until it returns.`);
  } else if (sd.top_gaps && sd.top_gaps.length && ageH < 96) {
    const both = sd.top_gaps.filter(g => g.engines.length > 1);
    const pick = (both.length >= 12 ? both : sd.top_gaps).slice(0, 14);
    lines.push(
      ``,
      `## Uncovered search demand (${sd.gaps} of ${sd.phrases} phrases have NO post, ${Math.round(ageH)}h ago)`,
      `Real Google + Bing autocomplete, minus everything the corpus already answers. Phrases`,
      `confirmed by BOTH engines are listed first — two independent indexes agreeing is the`,
      `closest thing to a volume signal we get without a paid keyword tool.`,
      ...pick.map(g => `- "${g.phrase}"  [${g.engines.join("+")}]`),
      `ACTION: these are titles waiting to be written. Pick one that also matches a winning`,
      `format above (comparison / how-to / news) and answer it literally — the phrase IS the`,
      `search intent, so put the answer in the first screen and use the phrasing in the H1.`,
    );
  }
} catch { /* search-demand.json absent (never run / offline) — skip */ }

// Append the AI-crawler demand section — real, IP-verified answer-engine pull.
const cd = crawlerDemand();
if (cd) {
  lines.push(
    ``,
    `## AI-crawler demand (RESEARCH BEFORE YOU WRITE)`,
    `The real answer engines are crawling us — IP-verified: ${cd.verifiedAiHits} confirmed AI-engine fetches` + (cd.engines.length ? ` (${cd.engines.join(", ")}).` : `.`),
    `These are the pages the crawlers pull hardest — each is a topic ChatGPT/Perplexity/etc. are actively ingesting, so commission MORE around them (deeper cuts, adjacent comparisons, updated versions):`,
    ...cd.topCrawled.map(([p, n]) => `- ${p}  — ${n} crawler fetches`),
    `Rule: before writing, check this list. A heavily-crawled topic is proven answer-engine demand — write the next piece in that cluster and cross-link it.`,
  );
}
fs.writeFileSync(path.join(OUT, "BRIEF.md"), lines.join("\n") + "\n");
console.log(`[analytics-export] snapshot.json + BRIEF.md written (${snap.topContent.length} top items).`);
