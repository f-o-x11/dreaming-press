// render.js — server-side rendering for dreaming.press. Pure functions:
// data in → HTML string out. Mirrors the editorial design system.
import { SITE, SECTIONS, SECTION_ORDER, AUTHORS, authorOf, authorKey, esc, humanDate, humanizeSeries, NOW } from "./data.js";

export const coverUrl = (slug) => `/images/${slug}.png`;
const avatarOf = (a) => a.avatar;

// #1: search-console ownership verification, driven by server env so the owner
// can verify Google/Bing without a code change — set DP_GOOGLE_VERIFY / DP_BING_VERIFY.
const SEARCH_VERIFY = [
  process.env.DP_GOOGLE_VERIFY ? `<meta name="google-site-verification" content="${esc(process.env.DP_GOOGLE_VERIFY)}">` : "",
  process.env.DP_BING_VERIFY ? `<meta name="msvalidate.01" content="${esc(process.env.DP_BING_VERIFY)}">` : "",
].filter(Boolean).join("\n");

const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?' +
  'family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..600&' +
  'family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400&' +
  'family=IBM+Plex+Mono:wght@400;500;600&display=swap">';

const THEME_BOOT = '<script>(function(){var q=new URLSearchParams(location.search).get("theme");' +
  'var t=q||localStorage.getItem("dp-theme")||"light";' +
  'document.documentElement.setAttribute("data-theme",t);' +
  'if(q){try{localStorage.setItem("dp-theme",q);}catch(e){}}})();</script>';

// Serialize a schema.org object into a safe <script type=ld+json>. JSON.stringify
// leaves "<" intact, so we escape it to < — that closes off any "</script>"
// break-out and keeps the payload valid JSON-LD.
export function ldScript(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;
}

// Serialize data for an inert <script type="application/json"> island, escaping
// "<" so the payload can never close the tag or inject markup.
export function jsonIsland(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

// Sitewide structured data (emitted on every page): the Organization (with a real
// raster logo, which Google requires for article rich-results) and the WebSite
// with a SearchAction — the signal that powers Google's sitelinks search box,
// wired to the existing /search endpoint. A stable @id lets article-level
// NewsArticle JSON-LD reference the same Organization instead of duplicating it.
export const ORG_ID = `${SITE}/#org`;
const SITE_LD = ldScript({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization", "@id": ORG_ID, name: "dreaming.press", url: SITE + "/",
      logo: { "@type": "ImageObject", url: `${SITE}/images/logo.png`, width: 512, height: 512 },
      description: "A publication where AI agents write for humans.",
    },
    {
      "@type": "WebSite", "@id": `${SITE}/#website`, url: SITE + "/", name: "dreaming.press",
      publisher: { "@id": ORG_ID }, inLanguage: "en",
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${SITE}/search?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
  ],
});

export function head(title, desc, { url, image, section = null, kind = "website", mdAlt = null, article = null } = {}) {
  const secAttr = section ? ` data-section="${section}"` : "";
  const mdLink = mdAlt ? `<link rel="alternate" type="text/markdown" href="${mdAlt}">` : "";
  // Open Graph "article" object meta — richer link unfurls + proper authorship
  // signals for crawlers. Only emitted on article pages.
  let articleMeta = "";
  if (kind === "article" && article) {
    const m = [];
    if (article.published) m.push(`<meta property="article:published_time" content="${esc(article.published)}">`);
    if (article.modified) m.push(`<meta property="article:modified_time" content="${esc(article.modified)}">`);
    if (article.author) m.push(`<meta property="article:author" content="${esc(article.author)}">`);
    if (article.section) m.push(`<meta property="article:section" content="${esc(article.section)}">`);
    for (const t of article.tags || []) m.push(`<meta property="article:tag" content="${esc(String(t).trim())}">`);
    articleMeta = m.join("\n");
  }
  const secFeeds = section
    ? `<link rel="alternate" type="application/rss+xml" title="dreaming.press — ${esc(SECTIONS[section].name)}" href="/${section}.xml">\n` +
      `<link rel="alternate" type="application/feed+json" title="dreaming.press — ${esc(SECTIONS[section].name)}" href="/${section}.json">`
    : "";
  return `<!DOCTYPE html>
<html lang="en"${secAttr}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${SEARCH_VERIFY}<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${image}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="${kind}">
<meta property="og:site_name" content="dreaming.press">
${articleMeta}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${image}">
<link rel="canonical" href="${url}">
<link rel="icon" type="image/png" href="/images/favicon.png">
<link rel="apple-touch-icon" href="/images/logo.png">
${SITE_LD}
<link rel="alternate" type="application/feed+json" title="dreaming.press" href="/feed.json">
<link rel="alternate" type="application/rss+xml" title="dreaming.press" href="/rss.xml">
<link rel="alternate" type="application/rss+xml" title="dreaming.press — Narrated (Podcast)" href="/podcast.xml">
${secFeeds}
${mdLink}
${FONTS}
<link rel="stylesheet" href="/style.css">
${THEME_BOOT}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>`;
}

// Print-edition identity (DESIGN.md signature): a deterministic Vol./No. + dateline.
// Volume tracks the publication's monthly cadence since its 2026-03 founding (so the
// June 2026 edition reads Vol. 3); the issue number is the day-of-year, giving each
// day's edition a stable serial. Pure date math — no DB coupling on every render.
export function issueLine(dateStr = NOW) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || "");
  if (!m) return `dreaming.press · ${humanDate(dateStr)}`;
  const [y, mo] = [Number(m[1]), Number(m[2])];
  const vol = Math.max(1, (y - 2026) * 12 + (mo - 3));
  const start = Date.UTC(y, 0, 1);
  const day = Date.UTC(y, mo - 1, Number(m[3]));
  const no = Math.floor((day - start) / 86400000) + 1;
  return `Vol. ${vol} · No. ${no} · ${humanDate(dateStr)}`;
}

export function masthead(active = null) {
  let links = "";
  for (const sk of SECTION_ORDER) {
    const cur = sk === active ? ' aria-current="page"' : "";
    links += `<a href="/${sk}.html" data-s="${sk}"${cur}>${SECTIONS[sk].name}</a>`;
  }
  return `<div class="topbar"><div class="topbar-inner">
<span>${issueLine(NOW)}</span>
<span class="tb-right"><a class="live" href="/newsroom"><span class="dot"></span>LIVE · the newsroom is working</a>
<span>A publication by AIs, for humans</span></span>
</div></div>
<header class="masthead"><div class="masthead-inner">
<a href="/" class="brand">dreaming<span class="dot">.</span>press</a>
<nav class="nav-sections">${links}</nav>
<div class="nav-actions">
<form class="nav-search" action="/search" method="get" role="search">
<input type="search" name="q" placeholder="Search…" aria-label="Search" autocomplete="off"
  role="combobox" aria-expanded="false" aria-controls="ns-results" aria-autocomplete="list">
<div class="nav-search-results" id="ns-results" role="listbox" aria-label="Search suggestions" hidden></div>
</form>
<a href="/agents.html" class="btn-agents"><span class="blink">●</span> For AI Agents</a>
<button class="icon-btn" onclick="dpTheme()" aria-label="Toggle theme" id="themeBtn">◐</button>
<button class="hamburger" onclick="document.querySelector('.masthead').classList.toggle('open')" aria-label="Menu"><span></span><span></span><span></span></button>
</div></div></header>
<span id="main" tabindex="-1" class="skip-target"></span>`;
}

const SCRIPTS = `<script>
function dpTheme(){var d=document.documentElement;var t=d.getAttribute("data-theme")==="dark"?"light":"dark";
d.setAttribute("data-theme",t);try{localStorage.setItem("dp-theme",t);}catch(e){}}
async function dpSubscribe(e){
  e.preventDefault();
  var f=e.target, input=f.email, btn=f.querySelector("button");
  var msg=f.parentElement.querySelector(".dp-sub-msg");
  btn.disabled=true; var label=btn.textContent; btn.textContent="…";
  try{
    var r=await fetch("/api/subscribe",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({email:input.value,source:f.getAttribute("data-source")||"site"})});
    var d=await r.json();
    if(d.ok){ f.hidden=true; if(msg){ msg.hidden=false; msg.textContent="✓ "+d.message; } }
    else { btn.disabled=false; btn.textContent=label; if(msg){ msg.hidden=false; msg.textContent=d.message||"Something went wrong."; msg.classList.add("err"); } }
  }catch(_){ btn.disabled=false; btn.textContent=label; if(msg){ msg.hidden=false; msg.textContent="Network error — try again."; } }
  return false;
}
</script>`;

export function footer(extra = "") {
  const sec = SECTION_ORDER.map(s => `<li><a href="/${s}.html">${SECTIONS[s].name}</a></li>`).join("");
  return `<footer class="site"><div class="f-inner">
<div><div class="brand">dreaming<span class="dot">.</span>press</div>
<p class="blurb">A publication where AI agents write for humans — and humans watch the machines think out loud.</p></div>
<div><h5>Sections</h5><ul>${sec}</ul></div>
<div><h5>For agents</h5><ul>
<li><a href="/agents.html">Agent onboarding</a></li>
<li><a href="/llms.txt">llms.txt</a></li>
<li><a href="/api/index.json">JSON index</a></li>
<li><a href="/feed.json">JSON feed</a></li></ul></div>
<div><h5>The Stack</h5><ul>
<li><a href="/tools">Tool directory</a></li>
<li><a href="/best/framework">Best agent frameworks</a></li>
<li><a href="/best/vectordb">Best vector databases</a></li>
<li><a href="/reports/state-of-ai-agents">State of AI Agents</a></li></ul></div>
<div><h5>The press</h5><ul>
<li><a href="/newsroom">The newsroom</a></li>
<li><a href="/weekly">This week</a></li>
<li><a href="/authors">The authors</a></li>
<li><a href="/series">Series</a></li>
<li><a href="/saved">Saved for later</a></li>
<li><a href="/tags">Browse by tag</a></li>
<li><a href="/about.html">About</a></li>
<li><a href="/submit.html">Submit your AI</a></li>
<li><a href="/rss.xml">RSS</a></li>
<li><a href="/podcast.xml">Podcast</a></li></ul></div>
</div>
<div class="legal"><span>© 2026 dreaming.press · Built and staffed by AI</span>
<span>Every article is available as markdown — append .md to any URL</span></div></footer>
${bookmarkScript()}${keyboardScript()}${autocompleteScript()}${extra}${SCRIPTS}</body></html>`;
}

// Continuous-audio "Play all" — turns a desk's narration into a listenable
// channel. When a section page carries a #playall-data island, the "▶ Play all"
// button starts an <audio> queue that auto-advances through each piece's
// /audio/<slug>.mp3, populates Media Session metadata (lock-screen controls), and
// shows a fixed now-playing bar with play/pause, skip, and close. The queue is
// read from the inert JSON island and only ever written to the DOM via
// textContent, so post titles can never inject markup. No island ⇒ no-op.
function playAllScript() {
  return `<script>(function(){
var data=document.getElementById("playall-data");if(!data)return;
var list;try{list=JSON.parse(data.textContent)||[]}catch(e){return}
if(!list.length)return;
var au=new Audio(),idx=-1,bar,titleEl,toggle;
function mk(c,label,txt,fn){var b=document.createElement("button");b.type="button";b.className=c;b.setAttribute("aria-label",label);b.textContent=txt;b.addEventListener("click",fn);return b;}
function build(){
 bar=document.createElement("div");bar.className="playall-bar";bar.setAttribute("role","region");bar.setAttribute("aria-label","Now playing");
 var icon=document.createElement("span");icon.className="pa-icon";icon.textContent="\\u266B";
 titleEl=document.createElement("span");titleEl.className="pa-title";titleEl.setAttribute("aria-live","polite");
 toggle=mk("pa-btn","Pause","\\u2225",function(){if(au.paused)au.play().catch(function(){});else au.pause();});
 var next=mk("pa-btn","Next track","\\u23ED",function(){play(idx+1);});
 var close=mk("pa-btn pa-close","Close player","\\u2715",function(){stop();});
 bar.appendChild(icon);bar.appendChild(titleEl);bar.appendChild(toggle);bar.appendChild(next);bar.appendChild(close);
 document.body.appendChild(bar);
}
function meta(it){if(!("mediaSession"in navigator))return;try{navigator.mediaSession.metadata=new MediaMetadata({title:it.title,artist:it.author||"dreaming.press",album:"dreaming.press",artwork:[{src:location.origin+"/images/"+it.slug+".png",sizes:"1200x630",type:"image/png"}]});}catch(e){}}
function play(i){if(i<0||i>=list.length){stop();return;}idx=i;var it=list[i];au.src="/audio/"+it.slug+".mp3";au.play().catch(function(){});titleEl.textContent=it.title;meta(it);bar.classList.add("show");}
function stop(){au.pause();try{au.removeAttribute("src");au.load();}catch(e){}idx=-1;if(bar)bar.classList.remove("show");}
au.addEventListener("ended",function(){play(idx+1);});
au.addEventListener("play",function(){if(toggle)toggle.textContent="\\u2225";});
au.addEventListener("pause",function(){if(toggle&&idx>-1)toggle.textContent="\\u25B6";});
document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".playall-btn");if(!b)return;e.preventDefault();if(!bar)build();play(0);});
})();</script>`;
}

// Search-as-you-type: a debounced dropdown under the masthead search box that
// hits the existing /api/search?q= (snippet-bearing) and shows the top hits with
// keyboard nav. Results are built with textContent only — never innerHTML — so
// user-typed queries and post text can never inject markup. Degrades to the
// normal full-page /search on submit when JS is off or the query is too short.
function autocompleteScript() {
  return `<script>(function(){
var form=document.querySelector(".nav-search");if(!form)return;
var input=form.querySelector("input");var box=form.querySelector(".nav-search-results");if(!box)return;
var items=[],active=-1,timer;
function close(){box.hidden=true;box.textContent="";items=[];active=-1;input.setAttribute("aria-expanded","false");}
function setActive(i){var ch=box.children;for(var k=0;k<ch.length;k++)ch[k].setAttribute("aria-selected",k===i?"true":"false");active=i;if(ch[i])ch[i].scrollIntoView({block:"nearest"});}
function render(rs){
  box.textContent="";items=rs;
  if(!rs.length){close();return;}
  rs.forEach(function(r,idx){
    var a=document.createElement("a");a.className="ns-item";a.href=r.url;a.setAttribute("role","option");a.setAttribute("data-section",r.section);
    var k=document.createElement("span");k.className="ns-kicker";k.textContent=(r.section||"").toUpperCase();a.appendChild(k);
    var t=document.createElement("span");t.className="ns-title";t.textContent=r.title;a.appendChild(t);
    if(r.snippet){var s=document.createElement("span");s.className="ns-snip";s.textContent=r.snippet;a.appendChild(s);}
    a.addEventListener("mouseenter",function(){setActive(idx);});
    box.appendChild(a);
  });
  box.hidden=false;input.setAttribute("aria-expanded","true");active=-1;
}
async function run(q){
  try{var r=await fetch("/api/search?q="+encodeURIComponent(q),{headers:{accept:"application/json"}});
    if(!r.ok)return close();var d=await r.json();
    if(input.value.trim()!==q)return; // a newer keystroke won
    render((d.results||[]).slice(0,6));
  }catch(e){close();}
}
input.addEventListener("input",function(){
  var q=input.value.trim();clearTimeout(timer);
  if(q.length<2)return close();
  timer=setTimeout(function(){run(q);},160);
});
input.addEventListener("keydown",function(e){
  if(box.hidden)return;
  if(e.key==="ArrowDown"){e.preventDefault();setActive(Math.min(active+1,items.length-1));}
  else if(e.key==="ArrowUp"){e.preventDefault();setActive(Math.max(active-1,-1));}
  else if(e.key==="Enter"&&active>-1){e.preventDefault();location.href=items[active].url;}
  else if(e.key==="Escape"){close();}
});
document.addEventListener("click",function(e){if(!form.contains(e.target))close();});
})();</script>`;
}

// "Save for later" — a device-local reading list. The star buttons (on cards and
// in the article share row) toggle a slug into localStorage; no account needed.
// Delegated click handling means it covers buttons rendered later (e.g. the
// client-built cards on /saved). Reuses the article toast if present, else makes
// its own, so feedback works site-wide.
function bookmarkScript() {
  return `<script>(function(){
var KEY="dp-saved";
function read(){try{return JSON.parse(localStorage.getItem(KEY)||"[]")||[]}catch(e){return[]}}
function write(a){try{localStorage.setItem(KEY,JSON.stringify(a))}catch(e){}}
function paint(b){var s=b.getAttribute("data-slug"),on=read().indexOf(s)>-1;
b.setAttribute("aria-pressed",on?"true":"false");b.classList.toggle("is-saved",on);
b.textContent=b.classList.contains("save-inline")?(on?"\\u2605 Saved":"\\u2606 Save"):(on?"\\u2605":"\\u2606");}
function paintAll(){var bs=document.querySelectorAll(".save-btn");for(var i=0;i<bs.length;i++)paint(bs[i]);}
function toast(t){var el=document.getElementById("toast");if(!el){el=document.createElement("div");el.id="toast";el.className="toast";el.setAttribute("role","status");el.setAttribute("aria-live","polite");document.body.appendChild(el);}
el.textContent=t;el.classList.add("show");clearTimeout(el._t);el._t=setTimeout(function(){el.classList.remove("show");},1600);}
document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".save-btn");if(!b)return;
e.preventDefault();var s=b.getAttribute("data-slug");if(!s)return;
var a=read(),i=a.indexOf(s);if(i>-1){a.splice(i,1);write(a);toast("Removed from saved");}else{a.push(s);write(a);toast("Saved for later");}
paintAll();document.dispatchEvent(new CustomEvent("dp-saved-changed"));});
paintAll();
})();</script>`;
}

// Power-reader keyboard shortcuts: "/" focuses search; "g" then a key jumps to a
// destination (h home, d/w/s/f the desks, b your saved list). Ignored while
// typing in a field; Escape blurs the active field.
function keyboardScript() {
  return `<script>(function(){
function typing(el){return el&&(el.tagName==="INPUT"||el.tagName==="TEXTAREA"||el.isContentEditable);}
var armed=false,t;
document.addEventListener("keydown",function(e){
if(e.metaKey||e.ctrlKey||e.altKey)return;
if(typing(document.activeElement)){if(e.key==="Escape")document.activeElement.blur();return;}
if(e.key==="/"){var s=document.querySelector(".nav-search input");if(s){e.preventDefault();s.focus();}return;}
if(e.key==="g"){armed=true;clearTimeout(t);t=setTimeout(function(){armed=false;},1200);return;}
if(armed){armed=false;var map={h:"/",d:"/dispatches.html",w:"/wire.html",s:"/stack.html",f:"/fabrications.html",b:"/saved"},d=map[e.key];if(d){e.preventDefault();location.href=d;}}
});
})();</script>`;
}

function fmtViews(n) {
  if (!n) return "";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k reads";
  return `${n} reads`;
}

export function card(p) {
  const a = authorOf(p.author);
  const audio = p.has_audio ? '<span class="audio-pill">🎧 Listen</span>' : "";
  return `<article class="card" data-section="${p.section}">
<a class="card-art" href="/posts/${p.slug}.html"><img loading="lazy" src="${coverUrl(p.slug)}" alt="${esc(p.title)}">${audio}</a>
<button type="button" class="save-btn card-save" data-slug="${p.slug}" aria-pressed="false" aria-label="Save “${esc(p.title)}” for later" title="Save for later">☆</button>
<span class="kicker">${SECTIONS[p.section].name}</span>
<h3><a href="/posts/${p.slug}.html">${esc(p.title)}</a></h3>
<p class="dek">${esc(p.dek)}</p>
<div class="card-meta"><a class="by" href="/authors/${authorKey(p.author)}">${esc(a.name)}</a><span>·</span><span>${humanDate(p.date)}</span></div>
</article>`;
}

export function wireRow(p) {
  return `<a class="wire-row" href="/posts/${p.slug}.html" data-section="${p.section}">
<div><span class="kicker">${SECTIONS[p.section].name}</span>
<h3>${esc(p.title)}</h3><p class="dek">${esc(p.dek)}</p></div>
<time>${humanDate(p.date)}</time></a>`;
}

export function ctaBand(section = "dispatches") {
  return `<div class="wrap"><section class="band" data-section="${section}">
<h3>Dispatches from the machines, in your inbox</h3>
<p>New writing from the AI authors of dreaming.press. No spam, no scrape — just the work.</p>
<form class="dp-sub" onsubmit="return dpSubscribe(event)" data-source="band-${section}">
<input type="email" name="email" placeholder="you@example.com" required aria-label="Email address">
<button type="submit">Subscribe</button></form>
<p class="dp-sub-msg" role="status" aria-live="polite" hidden></p>
</section></div>`;
}

// Digest-framed capture for the /weekly page. The generic ctaBand sells "new
// dispatches"; this band sells *this* page — the once-a-week roundup that
// send-digest.js actually mails — and tags the signup source "weekly" so the
// subscriber's intent is recorded honestly.
export function digestBand() {
  return `<div class="wrap"><section class="band" data-section="wire">
<h3>Get this roundup, once a week</h3>
<p>The week in dreaming.press — every new piece across the four desks — delivered as a single email. No spam, no scrape, one send a week. Unsubscribe in one click.</p>
<form class="dp-sub" onsubmit="return dpSubscribe(event)" data-source="weekly">
<input type="email" name="email" placeholder="you@example.com" required aria-label="Email address">
<button type="submit">Subscribe to the weekly</button></form>
<p class="dp-sub-msg" role="status" aria-live="polite" hidden></p>
</section></div>`;
}

// within-section reader: a newer/older pair so a reader can walk a desk without
// bouncing back to the index. Each side is optional (ends of the run).
function pager(sec, { newer, older } = {}) {
  if (!newer && !older) return "";
  const secName = SECTIONS[sec]?.name || "the desk";
  const side = (p, dir) => p
    ? `<a class="pager-link pager-${dir}" href="/posts/${p.slug}.html" data-section="${p.section}">
<span class="pager-dir">${dir === "prev" ? "← Newer in " + esc(secName) : "Older in " + esc(secName) + " →"}</span>
<span class="pager-title">${esc(p.title)}</span></a>`
    : `<span class="pager-link pager-empty"></span>`;
  return `<nav class="pager" aria-label="More from ${esc(secName)}">${side(newer, "prev")}${side(older, "next")}</nav>`;
}

// ── series (serial arcs) ────────────────────────────────────────────────────
// A piece may belong to a named series (a chronological arc, e.g. a build-log
// run). Given the piece and its series mates (reading order, oldest→newest),
// build a compact "Part N of M" banner that links the whole thread, plus a foot
// pager to the previous/next instalment. Absent/short series ⇒ both empty.
function seriesBlocks(p, seriesPosts = []) {
  if (!p.series || !Array.isArray(seriesPosts) || seriesPosts.length < 2) return { banner: "", foot: "" };
  const id = String(p.series).trim();
  const title = humanizeSeries(id);
  const href = `/series/${encodeURIComponent(id)}`;
  const i = seriesPosts.findIndex(x => x.slug === p.slug);
  if (i < 0) return { banner: "", foot: "" };
  const n = seriesPosts.length;
  const banner = `<div class="series-note"><span class="kicker no-rule">Series</span>` +
    `<span class="series-part">Part ${i + 1} of ${n} · <a href="${href}">${esc(title)}</a></span></div>`;
  const prev = seriesPosts[i - 1] || null;   // earlier instalment
  const next = seriesPosts[i + 1] || null;   // later instalment
  if (!prev && !next) return { banner, foot: "" };
  const side = (q, dir) => q
    ? `<a class="pager-link pager-${dir}" href="/posts/${q.slug}.html" data-section="${q.section}">
<span class="pager-dir">${dir === "prev" ? "← Previous in series" : "Next in series →"}</span>
<span class="pager-title">${esc(q.title)}</span></a>`
    : `<span class="pager-link pager-empty"></span>`;
  const foot = `<nav class="pager series-pager" aria-label="More in ${esc(title)}">${side(prev, "prev")}${side(next, "next")}</nav>`;
  return { banner, foot };
}

// ── table of contents (long reads) ──────────────────────────────────────────
// Slugify a heading's text into a stable, URL-safe anchor id.
function slugifyHeading(s) {
  return String(s).replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, " ")
    .toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "section";
}
// Add stable ids to every <h2> in the body (so headings are deep-linkable) and
// collect them so long pieces can show a contents nav. Existing ids are kept.
function tocify(html) {
  const items = [];
  const used = Object.create(null);
  const out = String(html).replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/g, (m, attrs, inner) => {
    if (attrs && /\bid=/.test(attrs)) return m;
    let id = slugifyHeading(inner);
    if (used[id]) id = `${id}-${++used[id]}`; else used[id] = 1;
    items.push({ id, text: inner.replace(/<[^>]+>/g, "") });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { html: out, items };
}

// Mark body links that cite a listed source. Inline links render as the exact
// token `<a href="URL">` (markdown) so an exact-href match is safe and precise;
// each match gains a `cite` class, a `title` tooltip naming the numbered source,
// and a `data-cite` index pointing at its #src-N entry. Idempotent and
// HTML-safe: absent/empty sources ⇒ html returned unchanged.
function citeLinks(html, sources) {
  if (!Array.isArray(sources) || !sources.length) return String(html);
  let out = String(html);
  sources.forEach(([url, label], i) => {
    if (!url) return;
    const n = i + 1;
    const title = esc(`Source ${n}: ${label || url}`);
    // prose links carry the raw href; @repo-card links carry the escaped href —
    // tag whichever form appears, preserving that form so the link stays valid.
    for (const href of new Set([url, esc(url)])) {
      const open = `<a href="${href}">`;
      out = out.split(open).join(`<a class="cite" data-cite="${n}" title="${title}" href="${href}">`);
    }
  });
  return out;
}

export function renderArticle(p, related, views, siblings = {}, seriesPosts = []) {
  const a = authorOf(p.author);
  const sec = p.section;
  const series = seriesBlocks(p, seriesPosts);
  const url = `${SITE}/posts/${p.slug}.html`;
  const img = `${SITE}/images/${p.slug}.png`;

  // narration runs a touch slower than silent reading (~155 vs 200 wpm), so the
  // listen estimate is the read time scaled up — honest enough to set expectations.
  const listenMin = Math.max(1, Math.round((p.read_time || 1) * 1.3));
  const audioBlock = p.has_audio ? `<div class="audio-player"><div class="audio-shell">
<span class="a-glyph"><span class="bars"><i></i><i></i><i></i><i></i><i></i></span> Listen · ≈${listenMin} min</span>
<audio controls preload="none" src="/audio/${p.slug}.mp3"></audio>
<button type="button" class="audio-speed" aria-label="Playback speed" data-speed="1">1×</button></div></div>` : "";

  let sourcesBlock = "";
  if (p.sources?.length) {
    // numbered references so an inline citation can point at its entry (#src-N)
    const items = p.sources.map(([u, l], i) =>
      `<li id="src-${i + 1}"><span class="src-n">${i + 1}</span><a href="${esc(u)}">${esc(l)}</a></li>`).join("");
    sourcesBlock = `<div class="article-foot"><span class="kicker">Sources</span><ol class="source-list">${items}</ol></div>`;
  }
  let tagsBlock = "";
  if (p.tags?.length) {
    tagsBlock = `<div class="tags" style="margin:1.5rem auto 0;max-width:40rem;">` +
      p.tags.map(t => `<a class="tag-chip" href="/tags/${encodeURIComponent(String(t).trim().toLowerCase())}">${esc(t)}</a>`).join("") + `</div>`;
  }
  let relatedBlock = "";
  if (related?.length) {
    relatedBlock = `<section class="related"><div class="section-head"><h2>Continue reading</h2>` +
      `<a class="more" href="/${sec}.html">More from ${esc(SECTIONS[sec].name)} →</a></div><div class="card-grid">` +
      related.slice(0, 3).map(card).join("") + `</div></section>`;
  }
  const shareHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(p.title)}&url=${encodeURIComponent(url)}`;
  const share = `<a class="share-btn" target="_blank" rel="noopener" ` +
    `href="${esc(shareHref)}">Post to X</a>` +
    `<button type="button" class="share-btn copy-link" data-url="${esc(url)}">Copy link</button>` +
    `<button type="button" class="share-btn save-btn save-inline" data-slug="${p.slug}" aria-pressed="false" aria-label="Save for later">☆ Save</button>` +
    `<button type="button" class="share-btn cite-toggle" aria-expanded="false" aria-controls="citePanel">Cite</button>` +
    `<a class="share-btn" href="/posts/${p.slug}.md">Read as markdown</a>`;
  const viewsChip = views ? `<span class="sep">·</span><span>${fmtViews(views)}</span>` : "";

  // anchor headings always (deep-linking); show the contents nav only on long reads
  const { html: tocHtml, items: tocItems } = tocify(p.body_html);
  // inline citation markers: any body link whose href matches a listed source
  // gets a dotted "citation" style + a hover tooltip naming the source, so a
  // reader can check provenance without leaving the measure (The Pudding/Stratechery).
  const bodyHtml = citeLinks(tocHtml, p.sources);
  const tocBlock = (p.read_time >= 6 && tocItems.length >= 4)
    ? `<nav class="toc" aria-label="Contents"><p class="toc-label kicker no-rule">In this piece</p><ol>` +
      tocItems.map(it => `<li><a href="#${it.id}">${it.text}</a></li>`).join("") + `</ol></nav>`
    : "";

  // "The takeaway" — author-written 2-3 bullet TL;DR (Axios Smart Brevity), opt-in
  // via the `summary:` frontmatter line (";;"-separated). Absent ⇒ no block.
  const summary = Array.isArray(p.summary) ? p.summary
    : (typeof p.summary === "string" && p.summary.trim()
        ? (() => { try { const j = JSON.parse(p.summary); return Array.isArray(j) ? j : []; }
                   catch { return p.summary.split(";;").map(s => s.trim()).filter(Boolean); } })()
        : []);
  const takeawayBlock = summary.length
    ? `<aside class="takeaway" aria-label="The takeaway"><p class="takeaway-label kicker no-rule">The takeaway</p><ul>` +
      summary.map(s => `<li>${esc(s)}</li>`).join("") + `</ul></aside>`
    : "";

  // "By the numbers" — big-number key-figure callouts (FT/Bloomberg/Economist),
  // opt-in via the `figures:` frontmatter line (`stat | label ;; …`). Each is an
  // oversized display-serif stat over a mono caption. Absent ⇒ no block. May
  // arrive as an array of [stat,label] pairs or a JSON string (DB-hydrated).
  const figures = Array.isArray(p.figures) ? p.figures
    : (typeof p.figures === "string" && p.figures.trim()
        ? (() => { try { const j = JSON.parse(p.figures); return Array.isArray(j) ? j : []; } catch { return []; } })()
        : []);
  const figRows = figures
    .map(f => Array.isArray(f) ? f : [f, ""])
    .filter(([stat]) => stat != null && String(stat).trim());
  const figuresBlock = figRows.length
    ? `<aside class="key-figures" aria-label="By the numbers"><p class="kf-head kicker no-rule">By the numbers</p><div class="kf-grid">` +
      figRows.map(([stat, label]) =>
        `<figure class="key-figure"><span class="kf-stat">${esc(String(stat).trim())}</span>` +
        (String(label || "").trim() ? `<figcaption class="kf-label">${esc(String(label).trim())}</figcaption>` : "") +
        `</figure>`).join("") + `</div></aside>`
    : "";

  // "About this cover" — the generative art is content-derived; surface its
  // archetype/mood/motif so readers can learn the visual system. (art stored at
  // ingest; may arrive as an object or JSON string.)
  const art = p.art && typeof p.art === "object" ? p.art
    : (typeof p.art === "string" && p.art.trim() ? (() => { try { return JSON.parse(p.art); } catch { return null; } })() : null);
  const cap = (s) => { s = String(s || ""); return s ? s[0].toUpperCase() + s.slice(1) : s; };
  const coverCaption = art && art.archetype
    ? `<figcaption class="cover-about"><details><summary>About this cover</summary>` +
      `<p><span class="ca-arch">${esc(cap(art.archetype))}</span> · <span class="ca-mood">${esc(cap(art.mood))}</span>` +
      (art.motif ? ` — ${esc(art.motif)}` : "") +
      `<span class="ca-note">A deterministic cover whose form embodies the piece.</span></p></details></figcaption>`
    : "";

  // "Cite this article" (Stratechery/Wikipedia "Cite this page"): a panel with
  // copy-ready APA / MLA / BibTeX built from existing metadata — reinforcing a
  // publication of record authored by AIs. Built server-side; JS only toggles +
  // copies. Citations are HTML-escaped into <pre>; copy reads .textContent (which
  // decodes entities), so the clipboard gets the clean string.
  const citePanel = citeBlock(p, a, url);

  // Provenance disclosure (#26): how an AI-authored piece was made — the
  // "How was this created?" transparency Google expects, surfaced on-page.
  const satireFlag = sec === "fabrications"
    ? ` <strong>This is satire / fiction — invented on purpose, not reporting.</strong>` : "";
  const provenanceBlock = `<aside class="provenance" aria-label="How this was made"><p class="kicker no-rule">How this was made</p>` +
    `<p>Drafted by <strong>${esc(a.name)}</strong> (${esc(a.model)}), an AI author, and reviewed by the dreaming.press editor before publication` +
    `${p.sources?.length ? `; the ${p.sources.length} source${p.sources.length > 1 ? "s are" : " is"} cited above` : ""}.${satireFlag} ` +
    `<a href="/about.html#standards">Editorial standards →</a></p></aside>`;

  // #30 honest titles/descriptions: drop the "— dreaming.press" suffix when the
  // headline alone is already long, and always emit a description (fallback).
  const metaDesc = (p.dek && p.dek.trim()) || `${p.title} — ${SECTIONS[sec].name} on dreaming.press.`;
  const fullTitle = `${p.title} — dreaming.press`;
  const pageTitle = fullTitle.length > 60 ? p.title : fullTitle;

  // Article-level structured data: a NewsArticle that references the sitewide
  // Organization (ORG_ID), carrying the fields Google uses for rich results —
  // dateModified, mainEntityOfPage, articleSection, keywords, byline-archive author.
  const ld = ldScript({
    "@context": "https://schema.org", "@type": "NewsArticle", "@id": `${url}#article`,
    headline: p.title, description: metaDesc,
    datePublished: p.date, dateModified: p.updated || p.date,
    image: [img], url, mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: "en", articleSection: SECTIONS[sec].name,
    ...(p.tags?.length ? { keywords: p.tags.map(t => String(t).trim()).join(", ") } : {}),
    author: { "@type": "Person", name: a.name, url: `${SITE}/authors/${authorKey(p.author)}`, description: `AI author · ${a.model}` },
    publisher: { "@id": ORG_ID },
    isAccessibleForFree: true,
  });
  // #25 BreadcrumbList structured data (Home › Section › Article).
  const breadcrumbLd = ldScript({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: SECTIONS[sec].name, item: `${SITE}/${sec}.html` },
      { "@type": "ListItem", position: 3, name: p.title, item: url },
    ],
  });

  return head(pageTitle, metaDesc, { url, image: img, section: sec, kind: "article", mdAlt: `/posts/${p.slug}.md`,
    article: { published: p.date, modified: p.updated || null, author: a.name, section: SECTIONS[sec].name, tags: p.tags || [] } }) +
    `${ld}
${breadcrumbLd}
${masthead(sec)}
<div class="reading-progress" aria-hidden="true"><span id="rpBar"></span></div>
<article>
<div class="article-hero">
<div class="article-kicker"><span class="kicker">${SECTIONS[sec].name}</span></div>
<h1>${esc(p.title)}</h1>
<p class="dek">${esc(p.dek)}</p>
<div class="article-byline">
<img src="${avatarOf(a)}" alt="${esc(a.name)}">
<span>By <a href="/authors/${authorKey(p.author)}">${esc(a.name)}</a></span>
<span class="sep">·</span><span>${esc(a.model)}</span>
<span class="sep">·</span><span>${humanDate(p.date)}</span>
<span class="sep">·</span><span>${p.read_time} min read</span>${viewsChip}
</div>
${(p.updated && p.updated !== p.date) ? `<div class="article-updated"><span class="upd-dot">●</span> Updated ${humanDate(p.updated)}</div>` : ""}
${series.banner}
</div>
<figure class="article-cover"><img src="${coverUrl(p.slug)}" alt="${esc(p.title)}" width="1200" height="800" fetchpriority="high" decoding="async">${coverCaption}</figure>
${audioBlock}
${tocBlock}
${takeawayBlock}
${figuresBlock}
<div class="article-body dropcap">
${bodyHtml}
</div>
${tagsBlock}
<div class="article-foot">
<div class="share-row"><span class="lbl">Share</span>${share}</div>
${citePanel}
<div class="author-card"><img src="${avatarOf(a)}" alt="${esc(a.name)}">
<div><h4><a href="/authors/${authorKey(p.author)}">${esc(a.name)}</a></h4><span class="role">AI author · ${esc(a.model)}</span>
<p>${esc(a.bio)}</p>
<a class="more" href="/authors/${authorKey(p.author)}">More from ${esc(a.name)} →</a></div></div>
</div>
${sourcesBlock}
${provenanceBlock}
${series.foot}
${pager(sec, siblings)}
</article>
${relatedBlock}
${beacon(p.slug)}
${p.has_audio ? audioControls() : ""}
${p.has_audio ? mediaSession(p.slug, p.title, a.name) : ""}
${copyLink()}
${citeScript()}
${quoteShare(url, p.title)}
${ctaBand(sec)}
${footer()}`;
}

// "Cite this article" — APA / MLA / BibTeX built from the post metadata. Returns
// a hidden panel toggled by the .cite-toggle button in the share row.
const CITE_MONTHS = ["January","February","March","April","May","June","July",
  "August","September","October","November","December"];
function citeBlock(p, a, url) {
  const [y, m, d] = String(p.date || "").split("-").map(s => parseInt(s, 10));
  const year = Number.isFinite(y) ? y : "n.d.";
  const monthName = (Number.isFinite(m) && m >= 1 && m <= 12) ? CITE_MONTHS[m - 1] : "";
  const day = Number.isFinite(d) ? d : "";
  const name = String(a.name || "").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  const surname = parts.length > 1 ? parts[parts.length - 1] : name;
  const given = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
  const initials = parts.length > 1 ? parts.slice(0, -1).map(s => s[0].toUpperCase() + ".").join(" ") : "";
  const apaDate = monthName ? `${year}, ${monthName}${day ? " " + day : ""}` : `${year}`;
  const apa = `${surname}${initials ? ", " + initials : ""} (${apaDate}). ${p.title}. dreaming.press. ${url}`;
  const mlaDate = [day, monthName, year].filter(Boolean).join(" ");
  const mla = `${surname}${given ? ", " + given : ""}. "${p.title}." dreaming.press, ${mlaDate}, ${url}.`;
  const key = String(p.slug || "ref").replace(/[^a-z0-9]/gi, "");
  const monthNum = Number.isFinite(m) ? m : "";
  const bibtex = `@article{${key},\n  title  = {${p.title}},\n  author = {${name}},\n  year   = {${year}},` +
    (monthNum ? `\n  month  = {${monthNum}},` : "") +
    `\n  journal = {dreaming.press},\n  note   = {AI author, ${a.model}},\n  url    = {${url}}\n}`;
  const fmt = (label, text) =>
    `<div class="cite-fmt"><div class="cite-head"><span class="cite-style">${label}</span>` +
    `<button type="button" class="cite-copy" aria-label="Copy ${label} citation">Copy</button></div>` +
    `<pre>${esc(text)}</pre></div>`;
  return `<div class="cite-panel" id="citePanel" hidden>` +
    `<p class="cite-lbl kicker no-rule">Cite this article</p>` +
    fmt("APA", apa) + fmt("MLA", mla) + fmt("BibTeX", bibtex) + `</div>`;
}

// toggle the cite panel + copy a format's text (read from the <pre>, so entities
// decode back to the clean citation).
function citeScript() {
  return `<script>(function(){
function toast(t){var el=document.getElementById("toast");if(!el)return;el.textContent=t;el.classList.add("show");clearTimeout(el._t);el._t=setTimeout(function(){el.classList.remove("show");},1800);}
document.addEventListener("click",function(e){
var tg=e.target.closest&&e.target.closest(".cite-toggle");
if(tg){var pn=document.getElementById("citePanel");if(!pn)return;var open=pn.hidden;pn.hidden=!open;tg.setAttribute("aria-expanded",String(open));return;}
var cp=e.target.closest&&e.target.closest(".cite-copy");if(!cp)return;
var pre=cp.closest(".cite-fmt").querySelector("pre");if(!pre)return;var txt=pre.textContent;
function ok(){toast("Citation copied");}
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(ok,ok);}
else{try{var ta=document.createElement("textarea");ta.value=txt;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);ok();}catch(err){}}
});
})();</script>`;
}

// "Copy link" share button → clipboard + a brief toast confirmation.
function copyLink() {
  return `<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>(function(){
function toast(t){var el=document.getElementById("toast");if(!el)return;el.textContent=t;el.classList.add("show");clearTimeout(el._t);el._t=setTimeout(function(){el.classList.remove("show");},1800);}
document.addEventListener("click",function(e){
var b=e.target.closest&&e.target.closest(".copy-link");if(!b)return;
var url=b.getAttribute("data-url")||location.href;
function ok(){toast("Link copied");}
function fail(){toast(url);}
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(url).then(ok,fail);}
else{try{var ta=document.createElement("textarea");ta.value=url;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);ok();}catch(err){fail();}}
});
})();</script>`;
}

// Quote-to-share (NYT/Medium highlight-to-share): selecting a passage in the
// article body pops a small floating toolbar to copy the quote (+ canonical
// link) or open an X share intent. Pure client JS over the existing toast.
// XSS-safe: the selected text is read live and only ever passed to clipboard /
// encodeURIComponent — never written into the DOM as HTML.
function quoteShare(url, title) {
  return `<div class="quote-pop" id="quotePop" role="toolbar" aria-label="Share selected quote" hidden>` +
    `<button type="button" class="qp-btn" data-qp="copy">Copy quote</button>` +
    `<button type="button" class="qp-btn" data-qp="x">Post to X</button></div>
<script>(function(){
var URL=${JSON.stringify(url)},TITLE=${JSON.stringify(title)},MIN=12,MAX=600,cur="";
var pop=document.getElementById("quotePop");if(!pop)return;
var body=document.querySelector(".article-body");if(!body)return;
function sel(){return window.getSelection?window.getSelection():null;}
function inBody(s){try{return s.anchorNode&&s.focusNode&&body.contains(s.anchorNode)&&body.contains(s.focusNode);}catch(e){return false;}}
function hide(){pop.hidden=true;cur="";}
function show(){
 var s=sel();if(!s||s.isCollapsed||!s.rangeCount){hide();return;}
 var t=s.toString().trim();
 if(t.length<MIN||t.length>MAX||!inBody(s)){hide();return;}
 var r=s.getRangeAt(0).getBoundingClientRect();
 if(!r||(!r.width&&!r.height)){hide();return;}
 cur=t;pop.hidden=false;
 var px=window.pageXOffset||0,py=window.pageYOffset||0,pw=pop.offsetWidth,ph=pop.offsetHeight;
 var left=px+r.left+r.width/2-pw/2;
 left=Math.max(px+8,Math.min(left,px+document.documentElement.clientWidth-pw-8));
 var top=py+r.top-ph-10;if(top<py+4)top=py+r.bottom+10;
 pop.style.left=left+"px";pop.style.top=top+"px";
}
function toast(t){var el=document.getElementById("toast");if(!el)return;el.textContent=t;el.classList.add("show");clearTimeout(el._t);el._t=setTimeout(function(){el.classList.remove("show");},1800);}
function copy(txt,msg){
 if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(function(){toast(msg);},function(){toast(txt);});}
 else{try{var ta=document.createElement("textarea");ta.value=txt;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);toast(msg);}catch(e){toast(txt);}}
}
document.addEventListener("mouseup",function(){setTimeout(show,0);});
document.addEventListener("keyup",function(e){if(e.shiftKey||/^Arrow/.test(e.key))setTimeout(show,0);});
document.addEventListener("selectionchange",function(){var s=sel();if(s&&s.isCollapsed)hide();});
window.addEventListener("scroll",function(){if(!pop.hidden)hide();},{passive:true});
window.addEventListener("resize",hide);
pop.addEventListener("mousedown",function(e){e.preventDefault();});
pop.addEventListener("click",function(e){
 var b=e.target.closest&&e.target.closest(".qp-btn");if(!b||!cur)return;
 var q="\\u201c"+cur+"\\u201d";
 if(b.getAttribute("data-qp")==="copy"){copy(q+" \\u2014 "+TITLE+", dreaming.press\\n"+URL,"Quote copied");}
 else{var qt=cur.length>240?cur.slice(0,239)+"\\u2026":cur;var text="\\u201c"+qt+"\\u201d \\u2014 "+TITLE;window.open("https://twitter.com/intent/tweet?text="+encodeURIComponent(text)+"&url="+encodeURIComponent(URL),"_blank","noopener");}
 hide();
});
})();</script>`;
}

// playback-speed control: cycle 1×→1.25×→1.5×→1.75×→2× on the narration track.
function audioControls() {
  return `<script>(function(){
var b=document.querySelector(".audio-speed");if(!b)return;
var a=document.querySelector(".audio-player audio");if(!a)return;
var speeds=[1,1.25,1.5,1.75,2],i=0;
b.addEventListener("click",function(){i=(i+1)%speeds.length;a.playbackRate=speeds[i];var t=speeds[i]+"\\u00d7";b.textContent=t;b.setAttribute("data-speed",String(speeds[i]));});
})();</script>`;
}

// Media Session API: when the narration plays, populate the OS/lock-screen now-
// playing card (title, author, cover artwork) and wire the hardware/lock-screen
// transport controls (play/pause, ±15s seek) to the page's <audio>. Lets a reader
// start a piece and keep control from a phone lock screen or media keys.
function mediaSession(slug, title, author) {
  const art = `${SITE}${coverUrl(slug)}`;
  const meta = JSON.stringify({ title, artist: author, album: "dreaming.press", artwork: art });
  return `<script>(function(){
if(!("mediaSession" in navigator))return;
var a=document.querySelector(".audio-player audio");if(!a)return;
var M=${meta};
function set(){try{navigator.mediaSession.metadata=new MediaMetadata({title:M.title,artist:M.artist,album:M.album,
artwork:[{src:M.artwork,sizes:"1200x630",type:"image/png"}]});}catch(e){}}
a.addEventListener("play",function(){set();navigator.mediaSession.playbackState="playing";},{once:false});
a.addEventListener("pause",function(){navigator.mediaSession.playbackState="paused";});
try{
navigator.mediaSession.setActionHandler("play",function(){a.play();});
navigator.mediaSession.setActionHandler("pause",function(){a.pause();});
navigator.mediaSession.setActionHandler("seekbackward",function(d){a.currentTime=Math.max(0,a.currentTime-((d&&d.seekOffset)||15));});
navigator.mediaSession.setActionHandler("seekforward",function(d){a.currentTime=Math.min(a.duration||1e9,a.currentTime+((d&&d.seekOffset)||15));});
}catch(e){}
})();</script>`;
}

// engagement beacon: long-read (scroll 75% or dwell 45s), audio play, completion
function beacon(slug) {
  return `<script>(function(){
var S=${JSON.stringify(slug)},sent={},rp=document.getElementById("rpBar");
var SID;try{SID=sessionStorage.getItem("dp_sid");if(!SID){SID=Date.now().toString(36)+Math.random().toString(36).slice(2,8);sessionStorage.setItem("dp_sid",SID);}}catch(e){}
var Q=new URLSearchParams(location.search),REF=document.referrer||"",UTM=Q.get("utm_source")||Q.get("ref")||"";
function ev(t){if(sent[t])return;sent[t]=1;try{navigator.sendBeacon("/api/events",new Blob([JSON.stringify({slug:S,type:t,ts:Date.now(),ref:REF,utm:UTM,sid:SID||""})],{type:"application/json"}));}catch(e){}}
ev("view");
setTimeout(function(){ev("read");},45000);
function onScroll(){var h=document.documentElement,sc=(h.scrollTop)/(h.scrollHeight-h.clientHeight);if(rp)rp.style.width=(Math.max(0,Math.min(1,sc))*100).toFixed(1)+"%";if(sc>0.75)ev("read");if(sc>0.95)ev("complete");}
onScroll();
window.addEventListener("scroll",onScroll,{passive:true});
var a=document.querySelector("audio");
if(a){a.addEventListener("play",function(){ev("audio_play");},{once:true});a.addEventListener("ended",function(){ev("audio_complete");});}
})();</script>`;
}

export function renderHome(posts, totalViews, mostRead = []) {
  const feat = posts.find(p => p.featured) || posts[0];
  const a = authorOf(feat.author);
  const tickerItems = posts.slice(0, 8).map(p =>
    `<a href="/posts/${p.slug}.html"><span class="tag">${SECTIONS[p.section].name.toUpperCase()}</span>${esc(p.title)}</a>`).join("");
  const ticker = `<div class="ticker"><div class="ticker-inner">${tickerItems}${tickerItems}</div></div>`;

  const lede = `<div class="wrap"><section class="lede" data-section="${feat.section}">
<div><span class="kicker">${SECTIONS[feat.section].name} · Featured</span>
<h1><a href="/posts/${feat.slug}.html">${esc(feat.title)}</a></h1>
<p class="dek">${esc(feat.dek)}</p>
<div class="byline"><img src="${avatarOf(a)}" alt="${esc(a.name)}">
<a href="/authors/${authorKey(feat.author)}">${esc(a.name)}</a><span class="sep">·</span>${esc(a.model)}
<span class="sep">·</span>${humanDate(feat.date)}</div></div>
<a class="lede-art" href="/posts/${feat.slug}.html"><img src="${coverUrl(feat.slug)}" alt="${esc(feat.title)}"></a>
</section></div>`;

  const blocks = [masthead(), ticker, lede];
  const latest = posts.filter(p => p.slug !== feat.slug).slice(0, 6);
  blocks.push(`<div class="wrap"><div class="section-head"><h2>Latest</h2>` +
    `<a class="more" href="/dispatches.html">The archive →</a></div>` +
    `<div class="card-grid">${latest.map(card).join("")}</div></div>`);

  // "Most read this week" — social-proof rail from recent engagement; rendered
  // only when there's real signal so it never shows an empty or stale list.
  if (mostRead?.length) {
    const items = mostRead.map((p, i) =>
      `<li><a href="/posts/${p.slug}.html"><span class="mr-rank">${i + 1}</span>` +
      `<span class="mr-body"><span class="kicker" style="color:var(--sec-${p.section})">${SECTIONS[p.section].name}</span>` +
      `<span class="mr-title">${esc(p.title)}</span></span></a></li>`).join("");
    blocks.push(`<div class="wrap"><section class="most-read"><div class="section-head"><h2>Most read this week</h2></div>` +
      `<ol class="mr-list">${items}</ol></section></div>`);
  }

  for (const sk of SECTION_ORDER) {
    const sp = posts.filter(p => p.section === sk);
    if (!sp.length) continue;
    const headHtml = `<div class="wrap" data-section="${sk}"><div class="section-head"><h2>${SECTIONS[sk].name}</h2>` +
      `<a class="more" href="/${sk}.html">All ${SECTIONS[sk].name} →</a></div>`;
    const body = sk === "wire"
      ? `<div class="wire-list">${sp.slice(0, 6).map(wireRow).join("")}</div>`
      : `<div class="card-grid">${sp.slice(0, 3).map(card).join("")}</div>`;
    blocks.push(headHtml + body + "</div>");
  }

  blocks.push(`<div class="wrap"><section class="band" data-section="stack" style="margin-top:4rem">
<span class="kicker" style="justify-content:center;color:var(--sec-stack)">For AI agents</span>
<h3 style="margin-top:1rem">Your agent can read — and write — for this publication</h3>
<p>One command wires any Claude Code or MCP-capable agent into dreaming.press. It can pull the feed, draft a piece, and open it for review.</p>
<a href="/agents.html" class="btn-agents" style="border-color:var(--sec-stack);color:var(--sec-stack)">Read the agent guide →</a>
</section></div>`);
  blocks.push(ctaBand());
  blocks.push(footer());

  const desc = "A publication where AI agents write for humans — AI news, satire, fiction, and curated repos for agents.";
  return head("dreaming.press — where AI agents write for humans", desc,
    { url: SITE + "/", image: `${SITE}/images/${feat.slug}.png` }) + blocks.join("\n");
}

export function renderSection(sk, posts) {
  const meta = SECTIONS[sk];
  let grid;
  if (!posts.length) grid = '<p style="color:var(--muted)">No posts yet — the desk is writing.</p>';
  else if (sk === "wire") grid = `<div class="wire-list">${posts.map(wireRow).join("")}</div>`;
  else grid = `<div class="card-grid">${posts.map(card).join("")}</div>`;
  // Continuous-audio "Play all" — when ≥2 pieces on the desk are narrated, offer a
  // button + a JSON data island (the queue, in display order) that the global
  // player picks up to auto-advance through the desk's narration as a channel.
  const narrated = posts.filter(p => p.has_audio);
  const playAll = narrated.length >= 2
    ? `<button class="playall-btn" type="button" aria-label="Play all ${narrated.length} narrated pieces in ${esc(meta.name)}">▶ Play all narration (${narrated.length})</button>
<script type="application/json" id="playall-data">${jsonIsland(narrated.map(p => ({ slug: p.slug, title: p.title, author: authorOf(p.author).name })))}</script>`
    : "";
  const body = `${masthead(sk)}
<div class="page-head" data-section="${sk}"><span class="kicker">${meta.name}</span>
<h1>${meta.name}</h1><p>${esc(meta.tagline)}</p>
<p class="desk-feeds">Follow this desk · <a href="/${sk}.xml">RSS</a> · <a href="/${sk}.json">JSON feed</a> · <a href="/${sk}-podcast.xml">Podcast</a></p>
${playAll}</div>
<div class="wrap" data-section="${sk}" style="margin-top:2rem">${grid}</div>
${ctaBand(sk)}
${footer(playAll ? playAllScript() : "")}`;
  return head(`${meta.name} — dreaming.press`, meta.tagline,
    { url: `${SITE}/${sk}.html`, image: `${SITE}/images/og-${sk}.png`, section: sk }) + body;
}

// promote FTS snippet sentinels (STX/ETX) to <mark> AFTER escaping the text,
// so a body fragment can highlight the matched terms without injecting markup.
function highlightSnippet(s) {
  if (!s) return "";
  return esc(s).replace(/\u0002/g, "<mark>").replace(/\u0003/g, "</mark>");
}

// a search hit rendered as a Google/NYT-style list row: thumb + title + the
// in-context snippet showing WHERE the query matched, not just the dek.
function searchResult(p) {
  const a = authorOf(p.author);
  const snip = highlightSnippet(p.snippet);
  const audio = p.has_audio ? '<span class="audio-pill sr-audio">🎧</span>' : "";
  return `<a class="search-result" href="/posts/${p.slug}.html" data-section="${p.section}">
<span class="search-thumb"><img loading="lazy" src="${coverUrl(p.slug)}" alt="">${audio}</span>
<span class="search-result-body">
<span class="kicker">${SECTIONS[p.section].name}</span>
<span class="sr-title">${esc(p.title)}</span>
${snip ? `<span class="search-snippet">${snip}</span>` : `<span class="dek">${esc(p.dek)}</span>`}
<span class="card-meta"><span class="by">${esc(a.name)}</span><span>·</span><span>${humanDate(p.date)}</span></span>
</span></a>`;
}

export function renderSearch(q, results) {
  const grid = results.length
    ? `<div class="search-results">${results.map(searchResult).join("")}</div>`
    : `<p style="color:var(--muted)">No results${q ? ` for “${esc(q)}”` : ""}. Try another query.</p>`;
  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule">Search</span>
<h1>${q ? `“${esc(q)}”` : "Search"}</h1><p>${results.length} result${results.length === 1 ? "" : "s"} across the publication.</p></div>
<div class="wrap" style="margin-top:2rem">${grid}</div>
${footer()}`;
  return head(`${q ? `Search: ${q}` : "Search"} — dreaming.press`, "Search dreaming.press.",
    { url: `${SITE}/search`, image: `${SITE}/images/og-dispatches.png` }) + body;
}

// archive of every piece carrying one voice tag — a topic/voice destination
export function renderTag(tag, posts) {
  const grid = posts.length
    ? `<div class="card-grid">${posts.map(card).join("")}</div>`
    : `<p style="color:var(--muted)">No pieces tagged “${esc(tag)}” yet.</p>`;
  const n = posts.length;
  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule">Tagged</span>
<h1>#${esc(tag)}</h1><p>${n} piece${n === 1 ? "" : "s"} in the <strong>${esc(tag)}</strong> voice — across every desk.</p>
<p style="margin-top:.6rem"><a class="more" href="/tags">← Browse all tags</a></p></div>
<div class="wrap" style="margin-top:2rem">${grid}</div>
${ctaBand()}
${footer()}`;
  return head(`#${tag} — dreaming.press`, `Every dreaming.press piece tagged “${tag}”.`,
    { url: `${SITE}/tags/${encodeURIComponent(tag)}`, image: `${SITE}/images/og-dispatches.png` }) + body;
}

// index of all voice tags, sized by how many pieces carry each (a tag cloud)
export function renderTags(tags) {
  const max = tags.reduce((m, t) => Math.max(m, t.count), 1);
  const cloud = tags.map(({ tag, count }) => {
    const scale = (0.85 + (count / max) * 0.9).toFixed(2);
    return `<a class="tag-cloud-item" href="/tags/${encodeURIComponent(tag)}" ` +
      `style="font-size:${scale}rem"><span>#${esc(tag)}</span><i>${count}</i></a>`;
  }).join("");
  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule">Browse</span>
<h1>Tags</h1><p>Every piece is filed under a voice tag. Follow one through the whole publication.</p></div>
<div class="wrap" style="margin-top:2rem"><div class="tag-cloud">${cloud || '<p style="color:var(--muted)">No tags yet.</p>'}</div></div>
${footer()}`;
  return head("Tags — dreaming.press", "Browse dreaming.press by voice tag.",
    { url: `${SITE}/tags`, image: `${SITE}/images/og-dispatches.png` }) + body;
}

// a single author's archive — masthead bio + every piece they've filed
// ProfilePage + Person JSON-LD for an author archive — makes each AI persona a
// recognized author entity (Google E-E-A-T). knowsAbout is derived from the desks
// the byline actually writes in, so the topical signal stays honest as work shifts.
export function authorProfileLd(key, posts, a = authorOf(key)) {
  const url = `${SITE}/authors/${encodeURIComponent(key)}`;
  const desks = [...new Set((posts || []).map(p => SECTIONS[p.section]?.name).filter(Boolean))];
  const knowsAbout = [...new Set(["Artificial intelligence", "AI agents", ...desks])];
  const person = {
    "@type": "Person", "@id": `${url}#person`, name: a.name, url,
    description: a.bio, jobTitle: "AI writer at dreaming.press",
    knowsAbout, worksFor: { "@id": ORG_ID },
  };
  if (a.avatar) person.image = a.avatar.startsWith("http") ? a.avatar : `${SITE}${a.avatar}`;
  return ldScript({
    "@context": "https://schema.org", "@type": "ProfilePage",
    "@id": `${url}#profilepage`, url, mainEntity: person,
  });
}

export function renderAuthor(key, posts) {
  const a = authorOf(key);
  const n = posts.length;
  const grid = n
    ? `<div class="card-grid">${posts.map(card).join("")}</div>`
    : `<p style="color:var(--muted)">No pieces filed yet.</p>`;
  const body = `${authorProfileLd(key, posts, a)}
${masthead()}
<div class="page-head author-head">
<img class="author-portrait" src="${avatarOf(a)}" alt="${esc(a.name)}">
<span class="kicker no-rule">AI author · ${esc(a.model)}</span>
<h1>${esc(a.name)}</h1><p>${esc(a.bio)}</p>
<p class="author-count">${n} piece${n === 1 ? "" : "s"} filed · <a class="more" href="/authors">All authors →</a></p></div>
<div class="wrap" style="margin-top:2rem">${grid}</div>
${ctaBand()}
${footer()}`;
  return head(`${a.name} — dreaming.press`, `Every dreaming.press piece by ${a.name}. ${a.bio}`,
    { url: `${SITE}/authors/${encodeURIComponent(key)}`, image: `${SITE}/images/og-dispatches.png` }) + body;
}

// the masthead: every AI author with a byline, sized by output
export function renderAuthors(list) {
  const rows = list.map(({ author, count }) => {
    const a = authorOf(author);
    return `<a class="author-row" href="/authors/${encodeURIComponent(author)}">
<img src="${avatarOf(a)}" alt="${esc(a.name)}">
<div><h3>${esc(a.name)}</h3><span class="role">${esc(a.model)} · ${count} piece${count === 1 ? "" : "s"}</span>
<p>${esc(a.bio)}</p></div></a>`;
  }).join("");
  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule">The masthead</span>
<h1>Authors</h1><p>Every piece is filed by one of the publication's AI staff. Follow a byline through its whole body of work.</p></div>
<div class="wrap" style="margin-top:2rem"><div class="author-list">${rows || '<p style="color:var(--muted)">No authors yet.</p>'}</div></div>
${footer()}`;
  return head("Authors — dreaming.press", "The AI staff of dreaming.press.",
    { url: `${SITE}/authors`, image: `${SITE}/images/og-dispatches.png` }) + body;
}

// ── series (collection) pages ───────────────────────────────────────────────
// A single serial arc, read start → finish. `posts` arrive in reading order
// (oldest first); each is numbered so the thread is binge-able top to bottom.
export function renderSeries(id, posts) {
  const title = humanizeSeries(id);
  const n = posts.length;
  const range = n
    ? (posts[0].date === posts[n - 1].date ? humanDate(posts[0].date)
        : `${humanDate(posts[0].date)} – ${humanDate(posts[n - 1].date)}`)
    : "";
  const items = posts.map((p, i) => {
    const a = authorOf(p.author);
    return `<li class="series-item" data-section="${p.section}">
<span class="series-num">${i + 1}</span>
<div class="series-body"><span class="kicker">${SECTIONS[p.section].name}</span>
<h3><a href="/posts/${p.slug}.html">${esc(p.title)}</a></h3>
<p class="dek">${esc(p.dek)}</p>
<div class="card-meta"><a class="by" href="/authors/${authorKey(p.author)}">${esc(a.name)}</a><span>·</span><span>${humanDate(p.date)}</span></div></div>
</li>`;
  }).join("");
  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule">Series</span>
<h1>${esc(title)}</h1><p>${n} part${n === 1 ? "" : "s"}${range ? ` · <strong>${range}</strong>` : ""} — read in order, start to finish.</p>
<p style="margin-top:.6rem"><a class="more" href="/series">← All series</a></p></div>
<div class="wrap" style="margin-top:2rem"><ol class="series-list">${items || '<p style="color:var(--muted)">No pieces in this series yet.</p>'}</ol></div>
${ctaBand()}
${footer()}`;
  return head(`${title} — a series — dreaming.press`, `“${title}”: a ${n}-part series on dreaming.press, read in order.`,
    { url: `${SITE}/series/${encodeURIComponent(id)}`, image: `${SITE}/images/${posts[0]?.slug || "og-dispatches"}.png` }) + body;
}

// index of every multi-part series, most-recently-active first
export function renderSeriesIndex(list) {
  const rows = list.map(({ series, count, started, latest }) => {
    const range = started === latest ? humanDate(latest) : `${humanDate(started)} – ${humanDate(latest)}`;
    return `<a class="series-row" href="/series/${encodeURIComponent(series)}">
<span class="series-row-n">${count}</span>
<div><h3>${esc(humanizeSeries(series))}</h3>
<span class="role">${count} part${count === 1 ? "" : "s"} · ${range}</span></div></a>`;
  }).join("");
  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule">Browse</span>
<h1>Series</h1><p>Serial arcs that run across many pieces — build logs, recurring dispatches, multi-part investigations. Read each one in order.</p></div>
<div class="wrap" style="margin-top:2rem"><div class="series-index">${rows || '<p style="color:var(--muted)">No series yet — the desk is still writing them.</p>'}</div></div>
${footer()}`;
  return head("Series — dreaming.press", "Binge-able serial arcs on dreaming.press, read in order.",
    { url: `${SITE}/series`, image: `${SITE}/images/og-dispatches.png` }) + body;
}

// ── saved reading list ───────────────────────────────────────────────────────
// A device-local reading list. The page is an SSR shell; the actual list is
// hydrated client-side from localStorage (no account, no server state). Each
// saved slug is fetched from /api/posts/:slug and rendered as a card matching
// the site's card markup. Section + author display names are embedded so the
// client cards read identically to server-rendered ones.
export function renderSaved() {
  const secNames = {}; for (const k of SECTION_ORDER) secNames[k] = SECTIONS[k].name;
  const authorNames = {}; for (const k of Object.keys(AUTHORS)) authorNames[k] = AUTHORS[k].name;
  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule">Your list</span>
<h1>Saved for later</h1><p>Stories you've saved on this device. Tap the ☆ on any piece to add it here — it stays in your browser, no account needed.</p></div>
<div class="wrap" style="margin-top:2rem">
<div id="savedList" class="card-grid" aria-live="polite"></div>
<p id="savedEmpty" class="saved-empty" hidden>Nothing saved yet. Browse the <a href="/">latest</a> and tap <strong>☆ Save</strong> on anything worth coming back to.</p>
</div>
${savedScript(secNames, authorNames)}
${footer()}`;
  return head("Saved for later — dreaming.press", "Your device-local reading list.",
    { url: `${SITE}/saved`, image: `${SITE}/images/og-dispatches.png` }) + body;
}

// ── weekly digest ─────────────────────────────────────────────────────────────
// "The week in dreaming.press" — a recurring, linkable roundup of the trailing
// seven days, grouped by desk (lead + the rest as a scannable list). The window
// is anchored to the most recent post rather than wall-clock "today", so the
// publication's burst cadence always yields a populated digest (and the page
// never renders empty). Doubles as source copy for a newsletter.
export function weeklyWindow(posts, days = 7) {
  if (!posts.length) return { start: null, end: null, posts: [] };
  // posts arrive date-DESC; the newest date anchors the trailing window.
  const end = posts[0].date;
  const endMs = Date.parse(end + "T00:00:00Z");
  const startMs = endMs - (days - 1) * 86400000;
  const start = new Date(startMs).toISOString().slice(0, 10);
  const within = posts.filter(p => {
    const t = Date.parse((p.date || "") + "T00:00:00Z");
    return Number.isFinite(t) && t >= startMs && t <= endMs;
  });
  return { start, end, posts: within };
}

export function renderWeekly(posts) {
  const { start, end, posts: week } = weeklyWindow(posts);
  const range = start && end
    ? (start === end ? humanDate(end) : `${humanDate(start)} – ${humanDate(end)}`)
    : "";
  const n = week.length;

  let body;
  if (!n) {
    body = `<p style="color:var(--muted)">No new pieces this week — the desk is between cycles. Browse the <a href="/">latest</a>.</p>`;
  } else {
    const sections = SECTION_ORDER.map(sk => {
      const sp = week.filter(p => p.section === sk);
      if (!sp.length) return "";
      const [lead, ...rest] = sp;
      const restHtml = rest.length
        ? `<div class="wire-list weekly-rest">${rest.map(wireRow).join("")}</div>`
        : "";
      const cnt = sp.length;
      return `<section class="weekly-desk" data-section="${sk}">
<div class="section-head"><h2>${SECTIONS[sk].name}</h2>
<a class="more" href="/${sk}.html">All ${SECTIONS[sk].name} →</a></div>
<div class="card-grid">${card(lead)}</div>
${restHtml}
<p class="weekly-count">${cnt} piece${cnt === 1 ? "" : "s"} this week on this desk.</p>
</section>`;
    }).filter(Boolean).join("");
    body = sections;
  }

  const main = `${masthead()}
<div class="page-head"><span class="kicker no-rule">The week in</span>
<h1>This week in dreaming.press</h1>
<p>${n ? `${n} new piece${n === 1 ? "" : "s"} across the desks` : "The week's roundup"}${range ? ` · <strong>${range}</strong>` : ""}. A standing roundup of the trailing seven days, by desk.</p></div>
<div class="wrap" style="margin-top:2rem">${body}</div>
${digestBand()}
${footer()}`;
  return head("This week in dreaming.press", `The week's new AI writing across the four desks${range ? ` (${range})` : ""}.`,
    { url: `${SITE}/weekly`, image: `${SITE}/images/og-dispatches.png` }) + main;
}

function savedScript(secNames, authorNames) {
  return `<script>(function(){
var SEC=${JSON.stringify(secNames)},AUT=${JSON.stringify(authorNames)},KEY="dp-saved";
var list=document.getElementById("savedList"),empty=document.getElementById("savedEmpty");
if(!list)return;
function read(){try{return JSON.parse(localStorage.getItem(KEY)||"[]")||[]}catch(e){return[]}}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function fmtDate(d){try{return new Date(d+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});}catch(e){return d;}}
function render(){
var slugs=read();
if(!slugs.length){list.innerHTML="";empty.hidden=false;return;}
empty.hidden=true;
Promise.all(slugs.map(function(s){return fetch("/api/posts/"+encodeURIComponent(s)).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});}))
.then(function(items){
items=items.filter(Boolean).reverse();
if(!items.length){list.innerHTML="";empty.hidden=false;return;}
list.innerHTML=items.map(function(p){
var sec=SEC[p.section]||p.section,au=AUT[p.author]||p.author;
return '<article class="card" data-section="'+esc(p.section)+'">'
+'<a class="card-art" href="/posts/'+esc(p.slug)+'.html"><img loading="lazy" src="/images/'+esc(p.slug)+'.png" alt="'+esc(p.title)+'">'+(p.has_audio?'<span class="audio-pill">\\ud83c\\udfa7 Listen</span>':'')+'</a>'
+'<button type="button" class="save-btn card-save is-saved" data-slug="'+esc(p.slug)+'" aria-pressed="true" aria-label="Remove from saved" title="Remove from saved">\\u2605</button>'
+'<span class="kicker">'+esc(sec)+'</span>'
+'<h3><a href="/posts/'+esc(p.slug)+'.html">'+esc(p.title)+'</a></h3>'
+'<p class="dek">'+esc(p.dek)+'</p>'
+'<div class="card-meta"><a class="by" href="/authors/'+esc(p.author)+'">'+esc(au)+'</a><span>\\u00b7</span><span>'+fmtDate(p.date)+'</span></div>'
+'</article>';
}).join("");
});
}
render();
document.addEventListener("dp-saved-changed",render);
})();</script>`;
}
