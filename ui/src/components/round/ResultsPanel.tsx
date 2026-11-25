import { useEffect, useState } from 'react';
import { CheckCircle2, Lock, XCircle } from 'lucide-react';
import { canonicalRanking, expectedAllocations, hashMetadata, toHex } from '@contract/crypto';
import { Badge, Button, Card, Hash, KV, Stat, cx } from '@/components/ui';
import { allocationsOf, fmt, phaseOf, requestsOf, store, talliesOf } from '@/engine/store';
import type { RoundEntry } from '@/engine/types';

type Row = { id: number; votes: bigint; requested: bigint; allocated: bigint; status: 'funded' | 'quorum' | 'budget' | 'pending'; remainingBefore: bigint };

/** Walks the ranking exactly like `finalize`, recording why each proposal was or wasn't funded. */
function explain(r: RoundEntry): Row[] {
  const l = r.sim.ledger();
  const tallies = talliesOf(l);
  const req = requestsOf(l);
  const alloc = allocationsOf(l);
  let remaining = l.fundingPool;
  return canonicalRanking(tallies)
    .slice(0, tallies.length)
    .map(Number)
    .map((id) => {
      const before = remaining;
      let status: Row['status'] = 'pending';
      if (tallies[id] < l.quorum) status = 'quorum';
      else if (req[id] > remaining) status = 'budget';
      else {
        status = 'funded';
        remaining -= req[id];
      }
      return { id, votes: tallies[id], requested: req[id], allocated: alloc[id], status, remainingBefore: before };
    });
}

export function ResultsPanel({ r }: { r: RoundEntry }) {
  const l = r.sim.ledger();
  const phase = phaseOf(l, r.sim.time);
  const [busy, setBusy] = useState(false);
  const [docsOk, setDocsOk] = useState<boolean[] | null>(null);

  useEffect(() => {
    let live = true;
    void Promise.all(
      Array.from({ length: Number(l.proposalCount) }, async (_, i) => {
        const d = r.docs[i];
        return d ? toHex(await hashMetadata(d)) === toHex(l.proposals.lookup(BigInt(i)).metadataHash) : false;
      }),
    ).then((x) => live && setDocsOk(x));
    return () => {
      live = false;
    };
  }, [r, l.proposalCount]);

  if (phase === 'submission' || phase === 'voting') {
    return (
      <Card className="p-10 text-center">
        <Lock className="mx-auto size-6 text-private" />
        <h3 className="mt-5 font-display text-3xl">Results are sealed</h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
          The ledger holds {String(l.ballotsCast)} ballot commitments and zero tallied votes. Nobody — not the admin, not the builders, not PRIVEIL — can see a running count. Results appear only after voting closes.
        </p>
      </Card>
    );
  }

  const rows = explain(r);
  const maxVotes = rows.reduce((a, x) => (x.votes > a ? x.votes : a), 1n);
  const finalized = l.finalized;
  const model = expectedAllocations(talliesOf(l), requestsOf(l), l.fundingPool, l.quorum);
  const modelOk = finalized && model.every((v, i) => v === allocationsOf(l)[i]);
  const sumOk = allocationsOf(l).reduce((a, b) => a + b, 0n) === l.totalAllocated && l.totalAllocated <= l.fundingPool;
  const tallySum = talliesOf(l).reduce((a, b) => a + b, 0n);
  const canFinalize = !finalized && (phase === 'tally' || l.ballotsRevealed === l.ballotsCast);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-6">
        <Card className="grid grid-cols-2 gap-6 p-6 sm:grid-cols-4">
          <Stat label="Valid votes counted" value={String(tallySum)} />
          <Stat label="Ballots cast" value={String(l.ballotsCast)} />
          <Stat label="Not revealed" value={String(l.ballotsCast - l.ballotsRevealed)} sub="excluded" />
          <Stat label={finalized ? 'Allocated' : 'Pool'} value={fmt(finalized ? l.totalAllocated : l.fundingPool, r.meta.unit)} tone={finalized ? 'public' : undefined} />
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{finalized ? 'Final allocation' : 'Live tally'}</h3>
            {!finalized && <Badge tone="warn">reveal in progress</Badge>}
            {finalized && <Badge tone="ok">verified on chain</Badge>}
          </div>
          <ol className="mt-5 space-y-4">
            {rows.map((x, rank) => {
              const d = r.docs[x.id];
              return (
                <li key={x.id}>
                  <div className="flex items-baseline gap-3">
                    <span className="w-5 font-mono text-xs text-faint">{rank + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{d?.name ?? `Proposal #${x.id}`}</span>
                    <span className="text-sm tabular-nums text-muted">
                      {String(x.votes)} vote{x.votes === 1n ? '' : 's'}
                    </span>
                  </div>
                  <div className="mt-2 ml-8 h-2 overflow-hidden rounded-full bg-white/6">
                    <div
                      className={cx('h-full rounded-full transition-[width] duration-700', finalized && x.status === 'funded' ? 'bg-public' : 'bg-white/25')}
                      style={{ width: `${(Number(x.votes) / Number(maxVotes)) * 100}%` }}
                    />
                  </div>
                  {finalized && (
                    <div className="mt-1.5 ml-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {x.status === 'funded' ? (
                        <span className="text-public">Funded {fmt(x.allocated, r.meta.unit)}</span>
                      ) : x.status === 'quorum' ? (
                        <span className="text-muted">Not funded — below quorum of {String(l.quorum)}</span>
                      ) : (
                        <span className="text-muted">
                          Not funded — requested {fmt(x.requested, r.meta.unit)}, {fmt(x.remainingBefore, r.meta.unit)} left in pool
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {canFinalize && (
            <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center">
              <p className="flex-1 text-xs text-muted">Finalizing is permissionless. Your browser computes the ranking; the contract rejects any ranking that isn’t the one correct ordering, then computes allocations itself.</p>
              <Button
                busy={busy}
                onClick={async () => {
                  setBusy(true);
                  await store.finalize(r);
                  setBusy(false);
                }}
              >
                Finalize & verify
              </Button>
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card tone="public" className="p-5">
          <h3 className="text-sm font-medium">Verification</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <Check ok={finalized} label="Ranking verified in-circuit by finalize()" sub="sorted by votes, ties by submission order, every proposal exactly once" />
            <Check ok={modelOk} label="Allocations match an independent recomputation" sub="ranked greedy rule re-run in your browser from public tallies" />
            <Check ok={finalized && sumOk} label={`Total allocated ≤ pool (${fmt(l.fundingPool, r.meta.unit)})`} />
            <Check ok={l.ballotsRevealed === tallySum} label="Every counted vote has a verified opening" sub={`${String(l.ballotsRevealed)} openings = ${String(tallySum)} votes`} />
            <Check ok={docsOk !== null && docsOk.every(Boolean)} label="Proposal documents match on-chain hashes" sub="SHA-256 of each document vs metadataHash" />
          </ul>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-medium">How this result was calculated</h3>
          <p className="mt-2 text-xs leading-relaxed text-muted">{r.meta.allocationRule}</p>
          <div className="mt-4 divide-y divide-line">
            <KV k="Quorum">{String(l.quorum)} vote(s)</KV>
            <KV k="Contract">
              <Hash value={r.sim.address} n={8} />
            </KV>
            <KV k="Round id">
              <Hash value={l.roundId} n={8} />
            </KV>
            <KV k="Remaining budget">{fmt(l.remainingBudget, r.meta.unit)}</KV>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Check({ ok, label, sub }: { ok: boolean; label: string; sub?: string }) {
  return (
    <li className="flex gap-2.5">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-faint" />}
      <span>
        <span className={ok ? 'text-fg' : 'text-muted'}>{label}</span>
        {sub && <span className="block text-xs text-faint">{sub}</span>}
      </span>
    </li>
  );
}
