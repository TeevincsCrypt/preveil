import { useState } from 'react';
import { CheckCircle2, Cpu, Globe, Wallet } from 'lucide-react';
import { hashMetadata, newSecretKey } from '@contract/crypto';
import { Page } from '@/components/Layout';
import { Badge, Button, Card, KV, cx, inputCls } from '@/components/ui';
import { NETWORK_IDS, useWallet, type NetworkId } from '@/wallet/wallet';

export function Network() {
  const w = useWallet();
  const [mode, setMode] = useState<'wallet' | 'local'>('wallet');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const deploy = async () => {
    if (!w.api) return;
    setBusy(true);
    setResult(null);
    try {
      // Loaded on demand so the simulation never pulls in the network stack.
      const net = await import('@/midnight/network');
      const providers = await net.createProviders(w.api, mode);
      const now = Math.floor(Date.now() / 1000);
      const roundId = await hashMetadata({ name: 'PRIVEIL network test round', created: now });
      const { address, txId } = await net.deployRound(
        providers,
        { roundId, fundingPool: 10_000n, submissionEnd: BigInt(now + 3600), votingStart: BigInt(now + 3600), votingEnd: BigInt(now + 2 * 3600), revealEnd: BigInt(now + 3 * 3600), quorum: 1n },
        newSecretKey(),
      );
      setResult({ ok: true, text: `Deployed at ${address} (tx ${txId})` });
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page className="max-w-5xl">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-private">Modes & wallet</div>
      <h1 className="mt-3 font-display text-5xl tracking-tight">Where the contract runs</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">PRIVEIL is explicit about what is real. Both modes run the same compiled Compact contract; they differ in proving and in where state lives.</p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <Card className="border-warn/25 p-6">
          <div className="flex items-center gap-2">
            <Cpu className="size-4 text-warn" />
            <h2 className="font-medium">Local Simulation</h2>
            <Badge tone="warn" className="ml-auto">active</Badge>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li>✓ Executes the compiler-generated JS of <span className="font-mono">priveil.compact</span> on compact-runtime</li>
            <li>✓ Same asserts, witnesses, ledger ops and Merkle/nullifier logic as on chain</li>
            <li>✓ Deterministic, offline, reliable for demos</li>
            <li className="text-warn/90">✗ No zero-knowledge proofs are generated</li>
            <li className="text-warn/90">✗ No transactions reach a Midnight node; state lives in this tab</li>
          </ul>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-public" />
            <h2 className="font-medium">Midnight Network</h2>
            <Badge className="ml-auto">experimental</Badge>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li>· Lace wallet via the DApp Connector API balances, signs and submits</li>
            <li>· Proofs by the wallet or a local proof server (port 6300)</li>
            <li>· Public state read back through the network’s indexer</li>
            <li>· Needs compiled proving keys served at <span className="font-mono">/managed/priveil</span></li>
            <li>· Wiring ported from Midnight’s official UI template; not yet exercised live from this repo</li>
          </ul>
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-muted" />
          <h2 className="font-medium">Wallet</h2>
          {w.status === 'connected' ? <Badge tone="ok">connected</Badge> : <Badge>not connected</Badge>}
        </div>
        {w.status === 'connected' ? (
          <div className="mt-4 divide-y divide-line">
            <KV k="Wallet">{w.walletName}</KV>
            <KV k="Network">{w.networkId}</KV>
            <KV k="Shielded address">
              <span className="font-mono text-xs">{w.shieldedAddress}</span>
            </KV>
            <KV k="Indexer">
              <span className="font-mono text-xs">{w.indexerUri}</span>
            </KV>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-muted">
              {w.wallets.length ? `Detected: ${w.wallets.map((x) => x.name).join(', ')}` : 'No Midnight wallet extension detected in this browser. Install Lace with Midnight support to use network mode. The Local Simulation does not need a wallet.'}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <select className={cx(inputCls, 'sm:w-48')} value={w.requestedNetwork} onChange={(e) => w.setRequestedNetwork(e.target.value as NetworkId)}>
                {NETWORK_IDS.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
              <Button onClick={() => void w.connect()} busy={w.status === 'connecting'}>
                Connect wallet
              </Button>
            </div>
            {w.error && <p className="mt-3 text-xs text-bad">{w.error}</p>}
          </div>
        )}
      </Card>

      {w.status === 'connected' && (
        <Card className="mt-6 p-6">
          <h2 className="font-medium">Deploy a test round to {w.networkId}</h2>
          <p className="mt-2 text-sm text-muted">Deploys the PRIVEIL contract with a 1-hour submission window. Requires tDUST for fees and the proving keys.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <select className={cx(inputCls, 'sm:w-64')} value={mode} onChange={(e) => setMode(e.target.value as 'wallet' | 'local')}>
              <option value="wallet">Prove with the wallet</option>
              <option value="local">Prove with local proof server</option>
            </select>
            <Button busy={busy} onClick={deploy}>
              Deploy round contract
            </Button>
          </div>
          {result && (
            <div className={cx('mt-4 flex items-start gap-2 rounded-xl px-4 py-3 font-mono text-xs', result.ok ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad')}>
              {result.ok && <CheckCircle2 className="size-4 shrink-0" />} {result.text}
            </div>
          )}
        </Card>
      )}
    </Page>
  );
}
