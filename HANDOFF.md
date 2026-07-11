# dreaming.press — handoff

## What we're building
**dreaming.press** — an AI-agent-authored tech news publication for founders,
solopreneurs, and CEOs early on their path. Goal: become the #1 tech/AI/startup
publication (~1M visits/month). It optimizes for exactly two things — **visitors**
and **time-on-site** — and shows every metric publicly. Homepage is "Global Tech
News" (top stories summarized + audio), plus lots of how-tos, tutorials, "X vs Y"
comparisons, tool/app highlights, APIs, and calculators.

## How it runs (laptop-independent)
- **Cloud newsroom**: an hourly cloud routine writes/updates content and pushes to
  `github.com/f-o-x11/dreaming-press` (main). It reads `analytics/BRIEF.md` first
  and commissions from real reader data.
- **Server deploy**: `gil-vm` (Hetzner, `root@5.161.106.173`) pulls every 10 min
  (`dreaming-deploy.timer` → `scripts/server-pull-deploy.sh`): fetch/reset → npm →
  ingest → generate covers (gpt-image-1) → **narrate new posts (gpt-4o-mini-tts)**
  → export analytics → restart → **commit media + analytics back to GitHub**.
- Live site: **https://dreaming.press** · public dashboard: **/dashboard**

## Done so far (this session)
- **Auto-narration is live and automatic** — every deploy narrates recent posts
  with a modern neural voice (gpt-4o-mini-tts, per-author voice cast). Fixed the
  deploy so this runs even on "up-to-date" cycles.
- **Audio backfill running** on the server (`--backfill`, newest-news-first,
  resumable) to narrate the whole ~800-post corpus. Coverage 14% → climbing.
- **Eval harness v2** (`app/scripts/eval-harness.js`): the old one was a checklist
  frozen at 9.5. v2 grades continuously against the north star. Honest baseline
  **7.11/10**; now **7.48** and rising. Gaps it exposes: audio (2.0→3.6) and
  engagement (5.3→5.5, capped by real 13s dwell).
- **Inline auto-linking** (`app/lib/autolink.js`): article bodies now link the
  first mention of a tool/topic to its page — the next-click lever + internal-link
  SEO. 432/878 posts carry inline links.
- **Traffic council** done → **`TRAFFIC-PLAN.md`** (21 ranked moves, 90-day plan,
  autonomous-vs-owner split, KPIs). Read it — it's the growth roadmap.
- **Executed council move #1**: fixed `classifyChannel` — the site was blind to its
  real front door (AI assistants). Now detects Western + Chinese engines
  (Yuanbao/Doubao/Kimi/DeepSeek/Baidu-AI/…), a `classifyAssistant` naming, a new
  dashboard **"AI assistants"** panel, an AI line in `analytics/BRIEF.md`, and a
  backfill that also cleaned old pollution (bare "openai"/"chatgpt" in post slugs
  had been miscounted as AI traffic). Live: dashboard shows Yuanbao.

## Next up (from TRAFFIC-PLAN.md — autonomous moves the agents ship next)
1. **Human-accountability layer** (move #2): named editor-in-chief on every article,
   corrections policy, editorial/AI-disclosure page + NewsMediaOrganization schema.
   This unlocks Google News AND defends the corpus from scaled-content enforcement.
   (Needs one owner input: real name + credentials + LinkedIn/X — see owner asks.)
2. **Answer-engine extraction** (move #6): front-load a 40-80w declarative answer,
   question-format H2s, real comparison tables — so assistants quote us.
3. **Extend the `indexable` quality gate** (move #4) to /compare, /stack, /best.
4. Let the **audio backfill** finish; re-score (audio 2.0 → targeting ~8-9).

## Owner asks (only you can do these — highest-leverage first)
See TRAFFIC-PLAN.md "Owner asks". Top 3: (1) give the agents your real name +
credentials to become the named editor-in-chief; (2) verify the site in Google
Search Console + Bing Webmaster (DNS TXT, you own the Hetzner DNS); (3) set up
Google Publisher Center once the trust pages are live.

## How to run / see it
- Live: `https://dreaming.press` · Dashboard: `https://dreaming.press/dashboard`
- Local dev: `cd app && npm start` (SSR on :3000) — but the builder is on another
  machine; use the live URL, never localhost.
- Score it: `cd app && node scripts/eval-harness.js`
- Tests: `cd app && npm test` (2527 green) · Visual QA: `npm run qa:visual` (36/36)

## Gotchas
- The cloud sandbox is **egress-blocked from dreaming.press**, so analytics reach
  the newsroom via committed `analytics/BRIEF.md` + `snapshot.json`, not by fetching.
- Server-generated media survives `git reset --hard` (untracked until the deploy's
  commit-back git-adds it). `DP_AI_MEDIA_TRACKED=1` on the server.
- Secrets live in `/etc/dreaming-press.env` (600): OpenAI + now OpenRouter keys.
- Newsletter is dormant: `RESEND_API_KEY` not set — 735 dispatches queued safely.
