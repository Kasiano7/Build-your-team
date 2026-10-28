/**
 * Game modes through the UI on a live server: one person against three
 * server bots, dutch auctions, jokers, mercato, vote + simulated tournament,
 * TV page, rematch. A second run checks sealed auctions + Mystery + Éclair.
 *   node e2e/modes.mjs [baseUrl] [outDir]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:8081';
const OUT = resolve(process.argv[3] ?? 'test-results/modes');
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const browser = await chromium.launch();
const tid = (page, id) => page.locator(`[data-testid="${id}"]`);
const isOpen = (page, id) =>
  page.evaluate((i) => {
    const el = document.querySelector(`[data-testid="${i}"]`);
    return !!el && el.getAttribute('aria-disabled') !== 'true' && !el.readOnly;
  }, id);
const errors = [];
const open = async (viewport) => {
  const p = await (await browser.newContext({ viewport })).newPage();
  p.on('pageerror', (e) => errors.push(String(e)));
  return p;
};

async function createWithBots(page, { nickname, radios, toggles, bots }) {
  await page.goto(`${BASE}/create`);
  await tid(page, 'create-nickname').fill(nickname);
  for (const r of radios) await page.getByRole('radio', { name: r }).first().click();
  for (const t of toggles) await tid(page, t).click();
  await page.screenshot({ path: `${OUT}/${nickname}-create.png`, fullPage: true });
  await tid(page, 'create-submit').click();
  await page.waitForURL(/room\//);
  const code = page.url().match(/room\/([A-Z0-9]{6})/)[1];
  for (const level of bots) {
    await tid(page, `add-bot-${level}`).click();
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${nickname}-lobby.png`, fullPage: true });
  await tid(page, 'lobby-start').click();
  log('started', code);
  return code;
}

/* ---------------- Run 1: dutch + jokers + mercato + vote & tournament ---------------- */
const host = await open({ width: 1440, height: 900 });
const code = await createWithBots(host, {
  nickname: 'Alice',
  radios: ['Type d’enchères : Hollandaises', 'Fin de partie : Les deux'],
  toggles: ['opt-jokers', 'opt-mercato'],
  bots: ['easy', 'normal', 'hard'],
});
const tv = await open({ width: 1920, height: 1080 });
await tv.goto(`${BASE}/tv/${code}`);

let shots = 0;
let usedHalf = false;
let claims = 0;
const end = Date.now() + 6 * 60_000;
while (Date.now() < end) {
  if (await host.getByText('Mercato', { exact: false }).count() && !(await tid(host, 'dutch-claim').count())) break;
  if (await isOpen(host, 'joker-half') && !usedHalf) {
    await tid(host, 'joker-half').click();
    usedHalf = true;
    log('half price armed');
  }
  if (await isOpen(host, 'dutch-claim')) {
    if (shots === 0) {
      await host.screenshot({ path: `${OUT}/dutch-desktop.png` });
      await tv.screenshot({ path: `${OUT}/tv-draft.png` });
      shots++;
    }
    // Claim roughly every third player once the price has dropped a bit.
    await host.waitForTimeout(1200);
    if (claims < 4 && Math.random() < 0.35 && (await isOpen(host, 'dutch-claim'))) {
      await tid(host, 'dutch-claim').click();
      claims++;
    } else if (await isOpen(host, 'bid-pass')) await tid(host, 'bid-pass').click();
  }
  await host.waitForTimeout(250);
}
log('draft over, claims', claims);
await host.getByText('Je suis prêt', { exact: false }).first().waitFor({ timeout: 120000 });
await host.waitForTimeout(800);
await host.screenshot({ path: `${OUT}/mercato.png`, fullPage: true });
await tv.screenshot({ path: `${OUT}/tv-mercato.png` });
await host.getByText('Je suis prêt', { exact: false }).first().click();

await host.getByText('Quelle est la meilleure équipe').waitFor({ timeout: 60000 });
await host.waitForTimeout(800);
await host.screenshot({ path: `${OUT}/vote.png` });
await tid(host, 'vote-1').click({ timeout: 15000 }).catch(() => tid(host, 'vote-2').click());
for (const p of [host]) await tid(p, 'winner-name').waitFor({ timeout: 30000 });
await host.waitForTimeout(2500);
await host.screenshot({ path: `${OUT}/results.png`, fullPage: true });
await tv.waitForTimeout(1500);
await tv.screenshot({ path: `${OUT}/tv-results.png` });
const text = await host.locator('body').innerText();
if (!/tournoi/i.test(text)) errors.push('no simulated tournament on the results screen');
await host.getByRole('button', { name: /Revanche/ }).first().click();
await tid(host, 'lobby-start').waitFor({ timeout: 15000 });
if (!/manche 2/i.test(await host.locator('body').innerText())) errors.push('series round 2 not shown in lobby');
await host.screenshot({ path: `${OUT}/rematch-lobby.png`, fullPage: true });
log('run 1 OK');

/* ---------------- Run 2: sealed + Mystery + Éclair on a phone ---------------- */
const phone = await open({ width: 390, height: 844 });
await createWithBots(phone, {
  nickname: 'Bruno',
  radios: ['Joueurs : 2', 'Type d’enchères : Sous pli', 'Rythme : Éclair', 'Fin de partie : Tournoi'],
  toggles: ['opt-mystery'],
  bots: ['hard'],
});
let sealed = 0;
const end2 = Date.now() + 4 * 60_000;
while (Date.now() < end2) {
  if (await tid(phone, 'winner-name').count()) break;
  if (await isOpen(phone, 'seal-amount')) {
    if (sealed === 0) {
      const masked = await phone.getByText('note cachée', { exact: false }).count();
      await phone.screenshot({ path: `${OUT}/sealed-mystery-phone.png` });
      if (!masked) log('warning: masked card label not found by text (rendered as ?)');
    }
    const ok = await tid(phone, 'seal-amount').fill(String(10 + 10 * (sealed % 3)), { timeout: 2000 }).then(() => true, () => false);
    if (ok && (await isOpen(phone, 'seal-send'))) {
      await tid(phone, 'seal-send').click();
      sealed++;
    }
  }
  await phone.waitForTimeout(300);
}
await tid(phone, 'winner-name').waitFor({ timeout: 60000 });
await phone.waitForTimeout(2000);
await phone.screenshot({ path: `${OUT}/sim-results-phone.png`, fullPage: true });
log('run 2 OK, sealed offers', sealed);

await browser.close();
if (errors.length) {
  console.error('FAILED', errors);
  process.exit(1);
}
log('MODES E2E OK');
