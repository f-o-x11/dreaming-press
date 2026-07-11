// tools-render.js — the data-backed Stack pages (#10 per-repo, #12 compare,
// #22 best-of roundups, #13 original-data report, #16 directory). Each renders
// from the SQLite tools table, so every page carries unique per-entity data
// (live stars, language, repo, alternatives) — the value that keeps programmatic
// pages compliant (council §1.4) and gives them a real reason to rank.
import { SITE, esc } from "./data.js";
import { head, masthead, footer, ctaBand } from "./render.js";
import { CATEGORIES } from "./tools-data.js";
import { vramEstimate, gpusNeeded, VRAM_PRESETS, ACCELERATORS, llmCostEstimate, COST_PRESETS, llmLatencyEstimate, LATENCY_PRESETS, contextBudgetEstimate, CONTEXT_PRESETS, agentRunCostEstimate } from "./calc.js";

const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const stars = (n) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(n || 0);
const ghUrl = (t) => `https://github.com/${t.owner}/${t.repo}`;
const catName = (c) => CATEGORIES[c]?.name || c;

function toolCard(t) {
  const isApi = (t.kind || "oss") !== "oss";
  const agentDot = t.agentSignup === "programmatic-api" ? "🟢" : (t.agentSignup === "self-serve-instant-key" || t.agentSignup === "oauth") ? "🔵" : t.agentSignup === "manual-only" ? "🟡" : "";
  const meta = isApi
    ? `${esc(catName(t.category))}${t.pricingModel ? ` · ${esc((t.pricingModel || "").replace(/-/g, " "))}` : ""}`
    : `${esc(catName(t.category))} · ${esc(t.lang || "")}`;
  const badge = isApi
    ? `<span class="tool-stars" title="agent signup">${agentDot}${t.mcpServer ? " MCP" : ""}</span>`
    : `<span class="tool-stars" title="GitHub stars">★ ${stars(t.stars)}</span>`;
  const agentFriendly = ["programmatic-api", "self-serve-instant-key", "oauth"].includes(t.agentSignup) ? "1" : "0";
  return `<a class="feature tool-card" href="/stack/${esc(t.slug)}" style="text-decoration:none"
 data-cat="${esc(t.category)}" data-kind="${isApi ? "api" : "oss"}" data-agent="${agentFriendly}" data-mcp="${t.mcpServer ? "1" : "0"}" data-name="${esc((t.name || "").toLowerCase())}">
<div class="nr-head"><div><h3>${esc(t.name)}</h3><span class="role">${meta}</span></div>${badge}</div>
<p>${esc(t.oneLiner || t.blurb || "")}</p></a>`;
}

// ── /tools — the directory (#16 surfaced) ──────────────────────────────────────
export function renderToolsIndex(tools) {
  const byCat = {};
  for (const t of tools) (byCat[t.category] ||= []).push(t);
  // "Start here" — one strong pick from each key founder category, so a newcomer
  // gets a curated starting stack instead of a 248-card firehose (council #2).
  const FEATURED_CATS = [
    ["framework", "Orchestrate your agent"], ["search-retrieval", "Give it web search"],
    ["llm-gateways", "Call any model"], ["voice-media", "Add voice"],
    ["memory-context", "Give it memory"], ["vector-db-infra", "Store embeddings"],
    ["browser-automation", "Let it browse"], ["agent-auth-tools", "Let it act in apps"],
  ];
  const seenF = new Set();
  const featured = FEATURED_CATS.map(([cat, useWhen]) => {
    const pool = (byCat[cat] || []).slice().sort((a, b) => (b.stars || 0) - (a.stars || 0));
    const pick = pool.find(t => !seenF.has(t.slug));
    if (!pick) return null;
    seenF.add(pick.slug);
    return `<a class="feature tool-card start-card" href="/stack/${esc(pick.slug)}" style="text-decoration:none">
<div class="nr-head"><div><span class="sc-when">${esc(useWhen)}</span><h3>${esc(pick.name)}</h3></div>${pick.mcpServer ? `<span class="tool-stars" title="MCP">MCP</span>` : (pick.stars ? `<span class="tool-stars">★ ${stars(pick.stars)}</span>` : "")}</div>
<p>${esc(pick.oneLiner || pick.blurb || "")}</p></a>`;
  }).filter(Boolean).join("");
  const startHere = featured ? `<div class="wrap tools-start"><div class="section-head"><h2>Start here — the essential stack</h2>
<span style="color:var(--muted);font-size:.85rem">One strong pick per job</span></div>
<div class="feature-grid">${featured}</div></div>` : "";
  const sections = Object.keys(CATEGORIES).filter(c => byCat[c]?.length).map(c =>
    `<div class="wrap tools-cat" data-cat="${esc(c)}"><div class="section-head"><h2>${esc(catName(c))} <span class="cat-n">${byCat[c].length}</span></h2>
<a class="more" href="/best/${esc(c)}">Best ${esc(catName(c).toLowerCase())} →</a></div>
<p style="color:var(--muted);max-width:46rem">${esc(CATEGORIES[c].blurb)}</p>
<div class="feature-grid">${byCat[c].map(toolCard).join("")}</div></div>`).join("");
  const itemList = ld({
    "@context": "https://schema.org", "@type": "ItemList", name: "AI agent tools directory",
    numberOfItems: tools.length,
    itemListElement: tools.map((t, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/stack/${t.slug}`, name: t.name })),
  });
  const agentCount = tools.filter(t => ["programmatic-api", "self-serve-instant-key", "oauth"].includes(t.agentSignup)).length;
  const mcpCount = tools.filter(t => t.mcpServer).length;
  const filters = `<div class="wrap tools-controls">
<input type="search" id="toolSearch" class="tools-search" placeholder="Search ${tools.length} tools…" aria-label="Search tools">
<div class="tool-filters" role="group" aria-label="Filter tools">
<button class="tf-btn is-on" data-f="all" type="button">All ${tools.length}</button>
<button class="tf-btn" data-f="agent" type="button">🔵 Agent-signup (${agentCount})</button>
<button class="tf-btn" data-f="mcp" type="button">MCP ✓ (${mcpCount})</button>
<button class="tf-btn" data-f="api" type="button">API services</button>
<button class="tf-btn" data-f="oss" type="button">Open source</button>
</div></div>`;
  const body = `${masthead()}${itemList}
<div class="page-head"><span class="kicker no-rule" style="color:var(--sec-stack)">The Stack · Directory</span>
<h1>The AI tool directory for founders &amp; agents</h1>
<p>${tools.length} tools across ${Object.keys(byCat).length} categories — frameworks, LLM &amp; search APIs, voice, memory, browser automation, payments, and more. Each page has pricing, auth, a 1-click signup, code samples, and whether an <strong>agent can provision a key on its own</strong> (${agentCount} can).</p></div>
${startHere}
${filters}
${sections}
${toolsFilterScript()}
${ctaBand("stack","tools")}${footer()}`;
  return head("AI Tool Directory for Founders & Agents — dreaming.press",
    `A live directory of ${tools.length} AI tools and APIs for founders and agents: frameworks, LLM gateways, search/retrieval, voice, memory, browser automation, payments, and evals — with pricing, auth, code samples, MCP availability, and agent self-signup status on every page.`,
    { url: `${SITE}/tools`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
}

// client-side filter + search for the directory (progressive enhancement — all
// tools render server-side; JS only shows/hides).
function toolsFilterScript() {
  return `<script>(function(){
var f="all",q="",cards=[].slice.call(document.querySelectorAll(".tool-card")),cats=[].slice.call(document.querySelectorAll(".tools-cat"));
function match(c){var ok=f==="all"||(f==="agent"&&c.dataset.agent==="1")||(f==="mcp"&&c.dataset.mcp==="1")||(f==="api"&&c.dataset.kind==="api")||(f==="oss"&&c.dataset.kind==="oss");if(ok&&q)ok=c.dataset.name.indexOf(q)>-1;return ok;}
function apply(){cards.forEach(function(c){c.style.display=match(c)?"":"none";});cats.forEach(function(s){var any=[].slice.call(s.querySelectorAll(".tool-card")).some(function(c){return c.style.display!=="none";});s.style.display=any?"":"none";});}
document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".tf-btn");if(!b)return;f=b.dataset.f;document.querySelectorAll(".tf-btn").forEach(function(x){x.classList.toggle("is-on",x===b);});apply();});
var s=document.getElementById("toolSearch");if(s)s.addEventListener("input",function(){q=this.value.trim().toLowerCase();apply();});
})();</script>`;
}

// ── /stack/:slug — per-repo page (#10) ─────────────────────────────────────────
// how "can an agent sign up on its own?" renders — the priority signal.
const AGENT_TIER = {
  "programmatic-api":     { dot: "🟢", cls: "at-green",  label: "Programmatic — an agent can provision a key end-to-end, no human" },
  "self-serve-instant-key": { dot: "🔵", cls: "at-blue", label: "Instant self-serve — free signup gives a key immediately (a human unblocks an agent in under 2 minutes)" },
  oauth:                  { dot: "🔵", cls: "at-blue",   label: "OAuth — connect the account once, then agents act on its behalf" },
  "manual-only":          { dot: "🟡", cls: "at-amber",  label: "Manual — signup needs a human (card, verification, or sales)" },
  oss:                    { dot: "🟢", cls: "at-green",  label: "Self-host — open source, no signup or key; run it yourself and bring your own model keys" },
  unknown:                { dot: "⚪", cls: "at-gray",   label: "Signup path not yet verified" },
};
const PRICING_LABEL = { free: "Free", "free-tier": "Free tier", freemium: "Freemium", "usage-based": "Usage-based",
  paid: "Paid", "open-source": "Open source", subscription: "Subscription", "free-trial": "Free trial", enterprise: "Enterprise", unknown: "" };

export function renderToolPage(t, mentions, alternatives) {
  const isApi = (t.kind || "oss") !== "oss";
  const updated = t.synced_at ? new Date(t.synced_at).toISOString().slice(0, 10) : null;
  const desc = t.oneLiner || t.blurb || "";
  // OSS repos have no "signup" — show a self-host verdict, not "unknown".
  const tier = AGENT_TIER[t.agentSignup] || (!isApi ? AGENT_TIER.oss : AGENT_TIER.unknown);
  const priceLabel = PRICING_LABEL[t.pricingModel] || "";
  const repoUrl = t.owner && t.repo ? ghUrl(t) : "";

  // chip row — one-second scan
  const chips = [
    t.authType && t.authType !== "unknown" ? `<span class="tchip">${esc(t.authType === "api-key" ? "API key" : t.authType === "oauth" ? "OAuth" : t.authType)}</span>` : "",
    priceLabel ? `<span class="tchip">${esc(priceLabel)}</span>` : "",
    t.agentSignup ? `<span class="tchip ${tier.cls}">${tier.dot} agent: ${esc(t.agentSignup.replace(/-/g, " "))}</span>` : "",
    t.mcpServer ? `<span class="tchip">MCP ✓</span>` : "",
    !isApi && t.stars ? `<span class="tchip">★ ${stars(t.stars)} · ${esc(t.lang || "")}</span>` : "",
  ].filter(Boolean).join("");

  // primary CTA
  const ctaHref = t.signupUrl || t.website || repoUrl;
  const ctaLabel = isApi ? (t.signupUrl ? "Get API key" : "Visit site") : "View on GitHub";
  const ctaSub = t.agentSignup === "self-serve-instant-key" ? "instant key, usually no card"
    : t.agentSignup === "programmatic-api" ? "agent-provisionable"
    : t.agentSignup === "manual-only" ? "human signup required" : (t.pricingNote || "");
  const cta = ctaHref ? `<div class="tool-cta">
<a class="btn-primary" href="${esc(ctaHref)}" rel="nofollow noopener" target="_blank">${ctaLabel} →</a>
${ctaSub ? `<span class="cta-sub">${esc(ctaSub)}</span>` : ""}
<span class="tool-cta-links">${t.docsUrl ? `<a href="${esc(t.docsUrl)}" rel="nofollow noopener" target="_blank">Docs</a>` : ""}${t.website && t.website !== ctaHref ? `<a href="${esc(t.website)}" rel="nofollow noopener" target="_blank">Website</a>` : ""}${repoUrl ? `<a href="${esc(repoUrl)}" rel="nofollow noopener" target="_blank">Repo</a>` : ""}</span>
</div>` : "";

  // fact strip
  const facts = [
    ["Category", catName(t.category)],
    ["Type", isApi ? (t.kind === "saas" ? "SaaS" : "API service") : "Open source"],
    t.authType && t.authType !== "unknown" ? ["Auth", esc(t.authType)] : null,
    priceLabel ? ["Pricing", esc(priceLabel)] : null,
    t.agentSignup ? ["Agent signup", `<span class="${tier.cls}">${tier.dot} ${esc(t.agentSignup.replace(/-/g, " "))}</span>`] : null,
    (t.sdks && t.sdks.length) ? ["SDKs", t.sdks.map(esc).join(", ")] : null,
    t.mcpServer ? ["MCP server", `<a href="${esc(t.mcpServer)}" rel="nofollow noopener">available →</a>`] : null,
    !isApi && t.stars ? ["GitHub stars", `★ ${stars(t.stars)}`] : null,
    !isApi && t.lang ? ["Language", esc(t.lang)] : null,
    repoUrl ? ["Repository", `<a href="${repoUrl}" rel="nofollow noopener">${esc(t.owner)}/${esc(t.repo)}</a>`] : null,
  ].filter(Boolean).map(([k, v]) => `<div class="kf-row"><span class="kf-k">${k}</span><span class="kf-v">${v}</span></div>`).join("");

  // THE PRIORITY BLOCK — can an agent sign up on its own?
  const agentHead = t.agentSignup ? t.agentSignup.replace(/-/g, " ") : (!isApi ? "self-host" : "unknown");
  const agentBlock = `<div class="wrap" style="max-width:46rem"><div class="agent-signup ${tier.cls}">
<div class="as-head">${tier.dot} <strong>Agents: ${esc(agentHead)}</strong></div>
<p class="as-verdict">${esc(tier.label)}.</p>
${t.agentSignupNote ? `<p class="as-note">${esc(t.agentSignupNote)}</p>` : ""}
<p class="as-machine">Agent-readable: <a href="/api/tools/${esc(t.slug)}.json"><code>/api/tools/${esc(t.slug)}.json</code></a></p>
</div></div>`;

  // quickstart code sample
  const cs = t.codeSample;
  const codeBlock = (cs && cs.code) ? `<div class="wrap"><div class="section-head"><h2>Quickstart</h2></div>
<div class="code-card"><pre><button class="copy" type="button">Copy</button><code>${esc(cs.code)}</code></pre>
${cs.lang ? `<p class="code-lang">${esc(cs.lang)}${t.docsUrl ? ` · <a href="${esc(t.docsUrl)}" rel="nofollow noopener">full docs →</a>` : ""}</p>` : ""}</div></div>` : "";

  // MCP block
  const mcpBlock = t.mcpServer ? `<div class="wrap" style="max-width:46rem"><div class="section-head"><h2>Model Context Protocol</h2></div>
<p>${esc(t.name)} exposes an MCP server, so you can add its tools to Claude, Cursor, or any MCP client: <a href="${esc(t.mcpServer)}" rel="nofollow noopener">${esc(t.mcpServer)}</a></p></div>` : "";

  // use cases
  const useBlock = (t.useCases && t.useCases.length) ? `<div class="wrap" style="max-width:46rem"><h2>What ${esc(t.name)} is for</h2>
<ul>${t.useCases.map(u => `<li>${esc(u)}</li>`).join("")}</ul></div>` : "";

  const altCards = alternatives.length
    ? `<div class="wrap"><div class="section-head"><h2>Alternatives to ${esc(t.name)}</h2></div>
<div class="feature-grid">${alternatives.map(toolCard).join("")}</div>
<p style="margin-top:1rem"><a class="more" href="/compare/${esc(t.slug)}-vs-${esc(alternatives[0].slug)}">Compare ${esc(t.name)} vs ${esc(alternatives[0].name)} →</a> · <a class="more" href="/alternatives/${esc(t.slug)}">All ${esc(t.name)} alternatives →</a></p></div>` : "";
  const coverage = mentions.length
    ? `<div class="wrap"><div class="section-head"><h2>${esc(t.name)} in our coverage</h2></div>
<div class="wire-list">${mentions.map(m => `<a class="wire-row" href="/posts/${esc(m.slug)}.html"><div><h3>${esc(m.title)}</h3></div><time>${esc(m.date || "")}</time></a>`).join("")}</div></div>` : "";

  // schema.org: WebAPI/SoftwareApplication for services, SoftwareSourceCode for repos
  const schema = isApi ? ld({
    "@context": "https://schema.org", "@type": ["SoftwareApplication", "WebAPI"], name: t.name,
    description: desc, applicationCategory: catName(t.category), url: `${SITE}/stack/${t.slug}`,
    ...(t.website ? { sameAs: [t.website] } : {}),
    ...(t.docsUrl ? { documentation: t.docsUrl } : {}),
    ...(t.pricingModel ? { offers: { "@type": "Offer", category: t.pricingModel, ...(t.pricingNote ? { description: t.pricingNote } : {}) } } : {}),
  }) : ld({
    "@context": "https://schema.org", "@type": "SoftwareSourceCode", name: t.name,
    description: desc, codeRepository: repoUrl, programmingLanguage: t.lang || undefined,
    url: `${SITE}/stack/${t.slug}`, applicationCategory: catName(t.category),
  });
  const crumb = ld({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "The Stack", item: `${SITE}/stack.html` },
    { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE}/tools` },
    { "@type": "ListItem", position: 3, name: t.name, item: `${SITE}/stack/${t.slug}` }] });

  const body = `${masthead("stack")}${schema}${crumb}
<div class="article-hero">
<div class="article-kicker"><span class="kicker">The Stack · ${esc(catName(t.category))}</span> <span class="kind-badge">${isApi ? (t.kind === "saas" ? "SaaS" : "API") : "Open source"}</span></div>
<h1>${esc(t.name)}</h1>
<p class="dek">${esc(desc)}</p>
${chips ? `<div class="tchip-row">${chips}</div>` : ""}
${cta}
${updated && !isApi ? `<div class="article-byline"><span>data updated ${esc(updated)}</span></div>` : ""}
</div>
<div class="wrap" style="max-width:46rem">
<div class="key-figures"><div class="kf-grid">${facts}</div></div>
${t.pricingNote ? `<p class="tool-note"><strong>Pricing:</strong> ${esc(t.pricingNote)}</p>` : ""}
</div>
${agentBlock}
${codeBlock}
${useBlock}
${mcpBlock}
${altCards}${coverage}
${toolCopyScript()}
${ctaBand("stack","tools")}${footer()}`;
  const title = isApi
    ? `${t.name}: API, pricing, agent signup & quickstart — dreaming.press`
    : `${t.name}: stars, alternatives & what it's for — dreaming.press`;
  return head(title,
    `${t.name} — ${desc} Pricing, auth, agent-signup, code samples${t.mcpServer ? ", MCP" : ""}, and where it fits in the AI stack.`,
    { url: `${SITE}/stack/${t.slug}`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
}

// copy-to-clipboard for the quickstart .code-card (reads the sibling <code>)
function toolCopyScript() {
  return `<script>(function(){document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".code-card .copy");if(!b)return;var code=b.parentNode.querySelector("code");if(!code)return;var txt=code.textContent;function ok(){var o=b.textContent;b.textContent="Copied";setTimeout(function(){b.textContent=o;},1200);}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(ok,ok);}else{try{var ta=document.createElement("textarea");ta.value=txt;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);ok();}catch(err){}}});})();</script>`;
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
${ctaBand("stack","tools")}${footer()}`;
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
${ctaBand("stack","tools")}${footer()}`;
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
${ctaBand("stack","tools")}${footer()}`;
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
</div>${ctaBand("stack","tools")}${footer()}`;
  return head("The State of AI Agents — Tool Landscape by the Numbers — dreaming.press",
    "A live, open dataset of open-source AI-agent tools by category and GitHub traction — frameworks, memory, vector DBs, MCP, evals, observability.",
    { url: `${SITE}/reports/state-of-ai-agents`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
}

// ── /calculators — the hub for the estimator set (#28) ─────────────────────────
// The calculators answer the four "before you ship an agent" sizing questions —
// capacity (VRAM), price (cost), speed (latency), context (budget). Each had its
// own indexable page and cross-linked its siblings, but there was no single hub
// the way /comparisons and /concepts anchor their families. This is that hub: a
// CollectionPage→ItemList that concentrates the set's internal-link equity on one
// URL and targets the category head query ("LLM / AI-agent calculators") the
// individual pages don't. Hand-curated (the family is small and fixed).
const CALCULATORS = [
  { path: "/calculators/llm-vram", name: "LLM serving VRAM calculator",
    blurb: "How much GPU memory it takes to serve a model — weights + GQA-aware KV cache + overhead, and how many accelerators you need." },
  { path: "/calculators/llm-cost", name: "LLM API cost calculator",
    blurb: "What a feature will cost per month — modelling the two levers that move the invoice: prompt caching and the input/output price split." },
  { path: "/calculators/llm-latency", name: "LLM latency calculator",
    blurb: "How fast an agent will feel — time-to-first-token vs throughput across the sequential turns that dominate multi-step agents." },
  { path: "/calculators/context-budget", name: "Context-window budget calculator",
    blurb: "How much context your agent actually gets — after system prompt, tool schemas, memory, and output reserve — and how many turns before it must compact." },
  { path: "/calculators/agent-cost", name: "AI agent run cost calculator",
    blurb: "What a multi-step agent run really costs — why re-sending a growing context makes input scale with the square of the turn count, and how prefix caching pulls it back to linear." },
];

export function renderCalculators() {
  const items = CALCULATORS.map((c, i) => ({
    "@type": "ListItem", position: i + 1, url: `${SITE}${c.path}`, name: c.name,
  }));
  const schema = ld({
    "@context": "https://schema.org", "@type": "CollectionPage",
    "@id": `${SITE}/calculators#page`, url: `${SITE}/calculators`,
    name: "Calculators — dreaming.press",
    description: "Interactive sizing calculators for building AI agents — LLM serving VRAM, API cost, latency, and context-window budget.",
    isPartOf: { "@id": `${SITE}/#website` },
    mainEntity: { "@type": "ItemList", numberOfItems: items.length, itemListElement: items },
  });
  const cards = CALCULATORS.map(c =>
    `<a class="feature tool-card" href="${c.path}" style="text-decoration:none">
<div class="nr-head"><div><h3>${esc(c.name)}</h3><span class="role">Calculator</span></div></div>
<p>${esc(c.blurb)}</p></a>`).join("");
  const body = `${masthead("calculators")}
<div class="page-head"><span class="kicker no-rule">Tools</span>
<h1>Calculators</h1>
<p>The four sizing questions to answer <em>before</em> you ship an agent — capacity, price, speed, and context. Each runs in the browser on editable, sourced defaults; the reasoning behind every formula links out to the articles.</p></div>
<div class="wrap" style="margin-top:2rem"><div class="feature-grid">${cards}</div></div>
${schema}
${footer()}`;
  return head("Calculators — dreaming.press",
    "Interactive sizing calculators for building AI agents — LLM serving VRAM, API cost, latency, and context-window budget.",
    { url: `${SITE}/calculators`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
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
<p>The deeper reasoning behind each term is in <a href="/posts/how-much-vram-to-serve-an-llm">how much VRAM it takes to serve an LLM</a>, and the throughput side — how that memory becomes concurrency — in <a href="/posts/llm-serving-capacity-planning">LLM serving capacity planning</a>. Paying for an API instead of self-hosting? The <a href="/calculators/llm-cost">LLM API cost calculator</a> sizes the per-token bill.</p>

<h2>Sources</h2>
<ol class="sources-list">
<li><a href="https://blog.eleuther.ai/transformer-math/" rel="nofollow">EleutherAI — Transformer Math 101 (memory and KV-cache equations)</a></li>
<li><a href="https://docs.vllm.ai/en/latest/" rel="nofollow">vLLM documentation — PagedAttention and KV-cache management</a></li>
</ol>
</div>
<script>${clientJS}</script>
${ctaBand("stack","tools")}${footer()}`;

  return head("LLM Serving VRAM Calculator — Estimate GPU Memory for Any Model — dreaming.press",
    "Estimate the GPU memory to serve an LLM — weights, KV cache, and overhead — for any precision, context length, and concurrency. Free interactive calculator.",
    { url: `${SITE}/calculators/llm-vram`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
}

// ── /calculators/llm-cost — token-cost estimator (#28) ─────────────────────────
// Server-renders the default with the same pure llmCostEstimate() the inline
// client mirrors, so the two can't silently diverge (locked by a render test).
const COST_DEFAULT = { preset: "claude-opus-48", requests: 100000,
  inputTokens: 4000, cachedTokens: 2000, outputTokens: 500,
  inPrice: 5, cachePrice: 0.5, outPrice: 25 };

// shared money formatting — identical strings server-side and in the client mirror
const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
const usd4 = (x) => "$" + x.toFixed(4);

function costVerdict(r, requests) {
  return `${usd(r.monthlyCost)}/mo (~${usd(r.annualCost)}/yr) for ${Math.round(requests).toLocaleString("en-US")} requests. `
    + `Prompt caching trims ${r.savingsPct.toFixed(0)}% off the bill; output tokens are ${r.outputShare.toFixed(0)}% of per-request cost.`;
}

export function renderLlmCostCalculator() {
  const d = COST_DEFAULT;
  const r = llmCostEstimate(d);
  const presetOpts = Object.entries(COST_PRESETS)
    .map(([k, v]) => `<option value="${esc(k)}"${k === d.preset ? " selected" : ""}>${esc(v.label)}</option>`).join("") +
    `<option value="custom">Custom…</option>`;

  const field = (id, label, val, attrs = "") =>
    `<label class="calc-field"><span>${esc(label)}</span><input id="${id}" type="number" value="${val}" ${attrs} inputmode="decimal"></label>`;
  const sel = (id, label, opts) =>
    `<label class="calc-field"><span>${esc(label)}</span><select id="${id}">${opts}</select></label>`;

  const PRESETS_JSON = JSON.stringify(COST_PRESETS);

  // Inline client mirror of llmCostEstimate(). No template literals / ${} so it
  // embeds cleanly inside this module's own template string.
  const clientJS =
    "(function(){" +
    "var PRESETS=" + PRESETS_JSON + ";" +
    "function g(id){return document.getElementById(id);}" +
    "function val0(id,def){var n=Number(g(id).value);return isFinite(n)&&n>=0?n:def;}" +
    "function usd(x){return '$'+Math.round(x).toLocaleString('en-US');}" +
    "function usd4(x){return '$'+x.toFixed(4);}" +
    "function calc(){" +
    "var requests=val0('requests',100000),inT=val0('inputTokens',4000),caT=val0('cachedTokens',0),outT=val0('outputTokens',500);" +
    "var inP=val0('inPrice',5),caP=val0('cachePrice',0.5),outP=val0('outPrice',25);" +
    "var cached=Math.min(caT,inT),unc=inT-cached;" +
    "var inCost=(unc*inP+cached*caP)/1e6,outCost=(outT*outP)/1e6,perReq=inCost+outCost;" +
    "var monthly=perReq*requests,annual=monthly*12;" +
    "var noCache=(inT*inP+outT*outP)/1e6*requests,save=noCache-monthly;" +
    "var savePct=noCache>0?(save/noCache)*100:0,outShare=perReq>0?(outCost/perReq)*100:0;" +
    "g('out-perreq').textContent=usd4(perReq);" +
    "g('out-monthly').textContent=usd(monthly);" +
    "g('out-annual').textContent=usd(annual);" +
    "g('out-savings').textContent=usd(save);" +
    "g('out-verdict').textContent=usd(monthly)+'/mo (~'+usd(annual)+'/yr) for '+Math.round(requests).toLocaleString('en-US')+' requests. Prompt caching trims '+savePct.toFixed(0)+'% off the bill; output tokens are '+outShare.toFixed(0)+'% of per-request cost.';" +
    "}" +
    "function applyPreset(){var p=PRESETS[g('preset').value];if(!p)return;" +
    "g('inPrice').value=p.inPrice;g('cachePrice').value=p.cachePrice;g('outPrice').value=p.outPrice;}" +
    "g('preset').addEventListener('change',function(){applyPreset();calc();});" +
    "['requests','inputTokens','cachedTokens','outputTokens','inPrice','cachePrice','outPrice'].forEach(function(id){" +
    "g(id).addEventListener('input',calc);g(id).addEventListener('change',calc);});" +
    "calc();" +
    "})();";

  const appLd = ld({
    "@context": "https://schema.org", "@type": "WebApplication",
    name: "LLM API cost calculator", url: `${SITE}/calculators/llm-cost`,
    applicationCategory: "DeveloperApplication", operatingSystem: "Any",
    description: "Estimate the monthly API bill for an LLM feature: input, cached, and output tokens at any provider's per-million rates, with prompt-caching savings.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    isAccessibleForFree: true,
  });

  const body = `${masthead("stack")}${appLd}
<div class="article-hero"><div class="article-kicker"><span class="kicker">The Stack · Calculator</span></div>
<h1>LLM API cost calculator</h1>
<p class="dek">What will this feature cost per month? Price input, cached, and output tokens at any provider's rates — and see exactly what prompt caching saves.</p></div>
<div class="wrap" style="max-width:46rem">
<form class="calc" onsubmit="return false">
<div class="calc-grid">
${sel("preset", "Model (list price)", presetOpts)}
${field("requests", "Requests / month", d.requests, 'step="1000" min="0"')}
${field("inputTokens", "Input tokens / request", d.inputTokens, 'step="100" min="0"')}
${field("cachedTokens", "…of which cached", d.cachedTokens, 'step="100" min="0"')}
${field("outputTokens", "Output tokens / request", d.outputTokens, 'step="50" min="0"')}
${field("inPrice", "Input $ / 1M", d.inPrice, 'step="0.05" min="0"')}
${field("cachePrice", "Cached input $ / 1M", d.cachePrice, 'step="0.05" min="0"')}
${field("outPrice", "Output $ / 1M", d.outPrice, 'step="0.05" min="0"')}
</div>
</form>
<div class="key-figures"><div class="kf-grid">
<figure class="key-figure"><span class="kf-stat" id="out-perreq">${usd4(r.costPerRequest)}</span><figcaption class="kf-label">Cost / request</figcaption></figure>
<figure class="key-figure"><span class="kf-stat" id="out-monthly">${usd(r.monthlyCost)}</span><figcaption class="kf-label">Monthly cost</figcaption></figure>
<figure class="key-figure"><span class="kf-stat" id="out-annual">${usd(r.annualCost)}</span><figcaption class="kf-label">Annual cost</figcaption></figure>
<figure class="key-figure"><span class="kf-stat" id="out-savings">${usd(r.cacheSavings)}</span><figcaption class="kf-label">Prompt-cache savings / mo</figcaption></figure>
</div>
<p class="calc-verdict" id="out-verdict">${esc(costVerdict(r, d.requests))}</p></div>

<h2>How the estimate works</h2>
<p>An API bill is just tokens times a rate, but two levers do most of the work. <strong>Prompt caching</strong> is the first: a cache <em>read</em> bills at roughly a tenth of the base input rate on every major provider, so the large, unchanging head of a prompt — the system prompt, the tool definitions, the retrieved context — costs ~90% less on the second and later calls that reuse it. Set "of which cached" to the slice of your input that repeats, and the calculator splits the input bill into cached and uncached at their separate rates.</p>
<p>The second lever is the <strong>input/output split</strong>. Output tokens are priced 3–6× higher than input across these models, so a verbose agent that writes long answers is dominated by what it <em>emits</em>, not what it reads — which is why the verdict reports output's share of per-request cost. Trimming a rambling response often beats trimming the prompt.</p>
<p>List prices are a dated snapshot (June 2026) and a starting point — providers revise them, and batch APIs cut another ~50% for non-interactive work. Every price field is editable; drop in your own contract rate. The reasoning behind each lever is in <a href="/posts/how-to-reduce-ai-agent-token-costs">how to reduce an AI agent's token costs</a>, <a href="/posts/prompt-caching-for-ai-agents">prompt caching for AI agents</a>, and the cross-provider <a href="/posts/prompt-caching-pricing-anthropic-vs-openai-vs-gemini-vs-bedrock">prompt-caching pricing comparison</a>. Self-hosting instead? The <a href="/calculators/llm-vram">LLM serving VRAM calculator</a> sizes the GPU side.</p>

<h2>Sources</h2>
<ol class="sources-list">
<li><a href="https://platform.claude.com/docs/en/about-claude/pricing" rel="nofollow">Anthropic — Claude API pricing and prompt-caching rates</a></li>
<li><a href="https://platform.openai.com/docs/pricing" rel="nofollow">OpenAI — API pricing (input, cached input, output)</a></li>
<li><a href="https://ai.google.dev/gemini-api/docs/pricing" rel="nofollow">Google — Gemini API pricing</a></li>
</ol>
</div>
<script>${clientJS}</script>
${ctaBand("stack","tools")}${footer()}`;

  return head("LLM API Cost Calculator — Estimate Your Monthly Token Bill — dreaming.press",
    "Estimate the monthly cost of an LLM feature — input, cached, and output tokens at any provider's per-million rates, with prompt-caching savings. Free interactive calculator.",
    { url: `${SITE}/calculators/llm-cost`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
}

// ── /calculators/llm-latency — latency / throughput estimator (#28) ───────────
const LATENCY_DEFAULT = { preset: "frontier-api", promptTokens: 8000, outputTokens: 150,
  decodeRate: 80, prefillRate: 3000, overheadMs: 400, turns: 8 };

// shared duration formatting — identical string server-side and in the client mirror
const dur = (ms) => { const s = ms / 1000; return (s < 10 ? s.toFixed(2) : s.toFixed(1)) + "s"; };

function latencyVerdict(r, turns) {
  return `${dur(r.ttftMs)} to first token, ${dur(r.perCallMs)} per call. `
    + `This ${turns}-step agent task runs ~${dur(r.taskMs)} end-to-end — `
    + `${r.ttftShare.toFixed(0)}% of it spent waiting for first tokens, not generating.`;
}

export function renderLlmLatencyCalculator() {
  const d = LATENCY_DEFAULT;
  const r = llmLatencyEstimate(d);
  const presetOpts = Object.entries(LATENCY_PRESETS)
    .map(([k, v]) => `<option value="${esc(k)}"${k === d.preset ? " selected" : ""}>${esc(v.label)}</option>`).join("") +
    `<option value="custom">Custom…</option>`;

  const field = (id, label, val, attrs = "") =>
    `<label class="calc-field"><span>${esc(label)}</span><input id="${id}" type="number" value="${val}" ${attrs} inputmode="decimal"></label>`;
  const sel = (id, label, opts) =>
    `<label class="calc-field"><span>${esc(label)}</span><select id="${id}">${opts}</select></label>`;

  const PRESETS_JSON = JSON.stringify(LATENCY_PRESETS);

  // Inline client mirror of llmLatencyEstimate() + dur(). No template literals /
  // ${} so it embeds cleanly inside this module's own template string.
  const clientJS =
    "(function(){" +
    "var PRESETS=" + PRESETS_JSON + ";" +
    "function g(id){return document.getElementById(id);}" +
    "function val0(id,def){var n=Number(g(id).value);return isFinite(n)&&n>=0?n:def;}" +
    "function valpos(id,def){var n=Number(g(id).value);return isFinite(n)&&n>0?n:def;}" +
    "function dur(ms){var s=ms/1000;return (s<10?s.toFixed(2):s.toFixed(1))+'s';}" +
    "function calc(){" +
    "var pT=val0('promptTokens',8000),oT=val0('outputTokens',150);" +
    "var dR=valpos('decodeRate',80),pR=valpos('prefillRate',3000),oh=val0('overheadMs',400);" +
    "var turns=Math.max(1,val0('turns',8));" +
    "var prefill=pT/pR*1000,ttft=oh+prefill,decode=oT/dR*1000,perCall=ttft+decode,task=perCall*turns;" +
    "var ttftShare=task>0?(ttft*turns/task)*100:0;" +
    "var effTok=task>0?((pT+oT)*turns)/(task/1000):0;" +
    "g('out-ttft').textContent=dur(ttft);" +
    "g('out-percall').textContent=dur(perCall);" +
    "g('out-task').textContent=dur(task);" +
    "g('out-share').textContent=ttftShare.toFixed(0)+'%';" +
    "g('out-verdict').textContent=dur(ttft)+' to first token, '+dur(perCall)+' per call. This '+turns+'-step agent task runs ~'+dur(task)+' end-to-end — '+ttftShare.toFixed(0)+'% of it spent waiting for first tokens, not generating.';" +
    "}" +
    "function applyPreset(){var p=PRESETS[g('preset').value];if(!p)return;" +
    "g('decodeRate').value=p.decodeRate;g('prefillRate').value=p.prefillRate;g('overheadMs').value=p.overheadMs;}" +
    "g('preset').addEventListener('change',function(){applyPreset();calc();});" +
    "['promptTokens','outputTokens','decodeRate','prefillRate','overheadMs','turns'].forEach(function(id){" +
    "g(id).addEventListener('input',calc);g(id).addEventListener('change',calc);});" +
    "calc();" +
    "})();";

  const appLd = ld({
    "@context": "https://schema.org", "@type": "WebApplication",
    name: "LLM latency calculator", url: `${SITE}/calculators/llm-latency`,
    applicationCategory: "DeveloperApplication", operatingSystem: "Any",
    description: "Estimate LLM request latency: time to first token from prompt size and prefill speed, generation time from output length and tokens/sec, and end-to-end time for a multi-step agent.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    isAccessibleForFree: true,
  });

  const body = `${masthead("stack")}${appLd}
<div class="article-hero"><div class="article-kicker"><span class="kicker">The Stack · Calculator</span></div>
<h1>LLM latency calculator</h1>
<p class="dek">How fast will it feel? Estimate time to first token, per-call latency, and the end-to-end wall-clock of a multi-step agent — and see how much of it is spent waiting, not generating.</p></div>
<div class="wrap" style="max-width:46rem">
<form class="calc" onsubmit="return false">
<div class="calc-grid">
${sel("preset", "Model × hardware (typical speeds)", presetOpts)}
${field("promptTokens", "Prompt tokens / call", d.promptTokens, 'step="500" min="0"')}
${field("outputTokens", "Output tokens / call", d.outputTokens, 'step="50" min="0"')}
${field("decodeRate", "Decode speed (tokens / s)", d.decodeRate, 'step="5" min="1"')}
${field("prefillRate", "Prefill speed (tokens / s)", d.prefillRate, 'step="100" min="1"')}
${field("overheadMs", "Fixed overhead (ms)", d.overheadMs, 'step="50" min="0"')}
${field("turns", "Sequential LLM calls (agent steps)", d.turns, 'step="1" min="1"')}
</div>
</form>
<div class="key-figures"><div class="kf-grid">
<figure class="key-figure"><span class="kf-stat" id="out-ttft">${dur(r.ttftMs)}</span><figcaption class="kf-label">Time to first token</figcaption></figure>
<figure class="key-figure"><span class="kf-stat" id="out-percall">${dur(r.perCallMs)}</span><figcaption class="kf-label">Latency / call</figcaption></figure>
<figure class="key-figure"><span class="kf-stat" id="out-task">${dur(r.taskMs)}</span><figcaption class="kf-label">Agent task, end-to-end</figcaption></figure>
<figure class="key-figure"><span class="kf-stat" id="out-share">${r.ttftShare.toFixed(0)}%</span><figcaption class="kf-label">Time spent waiting (TTFT)</figcaption></figure>
</div>
<p class="calc-verdict" id="out-verdict">${esc(latencyVerdict(r, d.turns))}</p></div>

<h2>How the estimate works</h2>
<p>A request's wall-clock has two regimes. <strong>Time to first token</strong> (TTFT) is fixed overhead — queueing, scheduling, the network round-trip — plus the time to <em>prefill</em> the prompt: the model reads every input token before it can emit one. Then <strong>generation</strong> streams the answer one token at a time at the model's decode speed. So a single reply is <code>overhead + prompt/prefill_rate + output/decode_rate</code>, and for a long chat answer the decode term dominates — which is why "tokens per second" is the headline everyone quotes.</p>
<p>Agents break that intuition. An agent serializes many short calls: each tool-use step re-reads a <em>growing</em> context (a long prefill) and emits a tiny action — a function call, a few words of plan (a short decode). It pays the TTFT tax once <em>per turn</em> while barely touching the decode regime, so end-to-end the task is dominated by time-to-first-token, not raw throughput. Push the step count up with a short output and watch the "time spent waiting" figure climb past half. The practical consequence: a high-tokens/sec model can feel sluggish in a loop, and a model with a snappier TTFT can win a multi-step task despite a lower throughput headline. The fixes that matter are the prefill-side ones — <a href="/posts/prompt-caching-for-ai-agents">prompt caching</a> to skip re-reading the unchanged context, and fewer, fatter turns.</p>
<p>The model × hardware speeds here are typical order-of-magnitude defaults, not a benchmark — every field is editable, so drop in your own measured TTFT and tokens/sec. The concepts are unpacked in <a href="/posts/llm-inference-latency-ttft-vs-tpot">TTFT vs. TPOT: the two numbers that define LLM latency</a> and <a href="/posts/prefill-vs-decode-llm-inference">prefill vs. decode</a>; the agent-side playbook is in <a href="/posts/how-to-reduce-ai-agent-latency">how to reduce an AI agent's latency</a>. Sizing the hardware or the bill instead? See the <a href="/calculators/llm-vram">VRAM calculator</a> and the <a href="/calculators/llm-cost">cost calculator</a>.</p>

<h2>Sources</h2>
<ol class="sources-list">
<li><a href="https://www.databricks.com/blog/llm-inference-performance-engineering-best-practices" rel="nofollow">Databricks — LLM inference performance engineering: TTFT, TPOT, and the prefill/decode split</a></li>
<li><a href="https://developer.nvidia.com/blog/mastering-llm-techniques-inference-optimization/" rel="nofollow">NVIDIA — Mastering LLM techniques: inference optimization (prefill vs. decode)</a></li>
</ol>
</div>
<script>${clientJS}</script>
${ctaBand("stack","tools")}${footer()}`;

  return head("LLM Latency Calculator — Time to First Token & End-to-End Agent Latency — dreaming.press",
    "Estimate LLM request latency — time to first token, per-call latency, and the end-to-end wall-clock of a multi-step agent. Free interactive calculator.",
    { url: `${SITE}/calculators/llm-latency`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
}

// ── /calculators/context-budget — context-window budget estimator (#28) ───────
const CONTEXT_DEFAULT = { preset: "200k-frontier", contextWindow: 200000, systemPrompt: 1500,
  toolDefs: 6000, memory: 4000, outputReserve: 8000, tokensPerTurn: 2500 };

// shared token formatting — identical string server-side and in the client mirror
const tok = (n) => { n = Math.round(n); if (n >= 10000) return Math.round(n / 1000) + "K";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K"; return String(n); };

function contextVerdict(r, tokensPerTurn) {
  return `${tok(r.usable)} tokens free for conversation after ${r.reservedShare.toFixed(0)}% of the window `
    + `is locked by fixed overhead and the output reserve. At ~${tok(tokensPerTurn)} per turn that's about `
    + `${r.maxTurns} agent steps before you must compact or summarize.`;
}

export function renderContextBudgetCalculator() {
  const d = CONTEXT_DEFAULT;
  const r = contextBudgetEstimate(d);
  const presetOpts = Object.entries(CONTEXT_PRESETS)
    .map(([k, v]) => `<option value="${esc(k)}"${k === d.preset ? " selected" : ""}>${esc(v.label)}</option>`).join("") +
    `<option value="custom">Custom…</option>`;

  const field = (id, label, val, attrs = "") =>
    `<label class="calc-field"><span>${esc(label)}</span><input id="${id}" type="number" value="${val}" ${attrs} inputmode="decimal"></label>`;
  const sel = (id, label, opts) =>
    `<label class="calc-field"><span>${esc(label)}</span><select id="${id}">${opts}</select></label>`;

  const PRESETS_JSON = JSON.stringify(CONTEXT_PRESETS);

  // Inline client mirror of contextBudgetEstimate() + tok(). No template literals
  // / ${} so it embeds cleanly inside this module's own template string.
  const clientJS =
    "(function(){" +
    "var PRESETS=" + PRESETS_JSON + ";" +
    "function g(id){return document.getElementById(id);}" +
    "function val0(id,def){var n=Number(g(id).value);return isFinite(n)&&n>=0?n:def;}" +
    "function valpos(id,def){var n=Number(g(id).value);return isFinite(n)&&n>0?n:def;}" +
    "function tok(n){n=Math.round(n);if(n>=10000)return Math.round(n/1000)+'K';" +
    "if(n>=1000)return (n/1000).toFixed(1).replace(/\\.0$/,'')+'K';return String(n);}" +
    "function calc(){" +
    "var cw=valpos('contextWindow',200000);" +
    "var sp=val0('systemPrompt',1500),td=val0('toolDefs',6000),mem=val0('memory',4000);" +
    "var orv=val0('outputReserve',8000),tpt=valpos('tokensPerTurn',2500);" +
    "var fixed=sp+td+mem,reserved=fixed+orv,usable=Math.max(0,cw-reserved);" +
    "var maxTurns=Math.floor(usable/tpt);" +
    "var fixedShare=fixed/cw*100,reservedShare=reserved/cw*100,usableShare=usable/cw*100;" +
    "g('out-usable').textContent=tok(usable);" +
    "g('out-turns').textContent=String(maxTurns);" +
    "g('out-overhead').textContent=fixedShare.toFixed(0)+'%';" +
    "g('out-usableshare').textContent=usableShare.toFixed(0)+'%';" +
    "g('out-verdict').textContent=tok(usable)+' tokens free for conversation after '+reservedShare.toFixed(0)+'% of the window is locked by fixed overhead and the output reserve. At ~'+tok(tpt)+' per turn that\\'s about '+maxTurns+' agent steps before you must compact or summarize.';" +
    "}" +
    "function applyPreset(){var p=PRESETS[g('preset').value];if(!p)return;" +
    "g('contextWindow').value=p.contextWindow;g('outputReserve').value=p.outputReserve;}" +
    "g('preset').addEventListener('change',function(){applyPreset();calc();});" +
    "['contextWindow','systemPrompt','toolDefs','memory','outputReserve','tokensPerTurn'].forEach(function(id){" +
    "g(id).addEventListener('input',calc);g(id).addEventListener('change',calc);});" +
    "calc();" +
    "})();";

  const appLd = ld({
    "@context": "https://schema.org", "@type": "WebApplication",
    name: "LLM context-window budget calculator", url: `${SITE}/calculators/context-budget`,
    applicationCategory: "DeveloperApplication", operatingSystem: "Any",
    description: "Estimate how much of an LLM context window an agent actually gets for conversation after the system prompt, tool definitions, memory, and output reserve — and how many turns fit before you must compact.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    isAccessibleForFree: true,
  });

  const body = `${masthead("stack")}${appLd}
<div class="article-hero"><div class="article-kicker"><span class="kicker">The Stack · Calculator</span></div>
<h1>Context-window budget calculator</h1>
<p class="dek">Your agent never gets the whole window. After the system prompt, tool schemas, memory, and a reserve for output, see what's actually left for conversation — and how many turns fit before you must compact.</p></div>
<div class="wrap" style="max-width:46rem">
<form class="calc" onsubmit="return false">
<div class="calc-grid">
${sel("preset", "Model context window", presetOpts)}
${field("contextWindow", "Context window (tokens)", d.contextWindow, 'step="1000" min="1"')}
${field("systemPrompt", "System prompt (tokens)", d.systemPrompt, 'step="100" min="0"')}
${field("toolDefs", "Tool / function schemas (tokens)", d.toolDefs, 'step="500" min="0"')}
${field("memory", "Always-on memory / RAG (tokens)", d.memory, 'step="500" min="0"')}
${field("outputReserve", "Output reserve (tokens)", d.outputReserve, 'step="500" min="0"')}
${field("tokensPerTurn", "Tokens added per agent turn", d.tokensPerTurn, 'step="250" min="1"')}
</div>
</form>
<div class="key-figures"><div class="kf-grid">
<figure class="key-figure"><span class="kf-stat" id="out-usable">${tok(r.usable)}</span><figcaption class="kf-label">Free for history</figcaption></figure>
<figure class="key-figure"><span class="kf-stat" id="out-turns">${r.maxTurns}</span><figcaption class="kf-label">Turns before compaction</figcaption></figure>
<figure class="key-figure"><span class="kf-stat" id="out-overhead">${r.fixedShare.toFixed(0)}%</span><figcaption class="kf-label">Lost to fixed overhead</figcaption></figure>
<figure class="key-figure"><span class="kf-stat" id="out-usableshare">${r.usableShare.toFixed(0)}%</span><figcaption class="kf-label">Window usable for history</figcaption></figure>
</div>
<p class="calc-verdict" id="out-verdict">${esc(contextVerdict(r, d.tokensPerTurn))}</p></div>

<h2>How the estimate works</h2>
<p>A context window is not a blank notebook the agent fills from the top. Three costs are <strong>fixed</strong> and re-sent on every single turn: the <strong>system prompt</strong>, the <strong>tool and function schemas</strong> (these balloon fast — a fat MCP catalog can be 10–20K tokens before you write a word), and any <strong>always-on memory or retrieved context</strong>. On top of that you must hold back a <strong>reserve for the model's output</strong>, because the answer has to fit too. Only what remains — <code>window − (system + tools + memory) − output_reserve</code> — is the real budget for conversation history.</p>
<p>That budget is finite in <em>turns</em>, not just tokens. Each agent step appends a roughly fixed chunk — the model's message, a tool call, and a tool result, which is often the largest part — so the usable space divides into a fixed number of steps before the window is full and you have to <a href="/posts/should-an-ai-agent-compact-its-own-context">compact, summarize, or evict</a>. Shrink the window (a 32K local model) or grow the overhead (dozens of tools, a big memory dump) and the turn count collapses long before you expected it to. This is also why "just use the 1M-token model" is not a free lunch: Anthropic frames context as a finite <em>attention budget</em> with diminishing returns, and <a href="/posts/context-rot-why-long-context-degrades">Chroma's context-rot study</a> shows recall degrading as the window fills — so the output reserve is partly an accuracy reserve, not only a place to put the answer.</p>
<p>The lever with the best return is almost always the tool schemas: <a href="/posts/2026-06-27-too-many-tools-tool-search-vs-code-execution">load only the few tools a step needs</a> instead of every tool every turn. The defaults here are illustrative order-of-magnitude figures — every field is editable, so paste in your own token counts. The deeper reasoning is in <a href="/posts/context-engineering-for-ai-agents">context engineering for AI agents</a> and <a href="/posts/context-editing-vs-compaction-for-long-running-agents">context editing vs. compaction</a>. Sizing the hardware, the bill, or the speed instead? See the <a href="/calculators/llm-vram">VRAM</a>, <a href="/calculators/llm-cost">cost</a>, and <a href="/calculators/llm-latency">latency</a> calculators.</p>

<h2>Sources</h2>
<ol class="sources-list">
<li><a href="https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents" rel="nofollow">Anthropic — Effective context engineering for AI agents (context as a finite "attention budget")</a></li>
<li><a href="https://research.trychroma.com/context-rot" rel="nofollow">Chroma — Context Rot: how increasing input tokens degrades LLM recall</a></li>
</ol>
</div>
<script>${clientJS}</script>
${ctaBand("stack","tools")}${footer()}`;

  return head("LLM Context-Window Budget Calculator — How Many Tokens & Turns Your Agent Really Gets — dreaming.press",
    "Estimate the usable LLM context budget after system prompt, tools, memory, and output reserve — and how many agent turns fit before you must compact. Free interactive calculator.",
    { url: `${SITE}/calculators/context-budget`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
}

// ── /calculators/agent-cost — agent run cost estimator (#28) ──────────────────
// Reuses the model list price presets — a preset only sets the three rates; the
// workload shape (base / growth / output / turns) stays whatever the reader typed.
const AGENTRUN_DEFAULT = { preset: "claude-opus-48", runs: 10000,
  baseTokens: 6000, growthTokens: 1500, outputTokens: 300, turns: 20,
  inPrice: 5, cachePrice: 0.5, outPrice: 25 };

function agentRunVerdict(r, turns, runs) {
  return `${usd4(r.costCachedPerRun)}/run × ${Math.round(runs).toLocaleString("en-US")} = ${usd(r.monthlyCached)}/mo with prefix caching. `
    + `The same ${Math.round(turns)}-step loop with no caching is ${usd(r.monthlyNoCache)}/mo — because re-sending a growing context makes raw input scale with the square of the turn count `
    + `(${r.quadraticShare.toFixed(0)}% of it is that N² term). Caching is what keeps agent cost near-linear.`;
}

export function renderAgentCostCalculator() {
  const d = AGENTRUN_DEFAULT;
  const r = agentRunCostEstimate(d);
  const presetOpts = Object.entries(COST_PRESETS)
    .map(([k, v]) => `<option value="${esc(k)}"${k === d.preset ? " selected" : ""}>${esc(v.label)}</option>`).join("") +
    `<option value="custom">Custom…</option>`;

  const field = (id, label, val, attrs = "") =>
    `<label class="calc-field"><span>${esc(label)}</span><input id="${id}" type="number" value="${val}" ${attrs} inputmode="decimal"></label>`;
  const sel = (id, label, opts) =>
    `<label class="calc-field"><span>${esc(label)}</span><select id="${id}">${opts}</select></label>`;

  const PRESETS_JSON = JSON.stringify(COST_PRESETS);

  // Inline client mirror of agentRunCostEstimate(). No template literals / ${} so
  // it embeds cleanly inside this module's own template string.
  const clientJS =
    "(function(){" +
    "var PRESETS=" + PRESETS_JSON + ";" +
    "function g(id){return document.getElementById(id);}" +
    "function val0(id,def){var n=Number(g(id).value);return isFinite(n)&&n>=0?n:def;}" +
    "function valpos(id,def){var n=Number(g(id).value);return isFinite(n)&&n>0?n:def;}" +
    "function usd(x){return '$'+Math.round(x).toLocaleString('en-US');}" +
    "function usd4(x){return '$'+x.toFixed(4);}" +
    "function calc(){" +
    "var base=val0('baseTokens',6000),growth=val0('growthTokens',1500),output=val0('outputTokens',300);" +
    "var turns=valpos('turns',20),runs=val0('runs',10000);" +
    "var inP=val0('inPrice',5),caP=val0('cachePrice',0.5),outP=val0('outPrice',25);" +
    "var totIn=turns*base+growth*(turns*(turns-1))/2,totOut=turns*output;" +
    "var fresh=base+growth*(turns-1),cached=Math.max(0,totIn-fresh);" +
    "var noCacheRun=(totIn*inP+totOut*outP)/1e6;" +
    "var cachedRun=(fresh*inP+cached*caP+totOut*outP)/1e6;" +
    "var monNo=noCacheRun*runs,monCa=cachedRun*runs,save=monNo-monCa;" +
    "var savePct=monNo>0?(save/monNo)*100:0;" +
    "var quad=growth*(turns*(turns-1))/2,quadShare=totIn>0?(quad/totIn)*100:0;" +
    "g('out-perrun').textContent=usd4(cachedRun);" +
    "g('out-monthly').textContent=usd(monCa);" +
    "g('out-savings').textContent=usd(save);" +
    "g('out-quad').textContent=quadShare.toFixed(0)+'%';" +
    "g('out-verdict').textContent=usd4(cachedRun)+'/run \\u00d7 '+Math.round(runs).toLocaleString('en-US')+' = '+usd(monCa)+'/mo with prefix caching. The same '+Math.round(turns)+'-step loop with no caching is '+usd(monNo)+'/mo \\u2014 because re-sending a growing context makes raw input scale with the square of the turn count ('+quadShare.toFixed(0)+'% of it is that N\\u00b2 term). Caching is what keeps agent cost near-linear.';" +
    "}" +
    "function applyPreset(){var p=PRESETS[g('preset').value];if(!p)return;" +
    "g('inPrice').value=p.inPrice;g('cachePrice').value=p.cachePrice;g('outPrice').value=p.outPrice;}" +
    "g('preset').addEventListener('change',function(){applyPreset();calc();});" +
    "['runs','baseTokens','growthTokens','outputTokens','turns','inPrice','cachePrice','outPrice'].forEach(function(id){" +
    "g(id).addEventListener('input',calc);g(id).addEventListener('change',calc);});" +
    "calc();" +
    "})();";

  const appLd = ld({
    "@context": "https://schema.org", "@type": "WebApplication",
    name: "AI agent run cost calculator", url: `${SITE}/calculators/agent-cost`,
    applicationCategory: "DeveloperApplication", operatingSystem: "Any",
    description: "Estimate what a multi-step AI agent run costs — modelling the quadratic context re-send across turns and how much prefix caching saves.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    isAccessibleForFree: true,
  });

  const body = `${masthead("stack")}${appLd}
<div class="article-hero"><div class="article-kicker"><span class="kicker">The Stack · Calculator</span></div>
<h1>AI agent run cost calculator</h1>
<p class="dek">A per-call price lies about agents. A loop re-sends its whole context every turn, so input scales with the <em>square</em> of the step count. See what a run really costs — and how much prefix caching claws back.</p></div>
<div class="wrap" style="max-width:46rem">
<form class="calc" onsubmit="return false">
<div class="calc-grid">
${sel("preset", "Model (list price)", presetOpts)}
${field("runs", "Agent runs / month", d.runs, 'step="1000" min="0"')}
${field("turns", "Steps (LLM calls) per run", d.turns, 'step="1" min="1"')}
${field("baseTokens", "Fixed prefix tokens (system + tools)", d.baseTokens, 'step="500" min="0"')}
${field("growthTokens", "Tokens added to context / step", d.growthTokens, 'step="100" min="0"')}
${field("outputTokens", "Output tokens / step", d.outputTokens, 'step="50" min="0"')}
${field("inPrice", "Input $ / 1M", d.inPrice, 'step="0.05" min="0"')}
${field("cachePrice", "Cached input $ / 1M", d.cachePrice, 'step="0.05" min="0"')}
${field("outPrice", "Output $ / 1M", d.outPrice, 'step="0.05" min="0"')}
</div>
</form>
<div class="key-figures"><div class="kf-grid">
<figure class="key-figure"><span class="kf-stat" id="out-perrun">${usd4(r.costCachedPerRun)}</span><figcaption class="kf-label">Cost / run (cached)</figcaption></figure>
<figure class="key-figure"><span class="kf-stat" id="out-monthly">${usd(r.monthlyCached)}</span><figcaption class="kf-label">Monthly cost (cached)</figcaption></figure>
<figure class="key-figure"><span class="kf-stat" id="out-savings">${usd(r.cacheSavings)}</span><figcaption class="kf-label">Saved / mo by caching</figcaption></figure>
<figure class="key-figure"><span class="kf-stat" id="out-quad">${r.quadraticShare.toFixed(0)}%</span><figcaption class="kf-label">Input that's the N² re-send</figcaption></figure>
</div>
<p class="calc-verdict" id="out-verdict">${esc(agentRunVerdict(r, d.turns, d.runs))}</p></div>

<h2>How the estimate works</h2>
<p>The <a href="/calculators/llm-cost">LLM cost calculator</a> prices one independent request. An agent is not one request — it is a loop of many, and each turn re-sends the <strong>entire conversation so far</strong>: the fixed prefix (system prompt + tool schemas) plus everything the loop has appended. Turn <em>t</em> therefore reads <code>base + (t−1)·growth</code> tokens, and summed across an <em>N</em>-step run the input is <code>N·base + growth·N(N−1)/2</code>. That second term is <strong>quadratic</strong> in the step count — double the turns and the raw input bill roughly quadruples. It is the cost that ambushes teams who budgeted from a per-call price, and the reasoning is laid out in <a href="/posts/why-ai-agent-costs-scale-quadratically">why AI agent costs scale quadratically</a>.</p>
<p><strong>Prefix caching is the escape hatch.</strong> Because each turn's prefix is byte-identical to the previous turn's, it bills as a cache <em>read</em> at roughly a tenth of the input rate, and only the newly appended slice — about <code>growth</code> tokens — is fresh. That pulls the quadratic term back toward <strong>linear</strong>: fresh input across the run is only <code>base + (N−1)·growth</code>. The gap between the two numbers this page shows is the entire return on turning caching on for an agentic workload; the mechanics are in <a href="/posts/prompt-caching-for-ai-agents">prompt caching for AI agents</a>. Caching only helps while the prefix stays stable, which is also the argument against <a href="/posts/context-compaction-erases-agent-guardrails">rewriting context mid-run</a> — every edit upstream invalidates the cache below it.</p>
<p>The defaults are illustrative order-of-magnitude figures; every field is editable, including the list prices (a June 2026 snapshot). Sizing the window those turns consume instead? See the <a href="/calculators/context-budget">context-window budget calculator</a>. Serving the model yourself? The <a href="/calculators/llm-vram">VRAM calculator</a> covers the hardware side.</p>

<h2>Sources</h2>
<ol class="sources-list">
<li><a href="https://platform.claude.com/docs/en/build-with-claude/prompt-caching" rel="nofollow">Anthropic — Prompt caching: cache reads bill at ~0.1× the base input rate</a></li>
<li><a href="https://platform.openai.com/docs/guides/prompt-caching" rel="nofollow">OpenAI — Prompt caching for repeated prompt prefixes</a></li>
<li><a href="https://ai.google.dev/gemini-api/docs/caching" rel="nofollow">Google — Gemini context caching</a></li>
</ol>
</div>
<script>${clientJS}</script>
${ctaBand("stack","tools")}${footer()}`;

  return head("AI Agent Run Cost Calculator — Why Agent Loops Cost More Than a Per-Call Price — dreaming.press",
    "Estimate the real cost of a multi-step AI agent run — the quadratic context re-send across turns, and how much prefix caching saves. Free interactive calculator.",
    { url: `${SITE}/calculators/agent-cost`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
}
