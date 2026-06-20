# Distribution playbook — ready-to-use assets

Owner-action items from the council (#8 community, #19 social, #23 outreach).
The code/pages are live; these are the human submissions. Lead with value, never
"an AI wrote this" (#14) — let people discover the meta-story on arrival.

## #8 — Cold-start wedge (HN + Reddit)

**Cadence:** one strong **Wire** or **Stack** artifact per week, Tue–Thu 8–10am ET.
Submit the *article URL* (never the homepage, never "Show HN: AI…"). If it gets
<5 points in the first hour, use the official second-chance pool:
https://news.ycombinator.com/pool

**HN title** = the plain article headline (e.g. "LangGraph vs CrewAI vs AutoGen: which to use").
First comment (you): one sentence of context + the non-obvious finding, then step back.

**Reddit targets** (post the artifact, then engage in comments):
- r/AI_Agents — frameworks, comparisons, "best X for Y"
- r/mcp — MCP server pieces
- r/LocalLLaMA — infra, evals, memory
- r/LangChain, r/Rag — RAG/vector-DB pieces
Subreddit-specific value title; read each sub's self-promo rules first.

**Best launch artifacts you already have live:**
- `/reports/state-of-ai-agents` — original data, the strongest HN/Reddit candidate
- `/compare/langgraph-vs-crewai` and the other comparison pages
- `/best/vectordb`, `/best/framework` roundups

## #19 — X + LinkedIn (build-in-public)

The meta-story *is* the hook: an autonomous AI newsroom that researches, writes,
illustrates, and ships itself. Daily loop:
1. **1 value thread** unpacking a Wire/Stack piece's key insight (5–7 posts; link last).
2. **2–3 replies** in live AI-builder threads (replies > likes for reach).
3. **1 "shipped today"** with a screenshot (new tool page, new comparison, a metric).

Starter thread (X):
> The AI-agent tooling landscape changes weekly. So we built a live tracker.
> 24 tools, real GitHub data, updated continuously — frameworks, memory, vector DBs, MCP, evals.
> Here's what the numbers say about who's winning each category 🧵
> [chart from /reports/state-of-ai-agents]

LinkedIn: same insight, reframed for operators ("how to choose your agent stack in 2026").

## #23 — Maintainer outreach (link loop)

After every Stack feature, email/DM the maintainer. Template:

> **Subject:** featured {repo} on dreaming.press
>
> Hi {maintainer} — we curate tooling for AI-agent builders and just published a
> page on {repo}: {url}. It pulls your live GitHub data and points readers to it.
> If it's useful, a link from your README/"used by"/"in the press" helps other
> builders find it. Either way, great work on {repo}.

Current Stack tools with active maintainers worth contacting (see `/tools`):
LangGraph, CrewAI, LlamaIndex, Mem0, Letta, Qdrant, Chroma, Langfuse, Phoenix,
Helicone, Ragas, promptfoo, FastMCP, E2B, Temporal.

## Measurement
Every visit is now attributed (`/newsroom` → "Where readers come from"): tag
campaign links with `?utm_source=hackernews|reddit|x|linkedin` so each channel's
engaged-reads and sessions are tracked. Judge channels by **engaged reads**, not
raw views.
