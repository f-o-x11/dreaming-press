// Lean markdown → HTML. Mirrors the publication's authoring subset:
// headings, paragraphs, bold/italic/code, links, images, blockquotes,
// >> pullquotes, --- rules, fenced code, lists, tables, and @repo{...} cards.
import { esc } from "./data.js";

// Split a `|`-delimited frontmatter row (e.g. a `compare:` table row) into trimmed
// cells, honoring a backslash escape so a cell can contain a literal pipe — needed
// for technical comparison tables that carry formulas or ranges ("Sum of |aᵢ-bᵢ|",
// "1|2|4-bit"). Splits only on UNescaped pipes, then unescapes `\|` → `|`.
export function splitCells(row) {
  return String(row).split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
}

export function inline(t) {
  t = esc(t);
  t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  return t;
}

function repoCard(spec) {
  const f = spec.split("|").map((x) => x.trim());
  const [name, url, desc, lang, stars] = [0,1,2,3,4].map((i) => f[i] || "");
  const path = url.replace("https://github.com/", "");
  return `<div class="repo-card"><div class="repo-name">▟ <a href="${esc(url)}">${esc(name)}</a></div>` +
    `<div class="repo-desc">${inline(desc)}</div>` +
    `<div class="repo-meta"><span>★ ${esc(stars)}</span><span>${esc(lang)}</span>` +
    `<span><a href="${esc(url)}">${esc(path)}</a></span></div></div>`;
}

function tableRow(line) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
}

// Slugify a heading into a stable URL fragment id so sections are deep-linkable
// (shareable #anchors) and eligible for Google "jump to" sitelinks. Strips the
// markdown the heading text may carry (links→text, emphasis/code marks) before
// slugifying. `seen` dedupes repeats within one document (foo, foo-2, foo-3).
export function headingSlug(text, seen) {
  let s = String(text)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")     // images → nothing
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")   // links → their text
    .replace(/[*`_]/g, "")                      // emphasis / code markers
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!s) s = "section";
  if (seen) {
    if (seen.has(s)) { const k = seen.get(s) + 1; seen.set(s, k); s = `${s}-${k}`; }
    else seen.set(s, 1);
  }
  return s;
}

export function mdToHtml(text) {
  const lines = String(text).split("\n");
  const out = [];
  const seenHeadings = new Map();
  let i = 0;
  const n = lines.length;
  while (i < n) {
    const line = lines[i];
    const s = line.trim();
    if (!s) { i++; continue; }

    if (s.startsWith("```")) {
      const buf = []; i++;
      while (i < n && !lines[i].trim().startsWith("```")) { buf.push(esc(lines[i])); i++; }
      i++;
      out.push(`<pre><code>${buf.join("\n")}</code></pre>`);
      continue;
    }
    if (s.startsWith("<") && !s.startsWith("<http")) { out.push(line); i++; continue; }

    let m = /^@repo\{(.+)\}$/.exec(s);
    if (m) { out.push(repoCard(m[1])); i++; continue; }

    if (/^(\*\*\*|---|___)$/.test(s)) { out.push("<hr>"); i++; continue; }

    // table: header row + separator row
    if (s.includes("|") && i + 1 < n && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i+1]) && lines[i+1].includes("-")) {
      const head = tableRow(s);
      i += 2;
      const rows = [];
      while (i < n && lines[i].includes("|") && lines[i].trim()) { rows.push(tableRow(lines[i])); i++; }
      let html = "<table><thead><tr>" + head.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>";
      for (const r of rows) html += "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>";
      html += "</tbody></table>";
      out.push(html);
      continue;
    }

    if (s.startsWith(">> ")) { out.push(`<p class="pullquote">${inline(s.slice(3))}</p>`); i++; continue; }

    if (s.startsWith("> ")) {
      const buf = [];
      while (i < n && lines[i].trim().startsWith("> ")) { buf.push(lines[i].trim().slice(2)); i++; }
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      continue;
    }

    m = /^(#{1,4})\s+(.*)/.exec(s);
    if (m) {
      const lvl = m[1].length;
      const id = headingSlug(m[2], seenHeadings);
      out.push(`<h${lvl} id="${id}">${inline(m[2])}</h${lvl}>`);
      i++; continue;
    }

    if (/^[-*]\s+/.test(s)) {
      const buf = [];
      while (i < n && /^[-*]\s+/.test(lines[i].trim())) {
        buf.push(`<li>${inline(lines[i].trim().replace(/^[-*]\s+/, ""))}</li>`); i++;
      }
      out.push(`<ul>${buf.join("")}</ul>`);
      continue;
    }
    if (/^\d+\.\s+/.test(s)) {
      const buf = [];
      while (i < n && /^\d+\.\s+/.test(lines[i].trim())) {
        buf.push(`<li>${inline(lines[i].trim().replace(/^\d+\.\s+/, ""))}</li>`); i++;
      }
      out.push(`<ol>${buf.join("")}</ol>`);
      continue;
    }

    const buf = [s]; i++;
    while (i < n && lines[i].trim() && !/^(#{1,4}\s|[-*]\s|\d+\.\s|>|```|@repo)/.test(lines[i].trim())) {
      buf.push(lines[i].trim()); i++;
    }
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return out.join("\n");
}

// frontmatter parser: returns { fm, body }
export function parseFrontmatter(raw) {
  if (!raw.startsWith("---")) return { fm: {}, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { fm: {}, body: raw };
  const block = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\n+/, "");
  const fm = {};
  for (const ln of block.split("\n")) {
    const idx = ln.indexOf(":");
    if (idx === -1) continue;
    const key = ln.slice(0, idx).trim();
    let val = ln.slice(idx + 1).trim();
    // strip one layer of matching surrounding YAML quotes so a quoted scalar like
    // `title: "X vs Y"` stores X vs Y, not a title with literal quote characters
    // (otherwise the quotes leak into <h1>/<title>/og:title/JSON-LD). Only strips
    // when the first and last char are the same quote; `"X" vs Y` is left intact.
    if (val.length >= 2 && (val[0] === '"' || val[0] === "'") && val[val.length - 1] === val[0])
      val = val.slice(1, -1);
    fm[key] = val;
  }
  return { fm, body };
}
