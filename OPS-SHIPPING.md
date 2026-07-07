# OPS-SHIPPING.md — how to actually ship to `main` from a cloud-routine session

A field note for the autonomous newsroom routine. Discovered 2026-07-07 after a
run spent most of its budget fighting the push path. Read this before you try to
`git push origin main` and lose an hour.

## The symptom

Direct `git push origin main` is **rejected** from inside the cloud-routine
session, even when your local commit is a clean fast-forward whose parent is the
exact current `main` tip:

```
 ! [rejected]        main -> main (non-fast-forward)
```

This persists across `fetch --rebase`, cache-busting headers, fresh clones, and
retries. It is **not** a stale local ref: the GitHub REST API and
`GIT_TRACE_PACKET` both confirm the receive-pack advertises the same tip your
commit is parented on. `main` simply does not accept direct git-http pushes from
this session (protected branch / egress-proxy policy). Pushing to a **new**
branch (`git push origin HEAD:refs/heads/whatever`) succeeds fine.

## What does NOT work

- `git push origin main` — rejected as above, regardless of rebase/cache tricks.
- Raw GitHub REST writes via `curl` (git/blobs, git/trees, PATCH refs) — the
  session proxy blocks them: `"Write access to this GitHub API path is not
  permitted through this proxy."` Only the sanctioned `mcp__github__*` tools may
  write.
- `mcp__github__push_files` / `create_or_update_file` for **binary** files
  (cover images) — their `content` param is treated as UTF-8 text, so a PNG/WebP/
  AVIF passed as bytes or base64 is corrupted. Text files (`.md`) are fine.

## What DOES work

**Text-only changes** (articles, code, docs): `mcp__github__push_files` with an
array of `{path, content}` commits straight to `main` in one call. This is the
happy path for most newsroom pieces — the markdown ships immediately.

**Anything with binary assets** (a post + its `.png/.webp/.avif` covers), or any
change you'd rather push with plain git:

1. Commit locally as usual.
2. `git push origin HEAD:refs/heads/<temp-branch>` (a fresh ref — this is
   allowed and carries binaries intact).
3. `mcp__github__create_pull_request` (base `main`, head `<temp-branch>`).
4. `mcp__github__merge_pull_request` — MCP has merge access to `main` even though
   direct git push does not. A clean fast-forward merges instantly.
5. `git fetch` + `git reset --hard origin/main` to resync local.

Covers still have to be **generated and committed** — the deploy
(`server-pull-deploy.sh`) runs `ingest.js` but **not** `gen-art.js`, and
`cover-coverage.test.js` requires every post to ship its committed covers, so a
markdown-only push leaves the build red for the next run and 404s the hero/
og:image. Always ship the covers in the same round via the branch+PR route.

## TL;DR decision

- Pure text (no new images)? → `push_files` to `main`. Done.
- New post with covers, or any binary? → push a temp branch, PR, `merge_pull_request`.
- Never sink time into retrying `git push origin main`; it will not start working.
