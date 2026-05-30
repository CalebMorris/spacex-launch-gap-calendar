import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const PORT = 8787;
const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const SITE_DIR = path.resolve(PROJECT_ROOT, 'site');
const OUTPUT_DIR = path.resolve(PROJECT_ROOT, 'screenshots');
const OUTPUT_DESKTOP = path.resolve(OUTPUT_DIR, 'screenshot.png');
const OUTPUT_MOBILE = path.resolve(OUTPUT_DIR, 'screenshot-mobile.png');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      const urlPath = request.url === '/' ? '/index.html' : request.url;
      const filePath = path.join(SITE_DIR, urlPath);
      const extension = path.extname(filePath);
      const contentType = MIME_TYPES[extension] ?? 'application/octet-stream';

      fs.readFile(filePath, (error, content) => {
        if (error) {
          response.writeHead(404);
          response.end('Not found');
          return;
        }
        response.writeHead(200, { 'Content-Type': contentType });
        response.end(content);
      });
    });

    server.listen(PORT, () => resolve(server));
  });
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const server = await startServer();
console.log(`Server running at http://localhost:${PORT}`);

const browser = await chromium.launch();
const page = await browser.newPage();

await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
await page.screenshot({ path: OUTPUT_DESKTOP, fullPage: true });
console.log(`Desktop screenshot saved to ${OUTPUT_DESKTOP}`);

await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: 'networkidle' });
await page.screenshot({ path: OUTPUT_MOBILE, fullPage: true });
console.log(`Mobile screenshot saved to ${OUTPUT_MOBILE}`);

await browser.close();
server.close();
