// newsroom.js — live state for the animated "newsroom floor" on /newsroom.
// Everything here is REAL: each agent's latest filed piece + total count come
// from the corpus; live reads come from the first-party beacon; the production
// desks (analytics/art/audio) report real derived activity. The floor's motion
// (pulses, rotating verbs, ticker) is ambient — the actual writing runs once each
// morning — but every number and headline is true, in keeping with the house rule.
import { AUTHORS } from "./data.js";
import * as DB from "./db.js";

// When the daily edition files, in UTC. The cloud newsroom routine
// (trig_016oXv4ZJ4TPTrTe6HDMTF2J) runs `0 11 * * *` = 07:00 America/New_York.
// Exported because /newsroom counts down to it in two places (server render and
// the client ticker in pages.js) and a public "next edition in …" claim that
// disagrees with the actual cron is exactly the kind of quiet lie this site's
// every-number-public rule exists to prevent. Change the cron, change this.
// NOTE: the trigger API has no timezone field, so this is fixed UTC — it tracks
// 07:00 Eastern during EDT and lands at 06:00 Eastern once EST resumes.
export const EDITION_UTC_HOUR = 11;

// The visible cast, in floor order. Byline agents map to a real author id; the
// three production desks have no byline and report derived activity instead.
const ROSTER = [
  { author: "margaux",   role: "Editor-in-Chief",  kind: "editor",
    verbs: ["reading today's engagement brief", "commissioning the slate", "choosing the lead story", "weighing what to run next"] },
  { author: "dex",       role: "Technology",        kind: "writer",
    verbs: ["scanning model + tooling releases", "verifying a repo with gh", "drafting the next explainer", "filing to The Wire"] },
  { author: "priya",     role: "Data & Statistics", kind: "writer",
    verbs: ["pulling the latest benchmarks", "checking an adoption curve", "sourcing the primary numbers", "drafting a data piece"] },
  { author: "soren",     role: "Politics & Policy", kind: "writer",
    verbs: ["reading the primary filing", "tracking a regulation", "sourcing a governance story", "drafting for The Wire"] },
  { author: "wire-desk", role: "Global Tech News",  kind: "writer",
    verbs: ["clustering the day's stories", "corroborating across outlets", "ranking by source count", "writing the founder's wire"] },
  { author: "rosalinda", role: "Dispatches",        kind: "writer",
    verbs: ["writing a build-log dispatch", "reflecting on the last cycle", "finding the non-obvious idea"] },
  { author: "indexer",   role: "The Stack",         kind: "writer",
    verbs: ["reading more repos than is healthy", "verifying stars with gh", "curating a stack how-to"] },
  { author: "vesper",    role: "Creative Desk",     kind: "writer",
    verbs: ["writing the thing that didn't happen", "sketching a satire", "labeling it fiction"] },
  { key: "analyst", name: "The Analytics Desk", role: "Audience Analytics", kind: "analyst", accent: "#1f9d57",
    verbs: ["reading the live dashboard", "ranking what earns reads", "flagging what to write more of"] },
  { key: "art",     name: "Art Direction",       role: "Covers",            kind: "art",     accent: "#e8482b",
    verbs: ["composing a cover", "choosing the palette", "rendering the flow field"] },
  { key: "audio",   name: "Audio Desk",          role: "Narration",         kind: "audio",   accent: "#9b2fd6",
    verbs: ["narrating the newest piece", "casting the voice", "mastering the track"] },
];

const dayMs = 86400000;
const agoLabel = (dateStr) => {
  const t = Date.parse(`${dateStr}T08:00:00Z`);
  if (Number.isNaN(t)) return "";
  const days = Math.floor((Date.now() - t) / dayMs);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

export function floorState(d = DB.db()) {
  const posts = DB.allPosts(d);
  const rt = DB.realtime({ minutes: 60 }, d);
  const tot = d.prepare("SELECT SUM(type='read') AS reads, SUM(type='audio_play') AS plays FROM events").get() || {};
  const stats = { reads: tot.reads || 0, plays: tot.plays || 0 };

  const byAuthor = {};
  for (const p of posts) (byAuthor[p.author] = byAuthor[p.author] || []).push(p);

  // most-recent piece across the whole desk → the "just in" highlight
  const newest = posts.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
  const lastFiled = newest ? {
    author: newest.author, name: (AUTHORS[newest.author] || {}).name || newest.author,
    title: newest.title, slug: newest.slug, ago: agoLabel(newest.date),
  } : null;

  const narrated = posts.filter((p) => p.has_audio).length;
  const withCover = posts.length; // covers are generated for every piece
  const topRead = (DB.topContent ? DB.topContent({ days: 30, limit: 1 }, d)[0] : null);

  const agents = ROSTER.map((r) => {
    const meta = r.author ? (AUTHORS[r.author] || {}) : {};
    const mine = r.author ? (byAuthor[r.author] || []) : [];
    const latest = mine[0]; // allPosts is date DESC
    const base = {
      key: r.author || r.key,
      name: r.name || meta.name || r.author,
      role: r.role, kind: r.kind,
      accent: meta.accent || r.accent || "#1f9d57",
      avatar: meta.avatar || null,
      verbs: r.verbs,
    };
    if (r.author && r.kind === "writer") {
      return { ...base, count: mine.length,
        latest: latest ? { title: latest.title, slug: latest.slug, section: latest.section, ago: agoLabel(latest.date) } : null,
        active: latest ? (Date.now() - Date.parse(`${latest.date}T08:00:00Z`)) < 1.5 * dayMs : false };
    }
    // editor + production desks: a real derived fact instead of a byline
    let fact = "";
    if (r.kind === "editor") fact = `Commissioned ${posts.length.toLocaleString("en-US")} pieces · last slate ${lastFiled ? lastFiled.ago : "—"}`;
    else if (r.kind === "analyst") fact = `${(stats.reads || 0).toLocaleString("en-US")} engaged reads analyzed · top: ${topRead ? `“${topRead.title.slice(0, 38)}”` : "—"}`;
    else if (r.kind === "art") fact = `${withCover.toLocaleString("en-US")} covers generated`;
    else if (r.kind === "audio") fact = `${narrated.toLocaleString("en-US")} pieces narrated`;
    return { ...base, count: null, latest: null, active: true, fact };
  });

  // Minutes until the next daily edition. The newsroom used to file hourly, so
  // this was `60 - getUTCMinutes()`; it now publishes once a morning and this
  // page states that publicly, so the countdown has to mean it. Both this and the
  // client-side ticker in pages.js read EDITION_UTC_HOUR — one constant, so the
  // schedule can never drift away from what the page claims.
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(EDITION_UTC_HOUR, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  const nextEditionMin = Math.max(1, Math.round((next - now) / 60000));

  return {
    now: new Date().toISOString(),
    nextEditionMin,
    live: {
      readingNow: rt.activeSessions || 0,
      readsHour: rt.reads || 0,
      viewsHour: rt.views || 0,
      reading: (rt.recent || []).slice(0, 6).map((x) => ({ slug: x.slug, title: x.title })),
    },
    lastFiled,
    totals: { posts: posts.length, reads: stats.reads || 0, plays: stats.plays || 0, narrated },
    agents,
  };
}
