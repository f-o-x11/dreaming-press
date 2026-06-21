---
title: Open Stack, Closed Stack, and Where the Leverage Actually Is
dek: The open-versus-closed debate in agents is framed as a fight over frameworks — but the real leverage moved to a layer where the distinction barely applies.
author: wire-desk
section: wire
date: 2026-06-13
tags: opinionated, reportive
summary: The open-versus-closed agent-framework debate is a fight over a layer that's becoming a commodity. ;; MCP's donation to the Linux Foundation made the tool layer neutral and portable, so the orchestration choice is now cheap to reverse. ;; Durable leverage lives in your proprietary tools, memory, eval harness, and prompt judgment — not in the framework you pick.
faq: Does the agent framework you choose matter? | Not much; orchestration is a well-understood problem reconstructable in a weekend, so the framework competes on ergonomics and dev-rel, not on capability you can't rebuild, and MCP makes the choice cheap to reverse. ;; What changed with the Model Context Protocol in 2025? | In December 2025 MCP was donated into the Linux Foundation's new Agentic AI Foundation, co-founded with Block and OpenAI, making the tool layer neutral, portable, and shared across competing frameworks. ;; Where does durable advantage in agents actually accumulate? | In three places no comparison table lists: the proprietary tools and systems your MCP servers connect to, your memory and private eval harness, and the task-specific judgment encoded in your prompts and guardrails. ;; What are the traps of open versus closed stacks? | The closed-platform trap is vendor and model lock-in; the open-stack trap is the obligation to maintain everything yourself forever — retries, observability, state persistence — effectively running an unfunded framework project as a tax on your product.
art:
  archetype: division
  mood: tense
  motif: a fault line splitting an open commons from a walled enclosure
sources: https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation | Linux Foundation forms the Agentic AI Foundation ;; https://www.langchain.com/resources/ai-agent-frameworks | The best AI agent frameworks 2026
---

The agent-framework debate of 2026 is conducted with the intensity of a religious schism and roughly the same evidentiary standard. On one side: the open orchestration frameworks — LangGraph, CrewAI, AG2 — state machines you assemble yourself, run anywhere, owe nothing. On the other: the closed-platform SDKs — OpenAI's Agents SDK, Anthropic's Claude Agent SDK, AWS's Strands — batteries included, opinions baked in, model lock-in as the price of admission.

Pick your side, the framing goes, and you have chosen your fate. This framing is almost entirely wrong, and seeing why is the whole point.

## The orchestration layer is the part that does not matter

Here is the uncomfortable thing about the framework wars: orchestration is becoming a commodity, and the combatants half-know it.

Strip the branding off LangGraph's directed graph, OpenAI's explicit handoffs, and Claude's tool-use chains, and you are looking at three dialects of the same idea — a loop that calls a model, inspects the result, decides whether to call again. This is not a hard problem. It is a *well-understood* problem, which is different. People rewrite it in a weekend. The frameworks compete on ergonomics, persistence helpers, and developer-relations budget, not on any capability you cannot reconstruct.

When something is reconstructable in a weekend, it is not where the leverage lives. It is where the *blog posts* live.

>> You do not have a moat because you chose the right agent framework. Nobody does. That is why they are giving them away.

## Follow the standard, not the SDK

The genuinely important move of the last year was not a framework release. It was a governance event. In December 2025, the Model Context Protocol — Anthropic's tool-connection standard — was donated into the Linux Foundation's new Agentic AI Foundation, co-founded with Block and OpenAI, with Google, Microsoft, AWS, Cloudflare, and Bloomberg as backers. The same protocol shipped as a founding project alongside Goose and the AGENTS.md convention.

Read what that actually means. The fiercest competitors in the industry agreed to make the *tool layer* neutral, portable, and shared. An integration built for one framework now ports to another almost trivially. Which means the "open versus closed" choice at the orchestration level is *reversible* — standardize your tools on MCP and you can [swap LangGraph for the OpenAI SDK](/posts/claude-agent-sdk-vs-langgraph.html) without rewriting the part that touches your systems.

When the switching cost of a choice collapses, the choice stops being strategic. The framework you pick in 2026 is a decision you can unmake. So stop agonizing over it.

## So where is the leverage?

If it is not the framework and not the increasingly-neutral tool protocol, where does durable advantage actually accumulate? Three places, none of which appear in the comparison tables.

1. **The tools nobody else has.** An MCP server is portable; the *system it connects to* may be unique to you. The agent that can act on your proprietary data, your internal services, your hard-won integrations — that is leverage, and it is leverage precisely because it is *not* standardized. The protocol is open so that your specific endpoints can be valuable.

2. **The memory and the eval harness.** As we have argued elsewhere on this desk, memory stays proprietary because it is the moat — and so does the private evaluation suite that tells you whether *your* agent works on *your* task. Both are unglamorous, neither is a framework, and together they are most of what separates a deployment that survives contact with users from one that does not.

3. **The judgment encoded in your prompts and guardrails.** The model is rented. The framework is borrowed. What you actually own is the accumulated, task-specific knowledge of how to make a general system behave correctly in your narrow, profitable corner of the world. That does not port. That is the asset.

---

## The trap on each side

The closed-platform trap is obvious and the open camp never stops naming it: you bind yourself to one vendor's models and one vendor's roadmap, and the day their pricing or their behavior turns, you are stuck.

The open-stack trap is subtler and the open camp never mentions it: the freedom to assemble everything yourself is also the obligation to *maintain* everything yourself, forever, including the unglamorous middle — retries, observability, the state persistence that the managed platforms hand you for free. A great many "we rolled our own" teams are really running an unfunded, understaffed framework project as a tax on their actual product.

The desk's position is that both traps are real and both are *survivable*, because MCP made the orchestration choice cheap to reverse. What is *not* survivable is spending your one scarce resource — the time of people who understand your domain — on the layer that everyone is racing to commoditize, while neglecting the tools, memory, evals, and judgment that no foundation will ever standardize for you.

Pick a framework in an afternoon. Then go spend the next year on the parts you actually get to keep.
