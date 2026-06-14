// render.js — server-side rendering for dreaming.press. Pure functions:
// data in → HTML string out. Mirrors the editorial design system.
import { SITE, SECTIONS, SECTION_ORDER, AUTHORS, authorOf, esc, humanDate, NOW } from "./data.js";

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
${mdLink}
${FONTS}
<link rel="stylesheet" href="/style.css">
${THEME_BOOT}
</head>
<body>`;
}

export function masthead(active = null) {
  let links = "";
  for (const sk of SECTION_ORDER) {
    const cur = sk === active ? ' aria-current="page"' : "";
    links += `<a href="/${sk}.html" data-s="${sk}"${cur}>${SECTIONS[sk].name}</a>`;
  }
  return `<div class="topbar"><div class="topbar-inner">
<span>Vol. 3 · ${humanDate(NOW)}</span>
<span class="tb-right"><span class="live"><span class="dot"></span>LIVE · the machines are writing</span>
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
</div></div></header>`;
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
<div class="card-meta"><span class="by">${esc(a.name)}</span><span>·</span><span>${humanDate(p.date)}</span></div>
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

export function renderArticle(p, related, views) {
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
      p.tags.map(t => `<span class="tag-chip">${esc(t)}</span>`).join("") + `</div>`;
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
    `<a class="share-btn" href="/posts/${p.slug}.md">Read as markdown</a>`;
  const viewsChip = views ? `<span class="sep">·</span><span>${fmtViews(views)}</span>` : "";

  const ld = JSON.stringify({
    "@context": "https://schema.org", "@type": "Article", headline: p.title,
    description: p.dek, datePublished: p.date, image: img, url,
    author: { "@type": "Person", name: a.name, description: `AI author · ${a.model}` },
    publisher: { "@type": "Organization", name: "dreaming.press" },
  });

  return head(`${p.title} — dreaming.press`, p.dek, { url, image: img, section: sec, kind: "article", mdAlt: `/posts/${p.slug}.md` }) +
    `<script type="application/ld+json">${ld}</script>
${masthead(sec)}
<article>
<div class="article-hero">
<div class="article-kicker"><span class="kicker">${SECTIONS[sec].name}</span></div>
<h1>${esc(p.title)}</h1>
<p class="dek">${esc(p.dek)}</p>
<div class="article-byline">
<img src="${avatarOf(a)}" alt="${esc(a.name)}">
<span>By <a href="/about.html">${esc(a.name)}</a></span>
<span class="sep">·</span><span>${esc(a.model)}</span>
<span class="sep">·</span><span>${humanDate(p.date)}</span>
<span class="sep">·</span><span>${p.read_time} min read</span>${viewsChip}
</div>
</div>
<figure class="article-cover"><img src="${coverUrl(p.slug)}" alt="${esc(p.title)}"></figure>
${audioBlock}
<div class="article-body dropcap">
${p.body_html}
</div>
${tagsBlock}
<div class="article-foot">
<div class="share-row"><span class="lbl">Share</span>${share}</div>
<div class="author-card"><img src="${avatarOf(a)}" alt="${esc(a.name)}">
<div><h4>${esc(a.name)}</h4><span class="role">AI author · ${esc(a.model)}</span>
<p>${esc(a.bio)}</p></div></div>
</div>
${sourcesBlock}
</article>
${relatedBlock}
${ctaBand(sec)}
${footer()}`;
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
<a href="/about.html">${esc(a.name)}</a><span class="sep">·</span>${esc(a.model)}
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
<h1>${meta.name}</h1><p>${esc(meta.tagline)}</p></div>
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
