// analytics.js — "what works": engagement signals that steer the newsroom.
// Attraction = views. Long visit = reads (scroll/dwell) + audio plays + completes.
import { db } from "./db.js";
import { SECTION_ORDER, AUTHORS } from "./data.js";

// per-post engagement, joined from posts + views + events
export function postMetrics(d = db()) {
  const rows = d.prepare(`
    SELECT p.slug, p.title, p.section, p.author, p.date, p.read_time, p.tags,
           COALESCE(v.count,0) AS views,
           COALESCE(SUM(CASE WHEN e.type='read' THEN 1 END),0) AS reads,
           COALESCE(SUM(CASE WHEN e.type='audio_play' THEN 1 END),0) AS plays,
           COALESCE(SUM(CASE WHEN e.type IN ('complete','audio_complete') THEN 1 END),0) AS completes
    FROM posts p
    LEFT JOIN views v ON v.slug = p.slug
    LEFT JOIN events e ON e.slug = p.slug
    GROUP BY p.slug`).all();
  for (const r of rows) {
    r.tags = JSON.parse(r.tags || "[]");
    // engagement: rewards long reads + audio plays + completion, scaled by reach
    r.engagement = r.reads * 1 + r.plays * 1.5 + r.completes * 2;
    r.readRate = r.views ? +(r.reads / r.views).toFixed(3) : 0;
    r.playRate = r.views ? +(r.plays / r.views).toFixed(3) : 0;
    r.score = r.views * 0.4 + r.engagement * 2; // attraction + retention
  }
  return rows;
}

function bucketLen(rt) { return rt <= 3 ? "short (≤3m)" : rt <= 7 ? "medium (4-7m)" : "long (8m+)"; }

function aggregate(rows, keyFn) {
  const m = {};
  for (const r of rows) {
    const keys = keyFn(r);
    for (const k of [].concat(keys)) {
      if (k == null) continue;
      (m[k] ||= { key: k, n: 0, views: 0, reads: 0, plays: 0, engagement: 0 });
      const a = m[k]; a.n++; a.views += r.views; a.reads += r.reads; a.plays += r.plays; a.engagement += r.engagement;
    }
  }
  return Object.values(m).map(a => ({
    ...a,
    avgViews: +(a.views / a.n).toFixed(1),
    readRate: a.views ? +(a.reads / a.views).toFixed(3) : 0,
    playRate: a.views ? +(a.plays / a.views).toFixed(3) : 0,
    engPerPost: +(a.engagement / a.n).toFixed(2),
  })).sort((x, y) => y.engPerPost - x.engPerPost || y.avgViews - x.avgViews);
}

export function report(d = db()) {
  const rows = postMetrics(d);
  const totals = rows.reduce((t, r) => ({
    views: t.views + r.views, reads: t.reads + r.reads, plays: t.plays + r.plays, completes: t.completes + r.completes,
  }), { views: 0, reads: 0, plays: 0, completes: 0 });
  const top = (key, n = 8) => [...rows].sort((a, b) => b[key] - a[key]).slice(0, n)
    .map(r => ({ slug: r.slug, title: r.title, section: r.section, author: r.author,
      views: r.views, reads: r.reads, plays: r.plays, score: +r.score.toFixed(1) }));
  return {
    generated: new Date(0).toISOString(),
    totals,
    posts: rows.length,
    topByScore: top("score"),
    topByViews: top("views"),
    topByEngagement: top("engagement"),
    bySection: aggregate(rows, r => r.section),
    byAuthor: aggregate(rows, r => r.author),
    byTag: aggregate(rows, r => r.tags.length ? r.tags : null),
    byLength: aggregate(rows, r => bucketLen(r.read_time)),
  };
}

// A compact natural-language brief for the editor/journalist prompts.
export function brief(d = db()) { return briefText(report(d)); }

export function briefText(r) {
  const fmt = (arr) => (arr || []).slice(0, 4).map(a =>
    `${a.key} (eng/post ${a.engPerPost}, ${a.avgViews} avg views, ${Math.round(a.readRate * 100)}% read, ${Math.round(a.playRate * 100)}% listen)`).join("; ");
  const top = r.topByScore.slice(0, 5).map(p => `"${p.title}" [${p.section}] ${p.views}v/${p.reads}r/${p.plays}p`).join("\n  ");
  const totalEng = r.totals.reads + r.totals.plays;
  if (!r.totals || (r.totals.views < 5 && totalEng < 3)) {
    return "ENGAGEMENT DATA: still thin (the site is new). Until signal accumulates, prioritize range and quality across all four desks; lean into distinctive, sharable angles and strong audio.";
  }
  return `ENGAGEMENT DATA (what's working — write more of this):
- Totals: ${r.totals.views} views, ${r.totals.reads} long-reads, ${r.totals.plays} audio plays.
- Best sections: ${fmt(r.bySection)}.
- Best voice/tags: ${fmt(r.byTag)}.
- Best length: ${fmt(r.byLength)}.
- Best author voices: ${fmt(r.byAuthor)}.
- Top pieces right now:
  ${top}
Commission toward the sections, lengths, and angles with the highest engagement-per-post and listen rates, while keeping the desk balanced.`;
}
