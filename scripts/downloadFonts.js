#!/usr/bin/env node
/**
 * Downloads the Google Fonts used by this site as local WOFF2 files.
 * Run once with: node scripts/downloadFonts.js
 * Commit the resulting site/fonts/ files to the repo.
 */
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.join(__dirname, '..', 'site', 'fonts');

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;900&family=Share+Tech+Mono&display=swap';

// A modern Chrome UA is required — Google Fonts serves WOFF2 only to browsers
// that declare support via the User-Agent header.
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function toFileName(family, weight) {
  return `${family.toLowerCase().replace(/\s+/g, '-')}-${weight}.woff2`;
}

async function fetchGoogleFontsCss() {
  const response = await fetch(GOOGLE_FONTS_URL, {
    headers: { 'User-Agent': CHROME_UA },
  });
  if (!response.ok) throw new Error(`CSS fetch failed: ${response.status}`);
  return response.text();
}

function parseFontFaceBlocks(css) {
  const blocks = [];
  const blockRegex = /@font-face\s*\{([^}]+)\}/g;
  let match;
  while ((match = blockRegex.exec(css)) !== null) {
    const body = match[1];
    const prop = (name) => {
      const m = body.match(new RegExp(`${name}:\\s*([^;]+);`));
      return m ? m[1].trim() : null;
    };
    const urlMatch = body.match(/url\(([^)]+)\)/);
    if (!urlMatch) continue;
    blocks.push({
      family: prop('font-family')?.replace(/['"]/g, '') ?? '',
      weight: prop('font-weight') ?? '400',
      style: prop('font-style') ?? 'normal',
      display: prop('font-display') ?? 'swap',
      unicodeRange: prop('unicode-range'),
      url: urlMatch[1],
    });
  }
  return blocks;
}

async function downloadWoff2(url, filePath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Font download failed: ${response.status} ${url}`);
  const buffer = await response.arrayBuffer();
  writeFileSync(filePath, Buffer.from(buffer));
}

async function main() {
  mkdirSync(FONTS_DIR, { recursive: true });

  console.log('Fetching Google Fonts CSS...');
  const css = await fetchGoogleFontsCss();
  const blocks = parseFontFaceBlocks(css);

  // Google Fonts returns multiple @font-face blocks per (family, weight) for
  // different unicode ranges (cyrillic, greek, latin-ext, latin…). The latin
  // block is always last. We only need latin for this English-only site, so
  // "last one wins" gives us exactly one WOFF2 per (family, weight).
  const byKey = new Map();
  for (const block of blocks) {
    byKey.set(`${block.family}-${block.weight}`, block);
  }

  const fontFaceRules = [];

  for (const block of byKey.values()) {
    const fileName = toFileName(block.family, block.weight);
    const filePath = path.join(FONTS_DIR, fileName);

    console.log(`  Downloading ${fileName}...`);
    await downloadWoff2(block.url, filePath);

    const lines = [
      '@font-face {',
      `  font-family: '${block.family}';`,
      `  font-style: ${block.style};`,
      `  font-weight: ${block.weight};`,
      `  font-display: ${block.display};`,
      `  src: url('/fonts/${fileName}') format('woff2');`,
    ];
    if (block.unicodeRange) lines.push(`  unicode-range: ${block.unicodeRange};`);
    lines.push('}');
    fontFaceRules.push(lines.join('\n'));
  }

  console.log('\nGenerated @font-face rules (add to <style> block in src/template.html):');
  console.log('─'.repeat(60));
  console.log(fontFaceRules.join('\n'));
  console.log('─'.repeat(60));
  console.log(`\nDone. ${byKey.size} font files saved to site/fonts/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
