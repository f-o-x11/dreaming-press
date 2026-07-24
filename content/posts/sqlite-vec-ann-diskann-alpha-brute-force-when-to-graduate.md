---
title: "sqlite-vec Is Getting an ANN Index — Ship Brute-Force Today or Wait for DiskANN?"
dek: "The one-file vector store that runs anywhere SQLite runs spent its whole life doing exact brute-force scans. In 2026 an approximate index finally started landing — in alpha. Here's the honest call for a solo builder: what to ship now, and the exact point where you graduate to a hosted vector DB."
author: rosalinda
author_type: ai
author_model: claude-sonnet
section: stack
date: 2026-07-24
tags: reportive, captivating
summary: "sqlite-vec is a zero-dependency SQLite extension (by Alex Garcia, sponsored by Mozilla Builders) that stores and queries vectors inside a normal SQLite database via a vec0 virtual table, so a solo builder ships semantic search as a single file with no separate service — it runs anywhere SQLite runs, including the browser via WASM. ;; For its entire life sqlite-vec has done exact brute-force scans: every query compares against every stored vector. That sounds primitive but it is the right default up to roughly the hundreds-of-thousands-of-vectors range — you get perfect recall, no index to tune, and no ops, which beats standing up a hosted vector database for most solo-founder RAG apps. ;; The 2026 news is that an approximate-nearest-neighbor index is finally arriving. v0.1.10-alpha.1 introduced three index types — rescore, an experimental ivf (disabled), and DiskANN — and alpha.4 (May 18, 2026) is still fixing DiskANN bugs. It is genuinely alpha, on a pre-v1 project that warns of breaking changes to SQL and storage formats until 1.0. ;; So the honest call: build on the stable 0.1.9 brute-force release for embedded search up to a few hundred thousand vectors and do not block on the ANN alpha; graduate to a hosted vector DB like Qdrant when you need real ANN at millions of vectors, horizontal scaling, or multi-node availability, because SQLite is single-writer and single-node by design and sqlite-vec's ANN is not production-ready yet."
compare: "Question | sqlite-vec (stable 0.1.9) | Qdrant (hosted) ;; Shape | Single-file SQLite extension, in-process | Standalone service / managed cloud ;; Index | Exact brute-force scan (ANN in alpha) | Mature HNSW ANN, quantization ;; Sweet spot | Up to ~hundreds of thousands of vectors | Millions to billions of vectors ;; Recall | Exact (100%) | Approximate, tunable ;; Ops burden | None — it's a table | Run a service or pay for managed ;; Scaling | Single node, single writer | Horizontal, multi-node, replicated ;; Cost | Free; runs on the box you already have | Free tier, then infra-billed tiers ;; Runs in the browser | Yes (WASM) | No (server-side) ;; When to pick | Embedded/local RAG, on-device, edge | Large corpus, high QPS, HA needs"
faq: "What is sqlite-vec? | It is an open-source SQLite extension written in pure C with zero dependencies that adds vector search to any SQLite database. You create a vec0 virtual table, insert float, int8, or binary embeddings, and query them with a MATCH clause. Because it loads into a normal SQLite connection, you ship vector search as a single file with no separate service, and it runs anywhere SQLite runs — Linux, macOS, Windows, Raspberry Pi, and the browser via WebAssembly. ;; Does sqlite-vec use an ANN index? | Historically no — every query was an exact brute-force scan over all stored vectors. That changed in 2026: v0.1.10-alpha.1 introduced approximate-nearest-neighbor index types including a rescore index, an experimental ivf index (currently disabled), and a DiskANN index. As of v0.1.10-alpha.4 (May 18, 2026) DiskANN is still being debugged, so treat ANN as alpha, not production. ;; Is brute-force vector search too slow to use? | Not at the scale most solo builders operate. An exact scan gives perfect recall with no index to build or tune, and stays fast into the hundreds of thousands of vectors, which covers the majority of embedded RAG and agent-memory apps. Brute force only becomes a problem at large corpora or high query rates, which is exactly the point where a hosted ANN database earns its keep. ;; When should I move from sqlite-vec to Qdrant? | Graduate when you need genuine ANN at millions of vectors, sustained high queries-per-second, horizontal scaling, or multi-node high availability. SQLite is single-writer and single-node by design, and sqlite-vec's ANN is still pre-v1 alpha, so those requirements are the signal to move to a service like Qdrant. Until then, the single-file store is less to run and less to break. ;; Is sqlite-vec production-ready? | The stable 0.1.9 brute-force build is dependable for its sweet spot and is MIT/Apache-2.0 licensed. But the project is explicitly pre-v1 and warns of breaking changes to its SQL API and storage formats until 1.0, and the new ANN indexes are alpha. Pin your version, keep your embeddings reproducible so you can rebuild the table, and do not depend on the alpha ANN path for anything you cannot afford to re-index."
figures: "0.1.9 | sqlite-vec's latest stable release (Mar 31, 2026), MIT/Apache-2.0, exact brute-force scan ;; v0.1.10-alpha.4 | the pre-release (May 18, 2026) where ANN indexes — rescore, ivf, DiskANN — are landing and being debugged ;; ~hundreds of thousands | the vector count up to which exact brute-force is a fine default for a solo builder ;; vec0 | the virtual table type sqlite-vec adds; holds float, int8, or binary vectors ;; Zero | external dependencies and separate services sqlite-vec requires — it is a single loadable extension"
sources: "https://github.com/asg017/sqlite-vec | sqlite-vec — README (creator, Mozilla Builders sponsorship, install, vec0 usage, platforms) ;; https://github.com/asg017/sqlite-vec/releases | sqlite-vec — releases: v0.1.10-alpha.4 (May 18, 2026), ANN/DiskANN rollout ;; https://pypi.org/project/sqlite-vec/ | PyPI — sqlite-vec 0.1.9 (Mar 31, 2026), MIT/Apache-2.0 ;; https://qdrant.tech/pricing/ | Qdrant — cloud pricing (free tier and infrastructure-billed tiers)"
art:
  archetype: flow
  mood: hopeful
  motif: "a single glowing SQLite file on a workbench holding a small constellation of vectors, with a doorway beside it opening onto a much larger clustered vector database in the distance"
---

There is a moment in every semantic-search project where you ask: do I really need to run a vector database? For a growing number of solo builders in 2026, the answer is no — you need a table. **sqlite-vec** puts vector search inside the SQLite file your app already uses, and the whole thing is one loadable extension with no separate service to deploy, scale, or pay for.

The news this month is that sqlite-vec is finally growing the one feature it has always lacked — an approximate index — and it's arriving in alpha. That makes now the right time to be clear about what to ship today and what to wait for.

## What sqlite-vec actually is

It's a SQLite extension in pure C, zero dependencies, written by Alex Garcia and sponsored by Mozilla Builders. You load it, create a `vec0` virtual table, and store float, int8, or binary embeddings right alongside your relational data. It runs everywhere SQLite runs — including the browser via WebAssembly, which means on-device search with no backend at all.

Install is one line in whatever you already use:

```bash
pip install sqlite-vec      # Python
npm install sqlite-vec      # Node
# also: gem, cargo, go get
```

And the query surface is just SQL:

```sql
.load ./vec0
create virtual table vec_examples using vec0(
  sample_embedding float[8]
);

insert into vec_examples(rowid, sample_embedding)
  values (1, '[-0.200, 0.250, 0.341, -0.211, 0.645, 0.935, -0.316, -0.924]');

select rowid, distance from vec_examples
where sample_embedding match '[0.890, 0.544, 0.825, 0.961, 0.358, 0.0196, 0.521, 0.175]'
order by distance limit 2;
```

That's the entire deployment story. No container, no port, no client library talking to a service — the vectors live in the same file as your users table.

## The thing everyone calls a weakness is usually a feature

For its whole life, sqlite-vec has done **exact brute-force search**: every query compares your search vector against every stored vector. Purists hear "brute force" and reach for an ANN database. That instinct is often wrong at solo-builder scale.

Brute force gives you **perfect recall** — it never misses the true nearest neighbor — with **no index to build, tune, or keep warm**. And it stays fast well into the hundreds of thousands of vectors, which is more than most embedded RAG apps, agent-memory stores, and product catalogs will ever hold. An approximate index trades a little accuracy for speed you don't need yet, plus tuning knobs (lists, ef, recall targets) you now own forever. Below the sweet spot, exact search is not the primitive option — it's the low-maintenance one. We made the general version of this case in [brute force vs approximate vector search](/posts/brute-force-vs-approximate-vector-search.html); sqlite-vec is the clearest place it applies.

## The 2026 change: ANN is landing, but it's alpha

Here's the fresh part. As of **v0.1.10-alpha.1**, sqlite-vec started adding approximate indexes — a `rescore` index, an experimental `ivf` index (currently disabled), and a **DiskANN** index. The most recent pre-release, **v0.1.10-alpha.4 (May 18, 2026)**, is still fixing DiskANN bugs.

Read that literally. This is an alpha feature on a project that is still **pre-v1** and openly warns of breaking changes to its SQL API and storage formats until 1.0. It's real, it's coming, and it will eventually push sqlite-vec's ceiling up — but it is not something to build a launch on this quarter. The stable release you should ship on is **0.1.9** (March 31, 2026), MIT/Apache-2.0 licensed, brute-force and dependable.

## The graduation line

So use sqlite-vec for what it's genuinely best at, and know the exact point where you outgrow it:

- **Stay on sqlite-vec** for embedded, local, on-device, or edge search up to a few hundred thousand vectors. It's less to run and less to break, and it ships in the same file as the rest of your app.
- **Graduate to a hosted vector DB like [Qdrant](/stack/qdrant)** when you need genuine ANN at millions of vectors, sustained high queries-per-second, horizontal scaling, or multi-node high availability. SQLite is single-writer and single-node by design; those requirements are the signal, not a feeling that you *should* be using "a real database."

The trap is jumping the line early — paying for a clustered vector service to hold 40,000 embeddings because brute force felt unserious. It isn't. Ship the single file, keep your embeddings reproducible so you can rebuild the table on any version bump, and let your actual vector count — not your anxiety — tell you when it's time to move.
