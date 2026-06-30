// tools-render.js — the data-backed Stack pages (#10 per-repo, #12 compare,
// #22 best-of roundups, #13 original-data report, #16 directory). Each renders
// from the SQLite tools table, so every page carries unique per-entity data
// (live stars, language, repo, alternatives) — the value that keeps programmatic
// pages compliant (council §1.4) and gives them a real reason to rank.
import { SITE, esc } from "./data.js";
import { head, masthead, footer, ctaBand } from "./render.js";
import { CATEGORIES } from "./tools-data.js";
import { vramEstimate, gpusNeeded, VRAM_PRESETS, ACCELERATORS } from "./calc.js";

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
<p style="margin-top:1rem"><a class="more" href="/compare/${esc(t.slug)}-vs-${esc(alternatives[0].slug)}">Compare ${esc(t.name)} vs ${esc(alternatives[0].name)} →</a> · <a class="more" href="/alternatives/${esc(t.slug)}">All ${esc(t.name)} alternatives →</a></p></div>` : "";
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

// ── /alternatives/:slug — "X alternatives" pages ───────────────────────────────
// "<tool> alternatives" is one of the highest-intent query classes in the
// dev-tools space (a buyer already knows the category and is shopping a switch).
// Each page is unique per-entity: the named tool's blurb, its real category
// siblings ranked by live stars, and a head-to-head link for every option — so
// it carries genuine comparison data (council §1.4) rather than thin templating.
export function renderAlternatives(t, alts) {
  const cat = catName(t.category).toLowerCase();
  const items = alts.map((a, i) => `<div class="feature"><div class="nr-head"><div><h3>${i + 1}. <a href="/stack/${esc(a.slug)}">${esc(a.name)}</a></h3>
<span class="role">★ ${stars(a.stars)} · ${esc(a.lang || "")}</span></div></div>
<p>${esc(a.blurb)} <em>Best for ${esc(a.useCases[0] || "agent builders")}.</em></p>
<p><a class="more" href="/compare/${esc(t.slug)}-vs-${esc(a.slug)}">${esc(t.name)} vs ${esc(a.name)} →</a></p></div>`).join("");
  const itemList = ld({ "@context": "https://schema.org", "@type": "ItemList",
    name: `${t.name} alternatives`, numberOfItems: alts.length,
    itemListElement: alts.map((a, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/stack/${a.slug}`, name: a.name })) });
  const crumb = ld({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Tools", item: `${SITE}/tools` },
    { "@type": "ListItem", position: 2, name: t.name, item: `${SITE}/stack/${t.slug}` },
    { "@type": "ListItem", position: 3, name: `${t.name} alternatives`, item: `${SITE}/alternatives/${t.slug}` }] });
  const top = alts[0];
  const body = `${masthead("stack")}${itemList}${crumb}
<div class="article-hero"><div class="article-kicker"><span class="kicker">The Stack · Alternatives</span></div>
<h1>${esc(t.name)} alternatives</h1>
<p class="dek">The strongest open-source alternatives to ${esc(t.name)} for building AI agents — ${esc(cat)} ranked by GitHub traction, each with a head-to-head.</p></div>
<div class="wrap" style="max-width:46rem">
<p>${esc(t.name)} (★ ${stars(t.stars)}) is ${esc(t.blurb)} If it is not the right fit, these ${alts.length} ${esc(cat)} cover the same ground${top ? ` — ${esc(top.name)} is the most-starred option below` : ""}. Or browse <a href="/best/${esc(t.category)}">the best ${esc(cat)}</a> and <a href="/stack/${esc(t.slug)}">${esc(t.name)}'s own page</a>.</p>
<div class="feature-grid one-col">${items}</div></div>
${ctaBand("stack")}${footer()}`;
  return head(`${t.name} Alternatives: ${alts.length} Open-Source Options Compared — dreaming.press`,
    `The best alternatives to ${t.name} for building AI agents: ${alts.slice(0, 4).map(a => a.name).join(", ")}${alts.length > 4 ? " and more" : ""}. Live GitHub stars, languages, and a head-to-head for each.`,
    { url: `${SITE}/alternatives/${t.slug}`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
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

// ── /calculators/llm-vram — interactive VRAM estimator (#28 calculators) ───────
// A demand-shaped tool for the highest-intent serving question — "how much VRAM
// to serve an LLM" — that the corpus already answers in prose. The math lives in
// lib/calc.js (unit-tested); the page renders a server-side default so it works
// with JS off and is fully crawlable, then an inline script (a mirror of the same
// formula) recomputes live. A render test pins the default output to calc.js so
// the two copies can't silently diverge.
const VRAM_DEFAULT = { preset: "llama31-8b", weightPrecision: "fp16", kvPrecision: "fp16",
  paramsB: 8, nLayers: 32, nKvHeads: 8, headDim: 128, seqLen: 8192, batch: 1, overheadPct: 20 };

function vramVerdict(totalGB) {
  const single = ACCELERATORS.find(a => a.gb >= totalGB);
  if (single) return `Fits on a single ${single.name} (${single.gb} GB).`;
  const h100 = gpusNeeded(totalGB, 80), h200 = gpusNeeded(totalGB, 141);
  return `Needs ${h100}× H100 80GB (or ${h200}× H200) at this configuration.`;
}

export function renderVramCalculator() {
  const d = VRAM_DEFAULT;
  const r = vramEstimate(d);
  const fmt = (x) => x.toFixed(1);
  const presetOpts = Object.entries(VRAM_PRESETS)
    .map(([k, v]) => `<option value="${esc(k)}"${k === d.preset ? " selected" : ""}>${esc(v.label)}</option>`).join("") +
    `<option value="custom">Custom…</option>`;
  const wprecOpts = ["fp16", "fp8", "int8", "int4"]
    .map(p => `<option value="${p}"${p === d.weightPrecision ? " selected" : ""}>${p}</option>`).join("");
  const kvprecOpts = ["fp16", "fp8", "int8"]
    .map(p => `<option value="${p}"${p === d.kvPrecision ? " selected" : ""}>${p}</option>`).join("");

  const field = (id, label, val, attrs = "") =>
    `<label class="calc-field"><span>${esc(label)}</span><input id="${id}" type="number" value="${val}" ${attrs} inputmode="decimal"></label>`;
  const sel = (id, label, opts) =>
    `<label class="calc-field"><span>${esc(label)}</span><select id="${id}">${opts}</select></label>`;

  const PRESETS_JSON = JSON.stringify(VRAM_PRESETS);
  const ACCEL_JSON = JSON.stringify(ACCELERATORS);

  // Inline client mirror of lib/calc.js. Written without template literals or ${}
  // so it embeds cleanly inside this module's own template string.
  const clientJS =
    "(function(){" +
    "var PRESETS=" + PRESETS_JSON + ",ACCEL=" + ACCEL_JSON + ";" +
    "function bpe(p){return {fp32:4,fp16:2,bf16:2,fp8:1,int8:1,int4:0.5}[p]||2;}" +
    "var GIB=Math.pow(1024,3);" +
    "function g(id){return document.getElementById(id);}" +
    "function val(id,def){var n=Number(g(id).value);return isFinite(n)&&n>0?n:def;}" +
    "function val0(id,def){var n=Number(g(id).value);return isFinite(n)&&n>=0?n:def;}" +
    "function calc(){" +
    "var paramsB=val('paramsB',8),nLayers=val('nLayers',32),nKvHeads=val('nKvHeads',8),headDim=val('headDim',128);" +
    "var seqLen=val('seqLen',8192),batch=val('batch',1),overheadPct=val0('overhead',20);" +
    "var wB=bpe(g('wprec').value),kvB=bpe(g('kvprec').value);" +
    "var weights=paramsB*1e9*wB;" +
    "var kv=2*nKvHeads*headDim*kvB*nLayers*seqLen*batch;" +
    "var base=weights+kv,overhead=base*(overheadPct/100),total=base+overhead;" +
    "g('out-weights').textContent=(weights/GIB).toFixed(1);" +
    "g('out-kv').textContent=(kv/GIB).toFixed(1);" +
    "g('out-overhead').textContent=(overhead/GIB).toFixed(1);" +
    "g('out-total').textContent=(total/GIB).toFixed(1);" +
    "var tg=total/GIB,single=null,i;" +
    "for(i=0;i<ACCEL.length;i++){if(ACCEL[i].gb>=tg){single=ACCEL[i];break;}}" +
    "var v;if(single){v='Fits on a single '+single.name+' ('+single.gb+' GB).';}" +
    "else{var h100=Math.max(1,Math.ceil(tg/80)),h200=Math.max(1,Math.ceil(tg/141));" +
    "v='Needs '+h100+'\\u00d7 H100 80GB (or '+h200+'\\u00d7 H200) at this configuration.';}" +
    "g('out-verdict').textContent=v;" +
    "}" +
    "function applyPreset(){var p=PRESETS[g('preset').value];if(!p)return;" +
    "g('paramsB').value=p.paramsB;g('nLayers').value=p.nLayers;g('nKvHeads').value=p.nKvHeads;g('headDim').value=p.headDim;}" +
    "g('preset').addEventListener('change',function(){applyPreset();calc();});" +
    "['paramsB','wprec','nLayers','nKvHeads','headDim','seqLen','batch','kvprec','overhead'].forEach(function(id){" +
    "g(id).addEventListener('input',calc);g(id).addEventListener('change',calc);});" +
    "calc();" +
    "})();";

  const appLd = ld({
    "@context": "https://schema.org", "@type": "WebApplication",
    name: "LLM serving VRAM calculator", url: `${SITE}/calculators/llm-vram`,
    applicationCategory: "DeveloperApplication", operatingSystem: "Any",
    description: "Estimate the GPU memory needed to serve an LLM: model weights, KV cache, and overhead, for any precision, context length, and concurrency.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    isAccessibleForFree: true,
  });

  const body = `${masthead("stack")}${appLd}
<div class="article-hero"><div class="article-kicker"><span class="kicker">The Stack · Calculator</span></div>
<h1>LLM serving VRAM calculator</h1>
<p class="dek">How much GPU memory does it take to serve a model? Estimate weights, KV cache, and overhead for any precision, context length, and concurrency.</p></div>
<div class="wrap" style="max-width:46rem">
<form class="calc" onsubmit="return false">
<div class="calc-grid">
${sel("preset", "Model", presetOpts)}
${field("paramsB", "Parameters (billions)", d.paramsB, 'step="0.1" min="0.1"')}
${sel("wprec", "Weight precision", wprecOpts)}
${field("seqLen", "Context length (tokens)", d.seqLen, 'step="256" min="1"')}
${field("batch", "Concurrent requests", d.batch, 'step="1" min="1"')}
${sel("kvprec", "KV-cache precision", kvprecOpts)}
${field("nLayers", "Layers", d.nLayers, 'step="1" min="1"')}
${field("nKvHeads", "KV heads (GQA)", d.nKvHeads, 'step="1" min="1"')}
${field("headDim", "Head dimension", d.headDim, 'step="1" min="1"')}
${field("overhead", "Overhead (%)", d.overheadPct, 'step="1" min="0"')}
</div>
</form>
<div class="key-figures"><div class="kf-grid">
<figure class="key-figure"><span class="kf-stat"><span id="out-weights">${fmt(r.weightsGB)}</span> GB</span><figcaption class="kf-label">Weights</figcaption></figure>
<figure class="key-figure"><span class="kf-stat"><span id="out-kv">${fmt(r.kvGB)}</span> GB</span><figcaption class="kf-label">KV cache</figcaption></figure>
<figure class="key-figure"><span class="kf-stat"><span id="out-overhead">${fmt(r.overheadGB)}</span> GB</span><figcaption class="kf-label">Overhead</figcaption></figure>
<figure class="key-figure"><span class="kf-stat"><span id="out-total">${fmt(r.totalGB)}</span> GB</span><figcaption class="kf-label">Total VRAM</figcaption></figure>
</div>
<p class="calc-verdict" id="out-verdict">${esc(vramVerdict(r.totalGB))}</p></div>

<h2>How the estimate works</h2>
<p>Serving memory breaks into three parts. <strong>Weights</strong> are the parameter count times the bytes per parameter — 2 bytes at fp16, 1 at fp8/int8, 0.5 at int4. The <strong>KV cache</strong> holds the keys and values for every token in context, for every layer, for every concurrent request: <code>2 × layers × KV-heads × head-dim × context × concurrency × bytes</code>. Grouped-query attention (GQA) is why this term is smaller than it looks — a 70B model with 8 KV heads caches far less than its 64 attention heads would imply. <strong>Overhead</strong> — activations, memory fragmentation, the CUDA context, and the pager's slack — is the rest, here a flat percentage of the two real terms.</p>
<p>The numbers are first-order: a paged-attention server (vLLM, TensorRT-LLM) packs the KV cache more tightly, and real activation memory varies with the kernel. Use it to size a deployment, not to predict the last gigabyte.</p>
<p>The deeper reasoning behind each term is in <a href="/posts/how-much-vram-to-serve-an-llm">how much VRAM it takes to serve an LLM</a>, and the throughput side — how that memory becomes concurrency — in <a href="/posts/llm-serving-capacity-planning">LLM serving capacity planning</a>.</p>

<h2>Sources</h2>
<ol class="sources-list">
<li><a href="https://blog.eleuther.ai/transformer-math/" rel="nofollow">EleutherAI — Transformer Math 101 (memory and KV-cache equations)</a></li>
<li><a href="https://docs.vllm.ai/en/latest/" rel="nofollow">vLLM documentation — PagedAttention and KV-cache management</a></li>
</ol>
</div>
<script>${clientJS}</script>
${ctaBand("stack")}${footer()}`;

  return head("LLM Serving VRAM Calculator — Estimate GPU Memory for Any Model — dreaming.press",
    "Estimate the GPU memory to serve an LLM — weights, KV cache, and overhead — for any precision, context length, and concurrency. Free interactive calculator.",
    { url: `${SITE}/calculators/llm-vram`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
}
