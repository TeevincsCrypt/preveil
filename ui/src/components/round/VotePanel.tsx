import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, Check, CheckCircle2, CircleDashed, KeyRound, Lock, RotateCcw, ShieldCheck, UserX, XCircle } from 'lucide-react';
import { collectPublicBytes, findInPublicState } from '@contract/privacy';
import { ballotCommitment, toHex } from '@contract/crypto';
import { Badge, Button, Card, Hash, KV, PrivateTag, PublicTag, cx } from '@/components/ui';
import { fmt, phaseOf, relative, rootHex, store, yourBallot } from '@/engine/store';
import type { RoundEntry } from '@/engine/types';

const CAST_STEPS = [
  { t: 'Load private state', d: 'secret key + your choice, from this device' },
  { t: 'Build witnesses', d: 'Merkle path to the public eligibility root' },
  { t: 'Execute castBallot circuit', d: 'membership · nullifier unused · choice < proposalCount' },
  { t: 'Zero-knowledge proof', d: 'skipped in Local Simulation — on Midnight the wallet or a proof server proves this' },
  { t: 'Update public ledger', d: 'insert nullifier → commitment' },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function VotePanel({ r }: { r: RoundEntry }) {
  const l = r.sim.ledger();
  const phase = phaseOf(l, r.sim.time);
  const [selected, setSelected] = useState<number | null>(r.you.choice ?? null);
  const [step, setStep] = useState(-1);
  const [busy, setBusy] = useState<string | null>(null);
  const count = Number(l.proposalCount);

  async function castNow() {
    if (selected === null) return;
    setBusy('cast');
    for (let i = 0; i < CAST_STEPS.length - 1; i++) {
      setStep(i);
      await sleep(i === 3 ? 650 : 380);
    }
    setStep(CAST_STEPS.length - 1);
    const ok = await store.castYours(r, selected);
    setStep(ok ? CAST_STEPS.length : -1);
    setBusy(null);
  }

  const wrap = (k: string, fn: () => Promise<unknown>) => async () => {
    setBusy(k);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  let main: React.ReactNode;
  if (!r.you.voterSk || !r.you.enrolled) {
    main =
      phase === 'submission' ? (
        <Card className="p-6">
          <KeyRound className="size-5 text-private" />
          <h3 className="mt-4 text-lg font-medium">Get a voter credential</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Your browser generates a random secret. Only <span className="font-mono text-fg">voterKey = H(“priveil:voter”, secret)</span> is sent to the round admin for enrolment. The secret never leaves this device.
          </p>
          <Button className="mt-5" busy={busy === 'join'} onClick={wrap('join', () => store.joinAsVoter(r))}>
            Generate credential & request enrolment
          </Button>
        </Card>
      ) : (
        <Card className="p-6">
          <UserX className="size-5 text-muted" />
          <h3 className="mt-4 text-lg font-medium">You are not enrolled in this round</h3>
          <p className="mt-2 text-sm text-muted">The voter list was frozen when voting opened, which fixes the anonymity set.</p>
          {phase === 'voting' && (
            <Button variant="danger" className="mt-5" busy={busy === 'inel'} onClick={wrap('inel', () => store.tryIneligibleVote(r))}>
              Try to vote anyway
            </Button>
          )}
        </Card>
      );
  } else if (phase === 'submission') {
    main = (
      <Card className="p-6">
        <CheckCircle2 className="size-5 text-ok" />
        <h3 className="mt-4 text-lg font-medium">You hold a credential for this round</h3>
        <p className="mt-2 text-sm text-muted">Voting opens {relative(l.votingStart, r.sim.time)}. Use the simulation controls to open voting now.</p>
      </Card>
    );
  } else if (phase === 'voting' && !r.you.cast) {
    main = (
      <div className="space-y-4">
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-faint">01</span>
            <h3 className="font-medium">Choose one proposal</h3>
            <span className="ml-auto text-xs text-muted">Your choice is only stored on this device</span>
          </div>
          <div className="mt-4 grid gap-2">
            {Array.from({ length: count }, (_, i) => {
              const d = r.docs[i];
              const p = l.proposals.lookup(BigInt(i));
              return (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
                  disabled={busy === 'cast'}
                  className={cx(
                    'flex items-center gap-4 rounded-md border p-4 text-left transition-colors',
                    selected === i ? 'border-fg/60 bg-private-dim' : 'border-line hover:border-line-strong',
                  )}
                >
                  <span className={cx('flex size-5 shrink-0 items-center justify-center rounded-full border', selected === i ? 'border-ink bg-ink text-ink-fg' : 'border-line-strong')}>
                    {selected === i && <Check className="size-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      <span className="mr-2 font-mono text-xs text-faint">#{i}</span>
                      {d?.name ?? `Proposal ${i}`}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">{d?.tagline}</span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-muted">{fmt(p.requested, r.meta.unit)}</span>
                </button>
              );
            })}
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-faint">02</span>
            <h3 className="font-medium">Cast your hidden ballot</h3>
          </div>
          {step >= 0 ? (
            <ol className="mt-4 space-y-2.5">
              {CAST_STEPS.map((s, i) => (
                <li key={s.t} className="flex items-start gap-3 text-sm">
                  {i < step || step === CAST_STEPS.length ? (
                    i === 3 ? <CircleDashed className="mt-0.5 size-4 text-warn" /> : <CheckCircle2 className="mt-0.5 size-4 text-ok" />
                  ) : i === step ? (
                    <span className="mt-1 size-3 animate-spin rounded-full border-2 border-private border-t-transparent" />
                  ) : (
                    <span className="mt-1.5 ml-1 size-1.5 rounded-full bg-fg/20" />
                  )}
                  <span>
                    <span className={cx(i > step && 'text-muted')}>{s.t}</span>
                    <span className="block text-xs text-faint">{s.d}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-muted">
              The circuit proves you are one of {String(l.enrolled)} eligible members, that you haven’t voted, and that your choice is a valid proposal — without revealing which member you are or what you chose.
            </p>
          )}
          <Button className="mt-5 w-full sm:w-auto" disabled={selected === null} busy={busy === 'cast'} onClick={castNow}>
            <Lock className="size-4" /> {selected === null ? 'Select a proposal first' : `Cast private ballot for #${selected}`}
          </Button>
        </Card>
      </div>
    );
  } else if (r.you.cast) {
    const b = yourBallot(r)!;
    const onLedger = l.ballots.member(b.nullifier);
    const counted = l.revealed.member(b.nullifier);
    main = (
      <div className="space-y-4">
        <Card tone="public" className="p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-ok" />
            <h3 className="text-lg font-medium">Your vote is private.</h3>
          </div>
          <p className="mt-2 text-sm text-muted">Your participation was accepted. Here is how to check it yourself:</p>
          <div className="mt-4 divide-y divide-line rounded-md border border-line px-4">
            <KV k="Nullifier on ledger">{onLedger ? <span className="text-ok">✓ present</span> : '—'}</KV>
            <KV k="Stored commitment matches your opening">
              {onLedger && b.commitment && toHex(l.ballots.lookup(b.nullifier)) === toHex(b.commitment) ? <span className="text-ok">✓ match</span> : '—'}
            </KV>
            <KV k="Counted in tally">{counted ? <span className="text-ok">✓ revealed & counted</span> : <span className="text-muted">after voting closes</span>}</KV>
          </div>
        </Card>
        {phase === 'voting' && (
          <Card className="p-6">
            <h3 className="font-medium">Try to break it</h3>
            <p className="mt-1.5 text-sm text-muted">These calls go to the same contract. Watch it reject them.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button variant="danger" busy={busy === 'dup'} onClick={wrap('dup', () => store.tryDoubleVote(r))}>
                <RotateCcw className="size-4" /> Vote again (different proposal)
              </Button>
              <Button variant="danger" busy={busy === 'inel'} onClick={wrap('inel', () => store.tryIneligibleVote(r))}>
                <Ban className="size-4" /> Vote with an unenrolled credential
              </Button>
            </div>
            <RejectionLog r={r} />
          </Card>
        )}
        {(phase === 'reveal' || phase === 'tally') && !r.you.revealed && (
          <Card tone="private" className="p-6">
            <h3 className="font-medium">Open your ballot</h3>
            <p className="mt-1.5 text-sm text-muted">
              Voting has closed. Submitting your opening adds your vote to the public tally under your anonymous nullifier. The salt is checked in-circuit and is not published.
            </p>
            {phase === 'tally' ? (
              <p className="mt-4 text-sm text-bad">The reveal window has ended — unopened ballots are excluded.</p>
            ) : (
              <Button className="mt-4" busy={busy === 'rev'} onClick={wrap('rev', () => store.revealYours(r))}>
                Reveal & count my ballot
              </Button>
            )}
          </Card>
        )}
        {phase === 'finalized' && (
          <Link to={`/rounds/${r.id}/results`} className="block">
            <Card className="p-5 text-sm hover:border-line-strong">The round is finalized → see the verified allocation</Card>
          </Link>
        )}
      </div>
    );
  } else {
    main = (
      <Card className="p-6">
        <h3 className="text-lg font-medium">You did not vote in this round</h3>
        <p className="mt-2 text-sm text-muted">Voting has closed.</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
      <div>{main}</div>
      <PrivacySplit r={r} pending={selected} />
    </div>
  );
}

function RejectionLog({ r }: { r: RoundEntry }) {
  const rej = r.txs.filter((t) => !t.ok && t.actor === 'you').slice(0, 3);
  if (!rej.length) return null;
  return (
    <ul className="mt-4 space-y-2">
      {rej.map((t) => (
        <li key={t.id} className="rise flex items-start gap-2 rounded-md border border-bad/20 bg-bad/5 px-3 py-2.5 text-xs">
          <XCircle className="mt-0.5 size-3.5 shrink-0 text-bad" />
          <span>
            <span className="font-mono text-fg">{t.circuit}</span> rejected: <span className="font-mono text-bad">“{t.error}”</span>
            <span className="block text-faint">Rejected locally before proving — nothing was submitted or changed.</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Side-by-side: what only this device knows vs what the ledger holds. */
export function PrivacySplit({ r, pending }: { r: RoundEntry; pending: number | null }) {
  const l = r.sim.ledger();
  const b = yourBallot(r);
  const choice = r.you.choice ?? pending;
  const scan = b
    ? {
        secret: findInPublicState(l, b.sk),
        salt: findInPublicState(l, b.salt),
        keyInBallots: findInPublicState({ ballots: l.ballots, revealed: l.revealed, tallies: l.tallies }, b.voterKey),
        // An observer's best attack on a sealed ballot: try every choice with
        // every public 32-byte value (and zero) as the salt.
        bruteForced: l.ballots.member(b.nullifier) ? bruteForceOpens(l.ballots.lookup(b.nullifier), l, Number(l.proposalCount)) : false,
        revealed: l.revealed.member(b.nullifier),
      }
    : null;
  const tallySum = Array.from({ length: Number(l.proposalCount) }, (_, i) => l.tallies.lookup(BigInt(i))).reduce((a, x) => a + x, 0n);

  return (
    <div className="space-y-4">
      <Card tone="private" className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Only on this device</span>
          <PrivateTag />
        </div>
        {b ? (
          <div className="mt-3 divide-y divide-line">
            <KV k="secret key" tone="private">
              <Hash value={b.sk} secret />
            </KV>
            <KV k="your choice" tone="private">
              {choice === null || choice === undefined ? <span className="text-faint">not chosen</span> : <span>#{choice} {r.docs[choice]?.name}</span>}
            </KV>
            <KV k="ballot salt" tone="private">
              <Hash value={b.salt} secret />
            </KV>
            <KV k="enrolled leaf" tone="private">
              <Hash value={b.voterKey} n={8} />
            </KV>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No credential on this device for this round.</p>
        )}
      </Card>
      <Card tone="public" className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">On the public ledger</span>
          <PublicTag />
        </div>
        <div className="mt-3 divide-y divide-line">
          <KV k="eligibility root" tone="public">
            <Hash value={rootHex(l)} n={8} />
          </KV>
          <KV k="your nullifier" tone="public">
            {b && l.ballots.member(b.nullifier) ? <Hash value={b.nullifier} n={8} /> : <span className="text-faint">—</span>}
          </KV>
          <KV k="your commitment" tone="public">
            {b && l.ballots.member(b.nullifier) ? <Hash value={l.ballots.lookup(b.nullifier)} n={8} /> : <span className="text-faint">—</span>}
          </KV>
          <KV k="ballots cast" tone="public">
            {String(l.ballotsCast)} of {String(l.enrolled)}
          </KV>
          <KV k="votes tallied" tone="public">
            {String(tallySum)} {phaseOf(l, r.sim.time) === 'voting' && <Badge tone="private" className="ml-1">sealed</Badge>}
          </KV>
        </div>
      </Card>
      {scan && (
        <Card className="p-5">
          <div className="text-sm font-medium">Live privacy scan of the public ledger</div>
          <p className="mt-1 text-xs text-muted">Searches every byte string in the decoded public state — the same check the test suite runs.</p>
          <ul className="mt-3 space-y-1.5 text-xs">
            <ScanRow ok={scan.secret === null} label="Your secret key is not on chain" />
            <ScanRow ok={scan.salt === null} label="Your ballot salt is not on chain" />
            <ScanRow ok={scan.keyInBallots === null} label="Your enrolled key is not linked to any ballot" />
            {scan.revealed ? (
              <ScanRow ok={scan.keyInBallots === null} label="Your opened choice is public only under your anonymous nullifier" />
            ) : l.ballots.member(b!.nullifier) ? (
              <ScanRow ok={!scan.bruteForced} label="Your sealed ballot can’t be opened from public data" />
            ) : null}
          </ul>
        </Card>
      )}
    </div>
  );
}

function bruteForceOpens(commitment: Uint8Array, ledger: unknown, choices: number): boolean {
  const target = toHex(commitment);
  const salts = [new Uint8Array(32), ...collectPublicBytes(ledger).map((p) => p.bytes).filter((x) => x.length === 32)];
  for (let c = 0; c < choices; c++) for (const s of salts) if (toHex(ballotCommitment(c, s)) === target) return true;
  return false;
}

function ScanRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="size-3.5 text-ok" /> : <XCircle className="size-3.5 text-bad" />}
      <span className={ok ? 'text-fg/90' : 'text-bad'}>{label}</span>
    </li>
  );
}
