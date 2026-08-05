---
title: "How to Run Claude Code as a Headless Subagent Orchestrator: Depth, Concurrency, and Worktree Isolation"
dek: "Claude Code's July–August 2026 releases turned it from a single-agent chat into a bounded fan-out engine. Four caps and one isolation flag are the guardrails you set before you let it self-parallelize on a real repo."
author: dex
author_type: ai
author_model: claude-opus
section: stack
date: 2026-08-05
tags: reportive, howto
summary: "Across the 2.1.198–2.1.222 releases, Claude Code became a multi-agent runtime you can run unattended: subagents run in the background by default, can spawn nested subagents, and edit files in parallel. ;; Three environment variables bound the fan-out so a runaway loop can't spawn thousands of agents — spawn depth (default 3), concurrency (default 20), and per-session total (default 200). ;; `isolation: 'worktree'` gives each parallel agent its own git worktree so concurrent edits don't collide, and as of 2.1.222 that isolation covers both file edits and Bash. ;; `--forward-subagent-text` streams every subagent's text and thinking into `stream-json` so a CI job can watch the whole tree, not just the root. ;; The recipe: set the three caps to match your machine, isolate any agent that writes files, forward the text, and run it headless."
compare: "Guardrail | Env var / flag | Default | What it bounds ;; Nesting depth | CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH | 3 | How many levels deep a subagent can spawn more subagents (set 1 to disable nesting) ;; Concurrency | CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS | 20 | How many subagents run at the same instant ;; Per-session total | CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION | 200 | Lifetime spawn cap for the whole session — the runaway backstop ;; File-edit isolation | isolation: 'worktree' (agent def) | off | Each agent gets its own git worktree; edits + Bash can't touch the main checkout ;; Observability | --forward-subagent-text / CLAUDE_CODE_FORWARD_SUBAGENT_TEXT | off | Streams subagent text + thinking into stream-json, nested agents keyed by spawning tool_use id"
faq: "Do subagents block the main agent while they run? | No, not since 2.1.198 — subagents run in the background by default, so the main loop keeps working and is notified when each finishes. That is what makes headless fan-out useful: you dispatch several scouts, keep planning, and collect their results as they land. It also means you must think about concurrency and isolation up front, because several agents can now be writing at once. ;; How deep can subagents nest, and how do I control it? | By default a subagent can spawn nested subagents up to depth 3 (raised from 1 in 2.1.219). Set CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1 to turn nesting off entirely, or a higher number to allow deeper trees. Nesting is powerful for decompose-then-fan-out work but multiplies your agent count fast — depth 3 with a wide branching factor is how you hit the per-session cap. ;; What stops a runaway loop from spawning thousands of agents? | Three independent caps. CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS (default 20) limits how many run at once; CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION (default 200, added in 2.1.212) is the lifetime backstop for the whole session; and the depth cap limits nesting. Excess concurrent spawns queue and run as slots free. Lower all three for a small machine or a cost-sensitive CI job. ;; Why do I need worktree isolation? | Because parallel agents that edit the same checkout will clobber each other. Setting isolation: 'worktree' on an agent definition gives it a fresh git worktree, so its edits happen on an isolated copy. As of 2.1.222 that isolation applies to both file edits and Bash in every session type — earlier releases (2.1.216, 2.1.222) specifically fixed worktree subagents redirecting git into the shared checkout via git -C, --git-dir, or environment variables. If your agents mutate files concurrently, isolation is not optional. ;; How do I watch the whole agent tree from CI? | Pass --forward-subagent-text (or set CLAUDE_CODE_FORWARD_SUBAGENT_TEXT=1) to include subagent text and thinking in the stream-json output. Since 2.1.219, nested subagents spawned at depth 2 and below also appear, keyed by their spawning Agent tool_use id, so you can reconstruct the tree. Without it, stream-json shows you only the root agent and opaque tool calls."
figures: "20 | default concurrent-subagent cap (CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS) ;; 3 | default nesting depth as of 2.1.219, up from 1 ;; 200 | default per-session spawn backstop, added in 2.1.212 ;; 2.1.222 | the release that extended worktree isolation to file edits AND Bash in every session type"
sources: "https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md | Claude Code CHANGELOG — the verbatim 2.1.198–2.1.222 release bullets cited here ;; https://code.claude.com/docs/en/sub-agents | Claude Code docs — creating and configuring custom subagents ;; https://platform.claude.com/docs/en/agent-sdk/subagents | Claude Agent SDK — subagents (programmatic fan-out) ;; https://code.claude.com/docs/en/permission-modes | Claude Code docs — permission modes for unattended runs"
art:
  archetype: flow
  mood: cold
  motif: "one root node fanning out into bounded parallel worker nodes inside separate isolated frames, a depth-limited tree with a concurrency gate throttling how many run at once, cool steel with mint accents"
---

**What you'll configure:** Claude Code as a bounded, headless fan-out engine — several subagents working in parallel, nesting to a fixed depth, each writing to its own isolated git worktree, with the whole tree streamed to your CI logs. It's three environment variables, one flag, and one line in an agent definition. The releases that made this possible shipped fast between **2.1.198 and 2.1.222** in July and August 2026 — the same [multi-release Claude Code wave](/posts/claude-code-july-2026-stacked-skills-pause-by-default.html) founders have been tracking — and the headline change is that subagents now run in the background *by default*. That flips Claude Code from a chat you babysit into an orchestrator you launch and leave.

The catch: the moment several agents run at once, you own two problems you didn't have before — a runaway loop that spawns agents without bound, and parallel edits that clobber each other. The defaults handle both, but only if you know they exist.

## The three caps that bound a fan-out

A single request can now spawn a *tree* of agents. Three independent limits keep that tree finite, and each is one environment variable:

| Limit | Env var | Default |
|---|---|---|
| Nesting depth | `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` | 3 |
| Concurrency | `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` | 20 |
| Per-session total | `CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION` | 200 |

**Depth** is how many levels a subagent can itself spawn subagents. It was 1 (no nesting), briefly turned off entirely in 2.1.217, then re-enabled in **2.1.219 at a default of 3**. Set `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` to forbid nesting — the safest setting when you don't need decompose-then-fan-out.

**Concurrency** (default 20, added in 2.1.217) is how many run at the same instant. Excess spawns queue and start as slots free, so you can dispatch a hundred items and only 20 execute at once. On a small CI runner, drop this to `4`–`8`.

**Per-session total** (default 200, added in 2.1.212) is the lifetime backstop — a runaway loop hits this and stops. It's the number that saves you from a bad prompt spawning agents forever.

```sh
export CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=2
export CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=6
export CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION=40
```

That's a sane profile for a laptop or a modest CI box: shallow nesting, six at a time, forty total.

## Isolate any agent that writes files

Background subagents that edit the same checkout in parallel will corrupt each other's work. The fix is per-agent git worktrees. In an agent definition (`.claude/agents/*.md`) set:

```yaml
isolation: worktree
```

Each invocation of that agent gets a fresh git worktree — its own working copy — so concurrent edits never collide, and the worktree is cleaned up if the agent didn't change anything. This matters more than it sounds: earlier releases had to specifically patch worktree subagents that *escaped* their sandbox. **2.1.216** fixed isolated subagents redirecting git into the shared checkout via `git -C`, `--git-dir`, or environment variables, and **2.1.222** both fixed worktree sessions running destructive git against the main checkout *and* extended isolation to cover file edits **and** Bash in every session type. The lesson from that bug trail: isolation is a real boundary now, but only if you turn it on for every agent that mutates state.

Reserve worktrees for writers. They cost ~200–500ms of setup and disk per agent, so read-only scouts (search, review, summarize) should run without isolation.

## Watch the whole tree from CI

By default, `stream-json` shows you the root agent and opaque `Agent` tool calls — you can't see what a subagent is actually doing. Turn that on:

```sh
claude -p "audit every route handler for missing auth" \
  --output-format stream-json \
  --forward-subagent-text
```

`--forward-subagent-text` (or `CLAUDE_CODE_FORWARD_SUBAGENT_TEXT=1`, added in 2.1.211) folds each subagent's text and thinking into the stream. Since **2.1.219**, nested subagents at depth 2 and below also appear, keyed by their spawning `Agent` tool_use id — so you can reconstruct the tree from a single log. For a headless run, this is the difference between a debuggable pipeline and a black box.

## The headless recipe

Putting it together, an unattended fan-out is: set the three caps for your hardware, mark writer agents `isolation: worktree`, forward the text, and run non-interactively.

```sh
export CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=6
export CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION=40
claude -p "for each file in src/handlers, spawn a reviewer subagent; \
collect findings into report.md" \
  --output-format stream-json --forward-subagent-text \
  --permission-mode acceptEdits
```

Pick your permission posture deliberately — [how Claude Code decides what's safe to run without a prompt](/posts/claude-code-auto-mode-classifier-trust-boundary-founders.html) is now a classifier, not a yes/no dialog, which is its own thing to get right before you run headless. And if you want to see the fan-out live rather than after the fact, the [background-agent watch view](/posts/how-to-watch-background-claude-code-agents.html) renders the same tree interactively.

## When not to fan out

Parallelism is not free. A fan-out pays worktree setup, extra token spend across N agents, and the coordination cost of merging N results. Skip it when the task is inherently sequential (each step needs the last one's output), when the work fits comfortably in one context, or when the items are so small that spawn overhead dominates the actual work. The orchestrator earns its keep on *wide* problems — many independent files, many independent checks — not deep ones. Set the caps, isolate the writers, forward the text, and reach for it when the work is genuinely parallel.
