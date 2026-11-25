import { useState } from 'react';
import { Clock, FastForward, Users } from 'lucide-react';
import { Badge, Button, Card, cx } from '@/components/ui';
import { PHASE_LABEL, date, phaseOf, store } from '@/engine/store';
import type { Phase, RoundEntry } from '@/engine/types';

const ORDER: Phase[] = ['submission', 'voting', 'reveal', 'finalized'];

export function PhaseTimeline({ r }: { r: RoundEntry }) {
  const l = r.sim.ledger();
  const phase = phaseOf(l, r.sim.time);
  const idx = phase === 'tally' ? 2.5 : ORDER.indexOf(phase);
  const steps = [
    { label: 'Proposals', range: `until ${date(l.submissionEnd)}` },
    { label: 'Hidden voting', range: `${date(l.votingStart)} → ${date(l.votingEnd)}` },
    { label: 'Reveal & tally', range: `until ${date(l.revealEnd)}` },
    { label: 'Verified allocation', range: l.finalized ? 'finalized on chain' : 'anyone can finalize' },
  ];
  return (
    <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
      {steps.map((s, i) => {
        const state = i < idx ? 'done' : i === Math.floor(idx) ? 'now' : 'next';
        return (
          <li key={s.label} className={cx('bg-surface p-4', state === 'now' && 'bg-raised')}>
            <div className="flex items-center gap-2">
              <span
                className={cx(
                  'size-2 rounded-full',
                  state === 'done' && 'bg-public',
                  state === 'now' && 'pulse-dot bg-private',
                  state === 'next' && 'bg-fg/15',
                )}
              />
              <span className={cx('text-sm font-medium', state === 'next' && 'text-muted')}>{s.label}</span>
            </div>
            <div className="mt-1.5 text-xs text-faint">{s.range}</div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Controls that exist only because this is a simulation: moving the round's
 * block clock, and acting as other members' devices.
 */
export function SimControls({ r }: { r: RoundEntry }) {
  const [busy, setBusy] = useState<string | null>(null);
  const l = r.sim.ledger();
  const phase = phaseOf(l, r.sim.time);
  const pendingVoters = r.members.filter((m) => !m.cast);
  const pendingReveals = r.members.filter((m) => m.cast && !m.revealed);
  const allRevealed = l.ballotsRevealed === l.ballotsCast;

  const act = (k: string, fn: () => Promise<void> | void) => async () => {
    setBusy(k);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="border-warn/20 p-5">
      <div className="flex items-center gap-2">
        <FastForward className="size-4 text-warn" />
        <span className="text-sm font-medium">Simulation controls</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        On a real network time passes and other members act from their own devices. Here you drive both. Every action below is still a real contract call.
      </p>
      <div className="mt-4 flex items-center gap-2 rounded-md bg-bg px-3 py-2 text-xs">
        <Clock className="size-3.5 text-faint" />
        <span className="text-muted">Block time</span>
        <span className="ml-auto font-mono">{date(r.sim.time)}</span>
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-md bg-bg px-3 py-2 text-xs">
        <Badge tone="neutral">{PHASE_LABEL[phase]}</Badge>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {phase === 'submission' && (
          <Button variant="secondary" busy={busy === 'ff'} onClick={act('ff', () => store.advanceTo(r, Number(l.votingStart)))}>
            <FastForward className="size-4" /> Open voting
          </Button>
        )}
        {phase === 'voting' && (
          <>
            {pendingVoters.length > 0 && (
              <Button variant="secondary" busy={busy === 'mv'} onClick={act('mv', () => store.membersVote(r, pendingVoters).then(() => store.emit()))}>
                <Users className="size-4" /> {pendingVoters.length} more members vote
              </Button>
            )}
            <Button variant="secondary" busy={busy === 'close'} onClick={act('close', () => store.advanceTo(r, Number(l.votingEnd)))}>
              <FastForward className="size-4" /> Close voting
            </Button>
          </>
        )}
        {phase === 'reveal' && (
          <>
            {pendingReveals.length > 0 && (
              <Button variant="secondary" busy={busy === 'rv'} onClick={act('rv', () => store.revealMembers(r))}>
                <Users className="size-4" /> Members open their {pendingReveals.length} ballots
              </Button>
            )}
            {!allRevealed && (
              <Button variant="secondary" busy={busy === 'end'} onClick={act('end', () => store.advanceTo(r, Number(l.revealEnd)))}>
                <FastForward className="size-4" /> End reveal window
              </Button>
            )}
          </>
        )}
        {(phase === 'tally' || (phase === 'reveal' && allRevealed)) && (
          <Button busy={busy === 'fin'} onClick={act('fin', () => store.finalize(r))}>
            Finalize round
          </Button>
        )}
        {phase === 'finalized' && <p className="text-xs text-muted">This round is complete. Nothing left to simulate.</p>}
      </div>
    </Card>
  );
}
