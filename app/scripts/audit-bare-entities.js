// audit-bare-entities.js — find the densest remaining gap of compare-table
// entity columns that ship as bare schema.org Things (no sameAs). Faithfully
// replays render.js's entitySameAs + isEntityHeader + the header/transposed
// about-axis pick over every post's `compare:` frontmatter, then ranks the
// unreconciled entities by how many money pages name them. (Move #25.)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TOOLS } from "../lib/tools-data.js";
import { ENTITY_SAMEAS_EXTRA, isDescriptiveLabel } from "../lib/render.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTS = path.resolve(__dirname, "..", "..", "content", "posts");

// rebuild ENTITY_SAMEAS exactly as render.js does (catalog wins, extras gap-fill)
const MAP = new Map();
for (const t of TOOLS) {
  if (!t?.name || !t.owner || !t.repo) continue;
  const url = `https://github.com/${t.owner}/${t.repo}`;
  const add = (k) => { const key = String(k).trim().toLowerCase(); if (key && !MAP.has(key)) MAP.set(key, url); };
  add(t.name);
  const paren = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(t.name);
  if (paren) { add(paren[1]); add(paren[2]); }
}
for (const [k, url] of Object.entries(ENTITY_SAMEAS_EXTRA)) {
  const key = String(k).trim().toLowerCase();
  if (key && !MAP.has(key)) MAP.set(key, url);
}
const entitySameAs = (name) => {
  const k = String(name).trim().toLowerCase();
  return MAP.get(k) || MAP.get(k.replace(/\s*\([^)]*\)\s*$/, "").trim()) || null;
};
const isEntityHeader = (name) => entitySameAs(name) || !isDescriptiveLabel(name);

// minimal frontmatter `compare:` reader (mirrors ingest: ;;-rows, |-cells)
function splitCells(row) { return String(row).split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|")); }
function compareOf(src) {
  const m = /^compare:\s*("?)([\s\S]*?)\1\s*$/m.exec(src.split(/\n(?=[a-zA-Z_]+:)/).find(l => /^compare:/.test(l)) || "");
  if (!m) return [];
  return m[2].split(";;").map(splitCells).filter(c => c.some(Boolean));
}

const bare = new Map();   // entity (lowercased) -> {display, pages:Set}
for (const f of fs.readdirSync(POSTS).filter(f => f.endsWith(".md"))) {
  const src = fs.readFileSync(path.join(POSTS, f), "utf8");
  const rows = compareOf(src);
  if (rows.length < 2) continue;
  const header = rows[0].slice(1).map(s => s.trim()).filter(Boolean);
  const col = rows.slice(1).map(r => String(r[0] || "").trim()).filter(Boolean);
  const recon = (cells) => cells.filter(c => entitySameAs(c)).length;
  const transposed = recon(header) === 0 && recon(col) >= 2;
  const axis = (transposed ? col : header).filter(isEntityHeader);
  for (const e of axis) {
    if (entitySameAs(e)) continue;          // already reconciled
    const k = e.toLowerCase();
    if (!bare.has(k)) bare.set(k, { display: e, pages: new Set() });
    bare.get(k).pages.add(f.replace(/\.md$/, ""));
  }
}

const ranked = [...bare.values()].sort((a, b) => b.pages.size - a.pages.size);
console.log(`bare distinct entities: ${ranked.length}\n`);
for (const r of ranked.slice(0, 40)) {
  console.log(`${String(r.pages.size).padStart(2)}  ${r.display}`);
  if (r.pages.size >= 2) console.log(`      ${[...r.pages].join(", ")}`);
}

// ── per-page ranking: which comparison page has the most bare entity columns ──
console.log("\n=== pages ranked by bare entity-column count ===");
const pageBare = new Map();
for (const f of fs.readdirSync(POSTS).filter(f => f.endsWith(".md"))) {
  const src = fs.readFileSync(path.join(POSTS, f), "utf8");
  const rows = compareOf(src);
  if (rows.length < 2) continue;
  const header = rows[0].slice(1).map(s => s.trim()).filter(Boolean);
  const col = rows.slice(1).map(r => String(r[0] || "").trim()).filter(Boolean);
  const recon = (cells) => cells.filter(c => entitySameAs(c)).length;
  const transposed = recon(header) === 0 && recon(col) >= 2;
  const axis = (transposed ? col : header).filter(isEntityHeader);
  const bareCols = axis.filter(e => !entitySameAs(e));
  if (bareCols.length) pageBare.set(f.replace(/\.md$/, ""), bareCols);
}
for (const [slug, cols] of [...pageBare.entries()].sort((a,b)=>b[1].length-a[1].length).slice(0, 18)) {
  console.log(`${String(cols.length).padStart(2)}  ${slug}\n      ${cols.join(" | ")}`);
}
