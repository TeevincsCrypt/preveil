import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { assertMessage } from '@contract/simulator';
import { newSecretKey, toHex, randomBytes, voterKey } from '@contract/crypto';
import { seededBytes } from '@/engine/rng';
import { Page } from '@/components/Layout';
import { Button, Card, Field, inputCls } from '@/components/ui';
import { store } from '@/engine/store';

const DAY = 86_400;
const toLocal = (t: number) => {
  const d = new Date(t * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocal = (s: string) => Math.floor(new Date(s).getTime() / 1000);

export function CreateRound() {
  const nav = useNavigate();
  const now = Math.floor(Date.now() / 1000);
  const [f, setF] = useState({
    name: 'Community Builders Round',
    description: 'A community round for open-source privacy builders.',
    pool: 50_000,
    votingStart: toLocal(now + 3 * DAY),
    votingEnd: toLocal(now + 8 * DAY),
    revealEnd: toLocal(now + 10 * DAY),
    quorum: 1,
    voters: 12,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: ['pool', 'quorum', 'voters'].includes(k) ? Number(e.target.value) : e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const id = `round-${toHex(randomBytes(4))}`;
      const vs = fromLocal(f.votingStart);
      // Timeline and amounts are validated by the contract's constructor, not here.
      const r = await store.createRound(
        id,
        {
          name: f.name,
          description: f.description,
          sponsor: 'Your community',
          unit: 'USD',
          methodology: 'One member, one vote · hidden ballots · commit–reveal tally',
          allocationRule:
            'Ranked greedy: proposals are ranked by votes (ties → earlier submission). Walking down the ranking, each proposal that met the quorum and fits in the remaining pool receives its full request.',
          origin: 'you',
        },
        {
          fundingPool: BigInt(Math.max(0, Math.floor(f.pool))),
          submissionEnd: BigInt(vs),
          votingStart: BigInt(vs),
          votingEnd: BigInt(fromLocal(f.votingEnd)),
          revealEnd: BigInt(fromLocal(f.revealEnd)),
          quorum: BigInt(Math.max(0, Math.floor(f.quorum))),
        },
        newSecretKey(),
        now,
      );
      store.toast(true, 'Grant round deployed', 'You are the admin. Enrol members and invite proposals.');
      // Members generate their own secrets on their (simulated) devices.
      const rnd = seededBytes(id);
      for (let i = 0; i < f.voters; i++) {
        const sk = rnd(32);
        if (await store.enrol(r, r.you.adminSk!, voterKey(sk), 'you', true)) r.members.push({ label: `Member ${i + 1}`, sk, cast: false, revealed: false });
      }
      await store.joinAsVoter(r);
      nav(`/rounds/${id}`);
    } catch (err) {
      setError(assertMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page className="max-w-3xl py-8 sm:py-10">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg">New round</div>
      <h1 className="mt-3 font-display text-[30px] leading-[1.1] sm:text-[40px]">Create a grant round</h1>
      <p className="mt-3 text-sm text-muted">
        Deploys a new instance of the PRIVEIL contract. Funding pool, deadlines and quorum become sealed ledger fields that no one — including you — can change later.
      </p>
      <Card className="mt-8 p-6">
        <form onSubmit={submit} className="space-y-5">
          <Field label="Round name">
            <input className={inputCls} value={f.name} onChange={set('name')} required />
          </Field>
          <Field label="Description">
            <textarea className={inputCls} rows={3} value={f.description} onChange={set('description')} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Funding pool" hint="USD">
              <input type="number" className={inputCls} value={f.pool} onChange={set('pool')} />
            </Field>
            <Field label="Quorum" hint="min votes to fund">
              <input type="number" className={inputCls} value={f.quorum} onChange={set('quorum')} />
            </Field>
            <Field label="Eligible voters" hint="simulated members">
              <input type="number" min={0} max={60} className={inputCls} value={f.voters} onChange={set('voters')} />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Voting opens" hint="proposals close">
              <input type="datetime-local" className={inputCls} value={f.votingStart} onChange={set('votingStart')} />
            </Field>
            <Field label="Voting closes">
              <input type="datetime-local" className={inputCls} value={f.votingEnd} onChange={set('votingEnd')} />
            </Field>
            <Field label="Reveal window ends">
              <input type="datetime-local" className={inputCls} value={f.revealEnd} onChange={set('revealEnd')} />
            </Field>
          </div>
          <div className="rounded-md border border-line bg-bg p-4 text-xs leading-relaxed text-muted">
            <div className="font-medium text-fg">Voting methodology</div>
            One member, one vote. Ballots are hidden commitments until voting closes, then opened and tallied.
            <div className="mt-3 font-medium text-fg">Allocation rule</div>
            Ranked greedy with quorum: proposals ranked by votes; each that met the quorum and fits in the remaining pool is fully funded.
          </div>
          {error && <div className="rounded-md border border-bad/30 bg-bad/5 px-4 py-3 font-mono text-xs text-bad">Constructor rejected: {error}</div>}
          <div className="flex items-center gap-3 border-t border-line pt-5">
            <Button type="submit" busy={busy}>
              Deploy round contract
            </Button>
            <span className="text-xs text-muted">Local Simulation deployment</span>
          </div>
        </form>
      </Card>
    </Page>
  );
}
