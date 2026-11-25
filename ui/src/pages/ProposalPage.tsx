import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ExternalLink, Lock, XCircle } from 'lucide-react';
import { builderKey, hashMetadata, toHex } from '@contract/crypto';
import { Page } from '@/components/Layout';
import { Badge, Card, Hash, KV, PublicTag } from '@/components/ui';
import { fmt, phaseOf, store, useStore } from '@/engine/store';

export function ProposalPage() {
  useStore();
  const { id = '', pid = '0' } = useParams();
  const r = store.get(id);
  const i = Number(pid);
  const [hashOk, setHashOk] = useState<boolean | null>(null);
  const doc = r?.docs[i];
  const l = r?.sim.ledger();
  const p = l && i < Number(l.proposalCount) ? l.proposals.lookup(BigInt(i)) : undefined;

  useEffect(() => {
    if (!doc || !p) return;
    void hashMetadata(doc).then((h) => setHashOk(toHex(h) === toHex(p.metadataHash)));
  }, [doc, p]);

  if (!r || !l || !p || !doc)
    return (
      <Page>
        <p className="text-muted">Proposal not found.</p>
      </Page>
    );
  const phase = phaseOf(l, r.sim.time);
  const yours = r.you.builderSks[i];

  return (
    <Page className="py-8 sm:py-10">
      <Link to={`/rounds/${r.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> {r.meta.name}
      </Link>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-faint">Proposal #{i}</span>
            <Badge>{doc.category}</Badge>
            {yours && <Badge tone="private">Submitted by you</Badge>}
            {l.finalized && (l.allocations.lookup(BigInt(i)) > 0n ? <Badge tone="ok">Funded {fmt(l.allocations.lookup(BigInt(i)), r.meta.unit)}</Badge> : <Badge>Not funded</Badge>)}
          </div>
          <h1 className="mt-4 font-display text-[30px] leading-[1.1] sm:text-[40px]">{doc.name}</h1>
          <p className="mt-3 text-lg text-muted">{doc.tagline}</p>
          <div className="mt-10 space-y-8 text-[15px] leading-relaxed">
            <section>
              <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-faint">What we’re building</h2>
              <p className="mt-3 text-fg/90">{doc.description}</p>
            </section>
            <section>
              <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-faint">Why it should be funded</h2>
              <p className="mt-3 text-fg/90">{doc.justification}</p>
            </section>
            <section>
              <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-faint">Team</h2>
              <p className="mt-3 text-fg/90">{doc.team}</p>
            </section>
            <div className="flex flex-wrap gap-3">
              {[doc.github && ['Repository', doc.github], doc.website && ['Website / demo', doc.website]].filter(Boolean).map((x) => {
                const [label, href] = x as string[];
                return (
                  <a key={label} href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3.5 py-2 text-sm text-muted hover:text-fg">
                    {label} <ExternalLink className="size-3.5" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="text-xs uppercase tracking-[0.14em] text-faint">Requested</div>
            <div className="mt-2 text-3xl font-medium tabular-nums">{fmt(p.requested, r.meta.unit)}</div>
            <div className="mt-1 text-xs text-muted">{((Number(p.requested) / Number(l.fundingPool)) * 100).toFixed(0)}% of the pool</div>
            <div className="mt-5 border-t border-line pt-4 text-sm">
              {phase === 'submission' || phase === 'voting' ? (
                <span className="inline-flex items-center gap-1.5 text-private">
                  <Lock className="size-3.5" /> Votes are sealed until voting closes
                </span>
              ) : (
                <span>{String(l.tallies.lookup(BigInt(i)))} votes counted</span>
              )}
            </div>
            {phase === 'voting' && (
              <Link to={`/rounds/${r.id}/vote`} className="mt-4 block rounded-md bg-ink px-4 py-2.5 text-center text-sm font-medium text-ink-fg hover:bg-black">
                Vote privately
              </Link>
            )}
          </Card>
          <Card tone="public" className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">On-chain record</span>
              <PublicTag />
            </div>
            <div className="mt-3 divide-y divide-line">
              <KV k="metadataHash">
                <Hash value={p.metadataHash} n={8} />
              </KV>
              <KV k="builderPk">
                <Hash value={p.builderPk} n={8} />
              </KV>
              <KV k="requested">{fmt(p.requested, r.meta.unit)}</KV>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-md bg-bg p-3 text-xs">
              {hashOk ? <CheckCircle2 className="size-4 shrink-0 text-ok" /> : <XCircle className="size-4 shrink-0 text-faint" />}
              <span className="text-muted">
                {hashOk === null ? 'Checking…' : hashOk ? 'This document hashes (SHA-256, canonical JSON) to the on-chain metadataHash — it hasn’t been edited since submission.' : 'Document does not match the on-chain hash.'}
              </span>
            </div>
            {yours && (
              <div className="mt-3 rounded-md bg-private-dim p-3 text-xs text-private">
                builderPk = H(“priveil:builder”, your secret) — you can prove ownership later. ✓ {toHex(builderKey(yours)) === toHex(p.builderPk) ? 'matches' : 'mismatch'}
              </div>
            )}
          </Card>
        </div>
      </div>
    </Page>
  );
}
