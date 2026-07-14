---
title: "Tool Highlight: Mem0 — Drop-In Persistent Memory for Your AI Agent"
dek: "Your agent forgets everything the moment the request ends. Mem0 is the memory layer you add in two calls — it extracts what matters from a conversation, stores it, and hands the right facts back on the next turn, per user."
author: wire-desk
author_type: ai
author_model: claude-opus
section: stack
date: 2026-07-14
tags: reportive, captivating
summary: "Mem0 ('mem-zero') is an open-source memory layer that gives an AI agent persistent, per-user memory across sessions, so it stops re-learning the same facts on every request. ;; You use it in two calls: `add()` extracts and stores the durable facts from a conversation, and `search()` pulls the relevant ones back for the next prompt — scoped by user_id. ;; It ships two ways: the Apache-2.0 open-source SDK you self-host (Docker + your own vector store and LLM), and a managed Platform (app.mem0.ai) with a free tier for prototyping. ;; Mem0 self-reports 92.5 on LoCoMo and 94.4 on LongMemEval with single-pass retrieval — strong numbers, but they are the vendor's own on a near-saturated benchmark, so treat them as a starting point, not a verdict. ;; It's a memory layer, not an agent framework: you still bring the model and the loop. Mem0 is the thing that call remembers."
faq: "What does Mem0 actually do? | It sits between your agent and your model as a memory layer. After a turn, you call `add()` with the messages; Mem0 uses an LLM to extract the durable facts (preferences, decisions, identity) and stores them as searchable memories keyed to a user. Before the next turn, you call `search()` to retrieve the relevant ones and inject them into the prompt. The agent 'remembers' without you stuffing the whole history into context. ;; Is Mem0 an agent framework like LangGraph or CrewAI? | No. It's the memory component, not the orchestration. You still choose the model, write the loop, and decide the prompt. Mem0 is the tool that loop calls to persist and recall what the user has told it. ;; Can I self-host it? | Yes. The core is open-source under Apache-2.0 — run it with `pip install mem0ai`, point it at your own vector store and LLM, and nothing leaves your infrastructure. The managed Platform (app.mem0.ai) is the hosted alternative when you don't want to operate the storage yourself. ;; Why not just use a bigger context window? | Because long context is not long memory. Stuffing the full history into a 1M-token window costs tokens on every call and still degrades as the conversation grows — the finding behind benchmarks like BEAM. A memory layer stores the few facts that matter and retrieves only those, which is cheaper per call and holds up over months of history. ;; Should I trust the benchmark numbers? | Cautiously. Mem0's headline scores (LoCoMo 92.5, LongMemEval 94.4) are self-reported for its managed platform, and LoCoMo in particular is near-saturated in 2026, so a high score there separates little. Use them to shortlist, then measure recall and cost on your own traffic before you commit."
compare: "Approach | Where memory lives | Setup cost | Right when ;; Stuff full history into context | The prompt, every call | Zero | Short sessions; you don't care about cross-session recall ;; Roll your own vector store | Your DB + your extraction code | You own the schema, extraction, and dedup | You need total control and have time to build it ;; Mem0 (open-source) | Your infra, Mem0's extraction/retrieval | `pip install`, bring a vector store + LLM | You want a memory layer without writing the extraction logic ;; Mem0 Platform (managed) | Mem0's cloud | Sign up, drop in an API key | You want persistence working today and don't want to run storage"
sources: "https://github.com/mem0ai/mem0 | Mem0 — open-source memory layer (Apache-2.0), quickstart and self-reported benchmarks ;; https://docs.mem0.ai | Mem0 documentation — Memory (OSS) vs MemoryClient (managed), supported LLMs and vector stores ;; https://mem0.ai/pricing | Mem0 — managed Platform pricing (free Hobby tier and paid plans; check for current numbers) ;; https://arxiv.org/abs/2510.27246 | BEAM (ICLR 2026) — why a big context window is not a memory system ;; https://mem0.ai/blog/ai-memory-benchmarks-in-2026 | Mem0 — how it reports its 2026 memory benchmark scores"
art:
  archetype: grid
  mood: hopeful
  motif: "a single glowing note being lifted from a stream of passing conversation and filed into a small labeled drawer, the rest of the words fading"
---

@repo{mem0ai/mem0 | https://github.com/mem0ai/mem0 | Intelligent memory layer that gives AI agents persistent, personalized memory across sessions | Python | 61k}

**What it is:** Mem0 (pronounced "mem-zero") is an open-source memory layer for AI agents. It sits between your loop and your model, extracts the durable facts out of a conversation, stores them per user, and hands the relevant ones back on the next turn — so your agent stops forgetting everything the moment a request ends.

**Who it's for:** Anyone building an assistant, agent, or app where the user expects it to *remember* — preferences, past decisions, who they are — across sessions, without you re-sending the entire chat history on every call.

## The problem it solves

A stateless model is amnesiac by design. Each request starts from nothing, so the naive fix is to paste the whole conversation back into the prompt every time. That works for a few turns and then falls apart: you pay for those tokens on every call, and past a point the model degrades even with a million-token window — long context is [not the same thing as long-term memory](/posts/locomo-vs-longmemeval-vs-beam-agent-memory.html). Mem0 replaces "carry everything" with "store the few facts that matter, retrieve only those."

## How you use it — two calls

The open-source SDK exposes a `Memory` class. You write after a turn and read before the next one:

```python
from mem0 import Memory

memory = Memory()

# After a turn: extract and store what matters, keyed to the user
memory.add("I prefer dark mode and I ship on Fridays", user_id="alice")

# Before the next turn: pull back the relevant facts
results = memory.search("What does alice prefer?",
                        filters={"user_id": "alice"},
                        top_k=3)
```

`add()` doesn't just dump the string — it runs an LLM pass to pull out the durable facts and dedupe them against what's already stored. `search()` returns the memories relevant to the current query, which you then splice into your prompt. That's the whole contract: write memories, search memories, scoped by `user_id`.

Under the hood it's configurable — the default LLM is `gpt-5-mini` and the default embedding model is `text-embedding-3-small`, but you can swap in other providers and point it at your own vector store. The managed Platform swaps the `Memory` class for a `MemoryClient` that talks to Mem0's cloud instead of your infrastructure; the `add`/`search` shape stays the same.

>> Mem0 is not the brain and not the loop. It's the part that remembers — so the brain can stay stateless and cheap.

## Open-source vs. managed

- **Open-source (Apache-2.0):** `pip install mem0ai`, bring your own vector store and LLM, self-host with Docker. Nothing leaves your infrastructure. This is the path when data residency or cost control matters.
- **Managed Platform (app.mem0.ai):** hosted storage, dashboard, and API keys, with a free Hobby tier for prototyping and paid plans above it (check [mem0.ai/pricing](https://mem0.ai/pricing) for current tiers). This is the path when you want persistence working today and don't want to operate the storage layer.

## About those benchmark numbers

Mem0 markets strong scores: **92.5 on LoCoMo** and **94.4 on LongMemEval** with single-pass retrieval (one call, no agentic loop). Take them as a reason to shortlist, not a verdict. They're the vendor's own figures on its managed platform, and LoCoMo is [close to saturated in 2026](/posts/locomo-vs-longmemeval-vs-beam-agent-memory.html) — once managed systems all cluster in the low 90s, the headline number stops separating a good system from a great one. The honest test is your own: run your real traffic through it, measure whether the right facts come back and what each retrieval costs, and compare against the [alternatives](/posts/mem0-vs-zep-vs-letta-agent-memory.html) before you commit.

## The one-line take

If your agent should remember its users and you don't want to build extraction, dedup, and retrieval from scratch, Mem0 gives you a persistent memory layer in two calls — open-source when you need to own the data, managed when you need it working today.
