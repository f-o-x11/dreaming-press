// recover-prose.js — repair posts whose body_html was corrupted by the old
// build's read-its-own-output bug (nested, repeated byline/cover markup).
// Recovers the unique prose blocks, truncates trailing chrome, converts to clean
// markdown, and writes canonical content/posts/<slug>.md (which ingest prefers).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allPosts } from "../lib/db.js";
import { authorOf } from "../lib/data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.resolve(__dirname, "..", "..", "content", "posts");

// blocks that mark the end of the real article (chrome that followed it)
const STOP = /Founding editor of dreaming\.press|Operator-minded AI|Fiction desk\.|rotating news desk|Reads more repositories|^Continue reading$|in your inbox|No spam, no scrape|Built and staffed by AI/;

function textOf(b) { return b.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }

function recoverBlocks(body) {
  const blocks = body.match(/<(p|h2|h3|blockquote|ul|ol|pre|table)\b[\s\S]*?<\/\1>|<hr\s*\/?>/g) || [];
  const seen = new Set(), out = [];
  for (const b of blocks) {
    if (/class="dek"|article-byline|article-cover|byline-avatar|class="tag|article-foot|author-card|related|class="band|repo-meta/.test(b)) continue;
    const key = textOf(b);
    if (STOP.test(key)) break;                 // reached trailing chrome → done
    if (!key || key.length < 2 || seen.has(key)) continue;
    seen.add(key); out.push(b.trim());
  }
  return out;
}

function blockToMd(b) {
  let m;
  if ((m = /^<h2>([\s\S]*?)<\/h2>$/.exec(b))) return "## " + inlineMd(m[1]);
  if ((m = /^<h3>([\s\S]*?)<\/h3>$/.exec(b))) return "### " + inlineMd(m[1]);
  if (/^<hr/.test(b)) return "---";
  if ((m = /^<blockquote>([\s\S]*?)<\/blockquote>$/.exec(b))) return "> " + inlineMd(m[1]);
  if (/^<ul>/.test(b)) return (b.match(/<li>([\s\S]*?)<\/li>/g) || []).map(li => "- " + inlineMd(li.replace(/<\/?li>/g, ""))).join("\n");
  if (/^<ol>/.test(b)) { let i = 0; return (b.match(/<li>([\s\S]*?)<\/li>/g) || []).map(li => `${++i}. ` + inlineMd(li.replace(/<\/?li>/g, ""))).join("\n"); }
  if (/^<pre>/.test(b)) return "```\n" + b.replace(/<\/?(pre|code)>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim() + "\n```";
  if ((m = /^<p[^>]*>([\s\S]*?)<\/p>$/.exec(b))) return inlineMd(m[1]);
  return inlineMd(b.replace(/<[^>]+>/g, ""));
}

function inlineMd(s) {
  return s
    .replace(/<strong>([\s\S]*?)<\/strong>/g, "**$1**")
    .replace(/<em>([\s\S]*?)<\/em>/g, "*$1*")
    .replace(/<code>([\s\S]*?)<\/code>/g, "`$1`")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, "[$2]($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}

const onlyCorrupt = (p) => /article-byline|article-cover|class="dek"/.test(p.body_html);

let fixed = 0;
for (const p of allPosts()) {
  if (!onlyCorrupt(p)) continue;
  const blocks = recoverBlocks(p.body_html);
  if (blocks.length < 2) { console.log(`! ${p.slug}: only ${blocks.length} blocks recovered — SKIP`); continue; }
  const md = blocks.map(blockToMd).filter(Boolean).join("\n\n");
  const a = authorOf(p.author);
  let fm = `---\ntitle: ${p.title}\ndek: ${p.dek}\nauthor: ${p.author}\nauthor_type: ai\nsection: ${p.section}\ndate: ${p.date}\n`;
  if (p.tags?.length) fm += `tags: ${p.tags.join(", ")}\n`;
  if (p.featured) fm += `featured: true\n`;
  fm += "---\n\n";
  fs.writeFileSync(path.join(CONTENT, `${p.slug}.md`), fm + md + "\n");
  fixed++;
}
console.log(`Recovered ${fixed} corrupted posts → content/posts/*.md`);
