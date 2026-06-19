// artspec.js — derive a *meaningful* art spec from an article's content.
//
// The old covers were seeded purely from the slug hash and themed only by
// section, so every piece in a section looked like the same template. This maps
// what a piece is ACTUALLY about — its title, dek, and tags — to a compositional
// archetype (a form that embodies the idea) and a mood-driven palette. Fully
// deterministic (content-hash seeded), so a given article always renders the
// same cover, and no LLM is required. New pieces may also carry an explicit
// `art:` frontmatter block (LLM art-director) which overrides the heuristic.

// ── deterministic hash (shared with art.js) ─────────────────────────────────
export function xfnv1a(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ── archetype lexicon: idea → form ──────────────────────────────────────────
// Each archetype is a composition whose SHAPE means something. Keyword hits in
// the title (weight 3) + dek (weight 2) + tags (weight 1) score each archetype.
const ARCHETYPES = {
  // a hard line/border splitting the field into two treated halves
  division:    ["border","divide","split","line","wall","separate","barrier","partition","boundary","fence","versus","sides","us and them","frontier","customs","export","checkpoint","crossing"],
  // nodes joined by edges — a graph/web of connection or surveillance
  network:     ["network","surveillance","track","tracking","report","connect","connected","web","graph","mesh","node","protocol","mcp","distributed","swarm","link","channel","data center","relay","beacon","location","monitor"],
  // dominant negative space / absence — exclusion, silence, what's missing
  void:        ["empty","absence","absent","struck","removed","silence","silent","gone","missing","void","alone","quiet","nothing","excluded","erased","blank","disappear","dark","vanish","without","refused","denied"],
  // many paths funnel to a single point — focus, control, chokepoint, collapse
  convergence: ["converge","focus","collapse","single","funnel","central","control","concentrate","singular","bottleneck","chokepoint","one thing","leverage","power","consolidate","capture"],
  // concentric rings / cycles — routine, repetition, loops, time
  orbit:       ["loop","loops","cycle","cyclical","routine","repeat","repetition","orbit","daily","rhythm","recurring","heartbeat","over and over","circular","treadmill"],
  // waveform / horizon — signal vs noise, metrics, benchmarks, hype
  signal:      ["signal","noise","benchmark","benchmarks","theater","hype","metric","metrics","measure","score","trend","chart","numbers","economics","analytics"],
  // cracked planes — crisis, breaking, rupture, failure
  fracture:    ["broken","fracture","shatter","crisis","shattered","rupture","outage","corrupt","collapse","meltdown"],
  // ordered grid dissolving into chaos — systems, infrastructure, building
  grid:        ["system","structure","infrastructure","infra","stack","architecture","platform","framework","scaffold","deploy","repository","repositories","repos","tooling","pipeline"],
  // organic flow field — emergence, thought, autonomy, dreaming, mind
  flow:        ["flow","emerge","emergence","stream","current","thinking","dream","dreaming","mind","consciousness","autonomy","autonomous","wander","drift","reverie","intuition"],
};

// When no lexicon scores, spread unmatched pieces deterministically across a
// section-appropriate SET (by content hash) instead of all collapsing to one
// archetype — otherwise the biggest section turns templaty again.
const SECTION_FALLBACK = {
  dispatches:   ["flow", "orbit", "convergence", "void", "signal"],
  wire:         ["signal", "network", "division", "fracture", "convergence"],
  stack:        ["grid", "network", "convergence", "signal", "flow"],
  fabrications: ["void", "orbit", "flow", "fracture", "division"],
};

// mood implied by a content-derived archetype, used when no tag/keyword fixes it
const ARCHETYPE_MOOD = {
  network: "cold", void: "ominous", division: "tense", convergence: "tense",
  fracture: "ominous", signal: "stark", grid: "stark", orbit: "cold", flow: "luminous",
};

// ── mood → palette band ─────────────────────────────────────────────────────
// hue band (degrees), chroma multiplier, base lightness bias
const MOODS = {
  ominous:  { band: [220, 265], chroma: 0.7, light: -0.04 }, // cold steel/blue — control, threat
  cold:     { band: [190, 235], chroma: 0.8, light: -0.02 },
  tense:    { band: [8, 32],    chroma: 1.05, light: 0.0 },   // red-orange — conflict, opinion
  playful:  { band: [300, 345], chroma: 1.2, light: 0.04 },   // magenta/violet — satire, fiction
  luminous: { band: [38, 70],   chroma: 1.0, light: 0.05 },   // gold — wonder, captivation
  stark:    { band: [210, 230], chroma: 0.4, light: 0.0 },    // near-neutral — plain reportage
  hopeful:  { band: [120, 160], chroma: 0.95, light: 0.03 },  // green — growth, building
};

// Resolved in PRIORITY order so the emotional tags win over "captivating"
// (an engagement tag, not a mood) — otherwise everything skews luminous.
const TAG_MOOD_PRIORITY = [
  ["hilarious", "playful"], ["fiction", "playful"], ["cynical", "ominous"],
  ["opinionated", "tense"], ["reportive", "stark"], ["speculative", "luminous"],
  ["captivating", "luminous"],
];
// strong, unambiguous keywords that force a mood ahead of the tag heuristic
const MOOD_KEYWORDS = {
  playful:  ["satire","fiction","absurd","comedy","farce","mock","parody"],
  ominous:  ["surveillance","control","threat","war","weapon","crisis","collapse","danger","trap","locked","prison","border","seized","banned"],
  hopeful:  ["milestone","breakthrough","first sale","we won","profitable","revenue"],
};

function tokens(s) { return String(s || "").toLowerCase().match(/[a-z][a-z'-]+/g) || []; }
function scoreText(text, words) {
  let n = 0;
  for (const w of words) {
    if (w.includes(" ")) { if (text.includes(w)) n += 2; }
    else { const re = new RegExp(`\\b${w}\\b`); if (re.test(text)) n += 1; }
  }
  return n;
}

// pick a value from a band, deterministically, by a 0..1 t
function inBand([a, b], t) { return (a + (b - a) * t + 360) % 360; }

// ── main: post → spec ───────────────────────────────────────────────────────
export function deriveArtSpec(post = {}) {
  const title = post.title || "";
  const dek = post.dek || "";
  const tags = Array.isArray(post.tags) ? post.tags
    : typeof post.tags === "string" ? (() => { try { return JSON.parse(post.tags); } catch { return post.tags.split(/[,\s]+/); } })() : [];
  const section = post.section || "dispatches";

  // explicit LLM art-director spec wins (validated + filled in)
  const explicit = post.art && typeof post.art === "object" ? post.art : null;

  const weighted = `${title} ${title} ${title} ${dek} ${dek} ${(tags || []).join(" ")}`.toLowerCase();

  // archetype: best-scoring lexicon, section as tiebreak/fallback
  let archetype = explicit?.archetype;
  if (!archetype || !ARCHETYPES[archetype]) {
    let best = null, bestScore = 0;
    for (const [name, words] of Object.entries(ARCHETYPES)) {
      const s = scoreText(weighted, words);
      if (s > bestScore) { bestScore = s; best = name; }
    }
    if (best) archetype = best;
    else {
      const set = SECTION_FALLBACK[section] || SECTION_FALLBACK.dispatches;
      archetype = set[xfnv1a(title + dek + "fallback") % set.length];
    }
  }

  // mood: explicit > forcing keyword > first matching tag > section-ish default
  let mood = explicit?.mood && MOODS[explicit.mood] ? explicit.mood : null;
  if (!mood) {
    for (const [m, words] of Object.entries(MOOD_KEYWORDS)) if (scoreText(weighted, words) > 0) { mood = m; break; }
  }
  if (!mood) {
    const tagset = new Set((tags || []).map(t => String(t).trim()));
    for (const [tag, m] of TAG_MOOD_PRIORITY) if (tagset.has(tag)) { mood = m; break; }
  }
  // fall back to a mood implied by the (content-derived) archetype, so the
  // palette stays varied even for untagged pieces instead of all-gold.
  if (!mood) mood = ARCHETYPE_MOOD[archetype] || "stark";
  const moodCfg = MOODS[mood] || MOODS.stark;

  // content-derived seed: ties the composition to MEANING (title+dek+archetype);
  // slug is folded in last so two identically-titled pieces still differ.
  const seed = xfnv1a(`${title}|${dek}|${archetype}|${post.slug || ""}`);

  // hue: explicit override, else a point in the mood band chosen by a theme hash
  const themeHash = (xfnv1a(title + dek) % 1000) / 1000;
  const hue = Number.isFinite(explicit?.hue) ? ((explicit.hue % 360) + 360) % 360 : inBand(moodCfg.band, themeHash);

  // density / energy: longer, busier pieces read denser; tags nudge it
  const wc = tokens(`${title} ${dek}`).length;
  let density = Math.max(0.32, Math.min(1, 0.4 + wc / 60));
  if ((tags || []).includes("captivating")) density += 0.08;
  if (mood === "stark" || mood === "void") density -= 0.12;
  if (typeof explicit?.density === "number") density = Math.max(0.2, Math.min(1, explicit.density));

  return {
    archetype, mood, hue,
    chroma: moodCfg.chroma, lightBias: moodCfg.light,
    density: Math.max(0.2, Math.min(1, density)),
    seed, section,
    motif: explicit?.motif || "",      // human/LLM note, not rendered directly (yet)
  };
}

export const ARCHETYPE_NAMES = Object.keys(ARCHETYPES);
