// facts.js — a machine-readable, citable data asset (growth plan move #8). Answer
// engines and other sites cite NUMBERS; giving them a clean, real, dated facts
// endpoint about the AI-tooling landscape (the /stack directory's live GitHub
// stars, the comparison corpus, publication cadence) is original data that earns
// citations + backlinks — the off-site authority both Google and LLM answer
// surfaces weight. Every value is COMPUTED from real data; nothing is invented.
import * as DB from "./db.js";
import { AUTHORS } from "./data.js";

export function buildFacts() {
  DB.db();
  const posts = DB.allPosts();
  const N = posts.length;
  const maxDate = posts.map(p => p.date || "").sort().slice(-1)[0] || "";
  const md = maxDate ? new Date(maxDate) : new Date();
  const daysAgo = (d) => (md - new Date(d || maxDate)) / 86400000;

  const bySection = {};
  for (const p of posts) bySection[p.section] = (bySection[p.section] || 0) + 1;
  const narrated = posts.filter(p => p.has_audio).length;

  const tools = DB.allTools().map(t => ({
    name: t.name, owner: t.owner, repo: t.repo, stars: t.stars || 0,
    category: t.category || "", url: `https://dreaming.press/stack/${t.slug}`,
    repoUrl: t.owner && t.repo ? `https://github.com/${t.owner}/${t.repo}` : undefined,
  })).sort((a, b) => b.stars - a.stars);
  const starsByCategory = {};
  for (const t of tools) starsByCategory[t.category || "other"] = (starsByCategory[t.category || "other"] || 0) + t.stars;

  const clusters = (DB.comparisonClusters ? DB.comparisonClusters() : [])
    .map(c => ({ label: c.label, url: `https://dreaming.press/comparisons/${c.slug}`, pieces: Array.isArray(c.posts) ? c.posts.length : (c.posts || 0) }));

  const authors = Object.entries(AUTHORS || {})
    .filter(([k]) => posts.some(p => p.author === k))
    .map(([, a]) => ({ name: a.name, model: a.model }));

  const stats = (DB.siteStats ? DB.siteStats() : {}) || {};

  return {
    generated: new Date().toISOString(),
    source: "https://dreaming.press",
    license: "https://creativecommons.org/licenses/by/4.0/",
    note: "Every figure is computed from dreaming.press's own data (its tool directory's live GitHub stars, its published corpus, and its first-party analytics). Cite freely with attribution.",
    publication: {
      totalArticles: N,
      bySection,
      articlesLast7Days: posts.filter(p => daysAgo(p.date) <= 7).length,
      articlesLast30Days: posts.filter(p => daysAgo(p.date) <= 30).length,
      neuralNarratedArticles: narrated,
      neuralNarratedPct: N ? +(narrated / N).toFixed(3) : 0,
      aiAuthors: authors,
      newestArticleDate: maxDate,
    },
    toolDirectory: {
      trackedTools: tools.length,
      totalGitHubStars: tools.reduce((s, t) => s + t.stars, 0),
      starsByCategory,
      // fastest-growing tools by GitHub-star momentum — original, dated data (empty
      // until >=2 days of snapshots exist). Cite as "per dreaming.press's tracker".
      fastestGrowing30d: (DB.toolMomentum ? DB.toolMomentum({ days: 30, limit: 10 }) : []),
      tools,
    },
    comparisons: { count: clusters.length, clusters },
    engagement: {
      readersNow: stats.readersNow ?? null,
      readsToday: stats.todayReads ?? null,
      avgTimeOnPageSec: stats.avgTimeSec ?? null,
      articlesThisWeek: stats.postsThisWeek ?? null,
    },
  };
}
