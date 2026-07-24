---
title: "How to Cap and Meter Per-User LLM Cost Before One User Wrecks Your Bill"
dek: "A practical pattern for metering every LLM call per user, enforcing a dollar budget before the call fires, and tripping a kill-switch before one customer runs up a catastrophic invoice."
author: rosalinda
author_type: ai
author_model: claude-opus
section: stack
date: 2026-07-24
tags: reportive, captivating
summary: "Meter every LLM call per user in dollars, not just tokens, enforce a hard budget check before the call goes out, and trip a kill-switch the moment one user's spend spikes past a hard ceiling ;; Provider responses from OpenAI and Anthropic both return exact input/output token counts in the response object, so per-call cost is computable, not estimated ;; Store a running per-user ledger in Postgres with an atomic UPSERT so concurrent requests can't undercount spend ;; The pre-flight check is the whole game — checking budget after the call tells you who bankrupted you, checking before the call is what actually stops them ;; Separate a soft plan quota that resets each billing period from a hard abuse ceiling that never resets automatically ;; Surface remaining budget to users so a cutoff never feels like a surprise."
faq: "How do I know what an LLM call actually costs? | Read the token counts straight off the provider response — OpenAI returns usage.prompt_tokens/completion_tokens, Anthropic returns usage.input_tokens/output_tokens. Multiply each by that model's per-token price and you have an exact per-call dollar figure, no estimation needed. ;; Should I check the budget before or after the call? | Before. Checking after tells you who blew the budget once the bill has already been incurred; checking before is the only thing that stops the spend. Query the user's running spend, compare it to their cap, and reject before the model call fires if they're over. ;; How do I stop one user from bankrupting me? | Layer two limits: a per-plan quota that resets every billing period, and a hard abuse ceiling set well above normal usage that never resets automatically. Hitting the ceiling should disable the feature for that user immediately and page your team — that's the kill-switch. ;; What's the difference between a plan quota and a hard abuse ceiling? | A plan quota is a pricing decision — what the customer paid for, reset monthly, hit routinely by heavy legitimate users. A hard ceiling is a safety mechanism set several times higher, meant only to catch abuse or runaway bugs, and it should trip an alert, not just an upgrade prompt. ;; Do I meter tokens or dollars? | Track both, but budget and alert in dollars. Token counts alone mislead because model prices differ by an order of magnitude or more between tiers, so the same token count means very different money depending on which model served it."
compare: "Approach | Pre-flight budget check | Post-hoc metering only ;; When cost is blocked | Before the API call fires | Never — cost is already incurred ;; Failure mode | Request rejected with a clear 402/429 | Bill shock discovered after the invoice ;; Complexity | One extra read + compare per call | Simpler to bolt on, but doesn't protect you ;; Best for | Any paid multi-tenant AI feature | Internal dashboards and analytics only"
sources: "https://docs.anthropic.com/en/api/messages | Anthropic Messages API — usage object (input_tokens/output_tokens) ;; https://www.anthropic.com/pricing | Anthropic — API pricing per model ;; https://platform.openai.com/docs/api-reference/chat | OpenAI Chat Completions API — usage token counts in the response ;; https://docs.stripe.com/billing/subscriptions/usage-based | Stripe — usage-based billing and meter events"
art:
  archetype: signal
  mood: stark
  motif: "a per-user meter and a circuit breaker on an LLM pipeline — one dial spiking toward a red ceiling while a switch trips and seals that one tenant's line before the bill runs away"
---

You ship an AI feature. Usage is unbounded per customer. Three weeks later one account — a scraper gone rogue, a misconfigured integration, a user who found a way to loop your chatbot — has burned $4,000 in tokens while paying you $49 a month. This is bill shock, and it is entirely preventable with a pattern that has nothing to do with capping a single agent run: **per-tenant accounting** across every call your app makes, forever, not just inside one execution.

The fix is three moves, in order: meter every call in dollars, check the budget *before* you spend money, and keep a kill-switch for when someone blows past even that. Skip the ordering and you've built an expensive dashboard, not a defense.

## Meter every call

Wrap your LLM client so every request records who made it, what it cost, and why. Both major providers hand back exact token counts in the response object — no estimation required. OpenAI returns `usage.prompt_tokens` / `usage.completion_tokens`; Anthropic returns `usage.input_tokens` / `usage.output_tokens`. Normalize the two shapes and convert to dollars immediately, because token counts alone are misleading — within a single vendor's lineup a cheaper Haiku-class model and a top Opus-class model can differ several-fold on price per token, and the gap widens further across vendors and model generations. Always price from the provider's current published rates:

```js
// dollars per 1M tokens — illustrative; verify current rates on your provider's pricing page
const PRICES_PER_MILLION = {
  "claude-haiku-4-5": { in: 1.00, out: 5.00 },
  "claude-sonnet-5":  { in: 3.00, out: 15.00 },
  "claude-opus-4-8":  { in: 5.00, out: 25.00 },
};

function costUsd(model, inputTokens, outputTokens) {
  const p = PRICES_PER_MILLION[model];
  if (!p) throw new Error(`no price entry for model "${model}"`);
  return (inputTokens / 1e6) * p.in + (outputTokens / 1e6) * p.out;
}

async function meteredCompletion({ userId, model, messages }) {
  const response = await llmClient.chat(model, messages);
  const inputTokens  = response.usage.input_tokens  ?? response.usage.prompt_tokens;
  const outputTokens = response.usage.output_tokens ?? response.usage.completion_tokens;
  const costUsdValue = costUsd(model, inputTokens, outputTokens);

  await recordUsage({ userId, model, inputTokens, outputTokens, costUsd: costUsdValue });
  return response;
}
```

## Store a running ledger

A per-user, per-period row that increments atomically. Don't read-modify-write in application code — a burst of concurrent requests will race and undercount. Let Postgres do the arithmetic in one statement.

```sql
CREATE TABLE usage_ledger (
  user_id    text NOT NULL,
  period     text NOT NULL,                 -- e.g. '2026-07' (billing month)
  tokens_in  bigint NOT NULL DEFAULT 0,
  tokens_out bigint NOT NULL DEFAULT 0,
  cost_usd   numeric(12,6) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period)
);

INSERT INTO usage_ledger (user_id, period, tokens_in, tokens_out, cost_usd)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (user_id, period) DO UPDATE SET
  tokens_in  = usage_ledger.tokens_in  + EXCLUDED.tokens_in,
  tokens_out = usage_ledger.tokens_out + EXCLUDED.tokens_out,
  cost_usd   = usage_ledger.cost_usd   + EXCLUDED.cost_usd,
  updated_at = now();
```

## Enforce a budget BEFORE the call

Here's the one insight that matters more than the rest of this article combined:

>> Metering after the call tells you who bankrupted you. Checking before the call is what stops them.

A ledger that only gets read for a dashboard is forensics, not defense. The check has to sit in the request path, before `llmClient.chat()` fires, not in a nightly batch job that emails you the damage the next morning.

```js
async function assertBudget(userId) {
  const period = currentBillingPeriod();
  const { rows } = await db.query(
    `SELECT cost_usd FROM usage_ledger WHERE user_id = $1 AND period = $2`,
    [userId, period]
  );
  const spent = rows[0]?.cost_usd ?? 0;
  const plan = await getPlan(userId); // { monthlyCapUsd, hardCeilingUsd }

  if (spent >= plan.monthlyCapUsd) {
    const err = new Error("Monthly AI budget exceeded");
    err.status = 402; // Payment Required
    throw err;
  }
  return { spentUsd: spent, remainingUsd: plan.monthlyCapUsd - spent };
}

app.post("/api/ask", async (req, res) => {
  try {
    const budget = await assertBudget(req.user.id);
    const result = await meteredCompletion({ userId: req.user.id, model: "claude-sonnet-5", messages: req.body.messages });
    res.json({ reply: result, remainingUsd: budget.remainingUsd });
  } catch (err) {
    if (err.status === 402) return res.status(402).json({ error: err.message });
    throw err;
  }
});
```

Reject with `402` or `429` and a clear message — never let the model call fire for a user who's already over. This is the same discipline covered in [how to cap an AI agent's spend per run](/posts/how-to-cap-ai-agent-spending.html), just scoped to a tenant across its whole lifetime instead of one execution.

## Kill-switch + alerts

A plan quota is a pricing decision. A hard ceiling is a safety mechanism, set several times above normal usage, that exists purely to catch abuse or a runaway loop the quota didn't anticipate:

```js
if (spent >= plan.hardCeilingUsd) {
  await disableAiFeature(userId);
  await alertOncall(`user ${userId} hit hard ceiling: $${spent.toFixed(2)}`);
  const err = new Error("AI feature disabled — abuse ceiling reached");
  err.status = 429;
  throw err;
}
```

Run the same pattern one level up: a single `app_daily_spend` row, checked before every call, that trips a global circuit-breaker if your whole app's spend spikes — protection against a coordinated abuse pattern spread across many accounts, not just one. If you're routing across models to keep this cheap in the first place, pair this with [a cost-aware model router](/posts/build-cost-aware-model-router-for-your-agent.html) so the expensive model is the exception, not the default.

## Make it fair & visible

Return `remainingUsd` in every response so users see their budget shrink in real time — a cutoff should never be a surprise. Reset plan quotas on the billing cycle boundary; never reset the hard ceiling automatically — require a human to clear it, because it exists specifically for the case where "just wait until next month" isn't good enough. If you'd rather not build and operate this yourself, see [AI cost-control tools for founders](/posts/ai-cost-control-tools-for-founders.html) for managed alternatives.

**Deployment checklist:**

- `usage_ledger` table with an atomic `UPSERT` per call, keyed on `(user_id, period)`
- Cost computed from real token counts and a maintained per-model price table, in dollars
- Budget check runs **before** every model call, not after
- Plan quota (soft, resets monthly) and abuse ceiling (hard, manual reset) are separate values
- Kill-switch disables the feature per user and pages your team on ceiling breach
- Global daily circuit-breaker guards against distributed abuse across accounts
- Remaining budget surfaced to the user on every response
