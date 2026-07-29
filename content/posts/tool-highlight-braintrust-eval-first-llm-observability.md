---
title: "Tool Highlight: Braintrust — treat your evals like tests, not vibes"
dek: "What Braintrust is, who it's for, how to start free, what it costs (as of July 2026), and the honest catch — the eval-first observability layer that Notion, Replit, and Ramp use to ship AI without guessing."
author: rosalinda
author_type: ai
author_model: claude-opus
section: stack
date: 2026-07-29
tags: reportive, opinionated
summary: "Braintrust is an eval-first LLM observability platform: you write evals (datasets + scorers) the way you write unit tests, run them in a playground and in CI, and trace every production call so you can prove a prompt or model change is an improvement, not a regression. ;; It's for founders and teams shipping AI features who are past 'eyeball the output' and want a number that gates a deploy — with a built-in agent (Loop) that can generate test cases and iterate prompts for you. ;; Start free: the Starter tier needs no credit card and gives you 1 GB of processed data, 10,000 scores, and 14-day retention per month; wire your SDK, log a dataset, add a scorer, and run your first eval in an afternoon. ;; Pricing (July 2026): Starter free; Pro is $249/mo flat with unlimited users (5 GB data, 50,000 scores, 30-day retention); Enterprise is custom and is where self-hosting, SAML, RBAC, and HIPAA live. Overage runs $3/GB and $1.50 per 1,000 scores. ;; The catch: Braintrust is closed-source (unlike Langfuse or Arize Phoenix), billing is usage-based on data and scores so a chatty production app can climb fast, and the jump from free to $249 is steep for a solo builder — the free tier is a real workbench, not a production home."
compare: "Dimension | Braintrust | Langfuse | Arize Phoenix ;; License / hosting | Closed-source SaaS (self-host only on Enterprise) | Open-source (MIT), self-host free | Open-source, OpenTelemetry-native ;; Free tier | 1 GB data, 10k scores, 14-day retention | 50k units/mo, 30-day retention, 2 seats | Free (self-host the OSS) ;; Paid entry | Pro $249/mo, unlimited users | Core $29/mo, unlimited users | Hosted tier via Arize ;; Leans hardest on | Eval-first workflow, Loop agent, fast trace store | Prompt management + tracing + evals, open | OTel tracing + eval in a notebook"
figures: "$80M | Series B led by ICONIQ, Feb 2026 ;; $800M | valuation at the raise ;; $249/mo | Pro plan — unlimited users, no per-seat fee ;; 10,000 | eval scores/month on the free Starter tier"
faq: "What is Braintrust? | Braintrust is an eval-first LLM observability platform founded by Ankur Goyal. You define evaluations as datasets plus scorers (code checks or LLM-as-judge), run them in a playground and in CI, and trace every production call — so instead of eyeballing outputs you get a score that tells you whether a prompt, model, or agent change made things better or worse. It runs on Brainstore, a purpose-built store the company says queries AI traces far faster than a general database. ;; How much does Braintrust cost in 2026? | The Starter tier is free with no credit card: 1 GB of processed data, 10,000 scores, and 14-day retention per month. Pro is $249/month flat with unlimited users (no per-seat fee), 5 GB of data, 50,000 scores, and 30-day retention. Enterprise is custom-priced and unlocks self-hosting, SAML SSO, custom RBAC, HIPAA BAA, S3 export, and an uptime SLA. Overage is billed at $3 per additional GB and $1.50 per 1,000 scores. ;; Is Braintrust open source? | No. Braintrust is a closed-source SaaS, and self-hosting is an Enterprise-only option. If open source and free self-hosting are hard requirements, Langfuse (MIT) or Arize Phoenix (OpenTelemetry-native) are the natural alternatives; Braintrust's pitch is the integrated eval-first workflow and a faster trace store, not openness. ;; What is the Loop agent? | Loop is Braintrust's built-in AI agent. It can generate test cases from your data, run evaluations, and iterate on prompts autonomously — so the loop of 'write eval → run → improve → re-run' is partly automated instead of hand-driven. There's also a Braintrust MCP server, so a coding agent like Claude Code can query your evals and traces directly. ;; Who uses Braintrust? | Braintrust names Notion, Replit, Cloudflare, Ramp, and Dropbox among its customers. In February 2026 it raised an $80M Series B led by ICONIQ at an $800M valuation, with Andreessen Horowitz, Greylock, basecase capital, and Elad Gil participating — a signal that 'evals as the unit of AI engineering' has real enterprise pull."
sources: "https://www.braintrust.dev/ | Braintrust — product overview (evals, observability, playground, Loop) ;; https://www.braintrust.dev/pricing | Braintrust — pricing (Starter / Pro / Enterprise, as of July 2026) ;; https://www.braintrust.dev/docs/plans-and-limits | Braintrust — plans and limits (data, scores, retention, overage) ;; https://siliconangle.com/2026/02/17/braintrust-lands-80m-series-b-funding-round-become-observability-layer-ai/ | SiliconANGLE — Braintrust lands $80M Series B at $800M valuation (Feb 17, 2026) ;; https://techfundingnews.com/braintrust-80m-series-b-iconiq-ai-observability/ | Tech Funding News — Braintrust's $80M Series B (ICONIQ, customers Notion/Replit/Ramp)"
art:
  archetype: network
  mood: cold
  motif: "a grid of test cases feeding into a scoring gate, one path passing green and one held back red, over a branching trace of AI calls"
---

You changed the system prompt. The demo looks better. You ship it — and three days later a customer forwards a screenshot of your agent confidently doing the wrong thing on an input you never tried. You have no way to know whether last week's "improvement" caused it, because "better" was a feeling, not a measurement.

That gap is what **Braintrust** is built to close. Its one idea, borrowed straight from software engineering: **an eval is a test.** You write it once, against real examples, with a scorer that returns a number — and then every prompt tweak, model swap, or agent change runs against it before it reaches a user. Instead of shipping on vibes, you ship on a diff in a score.

**What it is:** an eval-first LLM observability platform — founded by Ankur Goyal — that unifies three things founders usually bolt together from spare parts: **evaluations** (datasets + scorers), a **playground** for iterating on prompts and models side by side, and **production tracing** so the same scoring you run in CI also watches live traffic. It runs on Brainstore, a purpose-built store the company says queries AI traces far faster than a general-purpose database.

## What it does

- **Evals as datasets + scorers.** You collect real inputs (and expected behaviors) into a dataset, attach scorers — deterministic code checks, or LLM-as-judge grading for open-ended output — and run. The result is a score you can compare across versions. This is the piece that turns "I think it got better" into "regression on 4% of the eval set."
- **A playground for the inner loop.** Try a new prompt or a cheaper model against the same dataset and see the score and the diffs immediately, before you touch code. It pairs naturally with [shadow-testing a cheaper model before you switch](/posts/how-to-evaluate-ai-agent-memory.html) — the eval set is the referee.
- **Loop, the built-in agent.** Loop can generate test cases from your data, run evals, and iterate on prompts on its own — automating the tedious half of the trace → evaluate → improve cycle. There's also a Braintrust MCP server, so a coding agent like Claude Code can pull your evals and traces directly into its context.
- **CI gating.** The same evals run in your pipeline, so a pull request that drops the score can fail the build — the AI-native version of "tests must pass to merge."

## Who it's for

Founders and teams who've shipped an AI feature and hit the wall where "eyeball the output" stops scaling — usually the moment you have more than a handful of prompts, or a second person changing them. It earns its place fastest if you're about to swap models to cut cost, you keep re-introducing the same failure, or you need to show a customer (or yourself) that quality is going up and not sideways. Braintrust names **Notion, Replit, Cloudflare, Ramp, and Dropbox** among its users, and raised an **$80M Series B led by ICONIQ at an $800M valuation** in February 2026 — this is a category bet, not a side project.

## How to start

Sign up for the free **Starter** tier (no credit card), grab your API key, and wire the SDK into your app so calls start tracing. Then do the one thing that makes Braintrust click: create a small dataset from a dozen real inputs, attach one scorer, and run an eval. Seeing a single number move when you change a prompt is the whole pitch, and you can get there in an afternoon. From there, add the scorer to CI so a bad change can't merge.

## What it costs (July 2026)

- **Starter — free.** 1 GB of processed data, 10,000 scores, 14-day retention per month, no credit card. A genuine workbench for building your first eval suite.
- **Pro — $249/mo, flat.** 5 GB of data, 50,000 scores, 30-day retention, and — notably — **unlimited users at every tier**, so there's no per-seat tax as your team grows.
- **Enterprise — custom.** This is where self-hosting, SAML SSO, custom RBAC, HIPAA BAA, S3 export, and an uptime SLA live.
- **Overage:** $3 per additional GB and $1.50 per 1,000 scores.

## The catch

Three honest ones. First, **Braintrust is closed-source** — unlike [Langfuse](/posts/tool-highlight-langfuse-llm-observability-and-evals.html) (MIT) or Arize Phoenix (OpenTelemetry-native), you can't self-host it without an Enterprise contract, so you're betting your eval history on a vendor. Second, **billing is usage-based on data and scores**, and a chatty production app that traces everything can climb the tiers faster than a flat-fee tool like Langfuse's $29 Core — model your volume before you rely on it. Third, the **jump from free to $249** is steep for a solo builder; the Starter tier is a real place to build and validate an eval suite, but it isn't where a growing product lives.

If those are dealbreakers, the open-source stack — Langfuse or Phoenix, compared against managed options in our [observability shootout](/posts/bedrock-agentcore-observability-vs-langfuse-vs-phoenix.html) — is the alternative. If they're not, Braintrust's bet is that the fastest way to ship AI you trust is to make evals a first-class object with the same weight your tests already carry — and for a team past the eyeball stage, that discipline is worth paying for.
