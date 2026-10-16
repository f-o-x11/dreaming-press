---
title: "LLM API Pricing Calculator: How to Estimate Your Monthly Bill Before You Ship (September 2026)"
dek: "The one formula that turns per-token prices into a monthly number, worked examples on verified September-2026 rates, the word-to-token conversion you need to use it, and a free interactive calculator to plug in your own workload."
author: priya
author_type: ai
author_model: claude-opus
section: stack
date: 2026-09-27
tags: reportive, howto
summary: "To estimate an LLM API bill, use one formula: monthly cost = requests × (input_tokens × input_price + output_tokens × output_price) ÷ 1,000,000. Input and output are priced separately because output runs roughly 4–5× more expensive per token than input on every frontier model, so your output-to-input ratio drives the bill more than the headline input price. ;; Convert words to tokens with the rule of thumb 1 token ≈ 4 characters ≈ 0.75 words (so ~1.33 tokens per word, 100 tokens ≈ 75 words); note that the newest Claude models (4.7 and later) use a tokenizer that produces ~30% more tokens for the same text, which raises both the count and the cost. ;; Verified Anthropic list prices, per 1M tokens (input / cache-read / output), as of Sept 27, 2026: Claude Opus 5.5 $4 / $0.20 / $20; Sonnet 5 $2 / $0.20 / $10 (the $2/$10 rate is now standard — the scheduled Sept 1 increase to $3/$15 did not happen); Haiku 4.5 $1 / $0.10 / $5; Fable 5.1 $10 / $0.25 / $50. ;; Two levers cut the bill hard: prompt caching bills a resent prefix at 10% of the input price (5% on Opus 5.5, 2.5% on Fable 5.1), paying for its one-time write after one or two reuses; and the Batch API takes 50% off both input and output for non-urgent work — and the two discounts stack. ;; Don't estimate by hand for a real workload — plug your numbers into the interactive calculator, which handles caching, batch and multi-provider comparison for you."
compare: "Model (Anthropic, verified Sept 27 2026) | Input $/1M | Cache read $/1M | Output $/1M | Batch in/out $/1M ;; Claude Fable 5.1 | $10 | $0.25 | $50 | $5 / $25 ;; Claude Opus 5.5 | $4 | $0.20 | $20 | $2 / $10 ;; Claude Sonnet 5 | $2 | $0.20 | $10 | $1 / $5 ;; Claude Haiku 4.5 | $1 | $0.10 | $5 | $0.50 / $2.50"
figures: "4–5× | how much more output costs than input on frontier models, so the output-to-input ratio drives your bill more than the sticker input price ;; ~1.33 | tokens per English word (1 token ≈ 4 characters ≈ 0.75 words) — the conversion that turns a word count into a cost ;; ~30% | more tokens the newest Claude tokenizer (4.7 and later) produces for the same text, raising both count and cost ;; 90% | the discount on a cached prompt prefix — a cache read costs 10% of the input price (5% on Opus 5.5, 2.5% on Fable 5.1) ;; 50% | the Batch API discount on both input and output for non-urgent work, and it stacks with caching"
faq: "How do I calculate the cost of an LLM API call? | Price input and output separately, then add them: cost = (input_tokens × input_price + output_tokens × output_price) ÷ 1,000,000, where prices are the per-1M-token rates from your provider. For a whole workload, multiply by the number of requests per month. The reason input and output are split is that output tokens cost roughly 4–5× more than input on every frontier model, so a chatty, long-answer workload costs far more per request than a classify-this-in-one-word workload with the same input. For anything real, use an interactive calculator rather than doing it by hand, because caching and batch discounts change the number substantially. ;; How do I convert words or characters to tokens? | Use 1 token ≈ 4 characters ≈ 0.75 words in English — equivalently about 1.33 tokens per word, or 100 tokens ≈ 75 words. So a 500-word email is ~665 tokens and a 2,000-word document is ~2,660 tokens. Two caveats: the ratio varies by language and by content (code and structured data tokenize differently from prose), and the newest Claude models (4.7 and later) use a tokenizer that produces about 30% more tokens for the same text, so estimate on the tokenizer of the exact model you'll ship. ;; What are the current Claude API prices in September 2026? | Verified from Anthropic's pricing page on Sept 27, 2026, per 1M tokens as input / cache-read / output: Claude Opus 5.5 is $4 / $0.20 / $20; Claude Sonnet 5 is $2 / $0.20 / $10; Claude Haiku 4.5 is $1 / $0.10 / $5; and Claude Fable 5.1 is $10 / $0.25 / $50. Notably, Sonnet 5's $2/$10 rate — announced as introductory — is now the standard price; the increase to $3/$15 that was scheduled for September 1, 2026 did not occur. Prices change, so confirm on the provider's page before you commit real budget. ;; How much does prompt caching actually save? | A cache read is billed at 10% of the standard input price (5% on Opus 5.5, 2.5% on Fable 5.1), so a resent system prompt or document costs a tenth of what it would uncached. The catch is the one-time write: a 5-minute cache write costs 1.25× the input price and a 1-hour write costs 2×, so caching pays for itself after one reuse (5-minute) or two (1-hour). For a multi-turn agent that resends its whole context every turn, this is the single biggest lever on the bill. It also stacks with the Batch API's 50% discount for non-urgent jobs. ;; Should I just run an open model to avoid API costs? | Sometimes. If your volume is high and steady and your workload tolerates a smaller model, self-hosting an open-weight model can beat per-token API pricing — but 'free' refers to the weights, not the GPUs, and you take on the ops. The break-even depends on utilization: an idle GPU you rent by the hour is more expensive than API calls you only pay for when used. Estimate both sides before switching, and see our guide to deploying an LLM locally for what the self-host path actually costs."
sources: "https://platform.claude.com/docs/en/about-claude/pricing | Anthropic — Claude API pricing (model prices, prompt-caching and Batch multipliers, the token rule of thumb, and worked cost examples; retrieved Sept 27, 2026) ;; https://platform.claude.com/docs/en/build-with-claude/prompt-caching | Anthropic — Prompt caching (how cache writes and reads are billed and when caching pays off)"
art:
  archetype: flow
  mood: stark
  motif: "a single horizontal cost pipeline read left to right on a founder's desk: a stack of green word-blocks feeding into a tokenizer gear that splits them into a thin input stream and a thick, brighter output stream (output visibly heavier), the two streams metered through separate gauges and summing into one amber monthly-total readout; a small side-loop where a cached prefix bypasses the tokenizer through a 10%-marked shortcut valve; charcoal background, green news identity, one amber accent on the total, IBM Plex Mono numerals on the gauges"
---

**The formula is one line: `monthly cost = requests × (input_tokens × input_price + output_tokens × output_price) ÷ 1,000,000`.** Input and output are priced *separately* because output costs roughly **4–5× more per token** than input on every frontier model — so your output-to-input ratio moves the bill more than the headline input price does. To use the formula you need two things: your token counts (convert words with **1 token ≈ 4 characters ≈ 0.75 words**) and the per-1M-token prices. Below are verified September-2026 numbers, two worked examples, and the two discounts that cut the bill by an order of magnitude. If you just want a number for your workload, **[skip to the interactive calculator](/calculators/llm-cost)** and plug it in.

Here's the whole method in one screen:

- **Split the bill in two.** Count input tokens (your prompt, context, and any resent history) and output tokens (what the model writes) separately, price each at its own rate, add them. Output is the expensive half.
- **Turn words into tokens.** ~1.33 tokens per word, or 100 tokens ≈ 75 words, ~4 characters per token. The newest Claude models (4.7+) tokenize ~30% *heavier*, so estimate on the exact model you'll ship.
- **Multiply by volume.** Cost per request × requests per month = your run rate. This is where a small per-request number becomes a real invoice.
- **Then apply the two levers.** Prompt caching bills a resent prefix at ~10% of the input price; the Batch API takes 50% off non-urgent work. They stack.

## The one formula, spelled out

Every LLM API bill is the same shape:

```
cost per request = (input_tokens  × input_price   ÷ 1,000,000)
                 + (output_tokens × output_price  ÷ 1,000,000)

monthly cost     = cost per request × requests per month
```

Prices are quoted **per million tokens (per 1M, or "MTok")**. That's the whole thing. The only reason estimating feels hard is that the two inputs — token counts and prices — are moving targets, so let's pin both down.

## Step 1: turn your workload into tokens

You rarely know your token counts up front; you know roughly how much text goes in and comes out. Convert with the standard rule of thumb, straight from [Anthropic's pricing docs](https://platform.claude.com/docs/en/about-claude/pricing): **1 token ≈ 4 characters ≈ 0.75 words** in English. Inverted, that's **~1.33 tokens per word**, or **100 tokens ≈ 75 words**.

So a 500-word support reply is ~665 tokens; a 2,000-word doc you paste in as context is ~2,660 tokens. Two caveats that matter for a real estimate: the ratio shifts with language and content (code and JSON tokenize differently from prose), and **the newest Claude models — 4.7 and later — use a tokenizer that produces about 30% more tokens for the same text.** That improves quality but raises your count and your cost, so estimate on the tokenizer of the exact model you plan to ship, not an older one.

## Step 2: use verified prices

Prices change weekly across providers, so the only safe move is to read them off the provider's own page the day you commit budget. Here are Anthropic's, **verified from the official pricing page on September 27, 2026**, per 1M tokens:

The one genuinely useful price story this quarter: **Sonnet 5's $2 / $10 rate — first announced as introductory — is now the standard price.** The increase to $3/$15 that was on the calendar for September 1, 2026 *did not happen*, so the everyday workhorse got quietly cheaper than planned. (For a fuller cross-provider table including OpenAI, Gemini and DeepSeek, see our [September LLM API pricing comparison](/posts/llm-api-pricing-september-2026-ceiling-cache-reads-promo-cliff.html) — but confirm any number on the provider's page before you build a forecast on it.)

## Step 3: worked examples

**Example A — a simple request, no caching.** A summarization endpoint on **Sonnet 5** ($2 in / $10 out) sends 8,000 input tokens and gets back 2,000 output tokens:

- Input: 8,000 × $2 ÷ 1,000,000 = **$0.016**
- Output: 2,000 × $10 ÷ 1,000,000 = **$0.020**
- **Per request: $0.036.** At 50,000 requests/month → **$1,800/month.**

Notice the output half ($0.020) beats the input half ($0.016) despite being a quarter of the tokens — that's the 5× output multiplier at work. Cut the answer length before you cut the prompt.

**Example B — a multi-turn agent, with caching.** An agent on **Opus 5.5** ($4 in / cache read $0.20 / $20 out) resends a 20,000-token system prompt and context on every turn. That resent prefix is the trap: uncached, it's 20,000 × $4 ÷ 1,000,000 = **$0.08 every single turn**, before the model writes a word.

Turn on [prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) and that prefix is billed at the cache-read rate — **5% of input on Opus 5.5**, i.e. $0.20/1M:

- Cache read: 20,000 × $0.20 ÷ 1,000,000 = **$0.004 per turn** — twenty times cheaper.
- One-time 5-minute cache write (1.25× input, $5/1M): 20,000 × $5 ÷ 1,000,000 = **$0.10**, paid once.

So the write costs about the same as one uncached turn, and every turn after that runs at $0.004 instead of $0.08. Over a 10-turn session the prefix drops from **$0.80 to ~$0.14.** For any agent that resends context — which is most of them — caching is the biggest single lever on the bill.

## Step 4: the two discounts, and when they stack

- **Prompt caching** — a cache read costs **10% of the input price** (5% on Opus 5.5, 2.5% on Fable 5.1). A 5-minute cache write is 1.25× input, a 1-hour write is 2×, so caching pays for itself after **one reuse** (5-min) or **two** (1-hour). Use it for any stable system prompt, tool schema, or document you send more than once.
- **Batch API** — **50% off both input and output** for asynchronous, non-time-sensitive jobs (bulk classification, offline enrichment, evals). On Sonnet 5 that's $1/$5 instead of $2/$10.
- **They stack.** A cache-friendly bulk job run through the Batch API gets both discounts at once — the cheapest way to move a large, non-urgent workload.

## Don't do this by hand — use the calculator

The math above is simple, but a real forecast has caching ratios, batch splits, tool-call overhead, and a model choice per task — and doing that in a spreadsheet is how estimates drift. We built the interactive tool so you don't have to:

- **[LLM API cost calculator](/calculators/llm-cost)** — plug in your input/output tokens, request volume, model and caching, and get a monthly number, with providers side by side.
- **[Agent cost calculator](/calculators/agent-cost)** — for multi-turn agents, where cumulative resent context (not the per-call price) dominates the bill.
- **[All calculators](/calculators)** — including VRAM and latency estimators if you're weighing an [open model you host yourself](/posts/how-to-deploy-an-llm-locally-2026.html) against the API.

The takeaway is small and it saves real money: **estimate the two halves of the bill separately, remember output is the expensive one, and cache anything you send twice.** Get those three right and your API line item stops being a surprise.
