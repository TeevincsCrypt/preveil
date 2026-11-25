import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Ban,
  FilePlus2,
  Hexagon,
  Lock,
  Scan,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { Eyebrow, cx } from '@/components/ui';
import { fmt, store, useStore } from '@/engine/store';

/** Live numbers from the open demo round once the simulation has seeded. */
function useHeroRound() {
  useStore();
  const r = store.ready ? store.get('privacy-builders-wave-3') : undefined;
  const l = r?.sim.ledger();
  return {
    pool: l ? fmt(l.fundingPool) : '$100,000',
    ballots: l ? Number(l.ballotsCast) : 14,
    eligible: l ? Number(l.enrolled) : 24,
    address: r ? `0x${r.sim.address.slice(0, 4)}…${r.sim.address.slice(-4)}` : '0x7a3f…c91e',
  };
}

/** Thin framing line with angled steps, as in the reference. */
function StepLine({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1400 64" preserveAspectRatio="none" className={cx('pointer-events-none h-16 w-full', className)} aria-hidden>
      <path
        d="M0 56 H210 L246 14 H690 L726 56 H930 L966 14 H1400"
        fill="none"
        stroke="#111"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Device() {
  const h = useHeroRound();
  return (
    <div className="relative mx-auto w-full max-w-[560px] pb-10 lg:pb-0">
      <div className="relative ml-auto w-[min(360px,88vw)] overflow-hidden rounded-[12px] shadow-[0_40px_80px_-30px_rgba(17,17,17,0.45)]">
        <div className="device-gradient h-[300px] p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-raised/90 font-display text-[11px]">PB</div>
            <div className="min-w-0">
              <div className="text-sm font-medium">Privacy Builders Fund</div>
              <div className="font-mono text-[11px] text-fg/70">{h.address}</div>
            </div>
            <div className="ml-auto flex gap-3 text-ink-fg">
              <Scan className="size-4.5" />
              <Hexagon className="size-4.5" />
            </div>
          </div>
          <div className="mt-[92px]">
            <div className="font-display text-[46px] leading-none text-fg">{h.pool}</div>
            <div className="mt-3 flex items-center gap-1.5 text-xs font-medium">
              <TrendingUp className="size-3.5" /> {h.ballots} of {h.eligible} sealed ballots
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-px bg-line">
          {[
            { icon: Lock, label: 'Vote', to: '/rounds/privacy-builders-wave-3/vote' },
            { icon: BadgeCheck, label: 'Verify', to: '/rounds/zk-tooling-q3/results' },
            { icon: FilePlus2, label: 'Propose', to: '/rounds/privacy-education/submit' },
          ].map((t) => (
            <Link key={t.label} to={t.to} className="flex flex-col items-center gap-1.5 bg-raised py-5 text-xs font-medium hover:bg-surface">
              <t.icon className="size-4" />
              {t.label}
            </Link>
          ))}
        </div>
        <div className="bg-ink px-5 pt-3 pb-2 text-ink-fg">
          {[
            ['Cast a hidden ballot', 'Prove you’re eligible without revealing who you are'],
            ['Verify the outcome', 'Recompute every allocation from public data'],
          ].map(([t, d], i) => (
            <Link key={t} to={i === 0 ? '/rounds/privacy-builders-wave-3/vote' : '/rounds/zk-tooling-q3/results'} className={cx('group flex items-center gap-4 py-4', i === 0 && 'border-b border-ink-fg/25')}>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[19px]">{t}</div>
                <div className="mt-1 text-xs text-ink-fg/55">{d}</div>
              </div>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </div>

      <div className="float-in absolute bottom-0 left-0 w-[min(300px,80vw)] rounded-[8px] border border-ink-fg/10 bg-ink-2 p-4 text-ink-fg shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] sm:left-2 lg:-left-6 lg:bottom-[150px]">
        <div className="flex items-center justify-between">
          <span className="font-display text-[17px] text-ink-fg/55">Sealed ballot</span>
          <span className="flex items-center gap-1.5 rounded-[3px] bg-ink-fg/10 px-2 py-1 text-[10px]">
            <Lock className="size-3" /> ZK
          </span>
        </div>
        <div className="mt-3 flex justify-between text-[11px] text-ink-fg/55">
          <span>commitment</span>
          <span className="font-mono">0x9c04…7b12</span>
        </div>
        <div className="mt-1.5 h-px bg-ink-fg/30" />
        <div className="mt-1.5 flex justify-between text-[11px] text-ink-fg/55">
          <span>your choice</span>
          <span>hidden until voting closes</span>
        </div>
        <div className="mt-4 flex items-center gap-1.5">
          {['#0', '#1', '#2', '#3'].map((p, i) => (
            <span key={p} className={cx('flex size-6 items-center justify-center rounded-[3px] font-mono text-[10px]', i === 2 ? 'bg-flame text-ink' : 'bg-ink-fg/12 text-ink-fg/70')}>
              {p}
            </span>
          ))}
          <Link to="/rounds/privacy-builders-wave-3/vote" className="ml-auto rounded-[3px] bg-ink-fg px-3 py-1.5 text-[11px] font-medium text-ink hover:bg-white">
            Cast ballot
          </Link>
        </div>
      </div>
    </div>
  );
}

const problems = [
  ['Public votes invite pressure', 'When every ballot is tied to a wallet, members vote for what is safe, not what is best, and face retaliation from builders, whales and peers.'],
  ['Allocation is easy to game', 'Duplicate wallets, leaked running tallies and bandwagon voting distort results. A live count is an invitation to coordinate.'],
  ['Proof shouldn’t cost privacy', 'Programs must show funds followed the rules. Today that means publishing every individual decision, permanently.'],
];

const steps = [
  ['Create a round', 'Pool, deadlines, quorum and the allocation rule are sealed in the round contract at deployment.'],
  ['Builders submit', 'A hash of each proposal document and its funding request go on chain. The document is verifiable against it.'],
  ['Members get credentials', 'Each member generates a secret on their own device. The admin enrols only its hash into a Merkle tree.'],
  ['Cast hidden ballots', 'A zero-knowledge proof shows the voter is enrolled, hasn’t voted and chose a real proposal. Only a nullifier and a sealed commitment are published.'],
  ['Reveal and tally', 'After voting closes, ballots are opened under anonymous nullifiers and checked against their commitments.'],
  ['Verified allocation', 'Anyone submits the ranking. The contract accepts only the one correct ordering and computes every allocation itself.'],
];

export function Landing() {
  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative">
        <div className="mx-auto grid max-w-[1400px] items-center gap-14 px-4 pt-14 pb-6 sm:px-8 lg:min-h-[calc(100vh-110px)] lg:grid-cols-[1.08fr_1fr] lg:pt-6">
          <div>
            <Eyebrow className="rise">Private votes · public outcomes</Eyebrow>
            <h1 className="rise font-display mt-7 text-[44px] leading-[1.02] sm:text-[68px] xl:text-[84px]">
              Fund builders. Protect voters.
            </h1>
            <p className="rise mt-7 max-w-xl text-lg leading-relaxed text-fg/80">
              Your vote should be private. Your funding should be transparent. PRIVEIL helps communities allocate grants with privacy-preserving voting and verifiable outcomes, powered by Midnight.
            </p>
            <div className="rise mt-10 flex flex-wrap items-center gap-6">
              <Link to="/rounds" className="inline-flex items-center gap-2.5 rounded-[3px] bg-ink px-5 py-3.5 text-sm font-medium text-ink-fg hover:bg-black">
                <span className="size-1.5 rounded-full bg-flame" /> Explore Grant Rounds
              </Link>
              <Link to="/privacy" className="inline-flex items-center gap-1.5 text-sm font-medium underline decoration-fg/30 underline-offset-[6px] hover:decoration-fg">
                How Privacy Works <ArrowUpRight className="size-4" />
              </Link>
            </div>
          </div>
          <Device />
        </div>
        <StepLine />
      </section>

      {/* ── Problem ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1400px] px-4 py-24 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <Eyebrow>The problem</Eyebrow>
            <h2 className="font-display mt-6 text-[30px] leading-[1.1] sm:text-[42px]">Grant voting forces a bad trade-off.</h2>
          </div>
          <p className="self-end text-lg leading-relaxed text-fg/75">
            Public governance made funding auditable, and made every voter’s decision permanent, public and attributable. Communities shouldn’t have to choose between accountability and the freedom to vote honestly.
          </p>
        </div>
        <div className="mt-16 grid border-t border-fg/70 md:grid-cols-3">
          {problems.map(([t, b], i) => (
            <div key={t} className={cx('py-8 md:px-8', i > 0 && 'border-t border-line md:border-t-0 md:border-l', i === 0 && 'md:pl-0')}>
              <div className="font-display text-[44px] leading-none text-flame">0{i + 1}</div>
              <h3 className="mt-8 text-xl font-medium">{t}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works (ink panel) ─────────────────────────── */}
      <section className="bg-ink text-ink-fg">
        <div className="mx-auto max-w-[1400px] px-4 py-24 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
            <div>
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
                <span className="size-1.5 rounded-full bg-flame" /> How it works
              </div>
              <h2 className="font-display mt-6 text-[30px] leading-[1.1] sm:text-[42px]">One contract per round enforces every rule.</h2>
              <p className="mt-6 max-w-md text-[15px] leading-relaxed text-ink-fg/60">Six steps, each checked by the PRIVEIL Compact contract and verifiable by anyone.</p>
              <Link to="/rounds/privacy-builders-wave-3" className="mt-10 inline-flex items-center gap-2.5 rounded-[3px] bg-ink-fg px-5 py-3.5 text-sm font-medium text-ink hover:bg-white">
                <span className="size-1.5 rounded-full bg-flame" /> See an open round
              </Link>
            </div>
            <ol className="border-t border-ink-fg/30">
              {steps.map(([t, d], i) => (
                <li key={t} className="grid grid-cols-[3rem_1fr] gap-4 border-b border-ink-fg/15 py-6 sm:grid-cols-[4rem_14rem_1fr] sm:gap-6">
                  <span className="font-mono text-sm text-flame">0{i + 1}</span>
                  <span className="font-display text-[19px]">{t}</span>
                  <span className="col-start-2 text-[15px] leading-relaxed text-ink-fg/60 sm:col-start-3">{d}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── Privacy split ────────────────────────────────────── */}
      <section className="mx-auto max-w-[1400px] px-4 py-24 sm:px-8">
        <div className="max-w-2xl">
          <Eyebrow>The privacy boundary</Eyebrow>
          <h2 className="font-display mt-6 text-[30px] leading-[1.1] sm:text-[42px]">What stays with you. What the world can check.</h2>
        </div>
        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          <div className="overflow-hidden rounded-[12px]">
            <div className="device-gradient px-7 pt-7 pb-24">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">On your device</span>
                <span className="rounded-[3px] bg-raised/80 px-2.5 py-1 text-[11px] font-medium">Private</span>
              </div>
              <div className="font-display mt-14 text-[30px] leading-tight">Never leaves your browser.</div>
            </div>
            <dl className="divide-y divide-line bg-raised px-7 font-mono text-[13px]">
              {[
                ['secret key', '0x••••••••••••••••'],
                ['your choice', 'Proposal #2 · ZK Credential Kit'],
                ['ballot salt', '0x••••••••••••••••'],
                ['merkle path', '10 siblings'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-3.5">
                  <dt className="text-private">{k}</dt>
                  <dd className="truncate">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="overflow-hidden rounded-[12px] bg-ink text-ink-fg">
            <div className="px-7 pt-7 pb-24">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">On the Midnight ledger</span>
                <span className="rounded-[3px] bg-ink-fg/10 px-2.5 py-1 text-[11px] font-medium">Public</span>
              </div>
              <div className="font-display mt-14 text-[30px] leading-tight">Enough to verify. Not enough to identify.</div>
            </div>
            <dl className="divide-y divide-ink-fg/12 border-t border-ink-fg/12 px-7 font-mono text-[13px]">
              {[
                ['nullifier', '0x3fa91c…e0a1'],
                ['commitment', '0x9c04d2…7b12'],
                ['eligibility root', '0x1d7e40…c9f3'],
                ['tally', 'sealed until voting closes'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-3.5">
                  <dt className="text-[#7fc4c1]">{k}</dt>
                  <dd className="truncate text-ink-fg/85">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-muted">
          A zero-knowledge proof connects the two: it shows you are an eligible member, that this is your first ballot, and that you chose a real proposal, without revealing which member you are or what you chose.
        </p>
      </section>

      {/* ── Why Midnight ─────────────────────────────────────── */}
      <section className="border-y border-fg/70">
        <div className="mx-auto grid max-w-[1400px] px-4 sm:px-8 lg:grid-cols-[1fr_2fr]">
          <div className="py-16 lg:border-r lg:border-fg/70 lg:pr-12">
            <Eyebrow>Why Midnight</Eyebrow>
            <h2 className="font-display mt-6 text-[28px] leading-[1.12] sm:text-[36px]">Privacy enforced by the contract, not the frontend.</h2>
            <p className="mt-6 text-[15px] leading-relaxed text-muted">Hiding a vote in a UI protects nothing. PRIVEIL needs contracts that compute over private data and prove they did it correctly.</p>
          </div>
          <div className="grid sm:grid-cols-2">
            {[
              ['Dual-state contracts', 'Compact separates the public ledger from private witness data that never leaves the voter’s device.'],
              ['Zero-knowledge circuits', 'Eligibility, uniqueness and ballot validity are proven without revealing the voter or the vote.'],
              ['Explicit disclosure', 'Every value that crosses into public state is an explicit disclose(), so it can be reviewed and tested.'],
              ['Selective transparency', 'Outcomes, rules and allocations stay public and auditable. Individual decisions don’t.'],
            ].map(([t, b], i) => (
              <div key={t} className={cx('border-line py-10 sm:px-10', i % 2 === 1 && 'sm:border-l', i > 1 && 'border-t', i === 1 && 'border-t sm:border-t-0')}>
                <ShieldCheck className="size-5 text-private" />
                <h3 className="mt-5 text-lg font-medium">{t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Honest by design ─────────────────────────────────── */}
      <section className="mx-auto max-w-[1400px] px-4 py-24 sm:px-8">
        <div className="max-w-2xl">
          <Eyebrow>Honest by design</Eyebrow>
          <h2 className="font-display mt-6 text-[30px] leading-[1.1] sm:text-[42px]">Exactly what is protected, and what isn’t yet.</h2>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-2">
          <div className="rounded-[12px] bg-raised p-8">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="size-4 text-ok" /> Guaranteed by the contract, and tested
            </div>
            <ul className="mt-6 divide-y divide-line text-[15px]">
              {[
                'Nobody can tell which enrolled member cast which ballot.',
                'Ballot choices are sealed while voting is open. There is no running tally.',
                'One ballot per member per round, enforced by nullifiers.',
                'Only enrolled members can vote, and only for real proposals.',
                'The allocation follows the published rule, because the contract computes it.',
              ].map((x) => (
                <li key={x} className="py-3">{x}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-[12px] border border-line-strong p-8">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Ban className="size-4 text-warn" /> Known limitations of this MVP
            </div>
            <ul className="mt-6 divide-y divide-line text-[15px] text-muted">
              {[
                'After voting closes, each opened choice is public under its anonymous nullifier.',
                'Ballots that are never revealed are not counted.',
                'Network metadata (fee payment, IP, timing) can link a transaction to a person.',
                'The admin is trusted to enrol the agreed member list.',
                'Allocations are recorded, not paid out, in this version.',
              ].map((x) => (
                <li key={x} className="py-3">{x}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="flame-band text-ink-fg">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-10 px-4 py-24 sm:px-8 lg:flex-row lg:items-end">
          <h2 className="font-display max-w-3xl text-[34px] leading-[1.05] sm:text-[56px]">Try voting. Then try voting twice.</h2>
          <div className="flex flex-col gap-4 lg:ml-auto lg:items-end">
            <p className="max-w-sm text-[15px] text-ink-fg/70 lg:text-right">The open demo round runs the compiled PRIVEIL contract in your browser. Watch it reject a second ballot.</p>
            <Link to="/rounds/privacy-builders-wave-3/vote" className="inline-flex w-fit items-center gap-2.5 rounded-[3px] bg-ink-fg px-5 py-3.5 text-sm font-medium text-ink hover:bg-white">
              <span className="size-1.5 rounded-full bg-flame" /> Explore Grant Rounds
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
