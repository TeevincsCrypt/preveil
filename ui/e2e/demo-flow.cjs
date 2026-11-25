// End-to-end check of the PRIVEIL demo, driven through the real UI.
// Usage: npm run build -w ui && npx vite preview --port 4173 (in ui/), then
//        node ui/e2e/demo-flow.cjs [baseUrl] [screenshotDir]
// Every step asserts on what the UI shows; it exits non-zero on failure.
const { chromium } = require('playwright');
const base = (process.argv[2] || 'http://localhost:4173') + '/#';
const shots = process.argv[3];
const R = '/rounds/privacy-builders-wave-3';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const step = (s) => console.log('✓', s);
  const shot = async (n) => shots && page.screenshot({ path: `${shots}/${n}.png`, fullPage: true });
  const go = async (path) => { await page.goto(base + path); await page.waitForTimeout(400); };

  await go('/rounds');
  await page.waitForSelector('h1:has-text("Grant rounds")', { timeout: 60000 });
  step('demo rounds seeded by executing the contract');

  await go(R + '/vote');
  await page.getByRole('button', { name: /ZK Credential Kit/ }).click();
  await page.getByRole('button', { name: /Cast private ballot for #2/ }).click();
  await page.waitForSelector('text=Your vote is private.', { timeout: 20000 });
  await page.waitForSelector('text=✓ present');
  await page.waitForSelector('text=✓ match');
  step('cast a hidden ballot; nullifier and commitment verified on ledger');
  await shot('01-voted');

  await page.getByRole('button', { name: /Vote again/ }).click();
  await page.waitForSelector('text=“Already voted in this round”', { timeout: 10000 });
  step('duplicate vote rejected by the contract');
  await page.getByRole('button', { name: /unenrolled credential/ }).click();
  await page.waitForSelector('text=not enrolled', { timeout: 10000 });
  step('unenrolled credential rejected');

  await go(R + '/results');
  await page.waitForSelector('text=Results are sealed');
  step('results sealed while voting is open');

  await go(R + '/vote');
  await page.getByRole('button', { name: /more members vote/ }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /Close voting/ }).click();
  await page.waitForSelector('text=Reveal & count my ballot');
  await page.getByRole('button', { name: /Reveal & count my ballot/ }).click();
  await page.waitForSelector('text=✓ revealed & counted', { timeout: 20000 });
  step('own ballot opened and counted');
  await page.getByRole('button', { name: /Members open their/ }).click();
  await page.waitForSelector('text=Finalize round', { timeout: 30000 });
  step('members revealed');

  await go(R + '/results');
  await page.getByRole('button', { name: /Finalize & verify/ }).click();
  await page.waitForSelector('text=verified on chain', { timeout: 20000 });
  await page.waitForSelector('text=Allocations match an independent recomputation');
  const funded = await page.locator('text=/^Funded \\$/').count();
  if (funded < 1) throw new Error('no funded proposals shown');
  step(`round finalized; ${funded} proposals funded; verification shown`);
  await shot('02-results');

  await go(R + '/ledger');
  await page.waitForSelector('text=Transaction feed');
  const ballotTx = await page.locator('text=an anonymous voter').count();
  step(`public ledger shows ${ballotTx} anonymous ballot transactions`);
  await shot('03-ledger');

  if (errors.length) throw new Error('console errors: ' + errors.join(' | '));
  step('no console errors');
  await browser.close();
})().catch((e) => { console.error('✗', e.message); process.exit(1); });
