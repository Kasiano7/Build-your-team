/**
 * Two-player game with spectator voting, through the UI, on a live server.
 *   node e2e/spectators.mjs [baseUrl] [outDir]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:8081';
const OUT = resolve(process.argv[3] ?? 'test-results/spectators');
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
const newPage = async (viewport) => {
  const p = await (await browser.newContext({ viewport })).newPage();
  p.on('pageerror', (e) => errors.push(String(e)));
  return p;
};

const host = await newPage({ width: 1280, height: 800 });
const guest = await newPage({ width: 390, height: 844 });
await host.goto(`${BASE}/create`);
await tid(host, 'create-nickname').fill('Hana');
await host.getByRole('radio', { name: 'Joueurs : 2' }).click();
await tid(host, 'create-submit').click();
await host.waitForURL(/room\//);
const code = host.url().match(/room\/([A-Z0-9]{6})/)[1];
await guest.goto(`${BASE}/r/${code}`);
await tid(guest, 'join-nickname').fill('Ilan');
await tid(guest, 'join-submit').click();
await guest.waitForURL(/room\//);
await host.waitForTimeout(500);

// A spectator opening the link before the vote sees a waiting screen.
const early = await newPage({ width: 390, height: 844 });
await early.goto(`${BASE}/vote/${code}`);
await tid(host, 'lobby-start').click();
log('started', code);

// Alternate buyers until the draft ends.
let turn = 0;
const end = Date.now() + 5 * 60_000;
while (Date.now() < end) {
  if (await host.getByText('Quelle est la meilleure équipe').count()) break;
  const [h, g] = [await isOpen(host, 'bid-10'), await isOpen(guest, 'bid-10')];
  if (!h && !g) {
    await host.waitForTimeout(250);
    continue;
  }
  const [buyer, other] = (turn++ % 2 === 0 && h) || !g ? [host, guest] : [guest, host];
  await tid(buyer, 'bid-10').click();
  await other.waitForTimeout(200);
  if (await isOpen(other, 'bid-pass')) await tid(other, 'bid-pass').click();
  await host.waitForTimeout(1500);
}
await host.getByText('Quelle est la meilleure équipe').waitFor({ timeout: 60000 });
await host.waitForTimeout(800);
await host.screenshot({ path: `${OUT}/host-spectator-vote.png` });
await early.getByText('Quelle est la meilleure équipe').waitFor({ timeout: 10000 });
log('voting open, early spectator switched automatically');

// Players cannot vote in spectator mode: no vote buttons on their screens.
if (await tid(host, 'vote-1').count()) errors.push('player sees a vote button in spectator mode');

const voters = [early, await newPage({ width: 390, height: 844 }), await newPage({ width: 1024, height: 768 })];
await voters[1].goto(`${BASE}/vote/${code}`);
await voters[2].goto(`${BASE}/vote/${code}`);
const choices = [1, 1, 0]; // seats: Ilan, Ilan, Hana
for (let i = 0; i < voters.length; i++) {
  const btn = tid(voters[i], `vote-${choices[i]}`);
  await btn.waitFor({ timeout: 10000 });
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await voters[i].waitForTimeout(400);
}
await voters[0].screenshot({ path: `${OUT}/spectator-voted.png` });
// Reload: the same spectator keeps their vote (stored spectator id).
await voters[0].reload();
await voters[0].getByText('VOTRE VOTE').first().waitFor({ timeout: 10000 });
log('vote persisted after reload');

await tid(host, 'close-vote').click();
for (const p of [host, guest, ...voters]) await tid(p, 'winner-name').waitFor({ timeout: 10000 });
const winners = await Promise.all([host, guest, ...voters].map((p) => tid(p, 'winner-name').textContent()));
log('winners', winners);
if (new Set(winners).size !== 1 || winners[0] !== 'ILAN') errors.push(`unexpected winner ${winners}`);
await voters[1].waitForTimeout(1200);
await voters[1].screenshot({ path: `${OUT}/spectator-result-phone.png`, fullPage: true });
await browser.close();
if (errors.length) {
  console.error('FAILED', errors);
  process.exit(1);
}
log('SPECTATOR E2E OK');
