#!/usr/bin/env node
// Generate branded Zenith WMS icons (PNG sizes) from an SVG template.
// Requires: sharp (devDependency)

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const outDir = path.resolve(__dirname, '..', 'icons', 'png');
const sizes = [16, 32, 48, 64, 128, 256, 512];

// Simple branded SVG: gradient background with stylized Z glyph
const svgTemplate = (size) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1f2937"/>
      <stop offset="100%" stop-color="#0ea5e9"/>
    </linearGradient>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect x="0" y="0" width="512" height="512" rx="96" fill="url(#bg)"/>
  <g filter="url(#shadow)">
    <path d="M120,160 L392,160 L320,224 L208,224 L392,352 L392,392 L120,392 L192,328 L304,328 L120,200 Z"
          fill="#e2e8f0"/>
  </g>
  <text x="256" y="468" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto" font-weight="600" font-size="64" text-anchor="middle" fill="#ffffff" opacity="0.85">Zenith</text>
  <text x="256" y="508" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto" font-weight="500" font-size="36" text-anchor="middle" fill="#ffffff" opacity="0.75">WMS</text>
</svg>`;

async function main() {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  for (const sz of sizes) {
    const svg = svgTemplate(sz);
    const pngPath = path.join(outDir, `${sz}.png`);
    await sharp(Buffer.from(svg))
      .resize(sz, sz, { fit: 'cover' })
      .png({ compressionLevel: 9 })
      .toFile(pngPath);
    console.log(`Wrote ${pngPath}`);
  }
  // Also write a primary icon.png
  const primary = path.join(path.dirname(outDir), 'icon.png');
  await sharp(Buffer.from(svgTemplate(512)))
    .png({ compressionLevel: 9 })
    .toFile(primary);
  console.log(`Wrote ${primary}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
