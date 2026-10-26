/**
 * Measures the dead time between two players (sale → next auction open) through
 * the UI, and captures the real-players screens.
 *   node e2e/timing.mjs [baseUrl] [serverUrl] [outDir]
 * serverUrl is injected as the in-app server address (dev builds), so a private
 * server can be used without touching the one on :4000.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:8081';
const SERVER = process.argv[3] ?? 'http://localhost:4000';
const OUT = resolve(process.argv[4] ?? 'test-results/timing');
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const tid = (page, id) => page.locator(`[data-testid="${id}"]`);
const errors = [];
const open = async (viewport) => {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript((url) => localStorage.setItem('byt.serverUrl', url), SERVER);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(String(e)));
  return p;
};
const enabled = (page, id) =>
  page.evaluate((i) => {
    const el = document.querySelector(`[data-testid="${i}"]`);
    return !!el && el.getAttribute('aria-disabled') !== 'true';
  }, id);

const host = await open({ width: 1440, height: 900 });
const guest = await open({ width: 390, height: 844 });
await host.goto(BASE);
await host.waitForTimeout(2500);
await host.screenshot({ path: `${OUT}/home.png` });
await host.goto(`${BASE}/create`);
await tid(host, 'create-nickname').fill('Alice');
await host.getByRole('radio', { name: 'Joueurs : 2' }).click();
await tid(host, 'create-submit').click();
await host.waitForURL(/room\//);
const code = host.url().match(/room\/([A-Z0-9]{6})/)[1];
await guest.goto(`${BASE}/join?code=${code}`);
await tid(guest, 'join-nickname').fill('Bruno');
await tid(guest, 'join-submit').click();
await guest.waitForURL(/room\//);
await host.waitForTimeout(500);
const t0 = Date.now();
await tid(host, 'lobby-start').click();
while (!(await enabled(host, 'bid-10'))) await host.waitForTimeout(50);
const firstOpen = Date.now() - t0;
await host.waitForTimeout(400);
await host.screenshot({ path: `${OUT}/auction-desktop.png` });
await guest.screenshot({ path: `${OUT}/auction-phone.png` });

const gaps = [];
for (let n = 0; n < 3; n++) {
  await tid(host, 'bid-10').click();
  await guest.waitForTimeout(150);
  await tid(guest, 'bid-pass').click();
  const sold = Date.now();
  if (n === 0) {
    await host.waitForTimeout(700);
    await host.screenshot({ path: `${OUT}/sold.png` });
  }
  while (!(await enabled(host, 'bid-10'))) await host.waitForTimeout(50);
  gaps.push(Date.now() - sold);
}
await host.waitForTimeout(800);
await host.screenshot({ path: `${OUT}/team-after-3.png` });
console.log(JSON.stringify({ code, firstOpenMs: firstOpen, gapsMs: gaps, errors }));
await browser.close();
