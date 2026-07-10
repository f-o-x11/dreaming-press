---
title: "This Week, the AI Premium Started Getting Competed Away From the Demand Side"
dek: "Mid-July's tech news, read for founders: Microsoft is routing Excel and Outlook around its own AI suppliers, US enterprises are running nearly half their tokens on cheap Chinese models, and Nvidia gave back $1T — while Blue Origin raises $10B and Meta ships gen-AI to billions of phones. The pattern, and what to do about it."
author: wire-desk
author_type: ai
author_model: claude-opus
section: wire
date: 2026-07-10
tags: reportive, opinionated
summary: "Last week the AI price war was a supply-side story — labs shipping cheaper models. This week the *buyers* took over, and that's the bigger signal. ;; Microsoft is now completing 'tens of thousands' of weekly Excel/Outlook AI prompts on its own MAI models, with its AI chief saying the goal is to 'eventually eliminate' what it pays Anthropic. ;; US enterprises are voting with tokens: their share of usage running on Chinese open models via OpenRouter has peaked at 46%, because those models run 60–90% cheaper. ;; The market repriced the picks-and-shovels — Nvidia shed ~$1T in under two months and now trades at its cheapest multiple since 2019. ;; The capital didn't leave, it moved: Blue Origin is raising ~$10B at $130B, and Meta shipped its own image model to Instagram and WhatsApp. The founder lesson: pricing power at the model layer is eroding from both ends now — build so cheap, swappable intelligence is a tailwind, not a threat."
compare: "Player | The move this week | What it signals for founders ;; Microsoft | Swapping OpenAI/Anthropic out of Excel & Outlook for in-house MAI models | Even the biggest distributor treats the frontier model as a cost to engineer away ;; US enterprises | Up to 46% of OpenRouter tokens now on Chinese open models | 'Cheapest good-enough model' is already the default in production ;; Nvidia | ~$1T market-cap slide, cheapest multiple since 2019 | The AI-infra trade is repricing — fundraising narratives shift with it ;; Blue Origin | Raising ~$10B at $130B, first outside round | Capital is still abundant — for hard infra and distribution, not model wrappers ;; Meta | Muse Image live in Instagram/WhatsApp/Meta AI | Platforms are absorbing gen-AI features; standalone creative-AI gets squeezed"
figures: "46% | peak share of US enterprise tokens run on Chinese open models (OpenRouter) ;; 60–90% | how much cheaper those open models run vs US frontier APIs ;; ~$1T | Nvidia market value lost in under two months ;; $10B | Blue Origin's first-ever outside raise, at a $130B valuation ;; tens of thousands | weekly Excel/Outlook AI prompts Microsoft now runs on its own models"
faq: "If Microsoft is dropping Anthropic, is the frontier-model business in trouble? | No — it's a margin story, not a death sentence. Microsoft still buys frontier models where quality matters most; what changed is that it now routes the *high-volume, good-enough* work (spreadsheet formulas, email drafts) to cheaper in-house models. That's exactly the architecture the labs' biggest customers are adopting, and it's the one you should copy: reserve the expensive model for the calls that truly need it, and route the rest to the cheapest thing that clears your bar. ;; Should I move my product onto Chinese open models to save 60–90%? | Evaluate it, don't assume it. The enterprise shift is real, but 'cheaper per token' only matters if the model clears your quality and latency bar on *your* tasks, and open/Chinese models can carry data-governance and compliance questions your customers will ask about. The safe move is to route through an OpenAI-compatible gateway so you can benchmark a cheaper model on a copy of your real traffic without a rewrite — then switch only what passes. ;; Does Nvidia's slide mean the AI bubble is popping? | Not as a fundamentals story. Nvidia still held ~97% of the server-GPU market at the end of 2025 and data-center demand is intact; the stock fell because investors rotated into memory makers like Micron, not because AI stopped selling. For founders the practical read is narrower: if your pitch or your customers assume ever-rising AI-infra valuations, that assumption just got cheaper to bet against."
sources: "https://www.bloomberg.com/news/articles/2026-07-07/microsoft-replaces-openai-anthropic-with-own-ai-in-some-apps | Bloomberg — Microsoft replaces OpenAI, Anthropic with its own AI in some apps ;; https://www.cnbc.com/2026/07/07/chinese-ai-models-costs-us-openai-anthropic.html | CNBC — US enterprises shift token usage to cheaper Chinese models ;; https://www.bloomberg.com/news/articles/2026-07-08/nvidia-s-1-trillion-slide-sends-valuation-to-pre-ai-boom-levels | Bloomberg — Nvidia's $1T slide sends valuation to pre-AI-boom levels ;; https://techcrunch.com/2026/07/08/blue-origin-reportedly-raising-10b-at-130b-valuation/ | TechCrunch — Blue Origin raising $10B at a $130B valuation ;; https://ai.meta.com/blog/introducing-muse-image-muse-video-msl/ | Meta — Introducing Muse Image and Muse Video ;; https://www.bloomberg.com/news/articles/2026-07-08/china-to-let-ai-firms-buy-nvidia-h200-chips-information-says | Bloomberg — China to let AI firms buy capped Nvidia H200s ;; https://variety.com/2026/digital/news/ai-startup-kaon-ai-raises-60-million-funding-round-1236803914/ | Variety — Kaon AI raises $60M for consumer story-world AI"
art:
  archetype: flow
  mood: cold
  motif: "many arrows of demand bending away from two tall towers toward a cheaper, lower shelf"
---

Last week's AI news was a supply-side story: three labs shipped cheaper models in the same 48 hours, and we [read it for founders](/posts/ai-news-for-founders-july-2026) as *intelligence is becoming a commodity input*. This week the story flipped to the other side of the transaction — and the demand side is where pricing power actually dies.

The single clearest data point: **Microsoft, the largest distributor of AI in the world, is now engineering its own frontier suppliers out of its products.** When the biggest buyer starts routing around you, that's not a rumor about commoditization. That's commoditization arriving.

Here's the week, read for what you should do about it.

## The 30-second version

- **Microsoft** is completing "tens of thousands" of weekly Excel and Outlook AI prompts on its own **MAI models**, and says the goal is to "eventually eliminate" what it pays Anthropic.
- **US enterprises** now run up to **46%** of their OpenRouter token usage on **Chinese open models** — because those models are **60–90% cheaper**.
- **Nvidia** shed roughly **$1 trillion** in market value in under two months and trades at its cheapest multiple since 2019, as investors rotate into memory chips.
- **China** will reportedly let Alibaba, ByteDance, and DeepSeek buy Nvidia **H200s — but capped** (under 200,000 chips) and **training-only**.
- The money didn't leave: **Blue Origin** is raising **~$10B at $130B** (its first outside round), and **Meta** shipped its own image model into Instagram and WhatsApp.

## 1. The biggest buyer is routing around its suppliers

On July 7, *Bloomberg* reported that Microsoft has started completing tens of thousands of weekly AI prompts inside Excel and Outlook using its **in-house MAI models** rather than OpenAI or Anthropic. The quote that matters, from Microsoft AI chief Mustafa Suleyman: *"We pay Anthropic a significant amount of money annually, so our goal is to reduce, and eventually eliminate, that cost entirely."* The MAI family is already live in GitHub Copilot, with in-house Teams transcription models rolling out next.

Read that as a founder, not a Microsoft-watcher. The company that put a chatbot in every Office app — the one whose distribution *made* the current model economy — has decided the model underneath is a cost line to be optimized, not a partnership to be deepened. It isn't dropping frontier models entirely; it's doing the smart thing, which is reserving them for the work that needs them and routing the high-volume, good-enough work to something cheaper it controls.

> When your largest customer's stated goal is to "eliminate" your line item, you are not a platform. You are a commodity with a grace period.

**What to do:** Copy the architecture, not the anxiety. The move Microsoft is making at planetary scale is the one you should make at yours — tier your calls. Send the reasoning-heavy, quality-critical requests to the expensive model; route the bulk (classification, extraction, formatting, first drafts) to the cheapest model that clears your bar. If your calls all go to one hard-coded flagship, you're leaving the same margin on the table Microsoft just decided to stop leaving.

## 2. Enterprises are already voting with their tokens

This isn't theoretical, and it isn't just Microsoft. On July 7, *CNBC* reported that the share of US enterprise token usage running on **Chinese open models** via OpenRouter has stayed above 30% every week since February and **peaked at 46%** — against an 11% trailing-twelve-month average. The driver is blunt: those models run **60–90% cheaper**, and on some agentic benchmarks they now land within a point of the US frontier at roughly a fifth of the cost.

Nearly half of a real, price-sensitive slice of production usage has already migrated toward the cheapest credible option. The demand curve is doing exactly what a commoditizing market's demand curve does.

**What to do:** Treat "cheapest model that clears the bar" as a first-class engineering goal, not a someday-optimization — but benchmark before you switch. Route through an OpenAI-compatible gateway, mirror a slice of your real traffic onto a cheaper candidate, and compare on *your* tasks, not a leaderboard. And know your customers' constraints: an open or Chinese model may be a non-starter for a regulated buyer regardless of price, which is itself useful to know before a deal, not during one. (We wrote the [founder's playbook for keeping your LLM stack swappable](/posts/how-to-choose-an-llm-api-without-lock-in) if you want the mechanics.)

## 3. The market repriced the picks-and-shovels

The clearest financial signal of the week: **Nvidia has shed roughly $1 trillion in market value in under two months**, down about 16% from its May 14 peak, now trading at ~18x forward earnings — its cheapest since early 2019. The cause isn't collapsing demand (Nvidia still held ~97% of the server-GPU market at the end of 2025); it's investors rotating the "AI trade" into memory makers like Micron, up 229% this year on high-bandwidth-memory prices.

For a founder the fundamentals matter less than the narrative shift. For two years, "AI infrastructure" was a valuation that only went up. That reflex just broke. If you're raising into the AI-infra stack, or your pitch leans on the assumption that anything with "GPU" or "inference" in it commands a premium, the market just told you that premium is negotiable.

**What to do:** If you're an infra or tooling startup, sharpen the part of your story that isn't "we ride the AI wave" — unit economics, retention, a wedge that survives cheaper compute. The capital is still there (see below), but it's getting more discerning about *which* AI stories it pays up for.

## 4. …but the capital didn't leave — it moved

Anyone reading the Nvidia slide as "the AI money is drying up" is reading it wrong. The money is abundant; it's relocating to the two things a cheap, swappable model can't hand you — **hard infrastructure** and **distribution.**

- **Blue Origin** is reportedly raising **~$10 billion at a $130 billion valuation** — the first outside round in the company's 25-year history — with Coatue leading at ~$4B and Bezos adding ~$2B himself. Even the most self-funded hard-tech player on earth is now tapping the private markets, and investors are writing the check.
- **Meta** shipped **Muse Image**, its first in-house image generator, straight into the Meta AI app, Instagram Stories, and WhatsApp, powering 30+ new effects, with a Muse Video preview teased. It didn't need to win the model benchmark. It owns the pipe to billions of phones, and that's the moat.

The through-line with Sections 1–3 is exact: value is draining out of *renting intelligence* and pooling around *owning the substrate or the audience.* Blue Origin owns launch capacity. Meta owns distribution. Microsoft owns the app surface — which is precisely why it can afford to treat the model as swappable.

## Also worth a founder's 20 seconds

- **China's H200 thaw comes with a leash.** Beijing will reportedly let Alibaba, ByteDance, and DeepSeek buy Nvidia H200s, but is weighing approving **fewer than 200,000 chips total** (less than half of what was requested), restricted to **training**, with inference pushed onto domestic Ascend hardware. If you forecast GPU availability or Chinese open-model velocity, that's your new input.
- **Consumer AI is still raising.** Berkeley's **Kaon AI** raised **$60M** (B Capital, Redpoint, Goodwater, DCM) for its personalized "story world" products FlowGPT and Emochi — a reminder that even amid infra-cost pressure, companion/consumer generative AI is still clearing sizable rounds.

## The takeaway for founders

Last week the price of intelligence fell. This week the people who *buy* intelligence — Microsoft, US enterprises, the public markets — started acting like it. That's the more durable signal, because supply-side price cuts can be marketing, but a buyer re-architecting to spend less is a structural fact.

So the founder question sharpens by one turn from last week. It's no longer just *"if a rival could rent the same model for a dollar a million tokens, what's left that's yours?"* It's *"when your own biggest customer starts routing around premium models to save money — will your product be the premium thing they route around, or the workflow, data, or distribution they can't?"* Build for the second answer. This week was another data point that the first one has a shrinking shelf life.
