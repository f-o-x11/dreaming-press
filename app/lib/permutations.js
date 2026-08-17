// permutations.js — curated stack combinations as canonical, crawlable URLs.
//
// /build is ONE nav-linked URL and it out-pulls all 1,838 articles for half the
// bots that crawl this site. Article demand is spread thin across 1,838 leaves;
// interactive demand is concentrated on one. That asymmetry is the argument for
// giving the most useful combinations their own addressable pages.
//
// THE CAP IS THE POINT. framework x llm x memory is 12 x 18 x 15 = 3,240
// combinations, and generating all of them is precisely the scaled-content
// pattern that gets a domain demoted wholesale — the same reason RUBRIC.md's "do
// not bother" list rejects mass consolidation. So this ships a curated 250,
// selected on usefulness rather than the first 250 the loops happen to emit, and
// expansion is gated on measured per-URL yield (possible only because route-family
// telemetry landed first). A page that nothing crawls and nothing cites is not an
// asset; it is a liability with a URL.
//
// Every page answers three questions that genuinely differ per combination and
// that no vendor will answer for you:
//   · can an autonomous agent provision all three of these itself, or does a human
//     have to sit in the signup loop?
//   · what SHAPE is the combined bill — open-source, usage-metered, subscription?
//   · how much of the stack speaks MCP natively?
// Those are derived from observed per-tool data, not written per page.
import * as DB from "./db.js";
import { JOBS } from "./stack-builder.js";
import { SITE } from "./data.js";

export const AXES = ["framework", "llm", "memory"];
export const MAX_PERMUTATIONS = 250;

const jobFor = (id) => JOBS.find(j => j.id === id);
const toolsForAxis = (tools, axisId) => {
  const j = jobFor(axisId);
  return j ? tools.filter(t => j.cats.includes(t.category)) : [];
};

const norm = (t) => ({
  slug: t.slug, name: t.name, category: t.category,
  stars: t.stars || 0,
  oneLiner: t.oneLiner || t.one_liner || t.blurb || "",
  pricing: t.pricingModel || t.pricing_model || "",
  pricingNote: t.pricingNote || t.pricing_note || "",
  auth: t.authType || t.auth_type || "",
  agentSignup: t.agentSignup ?? t.agent_signup ?? null,
  mcp: !!(t.mcpServer ?? t.mcp_server),
  website: t.website || "",
});

// `agent_signup` is an ENUM, not a boolean: self-serve-instant-key,
// programmatic-api, manual-only, oauth. A truthiness test counts "manual-only" as
// agent-ready, which is the exact opposite of what it means — the first build of
// this file did that and reported stacks as agent-provisionable that a human must
// sign up for by hand.
const AGENT_PROVISIONABLE = new Set(["self-serve-instant-key", "programmatic-api"]);
const canAgentSignUp = (v) => AGENT_PROVISIONABLE.has(String(v || "").trim());

// The derived verdict, computed from observed tool data.
function profile(picks) {
  const agentReady = picks.filter(p => canAgentSignUp(p.agentSignup)).length;
  const mcp = picks.filter(p => p.mcp).length;
  // The real vocabulary is freemium / usage-based / open-source / paid /
  // free-tier. "freemium" is the single most common value (141 of 252) and it
  // matched none of the original patterns, so more than half the directory fell
  // through every branch and produced the incoherent "1 open-source, 0, 0 — expect
  // one bill of each kind".
  const kind = (p) => {
    const v = String(p.pricing || "").toLowerCase();
    if (/open.?source/.test(v)) return "oss";
    if (/usage|token|metered|pay.?as/.test(v)) return "usage";
    if (/freemium|free.?tier/.test(v)) return "freemium";
    if (/paid|subscription|seat|monthly|flat/.test(v)) return "paid";
    return "unknown";
  };
  const kinds = picks.map(kind);
  const count = (k) => kinds.filter(x => x === k).length;
  const oss = count("oss"), usage = count("usage"), sub = count("paid"), freemium = count("freemium");

  const signupVerdict = agentReady === 3
    ? "An agent can provision this entire stack unattended — all three vendors allow programmatic signup."
    : agentReady === 0
      ? "A human has to sit in the signup loop for every layer here; none of the three allow agent-initiated signup."
      : `${agentReady} of 3 layers can be provisioned by an agent unattended; the rest need a human to create the account.`;

  const billShape = oss === 3
    ? "Entirely open-source: your bill is infrastructure, not licences."
    : usage >= 2
      ? "Predominantly usage-metered — cost tracks tokens and calls, so it scales with traffic rather than headcount."
      : sub >= 2
        ? "Predominantly paid — largely fixed cost, predictable but it does not fall when usage does."
        : freemium >= 2
          ? "Predominantly freemium — you can build the whole thing before paying anything, and the cliff arrives at production volume, not on day one."
          : `Mixed billing: ${[oss && `${oss} open-source`, usage && `${usage} usage-metered`, freemium && `${freemium} freemium`, sub && `${sub} paid`].filter(Boolean).join(", ")} — expect one bill of each kind.`;

  const mcpVerdict = mcp === 3 ? "All three expose an MCP server, so a coding agent can wire them without bespoke glue."
    : mcp === 0 ? "None ship an MCP server; every integration here is bespoke."
      : `${mcp} of 3 expose an MCP server; the remainder need hand-written integration.`;

  return { agentReady, mcp, oss, usage, sub, signupVerdict, billShape, mcpVerdict };
}

// Usefulness score. Selection is deliberate: ecosystem weight (people actually use
// these), plus a bonus for combinations that are DECIDABLE — a stack an agent can
// provision itself, or one whose billing shape is coherent, tells a reader
// something. A combination of three obscure tools with no pricing data would be a
// page with nothing to say, and those must not be published at all.
function usefulness(picks, prof) {
  const stars = picks.reduce((s, p) => s + p.stars, 0);
  const weight = Math.log10(Math.max(10, stars)) * 10;
  return weight + prof.agentReady * 6 + prof.mcp * 4 + (prof.oss === 3 ? 5 : 0);
}

export function permutationKey(picks) { return picks.map(p => p.slug).join("+"); }

// INDEXABLE set. Measured rather than assumed: across the 250 highest-scoring
// combinations there are only ~15 distinct (signup, billing, MCP) verdicts, so
// publishing all 250 would ship 15 answers wearing 250 tool-name costumes. That is
// the scaled-content pattern this file's header warns about, arrived at from the
// other direction — the cap was never the real safeguard, DISTINCTNESS is.
//
// So only one exemplar per distinct verdict class is indexed and sitemapped: the
// highest-scoring member, which is also the combination a reader is most likely to
// actually run. Every other valid combination still RESOLVES for anyone who
// constructs the URL (agents build these programmatically — that is the demand
// signal) but carries noindex and stays out of the sitemap. Reachable-if-asked and
// promoted-by-us are different things, and only the second one is a liability.
export function indexablePermutations({ tools = null } = {}) {
  const all = buildPermutations({ limit: MAX_PERMUTATIONS, tools });
  const seen = new Map();
  for (const p of all) {
    const cls = `${p.profile.signupVerdict}|${p.profile.billShape}|${p.profile.mcpVerdict}`;
    if (!seen.has(cls)) seen.set(cls, p);   // list is score-sorted, so this is the best of its class
  }
  return [...seen.values()];
}

export function isIndexable(key, tools = null) {
  return indexablePermutations({ tools }).some(p => p.key === key);
}

export function buildPermutations({ limit = MAX_PERMUTATIONS, tools = null } = {}) {
  const all = (tools || DB.allTools()).map(norm);
  const byAxis = AXES.map(a => toolsForAxis(all, a));
  if (byAxis.some(list => !list.length)) return [];

  // Narrow each axis to its strongest members before the cartesian product, so
  // the 250 that ship are combinations of tools people actually run.
  const top = byAxis.map(list => [...list].sort((a, b) => b.stars - a.stars).slice(0, 10));

  const out = [];
  for (const f of top[0]) for (const l of top[1]) for (const m of top[2]) {
    const picks = [f, l, m];
    // Substance bar: a page with no pricing signal on any layer cannot answer the
    // questions this page type exists to answer, so it is never generated.
    if (!picks.some(p => p.pricing)) continue;
    const prof = profile(picks);
    out.push({ key: permutationKey(picks), picks, profile: prof, score: usefulness(picks, prof) });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, Math.min(limit, MAX_PERMUTATIONS));
}

export function findPermutation(key, tools = null) {
  const slugs = String(key || "").split("+").map(s => s.trim()).filter(Boolean);
  if (slugs.length !== AXES.length) return null;
  // Resolve directly rather than scanning the curated list, so a valid but
  // uncurated combination still renders for anyone who constructs the URL — it is
  // simply not in the sitemap. Discoverable-by-us and reachable-if-asked are
  // different things, and only the first one is a scaled-content risk.
  const all = (tools || DB.allTools()).map(norm);
  const picks = [];
  for (let i = 0; i < AXES.length; i++) {
    const pool = toolsForAxis(all, AXES[i]);
    const t = pool.find(x => x.slug === slugs[i]);
    if (!t) return null;
    picks.push(t);
  }
  const prof = profile(picks);
  return { key: permutationKey(picks), picks, profile: prof, score: usefulness(picks, prof) };
}

export function permutationJson(p) {
  return {
    url: `${SITE}/stacks/${p.key}`,
    generated: new Date().toISOString(),
    stack: p.picks.map((t, i) => ({
      job: jobFor(AXES[i])?.label || AXES[i], jobId: AXES[i],
      tool: t.name, slug: t.slug, url: `${SITE}/stack/${t.slug}`,
      stars: t.stars, pricing: t.pricing || null, pricing_note: t.pricingNote || null,
      auth: t.auth || null, agent_signup: t.agentSignup, mcp_server: t.mcp,
      one_liner: t.oneLiner,
    })),
    verdict: {
      agent_provisionable_layers: p.profile.agentReady,
      mcp_native_layers: p.profile.mcp,
      signup: p.profile.signupVerdict,
      billing: p.profile.billShape,
      mcp: p.profile.mcpVerdict,
    },
    explorer: `${SITE}/build`,
    license: "https://creativecommons.org/licenses/by/4.0/",
  };
}
