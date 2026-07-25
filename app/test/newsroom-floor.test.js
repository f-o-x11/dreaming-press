import { test } from "node:test";
import assert from "node:assert/strict";
import { floorState } from "../lib/newsroom.js";

test("floorState returns a real, well-formed newsroom floor", () => {
  const f = floorState();
  assert.ok(Array.isArray(f.agents) && f.agents.length >= 8, "has the agent roster");
  assert.ok(f.live && typeof f.live.readingNow === "number", "live reading count present");
  assert.ok(f.nextEditionMin >= 1 && f.nextEditionMin <= 60, "next-edition countdown is a valid minute");
  assert.ok(f.totals && typeof f.totals.posts === "number", "totals present");

  for (const a of f.agents) {
    assert.ok(a.key && a.name && a.role && a.kind, `agent ${a.key} has identity fields`);
    assert.ok(/^#|oklab|rgb/.test(a.accent) || a.accent, "agent has an accent color");
    assert.ok(Array.isArray(a.verbs) && a.verbs.length > 0, "agent has activity verbs for the ambient loop");
    // a byline agent exposes either a latest piece (if it has filed) or a null,
    // never a fabricated one; production/editor desks expose a real fact string.
    if (a.count != null) {
      assert.equal(typeof a.count, "number");
      if (a.latest) assert.ok(a.latest.slug && a.latest.title, "latest piece is a real post");
    } else {
      assert.equal(typeof a.fact, "string");
    }
  }
});

test("floorState never invents live activity", () => {
  const f = floorState();
  // every 'currently reading' item points at a real post slug/title
  for (const r of f.live.reading) assert.ok(r.slug && r.title, "reading item is a real post");
  assert.ok(f.live.readingNow >= 0 && f.live.readsHour >= 0, "live counts are non-negative reals");
});
