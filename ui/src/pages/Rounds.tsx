import { Link } from 'react-router-dom';
import { ArrowUpRight, Lock, Plus } from 'lucide-react';
import { Page } from '@/components/Layout';
import { Badge, Card, Meter, Stat } from '@/components/ui';
import { PHASE_LABEL, fmt, phaseOf, relative, useStore } from '@/engine/store';
import type { Phase, RoundEntry } from '@/engine/types';

const PHASE_TONE: Record<Phase, 'live' | 'private' | 'warn' | 'public' | 'neutral'> = {
  submission: 'public',
  voting: 'live',
  reveal: 'warn',
  tally: 'warn',
  finalized: 'neutral',
};

function RoundCard({ r }: { r: RoundEntry }) {
  const l = r.sim.ledger();
  const phase = phaseOf(l, r.sim.time);
  const deadline =
    phase === 'submission' ? ['Voting opens', l.votingStart] : phase === 'voting' ? ['Voting closes', l.votingEnd] : phase === 'reveal' ? ['Reveal ends', l.revealEnd] : null;
  return (
    <Link to={`/rounds/${r.id}`} className="group block">
      <Card className="h-full p-6 transition-colors group-hover:border-line-strong">
        <div className="flex items-center gap-2">
          <Badge tone={PHASE_TONE[phase]}>{PHASE_LABEL[phase]}</Badge>
          {r.meta.origin === 'you' ? <Badge tone="private">Created by you</Badge> : <Badge>Demo data</Badge>}
          <ArrowUpRight className="ml-auto size-4 text-faint transition-colors group-hover:text-fg" />
        </div>
        <h3 className="mt-5 text-xl font-medium tracking-tight">{r.meta.name}</h3>
        <p className="mt-1 text-sm text-muted">{r.meta.sponsor}</p>
        <div className="mt-6 grid grid-cols-3 gap-4">
          <Stat label="Pool" value={fmt(l.fundingPool, r.meta.unit)} />
          <Stat label="Proposals" value={String(l.proposalCount)} />
          <Stat label="Ballots" value={`${l.ballotsCast}`} sub={`of ${l.enrolled} eligible`} />
        </div>
        <div className="mt-5">
          {phase === 'finalized' ? (
            <>
              <div className="mb-2 flex justify-between text-xs text-muted">
                <span>Allocated</span>
                <span className="tabular-nums">{fmt(l.totalAllocated, r.meta.unit)}</span>
              </div>
              <Meter value={Number(l.totalAllocated)} max={Number(l.fundingPool)} tone="ok" />
            </>
          ) : (
            <>
              <div className="mb-2 flex justify-between text-xs text-muted">
                <span>Turnout</span>
                <span className="tabular-nums">{l.enrolled > 0n ? Math.round((Number(l.ballotsCast) / Number(l.enrolled)) * 100) : 0}%</span>
              </div>
              <Meter value={Number(l.ballotsCast)} max={Number(l.enrolled)} />
            </>
          )}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-xs text-muted">
          {deadline ? (
            <span>
              {deadline[0] as string} {relative(deadline[1] as bigint, r.sim.time)}
            </span>
          ) : (
            <span>{phase === 'finalized' ? 'Allocation verified on chain' : 'Ready to finalize'}</span>
          )}
          {phase === 'voting' && (
            <span className="inline-flex items-center gap-1 text-private">
              <Lock className="size-3" /> Tally sealed
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}

export function Rounds() {
  const s = useStore();
  const rounds = s.list();
  const ledgers = rounds.map((r) => ({ r, l: r.sim.ledger(), p: phaseOf(r.sim.ledger(), r.sim.time) }));
  const active = ledgers.filter((x) => x.p !== 'finalized');
  const done = ledgers.filter((x) => x.p === 'finalized');
  const sum = (f: (x: (typeof ledgers)[number]) => bigint, xs = ledgers) => xs.reduce((a, x) => a + f(x), 0n);
  const choicesOnLedger = ledgers.filter((x) => x.p === 'voting').reduce((a, x) => a + Number(x.l.ballotsRevealed), 0);

  return (
    <Page>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg">Dashboard</div>
          <h1 className="mt-3 font-display text-[30px] leading-[1.1] sm:text-[40px]">Grant rounds</h1>
          <p className="mt-3 max-w-xl text-sm text-muted">Every number below is read from the decoded public ledger of each round’s contract. The rounds themselves are fictional demo data.</p>
        </div>
        <Link to="/rounds/new" className="inline-flex items-center gap-2 self-start rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-ink-fg hover:bg-black sm:ml-auto sm:self-auto">
          <Plus className="size-4" /> Create round
        </Link>
      </div>

      <Card className="mt-10 grid grid-cols-2 gap-6 p-6 md:grid-cols-6">
        <Stat label="Active rounds" value={active.length} />
        <Stat label="Funding available" value={fmt(sum((x) => x.l.remainingBudget, active))} />
        <Stat label="Proposals" value={String(sum((x) => x.l.proposalCount))} />
        <Stat label="Ballots cast" value={String(sum((x) => x.l.ballotsCast))} />
        <Stat label="Allocated" value={fmt(sum((x) => x.l.totalAllocated, done))} sub={`${done.length} completed round${done.length === 1 ? '' : 's'}`} />
        <Stat label="Choices visible mid-vote" value={choicesOnLedger} tone="private" sub="ballots are sealed" />
      </Card>

      <h2 className="mt-14 text-sm font-medium uppercase tracking-[0.14em] text-faint">Active</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {active.map(({ r }) => (
          <RoundCard key={r.id} r={r} />
        ))}
      </div>
      <h2 className="mt-14 text-sm font-medium uppercase tracking-[0.14em] text-faint">Completed</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {done.map(({ r }) => (
          <RoundCard key={r.id} r={r} />
        ))}
      </div>
    </Page>
  );
}
