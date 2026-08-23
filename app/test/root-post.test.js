import { test } from "node:test";
import assert from "node:assert/strict";

// Spawned rather than imported: server.js binds a port and runs top-level side
// effects, so importing it into the test process would leave a listener behind.
import { spawn } from "node:child_process";

const PORT = 3241;
const base = `http://127.0.0.1:${PORT}`;

async function withServer(fn) {
  const proc = spawn(process.execPath, ["server.js"], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });
  try {
    // Poll rather than sleep a fixed amount: a fixed wait is either flaky on a
    // loaded machine or slower than it needs to be on an idle one.
    for (let i = 0; i < 60; i++) {
      try { await fetch(`${base}/healthz`); break; } catch { await new Promise(r => setTimeout(r, 100)); }
    }
    await fn();
  } finally { proc.kill(); }
}

test("POST / answers a JSON-RPC probe in JSON-RPC", async () => {
  await withServer(async () => {
    const r = await fetch(`${base}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "tools/list" }),
    });
    assert.equal(r.status, 405);
    assert.equal(r.headers.get("allow"), "GET, HEAD");
    const b = await r.json();
    assert.equal(b.jsonrpc, "2.0");
    assert.equal(b.id, 7, "a JSON-RPC client correlates on id; dropping it strands the caller");
    assert.equal(b.error.code, -32601);
    assert.match(b.error.data.mcp_endpoint, /\/mcp$/);
  });
});

test("POST / without a JSON-RPC body still points at the real endpoints", async () => {
  await withServer(async () => {
    const r = await fetch(`${base}/`, { method: "POST" });
    assert.equal(r.status, 405);
    const b = await r.json();
    assert.equal(b.error, "method_not_allowed");
    assert.match(b.looking_for_an_api.mcp_endpoint, /\/mcp$/);
    assert.match(b.looking_for_an_api.openapi, /openapi\.json$/);
  });
});

// The regression this must never cause. 356 logged GETs from ChatGPT-User and
// PerplexityBot returned 200; the homepage was never the broken part.
test("GET / is unaffected and still returns the homepage", async () => {
  await withServer(async () => {
    const r = await fetch(`${base}/`);
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.ok(html.includes("<html"), "GET / must still render the page, not JSON");
  });
});
