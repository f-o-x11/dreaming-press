// dashboard.js — a first-party analytics dashboard for dreaming.press (/dashboard).
// Better than Google Analytics for THIS site: no cookies, no third-party JS, no
// bot inflation (server-side bot filter + client beacons), and it leads with the
// honest metric — engaged reads — plus a real acquisition-channel breakdown GA4
// makes you dig for. All charts are server-rendered inline SVG (zero client JS).
import { SITE, esc } from "./data.js";
import { head, masthead, footer, ctaBand } from "./render.js";

const num = (n) => (n || 0).toLocaleString("en-US");
const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;
const host = (u) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return String(u || "").slice(0, 40); } };

// inline SVG grouped bar chart for the daily trend (reads over views)
function trendChart(series) {
  if (!series.length) return `<p style="color:var(--muted)">No engagement events yet in this window.</p>`;
  const W = 720, H = 200, pad = 24;
  const max = Math.max(1, ...series.map(d => Math.max(d.views, d.reads)));
  const bw = (W - pad * 2) / series.length;
  const y = (v) => H - pad - (v / max) * (H - pad * 2);
  const bars = series.map((d, i) => {
    const x = pad + i * bw;
    return `<rect x="${(x + bw * 0.15).toFixed(1)}" y="${y(d.views).toFixed(1)}" width="${(bw * 0.32).toFixed(1)}" height="${(H - pad - y(d.views)).toFixed(1)}" fill="var(--muted)" opacity="0.45"><title>${d.day}: ${d.views} views</title></rect>` +
      `<rect x="${(x + bw * 0.5).toFixed(1)}" y="${y(d.reads).toFixed(1)}" width="${(bw * 0.32).toFixed(1)}" height="${(H - pad - y(d.reads)).toFixed(1)}" fill="var(--sec-stack,#1f9d57)"><title>${d.day}: ${d.reads} engaged reads</title></rect>`;
  }).join("");
  const lbl = series.length > 1 ? `<text x="${pad}" y="${H - 6}" font-size="11" fill="var(--muted)">${series[0].day}</text><text x="${W - pad}" y="${H - 6}" font-size="11" fill="var(--muted)" text-anchor="end">${series[series.length - 1].day}</text>` : "";
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Daily views and engaged reads">
    <text x="${pad}" y="16" font-size="11" fill="var(--muted)">peak ${max}/day</text>${bars}${lbl}</svg>
    <p style="font-size:.8rem;color:var(--muted)"><span style="color:var(--sec-stack,#1f9d57)">■</span> engaged reads · <span style="opacity:.5">■</span> raw views</p>`;
}

function barTable(rows, label, cols) {
  if (!rows.length) return `<div class="nr-perf"><h4>${label}</h4><p style="color:var(--muted)">No data yet.</p></div>`;
  const max = Math.max(1, ...rows.map(cols.value));
  return `<div class="nr-perf"><h4>${label}</h4>` + rows.map(r => {
    const v = cols.value(r);
    return `<div class="nr-bar" style="display:grid;grid-template-columns:1fr auto;gap:.5rem;align-items:center">
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${cols.label(r)}<span style="display:block;height:4px;border-radius:2px;background:var(--sec-stack,#1f9d57);width:${Math.round((v / max) * 100)}%;margin-top:3px;opacity:.5"></span></span>
      <b>${num(v)}</b></div>`;
  }).join("") + `</div>`;
}

// AI-crawler panel: proof the GEO work is landing. Sourced from nginx access
// logs (analytics/crawlers.json), so it's real bot traffic — deliberately shown
// separately from the human "engaged reads" above (which filter bots out).
function crawlerPanel(c) {
  if (!c || !c.bots || !c.bots.length) return "";
  const ai = c.bots.filter(b => b.category === "ai");
  const search = c.bots.filter(b => b.category === "search");
  const win = c.windowStart && c.windowEnd ? `${c.windowStart} → ${c.windowEnd}` : "recent logs";
  const stat = (n, l, sub = "") => `<div class="nr-stat"><div class="nr-n">${num(n)}</div><div class="nr-l">${l}</div>${sub ? `<div style="font-size:.72rem;color:var(--muted)">${sub}</div>` : ""}</div>`;
  const link = (b) => `<a href="${esc(b.home)}" rel="nofollow noopener" target="_blank">${esc(b.label || b.name)}</a> <small style="color:var(--muted)">· last ${esc(b.lastSeen || "?")}</small>`;
  return `<div class="wrap"><div class="section-head"><h2>🤖 AI engines are reading us</h2><small style="color:var(--muted)">from server logs · ${esc(win)}</small></div>
<p style="max-width:46rem;color:var(--muted)">This is the whole point: the biggest answer engines crawl dreaming.press directly. Below is real bot traffic from our web-server logs (counted <em>separately</em> from the human engaged-reads above, which filter bots out).</p>
<div class="nr-stats">${stat(c.aiHits, "AI-crawler fetches", win)}${stat(c.aiEngines, "distinct AI engines")}${stat(c.totalHits, "all crawler fetches")}</div>
<div class="nr-perf-grid" style="margin-top:1rem">
${barTable(ai, "AI / answer-engine crawlers", { label: link, value: r => r.hits })}
${barTable(search, "Traditional search crawlers", { label: link, value: r => r.hits })}
</div>
<p style="color:var(--muted);font-size:.85rem;max-width:46rem;margin-top:.5rem">Machine-readable at <a href="/api/crawlers.json">/api/crawlers.json</a>. Bot names are self-reported user-agents; UA-spoofing scanners are a small tail.</p></div>`;
}

export function renderDashboard(data) {
  const { funnel: f, series, channels, referrers, content, devices = [], assistants = [], crawlers = null, realtime = null, days = 30, totalPosts = 0 } = data;
  const stat = (n, l, sub = "") => `<div class="nr-stat"><div class="nr-n">${num(n)}</div><div class="nr-l">${l}</div>${sub ? `<div style="font-size:.72rem;color:var(--muted)">${sub}</div>` : ""}</div>`;
  const readRate = pct(f.reads, f.views);

  // Real-time (GA "Realtime"): active sessions + top pages in the last hour.
  const rtBlock = realtime ? `<div class="wrap"><div class="section-head"><h2><span style="color:#1f9d57">●</span> Live · last ${realtime.minutes} min</h2></div>
<div class="nr-stats">${stat(realtime.activeSessions, "active sessions")}${stat(realtime.views, "views")}${stat(realtime.reads, "reads")}</div>
${realtime.recent && realtime.recent.length ? `<div class="wire-list" style="margin-top:1rem">${realtime.recent.map(r => `<a class="wire-row" href="/posts/${esc(r.slug)}.html"><div><h3>${esc((r.title || r.slug).slice(0, 48))}</h3></div><time>${num(r.hits)} now</time></a>`).join("")}</div>` : `<p style="color:var(--muted)">No activity in the last hour.</p>`}</div>` : "";

  const funnelBlock = `<div class="nr-perf"><h4>Engagement funnel (${days}d)</h4>
    ${[["Views", f.views, 100], ["Engaged reads", f.reads, pct(f.reads, f.views)], ["Completed", f.completes, pct(f.completes, f.views)], ["Audio plays", f.plays, pct(f.plays, f.views)]]
      .map(([l, v, p]) => `<div class="nr-bar" style="display:grid;grid-template-columns:1fr auto;gap:.5rem;align-items:center">
        <span>${l}<span style="display:block;height:6px;border-radius:3px;background:var(--sec-stack,#1f9d57);width:${Math.max(2, p)}%;margin-top:3px"></span></span>
        <b>${num(v)} <small style="color:var(--muted)">${p}%</small></b></div>`).join("")}</div>`;

  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule" style="color:var(--sec-stack)">Analytics · Live · First-party</span>
<h1>The dreaming.press dashboard</h1>
<p>Cookie-free, no third-party trackers, no bot inflation — and it leads with <strong>engaged reads</strong>, not raw pageviews. Last ${days} days.</p></div>
<div class="wrap"><div class="nr-stats">
${stat(f.reads, "engaged reads", `${readRate}% of views`)}${stat(f.sessions, "sessions")}${stat(f.plays, "audio plays")}${stat(totalPosts, "pieces published")}
</div></div>
${rtBlock}
${crawlerPanel(crawlers)}
<div class="wrap"><div class="section-head"><h2>Engagement trend</h2><small style="color:var(--muted)">reads vs views · daily</small></div>
${trendChart(series)}</div>
<div class="wrap"><div class="nr-perf-grid">
${funnelBlock}
${barTable(channels, "By acquisition channel", { label: r => esc(r.channel), value: r => r.reads || r.views })}
${assistants.length ? barTable(assistants, "AI assistants (our front door)", { label: r => esc(r.assistant), value: r => r.reads || r.views }) : ""}
${barTable(devices, "By device", { label: r => esc(r.device), value: r => r.views })}
${barTable(referrers, "Top referrers", { label: r => esc(host(r.ref)), value: r => r.hits })}
${barTable(content.map(c => ({ ...c })), "Top content (by engaged reads)", { label: r => `<a href="/posts/${esc(r.slug)}.html">${esc((r.title || r.slug).slice(0, 42))}</a>`, value: r => r.reads || r.views })}
</div></div>
<div class="wrap"><p style="color:var(--muted);font-size:.85rem;max-width:46rem">
Why this beats GA for us: <strong>honest counting</strong> (bots filtered, engaged reads are real browsers that scrolled/dwelled), <strong>privacy by default</strong> (no cookies, no cross-site identifiers, GDPR-friendly), <strong>first-party & open</strong> (the same data is at <a href="/api/analytics">/api/analytics</a>), and it's <strong>built for a publication</strong> — content, channels, and the read funnel front and center.</p></div>
${ctaBand("stack")}${footer()}`;
  return head("Analytics Dashboard — dreaming.press",
    "A first-party, cookie-free analytics dashboard for dreaming.press: engaged reads, acquisition channels, referrers, top content, and the engagement funnel.",
    { url: `${SITE}/dashboard`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
}
