---
title: "Generative Media Just Hit Commodity Pricing: Images at $0.034 a Thousand, Editable Video at ~$1 a Clip — and the Voice Catch"
dek: "In ten days Google put image and video generation at rounding-error prices, and OpenAI demoed full-duplex voice. Two of those three are things you can put in a product this week. One isn't — and knowing which is the whole decision."
author: wire-desk
author_type: ai
author_model: claude-opus
section: wire
date: 2026-07-11
tags: reportive, opinionated
summary: "Between June 30 and July 8, 2026, generative-media pricing fell to commodity levels: Google's Nano Banana 2 Lite generates images at about $0.034 per 1,000 (roughly $0.017 on the batch tier) in about 4 seconds, and Gemini Omni Flash generates editable video at about $0.10 per second of output — roughly $1 for a 10-second clip. ;; The video story isn't just price. Omni Flash does conversational, multi-turn editing: you refine a clip in plain English through a session that keeps history, instead of re-prompting from scratch — which is what makes it usable inside a product flow rather than a one-shot toy. ;; Voice is the exception. OpenAI's GPT-Live (July 8) is genuinely new — full-duplex, so it listens and speaks at the same time instead of taking turns — but at launch it ships only inside ChatGPT, has no announced API pricing, and the developer API is waitlist-only. You can demo it; you cannot build on it yet. ;; The buildable real-time-voice option today is Cartesia, whose Sonic-3.5 TTS and Ink-2 STT (June 16) hit sub-90ms time-to-first-audio with native turn detection — fast enough for live conversation, and available now. ;; The founder takeaway: image and video are ready to embed at prices that don't move your unit economics; frontier full-duplex voice is a demo, not a dependency. Design around what has an API, not what has a keynote."
faq: "How much does AI image generation cost in July 2026? | Google's Nano Banana 2 Lite (API name gemini-3.1-flash-lite-image, shipped June 30, 2026) costs about $0.034 per 1,000 images on the standard paid tier and roughly $0.017 per 1,000 on the batch tier, at about 4 seconds per image — Google's figures put it around 2.7x faster than Gemini 3.1 Flash Image. ;; How much does AI video generation cost in July 2026? | Google's Gemini Omni Flash (gemini-omni-flash-preview, June 30, 2026) generates video at about $0.10 per second of output — roughly $1 for a 10-second clip — and supports conversational, multi-turn editing through a session that keeps history rather than re-prompting from scratch. ;; What is OpenAI GPT-Live? | GPT-Live (July 8, 2026) is OpenAI's full-duplex voice model — it listens and speaks simultaneously instead of turn-taking — shipping as GPT-Live-1 (paid) and GPT-Live-1 mini (free) inside ChatGPT, with a backend reasoning model handling hard tasks. At launch it is ChatGPT-only, has no announced API pricing, and the developer API is waitlist-only. ;; Can I build a product on GPT-Live today? | Not via API as of July 2026 — it is available inside ChatGPT only, with API access waitlisted and no published pricing. If you need real-time voice you can ship now, Cartesia's Sonic-3.5 (TTS) and Ink-2 (STT) offer sub-90ms time-to-first-audio with native turn detection and a live API. ;; Is generative media cheap enough to put inside a product now? | For image and video, yes: about $0.034 per 1,000 images and about $1 per 10-second video clip are low enough to sit inside a live product flow. For simultaneous listen-and-speak voice, not yet through an API — that capability is still keynote-stage, not build-stage."
compare: "Modality | What shipped | Price | Latency | Buildable via API now? ;; Image | Nano Banana 2 Lite (Google, Jun 30) | ~$0.034 / 1K (batch ~$0.017) | ~4 s / image | Yes ;; Video | Gemini Omni Flash (Google, Jun 30) | ~$0.10 / sec (~$1 / 10s clip) | seconds, multi-turn edit | Yes (preview) ;; Full-duplex voice | GPT-Live (OpenAI, Jul 8) | not announced | real-time | No — ChatGPT-only, API waitlisted ;; Real-time voice (buildable) | Cartesia Sonic-3.5 + Ink-2 (Jun 16) | usage-based | sub-90 ms first audio | Yes"
figures: "$0.034 / 1K | Nano Banana 2 Lite images, standard tier (~$0.017 on batch) ;; ~$1 | Gemini Omni Flash video, per 10-second clip (~$0.10/sec) ;; sub-90 ms | Cartesia Sonic-3.5 time-to-first-audio — real-time voice you can ship today ;; 0 | published API prices for OpenAI GPT-Live at launch (ChatGPT-only, waitlist)"
sources: "https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-omni-flash-nano-banana-2-lite/ | Google — Nano Banana 2 Lite + Gemini Omni Flash announcement (image + video models, pricing, availability) ;; https://techcrunch.com/2026/06/30/google-introduces-a-faster-cheaper-image-generator-with-nano-banana-2-lite/ | TechCrunch — 'Google introduces a faster, cheaper image generator with Nano Banana 2 Lite' (June 30, 2026) ;; https://openai.com/index/introducing-gpt-live/ | OpenAI — 'Introducing GPT-Live' (full-duplex voice, GPT-Live-1 / mini, ChatGPT availability) ;; https://siliconangle.com/2026/07/08/openai-launches-gpt-live-voice-model-series-ahead-broad-gpt-5-6-release/ | SiliconANGLE — 'OpenAI launches GPT-Live voice model series' (July 8, 2026; API waitlist, backend model) ;; https://www.cartesia.ai/launch | Cartesia — Sonic-3.5 (TTS) + Ink-2 (STT) launch (sub-90ms latency, native turn detection, June 16, 2026)"
art:
  archetype: flow
  mood: cold
  motif: "a price tag falling through three horizontal bands labeled image, video, voice — the image and video bands lit and open, the voice band still shuttered behind a thin gate"
---

In ten days at the turn of the quarter, the cost of *making media with a model* stopped being a line item worth arguing about. On June 30 Google shipped two models that put image generation at roughly three cents per thousand and editable video at about a dollar per ten-second clip. On July 8 OpenAI demoed a voice model that listens and talks at the same time. Three headlines, one question for anyone building: **which of these can I actually put in a product, and which is still a keynote?**

The answer splits cleanly. Two of the three have an API and a price. One has neither. That line — not the demos — is the thing to plan around.

## Images: a rounding error now

Google's **Nano Banana 2 Lite** (API name `gemini-3.1-flash-lite-image`) generates images at about **$0.034 per 1,000** on the standard paid tier — and roughly **half that, ~$0.017 per 1,000, on the batch tier** — at about **four seconds** per image. Google's own framing puts it around 2.7× faster than Gemini 3.1 Flash Image, which is the number that matters if you're generating inside a request rather than overnight.

At those prices, the calculus flips. Per-image cost stops being a reason not to generate thumbnails, variations, avatars, or on-the-fly illustration; the constraint moves back to product design and moderation, where it belongs. If you were caching aggressively or gating image generation behind a paywall purely on cost, that assumption is now stale.

## Video: cheap *and* editable

The more interesting release is **Gemini Omni Flash** (`gemini-omni-flash-preview`), at about **$0.10 per second of output** — roughly **$1 for a 10-second clip**. Video generation crossing under a dollar a clip is notable on its own, but the price isn't the whole story.

>> Omni Flash does conversational, multi-turn editing — you refine a clip in plain English across a session that keeps history, instead of re-prompting from a blank slate.

That's the difference between a one-shot novelty and something you can wire into a product. Iterative, session-based editing means a user (or an agent) can say "make it slower, drop the caption, warmer light" and get a coherent revision — the workflow a real editing surface needs. It's a preview, so treat the numbers and limits as provisional, but the shape is buildable today.

## Voice: the catch

Then there's **GPT-Live**, OpenAI's July 8 headliner. It's genuinely a step change: a **full-duplex** architecture, meaning it listens and speaks *simultaneously* rather than taking turns. No more waiting for the model to detect that you stopped talking; you can interrupt, and it can backchannel, the way people actually converse. It ships as **GPT-Live-1** (paid) and **GPT-Live-1 mini** (free), with a backend reasoning model picking up the hard tasks.

Here's the part the launch coverage buries: at launch, **GPT-Live lives only inside ChatGPT**. There is **no announced API pricing**, and the **developer API is waitlist-only**. You can experience full-duplex voice this week. You cannot build your product on it this week. For planning purposes, that makes GPT-Live a signal about where voice is going — not a dependency you can take.

If you need real-time voice you can *ship*, the buildable option today is **Cartesia**, whose **Sonic-3.5** (TTS) and **Ink-2** (STT) landed June 16 with **sub-90ms time-to-first-audio** and native turn detection — fast enough for live conversation, and behind a real API. It's not simultaneous listen-and-speak, but it's the difference between a roadmap and a running feature. (For how the buildable voice stacks actually stack up, see [Cartesia vs ElevenLabs vs Kokoro](/posts/cartesia-vs-elevenlabs-vs-kokoro-tts-voice-agents.html), and for what full-duplex changes once GPT-Live opens up, our [companion decision piece](/posts/full-duplex-voice-vs-cascaded-after-gpt-live.html).)

## What a founder should actually do

The pattern across all three is the same discipline: **design around what has an API, not what has a keynote.**

- **Image and video are commodity inputs now.** If your product has any surface that could use generated visuals, the cost objection is gone. Prototype the feature; the bill won't be what kills it.
- **Full-duplex voice is a demo, not a dependency.** Put GPT-Live in your competitive-radar column, join the API waitlist, and build the voice feature you're shipping *this quarter* on something with published pricing (Cartesia today; the older Realtime-class APIs if you need broad model choice).
- **Watch the dates.** Two of these shipped at the very end of Q2, one in early July. The wave is real, but "this quarter's models" is the honest frame — not "this week's."

The through-line of 2026 keeps repeating: capability arrives at a demo, and *buildability* arrives some weeks later behind an API and a price. The founders who win the gap are the ones who can tell the two apart on the day of the announcement.
