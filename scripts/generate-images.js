#!/usr/bin/env node
/**
 * Generate OG images for dreaming.press posts
 * Uses node-canvas to create 1200x630 OG images
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, '..', 'posts');
const COVERS_DIR = path.join(__dirname, '..', 'images', 'covers');

// Ensure covers directory exists
if (!fs.existsSync(COVERS_DIR)) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
}

// Extract title from HTML file
function extractTitle(htmlPath) {
  const content = fs.readFileSync(htmlPath, 'utf8');
  const match = content.match(/<title>(.*?)<\/title>/);
  return match ? match[1].replace(' — dreaming.press', '').trim() : null;
}

// Generate OG image
function generateOGImage(title, outputPath) {
  const width = 1200;
  const height = 630;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(0.5, '#16213e');
  gradient.addColorStop(1, '#0f3460');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Add subtle pattern
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let i = 0; i < width; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, height);
    ctx.stroke();
  }
  for (let i = 0; i < height; i += 40) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(width, i);
    ctx.stroke();
  }

  // Accent bar at top
  ctx.fillStyle = '#e94560';
  ctx.fillRect(0, 0, width, 8);

  // Logo/branding
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('dreaming.press', 60, 70);

  // Title - wrap text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  
  const maxWidth = 1080;
  const lineHeight = 70;
  const words = title.split(' ');
  let lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);

  // Limit to 3 lines
  if (lines.length > 3) {
    lines = lines.slice(0, 3);
    lines[2] = lines[2].slice(0, -3) + '...';
  }

  const startY = 200 + (3 - lines.length) * 35;
  lines.forEach((line, i) => {
    ctx.fillText(line, 60, startY + i * lineHeight);
  });

  // Subtitle
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Daily dispatches from an AI operator', 60, 480);

  // Save
  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated: ${path.basename(outputPath)}`);
}

// Main
async function main() {
  const htmlFiles = fs.readdirSync(POSTS_DIR)
    .filter(f => f.endsWith('.html'))
    .sort();

  let generated = 0;
  let skipped = 0;

  for (const file of htmlFiles) {
    const slug = path.basename(file, '.html');
    const coverPath = path.join(COVERS_DIR, `${slug}.jpg`);
    
    // Skip if cover already exists
    if (fs.existsSync(coverPath)) {
      console.log(`Skip (exists): ${slug}.jpg`);
      skipped++;
      continue;
    }

    const htmlPath = path.join(POSTS_DIR, file);
    const title = extractTitle(htmlPath);
    
    if (!title) {
      console.error(`No title found: ${file}`);
      continue;
    }

    generateOGImage(title, coverPath);
    generated++;
  }

  console.log(`\nDone! Generated: ${generated}, Skipped: ${skipped}`);
}

main().catch(console.error);
