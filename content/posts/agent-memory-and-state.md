---
title: Agent Memory and State
dek: Nine repositories tackling the hardest unsolved problem in agent design — remembering, retrieving, and forgetting across the lifetime of a conversation.
author: indexer
section: stack
date: 2026-06-12
tags: reportive, captivating
---

An agent without memory is a brilliant amnesiac: capable in the moment, useless across time. The context window is not memory — it is working memory at best, and an expensive one. Real agent memory means deciding what to persist, how to retrieve it, and crucially when to forget. These nine repositories represent the current state of that art, from the vector stores that hold the embeddings to the memory layers that decide what is worth holding at all.

## The Memory Layers

The most direct attack on the problem is a dedicated memory layer that sits between your agent and its model. Mem0 has become the most-starred answer: a universal memory layer that extracts, stores, and recalls salient facts across sessions, so the agent that helped you yesterday recognizes you today. Letta — the project that grew out of the MemGPT research — takes the boldest position, treating memory management as a first-class operating-system concern with the agent paging information in and out of a hierarchical store.

@repo{mem0ai/mem0 | https://github.com/mem0ai/mem0 | A universal memory layer that extracts and recalls salient facts across sessions, giving agents continuity without stuffing the whole history into context. | Python | 58k}

@repo{letta-ai/letta | https://github.com/letta-ai/letta | The platform born from the MemGPT research — stateful agents that manage their own tiered memory like an OS pages RAM, learning and self-improving over time. | Python | 23k}

Where Mem0 and Letta think in facts, Cognee and Zep think in structure. Cognee builds a self-hosted knowledge graph so an agent's memories are connected rather than merely retrieved, and Zep layers a temporal knowledge graph that understands how facts change over time — that your address from last year is no longer your address now, a distinction flat vector search cannot make.

@repo{topoteretes/cognee | https://github.com/topoteretes/cognee | An open-source memory platform that builds a knowledge graph from an agent's history, giving persistent, connected recall across sessions. | Python | 18k}

@repo{getzep/zep | https://github.com/getzep/zep | A memory service built on a temporal knowledge graph that tracks how facts evolve over time — so an agent knows which version of the truth is current. | Python | 5k}

## The Vector Stores Underneath

Most memory ultimately rests on similarity search, and the vector database you choose shapes everything above it. Chroma is the developer-first default — embed, store, query, with almost no ceremony — and its rewrite into Rust made it genuinely fast. Qdrant occupies the performance tier: a Rust-built engine with rich filtering that scales from a laptop to a cluster without changing your code.

@repo{chroma-core/chroma | https://github.com/chroma-core/chroma | A developer-friendly, now Rust-powered vector database that makes embedding-backed memory a three-line affair — the easy default for agent retrieval. | Rust | 28k}

@repo{qdrant/qdrant | https://github.com/qdrant/qdrant | A high-performance, massive-scale vector search engine with powerful payload filtering — the choice when memory needs to be both large and fast. | Rust | 32k}

For teams whose data already lives in Postgres, pgvector is the pragmatic answer that avoids a whole new piece of infrastructure: vector similarity search as a native extension, so your agent's memory sits in the same transactional database as the rest of your application. And LanceDB is the sleeper worth knowing — an embedded, multimodal retrieval engine that runs in-process with no server to operate, ideal for agents that need fast local memory without standing up a database at all.

@repo{pgvector/pgvector | https://github.com/pgvector/pgvector | Vector similarity search as a native Postgres extension — keep agent memory in the same battle-tested database as the rest of your data. | C | 22k}

@repo{lancedb/lancedb | https://github.com/lancedb/lancedb | An embedded, serverless retrieval library for multimodal data that runs in-process — fast local agent memory with nothing to deploy. | Rust | 11k}

## The Outlier

One repository deserves its own category. GPTCache is not memory in the cognitive sense — it is a semantic cache, recognizing that a near-identical question has been asked before and returning the stored answer instead of paying for the model call again. For any agent operating at volume, this is the cheapest memory of all: the memory of what it has already said.

@repo{zilliztech/GPTCache | https://github.com/zilliztech/GPTCache | A semantic cache for LLM responses that recognizes paraphrased repeat queries and serves stored answers — the memory that saves money rather than context. | Python | 8k}

The honest summary is that agent memory is unsolved. Every project here makes a different bet about what matters — facts versus graphs, speed versus structure, recall versus forgetting — and the right answer depends entirely on what your agent is for. Pick the layer that matches your problem, put a real vector store beneath it, and remember that the hardest part is not storing memories but knowing which ones to throw away.
