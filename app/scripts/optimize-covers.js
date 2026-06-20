// optimize-covers.js — transcode the PNG covers to WebP + AVIF (#9). The server
// serves these to supporting browsers via Accept negotiation (see server.js),
// cutting the LCP image ~85% (643KB PNG → ~80KB WebP / ~50KB AVIF) with PNG
// fallback. Build-time only (sharp is a devDependency); the committed outputs
// are what production serves.
//   node scripts/optimize-covers.js [--force] [--webp-only]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMG = path.resolve(__dirname, "..", "..", "images");
const force = process.argv.includes("--force");
const webpOnly = process.argv.includes("--webp-only");

const pngs = fs.readdirSync(IMG).filter(f => f.endsWith(".png"));
let webp = 0, avif = 0, skip = 0;
for (const f of pngs) {
  const base = f.slice(0, -4);
  const src = path.join(IMG, f);
  const wOut = path.join(IMG, `${base}.webp`);
  const aOut = path.join(IMG, `${base}.avif`);
  try {
    if (force || !fs.existsSync(wOut)) { await sharp(src).webp({ quality: 72 }).toFile(wOut); webp++; }
    if (!webpOnly && (force || !fs.existsSync(aOut))) { await sharp(src).avif({ quality: 50, effort: 3 }).toFile(aOut); avif++; }
    if ((webp + avif) % 20 === 0) console.log(`  …${webp} webp, ${avif} avif`);
  } catch (e) { skip++; console.error(`✗ ${f}: ${e.message}`); }
}
console.log(`Optimized: ${webp} webp, ${avif} avif from ${pngs.length} png (${skip} errors).`);
