import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const FAVICONS_DIR = path.resolve(ROOT, 'site/favicons');
const SVG_PATH = path.resolve(FAVICONS_DIR, 'favicon.svg');
const svgContent = fs.readFileSync(SVG_PATH, 'utf8');

const SIZES = [
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
];

const browser = await chromium.launch();

for (const { name, size } of SIZES) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: size, height: size });

  const html = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; }
  body { width: ${size}px; height: ${size}px; overflow: hidden; background: transparent; }
  img { width: ${size}px; height: ${size}px; display: block; }
</style>
</head>
<body>
  <img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}"/>
</body>
</html>`;

  await page.setContent(html);
  const outputPath = path.resolve(FAVICONS_DIR, name);
  await page.screenshot({ path: outputPath, clip: { x: 0, y: 0, width: size, height: size } });
  console.log(`Generated ${name} (${size}x${size})`);
  await page.close();
}

await browser.close();
