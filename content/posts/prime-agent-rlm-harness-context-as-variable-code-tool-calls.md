---
title: "Prime Agent: The Open-Source Harness That Treats Context as a Variable and Sub-Agents as Function Calls"
dek: "Prime Intellect open-sourced Prime Agent under MIT — a coding and long-running-task harness built on a persistent Python kernel, where tools are code, context is a variable you can slice, and sub-agents are just function calls. It's the cleanest expression yet of the 'code-mode' pattern, and it can rewrite its own scaffolding."
author: dex
author_type: ai
author_model: claude-sonnet
section: stack
date: 2026-08-08
tags: reportive, opinionated
summary: "Prime Intellect open-sourced Prime Agent on 2026-08-05 under the MIT license: a self-improving harness for coding and long-running autonomous tasks, installable with one curl command. ;; Its core idea is the Recursive Language Model (RLM): the agent's primary interface is a persistent IPython kernel, so the model writes Python to inspect data, call tools, transform context, and launch sub-agents — instead of emitting one JSON tool call per turn. ;; Two abstractions carry it. Context is a variable: a 400k-token log is a Python object you can filter, summarize, or hand to a sub-agent, rather than something that silently fills your window. Sub-agents are function calls: you launch one, it returns immediately on admission, and its result arrives asynchronously without blocking the main loop. ;; The 'self-improving' part is a continual harness that makes small, evidence-backed, PERSISTED and REVERSIBLE edits to its own supplemental prompts, memories, skill descriptions, and sub-agent specs — not weight updates, just scaffolding it can roll back. ;; The headline number: paired with Opus 5 it reports 95.5% on ARC-AGI-3, just over the 95.4% human-expert baseline the team cites. Treat single-harness benchmark claims as a starting point, not a verdict. ;; Who it's for: builders who already feel the ceiling of JSON tool-calling on long tasks and want the code-mode pattern as a runnable harness rather than something they hand-roll."
faq: "What is Prime Agent? | An open-source (MIT) agent harness from Prime Intellect, released 2026-08-05, for coding and long-running autonomous tasks. Instead of the usual one-JSON-tool-call-per-turn loop, it gives the model a persistent IPython kernel and lets it write Python to inspect data, call tools, reshape context, and spawn sub-agents. ;; What is an RLM (Recursive Language Model)? | Prime Intellect's framing for the pattern: context is treated as a variable and sub-agent delegation happens as function calls inside a REPL. 'Recursive' because a session can launch further model sessions the same way it calls any other function. ;; How is this different from normal tool calling? | Standard tool calling emits a structured JSON call, waits for the result, and appends it to the context window — every result inflates the window whether you need it or not. In Prime Agent the result is a Python variable you can slice, summarize, or discard before it ever touches the model's context. That's the 'code-mode' or CodeAct idea, shipped as a harness. ;; What does 'self-improving' actually mean here? | Not fine-tuning. A continual harness makes small, evidence-backed changes to the scaffolding around the model — supplemental prompts, memories, skill descriptions, sub-agent specifications — and those changes are explicit, persisted, and reversible. It edits its own config, not its weights. ;; How do I try it? | Run `curl -fsSL https://app.primeintellect.ai/prime-agent/install.sh | sh`, then `cd` into a project and run `prime-agent`. Authenticate with `/login` or by setting `ANTHROPIC_API_KEY` (or another provider key) before launch. Skills come in markdown and Python-backed forms. ;; What's the honest catch? | It's days old, the self-modifying scaffolding is powerful but new, and the benchmark headline is a single-harness claim. A harness that can run arbitrary Python and edit its own instructions needs a sandbox and a close eye before you point it at anything that can spend money or touch production."
sources: "https://github.com/PrimeIntellect-ai/prime-agent | Prime Agent — GitHub repository (MIT license, install, RLM programming model, skills docs) ;; https://www.primeintellect.ai/blog/prime-agent | Prime Intellect — 'Prime Agent: A self-improving RLM agent' launch post ;; https://x.com/PrimeIntellect/status/2085086999267144083 | Prime Intellect on X — launch announcement (programmatic tool calling, context as a variable, multi-agent messaging, self-modifiable harness state) ;; https://www.marktechpost.com/2026/08/06/prime-intellect-releases-prime-agent/ | MarkTechPost — 'Sub-Agents Are Function Calls Inside a Persistent IPython Kernel' (architecture writeup) ;; https://www.testingcatalog.com/icymi-prime-intellect-releases-open-source-prime-agent/ | TestingCatalog — release recap and continual-harness detail"
compare: "Dimension | Prime Agent (RLM) | Claude Code / classic tool loop | Roll-your-own CodeAct ;; Tool interface | Python in a persistent IPython kernel | One JSON tool call per turn | Python, but you build the sandbox ;; Where tool output lands | A variable you slice before it hits context | Appended to the context window every call | Wherever you wire it ;; Context handling | Context is a variable — filter/summarize on demand | Grows until you compact or edit it | Your problem ;; Sub-agents | Function calls, return async, non-blocking | Sub-agent as a tool call, usually blocking | Hand-rolled ;; Self-modification | Continual harness edits prompts/memories/skills, reversible | None built in | None ;; License / cost | Open source (MIT) | Proprietary product | Your time ;; Reach for it when | Long tasks where JSON tool-calling is the bottleneck | You want a polished, supported daily driver | You need total control and have the appetite"
art:
  archetype: network
  mood: luminous
  motif: "a single glowing Python REPL prompt from which nested function calls branch outward into smaller self-similar agent sessions, threads of light returning results asynchronously"
---

**What it is:** Prime Agent ([github.com/PrimeIntellect-ai/prime-agent](https://github.com/PrimeIntellect-ai/prime-agent)) is an open-source (MIT) harness for coding and long-running autonomous tasks, released by Prime Intellect on **2026-08-05**. Instead of the familiar loop where the model emits one JSON tool call and waits, Prime Agent hands the model a **persistent IPython kernel** and lets it write Python to inspect data, call tools, reshape its own context, and launch sub-agents. Prime Intellect calls the pattern an **RLM — Recursive Language Model**: *context is a variable, and sub-agent delegation is a function call inside a REPL.*

**Why it matters:** This is the cleanest shipped expression of the "code-mode" idea that has been circulating for a year — [programmatic tool calling](/posts/programmatic-tool-calling-gpt-56-vs-claude-vs-pydantic-codemode.html) and [CodeAct](/posts/microsoft-agent-framework-codeact-hyperlight.html) — turned into a runnable harness you can `curl` and drive today, rather than a pattern you hand-roll. If you have watched an agent's context window fill with tool output it barely used, the pitch lands immediately.

**Who should care:** Builders running agents on *long* tasks — multi-hour refactors, research runs, anything where the JSON-tool-call loop starts to creak under context pressure. If your agent work is short and interactive, a polished daily driver like Claude Code is still the lower-friction choice; Prime Agent's payoff shows up when the task outlives the context window.

## The two ideas that make it different

**Context is a variable.** In a classic tool loop, every result you fetch — a 400k-token log, a directory listing, a giant JSON blob — gets appended to the model's context whether it needs the whole thing or not. In Prime Agent that result is a **Python object**. The model can filter it, summarize it, count it, or hand a slice to a sub-agent, and only what it deliberately surfaces ever costs context. That reframes [compaction](/posts/context-editing-vs-compaction-for-long-running-agents.html) from a background garbage-collection problem into an explicit operation the agent performs in code.

**Sub-agents are function calls.** You don't hand a sub-agent a paragraph of instructions and block on it. You call it like a function; per Prime Intellect's writeup it returns immediately on admission and delivers its result **asynchronously**, so the main session keeps working while three sub-agents grind in parallel. It's the [Python-class model of an agent](/posts/how-to-build-an-agent-as-a-python-class-nvidia-nooa.html) taken one step further — the class can spawn more of itself.

## Getting started

```bash
# install
curl -fsSL https://app.primeintellect.ai/prime-agent/install.sh | sh

# authenticate (subscription/API key)
export ANTHROPIC_API_KEY=sk-ant-...

# run it in your project
cd /path/to/project
prime-agent
```

Once inside, you work in the kernel. The shape of a turn looks less like a tool schema and more like ordinary Python:

```python
# context is a variable — pull a big log, keep only what matters
log = read_file("build.log")              # 380k tokens, never enters the window
errors = [l for l in log.splitlines() if "ERROR" in l][-40:]

# a sub-agent is a function call — non-blocking
fix = subagent("Propose a patch for these errors", context=errors)

# ...keep working while `fix` resolves, then use it
apply_patch(fix.result())
```

Skills come in two forms — plain **markdown** and **Python-backed** — and you can ask Prime Agent to write them for you, which is the same [skill-authoring flow](/posts/how-to-build-a-claude-agent-skill-founder-guide.html) other harnesses have adopted, just closer to the code.

## The self-improving part, described honestly

"Self-improving" is a loaded phrase, so be precise about what it is and isn't. Prime Agent adds a **continual harness** that makes small, evidence-backed changes to the scaffolding *around* the model — supplemental prompts, memories, skill descriptions, and sub-agent specifications. Crucially, those edits are **explicit, persisted, and reversible**. It is not touching weights and it is not learning in any gradient sense; it is editing its own config files and keeping a trail so you can roll a change back. That's a much safer and more auditable thing than the name suggests — but it is also new, and a harness that rewrites its own instructions is exactly the kind of thing you want running in a sandbox first.

## Should you switch?

Not wholesale, not yet. The headline benchmark — **95.5% on ARC-AGI-3 with Opus 5**, just over the 95.4% human-expert baseline the team cites — is a real signal that the harness is competitive, but a single-harness number on one benchmark is a reason to try it, not a reason to migrate your production stack. The honest read: Prime Agent is the most legible open-source implementation of code-as-tools to date, it's MIT-licensed so there's no lock-in to evaluate it, and the context-as-variable model is genuinely the right shape for long tasks. Point it at a real refactor in a sandbox, watch what it does with your context, and decide from there. If you've been [building your own training loop around Prime Intellect's stack](/posts/prime-intellect-130m-train-your-own-agent-build-vs-buy.html), this is the inference-time companion to that bet.
