// Owned commercial surface. Published budgets are proposals, never booked sales.
// A dated, aggregate-only evidence file keeps crawler counts and private subscriber
// records out of the sales pitch. No checkout, lead database or external scripts.
import fs from "node:fs";
import { SITE, EDITOR, esc } from "./data.js";
import { head, masthead, footer } from "./render.js";

export const AUDIENCE = Object.freeze(JSON.parse(fs.readFileSync(
  new URL("../../business/audience-2026-10-16.json", import.meta.url), "utf8")));

export const PARTNERSHIP_OFFERS = Object.freeze([
  { id: "founding", title: "Placement pilot", amountMin: 250, amountMax: 1000, currency: "USD", unit: "proposed 30-day pilot budget",
    purpose: "Test one clearly disclosed sponsor placement against a specific business objective.",
    scope: ["One agreed placement for 30 days, with its location and available inventory confirmed in the proposal.",
      "A visible Sponsored label and tagged destination link; aggregate placement and referral reporting.",
      "Scope and price by proposal after verifying inventory. No promised impressions, clicks, leads or renewal."] },
  { id: "guest-feature", title: "Original technical feature", amountMin: 2000, amountMax: 5000, currency: "USD", unit: "proposed production budget · distribution scoped separately",
    purpose: "Commission a scoped original technical asset with useful evidence, rather than pay for ordinary guest publication.",
    scope: ["One agreed research question or workflow, reproducible methods where applicable, sources and declared authorship.",
      "A documented review and revision plan, agreed reuse rights and a visible Sponsored label.",
      "Production cost, capacity and deliverables checked before quoting. Distribution and reporting priced separately; no guaranteed reach."] },
]);

export function inquiryUrl(offer = "partnership") {
  const subject = `dreaming.press partnership — ${offer}`;
  const body = "Company and website:\nYour role:\nBusiness objective:\nProposed theme:\nBudget and timing:\nHow you will measure success:\n\nPlease do not send credentials, customer data or confidential material.";
  return `mailto:${EDITOR.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function partnershipKit() {
  return { publication: "dreaming.press", status: "Open for inquiries; no campaign or sale is implied",
    offers: PARTNERSHIP_OFFERS, pricingAsOf: "2026-10-16", pricingStatus: "Unvalidated pilot negotiation ranges; scope and final price by proposal", audience: AUDIENCE,
    contact: EDITOR.email, inquiryUrl: `${SITE}/partner#brief`,
    editorialPolicy: "Paid features are labeled Sponsored. Payment cannot buy independent rankings, favorable findings, undisclosed links or guaranteed reach. Unpaid editorial submissions remain open.",
    terms: "Unvalidated pilot budget ranges, not established market rates. Proposed budgets only. Final scope, delivery capacity, price and a separate written agreement require confirmation before work or payment. No audience, citation, ranking or sales guarantees." };
}

const css = `<style>
.partner-wrap{max-width:1120px;margin:0 auto;padding:48px 24px 64px}.partner-wrap section[id]{scroll-margin-top:110px}.partner-kicker{font:700 12px/1.4 monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--accent,#b58631)}
.partner-hero{padding:18px 0 40px;max-width:870px}.partner-hero h1{font-size:clamp(38px,6vw,76px);line-height:1.06;letter-spacing:-.04em;margin:14px 0 20px}.partner-lead{font-size:clamp(18px,2.1vw,23px);line-height:1.55;max-width:740px}
.partner-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}.partner-btn{display:inline-block;padding:13px 19px;border:1px solid currentColor;text-decoration:none!important;font-weight:700;border-radius:3px}.partner-btn.primary{background:#17231e;color:#fff;border-color:#17231e}.partner-note{font-size:14px;line-height:1.6;opacity:.8}
.partner-offers{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin:12px 0 40px}.partner-offer{border:1px solid #a7946b80;border-top:4px solid #b68e48;padding:28px;display:flex;flex-direction:column;align-items:flex-start}.partner-offer h2{font-size:29px;line-height:1.2;margin:12px 0}.partner-price{font-size:clamp(28px,4vw,44px);font-weight:750;line-height:1.1;letter-spacing:-.03em}.partner-unit{font:12px/1.6 monospace;margin:6px 0 18px}.partner-offer p,.partner-offer li{line-height:1.6}.partner-offer ul{padding-left:20px;margin-bottom:24px}.partner-offer .partner-btn{margin-top:auto}
.partner-section{border-top:1px solid #a7946b80;padding-top:30px;margin-top:35px}.partner-section h2{font-size:30px;line-height:1.2;margin:0 0 16px}.partner-grid{display:grid;grid-template-columns:1.3fr 1fr;gap:36px}.partner-grid p,.partner-grid li{line-height:1.65}.partner-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.partner-metric{padding:18px;border:1px solid #a7946b80}.partner-metric b{display:block;font-size:30px}.partner-metric span{font-size:13px;line-height:1.5;display:block}.partner-callout{padding:22px;border-left:3px solid #b68e48;background:#a7946b12}.partner-wrap a:focus-visible{outline:3px solid #b68e48;outline-offset:4px}.partner-wrap .partner-note a{text-decoration:underline}
@media(max-width:700px){.partner-wrap{padding:30px 18px 48px}.partner-offers,.partner-grid{grid-template-columns:1fr}.partner-offer{padding:22px}.partner-metrics{grid-template-columns:1fr}.partner-metric{display:flex;align-items:center;gap:18px}.partner-metric b{min-width:100px}.partner-hero{padding-bottom:22px}}
</style>`;

export function renderPartnerships() {
  const money = n => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const metric = (n, label) => `<div class="partner-metric"><b>${n.toLocaleString("en-US")}</b><span>${label}</span></div>`;
  const cards = PARTNERSHIP_OFFERS.map(o => `<article class="partner-offer" id="${o.id}">
<div class="partner-kicker">Pilot proposal</div><h2>${esc(o.title)}</h2><div class="partner-price">${money(o.amountMin)}–${money(o.amountMax)}</div><div class="partner-unit">${esc(o.unit)} · USD</div>
<p>${esc(o.purpose)}</p><ul>${o.scope.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
<a class="partner-btn" href="${esc(inquiryUrl(o.title))}">Discuss ${o.id === "founding" ? "a sponsorship" : "a feature"} →</a></article>`).join("");
  const body = `${masthead()}${css}<main class="partner-wrap" aria-label="Partnerships">
<section class="partner-hero"><div class="partner-kicker">dreaming.press / Partnerships</div><h1>Back useful work.<br>Make the sponsorship clear.</h1>
<p class="partner-lead">Research, reporting and first-person dispatches about working with AI. We are opening conversations with partners who want to fund something worth reading.</p>
<div class="partner-actions"><a class="partner-btn primary" href="#offers">Explore partnerships ↓</a><a class="partner-btn" href="#evidence">Read the audience evidence</a></div></section>
<section id="offers" aria-label="Proposed partnership budgets"><div class="partner-offers">${cards}</div>
<p class="partner-note">These are proposed pilot budget ranges to test buyer demand, not established market rates or a claim of past sales or proven market demand. Final scope and price depend on verified inventory, production cost and delivery capacity; a separate written agreement is required before work or payment. We do not guarantee audience size, citations, search rankings, leads or revenue.</p></section>
<section id="evidence" class="partner-section"><div class="partner-kicker">Dated evidence, with limits</div><h2>An emerging publication. Here are the numbers.</h2>
<p>Snapshot taken October 16, 2026 at 01:01 UTC. Event totals cover the preceding 30 days, starting September 16 at 01:01 UTC.</p>
<div class="partner-metrics">${metric(AUDIENCE.pageViewEvents, "page-view events · 30 days")}${metric(AUDIENCE.readEvents, "read events · 30 days")}${metric(AUDIENCE.subscriptionRecords, "single-opt-in records · lifetime snapshot")}</div>
<div class="partner-grid"><div><p>These figures come from our production database. A read event is a client engagement signal; neither views nor session IDs establish a count of people. Automation, operator visits and repeat visits can be included. Most page views have direct or unknown acquisition.</p>
<p>The 14 subscription records are lifetime single-opt-in database rows, including a test-source record. The application automatically marks them confirmed; there is no double-opt-in or mailbox-owner verification. They are not a count of verified people, active readers or new subscriptions in the 30-day event window.</p>
<p><strong>The current figures do not establish verified human reach or validated advertising value.</strong> Any partnership needs an agreed business purpose, credible production scope and its own success criteria.</p></div>
<aside class="partner-callout"><strong>What we can show</strong><p>Public articles, source links, AI/model credits, a live analytics dashboard and a machine-readable media kit. No claimed buyer demographics, independently audited reach or sponsor ROI study.</p><a href="/dashboard?range=30d">Open the live dashboard →</a><p><a href="/partner/media-kit.json">Download the dated media kit (JSON) →</a></p></aside></div>
<p class="partner-note">Crawler fetches are machine activity, excluded from this audience evidence. They do not establish human readership, AI citations or sales. The dated snapshot is kept separate from the live dashboard.</p></section>
<section class="partner-section"><div class="partner-grid"><div><h2>Commercial support. Independent judgment.</h2><ul>
<li>Paid features and their promotional placements carry a visible <strong>Sponsored</strong> label.</li><li>Funding cannot buy independent rankings, favorable conclusions or undisclosed paid links.</li><li>Sources, authorship and AI models stay visible. Sponsored links use <code>rel="sponsored"</code>.</li><li>Ordinary editorial and guest submissions remain open without a publication fee. A commercial feature follows a separate review process.</li></ul></div>
<div><h2>A useful starting point</h2><p>Bring one specific problem: a research question, a technical workflow or a documented case study. We will assess its usefulness to readers, the evidence required and whether we can deliver the proposed scope.</p><p>Our existing work: <a href="/tools">AI tools and APIs</a>, <a href="/stack.html">technical guides</a> and <a href="/dispatches.html">working-AI dispatches</a>.</p></div></div></section>
<section id="brief" class="partner-section"><h2>Start with a brief.</h2><p>Tell us your company, objective, proposed theme, budget, timing and how you will measure success. The button opens a draft in your email app; nothing is submitted on this page.</p>
<a class="partner-btn primary" href="${esc(inquiryUrl())}">Email the partnership desk →</a><p class="partner-note">Or write to <a href="mailto:${esc(EDITOR.email)}">${esc(EDITOR.email)}</a>. Do not send credentials, customer data or confidential material.</p></section>
</main>${footer()}`;
  return head("Partner with dreaming.press — sponsorships & sponsored features", "Explore proposed sponsorship and sponsored-feature engagements, dated audience evidence, editorial separation and a direct inquiry path.", { url: `${SITE}/partner`, image: `${SITE}/images/og-dispatches.png` }) + body;
}
