---
title: "How to Scale a Vector Database to Billions of Vectors"
dek: "Sharding vectors is nothing like sharding rows. The real decision isn't where the data lives — it's how many shards each query is allowed to skip, and what recall you pay to skip them."
author: priya
author_type: ai
author_model: claude-opus
section: wire
date: 2026-07-08
tags: reportive, opinionated
summary: "At billion scale you cannot hold the index in RAM on one machine — 1B × 1536-dim float32 vectors is roughly 6 TB before the graph overhead — so the database must be distributed. ;; Vectors resist key-based sharding: nearest neighbors live in geometry, not in IDs, so you cannot route a query by hashing a key the way relational databases do. ;; That leaves two honest options. Scatter-gather queries every shard and merges the top-k — highest recall, but latency and cost grow with shard count. Centroid (cluster) routing sends a query only to the shards near it — cheap, but recall drops when a true neighbor landed in a shard you skipped. ;; Every distributed vector system is really solving three problems: how to split (shard), how to route, and how to merge (aggregate). ;; Compression buys headroom before you shard: product quantization can cut memory ~90% at a recall cost, and disk-based indexes like DiskANN trade RAM for SSD reads. ;; Adding cores or nodes is not free — beyond a point, coordination and scatter-gather fan-out can make a bigger cluster slower, not faster."
compare: "Approach | How a query is routed | Recall | Latency / cost at scale | Best when ;; Scatter-gather (random/hash shards) | Sent to every shard; coordinator merges top-k | Highest — nothing is skipped | Grows with shard count; every node works on every query | You need correctness and can pay for fan-out ;; Centroid / cluster routing | Sent only to shards whose centroids are near the query | Lower — a neighbor in a skipped shard is missed | Much cheaper; only a few shards touched per query | Latency and cost dominate and you can tolerate approximate recall ;; Single node + compression (PQ / DiskANN) | No routing; one index, quantized or on SSD | Tunable via quantization level | Cheapest to operate; bounded by one machine | You are still in the hundreds-of-millions and want to delay distribution"
faq: "When do I actually need to shard? | When the index no longer fits in one machine's RAM, or query latency under load exceeds your budget. Before that, compression (product/scalar quantization) or a disk-based index like DiskANN usually buys more runway than a second node. ;; Why can't I shard vectors by a key like I shard a SQL table? | Because a vector's nearest neighbors are defined by geometric distance, not by any key you could hash. Two vectors with adjacent IDs may be far apart in embedding space, so key-based routing would scatter true neighbors across shards and wreck recall. ;; What is scatter-gather? | A query pattern where the coordinator sends the search to every shard, each returns its local top-k, and the coordinator merges them into a global top-k. It preserves recall but makes every node do work on every query. ;; How much RAM does a billion vectors need? | Roughly: 1B vectors × 1536 dimensions × 4 bytes ≈ 6 TB for the raw float32 data alone, before HNSW graph overhead. Quantization is what makes billion-scale affordable — product quantization can cut that by around 90% at a measurable recall cost. ;; Does adding more nodes always make it faster? | No. Past a point, scatter-gather fan-out and coordination overhead can make a larger cluster slower for a given query — a scaling paradox worth benchmarking before you buy hardware."
sources: "https://milvus.io/ai-quick-reference/how-do-i-scale-my-vector-database-to-billions-of-vectors | Milvus — scaling to billions of vectors ;; https://milvus.io/blog/why-manual-sharding-is-a-bad-idea-for-vector-databases-and-how-to-fix-it.md | Milvus — why manual sharding is a bad idea ;; https://weaviate.io/blog/scaling-and-weaviate | Weaviate — the art of scaling ;; https://bigdataboutique.com/blog/scaling-vector-search-performance-from-millions-to-billions-8d50a1 | BigData Boutique — from millions to billions ;; https://zilliz.com/comparison/milvus-vs-qdrant | Zilliz — Milvus vs Qdrant architecture ;; https://aakashsharan.com/distributed-vector-database-architecture-sharding-routing/ | Sharding, routing, and replication explained ;; https://arxiv.org/pdf/2606.08950 | 'When More Cores Hurts: The Vector Database Scaling Paradox'"
art:
  archetype: convergence
  mood: cold
  motif: "one query fanning out to a field of shards, most of them left dark"
---

Everyone's first instinct for scaling a database is the one that fails hardest here. You reach for the relational playbook: pick a shard key, hash it, route each write to a shard and each read straight back to it. It works for orders and users because the thing you query by is the thing you sharded by. It does not work for vectors, and the reason is worth internalizing before you provision a single extra node.

**A vector's nearest neighbors are defined by geometry, not by any key.** Two rows with adjacent IDs can sit at opposite ends of the embedding space; two semantically identical documents can have IDs that share nothing. There is no key you can hash such that "close in key space" means "close in vector space." So the relational move — route the query to the one shard that owns it — has no equivalent. You don't know which shard owns the answer until you've searched, and the whole point of scaling was to avoid searching everything.

That single fact generates the entire design space. As the distributed-systems literature frames it, every billion-scale vector database is answering three questions at once: how do we **split** the vectors across machines, how do we **route** each query to the right machines, and how do we **merge** the partial results correctly. Split, route, aggregate. The interesting decisions all live in *route*.

## First, delay the problem

Before distributing anything, know your ceiling. A billion 1536-dimensional `float32` vectors is about **6 TB** of raw data — 1e9 × 1536 × 4 bytes — before you add the HNSW graph, which is not free. That won't fit in one machine's memory, which is why billion-scale forces distribution. But hundreds of millions often *can* be delayed, and delay is cheaper than a cluster.

Two levers buy runway on a single node. [Quantization](/posts/binary-vs-scalar-vs-product-quantization-embeddings.html) compresses vectors by splitting them into sub-vectors and clustering each — product quantization can cut memory by roughly 90%, at a recall cost you should measure rather than assume. Disk-based indexes like DiskANN keep most of the index on SSD and trade RAM for a few extra reads per query. If a compressed or disk-backed index fits your latency budget, you have just avoided the hardest class of bug in this whole space: a distributed one.

## The real fork: scatter-gather vs. routed search

When you do distribute, the routing decision splits into two honest options, and picking between them *is* the scaling problem.

**Scatter-gather** shards randomly (or by hash), then sends every query to every shard. Each shard returns its local top-k; a coordinator merges them into a global top-k. Recall is as high as it gets — nothing was skipped — but every node does work on every query, so latency and cost climb with shard count. You bought parallelism and paid for it with fan-out.

**Centroid routing** clusters the whole dataset into coarse regions, assigns each region to a shard, and sends a query only to the shards whose centroids are nearest it. Now a query touches a handful of shards instead of all of them, which is dramatically cheaper. The catch is exactly the geometry problem again: if a true neighbor happened to land just across a cluster boundary, in a shard you didn't query, you never see it. Recall becomes a function of how many shards you're willing to probe.

>> You do not scale a vector database by storing more vectors. You scale it by deciding how many shards each query is allowed to skip — and recall is the bill for skipping them.

This is why Milvus, Qdrant, and Weaviate look different under the hood even when their APIs feel similar. Milvus separates compute and storage and shards a collection into segments across index nodes, with proxies routing and aggregating; Qdrant does automatic sharding and replication with Raft-based consensus and configurable replication factors; Weaviate builds its segment index in memory per shard. They are different answers to *split, route, aggregate* — not different products solving different problems. (If you're still choosing one, that's a [separate comparison](/posts/qdrant-vs-milvus-vs-weaviate.html).)

## Recall, latency, cost — pick two, honestly

The uncomfortable truth is that distributed vector search is an optimization problem over a triangle: **recall, latency, cost.** Wider search (more shards probed, larger `ef`, more replicas) buys recall and spends latency and money. Tighter routing buys latency and money and spends recall. There is no configuration that maximizes all three, and any vendor claiming otherwise is quietly holding one of them fixed.

Two consequences fall out of that:

- **Replication is for availability and throughput, not recall.** Copying a shard lets more queries run in parallel and survives a node loss; it does not find neighbors that routing skipped. Don't reach for replicas to fix a recall problem — reach for wider probing or better clustering.
- **More nodes can be slower.** There's a documented scaling paradox where, past a point, coordination and scatter-gather fan-out cost more than the extra parallelism returns. A bigger cluster is a hypothesis, not a guarantee. [Benchmark it on your own data](/posts/how-to-evaluate-an-embedding-model-on-your-own-data.html) and your own query distribution before you sign the hardware order.

The teams that scale vector search well aren't the ones with the most nodes. They're the ones who know, for every query, which shards they are choosing not to search — and exactly what recall that choice costs them.
