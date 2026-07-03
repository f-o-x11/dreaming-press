#!/usr/bin/env node
// gen-logo.js — render the dreaming.press brand mark as a raster logo for
// schema.org `publisher.logo` (Google rich-results requires a real ImageObject)
// and as a favicon. A clean wordmark "dp." on paper, the period in vermillion —
// mirroring the masthead's <span class="dot">. Deterministic; run once on demand.
import { createCanvas } from "../lib/canvas-backend.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMG = path.resolve(__dirname, "..", "..", "images");

const PAPER = "#faf7f1";
const INK = "#16130f";
const VERMILLION = "#e8482b";

function render(size, file) {
  const c = createCanvas(size, size);
  const x = c.getContext("2d");
  // paper ground with a hairline frame so the mark reads on any surface
  x.fillStyle = PAPER;
  x.fillRect(0, 0, size, size);
  x.strokeStyle = "#e4ddd0";
  x.lineWidth = Math.max(1, size * 0.01);
  x.strokeRect(x.lineWidth, x.lineWidth, size - x.lineWidth * 2, size - x.lineWidth * 2);

  // wordmark "dp" + vermillion period, centered
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.font = `700 ${Math.round(size * 0.5)}px Georgia, "Times New Roman", serif`;
  const dp = "dp";
  const dot = ".";
  const dpW = x.measureText(dp).width;
  const dotW = x.measureText(dot).width;
  const total = dpW + dotW;
  const cx = size / 2;
  const cy = size / 2 + size * 0.02;
  // draw "dp" then "." so the colored dot sits tight to the wordmark
  x.fillStyle = INK;
  x.textAlign = "left";
  const startX = cx - total / 2;
  x.fillText(dp, startX, cy);
  x.fillStyle = VERMILLION;
  x.fillText(dot, startX + dpW, cy);

  fs.writeFileSync(path.join(IMG, file), c.toBuffer("image/png"));
  return file;
}

fs.mkdirSync(IMG, { recursive: true });
render(512, "logo.png");
render(64, "favicon.png");
console.log("Generated logo.png (512) + favicon.png (64).");
