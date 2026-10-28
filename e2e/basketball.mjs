/**
 * Basketball game through the UI on a live server: universe choice, auction on
 * the court, full draft, spectator vote, result.
 *   node e2e/basketball.mjs [baseUrl] [outDir]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:8081';
const OUT = resolve(process.argv[3] ?? 'test-results/basketball');
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const browser = await chromium.launch();
const tid = (page, id) => page.locator(`[data-testid="${id}"]`);
const isOpen = (page, id) =>
  page.evaluate((i) => {
    const el = document.querySelector(`[data-testid="${i}"]`);
    return !!el && el.getAttribute('aria-disabled') !== 'true';
  }, id);
const errors = [];
const open = async (viewport) => {
  const p = await (await browser.newContext({ viewport })).newPage();
  p.on('pageerror', (e) => errors.push(String(e)));
  return p;
};

const host = await open({ width: 1440, height: 900 });
const guest = await open({ width: 390, height: 844 });
await host.goto(`${BASE}/create`);
await tid(host, 'create-nickname').fill('Alice');
await host.getByRole('radio', { name: 'Univers : Basket' }).click();
await host.getByRole('radio', { name: 'Joueurs : 2' }).click();
await host.screenshot({ path: `${OUT}/create.png`, fullPage: true });
await tid(host, 'create-submit').click();
await host.waitForURL(/room\//);
const code = host.url().match(/room\/([A-Z0-9]{6})/)[1];
await guest.goto(`${BASE}/join?code=${code}`);
await tid(guest, 'join-nickname').fill('Bruno');
await tid(guest, 'join-submit').click();
await guest.waitForURL(/room\//);
await host.getByText('Basket · joueurs réels', { exact: false }).first().waitFor({ timeout: 10000 });
await host.waitForTimeout(400);
await tid(host, 'lobby-start').click();
log('started', code);

let shots = 0;
let turn = 0;
const end = Date.now() + 4 * 60_000;
while (Date.now() < end) {
  if (await host.getByText('Quelle est la meilleure équipe').count()) break;
  const [h, g] = [await isOpen(host, 'bid-10'), await isOpen(guest, 'bid-10')];
  if (!h && !g) {
    await host.waitForTimeout(200);
    continue;
  }
  if (shots === 0) {
    await host.waitForTimeout(500);
    await host.screenshot({ path: `${OUT}/auction-desktop.png` });
    await guest.screenshot({ path: `${OUT}/auction-phone.png` });
    shots++;
  }
  const [buyer, other] = (turn++ % 2 === 0 && h) || !g ? [host, guest] : [guest, host];
  await tid(buyer, 'bid-10').click();
  await other.waitForTimeout(150);
  if (await isOpen(other, 'bid-pass')) await tid(other, 'bid-pass').click();
  await host.waitForTimeout(800);
}
await host.getByText('Quelle est la meilleure équipe').waitFor({ timeout: 60000 });
await host.waitForTimeout(1000);
await host.screenshot({ path: `${OUT}/vote.png` });
log('voting');

const spectator = await open({ width: 390, height: 844 });
await spectator.goto(`${BASE}/vote/${code}`);
await tid(spectator, 'vote-1').click({ timeout: 15000 });
await host.waitForTimeout(500);
await tid(host, 'close-vote').click();
for (const p of [host, guest, spectator]) await tid(p, 'winner-name').waitFor({ timeout: 10000 });
const winners = await Promise.all([host, guest, spectator].map((p) => tid(p, 'winner-name').textContent()));
log('winners', winners);
await host.waitForTimeout(1500);
await host.screenshot({ path: `${OUT}/results.png` });
if (new Set(winners).size !== 1 || winners[0] !== 'BRUNO') errors.push(`unexpected winner ${winners}`);
await browser.close();
if (errors.length) {
  console.error('FAILED', errors);
  process.exit(1);
}
log('BASKETBALL E2E OK');
