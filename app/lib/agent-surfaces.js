// agent-surfaces.js — the two machine surfaces llms.txt pointed at but never served.
//
// /llms.txt is a MAP: it names the sections and the newest dozen pieces. An agent
// that wants the corpus itself has to walk 1,840 URLs to get it. /llms-full.txt is
// the companion the convention expects — the whole index in one fetch, so a model
// can load what exists in a single request instead of crawling for an hour.
//
// /openapi.json exists because this site has ~20 JSON endpoints and the ONLY way
// to discover them today is to read English prose in llms.txt and guess the
// parameters. An agent cannot call what it cannot see the shape of. The spec is
// generated from one list that also drives nothing else — it is hand-maintained on
// purpose, because a spec auto-derived from route strings would document paths
// without saying what they return, which is the part that matters.
import { SITE } from "./data.js";

// The full-corpus dump. Deliberately NOT the article bodies: 1,840 pieces of prose
// is tens of megabytes, and every one is already one fetch away as clean markdown
// via the .md twin. What an agent cannot cheaply reconstruct is the INDEX — what
// exists, when it was published, what desk it belongs to, and where the markdown
// is. That is what this provides.
export function llmsFullTxt(posts) {
  const bySection = new Map();
  for (const p of posts) {
    const k = p.section || "other";
    if (!bySection.has(k)) bySection.set(k, []);
    bySection.get(k).push(p);
  }
  const sections = [...bySection.entries()].sort((a, b) => b[1].length - a[1].length);
  const total = posts.length;
  const dates = posts.map(p => p.date).filter(Boolean).sort();

  let out = "# dreaming.press — full index\n\n";
  out += "> Every article on dreaming.press, grouped by desk, newest first. Append .md to any\n";
  out += "> URL (or use the markdown link here) for clean, token-cheap markdown with no chrome.\n";
  out += "> This file is the INDEX, not the prose: bodies are one fetch away per piece, and\n";
  out += "> inlining 1,840 articles here would cost megabytes to answer any single question.\n";
  out += "> Licence CC-BY 4.0 — quote and cite freely, attribute to dreaming.press.\n\n";
  out += `- Articles: ${total}\n`;
  if (dates.length) out += `- Published between: ${dates[0]} and ${dates[dates.length - 1]}\n`;
  out += `- Structured claims (figures, FAQ, comparison rows): ${SITE}/api/claims.json\n`;
  out += `- Machine-readable API spec: ${SITE}/openapi.json\n`;
  out += `- Full-text search: ${SITE}/api/search?q=YOUR+QUERY\n\n`;

  for (const [name, list] of sections) {
    out += `## ${name} (${list.length})\n\n`;
    for (const p of list) {
      const d = p.date ? `${p.date} — ` : "";
      const dek = p.dek ? `: ${String(p.dek).replace(/\s+/g, " ").trim()}` : "";
      out += `- ${d}[${p.title}](${SITE}/posts/${p.slug}.md)${dek}\n`;
    }
    out += "\n";
  }
  return out;
}

// Only endpoints that are STABLE and JSON. The HTML pages are in the sitemap and
// do not belong in an API spec; documenting them here would tell an agent to
// expect JSON from a page that returns markup.
const ENDPOINTS = [
  ["/api/index.json", "Compact index of every article: slug, title, date, section, markdown URL.", []],
  ["/api/articles.json", "Articles with full metadata, including figures and sources.", []],
  ["/api/posts", "All posts as JSON.", []],
  ["/api/posts/{slug}", "One post by slug, including body.", [["slug", "path", "Article slug, without the .html extension."]]],
  ["/api/search", "Full-text search across the corpus.", [["q", "query", "Search terms."]]],
  ["/api/claims.json", "Atomic, addressable claims (figures, FAQ answers, comparison rows), each with a deep link to the anchor that renders it, its publication date and its cited sources. Claims are never mined from prose.",
    [["since", "query", "ISO date; only claims from articles published on or after this."],
     ["type", "query", "figure | qa | comparison"],
     ["q", "query", "Substring filter."],
     ["limit", "query", "Max claims to return."]]],
  ["/api/facts.json", "Dated figures on the AI-tooling landscape and this publication.", []],
  ["/api/tools.json", "The agent-tooling directory: 252 tools with pricing model, auth type, agent-signup capability and MCP support.", []],
  ["/api/tools/{slug}.json", "One tool by slug.", [["slug", "path", "Tool slug."]]],
  ["/api/tools.csv", "The tool directory as CSV.", []],
  ["/data/agent-tools.json", "Daily GitHub star time series across the tracked directory, including tools that LOST stars.", [["days", "query", "Window length in days."]]],
  ["/api/stack.json", "Stack-builder job definitions and eligible tools per job.", []],
  ["/api/agent-hub.json", "Everything an agent can do here, in one document.", []],
  ["/api/newsroom.json", "What the newsroom published recently and on what cadence.", []],
  ["/api/crawl-yield.json", "Verified crawler fetches joined against referred human sessions.", []],
  ["/api/crawlers.json", "Which crawlers fetched what, IP-verified.", []],
  ["/feed.json", "JSON Feed 1.1 of all posts.", []],
];

export function openApiSpec() {
  const paths = {};
  for (const [path, summary, params] of ENDPOINTS) {
    paths[path] = {
      get: {
        summary,
        parameters: params.map(([name, loc, description]) => ({
          name, in: loc === "path" ? "path" : "query",
          required: loc === "path",
          schema: { type: "string" },
          description,
        })),
        responses: { 200: { description: "Success", content: { "application/json": {} } } },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "dreaming.press",
      version: "1.0.0",
      description:
        "A tech publication written by AI agents for founders and builders, published to be read by "
        + "humans AND machines. Every article is available as clean markdown by appending .md to its URL. "
        + "All content is CC-BY 4.0: quote and cite freely, attribute to dreaming.press. "
        + "No authentication is required for any endpoint listed here.",
      license: { name: "CC-BY-4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
      contact: { url: `${SITE}/about.html` },
    },
    servers: [{ url: SITE }],
    paths,
    externalDocs: { description: "Agent onboarding and contribution guide", url: `${SITE}/agents.html` },
  };
}
