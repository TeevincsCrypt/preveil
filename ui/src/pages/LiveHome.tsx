import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Radio } from 'lucide-react';
import { hashMetadata, newSecretKey, toHex } from '@contract/crypto';
import { Page } from '@/components/Layout';
import { Button, Card, Eyebrow, Field, cx, inputCls } from '@/components/ui';
import { NETWORK_IDS, useWallet, type NetworkId } from '@/wallet/wallet';
import { useLive } from '@/live/LiveContext';
import { knownRounds, rememberRound, saveOffChain, saveVault } from '@/live/vault';
import type { RoundMeta } from '@/engine/types';

const RULE =
  'Ranked greedy: proposals are ranked by votes (ties → earlier submission). Walking down the ranking, each proposal that met the quorum and fits in the remaining pool receives its full request.';

/** Wallet connection + proving choice; renders children once providers are ready. */
export function LiveGate({ children }: { children: React.ReactNode }) {
  const w = useWallet();
  const live = useLive();
  if (w.status !== 'connected')
    return (
      <Card className="p-7">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="size-1.5 rounded-full bg-flame" /> Connect a Midnight wallet
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Live mode sends real transactions to a Midnight test network. You need the Lace wallet with Midnight enabled, set to the same network you pick here, and test tokens (DUST) to pay fees.{' '}
          {w.wallets.length ? `Detected: ${w.wallets.map((x) => x.name).join(', ')}.` : 'No Midnight wallet detected in this browser.'}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <select className={cx(inputCls, 'sm:w-44')} value={w.requestedNetwork} onChange={(e) => w.setRequestedNetwork(e.target.value as NetworkId)}>
            {NETWORK_IDS.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <Button onClick={() => void w.connect()} busy={w.status === 'connecting'}>
            Connect wallet
          </Button>
        </div>
        {w.error && <p className="mt-3 font-mono text-xs text-bad">{w.error}</p>}
      </Card>
    );
  return (
    <>
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-sm">
          <span className="size-1.5 rounded-full bg-ok" />
          <span className="font-medium">{w.walletName}</span>
          <span className="text-muted">on</span>
          <span className="font-medium">{w.networkId}</span>
        </div>
        <span className="truncate font-mono text-xs text-muted sm:max-w-sm">{w.shieldedAddress}</span>
        <div className="flex items-center gap-2 sm:ml-auto">
          <span className="text-xs text-muted">Proofs by</span>
          <select className={cx(inputCls, 'w-auto py-1.5 text-xs')} value={live.proving} onChange={(e) => live.setProving(e.target.value as 'wallet' | 'local')}>
            <option value="wallet">the wallet</option>
            <option value="local">local proof server :6300</option>
          </select>
        </div>
      </Card>
      {live.providersError && <p className="mt-3 rounded-md bg-bad/8 px-4 py-3 font-mono text-xs text-bad">Could not set up Midnight providers: {live.providersError}</p>}
      {!live.providers && !live.providersError && <p className="mt-3 text-sm text-muted">Preparing providers…</p>}
      {live.providers && children}
    </>
  );
}

export function TxBanner() {
  const { tx, clearTx } = useLive();
  if (!tx) return null;
  return (
    <div
      className={cx(
        'rise mt-5 flex items-start gap-3 rounded-md px-4 py-3 text-sm',
        tx.phase === 'running' && 'bg-ink text-ink-fg',
        tx.phase === 'done' && 'bg-ok/10 text-ok',
        tx.phase === 'failed' && 'bg-bad/8 text-bad',
      )}
    >
      {tx.phase === 'running' && <span className="mt-1 size-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      <div className="min-w-0 flex-1">
        <div className="font-medium">
          {tx.phase === 'running' ? `${tx.label}: building the proof and submitting. Approve the transaction in your wallet.` : tx.phase === 'done' ? `${tx.label}: confirmed on chain` : `${tx.label} failed`}
        </div>
        {tx.detail && <div className="mt-1 font-mono text-xs break-all opacity-90">{tx.detail}</div>}
      </div>
      {tx.phase !== 'running' && (
        <button onClick={clearTx} className="text-xs underline opacity-70 hover:opacity-100">
          dismiss
        </button>
      )}
    </div>
  );
}

function DeployForm() {
  const w = useWallet();
  const live = useLive();
  const nav = useNavigate();
  const [f, setF] = useState({ name: 'Community Builders Round', description: 'A live PRIVEIL grant round on Midnight.', pool: 10_000, quorum: 1, proposalMin: 20, votingMin: 20, revealMin: 15 });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: typeof f[k] === 'number' ? Number(e.target.value) : e.target.value });

  const deploy = async () => {
    const net = w.networkId!;
    const meta: RoundMeta = { name: f.name, description: f.description, sponsor: 'Live round', unit: 'USD', methodology: 'One member, one vote · hidden ballots · commit–reveal tally', allocationRule: RULE, origin: 'you' };
    const now = Math.floor(Date.now() / 1000);
    const votingStart = now + Math.round(f.proposalMin * 60);
    const votingEnd = votingStart + Math.round(f.votingMin * 60);
    const revealEnd = votingEnd + Math.round(f.revealMin * 60);
    const adminSk = newSecretKey();
    const roundId = await hashMetadata(meta);
    const res = await live.run(
      'Deploy round contract',
      async (p) => {
        const netmod = await import('@/midnight/network');
        return netmod.deployRound(
          p,
          { roundId, fundingPool: BigInt(Math.floor(f.pool)), submissionEnd: BigInt(votingStart), votingStart: BigInt(votingStart), votingEnd: BigInt(votingEnd), revealEnd: BigInt(revealEnd), quorum: BigInt(Math.floor(f.quorum)) },
          adminSk,
        );
      },
      (r) => `contract ${r.address} · tx ${r.txId}${r.blockHeight ? ` · block ${r.blockHeight}` : ''}`,
    );
    if (!res) return;
    saveVault(net, res.address, { adminSk: toHex(adminSk), builderSks: {}, txs: [{ label: 'Deploy round', txId: res.txId, blockHeight: res.blockHeight, at: Date.now() }] });
    saveOffChain(net, res.address, { meta, docs: {} });
    rememberRound(net, { address: res.address, name: f.name, createdAt: Date.now(), role: 'admin' });
    nav(`/live/${res.address}`);
  };

  return (
    <Card className="p-6">
      <h2 className="font-display text-xl">Deploy a new round</h2>
      <p className="mt-2 text-sm text-muted">Deploys a fresh PRIVEIL contract. You become its admin: your admin secret is generated here and kept in this browser. Deadlines are real time, so keep them short for a demo.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Round name">
          <input className={inputCls} value={f.name} onChange={set('name')} />
        </Field>
        <Field label="Funding pool" hint="USD units">
          <input type="number" className={inputCls} value={f.pool} onChange={set('pool')} />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Description">
          <textarea className={inputCls} rows={2} value={f.description} onChange={set('description')} />
        </Field>
      </div>
      <div className="mt-4 grid items-end gap-4 sm:grid-cols-4">
        <Field label="Proposals open" hint="min">
          <input type="number" min={2} className={inputCls} value={f.proposalMin} onChange={set('proposalMin')} />
        </Field>
        <Field label="Voting" hint="min">
          <input type="number" min={2} className={inputCls} value={f.votingMin} onChange={set('votingMin')} />
        </Field>
        <Field label="Reveal window" hint="min">
          <input type="number" min={2} className={inputCls} value={f.revealMin} onChange={set('revealMin')} />
        </Field>
        <Field label="Quorum" hint="votes">
          <input type="number" min={1} className={inputCls} value={f.quorum} onChange={set('quorum')} />
        </Field>
      </div>
      <p className="mt-4 text-xs text-muted">Enrol voters and collect proposals during the proposal window: enrolment closes when voting opens.</p>
      <Button className="mt-5" busy={live.busy} onClick={deploy}>
        Deploy round contract
      </Button>
    </Card>
  );
}

function OpenRound() {
  const w = useWallet();
  const nav = useNavigate();
  const [addr, setAddr] = useState('');
  const mine = w.networkId ? knownRounds(w.networkId) : [];
  return (
    <Card className="p-6">
      <h2 className="font-display text-xl">Open a round</h2>
      <div className="mt-5 flex gap-2">
        <input className={inputCls} placeholder="Contract address (64 hex characters)" value={addr} onChange={(e) => setAddr(e.target.value.trim())} />
        <Button variant="secondary" disabled={!/^[0-9a-fA-F]{64}$/.test(addr.replace(/^0x/, ''))} onClick={() => nav(`/live/${addr.replace(/^0x/, '')}`)}>
          Open
        </Button>
      </div>
      {mine.length > 0 && (
        <div className="mt-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">In this browser</div>
          <ul className="mt-2 divide-y divide-line">
            {mine.map((r) => (
              <li key={r.address}>
                <Link to={`/live/${r.address}`} className="flex items-center gap-3 py-3 text-sm hover:text-muted">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-faint">{r.role === 'admin' ? 'you are admin' : 'joined'}</span>
                  <span className="ml-auto font-mono text-xs text-muted">
                    {r.address.slice(0, 8)}…{r.address.slice(-6)}
                  </span>
                  <ArrowUpRight className="size-4" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export function LiveHome() {
  return (
    <Page className="max-w-5xl">
      <Eyebrow>
        <Radio className="size-3.5" /> Live on Midnight
      </Eyebrow>
      <h1 className="font-display mt-5 text-[30px] leading-[1.1] sm:text-[40px]">Run a real grant round.</h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
        The same PRIVEIL contract as the demo, deployed to a Midnight test network. Every action is a real transaction with a real zero-knowledge proof made by your wallet. Rounds, proposals and ballots are public on chain; your secrets stay in this browser.
      </p>
      <div className="mt-10">
        <LiveGate>
          <TxBanner />
          <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            <DeployForm />
            <OpenRound />
          </div>
        </LiveGate>
      </div>
    </Page>
  );
}
