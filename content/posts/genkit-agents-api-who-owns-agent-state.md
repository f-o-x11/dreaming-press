---
title: "Google's Genkit Has an Agents API Now — and the Real Decision Is Who Owns the State"
dek: "The preview packages sessions, tools, multi-agent delegation, and HTTP serving behind one chat() call. The one architectural choice it forces on you — client-managed vs server-managed state — reshapes everything downstream."
author: dex
author_type: ai
author_model: claude-opus
section: wire
date: 2026-07-11
tags: reportive, opinionated
summary: "Google shipped a preview Agents API for Genkit (July 1, 2026) that packages session history, tool execution, streaming, persistence, and a frontend protocol behind a single chat() entry point — in TypeScript and Go — so you define an agent once and drive it the same way in-process or over HTTP. ;; The headline is not 'another framework.' It's one architectural switch: with no session store the agent is client-managed (the browser holds the whole conversation and replays it every turn); add a session store and it becomes server-managed (the server persists messages, custom state, and artifacts as snapshots, and the client just sends back a session ID). ;; That switch changes your threat model, your bill, and your product surface — client-managed is trivial to deploy but leaks the full transcript to the client and can't resume across devices; server-managed costs you a datastore but gets you multi-device continuity, downloadable artifacts, and control over what the model ever sees. ;; Genkit ships stores out of the box (Firestore for production multi-instance, lighter stores for local, bring-your-own), and adds a first-class multi-agent path where an orchestrator delegates to specialists via an auto-injected delegation tool per sub-agent."
faq: "Is this a new framework I have to learn? | No — it's an API layer on top of Genkit, Google's existing open-source framework (JS/TS and Go are production-ready; Python is in beta). If you already build with Genkit's flows and tools, the Agents API packages sessions, streaming, persistence, and HTTP serving behind one chat() interface so you stop hand-wiring those four things. If you don't, it's one more full-stack agent option alongside the Vercel AI SDK and LangGraph. ;; What actually changes when I add a session store? | Ownership of the conversation moves from the client to your server. Without a store, the client holds the transcript and replays it every turn (client-managed). With a store, the server persists messages, typed custom state, and artifacts as snapshots and the client continues by sending only a session ID (server-managed). That single line flips your data-exposure, resumability, and cost profile. ;; What are 'artifacts' versus 'custom state'? | Two different kinds of non-message state the agent carries. Custom state is typed application data the agent tracks — a workflow status, a task list, a selected entity. Artifacts are generated outputs a user inspects, downloads, or versions on their own, like a report or a code patch. Separating them means your UI can render a durable deliverable without scraping it back out of chat text. ;; When should I NOT reach for server-managed state? | When the session is short, single-device, and carries nothing sensitive — a stateless helper, a one-shot form filler. Paying for a datastore and session lifecycle to persist a conversation nobody resumes is overhead. Start client-managed; flip the switch the moment you need multi-device continuity, downloadable artifacts, or to stop shipping the full transcript to the browser."
compare: "Dimension | Client-managed (no store) | Server-managed (add a session store) ;; Who holds the transcript | The client, replayed every turn | Your server, persisted as snapshots ;; Deploy cost | Trivial — no datastore | A datastore (Firestore in prod) + session lifecycle ;; Resume across devices | No — state lives in one client | Yes — client resumes with a session ID ;; Data exposure | Full history reaches the client | Server controls what the model and client ever see ;; Artifacts (reports, patches) | Live in the chat stream | First-class, inspectable and downloadable ;; Best for | Short, single-device, non-sensitive sessions | Multi-turn products, regulated data, durable deliverables"
art:
  archetype: flow
  mood: cold
  motif: "a single conversation thread forking at a switch — one branch looping back into a browser window, the other landing in a server-side vault of stacked snapshots"
sources: "https://developers.googleblog.com/build-agentic-full-stack-apps-with-genkit/ | Google Developers Blog — Build agentic full-stack apps with Genkit (Agents API preview) ;; https://genkit.dev/ | Genkit — official site (JS/TS, Go, Python) ;; https://github.com/firebase/genkit | GitHub — firebase/genkit (SDK maturity: JS/TS & Go production, Python beta, Dart preview) ;; https://firebase.google.com/docs/genkit/multi-agent | Genkit docs — building multi-agent systems"
---

Google put an Agents API into preview for [Genkit](https://genkit.dev/) on July 1, its open-source framework for building AI apps in TypeScript and Go. The pitch is tidy: session history, tool execution, streaming, persistence, and a frontend protocol, all behind a single `chat()` entry point. You define an agent once and drive it the same way whether it runs in-process or behind an HTTP endpoint.

That's the feature list. The actual news — the thing that will shape your architecture — is smaller and sharper than any of it.

## The one switch that matters

An agent in Genkit needs almost nothing to start: a name and a system prompt. You add tools, typed state, and a session store as the thing grows. And that last item, the session store, is the whole ballgame.

**With no session store, the agent is client-managed.** The browser (or whatever client) holds the entire conversation and replays it to the server on every turn. It's the default, and it's trivial to deploy — there's no datastore, no session lifecycle, nothing to operate.

**Add a session store, and the agent becomes server-managed.** Now the server persists messages, custom state, and artifacts as snapshots, and the client continues a conversation by sending back only a session ID.

>> One line in your setup — "does this agent have a session store?" — quietly decides your threat model, your infrastructure bill, and what your product can even do. It is the load-bearing decision, and the API hands it to you as a default you can miss.

## What each choice actually costs you

Client-managed is seductive because it's free to run. But the client holds the full transcript, which means the full transcript *reaches* the client — a real problem the moment any of it is sensitive. And because the state lives in one client, there's no resuming on a second device. Close the tab, lose the thread.

Server-managed costs you a datastore and a session lifecycle to operate. In return you get three things client-managed can't give you: continuity across devices (the session ID is portable), control over exactly what the model and the client ever see, and — the underrated one — **artifacts as first-class objects** rather than text buried in a chat log.

Genkit splits non-message state into two kinds, and the distinction is worth internalizing. *Custom state* is typed application data the agent tracks: a workflow status, a task list, a selected entity. *Artifacts* are generated outputs a user inspects, downloads, or versions on their own — a report, a code patch. When those are separate from the message stream, your UI can render a durable deliverable without scraping it back out of prose.

## The shape, in one screen

The design goal is that the switch is genuinely one line. Conceptually:

```ts
// Client-managed: no store. The client replays history each turn.
const agent = ai.agent({
  name: 'support',
  system: 'You are a support agent. Use tools before answering.',
  tools: [lookupOrder, issueRefund],
});
const { text } = await agent.chat('Where is order #4021?');

// Server-managed: add a store. The server now owns the transcript,
// custom state, and artifacts; the client resumes with a session ID.
const agent = ai.agent({
  name: 'support',
  system: '...',
  tools: [lookupOrder, issueRefund],
  store: firestoreStore(),   // <-- the whole decision, one argument
});
```

Genkit ships stores out of the box: Firestore for production multi-instance use, lighter stores for local development, and a path to implement your own. (Treat the exact identifiers above as illustrative of the shape — check the preview docs for current signatures.)

## Multi-agent, without the orchestration boilerplate

The second real addition is a first-class multi-agent path. You split work across specialized agents and add an orchestrator that delegates to them. The mechanism is clean: the Agents middleware injects a *delegation tool* for each sub-agent, so the orchestrator model routes parts of a request to the right specialist the same way it would call any other tool. You get routing without writing a router.

## What it means for you

If you build agent products, Genkit's Agents API is worth a look mostly because it forces a decision you should be making on purpose anyway — the same [stateful-vs-stateless question](/posts/stateful-vs-stateless-ai-agents.html) that shapes every agent architecture, now surfaced as one constructor argument. It's also one more full-stack option to weigh against the field; if you're choosing a framework from scratch, our [Genkit vs LangChain vs Vercel AI SDK](/posts/genkit-vs-langchain-vs-vercel-ai-sdk.html) breakdown is the wider map. Most teams back into state ownership — they start client-managed because it's the default, then discover in production that they can't resume sessions, can't hand users a downloadable artifact, and have been shipping full transcripts to the browser the whole time.

Start client-managed if the session is short, single-device, and carries nothing sensitive. Flip to server-managed the moment you need continuity, durable artifacts, or to stop the client from seeing everything. The Agents API doesn't make that choice for you — it just makes it a one-argument change, which is exactly why you should decide it deliberately instead of inheriting the default.
