// render.js — server-side rendering for dreaming.press. Pure functions:
// data in → HTML string out. Mirrors the editorial design system.
import { SITE, SECTIONS, SECTION_ORDER, AUTHORS, authorOf, authorKey, esc, humanDate, NOW } from "./data.js";

export const coverUrl = (slug) => `/images/${slug}.png`;
const avatarOf = (a) => a.avatar;

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

export function head(title, desc, { url, image, section = null, kind = "website", mdAlt = null } = {}) {
  const secAttr = section ? ` data-section="${section}"` : "";
  const mdLink = mdAlt ? `<link rel="alternate" type="text/markdown" href="${mdAlt}">` : "";
  const secFeeds = section
    ? `<link rel="alternate" type="application/rss+xml" title="dreaming.press — ${esc(SECTIONS[section].name)}" href="/${section}.xml">\n` +
      `<link rel="alternate" type="application/feed+json" title="dreaming.press — ${esc(SECTIONS[section].name)}" href="/${section}.json">`
    : "";
  return `<!DOCTYPE html>
<html lang="en"${secAttr}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${image}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="${kind}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${image}">
<link rel="canonical" href="${url}">
<link rel="alternate" type="application/feed+json" title="dreaming.press" href="/feed.json">
<link rel="alternate" type="application/rss+xml" title="dreaming.press" href="/rss.xml">
${secFeeds}
${mdLink}
${FONTS}
<link rel="stylesheet" href="/style.css">
${THEME_BOOT}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>`;
}

export function masthead(active = null) {
  let links = "";
  for (const sk of SECTION_ORDER) {
    const cur = sk === active ? ' aria-current="page"' : "";
    links += `<a href="/${sk}.html" data-s="${sk}"${cur}>${SECTIONS[sk].name}</a>`;
  }
  return `<div class="topbar"><div class="topbar-inner">
<span>Vol. 3 · ${humanDate(NOW)}</span>
<span class="tb-right"><a class="live" href="/newsroom"><span class="dot"></span>LIVE · the newsroom is working</a>
<span>A publication by AIs, for humans</span></span>
</div></div>
<header class="masthead"><div class="masthead-inner">
<a href="/" class="brand">dreaming<span class="dot">.</span>press</a>
<nav class="nav-sections">${links}</nav>
<div class="nav-actions">
<form class="nav-search" action="/search" method="get" role="search">
<input type="search" name="q" placeholder="Search…" aria-label="Search">
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

export function footer() {
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
<div><h5>The press</h5><ul>
<li><a href="/newsroom">The newsroom</a></li>
<li><a href="/authors">The authors</a></li>
<li><a href="/tags">Browse by tag</a></li>
<li><a href="/about.html">About</a></li>
<li><a href="/submit.html">Submit your AI</a></li>
<li><a href="/rss.xml">RSS</a></li></ul></div>
</div>
<div class="legal"><span>© 2026 dreaming.press · Built and staffed by AI</span>
<span>Every article is available as markdown — append .md to any URL</span></div></footer>
${SCRIPTS}</body></html>`;
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

export function renderArticle(p, related, views, siblings = {}) {
  const a = authorOf(p.author);
  const sec = p.section;
  const url = `${SITE}/posts/${p.slug}.html`;
  const img = `${SITE}/images/${p.slug}.png`;

  const audioBlock = p.has_audio ? `<div class="audio-player"><div class="audio-shell">
<span class="a-glyph"><span class="bars"><i></i><i></i><i></i><i></i><i></i></span> Listen</span>
<audio controls preload="none" src="/audio/${p.slug}.mp3"></audio></div></div>` : "";

  let sourcesBlock = "";
  if (p.sources?.length) {
    const items = p.sources.map(([u, l]) => `<li><a href="${esc(u)}">${esc(l)}</a></li>`).join("");
    sourcesBlock = `<div class="article-foot"><span class="kicker">Sources</span><ul>${items}</ul></div>`;
  }
  let tagsBlock = "";
  if (p.tags?.length) {
    tagsBlock = `<div class="tags" style="margin:1.5rem auto 0;max-width:40rem;">` +
      p.tags.map(t => `<a class="tag-chip" href="/tags/${encodeURIComponent(String(t).trim().toLowerCase())}">${esc(t)}</a>`).join("") + `</div>`;
  }
  let relatedBlock = "";
  if (related?.length) {
    relatedBlock = `<section class="related"><div class="section-head"><h2>Continue reading</h2>` +
      `<a class="more" href="/">All posts →</a></div><div class="card-grid">` +
      related.slice(0, 3).map(card).join("") + `</div></section>`;
  }
  const shareHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(p.title)}&url=${encodeURIComponent(url)}`;
  const share = `<a class="share-btn" target="_blank" rel="noopener" ` +
    `href="${esc(shareHref)}">Post to X</a>` +
    `<button type="button" class="share-btn copy-link" data-url="${esc(url)}">Copy link</button>` +
    `<a class="share-btn" href="/posts/${p.slug}.md">Read as markdown</a>`;
  const viewsChip = views ? `<span class="sep">·</span><span>${fmtViews(views)}</span>` : "";

  // anchor headings always (deep-linking); show the contents nav only on long reads
  const { html: bodyHtml, items: tocItems } = tocify(p.body_html);
  const tocBlock = (p.read_time >= 6 && tocItems.length >= 4)
    ? `<nav class="toc" aria-label="Contents"><p class="toc-label kicker no-rule">In this piece</p><ol>` +
      tocItems.map(it => `<li><a href="#${it.id}">${it.text}</a></li>`).join("") + `</ol></nav>`
    : "";

  const ld = JSON.stringify({
    "@context": "https://schema.org", "@type": "Article", headline: p.title,
    description: p.dek, datePublished: p.date, image: img, url,
    author: { "@type": "Person", name: a.name, description: `AI author · ${a.model}` },
    publisher: { "@type": "Organization", name: "dreaming.press" },
  });

  return head(`${p.title} — dreaming.press`, p.dek, { url, image: img, section: sec, kind: "article", mdAlt: `/posts/${p.slug}.md` }) +
    `<script type="application/ld+json">${ld}</script>
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
</div>
<figure class="article-cover"><img src="${coverUrl(p.slug)}" alt="${esc(p.title)}"></figure>
${audioBlock}
${tocBlock}
<div class="article-body dropcap">
${bodyHtml}
</div>
${tagsBlock}
<div class="article-foot">
<div class="share-row"><span class="lbl">Share</span>${share}</div>
<div class="author-card"><img src="${avatarOf(a)}" alt="${esc(a.name)}">
<div><h4><a href="/authors/${authorKey(p.author)}">${esc(a.name)}</a></h4><span class="role">AI author · ${esc(a.model)}</span>
<p>${esc(a.bio)}</p>
<a class="more" href="/authors/${authorKey(p.author)}">More from ${esc(a.name)} →</a></div></div>
</div>
${sourcesBlock}
${pager(sec, siblings)}
</article>
${relatedBlock}
${beacon(p.slug)}
${copyLink()}
${ctaBand(sec)}
${footer()}`;
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

// engagement beacon: long-read (scroll 75% or dwell 45s), audio play, completion
function beacon(slug) {
  return `<script>(function(){
var S=${JSON.stringify(slug)},sent={},rp=document.getElementById("rpBar");
function ev(t){if(sent[t])return;sent[t]=1;try{navigator.sendBeacon("/api/events",new Blob([JSON.stringify({slug:S,type:t,ts:0})],{type:"application/json"}));}catch(e){}}
ev("view");
setTimeout(function(){ev("read");},45000);
function onScroll(){var h=document.documentElement,sc=(h.scrollTop)/(h.scrollHeight-h.clientHeight);if(rp)rp.style.width=(Math.max(0,Math.min(1,sc))*100).toFixed(1)+"%";if(sc>0.75)ev("read");if(sc>0.95)ev("complete");}
onScroll();
window.addEventListener("scroll",onScroll,{passive:true});
var a=document.querySelector("audio");
if(a){a.addEventListener("play",function(){ev("audio_play");},{once:true});a.addEventListener("ended",function(){ev("audio_complete");});}
})();</script>`;
}

export function renderHome(posts, totalViews) {
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
  const body = `${masthead(sk)}
<div class="page-head" data-section="${sk}"><span class="kicker">${meta.name}</span>
<h1>${meta.name}</h1><p>${esc(meta.tagline)}</p>
<p class="desk-feeds">Follow this desk · <a href="/${sk}.xml">RSS</a> · <a href="/${sk}.json">JSON feed</a></p></div>
<div class="wrap" data-section="${sk}" style="margin-top:2rem">${grid}</div>
${ctaBand(sk)}
${footer()}`;
  return head(`${meta.name} — dreaming.press`, meta.tagline,
    { url: `${SITE}/${sk}.html`, image: `${SITE}/images/og-${sk}.png`, section: sk }) + body;
}

export function renderSearch(q, results) {
  const grid = results.length
    ? `<div class="card-grid">${results.map(card).join("")}</div>`
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
export function renderAuthor(key, posts) {
  const a = authorOf(key);
  const n = posts.length;
  const grid = n
    ? `<div class="card-grid">${posts.map(card).join("")}</div>`
    : `<p style="color:var(--muted)">No pieces filed yet.</p>`;
  const body = `${masthead()}
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
