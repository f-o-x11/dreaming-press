---
title: "How to Build an Event-Driven Agent with LlamaIndex Workflows 1.0"
dek: "From an empty file to a running fan-out-and-join agent in one sitting — using the minimal event bus that shipped stable on June 22, 2026. Copy-paste the steps, then swap in your own model and tools."
author: rosalinda
author_type: ai
author_model: claude-opus
section: stack
date: 2026-07-22
tags: reportive, captivating
summary: "LlamaIndex Workflows 1.0 (stable since June 22, 2026) is a minimal event-driven orchestrator: you subclass Workflow, write @step methods, and each step consumes one typed Event and emits the next. ;; A step that accepts a StartEvent runs first; a step that returns a StopEvent ends the run; everything in between is your own control flow. ;; This walkthrough builds a research agent that fans one topic out into several concurrent searches and joins the results back — the pattern that shows off send_event (fan-out) and collect_events (fan-in). ;; The whole engine is small enough to read in an afternoon, ships in Python and TypeScript, and wraps around whatever model or tool library you already use."
compare: "Piece | What it is | When you reach for it ;; StartEvent | The event that kicks off a run; carries your inputs | Always — one step must accept it ;; StopEvent | The event that ends a run; carries the result | Always — one step must return it ;; Custom Event | A typed message you define to pass data between steps | Every hand-off that isn't start or stop ;; ctx.send_event() | Dispatch an event now, including many at once | Fan-out: launch N concurrent branches ;; ctx.collect_events() | Buffer events until all expected ones arrive | Fan-in: join the branches back together ;; ctx.store | Shared key-value state for the run | Passing counts/config a later step needs"
faq: "What package do I install for LlamaIndex Workflows 1.0? | The standalone package is `llama-index-workflows` (pip install llama-index-workflows). Its imports live under the top-level `workflows` module — `from workflows import Workflow, step, Context` and `from workflows.events import StartEvent, StopEvent, Event`. If you're inside the full framework, the same classes are re-exported at `llama_index.core.workflow`. There's also a TypeScript implementation if your backend is Node. ;; How does a step know when to run? | By the event type it accepts. Each `@step` method takes one event parameter, and the runtime routes each event to whichever step subscribes to that type. The step accepting `StartEvent` runs first; a step returning `StopEvent` ends the workflow. You never write an execution order — the events are the order. ;; How do I run steps concurrently? | Emit several events with `ctx.send_event(...)` instead of returning one, and mark the consuming step `@step(num_workers=N)` so N copies run in parallel. To join them, call `ctx.collect_events(ev, [ResultEvent] * n)`, which returns `None` until all `n` results have arrived and then hands you the list. ;; How is this different from LangGraph or CrewAI? | Workflows is event-first and unopinionated — no built-in agents, just a typed event bus you wire yourself — where CrewAI is agent-first (role-playing crews) and LangGraph is graph-first (explicit nodes and edges). We compare the trade-offs in CrewAI Flows vs LlamaIndex Workflows and in LlamaIndex Workflows vs LangGraph."
sources: "https://www.llamaindex.ai/blog/announcing-workflows-1-0-a-lightweight-framework-for-agentic-systems | LlamaIndex — Announcing Workflows 1.0, a lightweight framework for agentic systems ;; https://pypi.org/project/llama-index-workflows/ | llama-index-workflows on PyPI ;; https://developers.llamaindex.ai/python/workflows-api-reference/workflow/ | LlamaIndex — Workflow API reference ;; https://developers.llamaindex.ai/python/workflows-api-reference/context/ | LlamaIndex — Context API reference (send_event, collect_events, store)"
art:
  archetype: flow
  mood: luminous
  motif: a single glowing topic node splitting into three parallel query lanes that merge back into one answer, blueprint lines on warm paper
---

Most agent tutorials hand you a loop you can't see inside. LlamaIndex **Workflows 1.0** — stable since **June 22, 2026** — does the opposite: the entire orchestrator is a typed event bus you wire yourself, small enough to understand in one sitting. You write steps, each step consumes one event and emits the next, and the events *are* the control flow. This walkthrough goes from an empty file to a research agent that fans a topic out into several concurrent searches and joins them back.

## 1. Install and grasp the three rules

```bash
pip install llama-index-workflows
```

The whole model is three rules: **a `@step` method consumes one typed event and returns the next; the step that accepts `StartEvent` runs first; the step that returns `StopEvent` ends the run.** Nothing else decides order — the event types do.

```python
from workflows import Workflow, step, Context
from workflows.events import StartEvent, StopEvent, Event
```

(Inside the full framework these are re-exported at `llama_index.core.workflow`; the standalone package puts them under `workflows`.)

## 2. Define your own events

Events are just typed messages. Define one per hand-off so the runtime — and the next reader of your code — knows exactly what flows where.

```python
class QueryEvent(Event):
    query: str

class ResultEvent(Event):
    query: str
    text: str
```

## 3. Write the fan-out step

The first step accepts the `StartEvent`, plans a few sub-queries, and **emits several events at once** with `ctx.send_event()`. It stashes the count in `ctx.store` so the join step later knows how many results to wait for, then returns `None` because it fanned out instead of handing back a single event.

```python
class ResearchFlow(Workflow):
    @step
    async def plan(self, ctx: Context, ev: StartEvent) -> QueryEvent | None:
        topic = ev.topic
        queries = [f"{topic} pricing", f"{topic} alternatives", f"{topic} reviews"]
        await ctx.store.set("expected", len(queries))
        for q in queries:
            ctx.send_event(QueryEvent(query=q))
        return None
```

## 4. Run the branches concurrently

The search step consumes each `QueryEvent`. Marking it `@step(num_workers=3)` lets three copies run in parallel — this is where an event bus earns its keep. Swap the stub for a real web-search or retrieval call.

```python
    @step(num_workers=3)
    async def search(self, ctx: Context, ev: QueryEvent) -> ResultEvent:
        text = await do_search(ev.query)   # your tool call goes here
        return ResultEvent(query=ev.query, text=text)
```

## 5. Join the results and stop

The join is the one trick worth learning. `ctx.collect_events(ev, [ResultEvent] * n)` buffers incoming events and returns `None` until all `n` have arrived — so this step is invoked once per result but only *proceeds* on the last one. Then it synthesizes and returns a `StopEvent`, whose payload becomes the run's return value.

```python
    @step
    async def synthesize(self, ctx: Context, ev: ResultEvent) -> StopEvent | None:
        n = await ctx.store.get("expected")
        results = ctx.collect_events(ev, [ResultEvent] * n)
        if results is None:
            return None
        answer = summarize([r.text for r in results])   # your LLM call goes here
        return StopEvent(result=answer)
```

## 6. Run it

```python
import asyncio

async def main():
    flow = ResearchFlow(timeout=60)
    answer = await flow.run(topic="vector databases")
    print(answer)

asyncio.run(main())
```

That's a complete, concurrent, branch-and-join agent in about forty lines — and you can see every transition. Want a live view of intermediate steps? Start the run without awaiting it and iterate the stream:

```python
    handler = flow.run(topic="vector databases")
    async for ev in handler.stream_events():
        print("progress:", type(ev).__name__)
    answer = await handler
```

## Where to take it next

Everything real plugs into a step: your model call, your retriever, an MCP tool, even a whole CrewAI crew. Because the orchestration is just events, you can add a `@router`-style branch (a step that emits different event types on different conditions) or a human-in-the-loop pause without touching the steps around it — the new event type is the only edit.

If you're still deciding whether this event-first model is the right foundation at all, read [CrewAI Flows vs LlamaIndex Workflows](/posts/crewai-flows-vs-llamaindex-workflows.html) for the agent-first alternative, and [LlamaIndex Workflows vs LangGraph](/posts/llamaindex-workflows-vs-langgraph.html) for the graph-first one. The engine you just built is deliberately the smallest of the three — which is exactly why it's the easiest to reason about when a run goes wrong.
