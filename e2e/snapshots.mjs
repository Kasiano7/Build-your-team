/**
 * Visual capture of a live game (real server) at several viewports.
 *   node e2e/snapshots.mjs [baseUrl] [outDir]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:8081';
const OUT = resolve(process.argv[3] ?? 'test-results/snapshots');
mkdirSync(OUT, { recursive: true });
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  laptop: { width: 1280, height: 720 },
  tablet: { width: 1024, height: 768 },
  phoneLandscape: { width: 844, height: 390 },
  phone: { width: 390, height: 844 },
};
const browser = await chromium.launch();
const tid = (page, id) => page.locator(`[data-testid="${id}"]`);
const host = await (await browser.newContext({ viewport: VIEWPORTS.desktop })).newPage();
const guest = await (await browser.newContext({ viewport: VIEWPORTS.phone })).newPage();

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
await host.waitForTimeout(800);
await host.screenshot({ path: `${OUT}/lobby-desktop.png` });
await tid(host, 'lobby-start').click();

// Auction 1: let Alice win at 30M, then capture the sold moment.
await tid(host, 'bid-10').waitFor();
await host.waitForFunction(() => document.querySelector('[data-testid="bid-10"]')?.getAttribute('aria-disabled') !== 'true', null, { timeout: 15000 });
await tid(host, 'bid-10').click();
await guest.waitForTimeout(300);
await tid(guest, 'bid-20').click();
await host.waitForTimeout(500);
for (const [name, vp] of Object.entries(VIEWPORTS)) {
  await host.setViewportSize(vp);
  await host.waitForTimeout(450);
  await host.screenshot({ path: `${OUT}/auction-${name}.png` });
}
await host.setViewportSize(VIEWPORTS.desktop);
await tid(host, 'bid-10').click();
await tid(guest, 'bid-pass').click();
await host.waitForTimeout(500);
await host.screenshot({ path: `${OUT}/sold-stamp-desktop.png` });
await host.waitForTimeout(1900);
await host.screenshot({ path: `${OUT}/sold-transfer-desktop.png` });
await host.waitForTimeout(1500);
await host.screenshot({ path: `${OUT}/after-sold-desktop.png` });
console.log('snapshots in', OUT, 'room', code);
await browser.close();
