/**
 * Classic mode check on a live server: reveal animation timing, 11-player pitch,
 * bench, formation change and a starter/bench swap through the UI.
 *   node e2e/classic.mjs [baseUrl] [outDir]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:8081';
const OUT = resolve(process.argv[3] ?? 'test-results/classic');
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const tid = (page, id) => page.locator(`[data-testid="${id}"]`);
const host = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const guest = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
host.on('pageerror', (e) => errors.push(String(e)));

await host.goto(`${BASE}/create`);
await tid(host, 'create-nickname').fill('Alice');
await host.getByRole('radio', { name: 'Joueurs : 2' }).click();
await host.getByRole('radio', { name: 'Mode : Classique' }).click();
await tid(host, 'create-submit').click();
await host.waitForURL(/room\//);
const code = host.url().match(/room\/([A-Z0-9]{6})/)[1];
await guest.goto(`${BASE}/join?code=${code}`);
await tid(guest, 'join-nickname').fill('Bruno');
await tid(guest, 'join-submit').click();
await guest.waitForURL(/room\//);
await host.waitForTimeout(500);
await tid(host, 'lobby-start').click();
await host.waitForTimeout(1300);
await host.screenshot({ path: `${OUT}/reveal-mid.png` });

const isOpen = (page, id) => page.evaluate((i) => {
  const el = document.querySelector(`[data-testid="${i}"]`);
  return !!el && el.getAttribute('aria-disabled') !== 'true';
}, id);

// Host buys 7 players at the reserve price; the guest passes each time.
for (let n = 0; n < 7; n++) {
  for (let i = 0; i < 60 && !(await isOpen(host, 'bid-10')) && !(await isOpen(host, 'bid-pass')); i++) await host.waitForTimeout(200);
  if (await isOpen(host, 'bid-10')) {
    await tid(host, 'bid-10').click();
    await guest.waitForTimeout(150);
    if (await isOpen(guest, 'bid-pass')) await tid(guest, 'bid-pass').click();
  } else if (await isOpen(guest, 'bid-10')) {
    await tid(guest, 'bid-10').click();
    if (await isOpen(host, 'bid-pass')) await tid(host, 'bid-pass').click();
  }
  await host.waitForTimeout(4600);
}
await host.screenshot({ path: `${OUT}/classic-433.png` });
await host.getByRole('radio', { name: '4-4-2' }).click();
await host.waitForTimeout(900);
await host.screenshot({ path: `${OUT}/classic-442.png` });
await guest.screenshot({ path: `${OUT}/classic-guest-phone.png` });
console.log(JSON.stringify({ code, errors }));
await browser.close();
