// syndicate.js — cross-post Wire/Stack pieces to dev.to (and Medium) with a
// rel=canonical back to the origin (#24), expanding reach without duplicate-
// content penalties. Needs DEVTO_API_KEY (and optionally MEDIUM_TOKEN). Targets
// pieces published 7–14 days ago so the origin indexes first. Tracks sent items
// in the `dispatched` table (slug `syndicated:<slug>`) to avoid re-posting.
//   DEVTO_API_KEY=... node scripts/syndicate.js [--dry]
import { db, allPosts, eligibleForSyndication } from "../lib/db.js";
import { SITE } from "../lib/data.js";

const DEVTO = process.env.DEVTO_API_KEY || "";
const DRY = process.argv.includes("--dry");
const d = db();

function mdBody(p) {
  // reuse the clean markdown twin the site already serves
  return `> Originally published on [dreaming.press](${SITE}/posts/${p.slug}.html).\n\n${p.body_text || p.dek || ""}`;
}
const now = Date.now();
const windowPosts = eligibleForSyndication({ now }, d);

if (!windowPosts.length) { console.log("[syndicate] nothing in the 7–21 day window to syndicate."); process.exit(0); }
if (!DEVTO) { console.log(`[syndicate] ${windowPosts.length} eligible, but DEVTO_API_KEY unset — nothing posted.`); process.exit(0); }

// Daily ceiling on top of the per-run cap. This posts PUBLICLY under the
// publication's name, and the per-run limit of 3 only bounds one invocation —
// the deploy can fire many times a day, so without this the 432-piece backlog
// could drain in hours. That reads as spam to dev.to and to anyone following the
// account, and it is not undoable once posted.
const DAILY_CAP = 5;
const postedToday = d.prepare(
  "SELECT COUNT(*) AS n FROM dispatched WHERE slug LIKE 'syndicated:%' AND sent_at >= ?"
).get(new Date(now - 86400000).toISOString()).n;
const room = Math.max(0, DAILY_CAP - postedToday);
if (!room) {
  console.log(`[syndicate] daily cap reached (${postedToday}/${DAILY_CAP} in the last 24h) — nothing posted.`);
  process.exit(0);
}

// dev.to rejects titles over 128 characters with a 422. The wire headlines
// here routinely run past 150 ("The Founder's Wire, August 13: NVIDIA
// Open-Sources a One-GPU Agent Model, ..." is 155), so every wire piece failed
// until this trimmed. Cut on a word boundary — a headline severed mid-word
// looks broken on someone else's platform.
const DEVTO_TITLE_MAX = 128;
function fitTitle(t) {
  const s = String(t || "").trim();
  if (s.length <= DEVTO_TITLE_MAX) return s;
  const cut = s.slice(0, DEVTO_TITLE_MAX - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > 60 ? cut.slice(0, sp) : cut).replace(/[\s,;:—-]+$/, "") + "\u2026";
}

// The corpus tags describe VOICE, not subject: the five most common values are
// reportive, opinionated, howto, cynical, captivating. Passing those through
// put "reportive" on dev.to, which is a tag nobody browses or follows, so the
// post lands in front of no one. Syndication exists to reach an audience that
// has not heard of this publication, and on dev.to the tag IS the distribution.
// So topical tags are derived from the text against dev.to's actual vocabulary.
const VOICE_TAGS = new Set(["reportive","opinionated","cynical","captivating","hilarious",
  "instructive","practical","satire","decision","roundup"]);
const TOPIC_RULES = [
  [/\bagent|agentic|autonomous\b/i, "aiagents"],
  [/\bllm|gpt|claude|gemini|qwen|mistral|model\b/i, "llm"],
  [/\brag|retrieval|vector|embedding\b/i, "rag"],
  [/\bmcp\b/i, "mcp"],
  [/\bopen.?source|open.?weights|apache|mit licen/i, "opensource"],
  [/\bpython\b/i, "python"],
  [/\btypescript|javascript|node\b/i, "javascript"],
  [/\braise|funding|valuation|seed|series [a-d]\b/i, "startup"],
  [/\bbenchmark|eval|leaderboard\b/i, "benchmarking"],
  [/\bhow to|tutorial|step.by.step|guide\b/i, "tutorial"],
];
function devtoTags(p) {
  const hay = `${p.title || ""} ${p.dek || ""} ${String(p.body_text || "").slice(0, 2000)}`;
  const out = [];
  // "ai" first: it is the single largest relevant tag on dev.to and the one
  // thing every piece here genuinely is.
  out.push("ai");
  for (const [re, tag] of TOPIC_RULES) {
    if (out.length >= 4) break;
    if (re.test(hay) && !out.includes(tag)) out.push(tag);
  }
  // Fall back to any authored tag that is a real subject rather than a voice.
  for (const t of (Array.isArray(p.tags) ? p.tags : [])) {
    if (out.length >= 4) break;
    const c = String(t).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (c && !VOICE_TAGS.has(String(t).toLowerCase()) && !out.includes(c)) out.push(c);
  }
  return out.slice(0, 4);
}

// ONE post per run. dev.to's create limit is 300 seconds between articles —
// measured, not guessed: the 429 body says "try again in 300 seconds". A 35s
// gap was tried first and still lost 2 of 3. Sleeping five minutes inside the
// deploy script would stall the whole deploy, so the batch is one and the
// DAILY_CAP spreads the rest across the day's later runs instead.
const PER_RUN = 1;

let ok = 0;
for (const p of windowPosts.slice(0, Math.min(PER_RUN, room))) {
  const payload = { article: { title: fitTitle(p.title), published: true,
    canonical_url: `${SITE}/posts/${p.slug}.html`,
    tags: devtoTags(p), body_markdown: mdBody(p) } };
  if (DRY) { console.log(`[dry] would syndicate: ${payload.article.title}  [${payload.article.tags.join(", ")}]`); continue; }
  try {
    const r = await fetch("https://dev.to/api/articles", { method: "POST",
      headers: { "api-key": DEVTO, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (r.ok) { d.prepare("INSERT INTO dispatched (slug,sent_at) VALUES (?,?) ON CONFLICT(slug) DO NOTHING").run(`syndicated:${p.slug}`, new Date().toISOString()); ok++; console.log(`✓ dev.to: ${payload.article.title}`); }
    // Surface the body on failure. A bare status code cost a full debugging
    // round trip when 422 turned out to mean "title too long".
    else console.error(`✗ dev.to ${r.status}: ${payload.article.title}\n   ${(await r.text()).slice(0, 200)}`);
  } catch (e) { console.error(`✗ ${p.slug}: ${e.message}`); }
}
console.log(`[syndicate] ${ok} posted (${postedToday + ok}/${DAILY_CAP} in the last 24h, ${windowPosts.length} still eligible).`);
