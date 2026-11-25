import { useState } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, Plus, ShieldCheck, UserPlus } from 'lucide-react';
import { fromHex, newSecretKey, voterKey } from '@contract/crypto';
import { Page } from '@/components/Layout';
import { Badge, Button, Card, Hash, Meter, Stat, cx, inputCls } from '@/components/ui';
import { PhaseTimeline, SimControls } from '@/components/round/RoundChrome';
import { VotePanel } from '@/components/round/VotePanel';
import { ResultsPanel } from '@/components/round/ResultsPanel';
import { LedgerPanel } from '@/components/round/LedgerPanel';
import { PHASE_LABEL, allocationsOf, fmt, phaseOf, relative, store, talliesOf, useStore } from '@/engine/store';
import type { RoundEntry } from '@/engine/types';
import { seededBytes } from '@/engine/rng';

const TABS = [
  { id: 'overview', label: 'Proposals' },
  { id: 'vote', label: 'Vote' },
  { id: 'results', label: 'Results' },
  { id: 'ledger', label: 'Public ledger' },
] as const;

export function RoundPage() {
  useStore();
  const { id = '', tab = 'overview' } = useParams();
  const r = store.get(id);
  if (!r)
    return (
      <Page>
        <p className="text-muted">Round not found.</p>
        <Link to="/rounds" className="mt-4 inline-block text-sm underline">
          Back to rounds
        </Link>
      </Page>
    );
  const l = r.sim.ledger();
  const phase = phaseOf(l, r.sim.time);
  const deadline =
    phase === 'submission' ? `Voting opens ${relative(l.votingStart, r.sim.time)}` : phase === 'voting' ? `Voting closes ${relative(l.votingEnd, r.sim.time)}` : phase === 'reveal' ? `Reveal window ends ${relative(l.revealEnd, r.sim.time)}` : phase === 'tally' ? 'Ready to finalize' : 'Allocation finalized';

  return (
    <Page className="py-8 sm:py-10">
      <Link to="/rounds" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> All rounds
      </Link>
      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={phase === 'voting' ? 'live' : phase === 'finalized' ? 'neutral' : 'warn'}>{PHASE_LABEL[phase]}</Badge>
            {r.meta.origin === 'demo' ? <Badge>Demo data</Badge> : <Badge tone="private">Created by you</Badge>}
            <span className="text-xs text-muted">{deadline}</span>
          </div>
          <h1 className="mt-4 font-display text-[30px] leading-[1.1] sm:text-[40px]">{r.meta.name}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">{r.meta.description}</p>
          <p className="mt-2 text-xs text-faint">
            {r.meta.sponsor} · {r.meta.methodology}
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-6 lg:ml-auto">
          <Stat label="Pool" value={fmt(l.fundingPool, r.meta.unit)} />
          <Stat label="Eligible" value={String(l.enrolled)} />
          <Stat label="Ballots" value={String(l.ballotsCast)} />
        </div>
      </div>

      <div className="mt-8">
        <PhaseTimeline r={r} />
      </div>

      <div className="mt-8 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <NavLink
            key={t.id}
            to={`/rounds/${r.id}/${t.id}`}
            className={() =>
              cx('-mb-px shrink-0 border-b-2 px-4 py-3 text-sm transition-colors', tab === t.id ? 'border-private text-fg' : 'border-transparent text-muted hover:text-fg')
            }
          >
            {t.label}
            {t.id === 'vote' && phase === 'voting' && !r.you.cast && r.you.enrolled && <span className="ml-2 inline-block size-1.5 rounded-full bg-private align-middle" />}
          </NavLink>
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_18rem]">
        <div className="min-w-0">
          {tab === 'overview' && <Overview r={r} />}
          {tab === 'vote' && <VotePanel r={r} />}
          {tab === 'results' && <ResultsPanel r={r} />}
          {tab === 'ledger' && <LedgerPanel r={r} />}
        </div>
        <aside className="space-y-4">
          <SimControls r={r} />
          {r.you.adminSk && <AdminPanel r={r} />}
        </aside>
      </div>
    </Page>
  );
}

function Overview({ r }: { r: RoundEntry }) {
  const l = r.sim.ledger();
  const phase = phaseOf(l, r.sim.time);
  const count = Number(l.proposalCount);
  const tallies = talliesOf(l);
  const alloc = allocationsOf(l);
  const showVotes = phase !== 'submission' && phase !== 'voting';
  const requestedTotal = Array.from({ length: count }, (_, i) => l.proposals.lookup(BigInt(i)).requested).reduce((a, b) => a + b, 0n);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="text-xs uppercase tracking-[0.14em] text-faint">Voting progress</div>
          <div className="mt-2 text-2xl font-medium tabular-nums">
            {String(l.ballotsCast)} <span className="text-base text-muted">/ {String(l.enrolled)}</span>
          </div>
          <div className="mt-3">
            <Meter value={Number(l.ballotsCast)} max={Number(l.enrolled)} />
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-[0.14em] text-faint">Requested vs pool</div>
          <div className="mt-2 text-2xl font-medium tabular-nums">
            {fmt(requestedTotal, r.meta.unit)} <span className="text-base text-muted">/ {fmt(l.fundingPool, r.meta.unit)}</span>
          </div>
          <div className="mt-3">
            <Meter value={Number(requestedTotal)} max={Number(l.fundingPool)} tone="private" />
          </div>
        </Card>
        <Card tone="private" className="p-5">
          <div className="text-xs uppercase tracking-[0.14em] text-faint">Your eligibility</div>
          <div className="mt-2 flex items-center gap-2 text-base font-medium">
            {r.you.enrolled ? (
              <>
                <ShieldCheck className="size-4 text-ok" /> Credential on this device
              </>
            ) : (
              <span className="text-muted">No credential</span>
            )}
          </div>
          <p className="mt-2 text-xs text-muted">
            {r.you.cast ? (r.you.revealed ? 'Ballot cast and counted.' : 'Ballot cast. Your choice is sealed.') : r.you.enrolled ? 'You can vote while voting is open.' : 'Members get credentials before voting opens.'}
          </p>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-faint">{count} proposals</h2>
        {phase === 'voting' && (
          <span className="inline-flex items-center gap-1 text-xs text-private">
            <Lock className="size-3" /> votes hidden until voting closes
          </span>
        )}
        {phase === 'submission' && (
          <Link to={`/rounds/${r.id}/submit`} className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-ink-fg hover:bg-black">
            <Plus className="size-4" /> Submit proposal
          </Link>
        )}
      </div>
      {count === 0 && <Card className="p-8 text-center text-sm text-muted">No proposals yet.</Card>}
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: count }, (_, i) => {
          const d = r.docs[i];
          const p = l.proposals.lookup(BigInt(i));
          return (
            <Link key={i} to={`/rounds/${r.id}/p/${i}`} className="group block">
              <Card className="flex h-full flex-col p-5 transition-colors group-hover:border-line-strong">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-faint">#{i}</span>
                  <Badge>{d?.category ?? 'Proposal'}</Badge>
                  {r.you.builderSks[i] && <Badge tone="private">Yours</Badge>}
                  {l.finalized && (alloc[i] > 0n ? <Badge tone="ok">Funded</Badge> : <Badge>Not funded</Badge>)}
                </div>
                <h3 className="mt-4 text-lg font-medium tracking-tight">{d?.name ?? 'Untitled proposal'}</h3>
                <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-muted">{d?.tagline}</p>
                <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-sm">
                  <span className="tabular-nums">{fmt(p.requested, r.meta.unit)}</span>
                  {showVotes ? (
                    <span className="tabular-nums text-muted">{String(tallies[i])} votes</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-faint">
                      <Lock className="size-3" /> sealed
                    </span>
                  )}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function AdminPanel({ r }: { r: RoundEntry }) {
  const l = r.sim.ledger();
  const phase = phaseOf(l, r.sim.time);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [n, setN] = useState(8);
  const admin = r.you.adminSk!;
  const open = phase === 'submission';

  const addMembers = async () => {
    setBusy('m');
    const rnd = seededBytes(`${r.id}-members-${r.members.length}`);
    const count = Number(l.proposalCount) || 1;
    for (let i = 0; i < n; i++) {
      const m = { label: `Member ${String(r.members.length + 1).padStart(2, '0')}`, sk: rnd(32), choice: Math.floor(rnd(1)[0] % count), cast: false, revealed: false };
      if (await store.enrol(r, admin, voterKey(m.sk), 'you', true)) r.members.push(m);
    }
    store.toast(true, `${n} members enrolled`, 'Each generated their secret on their own (simulated) device.');
    setBusy(null);
  };

  return (
    <Card tone="private" className="p-5">
      <div className="flex items-center gap-2">
        <UserPlus className="size-4 text-private" />
        <span className="text-sm font-medium">Round admin</span>
      </div>
      <div className="mt-2 text-xs text-muted">
        You deployed this round. adminPk <Hash value={l.adminPk} n={6} />
      </div>
      {!open ? (
        <p className="mt-3 text-xs text-muted">Enrolment closed when voting opened.</p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <input type="number" min={1} max={40} value={n} onChange={(e) => setN(Math.max(1, Math.min(40, Number(e.target.value))))} className={cx(inputCls, 'w-20')} />
            <Button variant="secondary" className="flex-1" busy={busy === 'm'} onClick={addMembers}>
              Enrol demo members
            </Button>
          </div>
          {!r.you.enrolled && (
            <Button variant="secondary" className="w-full" busy={busy === 'me'} onClick={async () => { setBusy('me'); await store.joinAsVoter(r); setBusy(null); }}>
              Issue a credential to myself
            </Button>
          )}
          <div>
            <input className={inputCls} placeholder="Enrol a voter key (64 hex chars)" value={key} onChange={(e) => setKey(e.target.value.trim())} />
            <Button
              variant="ghost"
              className="mt-1 w-full"
              disabled={!/^(0x)?[0-9a-fA-F]{64}$/.test(key)}
              busy={busy === 'k'}
              onClick={async () => {
                setBusy('k');
                if (await store.enrol(r, admin, fromHex(key), 'you')) setKey('');
                setBusy(null);
              }}
            >
              Enrol key
            </Button>
          </div>
          <Button
            variant="danger"
            className="w-full"
            busy={busy === 'x'}
            onClick={async () => {
              setBusy('x');
              const intruder = newSecretKey();
              await store.enrol(r, intruder, voterKey(intruder), 'anyone');
              setBusy(null);
            }}
          >
            Try enrolling as a non-admin
          </Button>
        </div>
      )}
    </Card>
  );
}
