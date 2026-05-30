import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const PORT = 8787;
const ROOT = path.resolve(import.meta.dirname, '..');
const OUTPUT_DIR = path.resolve(ROOT, 'screenshots');
const DATE = new Date().toISOString().slice(0, 10);
const OUTPUT = path.resolve(OUTPUT_DIR, `screenshot-${DATE}.png`);

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
      const filePath = path.join(ROOT, urlPath);
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
await page.screenshot({ path: OUTPUT, fullPage: true });
console.log(`Screenshot saved to ${OUTPUT}`);

await browser.close();
server.close();
