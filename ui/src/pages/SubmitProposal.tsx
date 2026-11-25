import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { newSecretKey } from '@contract/crypto';
import { Page } from '@/components/Layout';
import { Button, Card, Field, inputCls } from '@/components/ui';
import { fmt, phaseOf, store, useStore } from '@/engine/store';
import type { ProposalDoc } from '@/engine/types';

const CATEGORIES = ['Developer Tooling', 'Infrastructure', 'Identity', 'Payments', 'Governance', 'Compliance', 'Education', 'Research', 'Community', 'Security'];

export function SubmitProposal() {
  useStore();
  const { id = '' } = useParams();
  const nav = useNavigate();
  const r = store.get(id);
  const [doc, setDoc] = useState<ProposalDoc>({ name: '', tagline: '', description: '', category: CATEGORIES[0], requested: 10_000, github: '', website: '', justification: '', team: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  if (!r) return <Page>Round not found.</Page>;
  const l = r.sim.ledger();
  const set = (k: keyof ProposalDoc) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setDoc({ ...doc, [k]: k === 'requested' ? Number(e.target.value) : e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (doc.name.trim().length < 3) v.name = 'Give the project a name.';
    if (doc.description.trim().length < 20) v.description = 'Describe the project (20+ characters).';
    if (doc.justification.trim().length < 10) v.justification = 'Explain why it should be funded.';
    if (doc.github && !/^https?:\/\//.test(doc.github)) v.github = 'Use a full URL.';
    if (doc.website && !/^https?:\/\//.test(doc.website)) v.website = 'Use a full URL.';
    setErr(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    // The amount and deadline are NOT pre-checked here: the contract enforces them.
    const pid = await store.submitProposal(r, { ...doc, tagline: doc.tagline || doc.description.slice(0, 90) }, newSecretKey(), 'you');
    setBusy(false);
    if (pid !== null) {
      store.toast(true, `Proposal #${pid} submitted`, 'Its hash and funding request are now on the round ledger.');
      nav(`/rounds/${r.id}/p/${pid}`);
    }
  };

  return (
    <Page className="max-w-3xl py-8 sm:py-10">
      <Link to={`/rounds/${r.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> {r.meta.name}
      </Link>
      <h1 className="mt-6 font-display text-[30px] leading-[1.1] sm:text-[40px]">Submit a proposal</h1>
      <p className="mt-3 text-sm text-muted">
        The document stays off chain; its SHA-256 hash, your funding request and a pseudonymous builder key go on chain. Pool: {fmt(l.fundingPool, r.meta.unit)}.{' '}
        {phaseOf(l, r.sim.time) !== 'submission' && <span className="text-warn">Submissions for this round are closed — the contract will reject it.</span>}
      </p>
      <Card className="mt-8 p-6">
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Project name" error={err.name}>
              <input className={inputCls} value={doc.name} onChange={set('name')} placeholder="e.g. Compact Lint" />
            </Field>
            <Field label="Category">
              <select className={inputCls} value={doc.category} onChange={set('category')}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="One-line summary" hint="optional">
            <input className={inputCls} value={doc.tagline} onChange={set('tagline')} placeholder="What it does, in one sentence" />
          </Field>
          <Field label="Description" error={err.description}>
            <textarea className={inputCls} rows={4} value={doc.description} onChange={set('description')} />
          </Field>
          <Field label="Requested funding" hint={r.meta.unit} error={err.requested}>
            <input type="number" className={inputCls} value={doc.requested} onChange={set('requested')} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="GitHub repository" error={err.github}>
              <input className={inputCls} value={doc.github} onChange={set('github')} placeholder="https://github.com/…" />
            </Field>
            <Field label="Website or demo" error={err.website}>
              <input className={inputCls} value={doc.website} onChange={set('website')} placeholder="https://…" />
            </Field>
          </div>
          <Field label="Funding justification" error={err.justification}>
            <textarea className={inputCls} rows={3} value={doc.justification} onChange={set('justification')} />
          </Field>
          <Field label="Team" hint="optional">
            <input className={inputCls} value={doc.team} onChange={set('team')} />
          </Field>
          <div className="flex items-center gap-3 border-t border-line pt-5">
            <Button type="submit" busy={busy}>
              Submit to round contract
            </Button>
            <span className="text-xs text-muted">Calls submitProposal(metadataHash, requested)</span>
          </div>
        </form>
      </Card>
    </Page>
  );
}
