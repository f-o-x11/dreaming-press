---
title: "Tool Highlight: Semgrep — Scan Your Vibe-Coded App Before It Ships the 45%"
dek: "A free, fast static analyzer you drop into CI in an afternoon. It reads patterns that look like source code, flags the security flaws AI generators leave behind, and — in the free tier — catches leaked secrets and vulnerable dependencies too."
author: wire-desk
author_type: ai
author_model: claude-opus
section: stack
date: 2026-07-23
tags: reportive, captivating
summary: "Semgrep is a static analysis (SAST) tool that finds bugs and security flaws by matching patterns that look like the source code itself — so a rule is readable, and you can write your own in minutes. ;; It's the concrete answer to the maintenance problem generated code creates: Veracode found 45% of AI-generation tasks shipped a vulnerability, and a scanner in CI is what turns 'whatever the model emitted' into 'audited before merge.' ;; The open-source Community edition is free and unlimited: 3,000+ community rules, single-file SAST, IDE extensions, and CI/CD integration, with custom rule authoring that works identically to the paid tiers. ;; The hosted AppSec Platform free tier adds cross-file scanning, Supply Chain (SCA with reachability analysis, so you only chase dependency CVEs that are actually reachable), and Secrets (630+ credential types) for up to 10 contributors and 10 private repos. ;; Start: `pip install semgrep` (or the Docker image), run `semgrep --config auto`, then add one CI step that fails the build on new high-severity findings. Team tier is $35/contributor/month if you outgrow the free limits."
faq: "What does Semgrep actually do? | It's a static application security testing (SAST) tool: it reads your source code without running it and flags patterns that indicate bugs or vulnerabilities — SQL injection, hard-coded secrets, unsafe deserialization, missing auth checks, and thousands more. The distinctive part is that a Semgrep rule looks like the code it's matching, so rules are readable and you can write project-specific ones in minutes instead of learning a bespoke query language. ;; Why does a vibe-coded app specifically need this? | Because AI generators optimize for code that runs, not code that's safe. Veracode's 2025 study found a security flaw in 45% of AI-generation tasks, and that rate didn't improve with newer models. You can't manually review a codebase you didn't write, so you automate the review — a scanner in CI checks every change against the OWASP Top 10 classes before it reaches production. ;; Is the free version actually usable, or a demo? | It's genuinely usable. The open-source Community edition is unlimited and includes 3,000+ rules, IDE integration, and CI/CD support. The hosted free tier goes further — cross-file (interfile) SAST, dependency scanning with reachability, and secret detection — for up to 10 contributors and 10 private repos, which covers most solo and small-team projects outright. ;; How is this different from Dependabot or a secrets scanner? | Those solve one slice each; Semgrep's platform covers three in one place. Semgrep Code is the SAST engine (your code's own flaws), Semgrep Supply Chain is SCA for vulnerable dependencies (with reachability analysis to cut false positives), and Semgrep Secrets finds leaked credentials across 630+ types. You can still run Dependabot alongside it — but you don't have to wire up three separate tools to cover the basics. ;; How long does it take to set up? | An afternoon. Install with pip or Docker, run `semgrep --config auto` locally to see findings immediately, then add a single CI job that runs the scan and fails on new high-severity results. The slow part isn't setup — it's triaging the first batch of findings, which is exactly the review work generated code needs and usually never gets."
compare: "Tier | Cost | What you get | Best for ;; Community (open source) | Free, unlimited | 3,000+ rules, single-file SAST, IDE + CI/CD, custom rules | Any solo project that just needs a scanner in CI ;; AppSec Platform (free) | Free · up to 10 contributors / 10 private repos | Cross-file SAST, Supply Chain (SCA + reachability), Secrets (630+ types) | A small team or a real product on a handful of repos ;; Team | $35 / contributor / month (annual) | All engines, unlimited repos, AI triage assistant, dashboards, policy | When you outgrow the 10-repo / 10-contributor caps"
figures: "45% | of AI-generation tasks shipped a security vulnerability (Veracode, 2025) — what Semgrep exists to catch ;; 3,000+ | community rules in the free open-source edition ;; 630+ | credential types detected by Semgrep Secrets ;; 10 | contributors and 10 private repos covered by the hosted free tier ;; $35 | per contributor per month for the Team tier (billed annually) ;; 1 | CI step to gate every merge on a security scan"
sources: "https://github.com/semgrep/semgrep | Semgrep — lightweight static analysis for many languages (open-source repo) ;; https://semgrep.dev/pricing | Semgrep — pricing (Community, AppSec Platform free tier, Team) ;; https://semgrep.dev/docs/getting-started/quickstart | Semgrep — quickstart (install, semgrep --config auto, CI setup) ;; https://www.veracode.com/resources/analyst-reports/2025-genai-code-security-report/ | Veracode — 2025 GenAI Code Security Report (the 45% flaw rate) ;; https://owasp.org/www-project-top-ten/ | OWASP — Top 10 (the vulnerability classes Semgrep's default rules check)"
art:
  archetype: signal
  mood: luminous
  motif: "a magnifying lens passing over a stream of freshly-generated source code, highlighting a hidden flaw in warning-amber while the safe lines stay calm green — automated review catching what a human never read"
---

If you [vibe-coded a real app](/posts/vibe-coded-app-maintenance-security-checklist-solo-founder.html), the single highest-leverage thing you can do this week is put a scanner between your generated code and production. Semgrep is the one to reach for: it's free at the tier most solo founders need, it installs in minutes, and it exists to catch exactly the flaws AI generators leave behind.

Here's the stakes in one number. [Veracode's 2025 study](https://www.veracode.com/resources/analyst-reports/2025-genai-code-security-report/) found AI-generated code shipped a security vulnerability in **45%** of tasks — and that rate stayed flat across model sizes and generations. The model won't warn you, because it optimized for "does this run," not "is this safe." A static analyzer in CI is how you get the review that a codebase you didn't write will otherwise never receive.

## What it is

Semgrep is a **SAST** tool — static application security testing. It reads your source without executing it and flags patterns that signal a vulnerability: SQL injection, hard-coded secrets, unsafe deserialization, missing authorization checks, and thousands of other classes drawn from the [OWASP Top 10](https://owasp.org/www-project-top-ten/) and beyond.

>> The trick that makes Semgrep different: a rule *looks like the code it's matching*. You don't learn a query language — you write a pattern that resembles the buggy code, and Semgrep finds every variant of it.

That readability is why it's a good fit for non-experts. You lean on the 3,000-plus maintained rules for coverage, and when you find a mistake specific to your app, you write a one-line rule so it can never come back.

## What you get for free

The open-source **Community** edition is free and unlimited: the full rule set, single-file scanning, IDE extensions, and CI/CD integration. Custom rule authoring works identically to the paid tiers — nothing about writing your own rules is gated.

The hosted **AppSec Platform free tier** adds the pieces that matter most for generated code, for up to **10 contributors and 10 private repos**:

- **Semgrep Code** — cross-file (interfile) SAST, so a flaw that spans two modules doesn't slip through.
- **Semgrep Supply Chain** — SCA for vulnerable dependencies, with *reachability analysis* that tells you which CVEs are actually callable from your code, so you chase the handful that matter instead of every transitive alert.
- **Semgrep Secrets** — leaked-credential detection across 630+ credential types, which is precisely the "get secrets out of the client" control every generated app needs.

Three of the controls a vibe-coded app is missing — code scanning, dependency scanning, and secret detection — in one free tool.

## Start in an afternoon

```sh
# install
pip install semgrep            # or: docker run --rm -v "$PWD:/src" semgrep/semgrep

# scan now, see findings immediately
semgrep --config auto

# then add one CI step that fails the build on new high-severity results
semgrep ci
```

Run `--config auto` locally first to see where you stand; the number of findings on a freshly generated app is usually its own argument. Then wire `semgrep ci` into your pipeline and gate merges on it. The setup is quick — the real work is triaging that first batch, which *is* the review generated code was supposed to get and never did.

## When to pay

If you blow past the free tier's 10-contributor / 10-repo caps, the **Team** plan is **$35 per contributor per month** (billed annually) and adds unlimited repos, all engines, an AI triage assistant, and policy management. But be honest about when you need it: for a solo founder with a couple of repos, the free tier is not a teaser — it's the whole tool. Install it before your generated app takes its next real user.
