// canvas-backend.js — a single 2D-canvas import surface that survives a
// no-root/degraded container.
//
// The native `canvas` package needs a gyp build against cairo/pango system
// libraries (or a prebuilt fetched from GitHub releases). On a container with
// no apt + no root — and with the GitHub-release prebuilt proxy-blocked — that
// build is impossible by any documented path, and the cover never renders.
// Because the deploy VM's `cover-coverage.test.js` hard-fails any post missing
// its committed cover, an unrenderable `canvas` is a hard cadence break (#17),
// not a cosmetic one.
//
// `@napi-rs/canvas` ships a prebuilt `.node` straight from the npm registry
// (which the egress proxy allows) with zero system-lib dependencies, and its
// 2D API is drop-in for the small surface art.js/gen-logo.js use. So: prefer
// native `canvas`, fall back to `@napi-rs/canvas` on import failure. The one
// API gap is `registerFont(path, { family })` → `GlobalFonts.registerFromPath(
// path, family)`, which the shim normalizes so callers stay identical.
//
// This touches only the authoring/gen-art path: `canvas` is a devDependency the
// deploy VM never installs (`npm install --omit=dev`), so production is unaffected.

let backend;
let name;

try {
  const mod = await import("canvas");
  backend = {
    createCanvas: mod.createCanvas,
    loadImage: mod.loadImage,
    registerFont: mod.registerFont,
  };
  name = "canvas";
} catch (nativeErr) {
  try {
    const napi = await import("@napi-rs/canvas");
    backend = {
      createCanvas: napi.createCanvas,
      loadImage: napi.loadImage,
      // native canvas: registerFont(path, { family }); napi: GlobalFonts.registerFromPath(path, alias)
      registerFont: (p, opts = {}) => napi.GlobalFonts.registerFromPath(p, opts.family),
    };
    name = "@napi-rs/canvas";
  } catch (napiErr) {
    throw new Error(
      `canvas-backend: no 2D canvas implementation available. ` +
      `Native 'canvas' failed (${nativeErr?.code || nativeErr?.message}) and ` +
      `'@napi-rs/canvas' failed (${napiErr?.code || napiErr?.message}). ` +
      `Install one: 'npm i -D @napi-rs/canvas' needs no system libs.`
    );
  }
}

export const createCanvas = backend.createCanvas;
export const loadImage = backend.loadImage;
export const registerFont = backend.registerFont;
export const backendName = name;
