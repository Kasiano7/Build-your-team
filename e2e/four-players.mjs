/**
 * End-to-end: four independent browsers play a full quick game through the UI
 * against the real realtime server (no mocks).
 *
 *   npm run dev:server        # realtime server on :4000
 *   npm run dev:web           # Expo web on :8081
 *   node e2e/four-players.mjs [baseUrl] [screenshotDir] [serverUrl]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:8081';
const OUT = resolve(process.argv[3] ?? 'test-results/e2e');
// Optional: game server address injected as the in-app setting (dev builds), to test against a private server.
const SERVER = process.argv[4] ?? null;
mkdirSync(OUT, { recursive: true });

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const browser = await chromium.launch();
const players = [
  { name: 'Alice', viewport: { width: 1366, height: 800 } },
  { name: 'Bruno', viewport: { width: 1024, height: 768 } },
  { name: 'Chloe', viewport: { width: 844, height: 390 } },
  { name: 'Driss', viewport: { width: 390, height: 844 } },
];
const errors = [];
for (const p of players) {
  p.context = await browser.newContext({ viewport: p.viewport, deviceScaleFactor: 1 });
  if (SERVER) await p.context.addInitScript((url) => localStorage.setItem('byt.serverUrl', url), SERVER);
  p.page = await p.context.newPage();
  p.page.on('pageerror', (e) => errors.push(`${p.name}: ${e}`));
}
const [A, B, C, D] = players;
const tid = (page, id) => page.locator(`[data-testid="${id}"]`);
const enabled = async (loc) => (await loc.count()) > 0 && (await loc.first().getAttribute('aria-disabled')) !== 'true' && (await loc.first().isVisible());
const shot = (p, name) => p.page.screenshot({ path: `${OUT}/${name}.png` });

async function fill(page, id, value) {
  const el = tid(page, id);
  await el.click();
  await el.fill(value);
}

// 1. Host creates the room.
await A.page.goto(BASE);
await tid(A.page, 'home-play').click();
await fill(A.page, 'create-nickname', A.name);
await tid(A.page, 'create-submit').click();
await A.page.waitForURL(/\/room\/[A-Z0-9]{6}/, { timeout: 15000 });
const code = A.page.url().match(/room\/([A-Z0-9]{6})/)[1];
log('room created', code);

// 2. Three friends join (invitation link for B, manual code for C and D).
await B.page.goto(`${BASE}/r/${code}`);
await fill(B.page, 'join-nickname', B.name);
await tid(B.page, 'join-submit').click();
for (const p of [C, D]) {
  await p.page.goto(`${BASE}/join`);
  await fill(p.page, 'join-code', code);
  await fill(p.page, 'join-nickname', p.name);
  await tid(p.page, 'join-submit').click();
}
for (const p of players) await p.page.waitForURL(new RegExp(`/room/${code}`), { timeout: 15000 });
await A.page.getByText('Driss', { exact: false }).first().waitFor({ timeout: 10000 });
await A.page.waitForTimeout(600);
await shot(A, '01-lobby-host');
await shot(D, '01-lobby-phone');
log('all joined');

// 3. Host starts.
await tid(A.page, 'lobby-start').click();

// 4–10. Draft loop.
const auctionNo = async (page) => {
  const t = await page.getByText(/Enchère n°\d+/).first().textContent({ timeout: 1000 }).catch(() => null);
  return t ? Number(t.match(/n°(\d+)/)[1]) : null;
};
let handled = new Set();
let shotsTaken = { open: false, sold: false, contested: false };
let reconnected = false;
const deadline = Date.now() + 8 * 60_000;
while (Date.now() < deadline) {
  if (await A.page.getByText('Quelle est la meilleure équipe').count()) break;
  const no = await auctionNo(A.page);
  if (no === null || handled.has(no)) {
    await A.page.waitForTimeout(300);
    continue;
  }
  // Wait for bidding to open somewhere.
  let buyers = [];
  for (let i = 0; i < 40 && buyers.length === 0; i++) {
    for (const p of players) if (await enabled(tid(p.page, 'bid-10'))) buyers.push(p);
    if (!buyers.length) await A.page.waitForTimeout(150);
  }
  handled.add(no);
  if (!buyers.length) continue;
  // 5. Every few auctions: two near-simultaneous bids from two players.
  if (buyers.length >= 2 && !shotsTaken.contested) {
    shotsTaken.contested = true;
    await Promise.all([tid(buyers[0].page, 'bid-10').click(), tid(buyers[1].page, 'bid-10').click()]);
    await A.page.waitForTimeout(400);
    const statuses = await Promise.all(buyers.slice(0, 2).map((p) => tid(p.page, 'bid-status').textContent()));
    log('concurrent bids →', statuses);
    await shot(A, '03-concurrent-bids-host');
    await shot(buyers[1], '03-concurrent-bids-other');
  } else {
    await tid(buyers[0].page, 'bid-10').click();
  }
  await A.page.waitForTimeout(250);
  if (!shotsTaken.open) {
    shotsTaken.open = true;
    for (const p of players) await shot(p, `02-auction-${p.name}`);
  }
  // 7. Others pass so the server closes the auction immediately.
  for (const p of players) if (await enabled(tid(p.page, 'bid-pass'))) await tid(p.page, 'bid-pass').click();
  if (!shotsTaken.sold) {
    await A.page.waitForTimeout(700);
    shotsTaken.sold = true;
    await shot(A, '04-sold-host');
    await shot(D, '04-sold-phone');
  }
  // 11. Disconnect / reconnect Bruno once, mid-draft.
  if (!reconnected && no >= 4) {
    reconnected = true;
    await A.page.waitForTimeout(800); // let the last sale reach every screen
    const before = await tid(A.page, 'budget-1').textContent();
    await B.page.close();
    await A.page.waitForTimeout(1500);
    B.page = await B.context.newPage();
    await B.page.goto(`${BASE}/room/${code}`);
    await B.page.getByText(/votre équipe/i).first().waitFor({ timeout: 15000 });
    await B.page.waitForTimeout(500);
    const after = await tid(B.page, 'budget-1').textContent();
    const hostNow = await tid(A.page, 'budget-1').textContent();
    log('reconnect: Bruno budget before', before, '| after (own screen)', after, '| host screen now', hostNow);
    if (after !== hostNow) errors.push(`budget diverges after reconnect: ${after} vs host ${hostNow}`);
  }
}

// 12. Draft over.
await A.page.getByText('Quelle est la meilleure équipe').waitFor({ timeout: 60000 });
for (const p of players) await shot(p, `05-vote-${p.name}`);
log('voting');

// 13. Votes: A, B, D vote for Chloé (seat 2), Chloé votes for Driss (seat 3).
for (const [p, seat] of [[A, 2], [B, 2], [C, 3], [D, 2]]) {
  const btn = tid(p.page, `vote-${seat}`);
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await p.page.waitForTimeout(300);
}

// 14. Results.
for (const p of players) await tid(p.page, 'winner-name').waitFor({ timeout: 15000 });
const winners = await Promise.all(players.map((p) => tid(p.page, 'winner-name').textContent()));
log('winner on each screen:', winners);
await A.page.waitForTimeout(1500);
for (const p of players) await shot(p, `06-results-${p.name}`);
if (new Set(winners).size !== 1 || winners[0] !== 'CHLOE') errors.push(`unexpected winners ${winners}`);

await browser.close();
if (errors.length) {
  console.error('E2E FAILED', errors);
  process.exit(1);
}
log('E2E OK — screenshots in', OUT);
