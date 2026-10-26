// Usage: node e2e/shot.mjs <url> <out.png> [width] [height] [waitMs]
import { chromium } from 'playwright';
const [url, out, w = '1280', h = '800', wait = '3500'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
console.log(JSON.stringify({ out, errors: errors.slice(0, 5) }));
await browser.close();
