#!/usr/bin/env node
// setup-test-db.js — guarantee a freshly-ingested DB before the test suite runs.
//
// Several suites (render/pages/content-standard/api/tools) read the real SQLite DB
// via lib/db.js (`allPosts()` etc.), not an in-memory fixture. If that DB is missing
// or stale, two bad things happen: (1) `new Database(DB_PATH)` throws "unable to open
// database file" at import time when the `app/data/` dir doesn't exist, so the whole
// per-post parameterized suite errors out instead of running; (2) a stale DB silently
// tests yesterday's content, masking a content/render regression. Run 18 shipped a red
// `main` for exactly this reason — the test step ran against a missing DB dir and the
// real 776-test suite never executed behind a handful of "directory does not exist"
// errors.
//
// Wired as npm `pretest`, this deletes the DB file (+ WAL/SHM sidecars) so the schema
// is rebuilt from scratch, recreates the data dir, and runs the normal ingest — so
// `npm test` ALWAYS runs against a fresh DB that reflects the current content/posts.
// Honors DP_DB (same resolution as lib/db.js), so a custom DB path works too.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { DB_PATH } from "../lib/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
  try { fs.rmSync(f, { force: true }); } catch { /* nothing to remove */ }
}
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

execFileSync(process.execPath, [path.join(__dirname, "ingest.js")], { stdio: "inherit" });
