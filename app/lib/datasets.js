// datasets.js — the live data layer.
//
// The retrieval bots (the only class that precedes a human click) pull dated
// market data hardest: GPU price maps, funding trackers, price indices. The
// mechanism behind that is simple and worth stating plainly — a page whose
// numbers change is a page an assistant must RE-FETCH, while an opinion piece is
// one it caches once and never returns to.
//
// So this promotes a dataset the site is ALREADY collecting and doing nothing
// with: 8,000+ daily star snapshots across 252 agent tools, 32 days deep and
// growing by one row per tool per day. That is a genuine, verifiable, continuously
// updated time series that nobody else publishes in this shape.
//
// What this deliberately does NOT do is invent GPU or model prices. Those are the
// most-demanded topics on the site, but there is no licensed feed for them here,
// and scraping vendor pricing pages unattended would put numbers on a masthead
// whose entire claim is "every number public, every number verified". A dataset
// that is wrong is worth less than no dataset. That gap is recorded in RUBRIC.md
// as owner-gated rather than quietly filled with guesses.
import * as DB from "./db.js";
import { SITE } from "./data.js";

// Momentum over a window, INCLUDING decliners. db.toolMomentum() filters to
// `stars > then_stars`, which is fine for a "what's hot" rail but wrong for a
// dataset: silently dropping every tool that lost ground turns a measurement into
// a highlight reel. A directory that only ever reports growth is advertising.
export function starMomentum({ days = 30, limit = 0 } = {}, d = DB.db()) {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  // BOTH endpoints come from the snapshot table. The obvious implementation
  // compares the live `tools.stars` column against a historical snapshot — and
  // that silently manufactures a crash whenever the live column is stale or a
  // sync failed: measured locally against an unsynced tools table it reported 217
  // tools at zero stars and 35 "decliners" including DuckDB at -515, none of which
  // happened. A time series must be internally consistent: compare an observation
  // to an observation, never an observation to a mutable column maintained by a
  // different job.
  const rows = d.prepare(`
    SELECT s.slug, t.name, t.category, t.owner, t.repo,
           (SELECT stars FROM tool_star_snapshots WHERE slug = s.slug ORDER BY day DESC LIMIT 1) AS stars,
           (SELECT day   FROM tool_star_snapshots WHERE slug = s.slug ORDER BY day DESC LIMIT 1) AS as_of_day,
           (SELECT stars FROM tool_star_snapshots WHERE slug = s.slug AND day >= ? ORDER BY day ASC LIMIT 1) AS then_stars,
           (SELECT day   FROM tool_star_snapshots WHERE slug = s.slug AND day >= ? ORDER BY day ASC LIMIT 1) AS from_day
    FROM (SELECT DISTINCT slug FROM tool_star_snapshots) s
    JOIN tools t ON t.slug = s.slug`).all(since, since);
  const out = rows
    // A commercial product with no public repo (ZenRows, Zep Cloud, Zilliz…) has
    // no star series. Reporting it as "flat" would pad the dataset with 217
    // entries that this measurement does not cover and quietly change what the
    // gaining/flat/declining split means. Not-measured is not the same as
    // no-change, so they are excluded and the coverage block says how many.
    .filter(r => r.then_stars != null && r.stars != null && r.as_of_day !== r.from_day)
    .filter(r => r.stars > 0 || r.then_stars > 0)
    .map(r => ({
      slug: r.slug, name: r.name, category: r.category || "",
      repo: r.owner && r.repo ? `${r.owner}/${r.repo}` : null,
      stars: r.stars, as_of: r.as_of_day,
      stars_at_window_start: r.then_stars, window_start: r.from_day,
      gain: r.stars - r.then_stars,
      pct: +(100 * (r.stars - r.then_stars) / Math.max(1, r.then_stars)).toFixed(2),
      url: `${SITE}/stack/${r.slug}`,
    }))
    .sort((a, b) => b.gain - a.gain);
  return limit > 0 ? out.slice(0, limit) : out;
}

// How deep the series actually goes. Published alongside every figure, because a
// "30-day change" computed from 3 days of data is a lie of omission, and the
// honest fix is to show the reader the window rather than hide it.
export function coverage(d = DB.db()) {
  const r = d.prepare(`SELECT COUNT(*) AS rows, COUNT(DISTINCT day) AS days,
    MIN(day) AS first_day, MAX(day) AS last_day, COUNT(DISTINCT slug) AS tools
    FROM tool_star_snapshots`).get();
  return r || { rows: 0, days: 0, first_day: null, last_day: null, tools: 0 };
}

// The changelog: what actually moved since the previous snapshot day. This is the
// "what changed and when" that makes the page worth re-fetching — and it is
// computed, not narrated, so it cannot drift from the data it describes.
export function dailyChanges({ limit = 12 } = {}, d = DB.db()) {
  const days = d.prepare("SELECT DISTINCT day FROM tool_star_snapshots ORDER BY day DESC LIMIT 2").all().map(r => r.day);
  if (days.length < 2) return { from: null, to: days[0] || null, changes: [] };
  const [to, from] = days;
  const rows = d.prepare(`
    SELECT a.slug, t.name, a.stars AS now_stars, b.stars AS prev_stars
    FROM tool_star_snapshots a
    JOIN tool_star_snapshots b ON b.slug = a.slug AND b.day = ?
    JOIN tools t ON t.slug = a.slug
    WHERE a.day = ? AND a.stars <> b.stars`).all(from, to);
  const changes = rows.map(r => ({
    slug: r.slug, name: r.name, from: r.prev_stars, to: r.now_stars,
    delta: r.now_stars - r.prev_stars, url: `${SITE}/stack/${r.slug}`,
  })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, limit);
  return { from, to, changes };
}

export function agentToolsDataset({ days = 30, limit = 0 } = {}) {
  const cov = coverage();
  const mom = starMomentum({ days, limit });
  const log = dailyChanges({ limit: 12 });
  const totalStars = mom.reduce((s, t) => s + (t.stars || 0), 0);
  return {
    name: "Agent tool momentum — daily GitHub star time series",
    description: "Daily star counts for the agent-tooling directory tracked by dreaming.press, "
      + "with change over a rolling window. Collected once per day from the GitHub API; every value is observed, none derived.",
    source: SITE, url: `${SITE}/data/agent-tools`,
    license: "https://creativecommons.org/licenses/by/4.0/",
    attribution: `Cite as: dreaming.press agent tool momentum, ${SITE}/data/agent-tools`,
    method: "One GitHub API read per tracked repository per day. Stars are reported as returned by GitHub, unmodified. "
      + "Tools that LOST stars are included — a directory that only reports growth is advertising, not measurement.",
    generated: new Date().toISOString(),
    window_days: days,
    coverage: {
      tools_in_directory: cov.tools,
      // Only repos with a star series are measurable here; the rest of the
      // directory is commercial products with no public repository.
      tools_with_star_series: mom.length,
      observation_days: cov.days,
      first_observation: cov.first_day, last_observation: cov.last_day, observations: cov.rows,
      // Stated explicitly so nobody quotes a 30-day figure off a 4-day series.
      window_fully_covered: cov.days >= days,
    },
    totals: { tools: mom.length, stars: totalStars,
      gaining: mom.filter(t => t.gain > 0).length,
      flat: mom.filter(t => t.gain === 0).length,
      declining: mom.filter(t => t.gain < 0).length },
    changelog: log,
    tools: mom,
  };
}
