import { CheckCircle2, XCircle } from 'lucide-react';
import { Badge, Card, Hash, KV, PublicTag, cx } from '@/components/ui';
import { date, fmt, rootHex } from '@/engine/store';
import type { RoundEntry } from '@/engine/types';

const ACTOR_LABEL = { you: 'you', member: 'a member', admin: 'admin', builder: 'a builder', anyone: 'anyone' } as const;

/** The public ledger exactly as an indexer exposes it, plus the transaction feed. */
export function LedgerPanel({ r }: { r: RoundEntry }) {
  const l = r.sim.ledger();
  const ballots = [...l.ballots];
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
      <div className="space-y-4">
        <Card tone="public" className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Public contract state</h3>
            <PublicTag />
          </div>
          <p className="mt-1 text-xs text-muted">Decoded with the compiler-generated <span className="font-mono">ledger()</span> function — everything here is visible to everyone.</p>
          <div className="mt-3 divide-y divide-line">
            <KV k="adminPk">
              <Hash value={l.adminPk} n={8} />
            </KV>
            <KV k="roundId">
              <Hash value={l.roundId} n={8} />
            </KV>
            <KV k="fundingPool">{fmt(l.fundingPool, r.meta.unit)}</KV>
            <KV k="votingStart → votingEnd">
              {date(l.votingStart)} → {date(l.votingEnd)}
            </KV>
            <KV k="revealEnd">{date(l.revealEnd)}</KV>
            <KV k="quorum">{String(l.quorum)}</KV>
            <KV k="proposalCount">{String(l.proposalCount)}</KV>
            <KV k="voters.root()">
              <Hash value={rootHex(l)} n={8} />
            </KV>
            <KV k="enrolled">{String(l.enrolled)}</KV>
            <KV k="ballotsCast / ballotsRevealed">
              {String(l.ballotsCast)} / {String(l.ballotsRevealed)}
            </KV>
            <KV k="finalized">{String(l.finalized)}</KV>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-medium">ballots: nullifier → commitment</h3>
          <p className="mt-1 text-xs text-muted">No voter identity and no choice. A ✓ means the opening has been verified and counted.</p>
          <div className="mt-3 max-h-80 divide-y divide-line overflow-auto">
            {ballots.length === 0 && <div className="py-3 text-xs text-faint">No ballots yet.</div>}
            {ballots.map(([n, c]) => (
              <div key={String(n)} className="flex items-center gap-3 py-2">
                <Hash value={n} n={6} className="text-public" />
                <span className="text-faint">→</span>
                <Hash value={c} n={6} className="text-muted" />
                {l.revealed.member(n) ? <CheckCircle2 className="ml-auto size-3.5 text-ok" /> : <span className="ml-auto text-[11px] text-faint">sealed</span>}
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card className="p-5">
        <h3 className="text-sm font-medium">Transaction feed</h3>
        <p className="mt-1 text-xs text-muted">
          What an indexer shows: the circuit called and the public state it wrote. Circuit arguments and witnesses are private inputs and never appear. Rejected calls fail locally before a proof is made, so they never reach the chain — shown here only for this demo.
        </p>
        <ol className="mt-4 max-h-[42rem] space-y-2 overflow-auto pr-1">
          {r.txs.map((t) => (
            <li key={t.id} className={cx('rounded-md border px-3.5 py-3', t.ok ? 'border-line' : 'border-bad/20 bg-bad/5')}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {t.ok ? <CheckCircle2 className="size-3.5 text-ok" /> : <XCircle className="size-3.5 text-bad" />}
                <span className="font-mono text-fg">{t.circuit}</span>
                <span className="text-faint">
                  by {t.circuit === 'castBallot' || t.circuit === 'revealBallot' ? 'an anonymous voter' : ACTOR_LABEL[t.actor]}
                </span>
                {t.actor === 'you' && <Badge tone="private">yours · only you know</Badge>}
                <span className="ml-auto text-faint">{date(t.blockTime)}</span>
              </div>
              {t.ok ? (
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[11.5px]">
                  {t.effects.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-faint">{k}</dt>
                      <dd className="truncate text-muted">{v}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <div className="mt-1.5 font-mono text-[11.5px] text-bad">rejected locally: {t.error}</div>
              )}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
