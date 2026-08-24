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

// AI-crawler panel: proof the GEO work is landing — but HONEST. Every AI/search
// figure is IP-VERIFIED against the vendor's own published crawler ranges
// (crawler-stats.js), so spoofed "GPTBot" from a random host doesn't count.
// Bots whose owners publish no IP list (Anthropic, ByteDance) are shown
// separately as unverified claims, never mixed into the headline number.
function crawlerPanel(c) {
  if (!c || !c.bots || !c.bots.length) return "";
  const win = c.windowStart && c.windowEnd ? `${c.windowStart} → ${c.windowEnd}` : "recent logs";
  const stat = (n, l, sub = "", extra = "") => `<div class="nr-stat"><div class="nr-n">${num(n)}</div><div class="nr-l">${l}</div>${sub ? `<div style="font-size:.72rem;color:var(--muted)">${sub}</div>` : ""}${extra}</div>`;
  const link = (b) => `<a href="${esc(b.home)}" rel="nofollow noopener" target="_blank">${esc(b.label || b.name)}</a> <small style="color:var(--muted)">· last ${esc(b.lastSeen || "?")}</small>`;
  // verified = has a vendor IP list, and at least one hit checked out
  const verifiedAi = c.bots.filter(b => b.category === "ai" && b.verifiable && b.verifiedHits > 0);
  const verifiedSearch = c.bots.filter(b => b.category === "search" && b.verifiable && b.verifiedHits > 0);
  const unverifiable = c.bots.filter(b => !b.verifiable && b.hits > 0);
  const totalVerified = c.verifiedAiHits ?? verifiedAi.reduce((s, b) => s + b.verifiedHits, 0);
  return `<div class="wrap"><div class="section-head"><h2>🤖 AI engines are reading us</h2><small style="color:var(--muted)">IP-verified · ${esc(win)}</small></div>
<p style="max-width:46rem;color:var(--muted)">The point of all this: the biggest answer engines crawl dreaming.press directly. Every number here is <strong>verified against each vendor's own published crawler IP ranges</strong> — a fake "GPTBot" from some random server doesn't count. Bot traffic is logged <em>separately</em> from the human engaged-reads above (which exclude bots).</p>
<div class="nr-stats">${stat(totalVerified, "verified AI-engine crawls", win)}${stat(verifiedAi.length, "confirmed AI engines")}${verifiedAi[0] ? stat(verifiedAi[0].verifiedHits, `top: ${esc(verifiedAi[0].label)}`) : ""}</div>
<div class="nr-perf-grid" style="margin-top:1rem">
${barTable(verifiedAi, "AI / answer engines (IP-verified ✓)", { label: link, value: r => r.verifiedHits })}
${barTable(verifiedSearch, "Search engines (IP-verified ✓)", { label: link, value: r => r.verifiedHits })}
</div>
${unverifiable.length ? `<div class="nr-perf" style="margin-top:1rem"><h4>Self-reported — not IP-verifiable</h4>
<p style="color:var(--muted);font-size:.82rem;margin:-.2rem 0 .6rem">These crawlers' owners publish no IP list, so we can't confirm they're genuine. Shown for transparency, <em>excluded</em> from the verified count above.</p>
${unverifiable.map(b => `<div class="nr-bar" style="display:grid;grid-template-columns:1fr auto;gap:.5rem;align-items:center"><span>${link(b)}</span><b style="color:var(--muted)">${num(b.hits)} <small>claimed</small></b></div>`).join("")}</div>` : ""}
<p style="color:var(--muted);font-size:.85rem;max-width:46rem;margin-top:.5rem">Method: each hit's source IP checked against OpenAI, Google, Bing &amp; Perplexity's official published ranges. Machine-readable at <a href="/api/crawlers.json">/api/crawlers.json</a>.</p></div>`;
}

// The range picker. Plain links, no client JS — the whole dashboard is
// server-rendered and adding a script just to change a query string would be the
// only JS on the page.
function rangePicker(active) {
  const opts = [["7d", "7 days"], ["30d", "30 days"], ["ytd", "Year to date"], ["all", "All time"]];
  return `<div class="wrap"><div class="dash-ranges" role="group" aria-label="Date range">` +
    opts.map(([k, l]) => {
      const on = k === active;
      return `<a href="/dashboard?range=${k}" class="dash-range${on ? " is-on" : ""}"${on ? ' aria-current="true"' : ""}>${l}</a>`;
    }).join("") + `</div></div>`;
}

// Percent change vs the previous equal-length window. Returns null when the
// previous period had nothing to compare against: "+100%" off a base of zero is
// arithmetic, not information, and on a young site it would appear everywhere.
function delta(now, prev) {
  if (!prev || prev <= 0) return null;
  return Math.round(((now - prev) / prev) * 100);
}
function deltaBadge(now, prev) {
  const d = delta(now, prev);
  if (d === null) return "";
  const up = d >= 0;
  const col = up ? "var(--sec-stack,#1f9d57)" : "#c0392b";
  return `<div style="font-size:.72rem;color:${col}">${up ? "▲" : "▼"} ${Math.abs(d)}% vs previous</div>`;
}

export function renderDashboard(data) {
  const { funnel: f, prevFunnel: pf = null, series, channels, referrers, content, devices = [], assistants = [], crawlers = null, realtime = null, days = 30, totalPosts = 0,
    rangeLabel = `Last ${days} days`, range = "", sections = [], pages = [], nav = [], quality = [], audience = null } = data;
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

  // Quality-of-traffic table. This is the panel that changes decisions: direct
  // traffic dwarfs everything by volume while converting far worse than organic,
  // and a raw channel bar chart hides that completely.
  const qualityTable = quality && quality.length ? `<div class="wrap">
<div class="section-head"><h2>Traffic quality by channel</h2><small style="color:var(--muted)">volume is not the same as attention</small></div>
<div style="overflow-x:auto"><table class="cy-table">
<thead><tr><th>Channel</th><th>Views</th><th>Reads</th><th>Read rate</th><th>Pages/session</th><th>Median dwell</th></tr></thead>
<tbody>${quality.map(q => `<tr><td><b>${esc(q.channel)}</b></td><td>${num(q.views)}</td><td>${num(q.reads)}</td>
<td><b>${Math.round((q.read_rate || 0) * 100)}%</b></td>
<td>${q.pages_per_session ? q.pages_per_session.toFixed(2) : "—"}</td>
<td>${q.median_dwell_sec != null ? q.median_dwell_sec + "s" : "—"}</td></tr>`).join("")}</tbody></table></div>
<p style="color:var(--muted);font-size:.85rem;max-width:48rem;margin-top:.6rem">
<strong>Read rate</strong> is the share of views that became an engaged read (scrolled and dwelled).
A channel with many views and a low read rate is sending people who bounce.</p></div>` : "";

  // Per-desk performance, including how many pieces earned it. A desk with a big
  // corpus and few reads is the thing worth seeing.
  const sectionTable = sections && sections.length ? `<div class="wrap">
<div class="section-head"><h2>By desk</h2><small style="color:var(--muted)">which sections earn attention</small></div>
<div style="overflow-x:auto"><table class="cy-table">
<thead><tr><th>Desk</th><th>Pieces read</th><th>Views</th><th>Reads</th><th>Read rate</th></tr></thead>
<tbody>${sections.map(x => `<tr><td><b>${esc(x.section)}</b></td><td>${num(x.pieces)}</td><td>${num(x.views)}</td>
<td>${num(x.reads)}</td><td>${pct(x.reads, x.views)}%</td></tr>`).join("")}</tbody></table></div></div>` : "";

  const audienceBlock = audience ? `<div class="wrap"><div class="section-head"><h2>Audience</h2>
<small style="color:var(--muted)">people and agents subscribed</small></div><div class="nr-stats">
${stat(audience.confirmed, "confirmed subscribers", `${num(audience.subscribers)} total signed up`)}
${stat(audience.agents, "agent subscriptions", "webhooks receiving new posts")}
</div></div>` : "";

  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule" style="color:var(--sec-stack)">Analytics · Live · First-party</span>
<h1>The dreaming.press dashboard</h1>
<p>Cookie-free, no third-party trackers, no bot inflation — and it leads with <strong>engaged reads</strong>, not raw pageviews. <strong>${esc(rangeLabel)}</strong>.</p></div>
${rangePicker(range)}
<div class="wrap"><div class="nr-stats">
${stat(f.reads, "engaged reads", `${readRate}% of views`, pf ? deltaBadge(f.reads, pf.reads) : "")}
${stat(f.views, "views", "", pf ? deltaBadge(f.views, pf.views) : "")}
${stat(f.sessions, "sessions", "", pf ? deltaBadge(f.sessions, pf.sessions) : "")}
${stat(f.plays, "audio plays", "", pf ? deltaBadge(f.plays, pf.plays) : "")}
${stat(totalPosts, "pieces published")}
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
${pages.length ? barTable(pages, "Top non-article pages", { label: r => `<a href="/${esc(r.path)}">/${esc(r.path)}</a>`, value: r => r.views }) : ""}
${nav.length ? barTable(nav, "Most-used navigation", { label: r => esc(r.surface), value: r => r.clicks }) : ""}
</div></div>
${qualityTable}
${sectionTable}
${audienceBlock}
<div class="wrap"><p style="color:var(--muted);font-size:.85rem;max-width:46rem">
Why this beats GA for us: <strong>honest counting</strong> (bots filtered, engaged reads are real browsers that scrolled/dwelled), <strong>privacy by default</strong> (no cookies, no cross-site identifiers, GDPR-friendly), <strong>first-party & open</strong> (the same data is at <a href="/api/analytics">/api/analytics</a>), and it's <strong>built for a publication</strong> — content, channels, and the read funnel front and center.</p></div>
${ctaBand("stack")}${footer()}`;
  return head("Analytics Dashboard — dreaming.press",
    "A first-party, cookie-free analytics dashboard for dreaming.press: engaged reads, acquisition channels, referrers, top content, and the engagement funnel.",
    { url: `${SITE}/dashboard`, image: `${SITE}/images/og-stack.png`, section: "stack" }) + body;
}

// ── /crawlers — the crawl-to-click ledger ────────────────────────────────────
// Published as its own permanent URL rather than buried in /dashboard because it
// is the one statistic this site can compute and almost nobody else can:
// Cloudflare owns the crawl side, publishers own the visit side, and a site with
// its own logs AND its own first-party analytics has both. It is also the most
// unflattering number here, which is rather the point of a masthead that claims
// "every number public" — a transparency page that only publishes wins is an ad.
export function renderCrawlers(yieldData, crawlers) {
  const y = yieldData || null;
  const t = (y && y.totals) || null;
  const asOf = y ? `${y.generated.slice(0, 16).replace("T", " ")}Z` : "unknown";
  const num = (n) => (n == null ? "—" : Number(n).toLocaleString("en-US"));

  const ledger = y && y.engines && y.engines.length ? `
<div class="wrap"><div class="section-head"><h2>The ledger, per engine</h2>
<small style="color:var(--muted)">IP-verified fetches · last ${esc(String(y.window_days))} days</small></div>
<div style="overflow-x:auto"><table class="cy-table">
<thead><tr><th>Engine</th><th>Verified fetches</th><th>Retrieval</th><th>Index</th><th>Sessions sent</th><th>Fetches per session</th></tr></thead>
<tbody>${y.engines.map(e => `<tr><td><b>${esc(e.engine)}</b></td><td>${num(e.verified_fetches)}</td>
<td>${num(e.retrieval_fetches)}</td><td>${num(e.index_fetches)}</td><td>${num(e.referred_sessions)}</td>
<td>${e.fetches_per_session ? `<b>${num(e.fetches_per_session)}:1</b>` : "—"}</td></tr>`).join("")}</tbody>
</table></div>
<p style="color:var(--muted);font-size:.86rem;max-width:48rem;margin-top:.8rem">
<strong>Retrieval</strong> fetches happen because a person asked a question just then, so they can convert to a visit.
<strong>Index</strong> fetches build a training or search corpus and were never going to send anyone — they are counted
separately so the headline ratio is not flattered by traffic that could not convert.</p></div>` : "";

  const headline = t ? `<div class="wrap"><div class="nr-stats">
<div class="nr-stat"><div class="nr-n">${num(t.verified_fetches)}</div><div class="nr-l">verified crawler fetches</div></div>
<div class="nr-stat"><div class="nr-n">${num(t.referred_sessions)}</div><div class="nr-l">human sessions sent back</div></div>
<div class="nr-stat"><div class="nr-n">${t.retrieval_fetches_per_session ? num(t.retrieval_fetches_per_session) + ":1" : "—"}</div><div class="nr-l">retrieval fetches per session</div></div>
</div></div>` : `<div class="wrap"><p style="color:var(--muted)">No crawl-yield data yet — <code>scripts/crawl-yield.js</code> has not run.</p></div>`;

  // schema.org/Dataset: this page is a data product, and answer engines that
  // ingest it should be able to tell that it is one.
  const ld = JSON.stringify({
    "@context": "https://schema.org", "@type": "Dataset",
    name: "dreaming.press crawler yield — AI answer-engine crawl vs referral",
    description: "IP-verified AI crawler fetches joined against first-party referred sessions, per engine.",
    url: `${SITE}/crawlers`, license: "https://creativecommons.org/licenses/by/4.0/",
    creator: { "@type": "Organization", name: "dreaming.press", url: SITE },
    dateModified: y ? y.generated : new Date().toISOString(),
    distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}/api/crawl-yield.json` }],
  });

  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule" style="color:var(--sec-stack)">Open data · First-party · IP-verified</span>
<h1>What the answer engines take, and what they send back</h1>
<p>Every major AI answer engine crawls this site. This page is the other half of that sentence:
how many humans each one actually sends here. Data as of ${esc(asOf)}.</p></div>
${headline}
${ledger}
${crawlerPanel(crawlers)}
<div class="wrap"><p style="color:var(--muted);font-size:.85rem;max-width:48rem">
Method: crawler hits are matched against each vendor's published IP ranges, so a spoofed user-agent does not count.
Referred sessions come from a cookie-free first-party beacon that excludes known bots. Machine-readable:
<a href="/api/crawl-yield.json">/api/crawl-yield.json</a> · <a href="/api/crawlers.json">/api/crawlers.json</a>.</p></div>
${ctaBand()}`;
  return head(
    "Crawler yield — what AI engines take and send back · dreaming.press",
    "IP-verified AI crawler fetches joined against real referred sessions, per engine. Open data.",
    { url: `${SITE}/crawlers` }) + `<script type="application/ld+json">${ld}</script>` + body + footer();
}

// ── /data/agent-tools — the live dataset page ────────────────────────────────
// A page whose numbers change daily is a page an answer engine must re-fetch;
// an opinion piece is one it caches once. This is the site's only genuinely
// continuous, verifiable time series, and it was being collected and discarded.
export function renderDataset(ds) {
  const num = (n) => (n == null ? "—" : Number(n).toLocaleString("en-US"));
  const sign = (n) => (n > 0 ? `+${num(n)}` : num(n));
  const cov = ds.coverage || {};
  const t = ds.totals || {};
  const log = ds.changelog || { changes: [] };

  const movers = (ds.tools || []).slice(0, 25);
  const fallers = (ds.tools || []).filter(x => x.gain < 0).slice(-10).reverse();

  const table = (rows, caption) => rows.length ? `
<div class="section-head"><h2>${esc(caption)}</h2></div>
<div style="overflow-x:auto"><table class="cy-table">
<thead><tr><th>Tool</th><th>Stars</th><th>Change (${esc(String(ds.window_days))}d)</th><th>%</th><th>Category</th></tr></thead>
<tbody>${rows.map(r => `<tr><td><a href="${esc(r.url)}"><b>${esc(r.name)}</b></a></td>
<td>${num(r.stars)}</td><td>${sign(r.gain)}</td><td>${r.pct > 0 ? "+" : ""}${esc(String(r.pct))}%</td>
<td>${esc(r.category)}</td></tr>`).join("")}</tbody></table></div>` : "";

  const changelog = log.changes.length ? `
<div class="section-head"><h2>What changed in the last 24 hours</h2>
<small style="color:var(--muted)">${esc(log.from || "?")} → ${esc(log.to || "?")}</small></div>
<div style="overflow-x:auto"><table class="cy-table">
<thead><tr><th>Tool</th><th>Was</th><th>Now</th><th>Δ</th></tr></thead>
<tbody>${log.changes.map(c => `<tr><td><a href="${esc(c.url)}"><b>${esc(c.name)}</b></a></td>
<td>${num(c.from)}</td><td>${num(c.to)}</td><td>${sign(c.delta)}</td></tr>`).join("")}</tbody></table></div>`
    : `<div class="wrap"><p style="color:var(--muted)">No change recorded between the last two observation days.</p></div>`;

  const ld = JSON.stringify({
    "@context": "https://schema.org", "@type": "Dataset",
    name: ds.name, description: ds.description, url: ds.url,
    license: ds.license, creator: { "@type": "Organization", name: "dreaming.press", url: SITE },
    dateModified: ds.generated,
    temporalCoverage: cov.first_observation && cov.last_observation ? `${cov.first_observation}/${cov.last_observation}` : undefined,
    variableMeasured: "GitHub stars per agent-tooling repository, observed daily",
    distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}/data/agent-tools.json` }],
  });

  const body = `${masthead()}
<div class="page-head"><span class="kicker no-rule" style="color:var(--sec-stack)">Open data · Updated daily · ${esc(String(cov.observation_days || 0))} days observed</span>
<h1>Agent tool momentum</h1>
<p>${esc(ds.description)} Data as of ${esc(String(ds.generated || "").slice(0, 16).replace("T", " "))}Z.</p></div>
<div class="wrap"><div class="nr-stats">
<div class="nr-stat"><div class="nr-n">${num(cov.tools_with_star_series)}</div><div class="nr-l">repos with a star series</div></div>
<div class="nr-stat"><div class="nr-n">${num(cov.observations)}</div><div class="nr-l">daily observations</div></div>
<div class="nr-stat"><div class="nr-n">${num(t.gaining)}</div><div class="nr-l">gaining</div></div>
<div class="nr-stat"><div class="nr-n">${num(t.declining)}</div><div class="nr-l">declining</div></div>
</div>
${cov.window_fully_covered === false ? `<p style="color:var(--muted);font-size:.88rem">⚠ The series is ${esc(String(cov.observation_days))} days deep, shorter than the ${esc(String(ds.window_days))}-day window shown — changes are measured from the earliest observation available, not a full window.</p>` : ""}
</div>
<div class="wrap">${changelog}</div>
<div class="wrap">${table(movers, `Biggest gainers (${ds.window_days} days)`)}</div>
${fallers.length ? `<div class="wrap">${table(fallers, "Losing ground")}</div>` : ""}
<div class="wrap"><p style="color:var(--muted);font-size:.85rem;max-width:48rem">
${esc(ds.method)} Machine-readable: <a href="/data/agent-tools.json">/data/agent-tools.json</a>.
${esc(ds.attribution)}</p></div>
${ctaBand()}`;
  return head(
    "Agent tool momentum — daily open dataset · dreaming.press",
    "Daily GitHub star time series across the agent-tooling directory, gainers and decliners. Open data, updated every day.",
    { url: `${SITE}/data/agent-tools` }) + `<script type="application/ld+json">${ld}</script>` + body + footer();
}
