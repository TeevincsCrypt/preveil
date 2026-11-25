import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  Eye,
  FileCheck2,
  Fingerprint,
  KeyRound,
  Layers,
  Lock,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
  Vote,
} from 'lucide-react';
import { Card, PrivateTag, PublicTag, SectionHeader } from '@/components/ui';

function DualLedger() {
  return (
    <div className="relative mx-auto mt-16 grid max-w-5xl gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
      <Card tone="private" className="p-5 text-left">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">On your device</span>
          <PrivateTag />
        </div>
        <dl className="mt-4 space-y-2.5 font-mono text-[12.5px]">
          <Row k="secret key" v="0x••••••••••••••••" tone="private" />
          <Row k="your choice" v="Proposal #2 · ZK Credential Kit" tone="private" />
          <Row k="ballot salt" v="0x••••••••••••••••" tone="private" />
          <Row k="merkle path" v="10 siblings" tone="private" />
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-muted">Never leaves the browser. Used only as private inputs to the circuit.</p>
      </Card>

      <div className="flex flex-col items-center justify-center gap-2 px-2 py-2 text-center">
        <div className="hidden h-px w-14 bg-gradient-to-r from-private/60 to-public/60 md:block" />
        <div className="rounded-xl border border-line-strong bg-raised px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.16em] text-faint">ZK proof</div>
          <div className="mt-1 text-xs leading-relaxed text-fg">
            eligible voter
            <br />
            first ballot
            <br />
            valid choice
          </div>
        </div>
        <div className="hidden h-px w-14 bg-gradient-to-r from-private/60 to-public/60 md:block" />
      </div>

      <Card tone="public" className="p-5 text-left">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">On the Midnight ledger</span>
          <PublicTag />
        </div>
        <dl className="mt-4 space-y-2.5 font-mono text-[12.5px]">
          <Row k="nullifier" v="0x3fa91c…e0a1" tone="public" />
          <Row k="commitment" v="0x9c04d2…7b12" tone="public" />
          <Row k="eligibility root" v="0x1d7e40…c9f3" tone="public" />
          <Row k="tally" v="sealed until voting closes" tone="public" />
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-muted">Enough to prevent double voting and verify the result. Not enough to know who you are or what you chose.</p>
      </Card>
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone: 'private' | 'public' }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={tone === 'private' ? 'text-private/75' : 'text-public/75'}>{k}</dt>
      <dd className="truncate text-fg/90">{v}</dd>
    </div>
  );
}

const problems = [
  { icon: Eye, title: 'Public votes invite pressure', body: 'When every ballot is tied to a wallet, members vote for what is safe, not what is best — and face retaliation from builders, whales and peers.' },
  { icon: Scale, title: 'Allocation is easy to game', body: 'Duplicate wallets, early leaked tallies and bandwagon voting distort results. Watching a live count is an invitation to coordinate.' },
  { icon: Layers, title: 'Transparency shouldn’t cost privacy', body: 'Programs must prove funds were allocated by the rules. Today that means publishing every individual decision. It doesn’t have to.' },
];

const steps = [
  { icon: Sparkles, title: 'Create a round', body: 'An admin deploys a round contract: funding pool, deadlines, quorum and the allocation rule are sealed on chain.' },
  { icon: FileCheck2, title: 'Builders submit', body: 'Proposals are committed by hash with their funding request. The full document is published off chain and verifiable against it.' },
  { icon: KeyRound, title: 'Members get credentials', body: 'Each member generates a secret on their own device. The admin enrols only its hash into a Merkle tree of eligible voters.' },
  { icon: Vote, title: 'Cast hidden ballots', body: 'A ZK proof shows the voter is in the tree, hasn’t voted, and chose a valid proposal. Only a nullifier and a sealed commitment go on chain.' },
  { icon: Fingerprint, title: 'Reveal & tally', body: 'After voting closes, ballots are opened under their anonymous nullifiers. The contract checks each opening against its commitment.' },
  { icon: BadgeCheck, title: 'Verified allocation', body: 'Anyone submits the ranking; the contract verifies it is the one correct ordering and computes every allocation itself.' },
];

export function Landing() {
  return (
    <div>
      <section className="glow-top relative overflow-hidden">
        <div className="grid-fade pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-24 text-center sm:px-6 sm:pt-28">
          <div className="rise inline-flex items-center gap-2 rounded-full border border-line-strong bg-raised/60 px-3 py-1 text-xs text-muted">
            <ShieldCheck className="size-3.5 text-private" /> Privacy-preserving grant allocation on Midnight
          </div>
          <h1 className="rise mx-auto mt-7 max-w-4xl font-display text-5xl leading-[1.02] tracking-tight sm:text-7xl">
            Your vote should be <em className="text-private">private.</em>
            <br />
            Your funding should be <em className="text-public">transparent.</em>
          </h1>
          <p className="rise mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            PRIVEIL helps communities allocate grants with privacy-preserving voting and verifiable outcomes, powered by Midnight.
          </p>
          <div className="rise mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/rounds" className="inline-flex items-center gap-2 rounded-xl bg-fg px-5 py-3 text-sm font-medium text-bg hover:bg-white">
              Explore Grant Rounds <ArrowRight className="size-4" />
            </Link>
            <Link to="/privacy" className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-raised px-5 py-3 text-sm font-medium hover:border-white/25">
              How Privacy Works
            </Link>
          </div>
          <DualLedger />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <SectionHeader eyebrow="The problem" title="Grant voting today forces a bad trade-off.">
          Public governance made funding auditable — and made every voter’s decision permanent, public and attributable.
        </SectionHeader>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {problems.map((p) => (
            <Card key={p.title} className="p-6">
              <p.icon className="size-5 text-muted" />
              <h3 className="mt-5 text-lg font-medium">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-surface/50">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <SectionHeader eyebrow="How it works" title="Public outcomes. Private decisions.">
            One Compact contract per grant round enforces every rule. Six steps, each verifiable by anyone.
          </SectionHeader>
          <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="bg-surface p-6">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-faint">0{i + 1}</span>
                  <s.icon className="size-4 text-private" />
                </div>
                <h3 className="mt-4 font-medium">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <SectionHeader eyebrow="Why Midnight" title="Privacy has to be enforced by the contract, not the frontend.">
            Hiding a vote in a UI protects nothing. PRIVEIL needs a chain where contracts can compute over private data and prove they did it correctly.
          </SectionHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Layers, t: 'Dual-state contracts', b: 'Compact separates the public ledger from private witness data that never leaves the voter’s device.' },
              { icon: ShieldCheck, t: 'Zero-knowledge circuits', b: 'Eligibility, uniqueness and ballot validity are proven without revealing the voter or the vote.' },
              { icon: Lock, t: 'Explicit disclosure', b: 'Compact makes every value that crosses into public state an explicit disclose() — reviewable and testable.' },
              { icon: Users, t: 'Selective transparency', b: 'Outcomes, rules and allocations stay public and auditable. Individual decisions don’t.' },
            ].map((x) => (
              <Card key={x.t} className="p-5">
                <x.icon className="size-4.5 text-public" />
                <h3 className="mt-4 text-sm font-medium">{x.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{x.b}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-surface/50">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <SectionHeader eyebrow="Honest by design" title="Exactly what is protected — and what isn’t yet.">
            Privacy claims should be precise. These are enforced by the contract and checked by the test suite against the decoded public ledger.
          </SectionHeader>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            <Card tone="private" className="p-6">
              <div className="flex items-center gap-2 text-sm font-medium text-private">
                <ShieldCheck className="size-4" /> Guaranteed by the contract
              </div>
              <ul className="mt-4 space-y-2.5 text-sm text-fg/90">
                <li>· Nobody can tell which enrolled member cast which ballot.</li>
                <li>· Ballot choices are sealed while voting is open — no running tally.</li>
                <li>· One ballot per member per round (nullifiers).</li>
                <li>· Only enrolled members can vote; only real proposals can be chosen.</li>
                <li>· The allocation follows the published rule — the contract computes it.</li>
              </ul>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-2 text-sm font-medium text-warn">
                <Ban className="size-4" /> Known limitations (MVP)
              </div>
              <ul className="mt-4 space-y-2.5 text-sm text-muted">
                <li>· After voting closes, each opened choice is public under its anonymous nullifier.</li>
                <li>· Ballots that are never revealed are not counted.</li>
                <li>· Network metadata (fee payment, IP, timing) can link a transaction to a person.</li>
                <li>· The admin is trusted to enrol the agreed member list (the roster is public).</li>
                <li>· Payouts are recorded, not transferred, in this version.</li>
              </ul>
            </Card>
          </div>
          <div className="mt-14 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Link to="/rounds" className="inline-flex items-center gap-2 rounded-xl bg-fg px-5 py-3 text-sm font-medium text-bg hover:bg-white">
              Explore Grant Rounds <ArrowRight className="size-4" />
            </Link>
            <span className="text-sm text-muted">Try voting in the open round — then try voting twice.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
