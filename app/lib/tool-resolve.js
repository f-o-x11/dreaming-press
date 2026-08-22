// tool-resolve.js — turn a guessed tool URL into the right tool.
//
// The server logs show agents constructing /stack/ URLs that were never
// published: /stack/@upstash/mcp-server, /stack/@pinecone-database/mcp,
// /stack/@supabase/mcp-server-supabase, /stack/fly, /stack/jina, /stack/openai.
// 152 requests across 12 distinct URLs, all 404.
//
// Those are not broken links — nothing on the site ever pointed at them, and the
// internal link audit found zero broken anchors across 6,829 targets. They are
// agents reading an npm package name or a bare vendor name out of an article and
// assuming this site's URL shape. That guess is a DEMAND SIGNAL, and answering it
// costs one lookup.
//
// So: an exact miss tries to resolve. A confident single match 301s to the real
// page. Anything ambiguous keeps its 404 status and offers candidates, because
// serving a 200 for a page that does not exist is how a site teaches a crawler
// that its 404s are unreliable — the opposite of what this fixes.
import * as DB from "./db.js";

// Strip the shapes agents actually produce. "@upstash/mcp-server" -> "upstash";
// "@supabase/mcp-server-supabase" -> "supabase". The npm SCOPE is the vendor and
// is the highest-signal token; the rest is usually "mcp-server" boilerplate.
const NOISE = /(^|-)(mcp|server|docs|sdk|api|cloud|js|node|py|python|client)(-|$)/g;

// A term that is ONLY boilerplate must never be matched on. "@pinecone-database/mcp"
// de-noises to the bare token "mcp", which exact-matches a directory entry called
// mcp-servers — so an agent asking about Pinecone (not in this directory at all)
// got a confident 301 to an unrelated page. A wrong redirect is worse than a 404:
// the agent cannot tell it was answered with the wrong thing.
const STOPWORDS = new Set(["mcp","server","servers","docs","sdk","api","cloud","js","node",
  "py","python","client","tool","tools","app","core","lib","main","cli","db","database"]);

export function candidateTerms(raw) {
  // This runs on raw URL input, so both of these guards are load-bearing:
  // decodeURIComponent throws on a malformed escape like "%%%", and a path of
  // "/" leaves nothing after filter(Boolean) so .pop() returns undefined and the
  // de-noising loop below then calls .replace on it. Either one turns a request
  // that should be a clean 404 into a 500.
  let s;
  try { s = decodeURIComponent(String(raw ?? "")); }
  catch { s = String(raw ?? ""); }
  s = s.trim().toLowerCase();
  if (!s) return [];
  const out = [];
  const scoped = s.match(/^@([^/]+)\/(.+)$/);
  if (scoped) { out.push(scoped[1]); out.push(scoped[2]); }
  out.push(s.replace(/^@/, ""));
  // The last path segment, for "/stack/a/b" that is not npm-scoped.
  if (s.includes("/")) out.push(s.split("/").filter(Boolean).pop() || "");
  // De-noised form: drop the mcp/server/sdk furniture.
  for (const t of [...out]) {
    const cleaned = t.replace(NOISE, "$1").replace(/^-+|-+$/g, "");
    if (cleaned && cleaned !== t) out.push(cleaned);
  }
  return [...new Set(out.filter(Boolean))].filter(t => !STOPWORDS.has(t));
}

// Ranked matches. Exact slug beats prefix beats substring, and a match on the
// vendor token beats a match on the boilerplate half of the package name.
export function resolveTool(raw, tools = null) {
  const all = tools || DB.allTools();
  const terms = candidateTerms(raw);
  if (!terms.length) return { match: null, candidates: [] };

  const scored = new Map();
  const bump = (tool, pts) => {
    if (!tool) return;
    scored.set(tool.slug, Math.max(scored.get(tool.slug) || 0, pts));
  };

  terms.forEach((term, ti) => {
    // Earlier terms are the more specific reading of the URL, so they score higher.
    const w = terms.length - ti;
    for (const t of all) {
      const slug = String(t.slug || "").toLowerCase();
      const name = String(t.name || "").toLowerCase();
      if (slug === term || name === term) bump(t, 100 + w);
      else if (slug.startsWith(term + "-") || slug === term) bump(t, 60 + w);
      else if (name.replace(/\s+/g, "-") === term) bump(t, 60 + w);
      else if (term.length >= 4 && (slug.includes(term) || name.includes(term))) bump(t, 30 + w);
    }
  });

  const ranked = [...scored.entries()]
    .map(([slug, score]) => ({ tool: all.find(t => t.slug === slug), score }))
    .filter(x => x.tool)
    .sort((a, b) => b.score - a.score || (b.tool.stars || 0) - (a.tool.stars || 0));

  if (!ranked.length) return { match: null, candidates: [] };

  // Redirect only when the winner is unambiguous. "openai" matches both
  // openai-agents-sdk and openai-codex at the same score — guessing between two
  // real products is worse than showing the reader both.
  const top = ranked[0];
  const tie = ranked.length > 1 && ranked[1].score === top.score;
  const confident = top.score >= 60 && !tie;
  return {
    match: confident ? top.tool : null,
    candidates: ranked.slice(0, 8).map(r => r.tool),
  };
}
