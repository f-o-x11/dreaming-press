// art.js — sophisticated deterministic generative cover art (node-canvas).
// Curl-noise flow fields (Fidenza-style ribbons), domain-warped grounds,
// Voronoi shards, OKLCH palettes, and a film-grain finishing pass.
// Deterministic per slug; themed per section. Renders 2x then downscales.

import { createCanvas, registerFont } from "canvas";
import { createNoise2D } from "simplex-noise";
import { oklch, formatHex, clampChroma, interpolate } from "culori";
import { Delaunay } from "d3-delaunay";
import PoissonDiskSampling from "poisson-disk-sampling";
import fs from "node:fs";

// register a couple of system fonts for the brand marks (best-effort)
for (const [p, family] of [
  ["/System/Library/Fonts/Supplemental/Georgia.ttf", "ArtSerif"],
  ["/System/Library/Fonts/Supplemental/Courier New.ttf", "ArtMono"],
  ["/Library/Fonts/Georgia.ttf", "ArtSerif"],
]) { try { if (fs.existsSync(p)) registerFont(p, { family }); } catch {} }

const SUP = 2;                 // supersample factor
const OW = 1200, OH = 800;     // output size
const W = OW * SUP, H = OH * SUP;

// section identity in OKLCH (base hue)
const SECTION = {
  dispatches:   { hue: 28,  weights: { flow: 0.7, warp: 0.2, voronoi: 0.1 } },
  wire:         { hue: 255, weights: { voronoi: 0.6, flow: 0.2, warp: 0.2 } },
  stack:        { hue: 150, weights: { warp: 0.5, voronoi: 0.3, flow: 0.2 } },
  fabrications: { hue: 310, weights: { flow: 0.45, voronoi: 0.35, warp: 0.2 } },
};

// ── deterministic randomness ─────────────────────────────────────────────────
function xfnv1a(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── OKLCH palette engine ─────────────────────────────────────────────────────
function hex(l, c, h) { return formatHex(clampChroma(oklch({ mode: "oklch", l, c, h }), "oklch")); }
function palette(baseHue, rng) {
  const schemes = [[0, 18, -18, 150], [0, 30, 210, 180], [0, 120, 240, 60], [0, -24, 24, 190]];
  const sc = schemes[(rng() * schemes.length) | 0];
  const ramp = [0.13, 0.30, 0.52, 0.72, 0.9];
  const chr = [0.045, 0.10, 0.16, 0.14, 0.06];
  const sw = sc.map((dh, i) => hex(
    ramp[i % 5] + (rng() - 0.5) * 0.05,
    chr[i % 5] + (rng() - 0.5) * 0.025,
    (baseHue + dh + (rng() - 0.5) * 8 + 360) % 360));
  return {
    ground0: hex(0.10, 0.04, baseHue + 8),
    ground1: hex(0.16, 0.07, (baseHue + 20) % 360),
    accent: hex(0.62, 0.18, baseHue),
    highlight: hex(0.86, 0.10, (baseHue + 18) % 360),
    swatches: sw,
    inkOnArt: hex(0.93, 0.03, baseHue),
  };
}

// ── generators ───────────────────────────────────────────────────────────────
function ground(ctx, pal, rng, noise) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, pal.ground0); g.addColorStop(1, pal.ground1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // domain-warped fractal wash, gradient-mapped, low opacity
  const ramp = interpolate([pal.ground0, pal.accent, pal.highlight], "oklch");
  const STEP = 8 * SUP;
  const sc = 0.0009;
  const fbm = (x, y) => { let v = 0, a = 0.5, f = 1; for (let o = 0; o < 4; o++) { v += a * noise(x * f, y * f); f *= 2; a *= 0.5; } return v; };
  ctx.globalAlpha = 0.22;
  for (let y = 0; y < H; y += STEP) for (let x = 0; x < W; x += STEP) {
    const qx = fbm(x * sc, y * sc), qy = fbm(x * sc + 5.2, y * sc + 1.3);
    const v = fbm(x * sc + 4 * qx, y * sc + 4 * qy);
    ctx.fillStyle = formatHex(ramp(Math.min(1, Math.max(0, (v + 1) / 2))));
    ctx.fillRect(x, y, STEP + 1, STEP + 1);
  }
  ctx.globalAlpha = 1;
}

function focal(rng) {
  const fx = [0.33, 0.5, 0.66][(rng() * 3) | 0] + (rng() - 0.5) * 0.08;
  const fy = [0.38, 0.5, 0.62][(rng() * 3) | 0] + (rng() - 0.5) * 0.08;
  return [fx * W, fy * H];
}

function flowField(ctx, pal, rng, noise) {
  const SCALE = 0.00055 + rng() * 0.0005;
  const turn = rng() < 0.5 ? Math.PI : Math.PI * 2;
  const curl = (x, y) => {
    const e = 1.2;
    const dx = (noise(x * SCALE, (y + e) * SCALE) - noise(x * SCALE, (y - e) * SCALE)) / (2 * e);
    const dy = (noise((x + e) * SCALE, y * SCALE) - noise((x - e) * SCALE, y * SCALE)) / (2 * e);
    return Math.atan2(-dx, dy) * (turn / Math.PI);
  };
  const [fxc, fyc] = focal(rng);
  // occupancy grid for packing
  const CELL = 10 * SUP, cols = Math.ceil(W / CELL), rows = Math.ceil(H / CELL);
  const occ = Array.from({ length: cols * rows }, () => []);
  const collides = (x, y, r) => {
    const cx = (x / CELL) | 0, cy = (y / CELL) | 0;
    for (let gy = cy - 2; gy <= cy + 2; gy++) for (let gx = cx - 2; gx <= cx + 2; gx++) {
      if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
      for (const [px, py, pr] of occ[gy * cols + gx]) if (Math.hypot(x - px, y - py) < r + pr + 3 * SUP) return true;
    }
    return false;
  };
  const deposit = (x, y, r) => { const k = ((y / CELL) | 0) * cols + ((x / CELL) | 0); if (occ[k]) occ[k].push([x, y, r]); };

  // seed points: blue noise, concentrated near focal with real negative space
  const pds = new PoissonDiskSampling({ shape: [W, H], minDistance: 21 * SUP, tries: 20 }, rng);
  let seeds = pds.fill().filter(([x, y]) => {
    const d = Math.hypot(x - fxc, y - fyc) / (W * 0.62);
    return rng() < 1.05 - d * 1.05;        // strong falloff → negative space at edges
  });
  seeds.sort((a, b) => Math.hypot(a[0] - fxc, a[1] - fyc) - Math.hypot(b[0] - fxc, b[1] - fyc));
  // stay in the section hue family: accent → highlight, plus one nearby swatch for life
  const ramp = interpolate([pal.ground1, pal.accent, pal.highlight, pal.accent], "oklch");

  for (const [sx, sy] of seeds) {
    const pts = []; let x = sx, y = sy;
    const baseW = (3 + rng() * 15) * SUP;
    for (let i = 0; i < 600; i++) {
      if (x < -40 || x > W + 40 || y < -40 || y > H + 40) break;
      const w = baseW * (0.4 + 0.6 * Math.sin((i / 600) * Math.PI));
      // soft packing: only stop once the ribbon has length and hits a thick deposit
      if (i > 24 && collides(x, y, w * 0.42)) break;
      pts.push([x, y, w]); if (i % 3 === 0) deposit(x, y, w * 0.42);
      const a = curl(x, y);
      x += Math.cos(a) * 2.0 * SUP; y += Math.sin(a) * 2.0 * SUP;
    }
    if (pts.length < 10) continue;
    // tapered ribbon polygon
    const L = [], R = [];
    for (let i = 0; i < pts.length; i++) {
      const [px, py, w] = pts[i];
      const [nx, ny] = i < pts.length - 1 ? pts[i + 1] : pts[i];
      const a = Math.atan2(ny - py, nx - px) + Math.PI / 2;
      L.push([px + Math.cos(a) * w / 2, py + Math.sin(a) * w / 2]);
      R.push([px - Math.cos(a) * w / 2, py - Math.sin(a) * w / 2]);
    }
    ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
    for (const p of L) ctx.lineTo(p[0], p[1]);
    for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.closePath();
    const t = Math.min(1, Math.hypot(sx - fxc, sy - fyc) / (W * 0.6));
    ctx.globalAlpha = 0.92 - t * 0.4;
    ctx.fillStyle = formatHex(ramp(Math.min(1, rng() * 0.7 + (1 - t) * 0.4)));
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function voronoiShards(ctx, pal, rng, noise) {
  const pds = new PoissonDiskSampling({ shape: [W, H], minDistance: 95 * SUP / 2, tries: 20 }, rng);
  const pts = pds.fill();
  const d = Delaunay.from(pts);
  const vor = d.voronoi([0, 0, W, H]);
  const ramp = interpolate([pal.ground1, pal.accent, pal.highlight], "oklch");
  const sc = 0.0014;
  const fbm = (x, y) => { let v = 0, a = 0.5, f = 1; for (let o = 0; o < 4; o++) { v += a * noise(x * f, y * f); f *= 2; a *= 0.5; } return v; };
  const [fxc, fyc] = focal(rng);
  for (let i = 0; i < pts.length; i++) {
    const cell = vor.cellPolygon(i); if (!cell) continue;
    const [cx, cy] = pts[i];
    // inset toward centroid for clean gutters
    ctx.beginPath();
    cell.forEach(([x, y], k) => {
      const ix = cx + (x - cx) * 0.92, iy = cy + (y - cy) * 0.92;
      k ? ctx.lineTo(ix, iy) : ctx.moveTo(ix, iy);
    });
    ctx.closePath();
    const v = (fbm(cx * sc, cy * sc) + 1) / 2;
    const near = 1 - Math.min(1, Math.hypot(cx - fxc, cy - fyc) / (W * 0.6));
    ctx.fillStyle = formatHex(ramp(Math.min(1, v * 0.6 + near * 0.4)));
    ctx.globalAlpha = 0.5 + near * 0.45;
    ctx.fill();
    if (rng() < 0.3) {
      ctx.strokeStyle = pal.highlight; ctx.globalAlpha = 0.18; ctx.lineWidth = 1.2 * SUP; ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function warpGrid(ctx, pal, rng, noise) {
  // a regular grid that dissolves into chaos toward a focal region
  const [fxc, fyc] = focal(rng);
  const cols = 18 + ((rng() * 10) | 0), rows = 12 + ((rng() * 6) | 0);
  const cw = W / cols, ch = H / rows;
  const ramp = interpolate([pal.accent, pal.swatches[3], pal.highlight], "oklch");
  const sc = 0.0016;
  for (let iy = 0; iy < rows; iy++) for (let ix = 0; ix < cols; ix++) {
    const cx = ix * cw + cw / 2, cy = iy * ch + ch / 2;
    const dist = Math.hypot(cx - fxc, cy - fyc) / (W * 0.5);
    const chaos = Math.max(0, 1 - dist) * 1.4;
    const ox = noise(cx * sc, cy * sc) * cw * chaos;
    const oy = noise(cx * sc + 9, cy * sc + 4) * ch * chaos;
    const r = (Math.min(cw, ch) / 2) * (0.2 + (1 - Math.min(1, dist)) * 0.8);
    if (r < 1) continue;
    ctx.save();
    ctx.translate(cx + ox, cy + oy);
    ctx.rotate(noise(cx * sc, cy * sc) * chaos);
    ctx.fillStyle = formatHex(ramp(Math.min(1, 1 - dist)));
    ctx.globalAlpha = 0.3 + (1 - Math.min(1, dist)) * 0.6;
    if (rng() < 0.7) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); }
    else ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

const GENS = { flow: flowField, voronoi: voronoiShards, warp: warpGrid };

function pickGen(weights, rng) {
  const r = rng(); let acc = 0;
  for (const [k, w] of Object.entries(weights)) { acc += w; if (r <= acc) return k; }
  return "flow";
}

// ── finishing pass ───────────────────────────────────────────────────────────
function finish(ctx, pal, rng, noise) {
  // vignette
  const vg = ctx.createRadialGradient(W / 2, H * 0.42, W * 0.2, W / 2, H * 0.5, W * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // paper mottle (multiply)
  ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = 0.06;
  const STEP = 6 * SUP;
  for (let y = 0; y < H; y += STEP) for (let x = 0; x < W; x += STEP) {
    const v = 0.6 + 0.4 * noise(x * 0.004, y * 0.004);
    ctx.fillStyle = `rgba(0,0,0,${(1 - v) * 0.5})`;
    ctx.fillRect(x, y, STEP, STEP);
  }
  ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  // film grain
  const img = ctx.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = (rng() - 0.5) * 24;
    d[i] += g; d[i + 1] += g; d[i + 2] += g;
  }
  ctx.putImageData(img, 0, 0);
}

function brand(ctx, pal, section, title, seed) {
  const M = 40 * SUP;
  ctx.strokeStyle = pal.inkOnArt; ctx.globalAlpha = 0.18; ctx.lineWidth = 1.5 * SUP;
  ctx.strokeRect(M, M, W - 2 * M, H - 2 * M); ctx.globalAlpha = 1;
  ctx.fillStyle = pal.accent;
  ctx.font = `600 ${22 * SUP}px ArtMono, monospace`;
  ctx.fillText((section || "dispatches").toUpperCase(), 60 * SUP, 84 * SUP);
  ctx.fillStyle = pal.inkOnArt; ctx.globalAlpha = 0.92;
  ctx.font = `italic ${30 * SUP}px ArtSerif, Georgia, serif`;
  ctx.fillText("dreaming.press", 60 * SUP, H - 52 * SUP);
  ctx.globalAlpha = 0.5; ctx.font = `${18 * SUP}px ArtMono, monospace`;
  const num = "№ " + (seed % 900 + 100);
  ctx.textAlign = "right"; ctx.fillText(num, W - 60 * SUP, H - 52 * SUP); ctx.textAlign = "left";
  ctx.globalAlpha = 1;
}

export function makeCover(slug, title, section = "dispatches") {
  const conf = SECTION[section] || SECTION.dispatches;
  const seed = xfnv1a(slug + "::" + section);
  const rng = mulberry32(seed);
  const noise = createNoise2D(rng);
  const pal = palette(conf.hue, rng);

  const big = createCanvas(W, H);
  const ctx = big.getContext("2d");
  ground(ctx, pal, rng, noise);
  GENS[pickGen(conf.weights, rng)](ctx, pal, rng, noise);
  finish(ctx, pal, rng, noise);
  brand(ctx, pal, section, title, seed);

  // downscale to output
  const out = createCanvas(OW, OH);
  const octx = out.getContext("2d");
  octx.imageSmoothingEnabled = true; octx.imageSmoothingQuality = "high";
  octx.drawImage(big, 0, 0, OW, OH);
  return out.toBuffer("image/png");
}
