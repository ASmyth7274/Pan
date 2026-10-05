// Writes the PWA icons into /icons using the in-game art.
//   1) serve the repo:  npx http-server . -p 8080
//   2) node tools/make-icons.mjs  (needs Playwright)
import fs from 'fs';
import path from 'path';
const PW = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(PW);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto((process.env.BASE || 'http://127.0.0.1:8080') + '/tools/icon-maker.html');
await page.waitForFunction(() => window.__done === true);
const icons = await page.evaluate(() => window.__icons);
const outDir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'icons');
for (const [name, url] of Object.entries(icons)) {
  fs.writeFileSync(path.join(outDir, name), Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', name);
}
await browser.close();
