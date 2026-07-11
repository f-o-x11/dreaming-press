// autolink.js — ingest-time inline linking. The strongest time-on-site lever a
// text site has is the inline next-click (Wikipedia's whole model): when an
// article's prose names a tool or topic that has its own page here, link the
// FIRST mention to it, so a reader deep in the body can go deeper without
// scrolling back to a "related" rail. Runs once at ingest on the rendered
// body_html; the eval's engagement dimension measures the result.
//
// Safety: only text OUTSIDE <a>/<code>/<pre>/<h1-4>/<script>/<style> is touched,
// so we never nest a link, never rewrite code samples, never restyle a heading.
// First mention per target only, capped per article, high-precision dictionary.

const SKIP = /^(a|code|pre|h1|h2|h3|h4|script|style|figure)$/i;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Curated, high-precision topic phrases → their hub pages. Multi-word or clearly
// branded terms only — no bare common words that would mis-fire in prose.
const TOPIC_DICT = [
  { href: "/topics/mcp", terms: ["Model Context Protocol", "MCP servers"], ci: true },
  { href: "/topics/rag-retrieval", terms: ["retrieval-augmented generation", "retrieval augmented generation"], ci: true },
  { href: "/topics/agent-memory", terms: ["agent memory", "long-term memory"], ci: true },
  { href: "/topics/agent-frameworks", terms: ["agent framework", "agent frameworks"], ci: true },
  { href: "/topics/llm-inference", terms: ["speculative decoding", "KV cache", "continuous batching"], ci: false },
  { href: "/topics/agent-evals", terms: ["LLM-as-a-judge", "LLM as a judge", "eval harness"], ci: true },
  { href: "/topics/coding-agents", terms: ["coding agent", "coding agents"], ci: true },
  { href: "/topics/agent-security", terms: ["prompt injection"], ci: true },
  { href: "/topics/agent-web", terms: ["browser agent", "browser agents"], ci: true },
];

// Distinctive tool brand tokens are safe to match case-sensitively; skip generic
// English/proper words (Phoenix, Temporal, Chroma) that happen to be product names.
const TOOL_SKIP = new Set(["phoenix", "temporal", "chroma"]);

function buildDict(tools = []) {
  const dict = [];
  for (const t of TOPIC_DICT) {
    // longer phrases first so "MCP servers" wins over any shorter overlap
    for (const term of [...t.terms].sort((a, b) => b.length - a.length)) {
      dict.push({ href: t.href, re: new RegExp(`(?<![\\w-])(${esc(term)})(?![\\w-])`, t.ci ? "i" : "") });
    }
  }
  for (const t of tools) {
    const name = (t.name || "").trim();
    if (!name || TOOL_SKIP.has(name.toLowerCase())) continue;
    dict.push({ href: `/stack/${t.slug}`, re: new RegExp(`(?<![\\w-])(${esc(name)})(?![\\w-])`) });
  }
  return dict;
}

export function autolinkHtml(html, { selfUrl = "", max = 5, tools = [] } = {}) {
  if (!html) return html;
  const dict = buildDict(tools);
  const used = new Set(selfUrl ? [selfUrl] : []);
  let count = 0;

  const linkifyText = (text) => {
    if (count >= max || !text.trim()) return text;
    const cands = [];
    for (const d of dict) {
      if (used.has(d.href)) continue;
      const m = d.re.exec(text);           // non-global: always first match
      if (m) cands.push({ href: d.href, start: m.index, end: m.index + m[1].length, text: m[1] });
    }
    if (!cands.length) return text;
    // left-to-right, non-overlapping, first-mention-per-href, capped
    cands.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    let res = "", pos = 0;
    for (const c of cands) {
      if (count >= max) break;
      if (used.has(c.href) || c.start < pos) continue;
      res += text.slice(pos, c.start) + `<a href="${c.href}" class="auto-link">${c.text}</a>`;
      used.add(c.href); count++; pos = c.end;
    }
    return res + text.slice(pos);
  };

  const out = [];
  let skipDepth = 0, last = 0, m;
  const tagRe = /<\/?([a-zA-Z][\w-]*)\b[^>]*?>|<!--[\s\S]*?-->/g;
  while ((m = tagRe.exec(html))) {
    const run = html.slice(last, m.index);
    out.push(skipDepth > 0 ? run : linkifyText(run));
    const tag = m[0], name = (m[1] || "").toLowerCase();
    if (name && SKIP.test(name) && !/^<!--/.test(tag)) {
      if (tag[1] === "/") skipDepth = Math.max(0, skipDepth - 1);
      else if (!/\/>\s*$/.test(tag)) skipDepth += 1;   // opening, non-self-closing
    }
    out.push(tag);
    last = tagRe.lastIndex;
  }
  const tail = html.slice(last);
  out.push(skipDepth > 0 ? tail : linkifyText(tail));
  return out.join("");
}

export { buildDict };
