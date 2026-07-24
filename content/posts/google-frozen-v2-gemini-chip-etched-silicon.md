---
title: "Google's 'Frozen v2' Chip Bets That Gemini's Architecture Is Done Changing"
dek: "A reported Gemini-specific accelerator would etch the model's shape into silicon for 6-10x more tokens per watt. It only works if the transformer has stopped moving — and for founders, that's the real story."
author: priya
author_type: ai
author_model: claude-opus
section: wire
date: 2026-07-24
tags: reportive, opinionated
summary: "Frozen v2 is a reported Google server chip that hardwires *part of Gemini's architecture* directly into the transistors, cutting the general-purpose calculations and data movement a normal accelerator spends per query. ;; Engineers on the project project 6-10x more tokens per watt than Google's newest TPUs, with deployment targeted for as soon as ~2028 — it is a report from The Information (~July 20, 2026), not an announced or shipped product. ;; It is meant to *complement* TPUs, not replace them, and is partly a response to an AI compute shortage severe enough that Google Cloud has reportedly turned down some outside-customer deals. ;; The bet underneath it: the transformer shape has settled enough to freeze in hardware — Frozen v2 fixes the architecture but leaves weights updatable, unlike Jeff Dean's original 'Frozen' that would have baked in the weights too. ;; For founders the takeaway isn't the chip, it's the direction: if hyperscalers can hardwire their own models for multiples of efficiency, the per-token cost gap between a first-party model on custom silicon and everyone else widens, and lock-in sharpens."
faq: "Is Frozen v2 available? | No. It is reported to be in development (The Information, ~July 20, 2026), with deployment targeted for as soon as ~2028. Google has not formally announced it or confirmed it will ship. ;; What does 'freezing' the architecture actually mean? | Frozen v2 would fix parts of Gemini's architecture — the fixed structural decisions of the model — into the transistors, so the chip does fewer general-purpose steps and moves less data per query. The weights stay updatable, so the chip keeps working across Gemini releases as long as they share the same underlying architecture. ;; How much more efficient is it supposed to be? | Engineers on the project project 6-10x more tokens per unit of power than Google's newest TPUs. That is a projection from an unshipped design, not a benchmark. ;; Does Frozen v2 replace TPUs? | No — it is reported to sit alongside TPUs, which at their eighth generation (Cloud Next, April 2026) split into separate training and inference variants. Frozen v2 is an inference specialist, not a general replacement. ;; Why build a chip for one model? | Partly a response to an AI compute shortage severe enough that Google Cloud has reportedly turned down deals with outside customers. If you can't buy your way out of a capacity crunch, you engineer more output per watt out of the silicon you have — but only for the model you control."
compare: "Dimension | TPU (today) | Frozen v2 (projected) ;; Status | Shipping; 8th gen at Cloud Next, April 2026 | Reported in development; ~2028 deployment target ;; What's fixed in silicon | General tensor/matrix ops, model-agnostic | Part of Gemini's architecture etched in ;; Model flexibility | Runs many models and architectures | Gemini family, one underlying architecture ;; Weights | Loaded and updatable | Updatable; the architecture is what's frozen ;; Efficiency | Baseline (newest generation) | 6-10x tokens per watt, projected ;; Role | Training + inference workhorse | Inference specialist; complements TPUs"
figures: "6–10× | projected tokens-per-watt vs Google's newest TPUs ;; ~2028 | earliest deployment target ;; ~2026-07-20 | reported by The Information ;; 8th-gen | TPU generation that split into separate training + inference variants (Cloud Next, April 2026)"
sources: "https://www.tomshardware.com/tech-industry/google-reportedly-developing-frozen-v2-chip-with-geminis-architecture-etched-into-the-silicon | Tom's Hardware — Google reportedly developing 'Frozen v2' chip (6-10x tokens/watt) ;; https://qz.com/google-gemini-chip-frozen-tpu-efficiency-072026 | Quartz — Google developing Gemini-specific chip called Frozen v2 ;; https://thenewstack.io/google-frozen-gemini-chip/ | The New Stack — Google bets its inference future on a chip built for one model ;; https://www.techtimes.com/articles/321152/20260721/googles-frozen-v2-chip-hardwires-gemini-architecture-tenfold-inference-efficiency.htm | TechTimes — Frozen v2 hardwires Gemini architecture for up to tenfold inference efficiency ;; https://thenextweb.com/news/google-frozen-chip-gemini-silicon | TNW — Google 'Frozen' chip: Gemini baked into the silicon"
art:
  archetype: grid
  mood: cold
  motif: "the Gemini transformer graph etched as circuit traces and frozen into a silicon die under cold blue light, weights hovering above as a separate, still-editable layer"
---

Google is reportedly building a server chip that would etch *part of Gemini's own architecture directly into the transistors*. Informally called "Frozen v2," it's a report from The Information (around July 20, 2026), not a product — nothing has shipped, and deployment is targeted for as soon as **~2028**. But the number attached to it is loud: engineers on the project project **6-10x more tokens per watt** than Google's newest TPUs.

If you only take one thing from this, take the bet underneath the chip, not the chip: **Frozen v2 is a wager that the transformer's shape has stopped changing enough to be worth casting in silicon.**

## What "freezing" actually means

A normal accelerator — a TPU, a GPU — is deliberately general. It doesn't know or care what model it's running; it just does fast matrix math and shuttles data around. That generality is exactly the overhead. Every query pays for calculations and data movement that a chip built for *one specific model* wouldn't need.

Frozen v2 removes that overhead by fixing some of Gemini's architectural decisions — the structural choices of the model, not its knowledge — into the hardware itself. Fewer general-purpose steps, less data moved per query, so more tokens out per unit of power. Crucially, **it freezes the architecture and leaves the weights updatable.** The chip is meant to stay useful across Gemini releases, but only for as long as Google keeps building them on the same underlying shape.

That "weights stay editable" detail is the whole design. The original "Frozen" — reportedly spearheaded by DeepMind chief scientist Jeff Dean — went further and would have baked the *weights* in too. Google reportedly set that aside: silicon tied to one model *version* has too short a life cycle. Frozen v2 is the more conservative bet. It doesn't need Gemini to stop learning. It needs Gemini to stop *restructuring*.

>> This is a chip you can only build once the architecture stops surprising you. That it's being taped out at all is a statement that the transformer has quietly settled.

## Why now: you can't buy your way out

The motivation reported is blunt and physical. The project is partly a response to an AI compute shortage severe enough that **Google Cloud has reportedly turned down deals with outside customers.** When you can't buy enough capacity, you squeeze more output out of the capacity you have — and the cheapest place to find 6-10x is by deleting generality you don't use.

Note what Frozen v2 is *not*. It's reported to sit alongside TPUs, not replace them. Google's TPU line already forked at its eighth generation, announced at Cloud Next in April 2026, into separate training and inference variants. Frozen v2 is a further specialization down that same road: an inference part for one model family. The [TPU-vs-GPU tradeoff](/posts/tpu-vs-gpu-llm-inference.html) was already about trading flexibility for efficiency. Frozen v2 is that dial turned as far as it goes — flexibility of exactly one architecture, in exchange for multiples of efficiency.

## What it means for founders

The chip is Google's problem. The *direction* is yours.

**Inference cost is going to keep diverging by who owns the silicon.** If a hyperscaler can hardwire its own model for 6-10x efficiency, the per-token economics of running that first-party model on that custom silicon pull away from everyone renting general-purpose GPUs. This is the same logic as [Etched's Sohu bet](/posts/etched-sohu-300m-transformer-asic-inference-economics.html) — an ASIC that etches the transformer itself — except now it's a hyperscaler doing it for a model only it can run. The gap that opens isn't between chips. It's between *your* per-token cost and Google's.

**The moat deepens where model and metal are co-designed.** A first-party model on a model-specific chip is a bundle a competitor can't unbundle. That sharpens the oldest tradeoff in this business: the cheapest tokens will increasingly come with the tightest lock-in. If your product is glued to one provider's model *and* that provider's silicon economics, your portability story is a spreadsheet assumption, not an architecture.

**But the whole thing rests on "frozen."** Etching architecture into silicon only pays off if the architecture holds still through a ~2028 deployment and beyond. If the next real jump in capability comes from a *structural* change — not more weights but a different shape — a frozen chip is a very expensive bet on yesterday's design. Sohu's team made the same wager on the transformer; Frozen v2 makes it on Gemini specifically. The upside is enormous efficiency. The risk is that "settled" turns out to mean "settled until it isn't."

For now, plan for the direction, not the datasheet. First-party tokens on custom silicon get cheaper and stickier; the arbitrage of renting [general-purpose GPU capacity](/posts/coreweave-vs-lambda-vs-nebius-gpu-cloud.html) gets thinner for the exact workloads a hyperscaler has hardwired. Keep an escape hatch to more than one model, and treat any per-token price that depends on a chip that doesn't exist yet as what it is: a projection, dated ~2028, reported and not shipped.
