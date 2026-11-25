import { Link } from 'react-router-dom';
import { Cpu, Globe, Wallet } from 'lucide-react';
import { Page } from '@/components/Layout';
import { Badge, Button, Card, KV, cx, inputCls } from '@/components/ui';
import { NETWORK_IDS, useWallet, type NetworkId } from '@/wallet/wallet';

export function Network() {
  const w = useWallet();

  return (
    <Page className="max-w-5xl">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg">Modes & wallet</div>
      <h1 className="mt-3 font-display text-[30px] leading-[1.1] sm:text-[40px]">Where the contract runs</h1>
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
            <Badge tone="ok" className="ml-auto">Live mode</Badge>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li>· Lace wallet via the DApp Connector API balances, signs and submits</li>
            <li>· Proofs by the wallet or a local proof server (port 6300)</li>
            <li>· Public state read back through the network’s indexer</li>
            <li>· Proving keys are served by this site at <span className="font-mono">/managed/priveil</span></li>
            <li>· Wiring ported from Midnight’s official UI template</li>
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

      <Card className="mt-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-medium">Run a real round</h2>
          <p className="mt-1 text-sm text-muted">Deploy PRIVEIL to a Midnight test network, enrol voters, vote and finalize with real transactions.</p>
        </div>
        <Link to="/live" className="inline-flex shrink-0 items-center gap-2.5 rounded-[3px] bg-ink px-4 py-2.5 text-sm font-medium text-ink-fg hover:bg-black sm:ml-auto">
          <span className="size-1.5 rounded-full bg-flame" /> Open Live mode
        </Link>
      </Card>
    </Page>
  );
}
