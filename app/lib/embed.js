// embed.js — an embeddable live-stats badge (enhancement #19). Radical transparency
// as a distribution channel: any blog/README can drop in a self-contained SVG that
// shows dreaming.press's live numbers, and every embed is a backlink — the off-site
// corroboration signal AI engines + Google weight most. Served as an <img>-able SVG
// (no JS, no iframe, works in GitHub READMEs), plus a human /embed page with copy code.
import { SITE, esc } from "./data.js";

// crude but stable monospace width so the two-segment shields-style badge lays out
// without a font metrics engine (each char ~7px at this size).
const w = (s) => Math.max(10, s.length * 7 + 12);

export function statsBadgeSvg({ label = "dreaming.press", value = "" } = {}) {
  const lw = w(label), vw = w(value), W = lw + vw, H = 20;
  const t = (x, s) => `<text x="${x}" y="14" fill="#fff" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11">${esc(s)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" role="img" aria-label="${esc(label)}: ${esc(value)}">
<rect width="${lw}" height="${H}" fill="#141311"/>
<rect x="${lw}" width="${vw}" height="${H}" fill="#1f9d57"/>
${t(6, label)}${t(lw + 6, value)}
</svg>`;
}

// the live badge value from real site stats
export function liveBadge(stats = {}, totalPosts = 0) {
  const parts = [];
  if (totalPosts) parts.push(`${totalPosts.toLocaleString("en-US")} articles`);
  if (stats.readersNow >= 1) parts.push(`${stats.readersNow} reading now`);
  return statsBadgeSvg({ label: "dreaming.press", value: parts.join(" · ") || "live" });
}

export function renderEmbed(head, masthead, footer, badgeSvg) {
  const imgUrl = `${SITE}/embed/stats.svg`;
  const codeHtml = `<a href="${SITE}" target="_blank"><img src="${imgUrl}" alt="dreaming.press live stats"></a>`;
  const codeMd = `[![dreaming.press](${imgUrl})](${SITE})`;
  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule" style="color:var(--sec-wire)">Embed</span>
<h1>Embed our live stats</h1>
<p>Put dreaming.press's live numbers on your site or README. It updates itself, and it links back here — free.</p></div>
<div class="wrap" style="max-width:46rem">
<p style="margin:1.5rem 0">Preview: ${badgeSvg}</p>
<h2>HTML</h2>
<div class="code-card"><pre><button class="copy" type="button">Copy</button><code>${esc(codeHtml)}</code></pre></div>
<h2>Markdown (GitHub READMEs)</h2>
<div class="code-card"><pre><button class="copy" type="button">Copy</button><code>${esc(codeMd)}</code></pre></div>
<p style="color:var(--muted);font-size:.85rem;margin-top:1.5rem">The badge is a self-contained SVG served from <a href="${imgUrl}">/embed/stats.svg</a> — no script, no tracking.</p>
<script>(function(){document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".code-card .copy");if(!b)return;var c=b.parentNode.querySelector("code");if(!c)return;var txt=c.textContent;function ok(){var o=b.textContent;b.textContent="Copied";setTimeout(function(){b.textContent=o;},1200);}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(ok,ok);}});})();</script>
</div>
${footer()}`;
  return head("Embed dreaming.press live stats", "A self-contained SVG badge of dreaming.press's live stats you can embed on any site or README — it updates itself and links back. Free.", { url: `${SITE}/embed`, image: `${SITE}/images/og-wire.png` }) + body;
}

// Embeddable "my AI agent stack" card (Stack Explorer growth loop). A founder or
// agent picks a stack at /build, then drops this self-contained SVG on their blog
// or README — every embed shows their stack AND links back to dreaming.press, the
// off-site corroboration answer engines weight most. No JS, no iframe, no fonts.
export function stackCardSvg(items = [], { title = "My AI agent stack" } = {}) {
  const rows = items.slice(0, 8);
  const W = 340, padX = 16, headH = 40, rowH = 26, footH = 30;
  const H = headH + rows.length * rowH + footH;
  const truncate = (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
  const t = (x, y, s, cls) => `<text x="${x}" y="${y}" class="${cls}">${esc(s)}</text>`;
  const rowSvg = rows.map((it, i) => {
    const y = headH + i * rowH + 17;
    return `<circle cx="${padX + 3}" cy="${y - 4}" r="2.5" fill="#1f9d57"/>` +
      t(padX + 13, y, truncate(it.tool.name, 22), "tool") +
      `<text x="${W - padX}" y="${y}" class="job" text-anchor="end">${esc(truncate(it.job.label, 18))}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}: ${esc(rows.map(r => r.tool.name).join(", "))}">
<style>
.bg{fill:#f6f5f0;stroke:#dedcd2}
.title{fill:#1a1916;font:600 13px Verdana,'DejaVu Sans',sans-serif}
.mark{fill:#6b6862;font:600 10px Verdana,'DejaVu Sans',sans-serif}
.tool{fill:#1a1916;font:600 12.5px Verdana,'DejaVu Sans',sans-serif}
.job{fill:#8a877f;font:9px 'Courier New',monospace}
.foot{fill:#1f9d57;font:600 10px Verdana,'DejaVu Sans',sans-serif}
</style>
<rect class="bg" x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="8"/>
${t(padX, 25, "🧩 " + title, "title")}${t(W - padX, 25, "dreaming.press", "mark")}<text x="${W - padX}" y="25" text-anchor="end" class="mark"></text>
<line x1="${padX}" y1="${headH - 6}" x2="${W - padX}" y2="${headH - 6}" stroke="#e6e4db"/>
${rowSvg}
<line x1="${padX}" y1="${H - footH + 4}" x2="${W - padX}" y2="${H - footH + 4}" stroke="#e6e4db"/>
${t(padX, H - 10, "▸ Build yours free at dreaming.press/build", "foot")}
</svg>`;
}
