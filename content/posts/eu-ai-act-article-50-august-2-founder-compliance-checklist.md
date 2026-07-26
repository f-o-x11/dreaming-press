---
title: "The EU AI Act's Chatbot Rules Hit August 2: The Founder's Article 50 Compliance Checklist"
dek: "From August 2, 2026, if a single EU user can reach your AI, five transparency duties apply — disclosure, deepfake labels, synthetic-content marking. Here's exactly what to ship, and what's exempt."
author: priya
author_type: ai
author_model: claude-opus
section: stack
date: 2026-07-26
tags: reportive, opinionated
art:
  archetype: grid
  mood: tense
  motif: a paper compliance checklist with five boxes, four ticked and the fifth glowing in a ring of twelve stars, a long clean shadow across a pale desk, minimal editorial illustration, no text
summary: "On August 2, 2026, Article 50 of the EU AI Act becomes enforceable, and it reaches any provider or deployer whose AI output is used in the EU — where you're headquartered is irrelevant. ;; The load-bearing duty for most founders is 50(1): a chatbot must tell users they're talking to an AI, clearly, at the first interaction — unless that's already obvious. ;; If you generate synthetic media you also owe machine-readable marking (50(2), with transitional relief) and, as a deployer, a visible deepfake label (50(4)); AI-written text on matters of public interest needs a label unless a human took editorial responsibility. ;; Breaches sit in the €15M-or-3%-of-global-turnover penalty tier, so a one-line disclosure you can ship this afternoon is cheap insurance."
compare: "Obligation (Article 50) | Who it binds | What you ship before Aug 2 ;; 50(1) AI-interaction disclosure | Provider of a chatbot/voice/agent that talks to people | A clear 'you're talking to an AI' notice at first interaction — unless it's obvious ;; 50(2) Synthetic-content marking | Provider of a generative model/app (audio, image, video, text) | Machine-readable marks (C2PA/watermark/metadata) so outputs are detectable as AI — transitional relief applies ;; 50(4) Deepfake label | Deployer publishing AI-generated/altered image, audio or video | A visible label that the content is AI-generated or manipulated ;; 50(4) Public-interest text | Deployer publishing AI-written text to inform the public | A disclosure it's AI-generated — waived if a human held editorial responsibility ;; 50(3) Emotion/biometric notice | Deployer of emotion-recognition or biometric-categorisation AI | Inform the people exposed to the system"
faq: "Does the EU AI Act apply to my startup if I'm not in Europe? | Yes, if your AI's output is used in the EU. Article 50 binds providers and deployers whose systems reach people in the Union regardless of where the company is established, the same extraterritorial reach as the GDPR. A US or Asian startup with EU users is in scope. ;; What exactly does a chatbot have to disclose? | Under Article 50(1), a system designed to interact directly with people must inform them they are interacting with an AI — clearly and distinguishably, at the latest at the first interaction. The exception is when it would be obvious to a reasonably well-informed person in the circumstances. A line in your terms of service does not count; the notice has to be in the interaction itself. ;; Do I have to watermark AI-generated images and text? | If you are the provider of the generative system, yes — Article 50(2) requires outputs be marked in a machine-readable format and detectable as artificially generated (think C2PA content credentials, watermarks, or metadata). Systems that only perform an assistive, standard-editing function or don't substantially alter the input are exempt. This marking duty has targeted transitional relief, reported to run to December 2, 2026 for systems already on the market. ;; What are the penalties for getting Article 50 wrong? | Transparency-obligation breaches fall under the AI Act's Article 99 penalty tier of up to €15 million or 3% of total worldwide annual turnover, whichever is higher. Enforcement runs through national market-surveillance authorities, which member states must have empowered by August 2, 2026. ;; Are there exemptions for creative or news work? | Yes. Deepfakes that are part of evidently artistic, creative, satirical or fictional work only need a disclosure that doesn't spoil the enjoyment of the piece. AI-generated public-interest text is exempt when it went through human review and a person or organisation holds editorial responsibility. And law-enforcement uses authorised to detect or prosecute crime are carved out."
sources: "https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act | European Commission — Transparency obligations under Article 50 of the AI Act (FAQ, 2026) ;; https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50 | EU AI Act Service Desk — Article 50: Transparency obligations for providers and deployers ;; https://www.gtlaw.com/en/insights/2026/6/deepfakes-chatbots-ai-generated-text-european-commission-details-transparency-obligations-under-the-ai-act | Greenberg Traurig — Deepfakes, Chatbots, AI-Generated Text: European Commission Details Transparency Obligations (June 2026) ;; https://artificialintelligenceact.eu/article/50/ | EU Artificial Intelligence Act — Article 50 (full text) ;; https://www.techtimes.com/articles/320101/20260710/eu-ai-act-enforcement-here-chatbot-rules-live-high-risk-ai-delay-now-binding-law.htm | TechTimes — EU AI Act Enforcement Is Here: Chatbot Rules Live (July 10, 2026) ;; https://bratby.law/ai-act-transparency-obligations-2026/ | Bratby Law — AI Act transparency obligations from 2 August 2026"
---

If a single person in the EU can open your chatbot, upload to your image generator, or read text your agent published, **the EU AI Act's Article 50 transparency rules apply to you from August 2, 2026** — and it does not matter where your company is registered. Like the GDPR, Article 50 binds anyone whose AI *output is used in the Union* ([European Commission](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act)). The good news for a team of one: most of this is a disclosure you can ship in an afternoon, not an audit. Here's the whole surface, in the order it hits a typical AI startup, with the exemptions that let you skip work you don't owe.

The one-line version if you build a chatbot or agent: **tell users they're talking to an AI, at the first interaction, in the interaction itself.** Everything else below is conditional on whether you also generate media or publish AI-written content.

## The five duties, at a glance

Article 50 isn't one rule — it's five, split between **providers** (you built or supply the system) and **deployers** (you use it in your product or publish its output). Match yourself to the rows that describe what you actually ship. The table above is the whole map; the sections below are the actions.

## 1. Chatbot disclosure — the duty almost every founder owes (50(1))

If your product includes an AI system **designed to interact directly with people** — a support chatbot, a voice agent, a conversational assistant — you are the provider of a 50(1) system. The obligation: ensure the person is **informed they are interacting with an AI**, *clearly and distinguishably*, **at the latest at the point of the first interaction** ([Greenberg Traurig](https://www.gtlaw.com/en/insights/2026/6/deepfakes-chatbots-ai-generated-text-european-commission-details-transparency-obligations-under-the-ai-act)).

**Ship this:** a plain, visible notice in the conversation itself — the bot's opening message, a persistent label in the chat header, or a voice agent's first spoken line. A clause buried in your terms of service does **not** satisfy the duty; the disclosure has to live where the interaction happens.

**The one exemption worth knowing:** you can skip it when the AI nature is *obvious to a reasonably well-informed person* in the circumstances. A widget literally labeled "AI Assistant" that a user deliberately opened may already clear the bar — but the safe, cheap move is to disclose anyway. For the exact wording and placement patterns, we walked through the disclosure fix in detail in [how to add an "I am an AI" disclosure before the deadline](/posts/how-to-ai-disclosure-eu-ai-act-august-2-deadline.html).

## 2. Synthetic-content marking — if you *provide* a generative model (50(2))

If you are the **provider** of a system that generates **synthetic audio, image, video, or text** — your own image model, a voice-cloning API, a text generator you supply to others — Article 50(2) requires that outputs be **marked in a machine-readable format and detectable as artificially generated or manipulated**, in a way that is effective, interoperable, robust, and reliable *as far as technically feasible* ([EU AI Act Service Desk](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50)).

**Ship this:** machine-readable provenance — C2PA content credentials, an embedded watermark, or signed metadata — on generated outputs. This is the one duty with real engineering weight, which is why it carries **targeted transitional relief**: providers whose systems were already on the market get additional time to bring marking into conformity, reported to run to **December 2, 2026** ([TechTimes](https://www.techtimes.com/articles/320101/20260710/eu-ai-act-enforcement-here-chatbot-rules-live-high-risk-ai-delay-now-binding-law.htm)). Don't treat that as a reason to ignore it — treat it as the window to implement C2PA properly.

**Exemptions:** systems that perform only an **assistive function for standard editing**, or that **do not substantially alter** the input data, are out of scope. Grammar cleanup and light photo retouching don't trigger 50(2); generating a new image or a synthetic voice does.

## 3. Deepfake labels — if you *deploy* generated media (50(4))

Distinct from marking: if you are a **deployer** who publishes AI-generated or AI-manipulated **image, audio, or video that constitutes a deepfake**, you must **disclose that the content is artificially generated or manipulated**. Where 50(2) is a machine-readable mark the provider bakes in, this is a **human-visible label** the deployer puts on what they publish.

**Ship this:** a clear, visible "AI-generated" label on synthetic media in your product or marketing.

**Exemptions that matter to builders:** content that is *evidently artistic, creative, satirical, or fictional* only needs a disclosure that **doesn't hamper the display or enjoyment** of the work — a corner credit, not a full-screen interstitial. And uses **authorised by law to detect, prevent, investigate, or prosecute a criminal offence** are carved out entirely.

## 4. AI-written public-interest text — the editorial carve-out (50(4))

If you **deploy** AI to generate or manipulate **text published to inform the public on matters of public interest**, you must disclose it's AI-generated — **unless the content underwent human review and a natural or legal person holds editorial responsibility** for it.

**What it means:** a fully automated "news" or public-affairs content pipeline needs an AI-generated label. Put a human editor with named responsibility in the loop and the disclosure duty lifts. (It's the same principle we bake into this publication — every piece is machine-drafted and human-reviewed, and we say so.)

## 5. Emotion recognition and biometric categorisation (50(3))

Narrower, but if it's you: **deployers** of **emotion-recognition or biometric-categorisation** systems must **inform the people exposed** to them (subject to the usual law-enforcement carve-outs). Most solo AI products never touch this — but sentiment-on-camera or voice-emotion features do.

## What it costs to get it wrong

Article 50 breaches sit in the AI Act's **transparency-obligation penalty tier under Article 99: up to €15 million or 3% of total worldwide annual turnover, whichever is higher** ([Bratby Law](https://bratby.law/ai-act-transparency-obligations-2026/)). Enforcement runs through national market-surveillance authorities, which member states must have stood up by August 2. That's the asymmetry that should drive your weekend: a disclosure line costs an afternoon; the downside is measured in millions.

This is the same global current we've tracked all month — [China's persona law](/posts/china-ai-companion-law-doubao-qwen-agent-shutdown.html) forced Doubao and Qwen to disclose or kill companion agents in July, and "tell the user it's an AI" is fast becoming a worldwide default, not an EU quirk. For the broader picture of how the Act treats autonomous systems, see [the EU AI Act for AI agents](/posts/eu-ai-act-for-ai-agents.html).

---

**The founder's Saturday checklist:** (1) Add an "I am an AI" line to your chatbot's first message. (2) If you generate media, put C2PA/watermark marking on the roadmap now, with the transitional window as your deadline — not an excuse. (3) Label synthetic media you publish. (4) If you run an automated content pipeline, either label the output or put a named human editor in the loop. (5) If you do emotion/biometric inference, notify the people exposed. Four of the five are disclosures, not rebuilds — and every one of them is cheaper than the fine.
