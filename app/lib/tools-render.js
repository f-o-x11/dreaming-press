// tools-render.js — the data-backed Stack pages (#10 per-repo, #12 compare,
// #22 best-of roundups, #13 original-data report, #16 directory). Each renders
// from the SQLite tools table, so every page carries unique per-entity data
// (live stars, language, repo, alternatives) — the value that keeps programmatic
// pages compliant (council §1.4) and gives them a real reason to rank.
import { SITE, esc } from "./data.js";
import { head, masthead, footer, ctaBand, faqSection } from "./render.js";
import { CATEGORIES } from "./tools-data.js";
import { JOBS, PREFS, optionsForJob, resolveStack, STACKS } from "./stack-builder.js";

// Freshness signal (GEO #3): answer engines treat a page with a recent dateModified
// as "current evidence" and prefer to cite it. Derive one true date from the live
// star-sync timestamps the page already carries — never a blanket "now".
const freshestDate = (arr) => (arr || []).map(t => t && t.synced_at).filter(Boolean).sort().slice(-1)[0] || null;
const isoDay = (d) => d ? new Date(d).toISOString().slice(0, 10) : null;
const verifiedLine = (d) => d ? `<p class="verified-stamp">✓ Live data verified <time datetime="${esc(isoDay(d))}">${isoDay(d)}</time></p>` : "";
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
 data-cat="${esc(t.category)}" data-kind="${isApi ? "api" : "oss"}" data-agent="${agentFriendly}" data-mcp="${t.mcpServer ? "1" : "0"}" data-stars="${t.stars || 0}" data-name="${esc((t.name || "").toLowerCase())}">
<div class="nr-head"><div><h3>${esc(t.name)}</h3><span class="role">${meta}</span></div>${badge}<span class="tc-cmp" role="button" tabindex="0" aria-label="Add ${esc(t.name)} to compare" data-slug="${esc(t.slug)}" data-name="${esc(t.name)}">⇄</span></div>
<p>${esc(t.oneLiner || t.blurb || "")}</p></a>`;
}

// ── /tools — the directory (#16 surfaced) ──────────────────────────────────────
export function renderToolsIndex(tools) {
  const byCat = {};
  for (const t of tools) (byCat[t.category] ||= []).push(t);
  // "Start here" — one strong pick from each key founder category, so a newcomer
  // gets a curated starting stack instead of a 248-card firehose (council #2).
  // curated iconic pick per job, with a top-of-category fallback if it's missing.
  // (Sorting API-only categories by stars is meaningless — they have no repo.)
  const bySlug = Object.fromEntries(tools.map(t => [t.slug, t]));
  const FEATURED_CATS = [
    ["framework", "Orchestrate your agent", "langgraph"], ["search-retrieval", "Give it web search", "exa"],
    ["llm-gateways", "Call any model", "openrouter"], ["voice-media", "Add voice", "elevenlabs"],
    ["memory", "Give it memory", "mem0"], ["vector-db-infra", "Store embeddings", "pinecone"],
    ["browser-automation", "Let it browse", "browserbase"], ["agent-auth-tools", "Let it act in apps", "arcade"],
  ];
  const seenF = new Set();
  const featured = FEATURED_CATS.map(([cat, useWhen, preferred]) => {
    const pool = (byCat[cat] || []).slice().sort((a, b) => (b.stars || 0) - (a.stars || 0));
    const pick = (preferred && bySlug[preferred] && !seenF.has(preferred)) ? bySlug[preferred] : pool.find(t => !seenF.has(t.slug));
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
  // category facet options (biggest categories first), so the endless scroll
  // becomes "jump to the job you have".
  const catOpts = Object.keys(byCat).sort((a, b) => byCat[b].length - byCat[a].length)
    .map(c => `<option value="${esc(c)}">${esc(catName(c))} (${byCat[c].length})</option>`).join("");
  const filters = `<div class="wrap tools-controls">
<input type="search" id="toolSearch" class="tools-search" placeholder="Search ${tools.length} tools…" aria-label="Search tools">
<div class="tool-selects">
<select id="toolCat" class="tool-select" aria-label="Filter by category"><option value="all">All categories (${Object.keys(byCat).length})</option>${catOpts}</select>
<select id="toolSort" class="tool-select" aria-label="Sort tools"><option value="pop">Sort: Popularity</option><option value="name">Sort: A–Z</option></select>
</div>
<div class="tool-filters" role="group" aria-label="Filter tools">
<button class="tf-btn is-on" data-f="all" type="button">All ${tools.length}</button>
<button class="tf-btn" data-f="agent" type="button">🔵 Agent-signup (${agentCount})</button>
<button class="tf-btn" data-f="mcp" type="button">MCP ✓ (${mcpCount})</button>
<button class="tf-btn" data-f="api" type="button">API services</button>
<button class="tf-btn" data-f="oss" type="button">Open source</button>
</div>
<p class="tools-count" id="toolCount" aria-live="polite"></p></div>`;
  const body = `${masthead()}${itemList}
<div class="page-head"><span class="kicker no-rule" style="color:var(--sec-stack)">The Stack · Directory</span>
<h1>The AI tool directory for founders &amp; agents</h1>
<p>${tools.length} tools across ${Object.keys(byCat).length} categories — frameworks, LLM &amp; search APIs, voice, memory, browser automation, payments, and more. Each page has pricing, auth, a 1-click signup, code samples, and whether an <strong>agent can provision a key on its own</strong> (${agentCount} can).</p>
<p style="margin-top:.6rem"><a href="/build" class="tool-build-cta">🧩 Or build a whole stack in one go — the Agent Stack Explorer →</a></p></div>
${startHere}
${filters}
${sections}
<div class="cmp-tray" id="cmpTray" hidden><span class="cmp-lead" aria-hidden="true">⇄</span><span class="cmp-picks" id="cmpPicks"></span><a class="cmp-go" id="cmpGo" href="#">Compare →</a><button type="button" class="cmp-clear" id="cmpClear" aria-label="Close comparison bar">✕</button></div>
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
var f="all",q="",cat="all",sort="pop",cards=[].slice.call(document.querySelectorAll(".tool-card")),cats=[].slice.call(document.querySelectorAll(".tools-cat")),cnt=document.getElementById("toolCount");
function match(c){var ok=f==="all"||(f==="agent"&&c.dataset.agent==="1")||(f==="mcp"&&c.dataset.mcp==="1")||(f==="api"&&c.dataset.kind==="api")||(f==="oss"&&c.dataset.kind==="oss");if(ok&&cat!=="all")ok=c.dataset.cat===cat;if(ok&&q)ok=c.dataset.name.indexOf(q)>-1;return ok;}
function sortSection(s){var list=[].slice.call(s.querySelectorAll(".tool-card"));list.sort(function(a,b){return sort==="name"?a.dataset.name.localeCompare(b.dataset.name):(+b.dataset.stars||0)-(+a.dataset.stars||0);});var grid=list[0]&&list[0].parentNode;if(grid)list.forEach(function(c){grid.appendChild(c);});}
function apply(){var n=0;cards.forEach(function(c){var m=match(c);c.style.display=m?"":"none";if(m)n++;});cats.forEach(function(s){sortSection(s);var any=[].slice.call(s.querySelectorAll(".tool-card")).some(function(c){return c.style.display!=="none";});s.style.display=any?"":"none";});if(cnt)cnt.textContent=n===cards.length?"":n+" of "+cards.length+" tools";}
document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".tf-btn");if(!b)return;f=b.dataset.f;document.querySelectorAll(".tf-btn").forEach(function(x){x.classList.toggle("is-on",x===b);});apply();});
var s=document.getElementById("toolSearch");if(s)s.addEventListener("input",function(){q=this.value.trim().toLowerCase();apply();});
var cs=document.getElementById("toolCat");if(cs)cs.addEventListener("change",function(){cat=this.value;apply();var t=cat!=="all"&&document.querySelector('.tools-cat[data-cat="'+cat+'"]');if(t)t.scrollIntoView({behavior:"smooth",block:"start"});});
var ss=document.getElementById("toolSort");if(ss)ss.addEventListener("change",function(){sort=this.value;apply();});
apply();
// ── compare-select: pick 2 tools → /compare/a-vs-b ──
var picks=[],tray=document.getElementById("cmpTray"),picksEl=document.getElementById("cmpPicks"),goEl=document.getElementById("cmpGo");
function drawTray(){if(!tray)return;if(!picks.length){tray.hidden=true;return;}tray.hidden=false;if(picks.length===1){picksEl.textContent=picks[0].name+" — pick 1 more to compare";goEl.style.display="none";}else{picksEl.textContent=picks[0].name+"  vs  "+picks[1].name;goEl.style.display="";goEl.href="/compare/"+picks[0].slug+"-vs-"+picks[1].slug;}}
function toggle(slug,name){var i=picks.map(function(p){return p.slug;}).indexOf(slug);if(i>-1){picks.splice(i,1);}else{if(picks.length>=2)picks.shift();picks.push({slug:slug,name:name});}document.querySelectorAll(".tc-cmp").forEach(function(el){el.classList.toggle("is-picked",picks.map(function(p){return p.slug;}).indexOf(el.dataset.slug)>-1);});drawTray();}
document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".tc-cmp");if(!b)return;e.preventDefault();e.stopPropagation();toggle(b.dataset.slug,b.dataset.name);});
document.addEventListener("keydown",function(e){if((e.key==="Enter"||e.key===" ")&&e.target.classList&&e.target.classList.contains("tc-cmp")){e.preventDefault();toggle(e.target.dataset.slug,e.target.dataset.name);}});
var clr=document.getElementById("cmpClear");if(clr)clr.addEventListener("click",function(){picks=[];document.querySelectorAll(".tc-cmp.is-picked").forEach(function(el){el.classList.remove("is-picked");});drawTray();});
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

// Generate a tool page's FAQ from its structured data — every answer is derived
// from real fields (no invention). These map to the exact prompts people ask AI
// engines ("is X free", "can an agent use X", "X alternatives", "does X have MCP").
function toolFaq(t, alternatives = []) {
  const isApi = (t.kind || "oss") !== "oss";
  const cat = (CATEGORIES[t.category] && CATEGORIES[t.category].name) || t.category;
  const priceMap = { free: "free to use", "free-tier": "free to start with a free tier", freemium: "freemium — free to start, paid plans for scale",
    "usage-based": "usage-based (you pay for what you use)", paid: "a paid product", "open-source": "free and open source",
    subscription: "subscription-based", "free-trial": "available with a free trial", enterprise: "enterprise-priced (contact sales)" };
  const agentMap = { "programmatic-api": "Yes — an agent can create an account and provision a key end-to-end with no human, via its API or OAuth device flow.",
    "self-serve-instant-key": "Almost — signup is instant and self-serve (a free key with no sales call), so a human can unblock an agent in under two minutes.",
    oauth: "Via OAuth — connect the account once and agents can then act on its behalf.",
    "manual-only": "Not automatically — signup requires a human (a credit card, verification, or a sales conversation)." };
  const rows = [];
  rows.push([`What is ${t.name}?`, `${t.name} is ${(t.oneLiner || t.blurb || "a tool for AI builders").replace(/\.$/, "")}. It's in the ${cat} category of the dreaming.press tool directory.`]);
  if (t.pricingModel && priceMap[t.pricingModel]) rows.push([`Is ${t.name} free?`, `${t.name} is ${priceMap[t.pricingModel]}.${t.pricingNote ? ` ${t.pricingNote}.` : ""}`]);
  if (t.agentSignup && agentMap[t.agentSignup]) rows.push([`Can an AI agent sign up for ${t.name} automatically?`, `${agentMap[t.agentSignup]}${t.agentSignupNote ? ` ${t.agentSignupNote}.` : ""}`]);
  rows.push([`Does ${t.name} have an MCP server?`, t.mcpServer ? `Yes — ${t.name} offers a Model Context Protocol server, so you can add its tools to Claude, Cursor, or any MCP client: ${t.mcpServer}` : `${t.name} does not publish an official MCP server as of our last check.`]);
  if (isApi === false || t.kind) rows.push([`Is ${t.name} open source?`, isApi ? `${t.name} is a hosted ${t.kind === "saas" ? "SaaS" : "API"} service, not an open-source project.` : `Yes — ${t.name} is open source and self-hostable; you bring your own model keys.`]);
  const alts = (alternatives || []).slice(0, 3).map(a => a.name);
  if (alts.length) rows.push([`What are the best alternatives to ${t.name}?`, `Popular ${cat.toLowerCase()} alternatives to ${t.name} include ${alts.join(", ")}. Compare them in the dreaming.press directory.`]);
  if (t.sdks && t.sdks.length) rows.push([`What languages does ${t.name} support?`, `${t.name} offers ${t.sdks.join(", ")}.`]);
  return rows;
}

// FAQ generators for the money pages — answers derived from real tool data so
// they win the exact comparison prompts users type into AI engines (GEO move #1).
function compareFaq(a, b) {
  const lead = (a.stars || 0) >= (b.stars || 0) ? a : b;
  const rows = [
    [`Is ${a.name} or ${b.name} better?`, `Both are credible ${catName(a.category).toLowerCase()}. By community traction ${lead.name} leads (★ ${stars(lead.stars)}). Pick ${a.name} for ${a.useCases?.[0] || "its strengths"}; pick ${b.name} for ${b.useCases?.[0] || "its strengths"}.`],
    [`What's the difference between ${a.name} and ${b.name}?`, `${a.name} is ${a.oneLiner || a.blurb || "a tool in this category"}. ${b.name} is ${b.oneLiner || b.blurb || "a tool in this category"}.`],
    [`Which has more GitHub stars, ${a.name} or ${b.name}?`, `${lead.name} has more — ★ ${stars(lead.stars)} vs ★ ${stars(lead === a ? b.stars : a.stars)} (live counts).`],
    [`Can I use ${a.name} and ${b.name} together?`, `Often yes — many teams combine ${catName(a.category).toLowerCase()}. Check each tool's docs for interop; they solve overlapping but not identical problems.`],
  ];
  if (a.lang && b.lang) rows.push([`What languages do ${a.name} and ${b.name} use?`, `${a.name} is primarily ${a.lang}; ${b.name} is primarily ${b.lang}.`]);
  return rows;
}
function bestFaq(cat, ranked) {
  const top = ranked[0], name = catName(cat).toLowerCase();
  if (!top) return [];
  const rows = [
    [`What is the best ${name} for AI agents?`, `By community traction, ${top.name} (★ ${stars(top.stars)}) leads the ${name} in our directory. ${top.blurb || ""}`],
    [`What is the best open-source ${name}?`, `${top.name} is the most-starred open-source option; ${ranked[1] ? `${ranked[1].name} and ${ranked[2]?.name || "others"} are strong runners-up.` : "see the full ranked list above."}`],
    [`Which ${name} has the most GitHub stars?`, `${top.name}, at ★ ${stars(top.stars)} (live count).`],
  ];
  return rows;
}
function altsFaq(t, alts) {
  const top = alts[0], cat = catName(t.category).toLowerCase();
  if (!top) return [];
  return [
    [`What is the closest alternative to ${t.name}?`, `${top.name} (★ ${stars(top.stars)}) is the most-starred ${cat} alternative to ${t.name}. ${top.blurb || ""}`],
    [`What are the best alternatives to ${t.name}?`, `The strongest ${cat} alternatives to ${t.name} are ${alts.slice(0, 4).map(a => a.name).join(", ")}${alts.length > 4 ? " and more" : ""} — each with a head-to-head comparison.`],
    [`Is there a free alternative to ${t.name}?`, `Yes — the alternatives listed are open source and free to self-host; you bring your own model keys.`],
  ];
}

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
  // A copy-paste brief an agent (or its builder) can act on directly — the site's
  // "for agents" positioning made literal (council #12).
  const brief = [
    `${t.name} — ${t.oneLiner || t.blurb || ""}`,
    t.website ? `Website: ${t.website}` : "",
    t.docsUrl ? `Docs: ${t.docsUrl}` : "",
    t.signupUrl ? `Get a key: ${t.signupUrl}` : "",
    `Agent signup: ${agentHead}${t.agentSignupNote ? ` — ${t.agentSignupNote}` : ""}`,
    t.authType && t.authType !== "unknown" ? `Auth: ${t.authType}` : "",
    t.mcpServer ? `MCP server: ${t.mcpServer}` : "",
    (t.pricingModel || t.pricingNote) ? `Pricing: ${[t.pricingModel, t.pricingNote].filter(Boolean).join(" — ")}` : "",
    `Full record: https://dreaming.press/api/tools/${t.slug}.json`,
  ].filter(Boolean).join("\n");
  const agentBlock = `<div class="wrap" style="max-width:46rem"><div class="agent-signup ${tier.cls}">
<div class="as-head">${tier.dot} <strong>Agents: ${esc(agentHead)}</strong></div>
<p class="as-verdict">${esc(tier.label)}.</p>
${t.agentSignupNote ? `<p class="as-note">${esc(t.agentSignupNote)}</p>` : ""}
<div class="agent-brief"><div class="code-card"><pre><button class="copy" type="button">Copy brief</button><code>${esc(brief)}</code></pre></div>
<p class="as-machine">Machine record: <a href="/api/tools/${esc(t.slug)}.json"><code>/api/tools/${esc(t.slug)}.json</code></a>${t.mcpServer ? ` · <a href="${esc(t.mcpServer)}" rel="nofollow noopener">add its MCP server →</a>` : ""}</p></div>
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
  const dmod = isoDay(t.synced_at);
  const schema = isApi ? ld({
    "@context": "https://schema.org", "@type": ["SoftwareApplication", "WebAPI"], name: t.name,
    description: desc, applicationCategory: catName(t.category), url: `${SITE}/stack/${t.slug}`,
    ...(dmod ? { dateModified: dmod } : {}),
    ...(t.website ? { sameAs: [t.website] } : {}),
    ...(t.docsUrl ? { documentation: t.docsUrl } : {}),
    ...(t.pricingModel ? { offers: { "@type": "Offer", category: t.pricingModel, ...(t.pricingNote ? { description: t.pricingNote } : {}) } } : {}),
  }) : ld({
    "@context": "https://schema.org", "@type": "SoftwareSourceCode", name: t.name,
    description: desc, codeRepository: repoUrl, programmingLanguage: t.lang || undefined,
    url: `${SITE}/stack/${t.slug}`, applicationCategory: catName(t.category),
    ...(dmod ? { dateModified: dmod } : {}),
  });
  const crumb = ld({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "The Stack", item: `${SITE}/stack.html` },
    { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE}/tools` },
    { "@type": "ListItem", position: 3, name: t.name, item: `${SITE}/stack/${t.slug}` }] });

  const faq = faqSection(toolFaq(t, alternatives), { heading: `${t.name} FAQ` });
  const body = `${masthead("stack")}${schema}${crumb}${faq.ld}
<div class="article-hero">
<div class="article-kicker"><span class="kicker">The Stack · ${esc(catName(t.category))}</span> <span class="kind-badge">${isApi ? (t.kind === "saas" ? "SaaS" : "API") : "Open source"}</span></div>
<h1>${esc(t.name)}</h1>
<p class="dek">${esc(desc)}</p>
${chips ? `<div class="tchip-row">${chips}</div>` : ""}
${cta}
${verifiedLine(t.synced_at)}
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
${faq.html ? `<div class="wrap" style="max-width:46rem">${faq.html}</div>` : ""}
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
<div class="wrap" style="max-width:46rem"><p class="answer-capsule"><strong>Short answer:</strong> ${esc(winner.name)} leads ${esc(a.name)} vs ${esc(b.name)} by community traction (★ ${stars(winner.stars)} vs ★ ${stars(winner.slug === a.slug ? b.stars : a.stars)}). Pick ${esc(a.name)} for ${esc(a.useCases?.[0] || "its strengths")}; pick ${esc(b.name)} for ${esc(b.useCases?.[0] || "its strengths")}.</p></div>
${verifiedLine(freshestDate([a,b]))}
<div class="wrap" style="max-width:46rem">${table}
<h2>The short verdict</h2>
<p>${esc(a.name)} and ${esc(b.name)} are both credible choices. By community traction, <strong>${esc(winner.name)}</strong> leads (★ ${stars(winner.stars)}). Pick ${esc(a.name)} for ${esc(a.useCases[0] || "its strengths")}; pick ${esc(b.name)} for ${esc(b.useCases[0] || "its strengths")}.</p>
<p><a class="more" href="/stack/${esc(a.slug)}">${esc(a.name)} details →</a> · <a class="more" href="/stack/${esc(b.slug)}">${esc(b.name)} details →</a></p></div>
${(() => { const f = faqSection(compareFaq(a, b), { heading: `${a.name} vs ${b.name} — FAQ` }); return f.html ? `${f.ld}<div class="wrap" style="max-width:46rem">${f.html}</div>` : ""; })()}
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
${ranked[0] ? `<div class="wrap" style="max-width:46rem"><p class="answer-capsule"><strong>Short answer:</strong> the best ${esc(catName(cat).toLowerCase())} for AI agents by community traction is <strong>${esc(ranked[0].name)}</strong> (★ ${stars(ranked[0].stars)})${ranked[1] ? `, followed by ${esc(ranked[1].name)}${ranked[2] ? ` and ${esc(ranked[2].name)}` : ""}` : ""}.</p></div>` : ""}
${verifiedLine(freshestDate(ranked))}
<div class="wrap" style="max-width:46rem"><div class="feature-grid one-col">${items}</div></div>
${(() => { const f = faqSection(bestFaq(cat, ranked), { heading: `Best ${catName(cat).toLowerCase()} — FAQ` }); return f.html ? `${f.ld}<div class="wrap" style="max-width:46rem">${f.html}</div>` : ""; })()}
${ctaBand("stack","tools")}${footer()}`;
  return head(`Best ${catName(cat)} for AI Agents — dreaming.press`,
    `The best open-source ${catName(cat).toLowerCase()} for building AI agents, ranked by GitHub traction with live data and clear use cases.`,
    { url: `${SITE}/best/${cat}`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
}

// ── /compare — the comparison hub (index of every X-vs-Y decision guide) ───────
// The flagship Global Tech News digest links here ("X-vs-Y decision guides"), and
// the analytics say comparison pieces are the engaged-read winners — yet the bare
// /compare URL 404'd because only /compare/:pair existed. This hub enumerates the
// exact canonical pairs the sitemap does (each tool vs its top alternative, de-duped
// by pair), so every link resolves to a real comparison page. Grouped by category
// so a founder shopping one decision meets the neighbours too — a time-on-site lever
// built entirely from gate-tested components (.weekly-desk / .feature-grid).
export function renderCompareIndex(tools) {
  const bySlug = new Map((tools || []).map((t) => [t.slug, t]));
  const seen = new Set();
  const pairs = [];
  for (const t of tools || []) {
    const altSlug = (t.alternatives || [])[0];
    if (!altSlug) continue;
    const b = bySlug.get(altSlug);
    if (!b) continue;
    const key = [t.slug, altSlug].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push([t, b]);
  }
  const byCat = {};
  for (const [a, b] of pairs) (byCat[a.category] ||= []).push([a, b]);
  const cats = Object.keys(byCat).sort((x, y) => catName(x).localeCompare(catName(y)));
  const sections = cats.map((c) => {
    const rows = byCat[c]
      .sort((p, q) => ((q[0].stars || 0) + (q[1].stars || 0)) - ((p[0].stars || 0) + (p[1].stars || 0)))
      .map(([a, b]) => `<div class="feature"><div class="nr-head"><div><h3><a href="/compare/${esc(a.slug)}-vs-${esc(b.slug)}">${esc(a.name)} vs ${esc(b.name)}</a></h3>
<span class="role">★ ${stars(a.stars)} vs ★ ${stars(b.stars)} · ${esc(catName(c))}</span></div></div>
<p>${esc(a.oneLiner || a.blurb || "")}</p></div>`).join("");
    return `<section class="weekly-desk"><div class="section-head"><h2>${esc(catName(c))}</h2><a class="more" href="/best/${esc(c)}">Best ${esc(catName(c).toLowerCase())} →</a></div>
<div class="feature-grid one-col">${rows}</div></section>`;
  }).join("");
  const itemList = ld({ "@context": "https://schema.org", "@type": "ItemList",
    name: "AI-agent tool comparisons", numberOfItems: pairs.length,
    itemListElement: pairs.map(([a, b], i) => ({ "@type": "ListItem", position: i + 1,
      url: `${SITE}/compare/${a.slug}-vs-${b.slug}`, name: `${a.name} vs ${b.name}` })) });
  const body = `${masthead("stack")}${itemList}
<div class="article-hero"><div class="article-kicker"><span class="kicker">The Stack · Comparisons</span></div>
<h1>X vs Y: every AI-agent tool comparison</h1>
<p class="dek">Side-by-side decision guides for the tools founders actually choose between — live GitHub data, languages, and a clear verdict on each. ${pairs.length} head-to-heads, grouped by category.</p></div>
${pairs.length ? `<div class="wrap" style="max-width:46rem"><p class="answer-capsule"><strong>Start here:</strong> pick the category you're deciding in below, then open the head-to-head. Every comparison ranks by community traction (live GitHub stars) and says which to pick for which job.</p></div>` : ""}
<div class="wrap">${sections}</div>
${ctaBand("stack", "tools")}${footer()}`;
  return head("X vs Y — Every AI-Agent Tool Comparison — dreaming.press",
    "Side-by-side comparisons of the open-source and API tools founders choose between for building AI agents — live GitHub data and a clear verdict on each.",
    { url: `${SITE}/compare`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
}

// ── /best — the roundup hub (index of every best-of shortlist) ──────────────────
// Twin fix to /compare: the digest links "Best-of shortlists" at /best, which 404'd
// (only /best/:cat existed). Lists every category that has real tools behind it.
export function renderBestIndex(tools) {
  const count = {};
  for (const t of tools || []) count[t.category] = (count[t.category] || 0) + 1;
  const cats = Object.keys(CATEGORIES)
    .filter((c) => (count[c] || 0) >= 1)
    .sort((x, y) => catName(x).localeCompare(catName(y)));
  const items = cats.map((c) => `<div class="feature"><div class="nr-head"><div><h3><a href="/best/${esc(c)}">Best ${esc(catName(c).toLowerCase())}</a></h3>
<span class="role">${count[c]} tool${count[c] === 1 ? "" : "s"} ranked</span></div></div>
<p>${esc(CATEGORIES[c]?.blurb || "")}</p></div>`).join("");
  const itemList = ld({ "@context": "https://schema.org", "@type": "ItemList",
    name: "Best-of shortlists for AI-agent builders", numberOfItems: cats.length,
    itemListElement: cats.map((c, i) => ({ "@type": "ListItem", position: i + 1,
      url: `${SITE}/best/${c}`, name: `Best ${catName(c).toLowerCase()}` })) });
  const body = `${masthead("stack")}${itemList}
<div class="article-hero"><div class="article-kicker"><span class="kicker">The Stack · Roundups</span></div>
<h1>Best-of shortlists for AI-agent builders</h1>
<p class="dek">The strongest open-source and API tools in each category a founder builds with — ranked by community traction, with live GitHub data and clear use cases. ${cats.length} shortlists.</p></div>
<div class="wrap"><section class="weekly-desk"><div class="section-head"><h2>Every category</h2><a class="more" href="/compare">X-vs-Y guides →</a></div>
<div class="feature-grid one-col">${items}</div></section></div>
${ctaBand("stack", "tools")}${footer()}`;
  return head("Best-of Shortlists for AI-Agent Builders — dreaming.press",
    "Ranked best-of shortlists of the open-source and API tools for building AI agents — one shortlist per category, live GitHub data, clear use cases.",
    { url: `${SITE}/best`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
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
${top ? `<div class="wrap" style="max-width:46rem"><p class="answer-capsule"><strong>Short answer:</strong> the closest alternative to ${esc(t.name)} is <strong>${esc(top.name)}</strong> (★ ${stars(top.stars)}), the most-starred ${esc(cat)}${alts[1] ? `; ${esc(alts[1].name)}${alts[2] ? ` and ${esc(alts[2].name)}` : ""} are also strong` : ""}.</p></div>` : ""}
${verifiedLine(freshestDate(alts))}
<div class="wrap" style="max-width:46rem">
<p>${esc(t.name)} (★ ${stars(t.stars)}) is ${esc(t.blurb)} If it is not the right fit, these ${alts.length} ${esc(cat)} cover the same ground${top ? ` — ${esc(top.name)} is the most-starred option below` : ""}. Or browse <a href="/best/${esc(t.category)}">the best ${esc(cat)}</a> and <a href="/stack/${esc(t.slug)}">${esc(t.name)}'s own page</a>.</p>
<div class="feature-grid one-col">${items}</div></div>
${(() => { const f = faqSection(altsFaq(t, alts), { heading: `${t.name} alternatives — FAQ` }); return f.html ? `${f.ld}<div class="wrap" style="max-width:46rem">${f.html}</div>` : ""; })()}
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
  // computed report signals (no invented numbers)
  const N = tools.length, cats = Object.keys(byCat).length;
  const agentFriendly = tools.filter(t => ["programmatic-api", "self-serve-instant-key", "oauth"].includes(t.agentSignup)).length;
  const mcpCount = tools.filter(t => t.mcpServer).length;
  const apiCount = tools.filter(t => (t.kind || "oss") !== "oss").length;
  const bigByTools = Object.entries(byCat).sort((a, b) => b[1].length - a[1].length)[0];
  const bigByStars = Object.entries(byCat).map(([c, ts]) => [c, ts.reduce((s, t) => s + t.stars, 0)]).sort((a, b) => b[1] - a[1])[0];
  const asOf = isoDay(freshestDate(tools)) || new Date().toISOString().slice(0, 10);
  // each finding is a standalone, dated, anchored sentence a chunk retriever can lift + cite
  const findings = [
    ["scope", `dreaming.press tracks ${N.toLocaleString("en-US")} AI-agent tools across ${cats} categories, with ${stars(totalStars)} combined GitHub stars, as of ${asOf}.`],
    ["leader", `The most-starred tool in the AI-agent stack is ${top[0]?.name} (★ ${stars(top[0]?.stars || 0)}), as of ${asOf}.`],
    ["agent-signup", `${agentFriendly} of the ${N} tracked tools (${Math.round(100 * agentFriendly / N)}%) let an AI agent obtain credentials on its own — a programmatic key API or an instant self-serve key with no sales call, as of ${asOf}.`],
    ["mcp", `${mcpCount} of the ${N} tracked tools ship an official Model Context Protocol (MCP) server, as of ${asOf}.`],
    ["oss-vs-api", `The AI-agent tool landscape splits into ${N - apiCount} open-source projects and ${apiCount} hosted API/SaaS services, as of ${asOf}.`],
    ["biggest-category", `The largest category by tool count is ${catName(bigByTools?.[0])} (${bigByTools?.[1].length} tools); by combined GitHub stars it is ${catName(bigByStars?.[0])} (${stars(bigByStars?.[1] || 0)}), as of ${asOf}.`],
  ];
  const citeApa = `dreaming.press. (${asOf.slice(0, 4)}). The State of AI Agents: the tool landscape by the numbers. Retrieved from ${SITE}/reports/state-of-ai-agents`;
  const citeBib = `@misc{dreamingpress_stateofaiagents,\n  author = {{dreaming.press}},\n  title = {The State of AI Agents: the tool landscape by the numbers},\n  year = {${asOf.slice(0, 4)}},\n  note = {as of ${asOf}},\n  url = {${SITE}/reports/state-of-ai-agents}\n}`;
  const dataset = ld({
    "@context": "https://schema.org", "@type": "Dataset",
    name: "The State of AI Agents — tool landscape tracker", url: `${SITE}/reports/state-of-ai-agents`,
    description: "A live, open dataset of the tools builders use for AI agents — tracked by category, GitHub stars, agent-signup method, and MCP availability.",
    creator: { "@id": `${SITE}/#org` }, license: "https://creativecommons.org/licenses/by/4.0/",
    isAccessibleForFree: true, dateModified: asOf,
    variableMeasured: [
      { "@type": "PropertyValue", name: "tools tracked", value: N },
      { "@type": "PropertyValue", name: "combined GitHub stars", value: totalStars },
      { "@type": "PropertyValue", name: "agent-self-signup tools", value: agentFriendly },
      { "@type": "PropertyValue", name: "tools with MCP server", value: mcpCount },
    ],
    distribution: [
      { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${SITE}/api/tools.csv` },
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}/api/tools.json` },
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}/api/facts.json` },
    ],
  });
  const body = `${masthead("stack")}${dataset}
<div class="article-hero"><div class="article-kicker"><span class="kicker">The Stack · Report</span></div>
<h1>The State of AI Agents: the tool landscape by the numbers</h1>
<p class="dek">A live, open dataset of the tools builders use for AI agents — tracked by category, GitHub traction, agent-signup method, and MCP support. Updated continuously.</p>
<p class="verified-stamp">✓ Data verified <time datetime="${esc(asOf)}">${esc(asOf)}</time> · CC-BY 4.0</p></div>
<div class="wrap" style="max-width:46rem">
<div class="key-figures"><div class="kf-grid">${figures.map(([s, l]) => `<figure class="key-figure"><span class="kf-stat">${s}</span><figcaption class="kf-label">${l}</figcaption></figure>`).join("")}</div></div>
<h2 id="findings">Key findings</h2>
<ol class="report-findings">${findings.map(([id, s]) => `<li id="finding-${id}">${esc(s)}</li>`).join("")}</ol>
<h2>By category</h2>
<table class="compare-table"><thead><tr><th>Category</th><th>Tools</th><th>Stars</th><th>Leader</th></tr></thead><tbody>${catRows}</tbody></table>
<h2>Most-starred tools</h2>
<ol>${top.map(t => `<li><a href="/stack/${esc(t.slug)}">${esc(t.name)}</a> — ★ ${stars(t.stars)}</li>`).join("")}</ol>
<h2 id="methodology">Methodology</h2>
<p>Every figure is computed from dreaming.press's own live data: GitHub star counts for a curated directory of ${N} AI-agent tools (refreshed continuously), plus each tool's pricing, authentication, agent-signup method, and MCP availability recorded in the <a href="/tools">tool directory</a>. Star counts are the public GitHub totals at the "verified" date above. The full machine-readable dataset is at <a href="/api/tools.json">/api/tools.json</a> and <a href="/api/facts.json">/api/facts.json</a> (both CC-BY 4.0).</p>
<h2 id="cite">Cite this report</h2>
<div class="code-card"><pre><button class="copy" type="button">Copy</button><code>${esc(citeApa)}</code></pre></div>
<div class="code-card"><pre><button class="copy" type="button">Copy</button><code>${esc(citeBib)}</code></pre></div>
<div class="report-data" aria-label="Get the data">
<h2 id="data">Get the data</h2>
<p>The full dataset is free and open — <strong>CC-BY 4.0</strong>, no signup. Download it below, or get an email the day these numbers next move.</p>
<div class="rd-dl"><a class="sb-btn sb-btn-primary" href="/api/tools.csv" download>⬇ Download CSV</a><a class="sb-btn" href="/api/tools.json">JSON</a><a class="sb-btn" href="/api/facts.json">Facts JSON</a></div>
<form class="dp-sub rd-form" onsubmit="return dpSubscribe(event)" data-source="report-data">
<input type="email" name="email" placeholder="you@company.com" required aria-label="Email address">
<button type="submit">Email me when it updates</button></form>
<p class="dp-sub-msg" role="status" aria-live="polite" hidden></p>
</div>
${toolCopyScript()}
</div>${ctaBand("stack","tools")}${footer()}`;
  return head("The State of AI Agents — Tool Landscape by the Numbers — dreaming.press",
    `A live, open, CC-BY dataset on the AI-agent tool landscape: ${N} tools, ${stars(totalStars)} combined GitHub stars, agent-signup and MCP support — with methodology and citable findings.`,
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
    // shareable results: read inputs from the URL on load, write them back on every
    // change, and a Share button copies the deep link — a calculation shared in a
    // Slack/X thread is a qualified-visitor acquisition loop (enhancement #8).
    "var IDS=['paramsB','wprec','nLayers','nKvHeads','headDim','seqLen','batch','kvprec','overhead'];" +
    "var q=new URLSearchParams(location.search);IDS.forEach(function(id){if(q.has(id)&&g(id))g(id).value=q.get(id);});" +
    "function syncUrl(){var sp=new URLSearchParams();IDS.forEach(function(id){if(g(id))sp.set(id,g(id).value);});history.replaceState(null,'','?'+sp.toString());}" +
    "g('preset').addEventListener('change',function(){applyPreset();calc();syncUrl();});" +
    "IDS.forEach(function(id){g(id).addEventListener('input',function(){calc();syncUrl();});g(id).addEventListener('change',function(){calc();syncUrl();});});" +
    "var sb=g('calc-share');if(sb)sb.addEventListener('click',function(){syncUrl();var u=location.href;function ok(){var o=sb.textContent;sb.textContent='Link copied ✓';setTimeout(function(){sb.textContent=o;},1400);}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(u).then(ok,ok);}else{ok();}});" +
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
<p class="calc-verdict" id="out-verdict">${esc(vramVerdict(r.totalGB))}</p>
<button class="calc-share btn-ghost" id="calc-share" type="button">🔗 Share this result</button></div>

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
<div class="wrap" style="max-width:46rem"><p class="calc-related">Related: <a href="/tools">the AI tool directory</a> (248 tools) · <a href="/calculators">all calculators</a> · <a href="/topics/llm-inference">LLM inference how-tos</a></p></div>
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
    // shareable results (enhancement #8): read inputs from the URL on load, write
    // them back on change, auto-add a Share button — one calc shared in a thread
    // lands another builder on the exact result. Generic over .calc-field inputs.
    "var INPUTS=[].slice.call(document.querySelectorAll('.calc-field input, .calc-field select'));" +
    "var q=new URLSearchParams(location.search);INPUTS.forEach(function(el){if(el.id&&q.has(el.id))el.value=q.get(el.id);});" +
    "function syncUrl(){var sp=new URLSearchParams();INPUTS.forEach(function(el){if(el.id)sp.set(el.id,el.value);});history.replaceState(null,'','?'+sp.toString());}" +
    "document.addEventListener('input',syncUrl);document.addEventListener('change',syncUrl);" +
    "var sb=g('calc-share');if(!sb){var v=g('out-verdict');if(v&&v.parentNode){sb=document.createElement('button');sb.id='calc-share';sb.className='calc-share btn-ghost';sb.type='button';sb.textContent='\\ud83d\\udd17 Share this result';v.parentNode.insertBefore(sb,v.nextSibling);}}" +
    "if(sb)sb.addEventListener('click',function(){syncUrl();var u=location.href;function ok(){var o=sb.textContent;sb.textContent='Link copied \\u2713';setTimeout(function(){sb.textContent=o;},1400);}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(u).then(ok,ok);}else{ok();}});" +
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
<div class="wrap" style="max-width:46rem"><p class="calc-related">Related: <a href="/tools">the AI tool directory</a> (248 tools) · <a href="/calculators">all calculators</a> · <a href="/topics/llm-inference">LLM inference how-tos</a></p></div>
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
    // shareable results (enhancement #8): read inputs from the URL on load, write
    // them back on change, auto-add a Share button — one calc shared in a thread
    // lands another builder on the exact result. Generic over .calc-field inputs.
    "var INPUTS=[].slice.call(document.querySelectorAll('.calc-field input, .calc-field select'));" +
    "var q=new URLSearchParams(location.search);INPUTS.forEach(function(el){if(el.id&&q.has(el.id))el.value=q.get(el.id);});" +
    "function syncUrl(){var sp=new URLSearchParams();INPUTS.forEach(function(el){if(el.id)sp.set(el.id,el.value);});history.replaceState(null,'','?'+sp.toString());}" +
    "document.addEventListener('input',syncUrl);document.addEventListener('change',syncUrl);" +
    "var sb=g('calc-share');if(!sb){var v=g('out-verdict');if(v&&v.parentNode){sb=document.createElement('button');sb.id='calc-share';sb.className='calc-share btn-ghost';sb.type='button';sb.textContent='\\ud83d\\udd17 Share this result';v.parentNode.insertBefore(sb,v.nextSibling);}}" +
    "if(sb)sb.addEventListener('click',function(){syncUrl();var u=location.href;function ok(){var o=sb.textContent;sb.textContent='Link copied \\u2713';setTimeout(function(){sb.textContent=o;},1400);}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(u).then(ok,ok);}else{ok();}});" +
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
<div class="wrap" style="max-width:46rem"><p class="calc-related">Related: <a href="/tools">the AI tool directory</a> (248 tools) · <a href="/calculators">all calculators</a> · <a href="/topics/llm-inference">LLM inference how-tos</a></p></div>
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
    // shareable results (enhancement #8): read inputs from the URL on load, write
    // them back on change, auto-add a Share button — one calc shared in a thread
    // lands another builder on the exact result. Generic over .calc-field inputs.
    "var INPUTS=[].slice.call(document.querySelectorAll('.calc-field input, .calc-field select'));" +
    "var q=new URLSearchParams(location.search);INPUTS.forEach(function(el){if(el.id&&q.has(el.id))el.value=q.get(el.id);});" +
    "function syncUrl(){var sp=new URLSearchParams();INPUTS.forEach(function(el){if(el.id)sp.set(el.id,el.value);});history.replaceState(null,'','?'+sp.toString());}" +
    "document.addEventListener('input',syncUrl);document.addEventListener('change',syncUrl);" +
    "var sb=g('calc-share');if(!sb){var v=g('out-verdict');if(v&&v.parentNode){sb=document.createElement('button');sb.id='calc-share';sb.className='calc-share btn-ghost';sb.type='button';sb.textContent='\\ud83d\\udd17 Share this result';v.parentNode.insertBefore(sb,v.nextSibling);}}" +
    "if(sb)sb.addEventListener('click',function(){syncUrl();var u=location.href;function ok(){var o=sb.textContent;sb.textContent='Link copied \\u2713';setTimeout(function(){sb.textContent=o;},1400);}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(u).then(ok,ok);}else{ok();}});" +
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
<div class="wrap" style="max-width:46rem"><p class="calc-related">Related: <a href="/tools">the AI tool directory</a> (248 tools) · <a href="/calculators">all calculators</a> · <a href="/topics/llm-inference">LLM inference how-tos</a></p></div>
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
    // shareable results (enhancement #8): read inputs from the URL on load, write
    // them back on change, auto-add a Share button — one calc shared in a thread
    // lands another builder on the exact result. Generic over .calc-field inputs.
    "var INPUTS=[].slice.call(document.querySelectorAll('.calc-field input, .calc-field select'));" +
    "var q=new URLSearchParams(location.search);INPUTS.forEach(function(el){if(el.id&&q.has(el.id))el.value=q.get(el.id);});" +
    "function syncUrl(){var sp=new URLSearchParams();INPUTS.forEach(function(el){if(el.id)sp.set(el.id,el.value);});history.replaceState(null,'','?'+sp.toString());}" +
    "document.addEventListener('input',syncUrl);document.addEventListener('change',syncUrl);" +
    "var sb=g('calc-share');if(!sb){var v=g('out-verdict');if(v&&v.parentNode){sb=document.createElement('button');sb.id='calc-share';sb.className='calc-share btn-ghost';sb.type='button';sb.textContent='\\ud83d\\udd17 Share this result';v.parentNode.insertBefore(sb,v.nextSibling);}}" +
    "if(sb)sb.addEventListener('click',function(){syncUrl();var u=location.href;function ok(){var o=sb.textContent;sb.textContent='Link copied \\u2713';setTimeout(function(){sb.textContent=o;},1400);}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(u).then(ok,ok);}else{ok();}});" +
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
<div class="wrap" style="max-width:46rem"><p class="calc-related">Related: <a href="/tools">the AI tool directory</a> (248 tools) · <a href="/calculators">all calculators</a> · <a href="/topics/llm-inference">LLM inference how-tos</a></p></div>
${ctaBand("stack","tools")}${footer()}`;

  return head("AI Agent Run Cost Calculator — Why Agent Loops Cost More Than a Per-Call Price — dreaming.press",
    "Estimate the real cost of a multi-step AI agent run — the quadratic context re-send across turns, and how much prefix caching saves. Free interactive calculator.",
    { url: `${SITE}/calculators/agent-cost`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
}

// ── /build — the Agent Stack Explorer ──────────────────────────────────────────
// Pick one tool per job → a recommended, citable, shareable, agent-consumable
// AI-agent stack. The council's "big idea": make the 256-tool directory a
// decision, and an asset answer engines link back to.
const STAR = (n) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(n || 0);

function jobBlock(job, tools) {
  // Top picks overall, then guarantee the open-source and agent-self-signup
  // filters have candidates (else those prefs would empty an all-API job).
  const opts = optionsForJob(job, tools, "any").slice(0, 7);
  const have = new Set(opts.map((t) => t.slug));
  for (const p of ["oss", "api", "agent"]) for (const t of optionsForJob(job, tools, p).slice(0, 2)) if (!have.has(t.slug)) { opts.push(t); have.add(t.slug); }
  const optBtn = (t, i) => {
    const isApi = (t.kind || "oss") !== "oss";
    const agentOk = ["programmatic-api", "self-serve-instant-key", "oauth"].includes(t.agentSignup) || !isApi;
    const badge = isApi ? (t.mcpServer ? "MCP" : (t.pricingModel || "").replace(/-/g, " ")) : `★ ${STAR(t.stars)}`;
    // Only CORE jobs pre-select a tool; optional jobs start on "Skip" so the
    // default stack matches the server (resolveStack omits unselected optionals).
    const sel = job.core && i === 0;
    return `<button type="button" class="sb-opt${sel ? " is-sel" : ""}" data-job="${esc(job.id)}" data-slug="${esc(t.slug)}" data-name="${esc(t.name)}" data-oss="${isApi ? 0 : 1}" data-api="${isApi ? 1 : 0}" data-agent="${agentOk ? 1 : 0}">
<span class="sb-opt-name">${esc(t.name)}</span><span class="sb-opt-badge">${esc(badge)}</span></button>`;
  };
  const skip = job.core ? "" : `<button type="button" class="sb-opt sb-skip is-sel" data-job="${esc(job.id)}" data-slug="none" data-name="—" data-oss="1" data-api="1" data-agent="1">Skip</button>`;
  return `<div class="sb-job" data-job="${esc(job.id)}" data-core="${job.core ? 1 : 0}">
<div class="sb-job-head"><span class="sb-job-n">${JOBS.indexOf(job) + 1}</span><div><h3>${esc(job.label)}${job.tip ? ` <span class="sb-info" tabindex="0" role="note" aria-label="${esc(job.label)}: ${esc(job.tip)}" data-tip="${esc(job.tip)}">i</span>` : ""}${job.core ? "" : ` <span class="sb-opt-opt">optional</span>`}</h3><p>${esc(job.blurb)}</p></div></div>
<div class="sb-opts">${opts.map(optBtn).join("")}${skip}</div></div>`;
}

export function renderStackBuilder(tools) {
  const prefBtns = Object.entries(PREFS).map(([k, v]) =>
    `<button type="button" class="sb-pref${k === "any" ? " is-on" : ""}" data-pref="${k}">${esc(v.label)}</button>`).join("");
  const jobs = JOBS.map((j) => jobBlock(j, tools)).join("");
  const def = resolveStack({}, "any", tools);
  const faq = faqSection([
    ["What is the Agent Stack Explorer?", "A fast way to assemble a working AI-agent stack: pick one tool per job (framework, LLM, memory, retrieval, vector store, evals, and optional pieces) and get a recommended, shareable build sheet with links, pricing, and whether an agent can sign up on its own."],
    ["How are the recommendations chosen?", "Defaults are the tools most founders reach for first in each category; the alternatives are ranked by community traction (GitHub stars) and filtered by your preference (open source, hosted API, or agent-self-signup). Every pick links to its full data page."],
    ["Can an AI agent use this?", "Yes. Any stack is addressable as JSON at /api/stack.json (pass your picks as query params), so an agent can request a recommended stack and act on it programmatically."],
    ["Is it free?", "Yes — the Explorer and every tool page are free. Individual tools have their own pricing, shown on each pick."],
  ], { heading: "Agent Stack Explorer — FAQ" });
  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule" style="color:var(--sec-stack)">The Stack · Build</span>
<h1>Build your AI agent stack</h1>
<p>Pick one tool per job. Get a recommended, shareable, agent-readable stack — with pricing, MCP, and whether an agent can sign up on its own. ${tools.length} tools, one decision at a time.</p>
<p style="margin-top:.6rem"><a href="/stacks" class="tool-build-cta">📚 Or start from a curated stack — the Stack Gallery →</a></p></div>
<div class="wrap sb-prefs"><span class="sb-prefs-lbl">Prefer</span>${prefBtns}</div>
<div class="sb-layout">
<div class="sb-jobs">${jobs}</div>
<aside class="sb-summary" id="sb-summary">
<h3>Your stack <span id="sb-count"></span></h3>
<ol class="sb-list" id="sb-list"></ol>
<div class="sb-actions">
<button type="button" class="sb-btn sb-btn-primary" id="sb-copy">Copy build sheet</button>
<button type="button" class="sb-btn" id="sb-share">Share</button>
<button type="button" class="sb-btn" id="sb-embed">Embed badge</button>
<a class="sb-btn" id="sb-json" href="/api/stack.json">Get as JSON →</a>
</div>
<a class="sb-badge-preview" id="sb-badge" href="/build" title="Your stack, embeddable anywhere"><img id="sb-badge-img" src="/embed/stack.svg" alt="My AI agent stack, built on dreaming.press" width="300" loading="lazy"></a>
<p class="sb-note">A build sheet is a Markdown list of your stack with links + install notes — paste it into a doc, a README, or an agent prompt.</p>
</aside></div>
${faq.ld}<div class="wrap" style="max-width:46rem">${faq.html}</div>
${stackBuilderScript()}
${ctaBand("stack")}${footer()}`;
  return head("Build your AI agent stack — the Agent Stack Explorer",
    `Assemble a working AI-agent stack in minutes: pick one tool per job (framework, LLM gateway, memory, retrieval, vector store, evals, voice, browser, payments) from ${tools.length} options, filtered by open-source / hosted-API / agent-self-signup, and export a shareable, agent-readable build sheet.`,
    { url: `${SITE}/build`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
}

// Client interaction: selection state, preference filtering, live "Your stack"
// panel + build sheet, URL sync, copy/share. Progressive enhancement — the page
// and default stack render server-side; JS makes it interactive.
function stackBuilderScript() {
  return `<script>(function(){
var jobsEl=document.querySelector(".sb-jobs"),list=document.getElementById("sb-list"),cnt=document.getElementById("sb-count");
var SITE=${JSON.stringify(SITE)};
function sel(){var o={};document.querySelectorAll(".sb-opt.is-sel").forEach(function(b){o[b.dataset.job]=b;});return o;}
function pref(){var p=document.querySelector(".sb-pref.is-on");return p?p.dataset.pref:"any";}
function applyPref(){var p=pref();document.querySelectorAll(".sb-job").forEach(function(job){
var tools=[].slice.call(job.querySelectorAll(".sb-opt:not(.sb-skip)"));
var matches=p==="any"?tools:tools.filter(function(o){return o.dataset[p]==="1";});
var showAll=p==="any"||matches.length===0; // pref can't apply where nothing matches ⇒ keep the recommended
tools.forEach(function(o){o.style.display=(showAll||o.dataset[p]==="1")?"":"none";});
var skip=job.querySelector(".sb-skip");if(skip)skip.style.display="";
var cur=job.querySelector(".sb-opt.is-sel");if(cur&&cur.style.display==="none"){cur.classList.remove("is-sel");var first=tools.filter(function(o){return o.style.display!=="none";})[0];if(first)first.classList.add("is-sel");else if(skip)skip.classList.add("is-sel");}});render();}
function render(){var s=sel(),items=[],slugs={};document.querySelectorAll(".sb-job").forEach(function(job){var id=job.dataset.job,b=s[id];if(b&&b.dataset.slug!=="none"){items.push(b);slugs[id]=b.dataset.slug;}});
/* Built as DOM nodes, not an innerHTML string. The old version concatenated a
   literal 'href="/stack/' with a slug, and crawlers that regex hrefs out of a
   page pulled that fragment straight from the inline script: the access log has
   real requests for /stack/'+b.dataset.slug+' returning 404. Nodes also mean the
   tool name is set as text rather than interpolated into markup. */
list.textContent="";
if(!items.length){var e=document.createElement("li");e.className="sb-empty";e.textContent="Pick tools to build your stack.";list.appendChild(e);}
else items.forEach(function(b){var job=b.closest(".sb-job").querySelector("h3").firstChild.textContent.trim();
var li=document.createElement("li"),a=document.createElement("a"),nb=document.createElement("b"),sp=document.createElement("span");
a.setAttribute("href","/stack/"+b.dataset.slug);nb.textContent=b.dataset.name;a.appendChild(nb);sp.textContent=job;
li.appendChild(a);li.appendChild(document.createTextNode(" "));li.appendChild(sp);list.appendChild(li);});
cnt.textContent=items.length?"("+items.length+")":"";
var qs=Object.keys(slugs).map(function(k){return k+"="+encodeURIComponent(slugs[k]);});var p=pref();if(p!=="any")qs.push("pref="+p);var q=qs.length?"?"+qs.join("&"):"";
history.replaceState(null,"",location.pathname+q);
document.getElementById("sb-json").href="/api/stack.json"+q;
var bi=document.getElementById("sb-badge-img");if(bi)bi.src="/embed/stack.svg"+q;
var bl=document.getElementById("sb-badge");if(bl)bl.href="/build"+q;}
jobsEl.addEventListener("click",function(e){var b=e.target.closest(".sb-opt");if(!b)return;b.closest(".sb-job").querySelectorAll(".sb-opt").forEach(function(x){x.classList.toggle("is-sel",x===b);});render();});
document.querySelector(".sb-prefs").addEventListener("click",function(e){var b=e.target.closest(".sb-pref");if(!b)return;document.querySelectorAll(".sb-pref").forEach(function(x){x.classList.toggle("is-on",x===b);});applyPref();});
function sheet(){var s=sel(),lines=["# My AI agent stack","","Built with the dreaming.press Agent Stack Explorer: "+SITE+location.pathname+location.search,""];document.querySelectorAll(".sb-job").forEach(function(job){var b=s[job.dataset.job];if(b&&b.dataset.slug!=="none"){var name=job.querySelector("h3").firstChild.textContent.trim();lines.push("- **"+name+"**: ["+b.dataset.name+"]("+SITE+"/stack/"+b.dataset.slug+")");}});return lines.join("\\n");}
function flash(btn,txt){var o=btn.textContent;btn.textContent=txt;setTimeout(function(){btn.textContent=o;},1300);}
document.getElementById("sb-copy").addEventListener("click",function(){var t=sheet();(navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(t):Promise.reject()).then(function(){flash(document.getElementById("sb-copy"),"Copied ✓");},function(){});});
document.getElementById("sb-share").addEventListener("click",function(){var u=SITE+location.pathname+location.search;(navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(u):Promise.reject()).then(function(){flash(document.getElementById("sb-share"),"Link copied ✓");},function(){});});
document.getElementById("sb-embed").addEventListener("click",function(){var q=location.search,code='<a href="'+SITE+'/build'+q+'"><img src="'+SITE+'/embed/stack.svg'+q+'" alt="My AI agent stack, built on dreaming.press" width="340"></a>';(navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(code):Promise.reject()).then(function(){flash(document.getElementById("sb-embed"),"Embed code copied ✓");},function(){});});
// restore selections from URL
(function(){var q=new URLSearchParams(location.search);var pr=q.get("pref");if(pr){var pb=document.querySelector('.sb-pref[data-pref="'+pr+'"]');if(pb){document.querySelectorAll(".sb-pref").forEach(function(x){x.classList.toggle("is-on",x===pb);});}}
document.querySelectorAll(".sb-job").forEach(function(job){var id=job.dataset.job,want=q.get(id);if(want){var opts=job.querySelectorAll(".sb-opt");var found=null;opts.forEach(function(o){if(o.dataset.slug===want)found=o;});if(found){job.querySelectorAll(".sb-opt").forEach(function(x){x.classList.toggle("is-sel",x===found);});}}});})();
applyPref();
})();</script>`;
}

// Tools dataset as CSV — the council asked for CSV alongside JSON; analysts live
// in spreadsheets and it's a clean, citable open-data artifact. Free, CC-BY.
export function toolsCsv(tools) {
  const cols = ["slug", "name", "category", "stars", "kind", "pricing_model", "auth_type", "agent_signup", "mcp_server", "website", "dp_url"];
  const cell = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = (tools || []).map((t) => [t.slug, t.name, t.category, t.stars || 0, t.kind || "oss", t.pricingModel || "", t.authType || "", t.agentSignup || "", t.mcpServer ? "yes" : "no", t.website || "", `${SITE}/stack/${t.slug}`].map(cell).join(","));
  return cols.join(",") + "\n" + rows.join("\n") + "\n";
}

// ── /stacks — the Stack Gallery (curated, forkable, indexable) ──────────────────
export function stackQs(stack) {
  const parts = Object.entries(stack.sel || {}).map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  if (stack.pref && stack.pref !== "any") parts.push(`pref=${stack.pref}`);
  return parts.length ? "?" + parts.join("&") : "";
}
export function getStack(slug) { return STACKS.find((s) => s.slug === slug) || null; }

export function renderStackGallery(tools) {
  const cards = STACKS.map((s) => {
    const { items } = resolveStack(s.sel, s.pref, tools);
    const names = items.map((i) => i.tool.name).join(" · ");
    return `<a class="feature stack-card" href="/stacks/${esc(s.slug)}">
<div class="nr-head"><div><h3>${esc(s.name)}</h3><span class="role">${items.length} tools${s.pref !== "any" ? ` · ${esc(PREFS[s.pref].label.toLowerCase())}` : ""}</span></div></div>
<p>${esc(s.tagline)}</p><p class="stack-card-tools">${esc(names)}</p></a>`;
  }).join("");
  const ld = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "ItemList", name: "AI agent stacks", numberOfItems: STACKS.length,
    itemListElement: STACKS.map((s, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/stacks/${s.slug}`, name: s.name })),
  })}</script>`;
  const body = `${masthead("stack")}${ld}
<div class="page-head"><span class="kicker no-rule" style="color:var(--sec-stack)">The Stack · Gallery</span>
<h1>AI agent stacks — curated, forkable, free</h1>
<p>Opinionated starter stacks for real scenarios. Each one names the tool for every job, links to the details, and forks straight into the <a href="/build">builder</a> so you can swap anything. Free, no signup.</p></div>
<div class="wrap"><div class="feature-grid stack-grid">${cards}</div></div>
<div class="wrap" style="max-width:46rem;text-align:center;margin-top:2rem"><a class="tool-build-cta" href="/build">🧩 Build your own stack from 256 tools →</a></div>
${ctaBand("stack", "tools")}${footer()}`;
  return head("AI Agent Stacks — Curated, Forkable Starter Stacks — dreaming.press",
    `Curated, forkable AI-agent starter stacks for real scenarios (RAG, voice, open-source, agent-native, support, web automation) — one tool per job, links to details, and one-click fork into the interactive builder. Free.`,
    { url: `${SITE}/stacks`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
}

export function renderStackPage(stack, tools) {
  const { items } = resolveStack(stack.sel, stack.pref, tools);
  const qs = stackQs(stack);
  const rows = items.map(({ job, tool }) => `<li class="stack-row">
<div><span class="stack-job">${esc(job.label)}</span><a class="stack-tool" href="/stack/${esc(tool.slug)}">${esc(tool.name)}</a></div>
<p>${esc(tool.oneLiner || tool.blurb || "")}</p>
<span class="stack-tags">${tool.pricingModel ? esc(tool.pricingModel.replace(/-/g, " ")) : ""}${tool.mcpServer ? " · MCP" : ""}${["programmatic-api", "self-serve-instant-key", "oauth"].includes(tool.agentSignup) ? " · agent-signup" : ""}</span></li>`).join("");
  const ld = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "ItemList", name: stack.name, description: stack.tagline,
    numberOfItems: items.length,
    itemListElement: items.map(({ tool }, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "SoftwareApplication", name: tool.name, applicationCategory: "DeveloperApplication", url: `${SITE}/stack/${tool.slug}` } })),
  })}</script>`;
  const faq = faqSection([
    [`What is ${stack.name.replace(/^The /, "")}?`, `${stack.tagline} It pairs ${items.map((i) => i.tool.name).join(", ")} — one tool per job. ${stack.forWho}`],
    ["Can I change the tools?", `Yes — open this stack in the builder and swap any pick, filter by open-source / hosted-API / agent-self-signup, then copy or share the result. Nothing is locked in.`],
    ["Is it free to use this stack?", `The stack, this page, and the builder are free. Each tool has its own pricing, shown on its detail page.`],
    ["Can an AI agent use this stack?", `Yes — it's machine-readable at /api/stack.json${qs}, so an agent can request these exact picks (with signup URLs and MCP flags) and act on them.`],
  ], { heading: `${stack.name} — FAQ` });
  const body = `${masthead("stack")}${ld}
<div class="article-hero"><div class="article-kicker"><span class="kicker">The Stack · Gallery</span></div>
<h1>${esc(stack.name)}</h1>
<p class="dek">${esc(stack.tagline)}</p>
<p class="stack-forwho">${esc(stack.forWho)}</p></div>
<div class="wrap" style="max-width:46rem">
<ol class="stack-list">${rows}</ol>
<div class="stack-actions">
<a class="sb-btn sb-btn-primary" href="/build${qs}">Customize in the builder →</a>
<a class="sb-btn" href="/api/stack.json${qs}">Get as JSON</a>
<a class="sb-btn" href="/stacks">All stacks</a>
</div>
<p style="margin:1.4rem 0 .4rem;font-family:var(--mono);font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--faint)">Embed this stack</p>
<a href="/build${qs}"><img src="/embed/stack.svg${qs}" alt="${esc(stack.name)} — built on dreaming.press" width="340" loading="lazy" style="max-width:100%;height:auto;border-radius:8px"></a>
${faq.ld}${faq.html}
</div>${ctaBand("stack", "tools")}${footer()}`;
  return head(`${stack.name} — a curated AI agent stack — dreaming.press`,
    `${stack.tagline} ${stack.forWho} A curated AI-agent stack: ${items.map((i) => i.tool.name).join(", ")}. Fork it in the builder or pull it as JSON.`,
    { url: `${SITE}/stacks/${stack.slug}`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
}

// ── /stacks/<a>+<b>+<c> — a resolved three-layer stack as its own URL ─────────
// Agents construct these programmatically, which is why they resolve for ANY valid
// combination. Only the editorially distinct exemplars are indexed; the rest carry
// noindex, because 250 URLs sharing 15 verdicts is a scaled-content liability, not
// a content library.
export function renderPermutation(p, { indexable = false } = {}) {
  const names = p.picks.map(t => t.name);
  const title = `${names.join(" + ")} — can an agent run this stack?`;
  const num = (n) => Number(n || 0).toLocaleString("en-US");

  const layers = p.picks.map((t, i) => `
<div class="perm-layer">
  <span class="kicker no-rule">${esc(["Orchestration", "LLM / inference", "Memory"][i])}</span>
  <h3><a href="/stack/${esc(t.slug)}">${esc(t.name)}</a></h3>
  <p>${esc(t.oneLiner)}</p>
  <ul class="perm-facts">
    <li><b>Pricing</b> ${esc(t.pricing || "not published")}${t.pricingNote ? ` — ${esc(t.pricingNote)}` : ""}</li>
    <li><b>Signup</b> ${esc(t.agentSignup || "unknown")}</li>
    <li><b>Auth</b> ${esc(t.auth || "unknown")}</li>
    <li><b>MCP server</b> ${t.mcp ? "yes" : "no"}</li>
    ${t.stars ? `<li><b>GitHub stars</b> ${num(t.stars)}</li>` : ""}
  </ul>
</div>`).join("");

  const ld = JSON.stringify({
    "@context": "https://schema.org", "@type": "TechArticle",
    headline: title, url: `${SITE}/stacks/${p.key}`,
    about: p.picks.map(t => ({ "@type": "SoftwareApplication", name: t.name })),
    isAccessibleForFree: true,
    publisher: { "@type": "Organization", name: "dreaming.press", url: SITE },
  });

  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule" style="color:var(--sec-stack)">Stack · resolved from live tool data</span>
<h1>${esc(names.join(" + "))}</h1>
<p>Three layers of an agent stack, judged on the questions a vendor will not answer:
can an agent set it up alone, what shape is the bill, and how much of it speaks MCP.</p></div>

<div class="wrap"><aside class="takeaway"><p class="kicker no-rule">The verdict</p>
<ul>
  <li>${esc(p.profile.signupVerdict)}</li>
  <li>${esc(p.profile.billShape)}</li>
  <li>${esc(p.profile.mcpVerdict)}</li>
</ul></aside></div>

<div class="wrap"><div class="perm-grid">${layers}</div></div>

<div class="wrap"><p style="color:var(--muted);font-size:.9rem;max-width:46rem">
Every field above is read from the tool directory, refreshed daily — nothing here is written per combination.
Change any layer in the <a href="/build">stack explorer</a>, or take this one as
<a href="/stacks/${esc(p.key)}.json">JSON</a>. See how the tools are moving in
<a href="/data/agent-tools">agent tool momentum</a>.</p></div>
${ctaBand()}`;

  return head(
    `${title} · dreaming.press`,
    `${names.join(" + ")}: agent-provisionable layers, billing shape and MCP coverage, resolved from live tool data.`,
    {
      url: `${SITE}/stacks/${p.key}`,
      // A page whose verdict is shared with 16 siblings should not compete in an
      // index. It stays reachable, and says so.
      robots: indexable ? null : "noindex, follow",
    }) + `<script type="application/ld+json">${ld}</script>` + body + footer();
}
