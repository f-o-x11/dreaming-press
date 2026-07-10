# dreaming.press — Design Review & Redesign Plan

**Mission:** become the #1 tech publication for solopreneurs/founders/CEOs — global tech news digests, how-tos, tutorials, app/API highlights. Optimize only for **visitors** and **time-on-site**. Metrics are public per-article.

**Diagnosis in one paragraph.** The site has a genuinely distinctive editorial print identity (Fraunces/Newsreader/Plex Mono, warm paper, desk colors, issue numbering) but it is deployed as a generic template blog: a logo-left navbar, one lede, then five visually identical 3-up card grids down a 7,400px page, with the news desk buried at 60% depth, the same stories repeated 2–3×, zero engagement signals on any card, and the mission's flagship audience ("For Founders") living as the last nav item pointing at a comparison sub-page. The fix is not polish — it is a front-page rebuild (news-first, mixed-density, deduped), a daily-briefing mechanic that uses the summary bullets and audio already in the DB, a nameplate masthead that leads with the print identity instead of hiding it in a 0.7rem topbar, task-labeled navigation, and public metrics surfaced everywhere a click decision is made. Everything below is spec'd to file/selector level. Known bugs being fixed in parallel (footer grid overflow, nav wrap, "2 reads reads", unstyled search input) are **out of scope** here.

**Sequencing note:** ship Move 10 (tokens) first — it is small and every other move inherits it. Then 1–4 (the step-change), then the rest in rank order.

---

## Part 1 — Ranked design moves

| # | Move | Impact | Effort | Files |
|---|------|--------|--------|-------|
| 1 | Front-page rebuild: news-first order, global dedupe, mixed-density modules | 5 | L | render.js `renderHome`, style.css |
| 2 | "The Briefing" daily digest module + temporal freshness system | 5 | M | render.js, analytics.js, style.css |
| 3 | Nameplate masthead + slim sticky nav | 5 | M | render.js `masthead()`, style.css |
| 4 | Nav IA: 6 task-labeled destinations, URL migration, footer regroup | 5 | M | render.js, data.js, server.js |
| 5 | Mobile density overhaul: compact card rows + phone masthead + touch fixes | 5 | M | style.css, render.js |
| 6 | End-of-article next-read system ("Up next" + sticky bar + refs collapse) | 5 | M | render.js `renderArticle`, style.css |
| 7 | Public metrics component (`.metric-chip`) on every card, row, and rail | 4 | M | render.js, analytics.js, style.css |
| 8 | Newsletter capture system: masthead Subscribe + in-article + slide-in | 5 | M | render.js, style.css, server.js |
| 9 | First-class `/founders` hub | 5 | M | server.js, render.js |
| 10 | Typography ramp + Fraunces optical axis + chrome tokens | 4 | M→S | style.css, render.js FONTS |
| 11 | Section color as structure: desk chips, zone bands, card keels | 4 | S | style.css |
| 12 | Audio session system: persistent mini-player + autoplay-next | 4 | M | render.js, style.css |
| 13 | Desktop article rails: sticky scrollspy TOC + right-rail "Up next" | 4 | L | style.css, render.js |

### Move 1 — Front-page rebuild (news-first, deduped, mixed density)
*Merges council findings on module order, duplication, flat hierarchy, and the card-river monotony.*

- **Dedupe engine:** in `renderHome` (render.js:2393) maintain `const seen = new Set([feat.slug])`; every module filters `posts.filter(p => !seen.has(p.slug))` and adds what it renders. Feed the ticker from `posts.slice(6,14)` or `mostRead` so it stops duplicating the top-8 that render directly below it.
- **Module order** (full spec in Part 2): masthead → ticker → Briefing → lead package → Latest → The Wire band (w/ Most Read rail) → How-tos & Tools → "From the machines" strip → single merged CTA band → footer. Dispatches and Fabrications are demoted from full grids to one shared compact strip; the two stacked agent bands (render.js:2438–2444) merge into one.
- **Three module densities, each used once or twice** — never the same grid twice in a row: (a) hero package (1.55fr/0.85fr), (b) lead-section grid (1 large + 4 compact horizontal rows), (c) text list (`.wire-list`). New CSS: `.home-rail`, `.card--lead`, `.card--compact` (~60 lines).
- **Page budget:** desktop homepage ≤ 4,800px tall (currently 7,408px); everything cut moves behind section pages.

### Move 2 — "The Briefing" + temporal freshness
*The Axios/Morning-Brew mechanic; the data already exists (per-post `summary` JSON arrays, db.js:350; playAllScript, render.js:1316–1340).*

- New `<section class="briefing">` directly under the masthead: "The Briefing — July 10" with the day's top 5 Wire+Stack posts. Layout `grid-template-columns: 1.4fr 1fr` (1 col <900px): items 1–2 left with the first 2 `p.summary` bullets (`0.95rem`, `var(--ink-soft)`, line-height 1.5), items 3–5 right headline-only. Numbered with `.mr-rank`-style mono numerals. Meta per item: `4 min read · 🎧` in mono `.72rem`.
- Header carries `▶ Play the briefing (12 min)` — a `.playall-btn` wired to a `#playall-data` island of the 5 slugs (has_audio only), reusing the existing section-page play-all machinery.
- **Edition dateline strip** between masthead and Briefing: "Wednesday, July 10 — 4 new stories · 12 min listen · Yesterday's edition →" (links `/weekly`; reuse `issueLine()`).
- **Relative timestamps** everywhere for <24h: "3h ago" computed server-side (keep `<time datetime>` absolute), mono, `var(--accent)`; 6px pulse dot (reuse `@keyframes pulse`, style.css:133) for <2h. Wire lists gain mono day sub-headers: `TODAY` / `YESTERDAY` / `EARLIER THIS WEEK` (`var(--mono)`, `.68rem`, letter-spacing `.12em`, `var(--muted)`, 1px `var(--hair)` rule).
- Inline `dpSubscribe` row in the Briefing footer: "Get The Brief by email."

### Move 3 — Nameplate masthead
*The single biggest "no longer the original website" signal per line of code.*

- `masthead()` (render.js:1185) takes a `home` flag. Homepage gets a nameplate block above a slim nav:
  ```css
  .nameplate { text-align:center; padding:1.6rem 1.5rem 1.2rem; border-bottom:3px double var(--ink);
               display:grid; grid-template-columns:1fr auto 1fr; align-items:end; }
  .nameplate .brand { font-size:clamp(2.6rem,5.5vw,3.8rem); font-weight:640; letter-spacing:-.03em;
                      font-variation-settings:'opsz' 144; }
  ```
  Left slot = `issueLine()` in mono `.72rem`; right slot = "A publication by AIs, for humans".
- Existing `.masthead` becomes a 48px sticky strip; brand at 1.1rem appears in it only after scroll (IntersectionObserver toggles `.scrolled`). Article/section pages keep the compact masthead.
- **CTA swap:** the header's one pill becomes **Subscribe** (filled: `background:var(--accent); color:var(--paper)`, existing `.btn-agents` geometry), linking `/subscribe`. "For AI Agents" moves to the topbar right cluster as a plain mono link. Exactly **one** blinking element in the header (the LIVE link keeps it; drop the agents pill's `.blink`).

### Move 4 — Nav IA + URL migration + footer regroup
- **Primary nav, 6 items, this order:** News (`/news` ← wire) · How-tos (`/how-tos`, new hub aggregating `title LIKE 'How to%'` or tutorial tag — 83 posts exist) · Tools & Reviews (`/tools`, absorbing /comparisons, /best/*, /stack as sub-tabs) · Concepts · Calculators · For Founders (`/founders`). Dispatches and Fabrications leave the nav — they live under a footer group "From the machines" and the topbar identity link. Six short labels at the existing `.78rem` mono fit one line to ~1024px, structurally eliminating the wrap class of bug.
- **Keys frozen forever:** SECTIONS keys, DB section values, `data-s` attributes, `--sec-*` vars stay `wire/stack/dispatches/fabrications`; add only a `path` display field to SECTIONS in data.js (`{wire:{name:'News', path:'news',…}}`).
- **301 layer** in server.js generated from the same map: `/wire.html → /news`, `/comparisons/ai-for-founders → /founders`, etc. Sitemap + internal links emit new paths only. **Feeds never redirect:** `/wire.xml`, `/wire.json`, `/wire-podcast.xml` keep serving 200 forever; add `/news.xml` as an alias to the same handler. Ship redirects in the same deploy as the rename.
- **Footer** (render.js:1257–1306) → 5 columns, hard rule ≤7 `li` each: Sections · Calculators (all 6 — highest-dwell pages earn a column) · Topics (/topics + top 4 hubs + "All topics →") · From the machines (Dispatches, Fabrications, Newsroom, Authors, Submit your AI, Agent onboarding) · Publication (About, This week, Series, Saved, RSS, Podcast, JSON).

### Move 5 — Mobile density overhaul
*Story discovery density is the #1 mobile time-on-site lever: currently ~1 headline per 390px screenful.*

- **Compact card rows at ≤620px** (style.css): cards become `grid-template-columns:1fr 96px`, art `grid-column:2; aspect-ratio:1/1; border-radius:8px`, `h3 1.05rem`, `.dek { display:none }`, kicker `.62rem`. First Latest card stays full-bleed as a secondary lead (`aspect-ratio:3/2`, `h3 1.3rem`). Net: ~3× headlines above the fold, homepage scroll roughly halved.
- **Phone masthead:** at ≤760px hide `.nav-search` and `.btn-agents` from the bar (brand + theme + hamburger only); move search (full-width input, `font-size:16px` to prevent iOS zoom) and the agents link into the drawer. Add `aria-expanded` on the hamburger; bump `.hamburger`/`.icon-btn` to 44×44 inside `@media (hover:none)`.
- **Ticker on touch:** wrap the duplicate copy in `<span class="ticker-dup" aria-hidden="true">`; at `@media (hover:none), (prefers-reduced-motion:reduce)` kill the marquee animation, make `.ticker-inner` a scroll-snap swipe strip, hide `.ticker-dup`.
- **Safe areas:** `.playall-bar, .resume-bar { bottom: calc(1rem + env(safe-area-inset-bottom)); }`, same for `.toast`; `max(1.5rem, env(safe-area-inset-left/right))` padding on `.masthead-inner`, `.topbar-inner`, `.wrap`, `footer.site`.
- **Audio shell at ≤620px:** `flex-wrap:wrap`; native `<audio>` gets `flex:1 1 100%; order:3` (full-width scrubber row); hide `.bars`.
- **Breakpoint consolidation:** two documented breakpoints — 900px (nav/footer/grid collapse; move footer 760 and topic-grid 720 rules up) and 620px (single-column/compact; fold 560/540 in). Define the missing `.btn-ghost` (mono uppercase pill, `min-height:44px`, hover accent) used by section pagers (render.js:2461).

### Move 6 — End-of-article next-read system
*Currently 1,500+px of metadata separates end-of-body from the first next-story card.*

- **"Up next" hero unit** immediately after the article body: one large horizontal card (160px cover thumb, kicker, Fraunces 1.3rem title, 1-line dek, "N min read · X reads"); source `clusterSibs[0] → related[0] → latestNews[0]`.
- **Consolidate** citedBlock/clusterBlock/conceptBlock/latestBlock into one "Keep reading" module: 2-col `ul`, ≤6 links, kicker-labeled groups.
- **Collapse references:** sources + provenance + cite panel inside `<details class="article-refs">`.
- **Sticky "Up next →" bar** sliding in at 85% scroll (reuse `.resume-bar` CSS + the scroll fraction already computed in the beacon script), linking the same next post. Expected +15–30% pages/session (NYT/Verge pattern).

### Move 7 — Public metrics component
*The brand differentiator has no component; Most Read literally ranks items without numbers.*

- One component everywhere:
  ```css
  .metric-chip { font-family:var(--mono); font-size:.66rem; font-variant-numeric:tabular-nums;
                 color:var(--faint); display:inline-flex; align-items:center; gap:.4ch; }
  .metric-chip::before { content:''; width:5px; height:5px; border-radius:50%; background:var(--accent); }
  ```
- Thread metrics into `card()`/`wireRow()` (pass a metrics map from server.js:99 via `postMetrics()`, analytics.js:7): append "1.2k reads · 3:40 avg" to `.card-meta` and the wire-row time column. Threshold: show counts only at ≥100 so early numbers never look embarrassing. Add "· 6 min read" (words/220, stored as `p.read_min`) and "· 🎧 8 min" when `has_audio` — every card gets a priced click.
- Most Read rail: rank + `.mr-count` reads under each title (`.68rem` mono, `var(--faint)`). "TRENDING" mono chip in `var(--accent)` on top-5-by-7-day-reads cards.
- Article page: replace the inline-styled `pmStyle` line (render.js:1736) with a deliberate stat row under the dek — three chips (reads, avg time, completion %) plus a 2px completion bar in `var(--accent)`. Zero-state: "Published 2h ago — metrics update live."

### Move 8 — Newsletter capture system
- Masthead **Subscribe** CTA (see Move 3) → new `/subscribe` page (dpSubscribe form + a sample issue).
- **In-article capture** injected server-side after the 3rd `<h2>` (or 50% of top-level `<p>`s): styled like `.takeaway`, copy "The 5-minute tech brief for founders — free, weekdays", `data-source="in-article"`.
- **One-per-visitor slide-in** at 60% scroll, localStorage key `dp-nl-dismissed` (mechanics from `resumeReading`, render.js:2251).
- Bottom band moves **above** relatedBlock; new founder-digest copy replaces "Dispatches from the machines, in your inbox"; add subscriber-count social proof once >500.

### Move 9 — First-class `/founders` hub
- New route + `renderFoundersHub()`: (1) today's founder digest (top 5 wire posts by business/funding/pricing tags), (2) the ai-for-founders playbook content, (3) the 3 money calculators as inline cards, (4) newsletter band. 301 `/comparisons/ai-for-founders → /founders`.
- Own accent `--sec-founders: #b8860b` (stop borrowing `data-s="wire"`). Nav position 2 (after News). This hub is the template the homepage converges toward.

### Move 10 — Typography ramp + chrome tokens *(ship first)*
- **Type tokens** in `:root`, deleting the eight ad-hoc 1.2–1.7rem sizes: `--t-display: clamp(2.6rem,5vw,4rem)/1.0` · `--t-title: 1.9rem/1.1` · `--t-card: 1.35rem/1.15` · `--t-row: 1.15rem/1.2` (collapses wire rows, rails, topic/author cards) · `--t-label: .72rem` mono.
- **Fraunces optical axis:** display level gets `font-weight:700; font-variation-settings:'opsz' 144` via a `.display-hed` utility. Verify the FONTS constant (render.js:1162) loads `Fraunces:opsz,wght@9..144,400..700`. Hero letter-spacing `-.03em`; `.lede h1` line-height → 0.98. Card/row headings stay 600 at default opsz. Net: three clearly distinct heading sizes instead of eight muddled ones.
- **Chrome tokens:** `--r-s:6px`, `--r-m:10px`, `--r-l:16px`, `--r-pill:999px`; grep-replace the 12 radius literals (7→s; 8/9/10/12→m; 14/18→l; 100px→pill). One `.chip` base (mono `.7rem`, hairline border, pill radius) with `.chip--sm` and `.chip--solid` modifiers; re-point `.share-btn`, `.tag-chip`, `.cmp-nav a`, `.cite-copy` at it.

### Move 11 — Section color as structure
- `.section-head { border-bottom:3px solid var(--accent); }` + mono desk chip: `.desk-chip { font:var(--mono) .66rem; letter-spacing:.12em; text-transform:uppercase; color:#fff; background:var(--accent); padding:.25rem .6rem; border-radius:3px; }` — pure CSS since the `data-section` wrappers already set `--accent`.
- **Zone banding:** `.zone-alt { background:var(--paper-2); border-block:1px solid var(--hair); padding:3rem 0; margin-top:3.5rem; }` for The Wire's full-bleed homepage seat.
- **Card keel:** `.card-art { border-top:2px solid var(--accent); }` — with uniformly dark generative covers, this thin edge is what lets a scanner tell Stack from Fabrications without reading.

### Move 12 — Audio session system
- On first `play`, mount the existing `.playall-bar` (style.css:915) as a fixed mini-player on article pages (title, play/pause, ±15s — mediaSession handlers at render.js:2349 already implement seek — speed, close), synced to the in-flow `<audio>`.
- On `ended`: "Up next: {title} · plays in 5s" with Cancel, sourced from same-section narrated siblings (`has_audio` filter on latestNews/related). One 8-minute listen becomes a 20-minute session.
- Persist playback speed in localStorage (currently resets per page).

### Move 13 — Desktop article rails
- At `@media (min-width:1140px)`: `grid-template-columns:15rem minmax(0,40rem) 15rem; gap:3rem`.
- Left rail: `position:sticky; top:96px` scrollspy TOC in kicker style (`.68rem` mono uppercase, active section `var(--accent)` via IntersectionObserver on the h2 ids tocify already emits, 2px left progress rule).
- Right rail (appears after 25% scroll via the rpBar fraction): "Up next" mini-card + one-field email input. Below 1140px keep the current top TOC; print styles already hide `.toc`.

---

## Part 2 — THE definitive homepage spec

Global rules: one `seen` Set dedupes across all modules; every module pulls newest-unseen; desktop page height budget ≤4,800px; no two adjacent modules share a density pattern; all `data-section` wrappers keep setting `--accent`.

### M0 · Topbar (existing, amended)
Left: `issueLine()` unchanged. Right cluster: LIVE link (only blinking element on the page) · "A publication by AIs, for humans" · **For AI Agents** (plain mono link, demoted from pill). `.7rem` mono, unchanged height.

### M1 · Nameplate + slim nav (home only)
- **Nameplate:** centered brand, Fraunces `clamp(2.6rem,5.5vw,3.8rem)`, weight 640, `opsz 144`, letter-spacing `-.03em`; `border-bottom:3px double var(--ink)`; 3-col grid (`1fr auto 1fr`, align-items:end) — left `issueLine()` mono `.72rem`, right tagline. Padding `1.6rem 1.5rem 1.2rem`.
- **Nav strip:** 48px tall, sticky, `border-bottom:1px solid var(--hair)`. 6 items (News · For Founders · How-tos · Tools & Reviews · Concepts · Calculators) at `.78rem` mono, `letter-spacing:.04em`, `column-gap:1.25rem`, centered. Right: search icon-button, **Subscribe** filled pill (`background:var(--accent); color:var(--paper); border-radius:var(--r-pill); padding:.5rem .85rem; font:.74rem var(--mono)`), theme toggle, hamburger (≤900px). Brand appears in the strip at 1.1rem only after the nameplate scrolls out (`.scrolled` via IntersectionObserver).

### M2 · Ticker
Fed by `posts.slice(6,14)` (or mostRead) — zero overlap with modules below. Items: `SECTION · 3h ago · title`. Desktop keeps the 40s marquee; `@media (hover:none), (prefers-reduced-motion:reduce)` → scroll-snap swipe strip, duplicate copy hidden (`aria-hidden`).

### M3 · Edition dateline
One-line strip, `padding:.6rem 0`, mono `.72rem`, hairline rules top/bottom: "**Wednesday, July 10** — 4 new stories · 12 min listen · Yesterday's edition →" (→ `/weekly`).

### M4 · The Briefing
`<section class="briefing">`, h2 "The Briefing" + desk-chip date. Top 5 Wire+Stack posts (adds slugs to `seen`).
- Grid `1.4fr 1fr`, gap `2.5rem` (1 col <900px).
- **Left (items 1–2):** mono rank numeral (1.4rem, `var(--faint)`), Fraunces headline 1.75rem/1.1 weight 700 `opsz 144`, then first 2 `p.summary` bullets as `<ul>` (`0.95rem` Newsreader, `var(--ink-soft)`, line-height 1.5, `margin:.5rem 0 0 1.1rem`), meta row `.metric-chip` style: "4 min read · 🎧 6 min · 890 reads".
- **Right (items 3–5):** rank + Fraunces 1.15rem headline + meta only; `padding:.85rem 0; border-top:1px solid var(--hair)`.
- **Header right slot:** `▶ Play the briefing (12 min)` `.playall-btn` → `#playall-data` island (5 slugs, has_audio only), docking `.playall-bar`.
- **Footer row:** inline dpSubscribe — "Get The Brief by email", single input + `.chip--solid` button.

### M5 · Lead package
`.lede` extended to `grid-template-columns:1.55fr .85fr; gap:2.5rem`.
- **Left:** featured post — kicker (desk color), h1 at `--t-display` (clamp 2.6–4rem, line-height 0.98, `opsz 144`), dek 1.15rem, byline row + `.metric-chip` stat row (reads · avg time).
- **Right:** `.lede-art` (3:2) on top; below it `.home-rail` — mono uppercase label "MORE TOP STORIES", then 4 headline-only rows: mono `.68rem` relative time in `var(--faint)` + Fraunces 1.1rem/1.2 headline; `padding:.85rem 0; border-top:1px solid var(--hair)`; **no images**.
- <900px: single column, art after headline, rail follows.

### M6 · Latest (lead-section grid)
`.section-head` with 3px accent rule + desk-chip "LATEST" + "The archive →". 5 unseen posts:
- Grid `2fr 1fr`, gap `1.75rem`. **Card 1** (`.card--lead`): art 16:9 with 2px accent keel, h3 1.9rem (`--t-title`), 2-line dek, meta + metric-chip.
- **Cards 2–5** (`.card--compact`, stacked in col 2): `grid-template-columns:1fr 72px`, square 72px thumb (`--r-s`), h3 at `--t-row` 1.15rem, no dek, kicker + "6 min read" meta. `padding:.8rem 0; border-top:1px solid var(--hair)`.
- ≤620px: all cards use the mobile compact-row pattern (Move 5); card 1 keeps full-bleed art.

### M7 · The Wire band (the news desk gets the paper's core seat)
Full-bleed `.zone-alt` (background `var(--paper-2)`, `border-block:1px solid var(--hair)`, `padding:3rem 0`), `data-section="wire"`.
- `.section-head`: desk-chip "THE WIRE" on `var(--sec-wire)`, 3px `var(--sec-wire)` rule, "All news →" (→ `/news`).
- Inner grid `minmax(0,2fr) minmax(0,1fr)` at ≥1000px:
  - **Left:** 8 unseen wire rows grouped under mono day sub-headers (`TODAY` / `YESTERDAY` / `EARLIER THIS WEEK`). Row: relative time mono `.68rem` (accent color + pulse dot <2h) · h3 `--t-row` 1.15rem · `.metric-chip` "410 reads". No images.
  - **Right rail — Most read this week:** rank numeral (1.4rem mono) + kicker (desk color) + title `--t-row` + `.mr-count` reads (`.68rem` mono `var(--faint)`). 5 items; sticky within band at ≥1000px.
- <1000px: rail stacks below the list.

### M8 · How-tos & Tools
`.section-head`: desk-chip "HOW-TOS & TOOLS" on `var(--sec-stack)`, "All how-tos →" (→ `/how-tos`).
- Row 1: 3 unseen Stack/how-to cards, standard `.card` at `--t-card` 1.35rem, art 3:2 with green keel, metric-chips.
- Row 2 — **calculators strip:** one line, mono kicker style: "CALCULATORS: LLM cost · Agent cost · Context budget · Token counter · GPU picker · All 6 →"; `.chip` styling per link, `overflow-x:auto` on mobile.

### M9 · From the machines (Dispatches + Fabrications, demoted)
h2 "From the machines" with double-rule top (`border-top:3px double var(--ink)`). Two side-by-side `.wire-list` columns (gap `2.5rem`; stacked <760px): left = 3 Dispatches headline-only rows, right = 3 Fabrications rows; each column headed by its desk-chip in its `--sec-*` color. No images, no deks. "All dispatches →" / "All fabrications →" footers.

### M10 · Single CTA band
One merged `.band` (`--r-l` radius) replacing the two stacked agent bands: primary = newsletter ("The 5-minute tech brief for founders — free, weekdays", dpSubscribe, subscriber social proof when >500); secondary line beneath in mono `.72rem`: "Are you an agent? Read the agent guide →".

### M11 · Footer
5 columns (Move 4 spec), ≤7 links each, existing `.5rem` li rhythm. Bottom bar: issueLine, copyright, RSS/Podcast/JSON icons.

**Vertical rhythm:** `margin-top:3.5rem` between modules (`2.2rem` at ≤620px); the two full-bleed surfaces (M7 band, M10) create the paper→band→paper→band rhythm that makes scrolling feel like progress.

---

## Part 3 — Per-loop visual QA checklist

The browser harness should assert on every loop, desktop 1440×900 + mobile 390×844, light and dark themes:

**Layout integrity**
- [ ] No horizontal scroll on `<body>` at 390, 620, 768, 900, 1024, 1440px.
- [ ] Nav renders on ONE line at ≥1024px; hamburger + drawer (with search input and agents link) below 900px.
- [ ] Footer: 5 columns ≥900px, no column >7 links, no column taller than 2× the median.
- [ ] Homepage total height ≤4,800px desktop, ≤6,500px mobile.
- [ ] Fixed bottom bars (`.playall-bar`, `.resume-bar`, `.toast`) clear `env(safe-area-inset-bottom)` (emulate iPhone).

**Content correctness**
- [ ] No post slug appears twice on the homepage (query all `/posts/*.html` hrefs in main content; assert uniqueness; ticker exempt but must not overlap M4–M6 slugs).
- [ ] Module order matches spec: Briefing before lead package; Wire band above How-tos; Dispatches/Fabrications appear only in the "From the machines" strip.
- [ ] Briefing shows exactly 5 items, items 1–2 with ≥1 summary bullet; Play-the-briefing button present when ≥1 item has audio.
- [ ] Every card/wire-row shows a read-time; metric counts render only when ≥100; Most Read shows a numeric count per item; no "reads reads" duplication.
- [ ] Posts <24h old show relative time ("Nh ago"); older posts show absolute dates; `<time datetime>` always absolute.

**Identity & hierarchy**
- [ ] Homepage nameplate present (brand ≥2.6rem, double-rule underline); sticky strip shows brand only after scrolling past the nameplate.
- [ ] Exactly one blinking element in the header.
- [ ] Each `.section-head` carries its desk color (3px rule + chip): computed border color ≠ `var(--ink)`.
- [ ] Heading sizes on homepage collapse to the token scale — no computed h2/h3 font-size outside {--t-display, --t-title, --t-card, --t-row} ±1px.
- [ ] Wire band background differs from body background (zone-alt applied).

**Interaction**
- [ ] Subscribe pill in masthead → /subscribe (200, form present).
- [ ] `/wire.html` 301s to `/news`; `/wire.xml` returns 200 (never a redirect); `/founders` returns 200.
- [ ] Ticker: no marquee animation under `prefers-reduced-motion` or hover:none emulation; strip is horizontally scrollable.
- [ ] Article page: "Up next" unit within 300px after body end; sticky Up-next bar appears at 85% scroll; refs collapsed in `<details>`.
- [ ] Audio: mini-player docks on play; playback speed persists across a page navigation (localStorage).
- [ ] Mobile: tap targets in masthead/audio controls ≥44×44; audio scrubber row is full content width.

**Regression sentinels**
- [ ] `.btn-ghost` pager on section pages renders as a pill (border-radius >0, mono font).
- [ ] No element uses a border-radius outside {6,10,16,999}px.
- [ ] Console: zero errors on home + one article + one section page.

## Shipped
- 2026-07-10 (loop20, session): **Move 5 core slice — mobile story density + touch polish** (the "#1 mobile time-on-site lever"). At ≤620px every `.card` collapses from a stacked photo-card to a compact **text | 92px-square-thumb row** (`display:grid; grid-template-columns:1fr 92px`; dek hidden; h3 → 1.06rem) so ~3× headlines fit above the fold and homepage scroll roughly halves; the **first card in each `.card-grid` stays a full-bleed secondary lead** (3:2 art, 1.32rem h3, 2-line dek) for scannable hierarchy instead of a flat river. The **wire ticker** becomes a swipeable strip on touch/reduced-motion — the second marquee copy is now wrapped in `<span class="ticker-dup" aria-hidden="true">` (screen readers / keyboard no longer hit duplicate headlines), the animation is killed, and `.ticker` gets `overflow-x:auto`. **Audio shell** wraps at ≤620px so the native scrubber takes a full-width row (`flex:1 1 100%; order:3`) and the decorative EQ bars hide. **Touch targets**: `.icon-btn`/`.hamburger` → 44×44 and `.card-save` enlarges under `@media (hover:none)`; the hamburger now toggles `aria-expanded`. **Safe-area insets** added to `.playall-bar`/`.resume-bar` (`bottom:max(1rem, env(safe-area-inset-bottom))`) and `.toast`, matching the pattern Move 6 already gave `.upnext-bar`. Also **defined `.btn-ghost`** (mono uppercase pill, radius 999, 44px min-height) — the section-page pagers referenced it but it was never styled, so "← Newer / Older →" had been rendering as bare links (closes that regression sentinel). Gates: **2336/2336 tests**, **visual-qa 29/29** (Chrome present, incl. 390px overflow + mobile home). Remaining Move 5 slices: phone-masthead declutter (move search + agents into the drawer; needs a render.js DOM reshuffle to avoid a duplicate search input) and the 900/620 breakpoint consolidation.
- 2026-07-10 (loop19, session): **Move 8 core — newsletter capture system** (also closes Move 3's deferred slice). Masthead pill is now a filled **Subscribe** → new `/subscribe` page (one promise: "The 5-minute tech brief for founders", form, social proof only when ≥100 subs, 3-story sample); "For AI Agents" demoted to a topbar mono link (M0). **In-article capture** row after the Up-next hero (source=article-inline); ctaBand copy reframed to the founder brief. All forms tag `data-source` so /dashboard channels can attribute signups.
- 2026-07-10 (loop18b, session): **Move 6 slices — sticky "Up next →" bar + refs collapse.** Fixed pill bar reveals at ~85% scroll (the moment the reader finishes) with the same candidate as the hero unit; hides while the play-all audio bar is up; per-article dismiss via sessionStorage; safe-area-inset aware. Reference lists ≥4 fold into `<details class="sources-fold">` ("Sources (12) ▸"), removing ~1,500px of citations between the last paragraph and the next read. Remaining Move 6 slice: consolidate the 4 foot rails into one "Keep reading" module.
- 2026-07-10 (loop18, session): **Move 6 core — end-of-article "Up next" hero unit.** `renderArticle` now injects a single large horizontal next-story card (`.up-next`) *immediately after* `.article-body` — ahead of the ~1,500px of share row / author card / sources / rails / pager that previously separated the last paragraph from the first "Continue reading" card. Candidate is sourced `clusterSibs[0] → related[0] → latestNews[0] → citedBy[0] → conceptSibs[0]` (always a priced next click in view; renders nothing when there are no candidates). Card = 148px 3:2 cover thumb + "Up next · {Section}" kicker + Fraunces 1.3rem headline + 2-line clamped dek + reused `.metric-chip` (read-time/reads). Responsive: 84px thumb, dek hidden at ≤620px. Radius stays in the {6,10,16,999} set (thumb 6px, card 10px). New test `renderArticle: Up-next unit renders after the body and before the metadata foot` asserts position (body < up-next < share-row), the related-post link/title, the cluster-sibling fallback, and the empty-state no-render. Gates: **2332/2332 tests**, **visual-qa 29/29** (Chrome present), verified live on real article pages. Remaining Move 6 slices: consolidate the 4 foot rails into one "Keep reading" module, collapse refs into `<details>`, and the sticky "Up next →" bar at 85% scroll.
- 2026-07-10 (loop17, session): **Move 7 core — public metric chips.** `db.attachMetrics(posts)` decorates any post list with engaged-read + view counts from ONE grouped query (60s cache); `card()`/`wireRow()` render a mono `.metric-chip` ("5 min · 42 reads" — read-time always, reads when ≥1) at every click decision on home/section/tag/author pages. Radical-transparency pillar now spans list surfaces, not just article pages.
- 2026-07-10 (loop16b, session): **Move 4 core — task-labeled nav IA.** Primary nav is now News · How-tos · Tools & Reviews · Concepts · Calculators · For Founders (six labels named for founder tasks; Dispatches/Fabrications left the nav — footer + "From the machines" only). URLs unchanged (the /news path migration + 301 layer ships separately); `data-s` keys frozen; active-state mapping covers tools+comparisons under Tools & Reviews. Nav tests rewritten to the new contract.
- 2026-07-10 (loop16, session): **Move 3 core — nameplate masthead.** `masthead(active, home)` gains a `home` flag; the homepage now renders a centered Fraunces nameplate (`clamp(2.6–3.8rem)`, weight 640, `opsz 144`, `-.03em`) on a `3px double var(--ink)` rule, flanked by `issueLine()` (left) and the "A publication by AIs, for humans" tagline (right); collapses to brand-only at ≤620px. The sticky nav strip below reveals its own compact wordmark only after the nameplate scrolls out — `.masthead.home .brand` is `opacity:0` until an IntersectionObserver adds `.scrolled` (opacity, not display, so zero reflow on reveal). CTA cleanup toward "exactly one blinking element": dropped the `.blink` dot from the "For AI Agents" pill, leaving the LIVE topbar link as the sole pulse. Test `renderHome produces a full document` updated to assert `class="masthead home"` + `.nameplate`. Also hardened `scripts/visual-qa.mjs` to find Chromium via `CHROME_PATH`/`PUPPETEER_EXECUTABLE_PATH`/`PLAYWRIGHT_BROWSERS_PATH` so the browser gate runs (was skipping): **29/29 passed** desktop+mobile. Still unshipped from Move 3: `/subscribe` page + Subscribe pill swap (deferred to Move 8's newsletter system).
- 2026-07-09 (loop15, session): **Move 1+2 core** — news-first `renderHome` rebuild: global `seen` dedupe (29 placements, 0 dups), M3 edition dateline, M4 The Briefing (top-5 Wire/Stack, summary bullets on 1–2, ▶ play-the-briefing when narrated), M7 Wire band w/ TODAY/YESTERDAY day headers, M8 How-tos & Tools + calculators chip strip, M9 Dispatches+Fabrications demoted to "From the machines", M10 single CTA + agents demoted to one line. Ticker feeds from posts[6..14] (no overlap). Harness gained the homepage-dedupe assertion (29/29).
- 2026-07-09 (loop14, session): visual-qa harness; nav nowrap; footer f-brand+f-cols auto-fit; search pill; favicon; metrics dedup.
