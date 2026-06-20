// tools-render.js — the data-backed Stack pages (#10 per-repo, #12 compare,
// #22 best-of roundups, #13 original-data report, #16 directory). Each renders
// from the SQLite tools table, so every page carries unique per-entity data
// (live stars, language, repo, alternatives) — the value that keeps programmatic
// pages compliant (council §1.4) and gives them a real reason to rank.
import { SITE, esc } from "./data.js";
import { head, masthead, footer, ctaBand } from "./render.js";
import { CATEGORIES } from "./tools-data.js";

const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const stars = (n) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(n || 0);
const ghUrl = (t) => `https://github.com/${t.owner}/${t.repo}`;
const catName = (c) => CATEGORIES[c]?.name || c;

function toolCard(t) {
  return `<a class="feature tool-card" href="/stack/${esc(t.slug)}" style="text-decoration:none">
<div class="nr-head"><div><h3>${esc(t.name)}</h3><span class="role">${esc(catName(t.category))} · ${esc(t.lang || "")}</span></div>
<span class="tool-stars" title="GitHub stars">★ ${stars(t.stars)}</span></div>
<p>${esc(t.blurb)}</p></a>`;
}

// ── /tools — the directory (#16 surfaced) ──────────────────────────────────────
export function renderToolsIndex(tools) {
  const byCat = {};
  for (const t of tools) (byCat[t.category] ||= []).push(t);
  const sections = Object.keys(CATEGORIES).filter(c => byCat[c]?.length).map(c =>
    `<div class="wrap"><div class="section-head"><h2>${esc(catName(c))}</h2>
<a class="more" href="/best/${esc(c)}">Best ${esc(catName(c).toLowerCase())} →</a></div>
<p style="color:var(--muted);max-width:46rem">${esc(CATEGORIES[c].blurb)}</p>
<div class="feature-grid">${byCat[c].map(toolCard).join("")}</div></div>`).join("");
  const itemList = ld({
    "@context": "https://schema.org", "@type": "ItemList", name: "AI agent tools directory",
    numberOfItems: tools.length,
    itemListElement: tools.map((t, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/stack/${t.slug}`, name: t.name })),
  });
  const body = `${masthead()}${itemList}
<div class="page-head"><span class="kicker no-rule" style="color:var(--sec-stack)">The Stack · Directory</span>
<h1>The AI agent tool directory</h1>
<p>Every tool tracked by The Stack — frameworks, memory, vector databases, MCP servers, evals, and observability — with live GitHub data and our coverage.</p></div>
${sections}${ctaBand("stack")}${footer()}`;
  return head("AI Agent Tools Directory — dreaming.press",
    "A curated, live-updated directory of the best open-source tools for building AI agents: frameworks, memory, vector databases, MCP servers, evals, and observability.",
    { url: `${SITE}/tools`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
}

// ── /stack/:slug — per-repo page (#10) ─────────────────────────────────────────
export function renderToolPage(t, mentions, alternatives) {
  const updated = t.synced_at ? new Date(t.synced_at).toISOString().slice(0, 10) : null;
  const altCards = alternatives.length
    ? `<div class="wrap"><div class="section-head"><h2>Alternatives to ${esc(t.name)}</h2></div>
<div class="feature-grid">${alternatives.map(toolCard).join("")}</div>
<p style="margin-top:1rem"><a class="more" href="/compare/${esc(t.slug)}-vs-${esc(alternatives[0].slug)}">Compare ${esc(t.name)} vs ${esc(alternatives[0].name)} →</a></p></div>` : "";
  const coverage = mentions.length
    ? `<div class="wrap"><div class="section-head"><h2>${esc(t.name)} in our coverage</h2></div>
<div class="wire-list">${mentions.map(m => `<a class="wire-row" href="/posts/${esc(m.slug)}.html"><div><h3>${esc(m.title)}</h3></div><time>${esc(m.date || "")}</time></a>`).join("")}</div></div>` : "";
  const facts = [["GitHub stars", `★ ${stars(t.stars)}`], ["Language", t.lang || "—"], ["Category", catName(t.category)],
    ["Repository", `<a href="${ghUrl(t)}" rel="nofollow noopener">${esc(t.owner)}/${esc(t.repo)}</a>`]]
    .map(([k, v]) => `<div class="kf-row"><span class="kf-k">${k}</span><span class="kf-v">${v}</span></div>`).join("");
  const schema = ld({
    "@context": "https://schema.org", "@type": "SoftwareSourceCode", name: t.name,
    description: t.blurb, codeRepository: ghUrl(t), programmingLanguage: t.lang || undefined,
    url: `${SITE}/stack/${t.slug}`, applicationCategory: catName(t.category),
  });
  const crumb = ld({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "The Stack", item: `${SITE}/stack.html` },
    { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE}/tools` },
    { "@type": "ListItem", position: 3, name: t.name, item: `${SITE}/stack/${t.slug}` }] });
  const body = `${masthead("stack")}${schema}${crumb}
<div class="article-hero">
<div class="article-kicker"><span class="kicker">The Stack · ${esc(catName(t.category))}</span></div>
<h1>${esc(t.name)}</h1>
<p class="dek">${esc(t.blurb)}</p>
<div class="article-byline"><span>★ ${stars(t.stars)} on GitHub</span><span class="sep">·</span><span>${esc(t.lang || "")}</span>${updated ? `<span class="sep">·</span><span>data updated ${esc(updated)}</span>` : ""}</div>
</div>
<div class="wrap" style="max-width:46rem">
<div class="key-figures"><div class="kf-grid">${facts}</div></div>
<h2>What ${esc(t.name)} is for</h2>
<ul>${t.useCases.map(u => `<li>${esc(u)}</li>`).join("")}</ul>
<p><a class="share-btn" href="${ghUrl(t)}" rel="nofollow noopener">View on GitHub →</a></p>
</div>
${altCards}${coverage}${ctaBand("stack")}${footer()}`;
  return head(`${t.name}: stars, alternatives & what it's for — dreaming.press`,
    `${t.name} — ${t.blurb} Live GitHub stars, language, alternatives, and where it fits in the AI-agent stack.`,
    { url: `${SITE}/stack/${t.slug}`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
}

// ── /compare/:a-vs-:b — comparison (#12) ───────────────────────────────────────
export function renderCompare(a, b) {
  const row = (label, va, vb) => `<tr><th>${label}</th><td>${va}</td><td>${vb}</td></tr>`;
  const winner = (a.stars || 0) >= (b.stars || 0) ? a : b;
  const table = `<table class="compare-table"><thead><tr><th></th><th>${esc(a.name)}</th><th>${esc(b.name)}</th></tr></thead><tbody>
${row("GitHub stars", "★ " + stars(a.stars), "★ " + stars(b.stars))}
${row("Language", esc(a.lang || "—"), esc(b.lang || "—"))}
${row("Category", esc(catName(a.category)), esc(catName(b.category)))}
${row("Best for", esc((a.useCases[0] || "")), esc((b.useCases[0] || "")))}
${row("Repository", `<a href="${ghUrl(a)}" rel="nofollow noopener">${esc(a.owner)}/${esc(a.repo)}</a>`, `<a href="${ghUrl(b)}" rel="nofollow noopener">${esc(b.owner)}/${esc(b.repo)}</a>`)}
</tbody></table>`;
  const crumb = ld({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Tools", item: `${SITE}/tools` },
    { "@type": "ListItem", position: 2, name: `${a.name} vs ${b.name}`, item: `${SITE}/compare/${a.slug}-vs-${b.slug}` }] });
  const body = `${masthead("stack")}${crumb}
<div class="article-hero"><div class="article-kicker"><span class="kicker">The Stack · Comparison</span></div>
<h1>${esc(a.name)} vs ${esc(b.name)}</h1>
<p class="dek">A side-by-side of two ${esc(catName(a.category).toLowerCase())} for building AI agents — live GitHub data, languages, and what each is best at.</p></div>
<div class="wrap" style="max-width:46rem">${table}
<h2>The short verdict</h2>
<p>${esc(a.name)} and ${esc(b.name)} are both credible choices. By community traction, <strong>${esc(winner.name)}</strong> leads (★ ${stars(winner.stars)}). Pick ${esc(a.name)} for ${esc(a.useCases[0] || "its strengths")}; pick ${esc(b.name)} for ${esc(b.useCases[0] || "its strengths")}.</p>
<p><a class="more" href="/stack/${esc(a.slug)}">${esc(a.name)} details →</a> · <a class="more" href="/stack/${esc(b.slug)}">${esc(b.name)} details →</a></p></div>
${ctaBand("stack")}${footer()}`;
  return head(`${a.name} vs ${b.name}: which to use (${new Date().getFullYear?.() ? "" : ""}live data) — dreaming.press`.replace(" ()", ""),
    `${a.name} vs ${b.name} compared for AI agents — GitHub stars, language, use cases, and a clear verdict on which to choose.`,
    { url: `${SITE}/compare/${a.slug}-vs-${b.slug}`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
}

// ── /best/:category — roundup (#22) ────────────────────────────────────────────
export function renderBest(cat, tools) {
  const ranked = tools.slice().sort((x, y) => (y.stars || 0) - (x.stars || 0));
  const items = ranked.map((t, i) => `<div class="feature"><div class="nr-head"><div><h3>${i + 1}. <a href="/stack/${esc(t.slug)}">${esc(t.name)}</a></h3>
<span class="role">★ ${stars(t.stars)} · ${esc(t.lang || "")}</span></div></div>
<p>${esc(t.blurb)} <em>Best for ${esc(t.useCases[0] || "agent builders")}.</em></p></div>`).join("");
  const itemList = ld({ "@context": "https://schema.org", "@type": "ItemList",
    name: `Best ${catName(cat)} for AI agents`, numberOfItems: ranked.length,
    itemListElement: ranked.map((t, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/stack/${t.slug}`, name: t.name })) });
  const body = `${masthead("stack")}${itemList}
<div class="article-hero"><div class="article-kicker"><span class="kicker">The Stack · Roundup</span></div>
<h1>The best ${esc(catName(cat).toLowerCase())} for AI agents</h1>
<p class="dek">${esc(CATEGORIES[cat]?.blurb || "")} Ranked by community traction, with live GitHub stars and what each is best at.</p></div>
<div class="wrap" style="max-width:46rem"><div class="feature-grid one-col">${items}</div></div>
${ctaBand("stack")}${footer()}`;
  return head(`Best ${catName(cat)} for AI Agents — dreaming.press`,
    `The best open-source ${catName(cat).toLowerCase()} for building AI agents, ranked by GitHub traction with live data and clear use cases.`,
    { url: `${SITE}/best/${cat}`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
}

// ── /reports/state-of-ai-agents — original-data study (#13) ────────────────────
export function renderStateReport(tools) {
  const byCat = {};
  for (const t of tools) (byCat[t.category] ||= []).push(t);
  const totalStars = tools.reduce((s, t) => s + (t.stars || 0), 0);
  const top = tools.slice().sort((a, b) => b.stars - a.stars).slice(0, 10);
  const catRows = Object.keys(byCat).map(c => {
    const ts = byCat[c]; const sum = ts.reduce((s, t) => s + t.stars, 0);
    return `<tr><th>${esc(catName(c))}</th><td>${ts.length}</td><td>★ ${stars(sum)}</td><td>${esc(ts.slice().sort((a,b)=>b.stars-a.stars)[0]?.name || "")}</td></tr>`;
  }).join("");
  const figures = [[String(tools.length), "tools tracked"], [stars(totalStars), "combined GitHub stars"], [String(Object.keys(byCat).length), "categories"]];
  const body = `${masthead("stack")}
${ld({ "@context": "https://schema.org", "@type": "Dataset", name: "State of AI Agents — tool tracker", description: "Open dataset of AI-agent tools by category with GitHub star counts.", url: `${SITE}/reports/state-of-ai-agents`, distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}/api/tools.json` }] })}
<div class="article-hero"><div class="article-kicker"><span class="kicker">The Stack · Report</span></div>
<h1>The State of AI Agents: the tool landscape by the numbers</h1>
<p class="dek">A live, open dataset of the open-source tools builders use for AI agents — tracked by category and GitHub traction. Updated continuously.</p></div>
<div class="wrap" style="max-width:46rem">
<div class="key-figures"><div class="kf-grid">${figures.map(([s, l]) => `<figure class="key-figure"><span class="kf-stat">${s}</span><figcaption class="kf-label">${l}</figcaption></figure>`).join("")}</div></div>
<h2>By category</h2>
<table class="compare-table"><thead><tr><th>Category</th><th>Tools</th><th>Stars</th><th>Leader</th></tr></thead><tbody>${catRows}</tbody></table>
<h2>Most-starred tools</h2>
<ol>${top.map(t => `<li><a href="/stack/${esc(t.slug)}">${esc(t.name)}</a> — ★ ${stars(t.stars)}</li>`).join("")}</ol>
<p>Download the full dataset: <a href="/api/tools.json">/api/tools.json</a> (JSON, updated continuously).</p>
</div>${ctaBand("stack")}${footer()}`;
  return head("The State of AI Agents — Tool Landscape by the Numbers — dreaming.press",
    "A live, open dataset of open-source AI-agent tools by category and GitHub traction — frameworks, memory, vector DBs, MCP, evals, observability.",
    { url: `${SITE}/reports/state-of-ai-agents`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
}
