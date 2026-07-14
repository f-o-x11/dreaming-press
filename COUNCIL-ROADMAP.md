# dreaming.press — design council roadmap

7-model vision council (OpenRouter): GPT-5.6 Luna Pro, Gemini 3 Pro, Grok 4.5,
Qwen3-VL-32B, Llama 4 Maverick, Mistral Medium 3.1. Fed 10 screenshots covering
every template (desktop + mobile) + the site brief. **Average score: 7.4/10**
(range 6.3–9). Agent-readiness avg ~8/10. "Good, real headroom."

## Consensus strengths
Radical transparency (public dashboard/metrics), clean editorial voice, strong
agent-readiness (schema, .md twins, APIs), distinctive "AI-written / human-verified"
positioning, genuine original data (facts, State-of-AI-Agents report).

## Prioritized enhancements (by cross-model consensus × impact)

### Tier 1 — near-unanimous, high ROI
1. **Tool directory `/tools`: faceted search + filters + sort + richer cards.**
   Every model flagged the "endless flat grid." Want: category facets, sort by
   stars/updated/MCP/pricing/OSS, comparison checkboxes, logos, one-liner +
   last-verified per card. (We have basic search/filters — needs to be faceted +
   visual + prominent.) [both]
2. **Article reading framework.** Bigger body type (18–20px), narrower measure
   (65–75ch), + a visible **TL;DR / Key-takeaways box above the fold** (we have
   takeaways in the .md twin — surface them in HTML), + "Continue reading / next"
   modules made visually distinct at mid- and end-of-article. (Sticky TOC +
   progress already exist.) [both — humans skim, agents extract]
3. **Contextual newsletter conversion.** Replace generic footer CTA with one
   concrete promise ("the daily 07:00 briefing") + inline asks after a key finding /
   calculator result / tool FAQ + dual CTA "Get daily brief" + "Download report". [human]

### Tier 2 — strong
4. ~~Mobile sticky bottom nav~~ ✅ SHIPPED (Home/News/Tools/Subscribe).
5. **Gate the State-of-AI-Agents dataset + a PDF behind email capture** (Gemini) —
   turns the flagship report into a subscriber engine. [human]
6. **Consolidated "For AI Agents" page** — one doc for crawling, data structures,
   API/MCP usage, citation (we have /agents.html + agent-card + MCP; unify + deepen). [agent]
7. **Brand distinctiveness** — reduce "beige sameness": an accent color, sharper
   type scale, and a signature "agent-written / human-verified" badge on every
   card/byline. [human]
8. **Homepage** — trending "hot" badges from live analytics; tighten to hero + 3–4
   ranked stories; sticky "12-min digest" deep-links. [human]

### The big idea (independent consensus across ~5 models)
**Productize the tool + comparison + report data into a live, embeddable, citable
"Agent Stack Explorer / Knowledge Graph".** Filter 248 tools by job/budget/latency/
model/license → generate a recommended stack → copy a citable/embeddable build
sheet → offer a documented JSON/MCP API. Plus **embeddable widgets** (esp. the
"AI engines are reading us" data) as a backlink/authority growth loop, and a
machine-readable **"Daily AI Agent Brief"** (RSS+JSON+email). This is the lever
that makes answer-engines cite us at origin and compounds traffic.

## Roadmap item 5 — RECURRING visual audit (Gil's add, 2026-07-14)
Every loop cycle, actually *look* at real rendered pages in a browser (homepage,
several article types, tool pages, calculators, dashboard — desktop + mobile) and
catch concrete rendering defects the eval harness can't see: oversized/《broken》
"By the numbers" values, inconsistent font sizes (em-compounding), horizontal
scrollbars, oversized illustrations, empty-panel whitespace, overflow. Fix on sight.
First pass (2026-07-14) already found + fixed: homepage rail empty panel
(align-self:start), and article "By the numbers" rendering dates/paths/phrases at
46px (kf-stat-sm shrink). Build this into a script (`scripts/visual-qa.js` extending
the existing `npm run qa:visual`) that asserts: no `.kf-stat` > ~2rem for
non-numeric content, no page-level horizontal overflow, body font-size sanity.

## Status
- ✅ Mobile sticky nav, crawler-demand → newsroom loop, verified crawler dashboard.
- ✅ Homepage rail fix (v2: content-height), article fact-block font fix.
- ✅ **Article TL;DR / typography** — turned out already-shipped: "The takeaway" box
  renders above the fold on 87% of articles; body is 19.2px at a ~70ch measure
  (exactly the council target). Gap: the 13% missing a `summary` (newsroom's job).
- ✅ **Faceted tool directory** — category dropdown + sort + live count + sticky
  controls over the 256-tool /tools. Live.
- ▶ NEXT: **Agent Stack Explorer** (#3, the big idea) — interactive stack builder +
  embeddable widgets + JSON/MCP API over the tools. Then **email-gate the report**
  (#4). Plus the recurring visual audit each cycle.
