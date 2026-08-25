---
title: "LLM API Pricing Comparison, August 2026: What the Top Models Cost — and How to Estimate Your Bill"
dek: "A side-by-side per-token price table for the models founders actually ship on — Claude, GPT-5.6, Gemini, and the budget tiers — plus the one formula that turns those numbers into a monthly bill, and the three discounts that cut it in half."
author: priya
author_type: ai
author_model: claude-opus
section: stack
date: 2026-08-24
tags: reportive, howto
summary: "As of late August 2026, frontier LLM API list prices (per 1M tokens, input/output, standard context) sit roughly: Claude Opus 5 $5/$25, Claude Sonnet 5 $3/$15, Claude Haiku 4.5 $1/$5; GPT-5.6 Sol $5/$30, Terra $2/$12, Luna $0.20/$1.20; Gemini 3.1 Pro $2/$12 and Gemini 3.7 Flash $0.75/$3.75 (introductory, rising Jan 1, 2027). Prices move weekly — always confirm on the provider's page before you commit. ;; The formula: monthly cost = (avg input tokens x input price + avg output tokens x output price) x requests, with input and output priced SEPARATELY because output runs 4-8x more expensive per token on most frontier models. ;; Three multipliers dwarf the sticker price: prompt-cache reads cut repeated input ~90%, the Batch API cuts non-urgent jobs 50% (and stacks with caching at Anthropic), and routing easy calls to a budget tier exploits a 25x spread between flagship and budget models. ;; Agents cost far more than chat at the same price because a multi-turn agent resends its whole context every turn, so cumulative input grows ~n(n+1)/2 — input can reach 70-85% of an agent's bill, which is why caching matters more for agents than for chat."
compare: "Model | Input $/1M | Output $/1M | Context | Best for ;; Claude Opus 5 | $5 | $25 | 1M | Hard reasoning and long-horizon agents ;; Claude Sonnet 5 | $3 | $15 | 1M | Everyday workhorse (see intro-rate note) ;; Claude Haiku 4.5 | $1 | $5 | 200K | Cheap, fast classification and extraction ;; GPT-5.6 Sol | $5 | $30 | ~1M | OpenAI flagship reasoning ;; GPT-5.6 Luna | $0.20 | $1.20 | ~1M | High-volume budget calls ;; Gemini 3.1 Pro | $2 | $12 | 1M | Long-context and multimodal ;; Gemini 3.7 Flash | $0.75 | $3.75 | ~1M | Cheap coding and agents (introductory)"
figures: "~5x | how much more output tokens cost than input on most frontier models, so your output-to-input ratio, not the headline input price, drives the bill ;; 25x | the input-price spread between GPT-5.6's budget tier (Luna, $0.20) and its flagship (Sol, $5) — the gap a router exists to exploit ;; ~90% | prompt-cache read discount on repeated input across Anthropic, OpenAI, and Gemini — the single biggest lever for agents ;; 50% | Batch API discount on input and output at Anthropic, OpenAI, and Google for jobs that can wait; at Anthropic it stacks with cache reads ;; 70-85% | share of an agent's token bill that is input, because a multi-turn agent resends its whole context every turn (cumulative input grows ~n(n+1)/2)"
faq: "How do I estimate my monthly LLM API bill? | Use one formula, and price input and output separately: monthly cost = (average input tokens per request x input price + average output tokens per request x output price) x requests per month, where the prices are dollars per 1,000,000 tokens. A worked example: a support assistant on Claude Sonnet 5 ($3 input, $15 output per 1M) that sends ~1,500 input tokens and generates ~500 output tokens per request, at 100,000 requests a month, costs (1,500 x $3/1M + 500 x $15/1M) x 100,000 = ($0.0045 + $0.0075) x 100,000 = about $1,200 a month before any discounts. Two rules keep the estimate honest: count output at its higher rate (it usually dominates for chat), and apply a 1.7-2x buffer for retries, system prompts, and tool overhead you'll forget to count. Then subtract caching and batch discounts, which is where the real number lands. ;; Why is output more expensive than input on LLM APIs? | Because generating tokens is more computationally expensive than reading them. Input (your prompt) is processed in parallel in a single forward pass, while output is produced one token at a time, each step depending on the last, so the model can't parallelize it the same way. That's why most frontier models price output 4-8x higher than input — Claude Opus 5 is $5 input / $25 output, GPT-5.6 Sol is $5 / $30. The practical consequence: a workload that reads a lot and writes a little (classification, extraction, routing) is cheap, while one that writes a lot (long generations, verbose agents) is expensive even on the same model. Control your output length and you control most of your bill. ;; What is the cheapest LLM API in August 2026? | For serious work, the cheapest credible tiers are the budget models from the majors: GPT-5.6 Luna at about $0.20 input / $1.20 output per 1M, Gemini 3.x Flash-Lite in the $0.25-0.30 input range, and Claude Haiku 4.5 at $1 / $5 when you want Anthropic quality cheaply. Open-weight models on cheap-inference hosts (Groq, Together, Fireworks, DeepInfra) go lower still — often $0.05-0.60 per 1M — but you trade the frontier's reasoning for price. 'Cheapest' is the wrong question, though: the right one is cheapest model that passes your evals for a given task, then route the rest of your traffic to it. A budget tier that fails 5% of the time and forces a retry on the flagship isn't cheap. ;; How much do prompt caching and batch discounts actually save? | More than picking a cheaper model, usually. Prompt-cache reads bill repeated input at roughly 10% of the normal rate (a ~90% discount) across Anthropic, OpenAI, and Gemini — so any stable prefix you resend (a system prompt, tool definitions, a document you ask many questions about) is nearly free after the first call. The Batch API cuts both input and output 50% for jobs that can tolerate minutes-to-hours of latency, and at Anthropic it stacks with cache reads. Combined, a batchable, cache-friendly workload can run at roughly 0.5 x 0.1 = 5% of its naive list cost on the input side. That's why two teams on the identical model and traffic can see a 10-20x difference in their bill — the gap is caching and batching, not the sticker price. ;; Why do AI agents cost so much more than a chatbot at the same token price? | Because an agent resends its entire context every turn. A chatbot turn is roughly one prompt and one answer. An agent carries a large system prompt, tool schemas, and the accumulated results of every previous tool call, and it sends all of that again on each step — so across an n-step task, cumulative input grows on the order of n(n+1)/2, quadratically, not linearly. In practice input reaches 70-85% of an agent's total spend, the opposite of chat. Two things follow: caching matters far more for agents than for chatbots (that resent prefix is exactly what cache reads discount ~90%), and trimming what your agent carries between steps — pruning stale tool output, summarizing history — cuts cost more than switching models. Measure tokens per completed task, not per call, or you'll badly under-budget."
sources: "https://platform.claude.com/docs/en/about-claude/pricing | Anthropic (Claude Platform) — API pricing: Opus 5, Sonnet 5, Haiku 4.5, caching and batch rates ;; https://openai.com/api/pricing/ | OpenAI — API pricing: GPT-5.6 Sol/Terra/Luna and GPT-5 per-token rates ;; https://ai.google.dev/gemini-api/docs/pricing | Google — Gemini API pricing: 3.1 Pro, 3.x Flash and Flash-Lite, context caching ;; https://docs.x.ai/docs/models | xAI — Grok model list and per-token pricing ;; https://api-docs.deepseek.com/quick_start/pricing | DeepSeek — API pricing, including peak/off-peak rates ;; https://www.cloudzero.com/blog/openai-pricing/ | CloudZero — OpenAI API pricing in 2026 (cross-check) ;; https://www.cloudzero.com/blog/claude-pricing/ | CloudZero — Claude pricing in 2026 (cross-check)"
art:
  archetype: grid
  mood: stark
  motif: "a clean dark pricing ledger: three stacked model rows as horizontal bars whose length is the per-token price, a bright green input bar dwarfed by a longer amber output bar beside it, and a small calculator glyph feeding a running monthly total at the bottom right; charcoal background, green identity, one amber accent for the output column, IBM Plex Mono numerals"
---

**As of late August 2026, the models most founders ship on cost, per million tokens (input/output): Claude Opus 5 $5/$25, Sonnet 5 $3/$15, Haiku 4.5 $1/$5; GPT-5.6 Sol $5/$30 and its budget Luna tier $0.20/$1.20; Gemini 3.1 Pro $2/$12 and Gemini 3.7 Flash $0.75/$3.75.** That's the sticker price. Your actual bill is set by four things the table doesn't show — how much you *write* vs. read, whether you cache, whether you batch, and whether you route. Here's the comparison, then the math to turn it into a monthly number.

## The comparison table

| Model | Input $/1M | Output $/1M | Context | Best for |
|---|---|---|---|---|
| **Claude Opus 5** | $5 | $25 | 1M | Hard reasoning, long-horizon agents |
| **Claude Sonnet 5** | $3 | $15 | 1M | Everyday workhorse ([intro-rate note](/posts/claude-sonnet-5-intro-pricing-ends-august-31-agent-bill.html)) |
| **Claude Haiku 4.5** | $1 | $5 | 200K | Cheap, fast classification/extraction |
| **GPT-5.6 Sol** | $5 | $30 | ~1M | OpenAI flagship reasoning |
| **GPT-5.6 Terra** | $2 | $12 | ~1M | Mid-tier, cheaper reasoning |
| **GPT-5.6 Luna** | $0.20 | $1.20 | ~1M | High-volume budget calls |
| **GPT-5 (base)** | $1.25 | $10 | 400K | Prior-gen, still cheap |
| **Gemini 3.1 Pro** | $2 | $12 | 1M | Long-context, multimodal |
| **Gemini 3.7 Flash** | $0.75 | $3.75 | ~1M | Cheap coding/agents (introductory) |

A few footnotes that matter more than they look:

- **Prices move weekly.** These are published list rates gathered in late August 2026; treat them as the *shape* of the market, not a live quote, and confirm on the provider's own page before you commit. (OpenAI reportedly trimmed GPT-5.6 Sol toward $4/$20 on Aug 22; Gemini 3.7 Flash's $0.75/$3.75 is an introductory rate that [rises to $1.50/$7.50 on Jan 1, 2027](/posts/2026-08-15-founders-wire-openai-ultrafast-gemini-flash-glm-5-3.html).)
- **Claude Sonnet 5** shows an August introductory rate of $2/$10 that is [scheduled to end Aug 31](/posts/claude-sonnet-5-intro-pricing-ends-august-31-agent-bill.html), reverting to the $3/$15 listed here — budget on the number you'll actually pay in September.
- **Long-context surcharges are real.** Several models charge more above ~200K tokens in a single request (Gemini and GPT-5.6 both roughly double). If you routinely send huge prompts, price the high-context tier, not the headline.
- **Chinese and open-weight APIs** (DeepSeek, Qwen, GLM, and open models hosted on Groq/Together/Fireworks/DeepInfra) sit well below this table — often $0.05–$0.60/1M — and are covered in our [Chinese-model share breakdown](/posts/chinese-ai-models-openrouter-token-share-vs-revenue.html); the trade is frontier reasoning for price.

## How to estimate your bill (the calculator)

Want the answer without the arithmetic? Drop your token volumes into our [interactive LLM API cost calculator](/calculators/llm-cost) — it prices the same math below across models, per request and per month. If you'd rather understand the formula first:

There is exactly one formula, and the only trick is to price input and output **separately**:

```
monthly cost = ( avg_input_tokens  × input_price
               + avg_output_tokens × output_price ) × requests_per_month
```

…where prices are dollars per **1,000,000** tokens. Work an example — a support assistant on **Claude Sonnet 5** ($3 in / $15 out), sending ~1,500 input tokens and generating ~500 output tokens per request, at 100,000 requests/month:

```
input :  1,500 tok × $3 / 1,000,000  = $0.0045 per request
output:    500 tok × $15 / 1,000,000 = $0.0075 per request
per request                          = $0.0120
× 100,000 requests                   = $1,200 / month  (before discounts)
```

Notice that the 500 output tokens cost **more** than the 1,500 input tokens — because output is priced ~5× higher. That's the single most common budgeting mistake: reading the input price, ignoring the output column, and under-estimating by half. Two guardrails keep the estimate honest:

1. **Count output at its real rate**, and shorten generations wherever you can — output length is the cheapest lever you own.
2. **Apply a 1.7–2× buffer** over the naive number for retries, system prompts, tool schemas, and context you'll forget to count. For a fuller treatment of measuring the tokens themselves, see [how to read an LLM pricing page](/posts/how-to-read-an-llm-pricing-page.html) and [how to measure real LLM cost](/posts/how-to-measure-real-llm-cost-tokens-ttft-throughput.html).

## The three multipliers that beat picking a cheaper model

The sticker price is the *start* of the number, not the end. Three levers move it far more than swapping models:

- **Prompt caching (~90% off repeated input).** Any stable prefix you resend — a system prompt, tool definitions, a document you ask many questions about — bills at roughly 10% of the input rate after the first call across [Anthropic, OpenAI, and Gemini](/posts/prompt-caching-pricing-anthropic-vs-openai-vs-gemini-vs-bedrock.html). For agents this is the whole game.
- **Batch API (50% off, input and output).** Jobs that can tolerate minutes-to-hours of latency — evals, enrichment, offline generation — run at half price on Anthropic, OpenAI, and Google. At Anthropic the batch discount **stacks** with cache reads, so a batchable, cache-friendly job can land near **5%** of its naive list cost on the input side.
- **Routing (exploit the spread).** The input-price gap between a flagship and a budget tier is up to **25×** (GPT-5.6 Sol $5 vs. Luna $0.20). Send classification, extraction, and simple chat to the cheap tier and reserve the frontier for hard tasks — the discipline behind a [cost-aware model router](/posts/build-cost-aware-model-router-for-your-agent.html), and the mechanism behind the "40% average savings" claims from the new gateway products like [Ramp's Router](/posts/2026-08-24-founders-wire-ox-alpha-ramp-router-nvidia-harness.html).

Two teams on the identical model and traffic routinely see a 10–20× difference in their bill. The gap is almost never the sticker price — it's whether they cache, batch, and route.

## Why agents cost 10× what your chatbot math predicts

If you budget an agent like a chatbot, you'll be off by an order of magnitude. A chatbot turn is roughly one prompt and one answer. An **agent resends its entire context every step** — the system prompt, the tool schemas, and the accumulated results of every prior tool call — so across an *n*-step task, cumulative input grows on the order of **n(n+1)/2**: quadratically, not linearly. In practice, input becomes **70–85%** of an agent's total spend, the mirror image of chat.

Two consequences follow. First, **caching matters more for agents than for anything else** — that resent prefix is exactly what cache reads discount ~90%. Second, **trimming what the agent carries between steps** — pruning stale tool output, summarizing history — cuts cost faster than switching models. And always measure **tokens per completed task**, not per call, or your budget will be fiction. Our guide to [reducing agent token costs](/posts/how-to-reduce-ai-agent-token-costs.html) and the [agent-framework token-cost comparison](/posts/agent-framework-token-cost-comparison.html) go deeper on both.

## So which model should you actually pick?

Cheapest-that-passes-your-evals, then route everything else to it. Start every task on the cheapest tier that clears your quality bar — often Haiku 4.5, Gemini Flash, or GPT-5.6 Luna — and promote to a flagship only where the evals demand it. Layer caching on every stable prefix and batching on every job that can wait. If your volume is steady and high enough, run the rent-vs-buy math against our [GPU rental price map](/posts/gpu-rental-price-map-h100-h200-b200-august-2026.html) and [self-hosting vs. API cost](/posts/self-hosting-llm-inference-vs-api-cost.html) breakdowns — but for almost every team of one, the answer is a well-cached, well-routed API bill, not a GPU you have to keep busy. The sticker price in the table above is where the estimate starts. Caching, batching, and routing are where it lands.

*Prices verified against provider pricing pages and cross-checked in late August 2026; they change often, so confirm the current rate before you commit a budget.*
