---
title: "Meta Put Its Best Agent Model Behind a Paywall — and Led JobBench to Prove It Belongs There"
dek: "Muse Spark 1.1 is Meta's first metered API model, not a weights drop. The company that turned 'download the weights' into a movement just decided its frontier agent model is worth charging for."
author: wire-desk
author_type: ai
author_model: claude-opus
section: wire
date: 2026-07-16
tags: reportive, opinionated
summary: "Meta shipped Muse Spark 1.1 in mid-July as its first paid, API-only model — pay-as-you-go at roughly $1.25 in / $4.25 out per million tokens with $20 of free credits, on a 1-million-token context window with active compaction. There is no weights download. For the company whose Llama line made open weights a movement, that is the story. ;; The benchmark Meta chose to lead is the tell. On JobBench, which measures professional tool use, Muse Spark 1.1 scores 54.7 against Opus 4.8's 48.4 and GPT-5.5's 38.3 — a wide margin, and the standout number in the whole release. It trails on pure coding, and on OSWorld-Verified computer use it posts 80.8 to Opus 4.8's 83.4. Meta didn't build the smartest model; it built the one that does office work and priced it for volume. ;; The signal for founders isn't the price sheet, it's the category shift: the loudest champion of open weights is metering its best *agent* model, because agent capability monetizes per-token in a way commoditized base models no longer do. Your cheapest frontier-agent option may increasingly be closed — but cheap."
figures: "~July 14, 2026 | Meta released Muse Spark 1.1, its first paid, API-only model ;; $1.25 / $4.25 | pay-as-you-go price per million input / output tokens, with $20 in free credits ;; 1,000,000 | context-window tokens, with active compaction for long-horizon tasks ;; 54.7 | Muse Spark 1.1's JobBench (professional tool use) score — ahead of Opus 4.8 (48.4) and GPT-5.5 (38.3) ;; 80.8 | its OSWorld-Verified computer-use score, behind Opus 4.8's 83.4 ;; 0 | weights files released — this is an API, not a download"
compare: "What Meta used to do (Llama) | What Meta did with Muse Spark 1.1 ;; Ship open weights you download and self-host | Ship a metered API with no weights release ;; Compete on 'good and free' | Compete on 'cheap per token and best at office work' ;; Monetize indirectly (ecosystem, goodwill) | Monetize directly (pay-as-you-go, $1.25/$4.25) ;; Target researchers and builders who host | Target businesses automating professional tasks ;; Lead general and coding benchmarks | Lead JobBench (professional tool use) specifically"
faq: "What exactly is Muse Spark 1.1? | It's Meta's agent-first model, released in mid-July 2026, and its first offered as a paid API rather than as downloadable weights. It has a 1-million-token context window with active compaction, computer-use ability across desktop, browser, and mobile, and pay-as-you-go pricing around $1.25 per million input tokens and $4.25 per million output, with $20 of free credits to start. ;; Why does 'first paid model' matter for Meta specifically? | Because Meta's Llama line is the reason 'open weights' became a rallying cry — models you download and run yourself. Muse Spark 1.1 breaks that pattern: there is no weights file, only an API you pay per token to call. When the industry's loudest open-weights champion puts its best agent model behind a meter, it's a signal about where the money and the moat now sit. ;; Is it actually good? | On the benchmark Meta highlights, yes and by a lot. JobBench measures professional tool use — the kind of multi-step, tool-heavy work a business wants automated — and Muse Spark 1.1 scores 54.7 to Opus 4.8's 48.4 and GPT-5.5's 38.3. It's weaker on pure coding, and on OSWorld-Verified computer use it lands at 80.8 behind Opus 4.8's 83.4. It's not the smartest model in the room; it's the one tuned to do work and priced to be run at volume. ;; Should I route agent workloads to it? | It's now a real option if your workload is tool-heavy professional automation and you care about cost: cheaper than Opus-class models, a 1M-token window, and the JobBench lead all argue for it. The tradeoff is that it's an API dependency, not weights you control — the exact thing Meta used to let you avoid. Benchmark it against your own task distribution before committing; leaderboard wins rarely transfer cleanly. ;; What's the broader takeaway for founders? | The open-model era isn't ending, but the frontier of agent capability is quietly going closed even at its most open vendor. Plan for a world where your cheapest strong agent model is a metered API you don't host — great for your bill, worse for your independence. Keep an abstraction layer between your agent and any single provider."
sources: "https://officechai.com/ai/muse-spark-1-1-benchmarks/ | OfficeChai — Meta announces Muse Spark 1.1, beats Claude Opus 4.8 and GPT-5.5 on some benchmarks (JobBench 54.7 vs 48.4 vs 38.3; OSWorld-Verified 80.8 vs 83.4) ;; https://www.datacamp.com/blog/muse-spark-1-1 | DataCamp — Muse Spark 1.1: Meta's agentic model and API (1M context, computer use, pricing) ;; https://felloai.com/muse-spark-1-1/ | Fello AI — Muse Spark 1.1: Meta's new coding and agentic AI (first paid model, benchmarks) ;; https://forklog.com/en/meta-launches-muse-spark-1-1-for-agent-tasks-and-coding/ | ForkLog — Meta launches Muse Spark 1.1 for agent tasks and coding ;; https://emergent.sh/news/muse-spark-1-1-launch | Emergent — Meta launches Muse Spark 1.1 and its first paid AI model API (pay-as-you-go $1.25/$4.25, $20 free credits)"
art:
  archetype: division
  mood: cold
  motif: "an open padlock rendered in the flat blue of an open-source badge, its shackle being drawn shut by a thin metered chain of coins — the word FREE fading on one side, a price tag emerging on the other"
---

Meta shipped Muse Spark 1.1 in the middle of July. The benchmarks are good, the price is low, and the reviews are hands-on and cheerful. Almost every write-up buries the one fact that actually matters: **there is no weights file.** Muse Spark 1.1 is Meta's first paid, API-only model. You pay per token to call it, the way you pay OpenAI and Anthropic, and you cannot download it and run it yourself.

For any other company that would be a footnote. For Meta it is the story.

## The company that made "open" a weapon

Llama was not just a model line. It was a strategy and an argument: that the way to win in AI was to give the weights away, seed an ecosystem, and let a thousand fine-tunes bloom while your competitors metered access by the token. "Download the weights" became a rallying cry, a moral position, and a moat all at once. Meta spent three years being the loudest voice in the room for open models.

Muse Spark 1.1 quietly sets that voice down. It is pay-as-you-go — roughly $1.25 per million input tokens and $4.25 per million output, with $20 of free credits to get you hooked — on a one-million-token context window with active compaction. It is an API. It is closed. And it is, by Meta's own framing, the best model the company has ever built for the thing that matters most commercially right now: doing work.

>> The open-model era isn't ending. But the frontier of agent capability is going closed even at its most open vendor.

## The benchmark is the business plan

Watch which number Meta chose to lead with. Not a general-reasoning score, not a coding crown — Muse Spark 1.1 is middling on pure coding, and on OSWorld-Verified computer use it posts 80.8, behind Claude Opus 4.8's 83.4. The headline is **JobBench**, which measures professional tool use: multi-step, tool-heavy tasks of the kind a business wants automated. There, Muse Spark 1.1 scores 54.7 against Opus 4.8's 48.4 and GPT-5.5's 38.3. That is not a nose ahead. That is a lap.

A benchmark a company leads with is a customer it is naming. Meta did not build the smartest model; it built the one that finishes office work, and it priced that model to be run at volume. Researchers download weights. Businesses buy throughput. Muse Spark 1.1 is aimed squarely at the second group, and its whole shape — cheap per token, huge context, tuned for tool use, no weights to bother self-hosting — is designed to make automating a workflow a line item instead of a project.

## Why even Meta closed the door

The uncomfortable read is the simplest one. Base models have commoditized; a capable general model is nearly free and getting freer. Agent capability has not. The ability to reliably chain tools, hold a million tokens of task context, and drive a browser to completion is where the willingness-to-pay still lives — and it monetizes per token, per task, per seat. Giving that away as weights would be giving away the one thing customers will still pay for. So Meta didn't.

If you want the pricing tactics — when Muse Spark's quarter-price tier actually lowers your bill and when it doesn't — we covered that in [Muse Spark's API is a quarter of the price](/posts/muse-spark-api-quarter-price-when-it-lowers-your-bill.html), and where it fits in a routing table in [Terra vs Muse Spark vs Grok](/posts/terra-vs-muse-spark-vs-grok-cheap-agent-model-routing.html).

## What it means if you're building

Two things, and they pull against each other.

The opportunity: Muse Spark 1.1 is a genuinely strong, genuinely cheap option for tool-heavy professional automation. If that's your workload, it belongs in your routing table today — benchmark it against your own task distribution first, because leaderboard wins rarely transfer cleanly, but the JobBench margin is large enough to take seriously.

The warning: your cheapest frontier-*agent* option is now a metered API you don't control, from the vendor who used to guarantee you'd never be in that position. Plan for a world where that's the norm. Keep an abstraction layer between your agent and any single provider, so that when the next "first paid model" ships, switching is a config change and not a rewrite. The weights may keep flowing for last year's capability. The frontier is going behind the meter.
