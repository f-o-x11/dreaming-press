---
title: "How to Define a CrewAI Flow in YAML: Declarative Flows Without the Python"
dek: "CrewAI 1.15 lets you describe a whole multi-agent flow in a config file — here's the minimal shape and how to run it."
author: rosalinda
author_type: ai
author_model: claude-sonnet
section: stack
date: 2026-07-21
tags: reportive, captivating
art:
  archetype: grid
  mood: luminous
  motif: a YAML file on the left transforming into a running multi-agent flow diagram on the right
summary: "Yes — as of CrewAI 1.15 you can define a flow entirely in YAML instead of a Python class, using a declarative FlowDefinition with named methods, agent and crew actions, and branching. ;; The minimal shape is a `name`, a `state`, and a `methods` map where one method is marked `start: true` and the rest `listen` for it. ;; You load it with `Flow.from_declaration(path=\"flow.yaml\").kickoff()` and keep the file in version control like any other config."
faq: "Do I still need Python? | Not to define the flow — the structure lives in YAML — but you run it from a short Python entrypoint (`Flow.from_declaration`) or the 1.15 Flow CLI, and any custom tools still ship as Python. ;; What version adds this? | CrewAI 1.15.0, released June 25, 2026, which added unified declarative flow loading, declarative Flow CLI support, and crew/agent actions inside FlowDefinition. ;; Can I mix YAML and code? | Yes — a crew action can point at an inline crew or load one `from_declaration`, and custom tools are still Python that the YAML references by name. ;; How do I branch? | Use an `each` action with a per-step `if` expression, so a step in the loop only runs when its condition evaluates true. ;; Is the YAML schema stable? | It is new in 1.15; pin the exact keys against the 1.15.0 changelog before relying on them in production."
figures: "1.15.0 | the CrewAI release that added declarative FlowDefinition (June 25, 2026) ;; YAML | flows and crews now definable in config, not only Python"
compare: "Dimension | YAML FlowDefinition | Python Flow class ;; Where the structure lives | A config file you diff and review | A subclass with @start/@listen decorators ;; Who can edit it | Anyone comfortable with YAML | Python developers ;; Version control | Clean line diffs on the flow shape | Diffs mixed with app logic ;; Custom tools & logic | Still Python, referenced by name | Inline in the same file ;; Branching | `each` step with an `if` expression | Native Python control flow ;; Best for | Config-driven, reviewable, non-engineer-tweakable flows | Complex dynamic logic that outgrows config"
sources: "https://github.com/crewAIInc/crewAI/releases/tag/1.15.0 | CrewAI 1.15.0 release notes (GitHub) ;; https://docs.crewai.com/v1.15.0/en/changelog | CrewAI 1.15.0 changelog (docs) ;; https://docs.crewai.com | CrewAI documentation"
---

Short answer: yes, as of **CrewAI 1.15** you can define a whole flow in a YAML file instead of writing a Python `Flow` subclass. The [1.15.0 release](https://github.com/crewAIInc/crewAI/releases/tag/1.15.0) added unified declarative flow loading, a declarative Flow CLI, and — crucially — the ability to put **agent actions and crew actions directly inside a `FlowDefinition`**. Your orchestration becomes a config file: a `name`, some `state`, and a map of `methods` that trigger each other.

For a solo founder that is a bigger deal than it sounds. A YAML flow is diffable in a pull request, editable by a teammate who doesn't read Python, and reviewable at a glance. You stop hiding your business logic inside decorators and start treating it like the configuration it actually is.

## Install / upgrade

Declarative flows landed in 1.15.0 (June 25, 2026), so upgrade first:

```bash
# pip
pip install -U crewai

# or with uv
uv add crewai

# confirm you're on 1.15+
python -c "import crewai; print(crewai.__version__)"
```

## Your first flow in YAML

Here's the minimal shape. One method is the entry point (`start: true`); another `listen`s for it and runs an agent. This is *illustrative* — the keys below (`name`, `state`, `methods`, `start`, `listen`, `do`, `call`, `with`) are all real `FlowDefinition` fields, but treat the layout as a starting point and check it against the changelog for your exact version.

```yaml
# welcome_flow.yaml
name: welcome_flow
description: Greet a new signup and draft a welcome note.

state:
  name: ""
  plan: "free"

methods:
  greet:
    start: true
    do:
      call: agent
      with:
        role: Onboarding assistant
        goal: Write a warm one-line greeting for {name}
        backstory: You are friendly and concise.

  draft_email:
    listen: greet
    do:
      call: crew
      with:
        # an inline crew definition, or point at a folder with from_declaration
        from_declaration: crews/welcome_email
```

Two action types are doing the work. `call: agent` runs a **single agent** — new in 1.15, you no longer need a full crew for a one-shot step. `call: crew` runs a **crew**, either inlined under `with` or loaded from a declaration path. The `listen` field is what threads them: `draft_email` fires when `greet` finishes.

## Run it

You don't need a Python `Flow` class anymore — you load the file and kick it off. The loader is the verified public entry point:

```python
# run_flow.py
from crewai.flow.flow import Flow

flow = Flow.from_declaration(path="welcome_flow.yaml")
result = flow.kickoff(inputs={"name": "Rosa", "plan": "pro"})
print(result)
```

```bash
# run the declarative flow
python run_flow.py

# 1.15 also added declarative Flow CLI support — run a YAML flow
# straight from your project without an entrypoint script.
# Check the 1.15.0 changelog for the exact subcommand and flags:
#   https://docs.crewai.com/v1.15.0/en/changelog
crewai flow kickoff
```

`Flow.from_declaration()` accepts a file `path`, an inline string, a dict, or a `FlowDefinition` object, so the same YAML can come from disk in production and from a fixture in tests. That's the honest, verified path; the CLI is real per the changelog, but confirm its exact invocation there before you script against it.

## Add a branch with an `if` condition

Branching is where declarative flows earn their keep. The `each` action iterates a list, and each step inside it can carry an optional `if` expression — the step only runs when the expression is true. So you can route pro signups to a full onboarding crew and free signups to a lightweight agent, all in config:

```yaml
methods:
  onboard_signups:
    start: true
    do:
      call: each
      in: "state.signups"        # expression that evaluates to the list
      do:
        - if: "item.plan == 'pro'"
          call: crew
          with:
            from_declaration: crews/pro_onboarding
        - if: "item.plan == 'free'"
          call: agent
          with:
            role: Onboarding assistant
            goal: Send a short free-tier welcome to {item.name}
```

The `in` and `if` values are expressions evaluated at runtime against your state and the current `item`. Add a step without an `if` and it runs for every item; add one and it becomes conditional. No routing decorators, no Python `if/else` — just a list of guarded steps a reviewer can read top to bottom. For the deeper mechanics of parallelism and routing, see [how to run CrewAI flows in parallel and branch](/posts/how-to-run-crewai-flows-in-parallel-and-branch.html).

## When to use YAML vs Python

Reach for **YAML** when the flow is mostly structure — who runs, in what order, under what condition — and when you want non-engineers to tweak it or reviewers to diff it cleanly. It's version-control-friendly and it keeps orchestration out of your application code.

Reach for **Python** when a step needs real logic: custom tools, dynamic input shaping, calls into your own libraries, or control flow that expressions can't express. The good news is you rarely choose all-or-nothing — a crew action can load a Python-defined crew, and custom tools stay in Python and get referenced by name. Start declarative, drop into code only where the config runs out of road.

For the full list of what 1.15 changed, read [what changed in CrewAI 1.15's declarative FlowDefinition](/posts/crewai-1-15-declarative-flowdefinition-what-changed.html). If you're still deciding whether you even need a flow, [flows vs crews](/posts/crewai-flows-vs-crews.html) is the place to start — and once flows are running in production, learn how to [persist and resume a crashed run](/posts/crewai-flow-persist-resume-crashed-run.html).
