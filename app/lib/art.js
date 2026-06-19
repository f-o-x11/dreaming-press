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
import { deriveArtSpec } from "./artspec.js";

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
// mood = { chroma: multiplier, lightBias: +/- lightness } from the art spec.
function palette(baseHue, rng, mood = { chroma: 1, lightBias: 0 }) {
  const cx = mood.chroma ?? 1, lb = mood.lightBias ?? 0;
  const schemes = [[0, 18, -18, 150], [0, 30, 210, 180], [0, 120, 240, 60], [0, -24, 24, 190]];
  const sc = schemes[(rng() * schemes.length) | 0];
  const ramp = [0.13, 0.30, 0.52, 0.72, 0.9];
  const chr = [0.045, 0.10, 0.16, 0.14, 0.06];
  const sw = sc.map((dh, i) => hex(
    ramp[i % 5] + lb + (rng() - 0.5) * 0.05,
    (chr[i % 5] + (rng() - 0.5) * 0.025) * cx,
    (baseHue + dh + (rng() - 0.5) * 8 + 360) % 360));
  return {
    ground0: hex(0.10 + lb, 0.04 * cx, baseHue + 8),
    ground1: hex(0.16 + lb, 0.07 * cx, (baseHue + 20) % 360),
    accent: hex(0.62 + lb, 0.18 * cx, baseHue),
    highlight: hex(0.86 + lb * 0.5, 0.10 * cx, (baseHue + 18) % 360),
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

// ── archetype generators: form that embodies the article's idea ──────────────
// A hard seam splits the field; material accumulates at the border, thins away
// from it. For pieces about borders, division, export control, us-vs-them.
function division(ctx, pal, rng, noise, spec) {
  const ramp = interpolate([pal.ground1, pal.accent, pal.highlight], "oklch");
  const tilt = (rng() - 0.5) * 0.5;
  const xMid = W * (0.42 + rng() * 0.16);
  const lineX = (y) => xMid + (y - H / 2) * tilt;
  const dense = rng() < 0.5 ? 1 : -1;
  const N = Math.round(140 + spec.density * 220);
  for (let i = 0; i < N; i++) {
    const x = rng() * W, y = rng() * H;
    const side = Math.sign(x - lineX(y)) || 1;
    const d = Math.abs(x - lineX(y)) / W;
    const keep = side === dense ? (1 - d * 0.8) : (0.5 - d * 1.6);
    if (rng() > keep) continue;
    const s = (4 + rng() * 12) * SUP * (side === dense ? 1 : 0.7);
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt + (rng() - 0.5) * 0.3);
    ctx.globalAlpha = 0.5 + (1 - d) * 0.4;
    ctx.fillStyle = formatHex(ramp(Math.min(1, 0.3 + (1 - d) * 0.7 * rng() + 0.2)));
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  }
  ctx.globalAlpha = 0.9; ctx.strokeStyle = pal.highlight; ctx.lineWidth = 3 * SUP;
  ctx.beginPath(); ctx.moveTo(lineX(0), 0); ctx.lineTo(lineX(H), H); ctx.stroke();
  ctx.lineWidth = 1.4 * SUP; ctx.globalAlpha = 0.5;
  for (let y = 0; y < H; y += 26 * SUP) {
    const lx = lineX(y);
    ctx.beginPath(); ctx.moveTo(lx - 10 * SUP, y); ctx.lineTo(lx + 10 * SUP, y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Surveillance, networks, protocols, tracking, connection — three topologies
// (mesh / hub-and-spoke / clusters), always with one watched, ringed node.
function network(ctx, pal, rng, noise, spec) {
  const [fxc, fyc] = focal(rng);
  const eramp = interpolate([pal.accent, pal.highlight], "oklch");
  const v = (spec.variant | 0) % 3;
  const drawEdge = (x1, y1, x2, y2) => {
    const t = 1 - Math.min(1, Math.hypot((x1 + x2) / 2 - fxc, (y1 + y2) / 2 - fyc) / (W * 0.6));
    ctx.globalAlpha = 0.2 + t * 0.5; ctx.strokeStyle = formatHex(eramp(0.3 + t * 0.7)); ctx.lineWidth = (0.9 + t * 1.1) * SUP;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  const drawNode = (x, y, boost = 0) => {
    const t = 1 - Math.min(1, Math.hypot(x - fxc, y - fyc) / (W * 0.6));
    ctx.globalAlpha = 0.5 + t * 0.5; ctx.fillStyle = formatHex(eramp(t));
    ctx.beginPath(); ctx.arc(x, y, (2 + t * 6 + boost) * SUP, 0, Math.PI * 2); ctx.fill();
  };

  if (v === 1) {
    // hub-and-spoke: a few hubs, each radiating to satellites
    const hubs = Array.from({ length: 3 + ((rng() * 2) | 0) }, () => [W * (0.2 + rng() * 0.6), H * (0.2 + rng() * 0.6)]);
    for (const [hx, hy] of hubs) {
      const spokes = 6 + ((rng() * 8) | 0);
      for (let i = 0; i < spokes; i++) {
        const a = rng() * Math.PI * 2, r = (40 + rng() * 150) * SUP;
        const x = hx + Math.cos(a) * r, y = hy + Math.sin(a) * r;
        drawEdge(hx, hy, x, y); drawNode(x, y);
      }
      for (const [gx, gy] of hubs) if (gx !== hx) drawEdge(hx, hy, gx, gy);
      drawNode(hx, hy, 3);
    }
  } else {
    // mesh (v0) or clustered (v2): blue-noise points, nearest-neighbour links
    const md = (v === 2 ? 52 : 70) - spec.density * 24;
    const pds = new PoissonDiskSampling({ shape: [W, H], minDistance: md * SUP, tries: 16 }, rng);
    let pts = pds.fill().filter(() => rng() < 0.85);
    if (v === 2) { // bias toward a couple of clusters for constellation feel
      const c = [[W * 0.32, H * 0.4], [W * 0.7, H * 0.6]];
      pts = pts.filter(([x, y]) => rng() < Math.max(0.25, 1 - Math.min(...c.map(([cx, cy]) => Math.hypot(x - cx, y - cy))) / (W * 0.4)));
    }
    const K = v === 2 ? 3 : 2;
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      const near = pts.map((p, j) => [j, Math.hypot(p[0] - x, p[1] - y)]).filter(([j]) => j !== i)
        .sort((a, b) => a[1] - b[1]).slice(0, K + ((rng() * 2) | 0));
      for (const [j, dd] of near) { if (dd > W * 0.26) continue; drawEdge(x, y, pts[j][0], pts[j][1]); }
    }
    for (const [x, y] of pts) drawNode(x, y, rng() * 2);
  }

  // the watched node
  ctx.globalAlpha = 1; ctx.fillStyle = pal.highlight;
  ctx.beginPath(); ctx.arc(fxc, fyc, 7 * SUP, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = pal.highlight; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5 * SUP;
  for (const rr of [16, 26, 38]) { ctx.beginPath(); ctx.arc(fxc, fyc, rr * SUP, 0, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = 1;
}

// Absence, exclusion, silence, what was struck or removed — rendered four ways
// so two void pieces never look like the same ring.
function voidComposition(ctx, pal, rng, noise, spec) {
  const ramp = interpolate([pal.accent, pal.highlight], "oklch");
  const dust = () => { ctx.globalAlpha = 0.16; ctx.fillStyle = pal.accent;
    for (let i = 0; i < 28; i++) { const x = rng() * W, y = rng() * H; ctx.beginPath(); ctx.arc(x, y, 1.4 * SUP, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; };
  const v = spec.variant | 0;

  if (v === 0) {
    // ring of marks with one conspicuous gap
    const cx = W * (0.5 + (rng() - 0.5) * 0.1), cy = H * (0.5 + (rng() - 0.5) * 0.1);
    const count = 26 + ((rng() * 10) | 0), gapStart = (rng() * count) | 0, gapLen = 2 + ((rng() * 2) | 0);
    const R = Math.min(W, H) * (0.30 + rng() * 0.05);
    for (let i = 0; i < count; i++) {
      if (i >= gapStart && i < gapStart + gapLen) continue;
      const a = (i / count) * Math.PI * 2, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R, s = (5 + rng() * 7) * SUP;
      ctx.globalAlpha = 0.65 + rng() * 0.3; ctx.fillStyle = formatHex(ramp(rng()));
      ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
    }
    const ga = ((gapStart + gapLen / 2) / count) * Math.PI * 2;
    ctx.globalAlpha = 0.3; ctx.strokeStyle = pal.highlight; ctx.lineWidth = 1.3 * SUP;
    ctx.beginPath(); ctx.arc(cx + Math.cos(ga) * R, cy + Math.sin(ga) * R, 9 * SUP, 0, Math.PI * 2); ctx.stroke();
  } else if (v === 1) {
    // everything crowded into one corner; a vast empty field; one lone mark adrift
    const corner = (rng() * 4) | 0;
    const ox = (corner & 1) ? W * 0.78 : W * 0.22, oy = (corner & 2) ? H * 0.74 : H * 0.26;
    for (let i = 0; i < 80; i++) {
      const a = rng() * Math.PI * 2, r = Math.pow(rng(), 1.7) * W * 0.26;
      const x = ox + Math.cos(a) * r, y = oy + Math.sin(a) * r * 0.7, s = (3 + rng() * 8) * SUP;
      ctx.globalAlpha = 0.5 + rng() * 0.4; ctx.fillStyle = formatHex(ramp(0.3 + rng() * 0.6));
      ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
    }
    const lx = W - ox + (rng() - 0.5) * W * 0.1, ly = H - oy + (rng() - 0.5) * H * 0.1;
    ctx.globalAlpha = 0.95; ctx.fillStyle = pal.highlight;
    ctx.beginPath(); ctx.arc(lx, ly, 6 * SUP, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.3; ctx.strokeStyle = pal.highlight; ctx.lineWidth = 1.2 * SUP;
    ctx.beginPath(); ctx.arc(lx, ly, 14 * SUP, 0, Math.PI * 2); ctx.stroke();
  } else if (v === 2) {
    // a single horizontal row of marks with a gap torn out of the middle
    const y = H * (0.42 + rng() * 0.16), n = 16 + ((rng() * 8) | 0);
    const gap = 5 + ((rng() * (n - 10)) | 0), gl = 2 + ((rng() * 2) | 0);
    const m = W * 0.12;
    for (let i = 0; i < n; i++) {
      if (i >= gap && i < gap + gl) continue;
      const x = m + (i / (n - 1)) * (W - 2 * m), s = (4 + rng() * 7) * SUP;
      ctx.globalAlpha = 0.6 + rng() * 0.35; ctx.fillStyle = formatHex(ramp(i / n));
      ctx.beginPath(); ctx.arc(x, y + (rng() - 0.5) * 8 * SUP, s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 0.22; ctx.strokeStyle = pal.highlight; ctx.lineWidth = 1.1 * SUP;
    ctx.setLineDash([4 * SUP, 6 * SUP]); ctx.beginPath(); ctx.moveTo(W * 0.1, y); ctx.lineTo(W * 0.9, y); ctx.stroke(); ctx.setLineDash([]);
  } else {
    // a dense halo of marks around an explicit dark void, one bright survivor
    const cx = W * (0.5 + (rng() - 0.5) * 0.12), cy = H * (0.5 + (rng() - 0.5) * 0.12);
    const hole = Math.min(W, H) * (0.20 + rng() * 0.05);
    // the void itself: a darker disc with a faint rim
    ctx.globalAlpha = 0.45; ctx.fillStyle = pal.ground0;
    ctx.beginPath(); ctx.arc(cx, cy, hole, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.25; ctx.strokeStyle = pal.highlight; ctx.lineWidth = 1.2 * SUP;
    ctx.beginPath(); ctx.arc(cx, cy, hole, 0, Math.PI * 2); ctx.stroke();
    // dense halo packed just outside the void, thinning outward
    for (let i = 0; i < 220; i++) {
      const a = rng() * Math.PI * 2, r = hole + Math.pow(rng(), 1.8) * Math.min(W, H) * 0.34;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (x < 0 || x > W || y < 0 || y > H) continue;
      const fall = 1 - (r - hole) / (Math.min(W, H) * 0.34);
      const s = (2 + rng() * 6 * fall) * SUP;
      ctx.globalAlpha = 0.4 + fall * 0.5; ctx.fillStyle = formatHex(ramp(rng() * 0.4 + fall * 0.3));
      ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
    }
    // one bright survivor alone inside the void
    const a = rng() * Math.PI * 2, sr = hole * (0.3 + rng() * 0.35);
    ctx.globalAlpha = 1; ctx.fillStyle = pal.highlight;
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * sr, cy + Math.sin(a) * sr, 6 * SUP, 0, Math.PI * 2); ctx.fill();
  }
  dust();
}

// Streaks funnel from every edge to a single bright core. Focus, control,
// chokepoints, leverage, collapse to one point.
function convergence(ctx, pal, rng, noise, spec) {
  const fx = W * (0.42 + rng() * 0.16), fy = H * (0.4 + rng() * 0.2);
  const ramp = interpolate([pal.ground1, pal.accent, pal.highlight], "oklch");
  const N = Math.round(120 + spec.density * 200);
  for (let i = 0; i < N; i++) {
    const e = rng(); let x, y;
    if (e < 0.25) { x = rng() * W; y = 0; } else if (e < 0.5) { x = W; y = rng() * H; }
    else if (e < 0.75) { x = rng() * W; y = H; } else { x = 0; y = rng() * H; }
    const steps = 40; ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < steps; s++) {
      const t = s / steps, mx = x + (fx - x) * t, my = y + (fy - y) * t;
      const n = noise(mx * 0.001, my * 0.001) * (1 - t) * 40 * SUP;
      ctx.lineTo(mx + n, my - n);
    }
    ctx.globalAlpha = 0.05 + rng() * 0.18; ctx.strokeStyle = formatHex(ramp(rng() * 0.6 + 0.2));
    ctx.lineWidth = (0.6 + rng() * 1.2) * SUP; ctx.stroke();
  }
  const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 60 * SUP);
  g.addColorStop(0, pal.highlight); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.9; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, 60 * SUP, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

// Cycles, routine, repetition, time, loops — three forms (rings / spiral / arcs).
function orbit(ctx, pal, rng, noise, spec) {
  const cx = W * (0.5 + (rng() - 0.5) * 0.08), cy = H * (0.5 + (rng() - 0.5) * 0.08);
  const ramp = interpolate([pal.accent, pal.highlight], "oklch");
  const v = (spec.variant | 0) % 3;

  if (v === 0) {
    // concentric rings with orbiting marks
    const rings = 4 + ((rng() * 3) | 0);
    for (let k = 1; k <= rings; k++) {
      const R = (Math.min(W, H) * 0.08 * k) * (0.9 + rng() * 0.2);
      ctx.globalAlpha = 0.5 + 0.18 * rng(); ctx.strokeStyle = formatHex(ramp(0.35 + 0.55 * (k / rings))); ctx.lineWidth = 2.1 * SUP;
      ctx.setLineDash(rng() < 0.5 ? [6 * SUP, 8 * SUP] : []);
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      const m = 3 + ((rng() * 6) | 0);
      for (let i = 0; i < m; i++) {
        const a = rng() * Math.PI * 2, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R, s = (3 + rng() * 5) * SUP;
        ctx.globalAlpha = 0.7 + rng() * 0.3; ctx.fillStyle = formatHex(ramp(k / rings));
        ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else if (v === 1) {
    // a single spiral wound from the center outward
    const turns = 3 + rng() * 2, maxR = Math.min(W, H) * 0.42, steps = 520;
    ctx.lineWidth = 2.2 * SUP; ctx.globalAlpha = 0.7; ctx.strokeStyle = formatHex(ramp(0.7));
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, a = t * turns * Math.PI * 2, r = t * maxR;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    for (let i = 0; i < 14; i++) {
      const t = (i + 1) / 15, a = t * turns * Math.PI * 2, r = t * maxR;
      ctx.globalAlpha = 0.8; ctx.fillStyle = formatHex(ramp(t));
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, (2.5 + t * 5) * SUP, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    // nested broken arcs sweeping the same direction — a clock that never closes
    const rings = 5 + ((rng() * 3) | 0);
    for (let k = 1; k <= rings; k++) {
      const R = (Math.min(W, H) * 0.07 * k) * (0.9 + rng() * 0.15);
      const a0 = rng() * Math.PI * 2, sweep = Math.PI * (0.7 + rng() * 0.9);
      ctx.globalAlpha = 0.45 + 0.2 * rng(); ctx.strokeStyle = formatHex(ramp(0.3 + 0.6 * (k / rings)));
      ctx.lineWidth = (2.4 - k * 0.12) * SUP;
      ctx.beginPath(); ctx.arc(cx, cy, R, a0, a0 + sweep); ctx.stroke();
      ctx.globalAlpha = 0.9; ctx.fillStyle = formatHex(ramp(k / rings));
      ctx.beginPath(); ctx.arc(cx + Math.cos(a0 + sweep) * R, cy + Math.sin(a0 + sweep) * R, 3.5 * SUP, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1; ctx.fillStyle = pal.highlight;
  ctx.beginPath(); ctx.arc(cx, cy, 6 * SUP, 0, Math.PI * 2); ctx.fill();
}

// Signal vs noise, benchmarks, metrics, hype, data — three readings
// (waveform / bars / scatter-with-trend), one headline point marked.
function signal(ctx, pal, rng, noise, spec) {
  const baseY = H * (0.5 + (rng() - 0.5) * 0.2);
  const ramp = interpolate([pal.accent, pal.highlight], "oklch");
  ctx.globalAlpha = 0.10; ctx.strokeStyle = pal.accent; ctx.lineWidth = 1 * SUP;
  for (let y = 0; y < H; y += 14 * SUP) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  const v = (spec.variant | 0) % 3;
  let px = W * (0.3 + rng() * 0.4), py = baseY - 70 * SUP;

  if (v === 1) {
    // vertical bars — a metric series rising then dropping
    const n = 26 + ((rng() * 14) | 0), bw = (W / n) * 0.62, m = W * 0.06;
    let peakX = 0, peakH = 0;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), x = m + t * (W - 2 * m);
      const env = Math.sin(t * Math.PI) * (0.6 + 0.4 * spec.density);
      const h = (env * (H * 0.5) + noise(i * 0.3, 0) * 30 * SUP) * (0.5 + rng() * 0.6);
      if (h > peakH) { peakH = h; peakX = x; }
      ctx.globalAlpha = 0.45 + 0.4 * env; ctx.fillStyle = formatHex(ramp(t));
      ctx.fillRect(x - bw / 2, baseY - h, bw, h);
    }
    px = peakX; py = baseY - peakH - 12 * SUP;
  } else if (v === 2) {
    // scatter of measurements with a fitted trend line
    const slope = (rng() - 0.5) * 0.6, m = W * 0.06;
    ctx.lineWidth = 2.2 * SUP; ctx.globalAlpha = 0.7; ctx.strokeStyle = formatHex(ramp(0.8));
    ctx.beginPath(); ctx.moveTo(m, baseY + 80 * SUP); ctx.lineTo(W - m, baseY + 80 * SUP - slope * W); ctx.stroke();
    const N = Math.round(60 + spec.density * 120);
    for (let i = 0; i < N; i++) {
      const t = rng(), x = m + t * (W - 2 * m);
      const trend = baseY + 80 * SUP - slope * (x - m);
      const y = trend + (rng() - 0.5) * 120 * SUP;
      ctx.globalAlpha = 0.5 + rng() * 0.4; ctx.fillStyle = formatHex(ramp(t));
      ctx.beginPath(); ctx.arc(x, y, (2 + rng() * 3) * SUP, 0, Math.PI * 2); ctx.fill();
    }
    px = m + 0.5 * (W - 2 * m); py = baseY + 80 * SUP - slope * (px - m) - 90 * SUP;
  } else {
    // layered waveform degrading clean→noisy
    const dir = rng() < 0.5 ? 1 : -1;
    for (let L = 0; L < 3; L++) {
      ctx.beginPath();
      const amp = (40 + L * 30) * SUP, freq = (0.004 + L * 0.002);
      for (let x = 0; x <= W; x += 2 * SUP) {
        const tx = dir > 0 ? x / W : 1 - x / W;
        const y = baseY - L * 8 * SUP + Math.sin(x * freq) * amp * (1 - tx * 0.6) + noise(x * 0.01, L * 5) * amp * tx * spec.density;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.globalAlpha = 0.4 - L * 0.1; ctx.strokeStyle = formatHex(ramp(L / 3)); ctx.lineWidth = (2 - L * 0.4) * SUP; ctx.stroke();
    }
  }

  ctx.globalAlpha = 0.85; ctx.fillStyle = pal.highlight;
  ctx.beginPath(); ctx.arc(px, py, 5 * SUP, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.3; ctx.lineWidth = 1 * SUP; ctx.strokeStyle = pal.highlight;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, baseY); ctx.stroke();
  ctx.globalAlpha = 1;
}

// archetype → renderer (flow/grid/fracture reuse the originals)
const ARCH_GEN = {
  flow: flowField, grid: warpGrid, fracture: voronoiShards,
  division, network, void: voidComposition, convergence, orbit, signal,
};

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

// deterministic SVG monogram avatar for AI bylines without a photo
export function makeAvatar(name, accent = "#e8482b") {
  const rng = mulberry32(xfnv1a(name));
  const parts = name.replace(/^The /, "").split(/\s+/);
  const initials = (parts.slice(0, 2).map(p => p[0]).join("") || "AI").toUpperCase();
  const bg = formatHex(clampChroma(oklch({ mode: "oklch", l: 0.16, c: 0.05, h: (xfnv1a(name) % 360) }), "oklch"));
  let dots = "";
  for (let i = 0; i < 14; i++) dots += `<circle cx="${(rng() * 200) | 0}" cy="${(rng() * 200) | 0}" r="${(3 + rng() * 14) | 0}" fill="${accent}" opacity="${(0.06 + rng() * 0.14).toFixed(2)}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
<rect width="200" height="200" fill="${bg}"/>${dots}
<text x="100" y="100" font-family="Georgia, serif" font-weight="700" font-size="86" fill="${accent}" text-anchor="middle" dominant-baseline="central">${initials}</text></svg>`;
}

// Accepts a post object { slug, title, section, dek, tags, art } — or, for
// backward compatibility, the legacy (slug, title, section) positional form.
export function makeCover(arg1, title, section = "dispatches") {
  const post = (arg1 && typeof arg1 === "object") ? arg1 : { slug: arg1, title, section };
  const spec = deriveArtSpec(post);
  const seed = spec.seed;
  const rng = mulberry32(seed);
  const noise = createNoise2D(rng);
  const pal = palette(spec.hue, rng, { chroma: spec.chroma, lightBias: spec.lightBias });

  const big = createCanvas(W, H);
  const ctx = big.getContext("2d");
  ground(ctx, pal, rng, noise);
  (ARCH_GEN[spec.archetype] || flowField)(ctx, pal, rng, noise, spec);
  finish(ctx, pal, rng, noise);
  brand(ctx, pal, post.section || spec.section, post.title || title, seed);

  // downscale to output
  const out = createCanvas(OW, OH);
  const octx = out.getContext("2d");
  octx.imageSmoothingEnabled = true; octx.imageSmoothingQuality = "high";
  octx.drawImage(big, 0, 0, OW, OH);
  return out.toBuffer("image/png");
}
