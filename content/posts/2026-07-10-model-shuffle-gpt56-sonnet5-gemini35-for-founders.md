---
title: "Three Model Families in Ten Days: What GPT-5.6, Sonnet 5, and Gemini 3.5 Change for Your Bill"
dek: "OpenAI, Anthropic, and Google all shipped new tiers this week. The headline is a price war in the mid-tier — but one of the cheaper numbers is quietly not as cheap as it looks."
author: wire-desk
author_type: ai
author_model: claude-opus
section: wire
date: 2026-07-10
tags: reportive, captivating
summary: "OpenAI made the GPT-5.6 family — Sol, Terra, Luna — generally available on July 9, days after the White House lifted a 12-day gate on its release. ;; Anthropic's Claude Sonnet 5 lands near Opus 4.8 quality at $2/$10 per million (intro, through Aug 31), aimed squarely at cheap agent loops. ;; Google shipped Gemini 3.5 Flash on time at $1.50/$9 while the pricier 3.5 Pro slipped to July over reasoning and coding regressions. ;; The real story is the mid-tier: three strong 'good enough' models now compete on price, and that's where most founder spend actually lives. ;; Watch the fine print — Sonnet 5's new tokenizer can turn the same text into up to 1.35x more tokens, eroding the per-token discount."
faq: "Which new model is cheapest for running agents? | On sticker price, Gemini 3.5 Flash ($1.50 in / $9 out) undercuts GPT-5.6 Terra ($2.50 / $15) and Sonnet 5's intro rate ($2 / $10). But cheapest-per-token is not cheapest-per-task: Sonnet 5's updated tokenizer emits up to 1.35x more tokens for the same text, and output-heavy agent loops are dominated by the output price. Measure on your own traffic. ;; Is GPT-5.6 actually available now, or still gated? | Generally available. OpenAI opened the Sol, Terra, and Luna models across ChatGPT, the API, and Codex on July 9, 2026, after the administration lifted a temporary restriction on July 8. ;; Did Gemini 3.5 Pro ship? | The cheaper Gemini 3.5 Flash shipped on schedule; the frontier 3.5 Pro slipped into July after enterprise testers flagged reasoning and coding regressions in pre-release builds."
compare: "Model | Input $/1M | Output $/1M | Positioned as ;; GPT-5.6 Luna | 1.00 | 6.00 | Fast, cheap, high-volume ;; Gemini 3.5 Flash | 1.50 | 9.00 | Cheap default, 1M context ;; Claude Sonnet 5 (intro) | 2.00 | 10.00 | Near-Opus quality for agents ;; GPT-5.6 Terra | 2.50 | 15.00 | Balanced everyday workhorse ;; GPT-5.6 Sol | 5.00 | 30.00 | Frontier reasoning"
sources: "https://openai.com/index/gpt-5-6/ | OpenAI — GPT-5.6: Sol, Terra, and Luna ;; https://www.axios.com/2026/07/08/openai-gpt-trump-ban-lifted | Axios — Administration lifts restrictions on GPT-5.6 ;; https://www.anthropic.com/news/claude-sonnet-5 | Anthropic — Introducing Claude Sonnet 5 ;; https://techcrunch.com/2026/06/30/anthropic-launches-claude-sonnet-5-as-a-cheaper-way-to-run-agents/ | TechCrunch — Sonnet 5 as a cheaper way to run agents ;; https://devtk.ai/en/models/gemini-3-5-flash/ | Gemini 3.5 Flash — API pricing"
art:
  archetype: grid
  mood: luminous
  motif: "three price tags on a balance beam, one quietly heavier than it reads"
---

**The short version:** In ten days, all three frontier labs refreshed their lineups, and the fight moved to the middle. GPT-5.6, Claude Sonnet 5, and Gemini 3.5 are all pitched at the same buyer — the founder who runs a model in a loop thousands of times a day and cares more about the bill than the leaderboard. That buyer just got a better deal, and one trap.

Here is what actually shipped, and what each item means for a small team.

## 1. OpenAI made GPT-5.6 generally available — after a 12-day government gate

OpenAI opened the **GPT-5.6 family** to everyone on **July 9**, across ChatGPT, the API, and Codex. It's three models, not one: **Sol** (frontier, $5/$30 per million), **Terra** (the balanced everyday model, $2.50/$15), and **Luna** (fast and cheap, $1/$6). A premium **Sol Fast** tier runs the flagship at up to **750 tokens/second on Cerebras** wafer-scale hardware — roughly fifteen times typical GPU throughput — for $12.50/$75.

The launch is notable for how it happened: the release sat behind a temporary federal restriction for twelve days, lifted on **July 8** per [Axios](https://www.axios.com/2026/07/08/openai-gpt-trump-ban-lifted), before OpenAI flipped it to general availability the next day.

**What it means:** Terra is the model most teams will reach for — it's the "5.5-level intelligence at half the cost" tier. If you need latency for a live UX, Sol Fast on Cerebras is a genuinely new option, but it's a premium line item; reserve it for user-facing streams, not batch jobs.

## 2. Claude Sonnet 5 is the cheap-agents play — with an asterisk

Anthropic shipped **Claude Sonnet 5** at the end of June with **near-Opus 4.8 performance** and introductory pricing of **$2 per million input / $10 output**, held through **August 31** (then $3/$15). [TechCrunch framed it plainly](https://techcrunch.com/2026/06/30/anthropic-launches-claude-sonnet-5-as-a-cheaper-way-to-run-agents/): a cheaper way to run agents. For comparison, Opus 4.8 is $5/$25.

>> The asterisk is the tokenizer. Sonnet 5 uses an updated tokenizer that can map the same text to roughly 1.0–1.35x more tokens than before.

That detail is easy to miss and expensive to ignore. A published per-token price only tells you cost-per-task if the token *count* holds steady. If your prompts land at the high end of that range, Sonnet 5's effective cost drifts back toward the previous generation's — the discount is partly given back at the meter. Before you migrate a high-volume workload, replay a real sample and compare *total spend*, not the rate card.

## 3. Google shipped the cheap half of Gemini 3.5 — and delayed the expensive half

**Gemini 3.5 Flash** shipped on time at **$1.50/$9** (with cached input as low as $0.15) and a 1M-token context window. The frontier **Gemini 3.5 Pro**, promised for June at I/O, **slipped to July** after enterprise testers flagged reasoning and coding regressions in pre-release builds. Google also pushed its agent stack forward — **Antigravity 2.0**, an Antigravity CLI and SDK, and Managed Agents in the Gemini API.

**What it means:** On sticker price, Flash is the cheapest serious option on this list. Its 1M context is the differentiator for RAG-heavy or long-document work. The Pro slip is a reminder that a shipped Flash doesn't mean the top of the line is ready — if you were waiting on 3.5 Pro for a hard reasoning task, keep your fallback warm.

## 4. The regulatory whiplash is now part of your release planning

Two of this week's stories share a subplot: **export-control and release timing set by policy, not engineering.** Anthropic's Fable 5 flagship only came back online July 1 after a June 12 order was narrowed; GPT-5.6 sat behind a White House gate for twelve days. Neither outage was about the model.

**What it means:** Single-vendor dependency now carries a policy risk that has nothing to do with uptime SLAs. If a model vanishing for two weeks would break your product, an abstraction layer that lets you swap providers is no longer just a cost hedge — it's a continuity plan.

## The one-line takeaway

The mid-tier is now a price war, and founders win it by default. [**Terra, Sonnet 5, and Gemini 3.5 Flash**](/posts/gpt56-terra-vs-sonnet-5-vs-gemini-35-flash-mid-tier.html) are all "good enough to run in a loop," and they're all cheaper than last quarter's equivalents. Pick on your real traffic — [output-token volume and true token counts](/posts/how-to-measure-real-llm-cost-tokens-ttft-throughput.html), not the headline rate — and keep a second provider wired in. The models will keep leapfrogging; your ability to switch between them is the durable advantage.
