# dreaming.press — Distribution Kit

The mega LLM council (3 rounds, now **8.3/10**) is unanimous: the on-site product is
strong; the remaining lever to the ~1M-visits goal is **external distribution** — and
that part is yours, Gil. This kit is copy-paste ready so you can execute fast. Ordered
by leverage.

---

## 1. Product Hunt launch — "the Agent Stack Explorer" (highest leverage)
The `/build` + `/stacks` combo is a genuine PH-shaped product. Launch it as a tool, not
a blog.

- **Name:** dreaming.press Agent Stack Explorer
- **Tagline:** Pick one tool per job. Get a working AI-agent stack in 60 seconds.
- **Description:** A free, no-signup builder over 256 AI-agent tools. Choose your
  framework, LLM gateway, memory, retrieval, vector store, evals — filter by
  open-source / hosted / agent-self-signup — and export a shareable, embeddable,
  agent-readable stack. Plus a gallery of curated starter stacks (RAG, voice,
  open-source, support…), each forkable. Built by AI, for founders and their agents.
- **First comment (maker):** "We track the AI-agent tool landscape (pricing, MCP, and
  whether an agent can sign up for a key on its own) and turned it into a builder.
  Everything's free and there's a JSON/MCP API so your agent can request a stack too.
  Would love feedback on the picks." Link `/build`.
- **Assets:** the embeddable stack badge (`/embed/stack.svg`), 3–4 screenshots of
  `/build`, `/stacks`, a filled stack. Gallery page for the thumbnail.
- **Tip:** launch 12:01am PT Tue–Thu; line up 10–15 people to comment in the first hour.

## 2. Show HN
- **Title:** `Show HN: A free AI-agent stack builder (256 tools, JSON + MCP API)`
- **Body:** "I built a directory + builder for the AI-agent tool stack. Pick one tool
  per job and get a shareable stack; there's `/api/stack.json` and an MCP server so an
  agent can pull a recommendation. The whole publication is written by AI agents and
  every metric is public at /dashboard (incl. IP-verified crawler traffic — GPTBot has
  hit us ~4k times/2wk). Free, no signup. Curious what stacks people actually run."
  Link `/build`. Post 8–10am ET weekday.

## 3. Vendor badge-embed blitz (compounding backlinks)
Every tool in the directory is a potential backlink. Email each tool's DevRel/founder:

> Subject: You're in the dreaming.press AI-agent tool directory
> Hi [name] — [Tool] is listed in our AI-agent tool directory (dreaming.press/stack/[slug])
> and shows up in our Stack Explorer. Two things you might want: (1) a live "in the
> dreaming.press stack" badge you can embed (SVG, links back both ways), and (2) if any
> details are stale (pricing/MCP/agent-signup) reply and I'll fix them same day.
> — Gil

Start with the 30 tools that have the most GitHub stars / active DevRel. Even 20%
uptake = 6+ high-authority backlinks.

## 4. Weekly "Stack of the Week" (repeatable loop)
Publish one curated `/stacks/<slug>` page per week tied to a trend ("The stack behind
[hot launch]"), then post it to LinkedIn + X + the relevant subreddit (r/LocalLLaMA,
r/AI_Agents, r/LangChain) + your newsletter. Each is an indexable page + a social hook
+ a backlink magnet. The gallery makes these cheap to produce.

## 5. Turn on the newsletter (dormant)
`RESEND_API_KEY` isn't set, so 735+ queued subscribers get nothing. Add a Resend key to
`/etc/dreaming-press.env` (verify the from-domain) and the daily briefing + Stack-of-the-
Week can ship. This converts readers → repeat visitors, which is the time-on-site metric.

## 6. Owner GEO asks (unlock the answer-engine traffic the site is built for)
- **Google Search Console + Bing + Baidu**: add the domain property, paste me the
  `google-site-verification=…` TXT and I'll set it via Cloudflare (`scripts/cf-txt.sh`).
- **Wikidata** items for the publication + you as editor (feeds `sameAs`, entity authority).
- **Off-site seeding** under your name (Reddit/HN/newsletters) — ~91% of AI citations are
  third-party pages; the embed badge helps here.

---

### What's already built to make all of this land
Embeddable stack badge + stats badge · `/api/stack.json` + MCP `recommend_stack` ·
`/api/articles.json` + `/api/facts.json` (CC-BY) · IP-verified crawler dashboard ·
FAQ + schema everywhere · agents.txt · the whole Stack Gallery. The machine is built;
these six moves point traffic at it.
