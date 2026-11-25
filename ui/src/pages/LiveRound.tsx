import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Lock, Radio } from 'lucide-react';
import {
  adminKey,
  ballotNullifier,
  ballotOpening,
  builderKey,
  canonicalRanking,
  fromHex,
  hashMetadata,
  newSecretKey,
  toHex,
  voterKey,
} from '@contract/crypto';
import type { Ledger } from '@contract/managed/priveil/contract/index.js';
import { Page } from '@/components/Layout';
import { Badge, Button, Card, Eyebrow, Field, Hash, KV, Stat, cx, inputCls } from '@/components/ui';
import { useWallet } from '@/wallet/wallet';
import { useLive } from '@/live/LiveContext';
import { LiveGate, TxBanner } from '@/pages/LiveHome';
import { decodeOffChain, encodeOffChain, verifyOffChain } from '@/live/share';
import { loadOffChain, loadVault, rememberRound, saveOffChain, updateVault, type LiveVault, type OffChain } from '@/live/vault';
import { fmt, rootHex } from '@/engine/store';
import type { ProposalDoc } from '@/engine/types';

type Phase = 'submission' | 'voting' | 'reveal' | 'tally' | 'finalized';
const PHASE_LABEL: Record<Phase, string> = {
  submission: 'Accepting proposals & enrolment',
  voting: 'Voting open',
  reveal: 'Revealing ballots',
  tally: 'Ready to finalize',
  finalized: 'Finalized',
};

const phaseAt = (l: Ledger, now: number): Phase =>
  l.finalized ? 'finalized' : BigInt(now) < l.votingStart ? 'submission' : BigInt(now) < l.votingEnd ? 'voting' : BigInt(now) < l.revealEnd ? 'reveal' : 'tally';

const until = (t: bigint, now: number) => {
  const d = Number(t) - now;
  if (d <= 0) return 'now';
  const m = Math.floor(d / 60);
  const s = d % 60;
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m ${String(s).padStart(2, '0')}s`;
};

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function useLiveLedger(address: string) {
  const { providers } = useLive();
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const refresh = useCallback(async () => {
    if (!providers) return;
    const net = await import('@/midnight/network');
    try {
      const l = await net.readLedger(providers, address);
      if (l) setLedger(l);
      else setMissing(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [providers, address]);

  useEffect(() => {
    if (!providers) return;
    let stop: (() => void) | undefined;
    let live = true;
    void refresh();
    void import('@/midnight/network').then((net) => {
      if (!live) return;
      stop = net.observeLedger(
        providers,
        address,
        (l, h) => {
          setLedger(l);
          setHeight(h);
          setMissing(false);
        },
        (e) => setError(e instanceof Error ? e.message : String(e)),
      );
    });
    return () => {
      live = false;
      stop?.();
    };
  }, [providers, address, refresh]);

  return { ledger, height, error, missing, refresh };
}

export function LiveRound() {
  const { address = '' } = useParams();
  return (
    <Page>
      <Link to="/live" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Live rounds
      </Link>
      <div className="mt-6">
        <LiveGate>
          <RoundBody address={address.toLowerCase()} />
        </LiveGate>
      </div>
    </Page>
  );
}

function RoundBody({ address }: { address: string }) {
  const w = useWallet();
  const net = w.networkId!;
  const live = useLive();
  const now = useNow();
  const { ledger: l, height, error, missing, refresh } = useLiveLedger(address);
  const [vault, setVault] = useState<LiveVault>(() => loadVault(net, address));
  const [off, setOff] = useState<OffChain>(() => loadOffChain(net, address));
  const [params] = useSearchParams();
  const [shareNote, setShareNote] = useState<string | null>(null);

  const mutateVault = (f: (v: LiveVault) => LiveVault) => setVault(updateVault(net, address, f));
  const logTx = (label: string, r: { txId: string; blockHeight?: number }) =>
    mutateVault((v) => ({ ...v, txs: [{ label, txId: r.txId, blockHeight: r.blockHeight, at: Date.now() }, ...v.txs].slice(0, 40) }));

  // Merge documents from a share link — only those matching on-chain hashes.
  useEffect(() => {
    const d = params.get('d');
    if (!d || !l) return;
    const o = decodeOffChain(d);
    if (!o) return setShareNote('The share link’s documents could not be read.');
    void verifyOffChain(o, l).then(({ accepted, rejected }) => {
      const merged: OffChain = { meta: accepted.meta ?? off.meta, docs: { ...off.docs, ...accepted.docs } };
      saveOffChain(net, address, merged);
      setOff(merged);
      setShareNote(rejected ? `${rejected} document(s) in the link did not match their on-chain hash and were ignored.` : 'Documents from the share link match their on-chain hashes ✓');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, l?.proposalCount, l?.roundId]);

  useEffect(() => {
    if (l) rememberRound(net, { address, name: off.meta?.name ?? `Round ${address.slice(0, 8)}`, createdAt: Date.now(), role: vault.adminSk ? 'admin' : 'joined' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!l]);

  const call = async <R,>(label: string, who: { secretKey: Uint8Array; choice?: number }, circuit: 'submitProposal' | 'enrolVoter' | 'castBallot' | 'revealBallot' | 'finalize', args: unknown[]) => {
    const r = await live.run(
      label,
      async (p) => (await import('@/midnight/network')).callCircuit<R>(p, address, who, circuit, args),
      (r) => `tx ${r.txId}${r.blockHeight ? ` · block ${r.blockHeight}` : ''}`,
    );
    if (r) {
      logTx(label, r);
      void refresh();
    }
    return r;
  };

  if (missing) return <Card className="p-6 text-sm text-muted">No PRIVEIL contract found at this address on {net}.</Card>;
  if (!l) return <Card className="p-6 text-sm text-muted">{error ? <span className="font-mono text-bad">{error}</span> : `Reading round from the ${net} indexer…`}</Card>;

  const phase = phaseAt(l, now);
  const isAdmin = !!vault.adminSk && toHex(adminKey(fromHex(vault.adminSk))) === toHex(l.adminPk);
  const voterSk = vault.voterSk ? fromHex(vault.voterSk) : null;
  const vk = voterSk ? voterKey(voterSk) : null;
  const enrolled = !!vk && l.voterKeys.member(vk);
  const nullifier = voterSk ? ballotNullifier(voterSk, l.roundId, address) : null;
  const voted = !!nullifier && l.ballots.member(nullifier);
  const revealed = !!nullifier && l.revealed.member(nullifier);
  const count = Number(l.proposalCount);
  const tallies = Array.from({ length: count }, (_, i) => l.tallies.lookup(BigInt(i)));
  const shareUrl = `${window.location.origin}${window.location.pathname}#/live/${address}?d=${encodeOffChain(off)}`;
  const nextDeadline = phase === 'submission' ? l.votingStart : phase === 'voting' ? l.votingEnd : phase === 'reveal' ? l.revealEnd : null;

  const getCredential = () => {
    const sk = newSecretKey();
    mutateVault((v) => ({ ...v, voterSk: toHex(sk) }));
    return sk;
  };

  return (
    <div>
      <TxBanner />
      <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={phase === 'voting' ? 'live' : phase === 'finalized' ? 'neutral' : 'warn'}>{PHASE_LABEL[phase]}</Badge>
            <Badge tone="ok">
              <Radio className="size-3" /> live on {net}
            </Badge>
            {isAdmin && <Badge tone="private">You are admin</Badge>}
            {nextDeadline !== null && <span className="text-xs text-muted">next phase in {until(nextDeadline, now)}</span>}
          </div>
          <h1 className="font-display mt-4 text-[28px] leading-[1.1] sm:text-[38px]">{off.meta?.name ?? `Round ${address.slice(0, 8)}…`}</h1>
          {off.meta?.description && <p className="mt-3 max-w-3xl text-sm text-muted">{off.meta.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
            <span>Contract</span>
            <Hash value={address} n={10} />
            {height !== null && <span>· indexer at block {height}</span>}
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-4 gap-6 lg:ml-auto">
          <Stat label="Pool" value={fmt(l.fundingPool)} />
          <Stat label="Proposals" value={String(count)} />
          <Stat label="Eligible" value={String(l.enrolled)} />
          <Stat label="Ballots" value={`${l.ballotsCast}`} sub={`${l.ballotsRevealed} revealed`} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <CopyButton text={shareUrl} label="Copy share link" />
        <span className="text-xs text-muted">The link carries the proposal documents; whoever opens it checks them against the on-chain hashes.</span>
      </div>
      {shareNote && <p className="mt-2 text-xs text-muted">{shareNote}</p>}
      <p className="mt-2 text-xs text-faint">Deadlines are enforced by block time, which can differ from your clock by up to a minute or so.</p>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="min-w-0 space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <h2 className="font-medium">Proposals</h2>
              {phase === 'voting' && (
                <span className="inline-flex items-center gap-1 text-xs text-private">
                  <Lock className="size-3" /> votes sealed until voting closes
                </span>
              )}
            </div>
            {count === 0 && <p className="mt-3 text-sm text-muted">No proposals yet.</p>}
            <ul className="mt-3 divide-y divide-line">
              {Array.from({ length: count }, (_, i) => {
                const p = l.proposals.lookup(BigInt(i));
                const d = off.docs[i];
                return (
                  <li key={i} className="flex items-start gap-4 py-4">
                    <span className="mt-0.5 font-mono text-xs text-faint">#{i}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{d?.name ?? <span className="text-muted">Document not in this browser</span>}</div>
                      <div className="mt-0.5 truncate text-xs text-muted">{d?.tagline || d?.description || <>hash <Hash value={p.metadataHash} n={8} /></>}</div>
                      {vault.builderSks[i] && toHex(builderKey(fromHex(vault.builderSks[i]))) === toHex(p.builderPk) && <Badge tone="private" className="mt-1.5">Yours</Badge>}
                    </div>
                    <div className="text-right text-sm">
                      <div className="tabular-nums">{fmt(p.requested)}</div>
                      {phase !== 'submission' && phase !== 'voting' && <div className="text-xs text-muted">{String(tallies[i])} votes</div>}
                      {l.finalized && <div className={cx('text-xs', l.allocations.lookup(BigInt(i)) > 0n ? 'text-ok' : 'text-faint')}>{l.allocations.lookup(BigInt(i)) > 0n ? `funded ${fmt(l.allocations.lookup(BigInt(i)))}` : 'not funded'}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          {phase === 'submission' && <SubmitForm count={count} busy={live.busy} onSubmit={async (doc) => {
            const sk = newSecretKey();
            const hash = await hashMetadata(doc);
            const before = count;
            const r = await call<bigint>('Submit proposal', { secretKey: sk }, 'submitProposal', [hash, BigInt(doc.requested)]);
            if (!r) return false;
            const id = r.result !== undefined ? Number(r.result) : before;
            mutateVault((v) => ({ ...v, builderSks: { ...v.builderSks, [id]: toHex(sk) } }));
            const merged = { ...off, docs: { ...off.docs, [id]: doc } };
            saveOffChain(net, address, merged);
            setOff(merged);
            return true;
          }} />}

          {l.finalized && (
            <Card tone="public" className="p-6">
              <h2 className="font-medium">Verified allocation</h2>
              <p className="mt-1 text-sm text-muted">Computed by the contract’s finalize circuit from the on-chain tallies.</p>
              <div className="mt-4 divide-y divide-line">
                <KV k="Ranking">{l.ranking.slice(0, count).map((x) => `#${x}`).join(' › ')}</KV>
                <KV k="Total allocated">{fmt(l.totalAllocated)}</KV>
                <KV k="Remaining budget">{fmt(l.remainingBudget)}</KV>
              </div>
            </Card>
          )}

          <Card className="p-6">
            <h2 className="font-medium">Public state on chain</h2>
            <div className="mt-3 divide-y divide-line">
              <KV k="adminPk"><Hash value={l.adminPk} n={8} /></KV>
              <KV k="roundId"><Hash value={l.roundId} n={8} /></KV>
              <KV k="eligibility root"><Hash value={rootHex(l)} n={8} /></KV>
              <KV k="quorum">{String(l.quorum)}</KV>
              <KV k="voting">{new Date(Number(l.votingStart) * 1000).toLocaleString()} → {new Date(Number(l.votingEnd) * 1000).toLocaleTimeString()}</KV>
              <KV k="reveal until">{new Date(Number(l.revealEnd) * 1000).toLocaleTimeString()}</KV>
            </div>
            <div className="mt-5 text-xs font-medium text-muted">ballots: nullifier → commitment</div>
            <div className="mt-2 max-h-64 divide-y divide-line overflow-auto">
              {[...l.ballots].length === 0 && <div className="py-2 text-xs text-faint">none yet</div>}
              {[...l.ballots].map(([n, c]) => (
                <div key={toHex(n)} className="flex items-center gap-3 py-2 text-xs">
                  <Hash value={n} n={6} className="text-public" />
                  <span className="text-faint">→</span>
                  <Hash value={c} n={6} />
                  <span className="ml-auto text-faint">{l.revealed.member(n) ? 'counted' : 'sealed'}{nullifier && toHex(n) === toHex(nullifier) ? ' · yours' : ''}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <aside className="space-y-4">
          {isAdmin && phase === 'submission' && (
            <AdminCard busy={live.busy} voterKeyHex={vk ? toHex(vk) : null} enrolled={enrolled}
              onEnrol={async (keyHex) => !!(await call('Enrol voter', { secretKey: fromHex(vault.adminSk!) }, 'enrolVoter', [fromHex(keyHex)]))}
              onEnrolSelf={async () => {
                const sk = voterSk ?? getCredential();
                await call('Enrol myself', { secretKey: fromHex(vault.adminSk!) }, 'enrolVoter', [voterKey(sk)]);
              }} />
          )}

          <Card tone="private" className="p-5">
            <h3 className="text-sm font-medium">Your ballot</h3>
            {!voterSk ? (
              <>
                <p className="mt-2 text-xs leading-relaxed text-muted">Generate a credential in this browser, then send its voter key to the round admin. Only that key, a hash of your secret, leaves this device.</p>
                <Button className="mt-4" variant="secondary" disabled={phase !== 'submission'} onClick={getCredential}>
                  Generate credential
                </Button>
                {phase !== 'submission' && <p className="mt-2 text-xs text-muted">Enrolment closed when voting opened.</p>}
              </>
            ) : (
              <div className="mt-3 space-y-3 text-xs">
                <div>
                  <div className="text-muted">Your voter key: send this to the admin</div>
                  <div className="mt-1 flex items-center gap-2">
                    <Hash value={vk!} n={12} />
                    <CopyButton text={toHex(vk!)} label="Copy" small />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted">Status</span>
                  {revealed ? <Badge tone="ok">counted</Badge> : voted ? <Badge tone="private">ballot sealed on chain</Badge> : enrolled ? <Badge tone="ok">enrolled</Badge> : <Badge>waiting for enrolment</Badge>}
                </div>
                {phase === 'voting' && enrolled && !voted && (
                  <VoteForm count={count} docs={off.docs} busy={live.busy} onVote={async (choice) => {
                    mutateVault((v) => ({ ...v, choice })); // saved first: needed to reveal later
                    await call('Cast hidden ballot', { secretKey: voterSk!, choice }, 'castBallot', []);
                  }} />
                )}
                {voted && !revealed && (phase === 'reveal') && vault.choice !== undefined && (
                  <Button busy={live.busy} onClick={async () => {
                    const o = ballotOpening(voterSk!, vault.choice!, l.roundId, address);
                    await call('Reveal ballot', { secretKey: voterSk! }, 'revealBallot', [o.nullifier, BigInt(o.choice), o.salt]);
                  }}>
                    Reveal & count my ballot
                  </Button>
                )}
                {voted && !revealed && phase === 'voting' && <p className="text-muted">Come back after voting closes to reveal. Your choice is saved in this browser.</p>}
                {voted && !revealed && phase === 'reveal' && vault.choice === undefined && <p className="text-bad">This browser no longer has your choice, so it can’t reveal.</p>}
              </div>
            )}
          </Card>

          {!l.finalized && now >= Number(l.votingEnd) && (
            <Card className="p-5">
              <h3 className="text-sm font-medium">Finalize</h3>
              <p className="mt-2 text-xs text-muted">Anyone can finalize once the reveal window ends, or earlier if every ballot has been revealed. The contract verifies the ranking and computes the allocation.</p>
              <Button className="mt-4" busy={live.busy} disabled={!(phase === 'tally' || l.ballotsRevealed === l.ballotsCast)} onClick={() => call('Finalize round', { secretKey: newSecretKey() }, 'finalize', [canonicalRanking(tallies)])}>
                Finalize & verify
              </Button>
            </Card>
          )}

          <Card className="p-5">
            <h3 className="text-sm font-medium">Your transactions</h3>
            {vault.txs.length === 0 ? (
              <p className="mt-2 text-xs text-muted">None yet from this browser.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {vault.txs.map((t) => (
                  <li key={t.txId + t.at} className="py-2 text-xs">
                    <div className="flex justify-between">
                      <span className="font-medium">{t.label}</span>
                      {t.blockHeight !== undefined && <span className="text-faint">block {t.blockHeight}</span>}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-muted">{t.txId}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function CopyButton({ text, label, small }: { text: string; label: string; small?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      className={cx('inline-flex items-center gap-1.5 rounded-[3px] border border-line-strong bg-raised font-medium hover:border-fg/40', small ? 'px-2 py-1 text-[11px]' : 'px-3 py-2 text-xs')}
    >
      {done ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />} {done ? 'Copied' : label}
    </button>
  );
}

function AdminCard({ busy, voterKeyHex, enrolled, onEnrol, onEnrolSelf }: { busy: boolean; voterKeyHex: string | null; enrolled: boolean; onEnrol: (k: string) => Promise<boolean>; onEnrolSelf: () => Promise<void> }) {
  const [key, setKey] = useState('');
  const valid = /^[0-9a-fA-F]{64}$/.test(key.replace(/^0x/, ''));
  return (
    <Card className="p-5">
      <h3 className="text-sm font-medium">Round admin: enrol voters</h3>
      <p className="mt-2 text-xs text-muted">Paste a member’s voter key. Each enrolment is one transaction. Enrolment closes when voting opens.</p>
      <input className={cx(inputCls, 'mt-3 font-mono text-xs')} placeholder="voter key (64 hex)" value={key} onChange={(e) => setKey(e.target.value.trim())} />
      <div className="mt-2 flex gap-2">
        <Button disabled={!valid} busy={busy} onClick={async () => { if (await onEnrol(key.replace(/^0x/, ''))) setKey(''); }}>
          Enrol key
        </Button>
        {!enrolled && (
          <Button variant="secondary" busy={busy} onClick={() => void onEnrolSelf()}>
            {voterKeyHex ? 'Enrol myself' : 'Create & enrol my credential'}
          </Button>
        )}
      </div>
    </Card>
  );
}

function VoteForm({ count, docs, busy, onVote }: { count: number; docs: Record<number, ProposalDoc>; busy: boolean; onVote: (c: number) => Promise<void> }) {
  const [choice, setChoice] = useState<number | null>(null);
  const opts = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);
  return (
    <div className="space-y-2">
      {opts.map((i) => (
        <button key={i} onClick={() => setChoice(i)} className={cx('flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left', choice === i ? 'border-fg/60 bg-private-dim' : 'border-line hover:border-line-strong')}>
          <span className="font-mono text-faint">#{i}</span>
          <span className="truncate">{docs[i]?.name ?? `Proposal ${i}`}</span>
        </button>
      ))}
      <Button className="w-full" disabled={choice === null} busy={busy} onClick={() => choice !== null && void onVote(choice)}>
        <Lock className="size-4" /> Cast private ballot
      </Button>
    </div>
  );
}

function SubmitForm({ busy, onSubmit }: { count: number; busy: boolean; onSubmit: (d: ProposalDoc) => Promise<boolean> }) {
  const empty: ProposalDoc = { name: '', tagline: '', description: '', category: 'Developer Tooling', requested: 2_000, github: '', website: '', justification: '', team: '' };
  const [doc, setDoc] = useState<ProposalDoc>(empty);
  const set = (k: keyof ProposalDoc) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDoc({ ...doc, [k]: k === 'requested' ? Number(e.target.value) : e.target.value });
  return (
    <Card className="p-6">
      <Eyebrow>Submit a proposal</Eyebrow>
      <p className="mt-3 text-xs text-muted">Its SHA-256 hash, your request and a pseudonymous builder key go on chain. The document itself travels in the share link.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_10rem]">
        <Field label="Project name"><input className={inputCls} value={doc.name} onChange={set('name')} /></Field>
        <Field label="Requested" hint="USD"><input type="number" className={inputCls} value={doc.requested} onChange={set('requested')} /></Field>
      </div>
      <div className="mt-4"><Field label="One-line summary"><input className={inputCls} value={doc.tagline} onChange={set('tagline')} /></Field></div>
      <div className="mt-4"><Field label="Description and justification"><textarea className={inputCls} rows={3} value={doc.description} onChange={set('description')} /></Field></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="GitHub"><input className={inputCls} value={doc.github} onChange={set('github')} placeholder="https://github.com/…" /></Field>
        <Field label="Website or demo"><input className={inputCls} value={doc.website} onChange={set('website')} placeholder="https://…" /></Field>
      </div>
      <Button className="mt-5" disabled={doc.name.trim().length < 2 || doc.requested <= 0} busy={busy} onClick={async () => { if (await onSubmit({ ...doc, justification: doc.description })) setDoc(empty); }}>
        Submit on chain
      </Button>
    </Card>
  );
}
