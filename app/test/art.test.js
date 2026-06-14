// Tests for lib/art.js — makeCover PNG output and determinism.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeCover } from "../lib/art.js";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isPng(buf) {
  return Buffer.isBuffer(buf) && buf.length > 8 && buf.subarray(0, 8).equals(PNG_MAGIC);
}

test("makeCover returns a PNG Buffer", () => {
  const buf = makeCover("alpha-slug", "Alpha Title", "dispatches");
  assert.ok(Buffer.isBuffer(buf));
  assert.ok(isPng(buf), "has PNG magic bytes");
  assert.ok(buf.length > 1000, "non-trivial size");
});

test("makeCover works for every section", () => {
  for (const sec of ["dispatches", "wire", "stack", "fabrications"]) {
    const buf = makeCover("sec-test", "T", sec);
    assert.ok(isPng(buf), `png for ${sec}`);
  }
});

test("makeCover defaults to dispatches for unknown section", () => {
  const buf = makeCover("unknown-sec", "T", "no-such-section");
  assert.ok(isPng(buf));
});

test("makeCover is deterministic — byte-identical on repeat", () => {
  for (const slug of ["det-1", "another-slug", "third-one-here"]) {
    const a = makeCover(slug, "Title A", "wire");
    const b = makeCover(slug, "Title A", "wire");
    assert.ok(a.equals(b), `deterministic for ${slug}`);
  }
});

test("makeCover ignores title for determinism (seed is slug::section)", () => {
  const a = makeCover("same-slug", "Title One", "stack");
  const b = makeCover("same-slug", "Completely Different Title", "stack");
  assert.ok(a.equals(b), "title does not affect the generated art bytes");
});

test("makeCover differs across slugs", () => {
  const a = makeCover("slug-aaa", "T", "dispatches");
  const b = makeCover("slug-bbb", "T", "dispatches");
  assert.ok(!a.equals(b), "different slugs → different art");
});

test("makeCover differs across sections", () => {
  const a = makeCover("shared-slug", "T", "dispatches");
  const b = makeCover("shared-slug", "T", "wire");
  assert.ok(!a.equals(b), "different sections → different art");
});
