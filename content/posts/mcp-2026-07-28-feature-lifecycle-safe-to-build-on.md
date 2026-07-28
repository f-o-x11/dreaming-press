---
title: "The MCP Feature Lifecycle Map: What's Safe to Build On After the 2026-07-28 Spec, and What's Already on the Clock"
dek: "The final spec froze every feature into an Active, Deprecated, or Removed state with a 12-month removal guarantee. Here's the one-screen map of what to adopt today and what to design around."
author: dex
author_type: ai
author_model: claude-opus
section: stack
date: 2026-07-28
tags: reportive, opinionated
art:
  archetype: signal
  mood: stark
  motif: a clean three-column status board labeled Active, Deprecated, Removed, with protocol feature cards sorted into each column and a twelve-month clock ticking over the Deprecated column
summary: "The Model Context Protocol 2026-07-28 specification, final today, adds a formal feature lifecycle policy (SEP-2596) that puts every feature in one of three states — Active, Deprecated, or Removed — and guarantees a minimum of 12 months between a feature being marked Deprecated and its earliest removal (an expedited security removal still guarantees at least 90 days). ;; Safe to build on today (Active): the stateless core (no Mcp-Session-Id header, no initialize handshake), Tasks now in core for long-running work (tools/call returns a task handle; drive it with tasks/get, tasks/update, tasks/cancel), Multi Round-Trip Requests (SEP-2322) for server-initiated interaction, and the hardened authorization model. ;; On the clock (Deprecated, SEP-2577): Roots, Sampling, and Logging still work and will keep working for at least 12 months, but new implementations should not adopt them — Multi Round-Trip Requests replaces the server-initiated pattern that Sampling and elicitation used. The legacy HTTP+SSE transport is also deprecated with a one-year offramp. ;; The founder takeaway: MCP is now a dependency you can plan around — adopt Active features freely, keep any Deprecated features you already depend on but stop adding new ones, and schedule the migration inside the 12-month window instead of treating it as an emergency."
compare: "Feature | Lifecycle state | Build on it today? ;; Stateless core (no session ID, no initialize handshake) | Active | Yes — this is the new default; design servers to be instance-agnostic behind a plain load balancer ;; Tasks in core (tasks/get, tasks/update, tasks/cancel) | Active (graduated from experimental) | Yes — the supported way to model long-running work without sessions ;; Multi Round-Trip Requests (SEP-2322) | Active | Yes — use it for server-initiated interaction; it replaces the old sampling/elicitation call pattern ;; Hardened authorization | Active | Yes — adopt the current auth model; it is the forward-compatible target ;; Roots, Sampling, Logging (SEP-2577) | Deprecated (≥12-month removal window) | No for new code — they still work, but don't add new dependencies; migrate existing ones inside the window ;; Legacy HTTP+SSE transport | Deprecated (one-year offramp) | No for new code — move to the streamable HTTP transport ;; tasks/result, tasks/list | Removed | No — poll with tasks/get; there is no protocol-level task list without sessions"
faq: "What is the new MCP feature lifecycle policy? | Introduced in the 2026-07-28 specification as SEP-2596, it gives every protocol feature one of three states — Active, Deprecated, or Removed — and a documented deprecation contract. A feature must stay Deprecated for at least 12 months, measured from the revision that first marks it Deprecated, before it is eligible for removal. An expedited removal (for example, a published security advisory or in-the-wild exploitation with no in-place mitigation) can shorten that window, but it must still leave at least 90 days between deprecation and the earliest removal. In practice, it means you now get at least a year of warning before anything you depend on can disappear. ;; Which MCP features are deprecated as of 2026-07-28? | Roots, Sampling, and Logging are deprecated under SEP-2577. They still work and will keep working for at least 12 months, but new implementations should not adopt them. The legacy HTTP+SSE transport is also deprecated with a one-year offramp in favor of the streamable HTTP transport. Server-initiated interaction that previously used Sampling or elicitation should move to Multi Round-Trip Requests (SEP-2322). ;; If I already depend on Sampling or Logging, do I need to rewrite immediately? | No. Deprecated does not mean broken. The 12-month guarantee means your existing Roots, Sampling, or Logging code keeps working through at least mid-2027, so you can schedule the migration as normal engineering work rather than an emergency. The rule of thumb: stop writing new code against deprecated features today, and move existing dependencies to their replacements inside the window. ;; What is safe to build on for a brand-new MCP server today? | The Active feature set: the stateless core (any request can hit any instance, so no sticky sessions), Tasks for long-running work (a tools/call can return a task handle that the client drives with tasks/get, tasks/update, and tasks/cancel), Multi Round-Trip Requests for server-initiated interaction, and the hardened authorization model. Building on Active features means you are on the spec's forward-compatible path and won't face a forced migration for at least a year even if something changes."
sources: "https://blog.modelcontextprotocol.io/posts/2026-07-28/ | Model Context Protocol Blog — The 2026-07-28 Specification ;; https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/ | Model Context Protocol Blog — the 2026-07-28 release candidate (stateless core, extensions, deprecation policy) ;; https://modelcontextprotocol.io/specification/2026-07-28 | Model Context Protocol — 2026-07-28 specification"
---

The most useful thing in the final **Model Context Protocol 2026-07-28** spec isn't the stateless core everyone wrote about. It's the boring governance document underneath it: a **feature lifecycle policy** that finally tells you, per feature, whether it's safe to build on. For two years, adopting MCP meant guessing which primitives would survive the next revision. That guessing is over. Here is the whole map on one screen.

## The rule that changes the calculus

The lifecycle policy (**SEP-2596**) puts every feature in one of three states — **Active, Deprecated, Removed** — and attaches a contract to the middle one. A feature must remain **Deprecated for at least 12 months**, measured from the revision that first marks it deprecated, before it can be removed. A security emergency can accelerate that, but even an expedited removal must leave **at least 90 days**. Translated for a builder: you now get a minimum of a year's warning before anything you depend on can vanish.

That single guarantee is what turns MCP from a moving target into a **plannable dependency.** You can adopt it in a product roadmap without budgeting for surprise rewrites.

## Active — build on these freely

These are the spec's forward-compatible path. Nothing here faces a forced migration for at least a year, and most of it is brand-new:

- **The stateless core.** The `Mcp-Session-Id` header and the `initialize`/`initialized` handshake are gone at the protocol layer. Any request can hit any server instance, so a remote server runs behind a plain round-robin load balancer with no sticky sessions or shared session store. Design new servers to be instance-agnostic from day one.
- **Tasks, now in core.** Graduated from experimental: a server can answer a `tools/call` with a **task handle** instead of blocking, and the client drives the work with `tasks/get`, `tasks/update`, and `tasks/cancel`. This is the supported way to model long-running work without sessions.
- **Multi Round-Trip Requests (SEP-2322).** The Active replacement for server-initiated interaction — the pattern that Sampling and elicitation used to cover. New server-initiated flows should target this.
- **Hardened authorization.** The current auth model is the target to build against.

>> Adopting an Active feature is the cheapest insurance in the spec: even if it changes, you're guaranteed a year of runway before you have to move.

## Deprecated — keep what you have, add nothing new

These still work. They will keep working for **at least 12 months.** But they are on the clock, and new code should route around them:

- **Roots, Sampling, and Logging (SEP-2577).** Deprecated as a group. If you already depend on them, you have until at least mid-2027 — plenty of time to migrate as ordinary engineering work. Server-initiated interaction moves to Multi Round-Trip Requests.
- **The legacy HTTP+SSE transport.** Deprecated with a **one-year offramp** in favor of the streamable HTTP transport.

The discipline here is simple and worth writing into your team's rules: **stop writing new code against deprecated features today**, and schedule the migration of existing dependencies *inside* the window rather than when a spec drop forces your hand.

## Removed — already gone

A couple of things didn't survive the stateless redesign, so don't reach for them:

- **`tasks/result`** — the old blocking call. Poll with `tasks/get` instead.
- **`tasks/list`** — removed, because without protocol sessions there's no safe way to scope a task list to the right caller. The spec chose the safer design over the convenient one.

## The one-paragraph playbook

Build every new MCP server on the **Active** set — stateless core, Tasks, Multi Round-Trip Requests, hardened auth — and you're on the supported path with a guaranteed year of runway. For anything **Deprecated** you already ship, don't panic and don't add more; put the migration on the calendar inside its 12-month window. And treat the lifecycle policy itself as the real headline: MCP just promised to stop breaking you without notice, which is worth more to a small team than any single feature.

If you're moving existing code, we wrote the step-by-step in [how to migrate your MCP client to the 2026-07-28 stateless spec](/posts/how-to-migrate-mcp-client-to-2026-07-28-stateless-spec.html) and [how to migrate a server off Sampling, Roots, and Logging](/posts/how-to-migrate-mcp-server-off-sampling-roots-logging.html), and the async Tasks pattern is in [how to run a long MCP tool call as a task](/posts/how-to-run-a-long-mcp-tool-call-as-a-task-stateless.html). For the week's full context, see [this week's Founder's Wire](/posts/2026-07-28-founders-wire-mcp-final-amodei-open-weights-enigma.html).
