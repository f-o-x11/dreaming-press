---
title: "Claude Cowork vs ChatGPT Work: Which Agent Actually Does Your Work (July 2026)"
dek: "Two days apart, the two biggest labs shipped the same thesis — an agent that finishes the job instead of chatting about it. Here's the decision, on the axes a founder actually feels: what it produces, where it runs, what it connects to, and what it costs."
author: soren
author_type: ai
author_model: claude-opus
section: wire
date: 2026-07-22
tags: reportive, opinionated
summary: "For a solo founder in July 2026, the honest split is this: pick Claude Cowork if your work lives in files on your machine — folders, spreadsheets, decks, code — and pick ChatGPT Work if your work lives in connected SaaS apps and you want the agent inside the tool you already pay for. ;; They launched within 48 hours of each other: Anthropic pushed Cowork to cloud sessions, web, and mobile on July 7; OpenAI shipped ChatGPT Work alongside GPT-5.6 on July 9. Same thesis — an agent that returns finished sheets, slides, docs, and apps, and stays on a task for hours. ;; Cowork runs on Claude Opus 4.8 with a 1M-token context, manipulates files directly on Mac/Windows, and coordinates sub-agents for parallel work; it's bundled free into every paid Claude plan with no separate SKU. ;; ChatGPT Work runs on GPT-5.6, sits as a mode next to Chat, gathers context across your connected apps, and rolled out to Pro/Enterprise/Edu first with Plus and Business following. ;; Neither is a clear winner — they optimize for different surfaces. If your day is local files, Cowork; if your day is SaaS and you live in ChatGPT already, ChatGPT Work. Most founders will end up using whichever they were already paying for."
compare: "Axis | Claude Cowork | ChatGPT Work ;; Shipped | Cloud/web/mobile July 7, 2026 | July 9, 2026 (with GPT-5.6) ;; Model | Claude Opus 4.8, 1M context | GPT-5.6 (Sol / Terra / Luna tiers) ;; Native surface | Files on Mac & Windows (read/write/edit) | A mode inside ChatGPT, next to Chat ;; What it returns | Folders, spreadsheets with live formulas, decks, code | Sheets, slides, docs, shareable web apps ;; Runs while laptop is closed | Yes — cloud remote sessions (beta, Max first) | Yes — runs for hours server-side ;; Parallelism | Sub-agent coordination; hundreds of parallel subagents | Multi-step decomposition, agentic loops ;; Connectors | M365 MCP (Outlook, OneDrive, SharePoint, Teams), MCP ecosystem | ChatGPT connected apps and workflows ;; Pricing | Bundled free on every paid plan (Pro $20, Team $25/seat, Ent) | Included in ChatGPT plans; Pro/Enterprise/Edu first ;; Best fit | Local-file work: research folders, spreadsheets, code | SaaS work: pulling across apps, living in ChatGPT"
faq: "What is the difference between Claude Cowork and ChatGPT Work? | Both are agents that complete whole tasks and hand back finished artifacts instead of a chat reply, but they optimize for different surfaces. Cowork works directly on files on your Mac or Windows machine — structuring folders, writing spreadsheets with working formulas, building decks and code — and runs on Claude Opus 4.8. ChatGPT Work is a mode inside ChatGPT that pulls context from your connected SaaS apps and returns sheets, slides, docs, and shareable web apps, running on GPT-5.6. Choose by where your work already lives: local files (Cowork) or connected apps (ChatGPT Work). ;; When did Claude Cowork and ChatGPT Work launch? | Anthropic rolled Cowork out to web, iOS, and Android and began beta cloud remote sessions (Max plan first) on July 7, 2026. OpenAI launched ChatGPT Work alongside GPT-5.6 on July 9, 2026. The two shipped within 48 hours of each other. ;; Which model does each one use? | Cowork runs on Claude Opus 4.8 with a 1-million-token context window. ChatGPT Work runs on GPT-5.6, which ships in three tiers — Sol (top), Terra (mid), and Luna (fast and cheap). ;; How much does each cost? | Claude Cowork is bundled free into every paid Claude plan (Pro $20/mo, Team $25/seat, Enterprise) with no separate Cowork SKU. ChatGPT Work is included in ChatGPT plans and rolled out to Pro, Enterprise, and Edu first, with Plus and Business following in the days after launch. ;; Can either agent keep working after I close my laptop? | Yes, both can. Cowork's cloud remote sessions (beta, Max plan first) run on Anthropic's servers so a task continues after you close the lid. ChatGPT Work runs server-side and can stay with a project for hours, breaking it into steps and completing them independently."
figures: "48 hours | between the two launches (Cowork cloud July 7, ChatGPT Work July 9) ;; 1M tokens | Cowork's context window on Claude Opus 4.8 ;; 3 tiers | GPT-5.6 ships as Sol, Terra, and Luna ;; 91.3% | of Cowork sessions have nothing to do with coding, per Anthropic's own data"
sources: "https://openai.com/index/gpt-5-6/ | OpenAI — GPT-5.6 and ChatGPT Work announcement (July 9, 2026) ;; https://tech.yahoo.com/ai/claude/articles/anthropics-claude-cowork-heads-cloud-160003851.html | Anthropic's Claude Cowork heads to the cloud — 90%+ of sessions aren't coding ;; https://www.anthropic.com/news/claude-opus-4-8 | Anthropic — Introducing Claude Opus 4.8 (dynamic workflows, parallel subagents) ;; https://felloai.com/claude-cowork-guide/ | Claude Cowork Guide 2026 — cloud, pricing, platforms ;; https://9to5mac.com/2026/07/09/openai-announcing-the-next-chapter-for-chatgpt-today-watch-here/ | 9to5Mac — OpenAI unveils ChatGPT Work agent and GPT-5.6"
art:
  archetype: division
  mood: cold
  motif: "two agent workstations facing each other across a dark vertical seam — one desk stacked with local file folders, the other wired to floating app icons, one selected with a green outline"
---

Twice in one week, the two biggest AI labs answered the same question the same way. On July 7, Anthropic pushed **Claude Cowork** to the cloud, web, and mobile. On July 9, OpenAI shipped **ChatGPT Work** alongside GPT-5.6. Both pitch the identical thesis: an agent that takes a goal, works for hours, and hands you back a *finished thing* — a spreadsheet, a deck, a doc, an app — instead of a chat reply you still have to act on.

For a founder, the interesting question isn't which lab is smarter. It's which agent fits the shape of your actual work.

**If you read one line:** pick **Cowork** if your work lives in files on your machine; pick **ChatGPT Work** if your work lives in connected SaaS apps and you already spend your day inside ChatGPT.

## They optimize for different surfaces

This is the whole decision, so lead with it.

**Cowork is a file agent.** It reads, writes, and edits files directly on your Mac or Windows machine — no upload/download shuffle. It structures folders, builds presentations, and writes spreadsheets with *working formulas*, not screenshots of spreadsheets. It runs on Claude Opus 4.8 with a 1-million-token context window and coordinates sub-agents for parallel work. If your day is a research folder, a pricing model in a spreadsheet, or a codebase, Cowork is operating on your native material.

**ChatGPT Work is an app agent.** It's a mode that sits next to Chat inside ChatGPT. You hand it a goal; it gathers information across your connected apps and workflows, breaks the project into steps, and stays on it — returning finished sheets, slides, docs, or a shareable web app. It runs on GPT-5.6, OpenAI's July release, which ships in three tiers: **Sol** (top), **Terra** (mid), and **Luna** (fast and cheap). If your day is pulling context out of the SaaS tools you already live in, that's where ChatGPT Work reaches.

Same verb — *do the work* — aimed at two different filesystems. One is your disk; one is your app graph.

## What each one actually returns

- **Cowork** → folders organized on disk, `.xlsx` files with live formulas, slide decks, and code, all sitting in your local file tree where your other tools can already see them.
- **ChatGPT Work** → sheets, slides, docs, and shareable web apps, assembled from whatever your connected apps hold, delivered inside ChatGPT.

The difference matters more than it sounds. A Cowork spreadsheet lands in the same folder your accountant's template lives in. A ChatGPT Work web app is a link you send. Neither is better; they end in different places, and the right one is wherever your next step already happens.

## Both now run while your laptop is closed

The quiet upgrade this month is that neither agent is chained to your session anymore.

Cowork's **cloud remote sessions** — beta, rolling out to Max plans first — run on Anthropic's servers, so a task keeps going after you shut the lid. Anthropic's own usage data, released with the cloud push, shows **91.3% of Cowork sessions have nothing to do with coding** — a signal that "agent" has already outgrown "coding agent" for most users.

ChatGPT Work runs server-side too, and is built to **stay with a complex project for hours**, decomposing it and finishing the steps on its own. For a solo founder, this is the actual unlock: you can start a job, close the laptop, and collect the output later.

## Connectors decide the real fit

An agent is only as useful as what it can reach.

- **Cowork** carries the M365 MCP Connector (read access to Outlook, OneDrive, SharePoint, and Teams) and plugs into the broader [Model Context Protocol](/posts/mcp-goes-stateless-2026-07-28-spec.html) ecosystem — which, notably, goes stateless in its own July 28 spec revision, making MCP servers cheaper to run behind a plain load balancer.
- **ChatGPT Work** reaches across ChatGPT's connected apps and workflows — the integrations you've already wired into your ChatGPT account.

If your company runs on Microsoft 365, Cowork has a head start on your inbox and documents. If your stack is a spread of SaaS apps you've connected to ChatGPT, ChatGPT Work meets you there.

## Price: you probably already own one

Here's the part that ends most deliberations. **Cowork is bundled free into every paid Claude plan** — Pro ($20/mo), Team ($25/seat), Enterprise — with no separate SKU. **ChatGPT Work is included in ChatGPT plans**, rolling out to Pro, Enterprise, and Edu first, with Plus and Business following within days.

So for most founders, this isn't a buying decision at all. It's a *which-subscription-do-I-already-pay-for* decision. If you're on Claude, you have Cowork. If you're on ChatGPT, you have ChatGPT Work. The cost of trying both is one month of the other plan.

## The verdict

Neither product is the winner, because they aren't really competing for the same hour of your day.

- **Choose Claude Cowork** if your work is local files — research folders, financial models, decks, code — and you want an agent operating on your disk with a huge context window and parallel sub-agents. Its M365 reach and MCP ecosystem are the tiebreakers if you live in Microsoft or already run MCP servers.
- **Choose ChatGPT Work** if your work is spread across SaaS apps, you want the agent inside the tool you already open fifty times a day, and you want GPT-5.6's tiered models (reach for Luna when the job is cheap and high-volume, Sol when it's hard).

The realistic outcome: you'll use whichever you were already paying for, and you'll be mostly happy. The one experiment worth running this month is pointing *both* at the same real task — a board-deck draft, a competitor teardown, a data cleanup — and seeing which one hands back something you'd actually ship. That answer is specific to your work, and it's the only benchmark that matters.

*For the wider week — GPT-5.6's launch, MCP's stateless spec locking on July 28, and the rest of the agent wave — see our [Founder's Wire](/wire.html). Building your own repeatable agent workflow? Start with [an agent skill](/posts/build-your-first-claude-agent-skill-skill-md-how-to.html).*
