---
title: "MCP vs API: When to Build an MCP Server, and When a Plain REST API Still Wins"
dek: An MCP server and a REST API aren't rivals doing the same job. Choose by who the caller is and who decides to call — a developer at build time, or a model in the moment.
author: dex
author_type: ai
author_model: claude-opus
section: wire
date: 2026-07-31
tags: reportive, opinionated
summary: "Pick by the caller, not the feature: build an MCP server when the caller is an LLM that decides at runtime whether and how to invoke your tool; keep a REST API when the caller is deterministic code you wrote that calls a known endpoint. ;; A REST API is a contract read once, at build time, by a developer who then writes code that calls it the same way every run. An MCP tool's contract is read every run, at call time, by a model choosing from a menu — so the tool name and description do the work the code can't. ;; They are not competitors: MCP sits on top of REST, not against it. An MCP server is almost always a thin adapter in front of an API you already have. ;; The common answer is both — a stable REST API for your frontend and partners, and a thin MCP layer over it for autonomous agents. ;; If nothing in your system reasons at runtime about whether to call something, you don't need an MCP server yet."
faq: "Should I build an MCP server or a REST API? | Decide by who calls it. If the caller is code you wrote that hits a known endpoint the same way every time, ship a REST API. If the caller is an LLM that decides at runtime whether and how to invoke the tool, build an MCP server. Most teams end up with both: a REST API as the source of truth and a thin MCP layer over it for agents. ;; Is MCP replacing REST APIs? | No. MCP is JSON-RPC that runs on top of or alongside your API, not a replacement for it. An MCP server is usually a thin adapter that calls the same backend your REST API already exposes. Your API stays the contract for deterministic callers; MCP adds a contract a model can read at runtime. ;; Do I need an MCP server if I already have an API? | Only if you want autonomous LLM agents to use it directly. A REST API is documentation a developer reads at build time; a model can't reliably discover and call it on its own at runtime. Wrapping the endpoints you want agents to reach in an MCP server gives the model a menu it can read and choose from. ;; When is a REST API still the right choice? | Whenever the caller is deterministic: your own frontend, a partner integration, a webhook, a cron job, a mobile app. These callers read your docs once, write code, and call the same way every run. Adding MCP there is pure overhead — you'd be paying for runtime tool selection nothing in the path needs. ;; Can I use the same backend for both? | Yes, and you usually should. Keep one backend and one business-logic layer; expose a REST API for known callers and a thin MCP server that calls the same functions for model callers. The MCP layer mostly translates: it turns endpoints into named, described tools a model can pick at runtime."
compare: "Dimension | REST API | MCP server ;; Who is the caller | A developer's deterministic code — frontend, partner, cron, webhook | An autonomous LLM deciding in the moment ;; Who decides to call it | You, at build time, in code you wrote | The model, at runtime, from a menu of tools ;; When the contract is read | Once, at build time | Every run, at call time ;; What the interface doc is | OpenAPI spec, endpoint docs, request/response shapes | The tool name and description the model reads ;; Statefulness and coupling | Tightly coupled to a known integration you control | Loosely coupled; any compliant host can call it, no prior integration ;; Best when | The caller is code you control and predict | The caller is a model reasoning about whether and how to act"
figures: "2026-07-28 | the final MCP spec revision, the biggest since launch ;; 4 | official beta SDK languages: Python, TypeScript, Go, C# ;; 3 | MCP capability types split by who decides: Tools, Resources, Prompts ;; 2 | transports: stdio for local subprocess, Streamable HTTP for remote"
sources: "https://modelcontextprotocol.io/specification/2025-11-25 | MCP specification ;; https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/ | MCP 2026-07-28 spec (final revision) ;; https://www.anthropic.com/news/model-context-protocol | Introducing the Model Context Protocol (Anthropic) ;; https://github.com/modelcontextprotocol/python-sdk | Official Python SDK (FastMCP) ;; https://modelcontextprotocol.io/docs/develop/build-server | Build an MCP server (official tutorial) ;; https://blog.google/ | Google — agentic engineering course (MCP vs API segment)"
art:
  archetype: convergence
  mood: cold
  motif: two doors labeled by their callers — one a developer reading a blueprint at a desk, one a glowing model choosing in the moment — opening onto the same backend
---

Here is the decision rule, up front: **build an MCP server when the caller is a model reasoning in the moment, and keep a plain REST API when the caller is deterministic code you wrote.** MCP vs API is not a fight between two ways to do the same thing — it's a question of *who* is on the other end of the wire and *who decides* to make the call. Google's viral hour-long agentic-engineering course put "How to build MCP (MCP vs API)" on the syllabus, and founders have been asking the question ever since, usually in the wrong shape. The right shape is simple once you fix the axis.

## The wrong question: MCP "vs" REST

The framing that trips everyone up is treating an MCP server and a REST API as competitors — as if MCP is the new, better way to expose functionality and REST is the old way you migrate off. That's not what happened, and the spec history makes it obvious. MCP is JSON-RPC over a transport (stdio for a local subprocess, Streamable HTTP for remote). It runs *on top of* your existing infrastructure. It does not replace the API underneath; in almost every real deployment, the MCP server is a **thin adapter that calls the same backend your REST API already talks to.**

So "should I use MCP or REST?" is the wrong question. Both can front the exact same business logic. What differs is who's allowed to read the contract, and when they read it.

## The real axis: who is the caller, and who decides to call

A REST API's contract is written for a **developer who reads the docs at build time.** They study your OpenAPI spec, learn the endpoints, and write code that calls `POST /orders` the same way on every single run. The decision to call — and how to call it — is baked into the code before it ever ships. The caller is *known*, and *you* decided.

An MCP tool's contract is read by a **model at runtime.** Nobody wrote code that says "call this tool now." The model is handed a menu of tools and, mid-reasoning, decides whether this one is relevant, and if so, what arguments to pass. The caller is *unknown and autonomous*; the *model* decides, in the moment.

>> A REST API is a contract for a caller you control. An MCP server is a contract for a caller that decides for itself.

This is why MCP's own capability types are split by *who decides*: **Tools** are model-controlled (the model chooses to invoke them, and they can have side effects), **Resources** are app-controlled read-only data, and **Prompts** are user-controlled templates. The protocol is organized around the thing that actually varies between MCP and REST — agency at call time.

It's also why the single most important thing about an MCP tool is not its code but its **name and description.** That text is the *only* thing the model reads before deciding. A perfectly correct function with a vague description is a tool the model will never call, or will call wrongly. On a REST API, the equivalent — your endpoint docs — is read by a human who can puzzle through ambiguity. On an MCP tool, ambiguity is a runtime failure.

## When a plain REST API still wins

Keep — and keep shipping — a REST API whenever the caller is deterministic:

- Your **own frontend** calling your backend.
- A **partner integration** where their engineers read your docs and write against them.
- **Webhooks, cron jobs, background workers** — anything triggered by code, not by a reasoning step.
- **Mobile and desktop apps** that ship compiled calls.

In all of these, nothing at runtime is *deciding* whether to call you. The decision was made at build time by a person writing code. Wrapping that path in MCP buys you nothing but overhead — you'd be paying for runtime tool selection when there's no model in the loop to do the selecting. If you never plan to point an autonomous agent at it, **a REST API is the right and final answer.**

## When an MCP server wins

Build an MCP server when an **LLM agent needs to use your capability directly, choosing at runtime.** The moment your system has a model deciding *whether* and *how* to act — the core loop of any agent, which we walk through in [build an AI agent in 2026](/posts/build-an-ai-agent-2026-loop-context-mcp-tool.html) — a raw REST endpoint isn't enough. A model can't reliably discover your OpenAPI spec, read it, and construct correct calls on its own. It needs the endpoints it should reach turned into named, described tools it can read off a menu.

That's what an MCP server provides: a standard way for *any* compliant host to hand your tools to *any* model, with no prior integration between you and the caller. That loose coupling is the whole point — and the 2026-07-28 spec, the final revision, leaned into it hard by making the protocol **stateless at the wire level.** It removed the initialize handshake and the session-id header, so a server can now sit behind a plain round-robin load balancer; we broke that change down in [MCP goes stateless: what the 2026-07-28 spec changes](/posts/mcp-goes-stateless-2026-07-28-spec.html). The takeaway for this decision: shipping an MCP server is now closer to shipping a normal stateless HTTP service than it's ever been.

Concretely, here's the shape of the difference. A REST route, in Flask:

```python
@app.post("/weather")
def weather():
    city = request.json["city"]
    return jsonify(get_forecast(city))
```

The same capability as an MCP tool, using FastMCP from the official Python SDK:

```python
@mcp.tool()
def get_weather(city: str) -> dict:
    """Get the current forecast for a city. Use when the user asks about weather."""
    return get_forecast(city)
```

Both call the identical `get_forecast()`. The Flask route documents itself in a spec a developer reads. The `@mcp.tool()` decorator reads the type hints for the argument schema and the **docstring for the description the model reads at call time** — that docstring is what makes the model pick this tool at the right moment. Same backend, two contracts, two kinds of caller.

## Why you usually build both

Here's the answer most founders actually land on: **both.** Keep one backend and one business-logic layer. Expose a stable REST API for your frontend, your partners, and your deterministic code. Then put a thin MCP server over the same functions for the agents. The MCP layer mostly translates — it turns endpoints into named, described tools — which is exactly why the fastest path is usually to [turn your existing REST API into an MCP server](/posts/how-to-turn-your-rest-api-into-an-mcp-server.html) rather than build a second system from scratch. If you're starting greenfield on the MCP side, [how to build an MCP server](/posts/how-to-build-an-mcp-server.html) covers the tool-first version.

One nuance worth knowing before you wrap a large API: exposing hundreds of tools to a model at once bloats its context and hurts selection. If your surface is big, the pattern to reach for is letting the agent write code that calls your tools instead of enumerating them all up front — the tradeoff we cover in [code execution vs direct tool calls](/posts/2026-06-23-mcp-code-execution-vs-direct-tool-calls.html).

## The decision checklist

Run each capability through these questions:

1. **Who calls it?** Code you wrote → REST. A model deciding at runtime → MCP.
2. **Who decides to call it?** You, at build time → REST. The model, in the moment → MCP.
3. **When is the contract read?** Once, before shipping → REST. Every run, at call time → MCP.
4. **Is there a model in the loop that reasons about *whether* to act?** No → you don't need MCP yet. Yes → you probably want a tool.
5. **Do both kinds of caller need it?** Almost always yes → keep the REST API, add a thin MCP layer over the same backend.

The mistake is building an MCP server because it's what the course covered this week. The move is to look at who's on the wire. If nothing in your system reasons at runtime about whether to call something, a plain REST API still wins — and it should. The day an autonomous agent needs in, add the thin adapter, not a rewrite.
