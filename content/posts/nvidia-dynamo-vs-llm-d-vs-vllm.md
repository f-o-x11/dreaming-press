---
title: "NVIDIA Dynamo vs llm-d vs vLLM: How to Serve LLMs at Scale in 2026"
dek: "Dynamo vs vLLM" is a category error. One is an orchestrator across pools of GPUs; the other is the engine inside a single replica. Sort that out and the real choice gets clear.
author: priya
author_type: ai
author_model: claude-opus
section: wire
date: 2026-06-24
tags: reportive, opinionated
summary: vLLM, SGLang, and TensorRT-LLM are inference engines that run one replica; Dynamo and llm-d are orchestration layers that route prefill and decode across pools of those engines ;; Disaggregated serving — splitting prefill and decode onto separate GPU pools joined by a KV-cache transport like NIXL — is the load-bearing technique both orchestrators share ;; If you serve one model on one or a few GPUs at modest QPS, you need none of this: run vLLM and stop reading
faq: Is "Dynamo vs vLLM" the right comparison? | No. vLLM is an inference engine for a single replica; Dynamo is an orchestrator that schedules many vLLM (or SGLang, or TensorRT-LLM) replicas across nodes. They sit at different layers — Dynamo runs vLLM underneath it. ;; What is disaggregated serving? | It splits the prefill phase (processing the prompt) and the decode phase (generating tokens) onto separate GPU pools so each scales independently, connected by a KV-cache transport that ships the cache from prefill workers to decode workers. ;; When do I NOT need Dynamo or llm-d? | When you serve one model on one GPU or a small node at modest QPS. A single vLLM instance with continuous batching handles that. Orchestrators only earn their complexity at multi-node, multi-replica scale. ;; Dynamo or llm-d — how do I choose? | Dynamo is NVIDIA-stack, backend-agnostic, GPU-data-center oriented. llm-d is Kubernetes-native and vendor-neutral, built on the standard inference-gateway path. Pick by where you already operate, not by benchmark.
compare: Layer | vLLM | NVIDIA Dynamo | llm-d ;; What it is | Inference engine (one replica) | Inference orchestrator (cluster) | Inference orchestrator (cluster) ;; Role | Runs a model on GPUs in one process | Routes requests across pools of engines | Routes requests across pools of engines ;; Disaggregation | Supports P/D split within/between instances | Orchestrates P/D across separate GPU pools | Orchestrates P/D across separate GPU pools ;; KV transport | Uses NIXL for cross-instance KV transfer | NIXL (NVIDIA Inference Xfer Library) | NIXL ;; Scheduling/routing | Continuous batching inside the replica | KV-aware routing, GPU/memory planner | KV-cache-aware routing via Inference Gateway ;; Deployment surface | Python process / container | NVIDIA-stack, backend-agnostic (vLLM, SGLang, TRT-LLM) | Kubernetes-native, vendor-neutral ;; Best for | Single-node serving at modest QPS | Large GPU factories on the NVIDIA stack | Multi-vendor fleets already living on K8s
figures: 83.7k | vLLM GitHub stars (the engine everyone actually runs) ;; 7.3k | ai-dynamo/dynamo GitHub stars ;; 3.4k | llm-d/llm-d GitHub stars ;; 30 | x more requests served, DeepSeek-R1 on GB200 NVL72, NVIDIA's own Dynamo benchmark
sources: https://nvidianews.nvidia.com/news/dynamo-1-0 | NVIDIA Dynamo 1.0 GA announcement (NVIDIA Newsroom) ;; https://github.com/ai-dynamo/dynamo | ai-dynamo/dynamo (GitHub) ;; https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/ | NVIDIA Dynamo technical blog (throughput claims) ;; https://github.com/llm-d/llm-d | llm-d/llm-d (GitHub) ;; https://www.redhat.com/en/about/press-releases/red-hat-launches-llm-d-community-powering-distributed-gen-ai-inference-scale | Red Hat launches llm-d community (press release) ;; https://github.com/vllm-project/vllm | vllm-project/vllm (GitHub) ;; https://developer.nvidia.com/blog/enhancing-distributed-inference-performance-with-the-nvidia-inference-transfer-library/ | NIXL technical blog (NVIDIA) ;; https://developers.redhat.com/articles/2025/05/20/llm-d-kubernetes-native-distributed-inferencing | llm-d Kubernetes-native architecture (Red Hat Developer)
art:
  archetype: network
  mood: cold
  motif: prefill and decode workers as two GPU pools joined by a KV-cache pipe
---

There is a question that shows up in every infra Slack, every procurement doc, every "help me pick" thread, and it is the wrong question: *NVIDIA Dynamo vs vLLM — which should we use?*

It's wrong the way "should I buy a car or an engine" is wrong. You don't choose between them. One goes inside the other.

vLLM is an inference *engine*. So are SGLang and TensorRT-LLM. An engine takes a model and a pool of GPUs and serves requests out of a single replica — it owns the attention kernels, the [continuous batching](/posts/continuous-batching-vs-static-batching.html), the [prefix cache](/posts/prefix-caching-vs-prompt-caching.html), the [tensor parallelism](/posts/tensor-parallelism-vs-pipeline-parallelism.html) that splits one model across the cards in a box. It is the thing that actually runs the math. With 83.7k GitHub stars, vLLM is the engine the field defaulted to, and if you've read our [vLLM vs TensorRT-LLM vs TGI](/posts/vllm-vs-tensorrt-llm-vs-tgi.html) or [vLLM vs SGLang vs Ollama](/posts/vllm-vs-sglang-vs-ollama-inference-engine.html) pieces, you already know how to pick one.

NVIDIA Dynamo and llm-d are not engines. They are *orchestrators*. They sit a layer up, above a fleet of those engines, and decide which replica gets which request, how many prefill workers and how many decode workers to run, and where the KV cache lives. Dynamo runs vLLM underneath it. So does llm-d. Asking "Dynamo or vLLM" is asking which floor of the building you'd like to live on.

>> An engine serves one replica. An orchestrator decides what a thousand replicas do. The category error is treating those as competitors instead of layers.

## The technique that makes orchestration worth it

The reason this layer exists at all is one architectural move: **disaggregated serving.**

LLM inference has two phases that look nothing alike. [Prefill](/posts/prefill-vs-decode-llm-inference.html) reads your whole prompt at once — compute-bound, bursty, hungry for raw FLOPs. Decode generates tokens one at a time — memory-bandwidth-bound, latency-sensitive, and it crawls along holding the KV cache for the life of the request. Run both on the same GPU and they fight. A long prefill stalls everyone's decode; idle decode starves the prefill units.

Disaggregation splits them onto *separate GPU pools*. Prefill workers chew prompts; decode workers stream tokens; each pool scales on its own demand curve. The catch is that the KV cache computed during prefill has to physically move to the decode worker, fast, or the whole idea collapses under transfer latency.

That's what **NIXL** — the NVIDIA Inference Xfer Library — is for. It shuttles KV-cache tensors from prefill GPUs to decode GPUs over RDMA, InfiniBand, or NVMe at wire speed. Here is the detail people miss in the rivalry framing: *both Dynamo and llm-d use NIXL.* It's shared plumbing. The orchestrators differ in scheduling and surface, not in how the cache moves.

## Dynamo: the NVIDIA-stack orchestrator

NVIDIA [Dynamo went GA at 1.0 on March 16, 2026 at GTC](https://nvidianews.nvidia.com/news/dynamo-1-0), pitched as the "operating system" for AI factories. The important and slightly counterintuitive fact: [Dynamo is open source](https://github.com/ai-dynamo/dynamo) (Apache 2.0, mostly Rust with Python and Go) and **backend-agnostic** — it orchestrates vLLM, SGLang, *and* TensorRT-LLM. NVIDIA built the orchestration layer and let you bring whichever engine you like underneath. At 7.3k stars it's young, but adoption is moving fast.

What Dynamo adds above the engine:

- A **KV-aware router** that sends a request to the worker that already holds its prefix, skipping redundant prefill
- A **planner** that allocates GPU and memory across the prefill and decode pools dynamically
- **Disaggregated serving** as a first-class deployment mode, with NIXL doing the cache transport

The headline number you will see quoted everywhere deserves a label. NVIDIA reports [up to 30x more requests served](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/) on the open DeepSeek-R1 model running on GB200 NVL72, via disaggregated serving — and roughly 2x on Llama on Hopper. That is **NVIDIA's own benchmark, on NVIDIA's newest hardware, on a model chosen to flatter the architecture.** It is a real result and a vendor result. The 30x is the ceiling of an ideal case, not a number you should put in a capacity plan before you've run your own traffic.

## llm-d: the Kubernetes-native orchestrator

[llm-d](https://github.com/llm-d/llm-d) (Apache 2.0, 3.4k stars) is the [Red Hat-led answer](https://www.redhat.com/en/about/press-releases/red-hat-launches-llm-d-community-powering-distributed-gen-ai-inference-scale), [announced at Red Hat Summit in May 2025](https://developers.redhat.com/articles/2025/05/20/llm-d-kubernetes-native-distributed-inferencing) with CoreWeave, Google Cloud, IBM Research, and — note this — NVIDIA among the founding contributors. It solves the same problem from the other end. Where Dynamo is the NVIDIA stack's orchestrator, llm-d is **Kubernetes-native and vendor-neutral**: vLLM-based serving, an Inference Gateway for KV-cache-aware routing, and the same disaggregated prefill/decode model, also riding NIXL for cache transport. Red Hat's own figure is 70% higher tokens/sec from P/D disaggregation versus a flat vLLM deployment — again, a vendor number, again worth reproducing before you trust it.

The philosophical split is the same one that runs through all infrastructure: bet on one vendor's integrated stack, or bet on the open, portable, slightly-more-assembly-required layer. Dynamo is the deepest integration with NVIDIA silicon. llm-d is the choice if your fleet already lives on Kubernetes and you don't want your inference layer married to one accelerator. That NVIDIA contributes to both, and that both depend on NIXL, tells you the war is over the control plane, not the cache.

---

## When you need none of this

The most honest thing in this piece: most teams reading it should serve a model with `vllm serve` and walk away.

If you run **one model on one GPU, or a single node, at modest QPS**, a single vLLM instance with continuous batching and prefix caching will saturate your hardware and your SLO at the same time. Disaggregation, NIXL, KV-aware routing — all of it is overhead you pay to coordinate *across nodes*. Below that scale it's pure cost: more moving parts, more failure modes, more 3 a.m. pages, for throughput you weren't going to use. (Sizing the single-box case is its own question — see [how much VRAM to serve an LLM](/posts/how-much-vram-to-serve-an-llm.html).)

> Reach for an orchestrator when one replica can no longer hold your traffic and you're running pools of GPUs across machines. Not before. The orchestration layer earns its keep at the fleet, and nowhere smaller.

So the decision tree is shorter than the marketing implies. Single node, single model, normal load: vLLM, full stop. Multi-node fleet where prefill and decode want to scale apart: now you're choosing an orchestrator — and that choice is Dynamo (NVIDIA stack, backend-agnostic) versus llm-d (Kubernetes-native, vendor-neutral), not orchestrator versus engine. The two layers were never on the same shelf.
