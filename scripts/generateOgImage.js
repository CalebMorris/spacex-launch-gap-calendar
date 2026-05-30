#!/usr/bin/env node
// Generates og-image.svg from launch data. Called automatically by fetchLaunches.js
// after every sync. Can also be run standalone: node scripts/generateOgImage.js
//
// Layout rationale: 4×3 month grid (not 6×2) so each card is ~262×133px in the
// 1200×630 source — at Discord mobile's ~350px render width cards are ~76px wide,
// keeping the heat-pattern readable even when individual dots are small.
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Color palette (mirrors the main site) ──────────────────────────────────
const BG             = '#002b36';
const SURFACE        = '#073642';
const BORDER         = '#0e4255';
const TEXT_DIM       = '#586e75';
const TEXT_SECONDARY = '#7a9aaa';
const TEXT_PRIMARY   = '#93a1a1';
const ACCENT_LIGHT   = '#cba020';
const ACCENT_BRIGHT  = '#e0bb40';

const L_FILL   = ['#073642', '#291d08', '#372508', '#452c08'];
const L_STROKE = [BORDER,    '#5e4010', '#7e5818', '#b07018'];

const MONTH_ABBR  = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const DOW_ABBR    = ['S','M','T','W','T','F','S'];
const LAYOUT_YEAR = new Date().getFullYear();

// ── Image & grid dimensions ────────────────────────────────────────────────
const IMG_W = 1200;
const IMG_H = 630;
const PAD_X = 56;

const CAL_TOP = 192;
const CAL_BOT = 610;
const CAL_W   = IMG_W - 2 * PAD_X;          // 1088
const CAL_H   = CAL_BOT - CAL_TOP;          // 418

const COLS  = 4;
const ROWS  = 3;
const H_GAP = 10;
const V_GAP = 8;

const CARD_W = Math.floor((CAL_W - H_GAP * (COLS - 1)) / COLS);  // 262
const CARD_H = Math.floor((CAL_H - V_GAP * (ROWS - 1)) / ROWS);  // 134

// ── Pure utilities ─────────────────────────────────────────────────────────
function heatLevel(count) {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  return 3;
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function firstDow(year, monthIndex) {
  return new Date(year, monthIndex, 1).getDay();
}

function renderMonth(monthIndex, cx, cy, dayCounts) {
  const monthStr  = String(monthIndex + 1).padStart(2, '0');
  const LABEL_H   = 20;
  const SEP_Y     = cy + LABEL_H;
  const DOW_H     = 13;
  const GRID_TOP  = SEP_Y + DOW_H + 2;
  const GRID_H    = CARD_H - LABEL_H - DOW_H - 4;

  const DOT_STEP_X = Math.floor(CARD_W / 7);  // 37
  const DOT_STEP_Y = Math.floor(GRID_H / 6);  // ~16
  const DOT_W      = DOT_STEP_X - 3;          // 34
  const DOT_H      = DOT_STEP_Y - 2;          // ~14

  const parts = [];

  parts.push(`<rect x="${cx}" y="${cy}" width="${CARD_W}" height="${CARD_H}" fill="${SURFACE}"/>`);

  parts.push(
    `<text x="${cx + CARD_W / 2}" y="${cy + 13}" text-anchor="middle" ` +
    `font-family="'Courier New',monospace" font-size="10" font-weight="600" ` +
    `letter-spacing="3" fill="${TEXT_PRIMARY}">${MONTH_ABBR[monthIndex]}</text>`
  );

  parts.push(
    `<line x1="${cx + 4}" y1="${SEP_Y}" x2="${cx + CARD_W - 4}" y2="${SEP_Y}" ` +
    `stroke="${BORDER}" stroke-width="0.5"/>`
  );

  for (let d = 0; d < 7; d++) {
    parts.push(
      `<text x="${cx + d * DOT_STEP_X + DOT_STEP_X / 2}" y="${SEP_Y + DOW_H - 1}" ` +
      `text-anchor="middle" font-family="'Courier New',monospace" font-size="7" ` +
      `fill="${TEXT_DIM}">${DOW_ABBR[d]}</text>`
    );
  }

  const numDays = daysInMonth(LAYOUT_YEAR, monthIndex);
  let col = firstDow(LAYOUT_YEAR, monthIndex);
  let row = 0;

  for (let day = 1; day <= numDays; day++) {
    const key   = `${monthStr}-${String(day).padStart(2, '0')}`;
    const level = heatLevel(dayCounts[key] || 0);
    const dx    = cx + col * DOT_STEP_X + 1;
    const dy    = GRID_TOP + row * DOT_STEP_Y + 1;

    parts.push(
      `<rect x="${dx}" y="${dy}" width="${DOT_W}" height="${DOT_H}" ` +
      `fill="${L_FILL[level]}" stroke="${L_STROKE[level]}" ` +
      `stroke-width="${level > 0 ? 1 : 0}" rx="1"/>`
    );

    col++;
    if (col === 7) { col = 0; row++; }
  }

  return parts.join('\n');
}

// ── Main export ────────────────────────────────────────────────────────────
export function generate() {
  const data = JSON.parse(
    readFileSync(resolve(__dirname, '../data/launches.json'), 'utf-8')
  );

  const { byDay: dayMap } = data;

  let totalLaunches = 0;
  let uniqueDays    = 0;
  const yearSet  = new Set();
  const dayCounts = {};

  for (const [key, launches] of Object.entries(dayMap)) {
    if (launches.length === 0) continue;
    totalLaunches += launches.length;
    uniqueDays++;
    dayCounts[key] = launches.length;
    for (const launch of launches) {
      yearSet.add(new Date(launch.date).getUTCFullYear());
    }
  }

  const years     = [...yearSet].sort((a, b) => a - b);
  const yearRange = `${years[0]}–${years[years.length - 1]}`;
  const mid       = IMG_W / 2;

  const monthBlocks = [];
  for (let mi = 0; mi < 12; mi++) {
    const gridRow = Math.floor(mi / COLS);
    const gridCol = mi % COLS;
    const cx = PAD_X + gridCol * (CARD_W + H_GAP);
    const cy = CAL_TOP + gridRow * (CARD_H + V_GAP);
    monthBlocks.push(renderMonth(mi, cx, cy, dayCounts));
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${IMG_W}" height="${IMG_H}" viewBox="0 0 ${IMG_W} ${IMG_H}">
  <defs>
    <radialGradient id="top-glow" cx="50%" cy="0%" r="65%">
      <stop offset="0%" stop-color="#b58900" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#b58900" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${IMG_W}" height="${IMG_H}" fill="${BG}"/>
  <rect width="${IMG_W}" height="${IMG_H}" fill="url(#top-glow)"/>

  <text x="${mid}" y="42" text-anchor="middle"
    font-family="'Courier New',monospace" font-size="11" letter-spacing="6"
    fill="${ACCENT_LIGHT}">MISSION OPERATIONS LOG</text>

  <text x="${mid}" y="100" text-anchor="middle"
    font-family="'Arial Black','Arial',sans-serif" font-size="52" font-weight="900" letter-spacing="3"
    fill="white">SpaceX Launch Calendar</text>

  <text x="${mid - 290}" y="152" text-anchor="middle"
    font-family="'Courier New',monospace" font-size="30" font-weight="700"
    fill="${ACCENT_BRIGHT}">${totalLaunches.toLocaleString()}</text>
  <text x="${mid - 290}" y="168" text-anchor="middle"
    font-family="'Courier New',monospace" font-size="9" letter-spacing="2"
    fill="${TEXT_SECONDARY}">TOTAL LAUNCHES</text>

  <text x="${mid}" y="152" text-anchor="middle"
    font-family="'Courier New',monospace" font-size="30" font-weight="700"
    fill="${ACCENT_BRIGHT}">${uniqueDays.toLocaleString()}</text>
  <text x="${mid}" y="168" text-anchor="middle"
    font-family="'Courier New',monospace" font-size="9" letter-spacing="2"
    fill="${TEXT_SECONDARY}">UNIQUE LAUNCH DAYS</text>

  <text x="${mid + 290}" y="152" text-anchor="middle"
    font-family="'Courier New',monospace" font-size="30" font-weight="700"
    fill="${ACCENT_BRIGHT}">${yearRange}</text>
  <text x="${mid + 290}" y="168" text-anchor="middle"
    font-family="'Courier New',monospace" font-size="9" letter-spacing="2"
    fill="${TEXT_SECONDARY}">YEARS COVERED</text>

  <line x1="${PAD_X}" y1="182" x2="${IMG_W - PAD_X}" y2="182"
    stroke="${BORDER}" stroke-width="1"/>

  ${monthBlocks.join('\n  ')}

  <text x="${mid}" y="${IMG_H - 12}" text-anchor="middle"
    font-family="'Courier New',monospace" font-size="11" letter-spacing="2"
    fill="${TEXT_DIM}">Every mission. Every day. Interactive.</text>
</svg>`;

  writeFileSync(resolve(__dirname, '../og-image.svg'), svg);
  console.log(`Generated og-image.svg — ${totalLaunches} launches · ${uniqueDays} unique days · ${yearRange}`);
}

// Run standalone when invoked directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generate();
}
