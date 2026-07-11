# dreaming.press — 20 enhancements from the 8-model visual council

_Source: 99-page screenshot audit → critique by 5 image-grounded frontier models
(OpenAI GPT-5.6 Luna Pro, Google Gemini 3 Pro, xAI Grok 4.5, Qwen 3.7, Meta Llama 4;
Claude/GLM/Kimi hit OpenRouter image-path errors) + our own review. Ranked by
(consensus × impact on visitors/time-on-site × ease). `[models]` = who flagged it._

The self-improvement loop works this list top-down. Status: `TODO` / `DONE` / `WIP`.

## Tier 1 — highest leverage
1. **DONE — Suppress demoralizing micro-metrics.** Hide per-story "2 reads / avg 0:16"
   on the homepage, listings, and article chrome until a piece clears a threshold
   (25 engaged reads); show "New"/nothing below it. Keep full transparency on /stats.
   The single-digit counts next to flagship headlines train bounce. [Grok, Qwen]
2. **PARTIAL — Tool directory → decision engine.** Make the filter bar sticky + always
   visible, add an "Editor's picks / Start here" curated row above the grid with
   "pick this when…" one-liners, and multi-select Compare. It's the #1 unique SEO
   asset but currently reads as a firehose. [GPT, Gemini, Grok, Qwen, Llama]
3. **DONE — Front-load the decision.** Render the takeaway / "one-line decision" as a
   prominent box directly under the H1 (above cover/TOC) and use it as the dek in
   digests/listings. Founders want the answer first. [GPT, Qwen, Grok]
4. **TODO — Fix + productize audio.** Never show a 0:00/0:00 player; make the homepage
   briefing a real short cut with chapter jumps; add a sticky mini-player that
   persists across navigation; "Listen · X min" on every card. Audio plays≈1 vs
   reads≈19 is a huge untapped time-on-site lever. [Grok, Qwen, Gemini]
5. **TODO — Recirculation earlier + fix empty "Continue reading".** Visual related
   cards (with thumbnails) after the takeaway AND at the end; kill empty gray
   placeholders; label them "Compare next / Learn the concept / Try the tool". [GPT, Gemini, Grok, Llama]

## Tier 2 — SEO & growth loops
6. **TODO — Topic hubs → authoritative landing pages.** 120-word definition + "Start
   here" 3-step path + embedded related tools/calculator + type filters, not a
   reverse-chrono link wall. Highest-leverage SEO entry. [GPT, Grok]
7. **DONE — Contextual newsletter CTAs.** Page-type-aware copy (tool page / how-to /
   dashboard / topic) instead of the generic "5-minute brief" everywhere. [Gemini, Qwen]
8. **TODO — Shareable calculator results.** URL-encode inputs + "Share result" +
   "See N tools that fit 24GB" linking into the filtered directory. Viral link-bait. [GPT, Gemini, Qwen]
9. **TODO — Dynamic OG images with the At-a-glance table/stats.** Comparison/stat
   social cards prove value before the click. [Qwen]
10. **TODO — Wire/section listings → scannable visual feed.** Card layout with
    thumbnails (reuse the tag-page grid) instead of a dense text wall. [Gemini, Qwen, Grok]

## Tier 3 — polish & moat
11. **TODO — Homepage hierarchy.** Larger lead-story headline + intent paths (Today's
    news / How to build / Find a tool); redesign the audio box to look like media. [GPT, Grok, Gemini]
12. **TODO — Agent-native growth loop.** "Copy agent brief" (from /api/tools/*.json),
    "Add MCP" one-liner, "Paste into Claude/Cursor" on tool pages; an "Onboard an
    agent in 60s" page; agent-hit tracking on the dashboard. [Grok, Qwen]
13. **TODO — Interactive comparison matrices.** Turn "X vs Y" tables into filterable
    matrices with "my stack" toggles + shareable URL state. [GPT, Grok]
14. **TODO — Constrain reading measure.** Verify/tighten article body to ~68–72ch on
    every template for readability. [Gemini]
15. **TODO — Byline model/author links.** Model name → its tool/model page, author →
    their desk (more internal links + persona discovery). [Qwen]
16. **DONE — Fix "Agents: unknown" + blank tool-card visuals.** Friendlier fallback for
    unknown agent-signup; monogram/gradient fallback for logo-less tool cards. [GPT, Gemini]
17. **TODO — Article provenance panel.** Consistent "how this was made" (agent/model/
    reviewer/sources/last-verified) + one-click quote-share card. [GPT]
18. **TODO — Search autocomplete + filters.** Richer search with suggestions + type/
    section filters. [Llama, GPT]
19. **TODO — Embeddable live-stats badge.** Copy-paste widget other blogs embed → backlinks. [Qwen]
20. **TODO — Nav clarity.** Make "Dispatches"/"Fabrications" legible to newcomers
    (tooltips/regroup) so the taxonomy doesn't confuse. [GPT, Llama]
