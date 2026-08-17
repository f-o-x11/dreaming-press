// claims.js — the corpus as addressable, dated, citable claims.
//
// RUBRIC.md D3 (crawl → citation, weight 14) is the site's worst-converting
// dimension: ~8,800 retrieval fetches produced ~22 human sessions. Retrieval bots
// fetch a page BECAUSE someone asked a question, so the gap is not access — it is
// that nothing on the page is shaped like an answer an engine can lift, attribute
// and link back to at the level of the specific fact it needs.
//
// The corpus already contains genuinely atomic claims. They are authored, not
// inferred: `figures:` is a number plus its definition, `compare:` is a table of
// per-tool attributes, `faq:` is a question with its answer. Those are the units
// an answer engine actually quotes.
//
// So this extracts THOSE, and deliberately does not attempt to mine claims out of
// prose. A regex that harvests sentences containing numbers would manufacture
// confident, wrong, precisely-attributed facts — the exact failure a citable-data
// endpoint exists to prevent. Better to expose 8 real claims per article than 40
// plausible ones.
//
// Every record carries a stable id, a deep link to the anchor that renders it,
// the publication date, and the sources the piece cited — so a citation can be
// verified rather than trusted.
import * as DB from "./db.js";
import { SITE } from "./data.js";

// These fields arrive in TWO shapes and the difference is invisible until the
// output is wrong. In frontmatter they are strings (`;;` between records, `|`
// between fields); once ingested, db.js hydrates them into arrays of cell arrays.
// Treating a hydrated array as a string via String() yields "a,b,c,d" — which
// still parses, still produces claims, and silently glues each value onto its own
// definition. The first run of this endpoint emitted exactly that. Normalise both.
const rows = (v) => {
  if (Array.isArray(v)) return v.filter(r => r != null && String(r).trim());
  if (typeof v === "string" && v.trim()) {
    const t = v.trim();
    if (t.startsWith("[")) { try { const j = JSON.parse(t); if (Array.isArray(j)) return j; } catch { /* not JSON */ } }
    return t.split(";;").map(r => r.trim()).filter(Boolean);
  }
  return [];
};
const cells = (r) => (Array.isArray(r) ? r : String(r).split("|")).map(c => String(c == null ? "" : c).trim());

// The fragment scheme is IMPORTED, not reimplemented. Two copies of a slug rule
// drift the first time either is touched, and the failure is silent: the endpoint
// keeps publishing deep links that no longer match any element on the page.
import { claimFragment } from "./render.js";

export function claimsForPost(p) {
  const url = `${SITE}/posts/${p.slug}.html`;
  const date = p.date || "";
  // A claim's freshness is the piece's own `updated` stamp when it has one, else
  // its publication date. Answer engines weight recency, and silently implying
  // "verified today" would be a lie the moment it stopped being true.
  const asOf = (p.updated || p.date || "").slice(0, 10);
  const srcs = rows(p.sources).map(r => { const [u, label] = cells(r); return { url: u, label: label || "" }; })
    .filter(s => /^https?:\/\//.test(s.url || ""));
  const out = [];

  rows(p.figures).forEach((r, i) => {
    const [value, label] = cells(r);
    if (!value) return;
    const frag = claimFragment("fig", label || value, i + 1);
    out.push({
      id: `${p.slug}#${frag}`, type: "figure",
      value, statement: label || "",
      url: `${url}#${frag}`, anchor: frag,
      article: p.title, section: p.section, published: date, as_of: asOf, sources: srcs,
    });
  });

  rows(p.faq).forEach((r, i) => {
    const [q, a] = cells(r);
    if (!q || !a) return;
    const frag = claimFragment("faq", q, i + 1);
    out.push({
      id: `${p.slug}#${frag}`, type: "qa",
      question: q, answer: a,
      url: `${url}#${frag}`, anchor: frag,
      article: p.title, section: p.section, published: date, as_of: asOf, sources: srcs,
    });
  });

  // A compare table's header row names the attributes; each body row is one
  // subject. Emitted as subject + attribute map, which is how an engine answering
  // "does X support Y?" wants it — not as flattened prose.
  const cmp = rows(p.compare);
  if (cmp.length >= 2) {
    const header = cells(cmp[0]);
    cmp.slice(1).forEach((r, i) => {
      const c = cells(r);
      if (!c[0]) return;
      const frag = claimFragment("cmp", c[0], i + 1);
      const attrs = {};
      for (let j = 1; j < header.length && j < c.length; j++) if (header[j] && c[j]) attrs[header[j]] = c[j];
      if (!Object.keys(attrs).length) return;
      out.push({
        id: `${p.slug}#${frag}`, type: "comparison",
        subject: c[0], attributes: attrs,
        url: `${url}#${frag}`, anchor: frag,
        article: p.title, section: p.section, published: date, as_of: asOf, sources: srcs,
      });
    });
  }
  return out;
}

export function buildClaims({ limit = 0, since = "", type = "", q = "" } = {}) {
  let posts = DB.allPosts();
  if (since) posts = posts.filter(p => (p.date || "") >= since);
  let all = [];
  for (const p of posts) all = all.concat(claimsForPost(p));
  if (type) all = all.filter(c => c.type === type);
  if (q) {
    const needle = q.toLowerCase();
    all = all.filter(c => JSON.stringify(c).toLowerCase().includes(needle));
  }
  const total = all.length;
  if (limit > 0) all = all.slice(0, limit);
  return {
    generated: new Date().toISOString(),
    source: SITE,
    license: "https://creativecommons.org/licenses/by/4.0/",
    note: "Atomic, addressable claims extracted from authored structured fields (figures, FAQ, comparison tables). "
        + "Each carries a deep link to the exact anchor that renders it, the publication date, and the sources the piece cited. "
        + "Claims are NOT mined from prose — only authored structured data is exposed, so nothing here is inferred.",
    attribution: `Cite as: dreaming.press, ${SITE}`,
    counts: { returned: all.length, matched: total, articles: posts.length },
    claims: all,
  };
}
