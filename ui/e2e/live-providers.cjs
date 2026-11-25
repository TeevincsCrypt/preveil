// Live-mode smoke test: injects a stand-in DApp Connector wallet (no keys, no
// network) and checks the app builds its midnight-js providers in the real
// browser bundle and reaches the deploy form. Usage: node ui/e2e/live-providers.cjs [baseUrl]
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.addInitScript(() => {
    const hex = (n) => Array.from({ length: n }, (_, i) => ((i * 37 + 11) % 256).toString(16).padStart(2, '0')).join('');
    const api = {
      getConfiguration: async () => ({ networkId: 'undeployed', indexerUri: 'http://127.0.0.1:9/api/v3/graphql', indexerWsUri: 'ws://127.0.0.1:9/api/v3/graphql/ws', substrateNodeUri: 'ws://127.0.0.1:9', proverServerUri: 'http://127.0.0.1:9' }),
      getShieldedAddresses: async () => ({ shieldedAddress: 'mock-shielded-address', shieldedCoinPublicKey: hex(32), shieldedEncryptionPublicKey: hex(32) }),
      getProvingProvider: async () => ({ check: async () => [], prove: async () => { throw new Error('mock'); } }),
      getConnectionStatus: async () => ({ status: 'connected' }),
    };
    window.midnight = { mock: { name: 'Mock wallet (test)', icon: '', apiVersion: '4.0.1', rdns: 'test.mock', connect: async () => api } };
  });
  await p.goto((process.argv[2] || 'http://localhost:4173') + '/#/live');
  await p.waitForTimeout(1200);
  await p.getByRole('button', { name: 'Connect wallet' }).click();
  const ok = await p.waitForSelector('text=Deploy a new round', { timeout: 30000 }).then(() => true).catch(() => false);
  const provErr = await p.locator('text=Could not set up Midnight providers').count();
  console.log('deploy form visible (providers built):', ok, '| provider error shown:', provErr > 0);
  if (provErr) console.log(await p.locator('text=Could not set up Midnight providers').textContent());
  if (!ok || provErr || errs.length) { console.error('✗ live providers check failed', errs); process.exit(1); }
  console.log('✓ live providers built in the browser bundle');
  await b.close();
})();
