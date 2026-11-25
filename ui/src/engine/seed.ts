// Seeds the Local Simulation with three demonstration grant rounds, one in
// each stage of the lifecycle. Every organisation, project and person here is
// fictional DEMO data. Each round is created by actually running the compiled
// contract: proposals are submitted, members enrolled, ballots cast, revealed
// and finalized through real circuit calls.

import { newSecretKey, toHex, voterKey } from '@contract/crypto';
import type { RoundEntry } from './types';
import { seededBytes } from './rng';
import { adminSecrets, store } from './store';
import type { Member, ProposalDoc, RoundMeta } from './types';

const DAY = 86_400;
const HOUR = 3_600;

const RULE =
  'Ranked greedy: proposals are ranked by votes (ties → earlier submission). Walking down the ranking, each proposal that met the quorum and fits in the remaining pool receives its full request.';
const METHOD = 'One member, one vote · hidden ballots · commit–reveal tally';

const link = (slug: string) => ({ github: `https://example.com/demo/${slug}`, website: `https://example.com/${slug}` });

const WAVE3: ProposalDoc[] = [
  {
    name: 'Compact Lint',
    tagline: 'Static analysis that catches accidental disclosure in Compact contracts.',
    description:
      'A linter and CI action for Compact that traces witness-derived values to ledger writes, flags un-salted commitments to guessable values, and warns when one secret is reused across roles.',
    category: 'Developer Tooling',
    requested: 28_000,
    ...link('compact-lint'),
    justification: 'Every privacy bug we have seen in review was a disclosure the author did not intend. Catching them at compile time protects every downstream user.',
    team: '2 engineers · prior compiler tooling work',
  },
  {
    name: 'Shielded Payroll',
    tagline: 'Confidential contributor payments for DAOs.',
    description:
      'Batch payroll for DAOs where amounts and recipients stay shielded, while the treasury can prove the total paid out matches the approved budget.',
    category: 'Payments',
    requested: 45_000,
    ...link('shielded-payroll'),
    justification: 'Public payroll exposes contributor income to anyone. DAOs need private payments with auditable totals.',
    team: '3 engineers · 1 designer',
  },
  {
    name: 'ZK Credential Kit',
    tagline: 'Reusable anonymous-credential circuits: age, residency, membership.',
    description:
      'A library of audited Compact modules for issuing and verifying anonymous credentials, with selective disclosure of single attributes.',
    category: 'Identity',
    requested: 32_000,
    ...link('zk-credential-kit'),
    justification: 'Credential checks are rebuilt from scratch in every app. A shared, reviewed kit removes a large class of mistakes.',
    team: '2 cryptographers · 1 engineer',
  },
  {
    name: 'Private Treasury Dashboard',
    tagline: 'Treasury reporting that proves solvency without exposing positions.',
    description: 'A dashboard that publishes verifiable treasury aggregates (runway, reserves ≥ obligations) while keeping individual holdings private.',
    category: 'Governance',
    requested: 18_000,
    ...link('private-treasury'),
    justification: 'Communities want accountability from treasuries without broadcasting every position to the market.',
    team: '1 engineer · 1 analyst',
  },
  {
    name: 'Testnet Explorer Lite',
    tagline: 'A lightweight explorer that explains what each transaction disclosed.',
    description: 'An explorer that decodes contract state and labels, field by field, what became public in each transaction — a privacy-first block explorer.',
    category: 'Infrastructure',
    requested: 24_000,
    ...link('explorer-lite'),
    justification: 'Builders and users cannot reason about privacy without seeing exactly what is on chain.',
    team: '2 engineers',
  },
  {
    name: 'Selective Disclosure for Grants',
    tagline: 'Let grantees prove milestones without publishing private data.',
    description: 'Milestone attestations for grant programs: a grantee proves a milestone was met (e.g. audited, shipped) and discloses only what the program requires.',
    category: 'Compliance',
    requested: 15_000,
    ...link('selective-grants'),
    justification: 'Grant reporting today forces builders to publish more than necessary. Programs only need proof.',
    team: '1 engineer · 1 product lead',
  },
];

const Q3: ProposalDoc[] = [
  { name: 'Proof Server Autoscaler', tagline: 'Elastic proof generation for DApp backends.', description: 'Kubernetes operator that scales proof servers by queue depth, with per-tenant isolation so proof inputs are never shared.', category: 'Infrastructure', requested: 30_000, ...link('proof-autoscaler'), justification: 'Proving latency is the main UX bottleneck for production DApps.', team: '2 engineers' },
  { name: 'Compact Playground', tagline: 'Compile and simulate Compact in the browser.', description: 'An in-browser editor that compiles Compact and runs circuits against a simulated ledger, with a disclosure inspector.', category: 'Developer Tooling', requested: 22_000, ...link('compact-playground'), justification: 'Lowers the barrier for new builders: no local toolchain needed to learn.', team: '2 engineers' },
  { name: 'Witness Fuzzer', tagline: 'Property-based fuzzing for witnesses and asserts.', description: 'Generates adversarial witness values to find circuits whose asserts can be bypassed.', category: 'Security', requested: 18_000, ...link('witness-fuzzer'), justification: 'Malicious clients control witnesses; contracts must be tested against them.', team: '1 security researcher' },
  { name: 'Shielded Token Templates', tagline: 'Audited templates for shielded tokens.', description: 'Reviewed templates for shielded fungible tokens with mint governance.', category: 'Developer Tooling', requested: 26_000, ...link('shielded-templates'), justification: 'Token contracts are the most copied code; they should be right.', team: '2 engineers' },
  { name: 'Mobile Prover Research', tagline: 'Feasibility study of on-device proving.', description: 'Benchmarks and prototypes for proving common circuits on mid-range phones.', category: 'Research', requested: 12_000, ...link('mobile-prover'), justification: 'Keeping witnesses on the user’s device is the strongest privacy model.', team: '1 researcher' },
];

const EDU: ProposalDoc[] = [
  { name: 'ZK for Journalists', tagline: 'Workshops on source protection with selective disclosure.', description: 'A six-session workshop series and toolkit for newsrooms.', category: 'Education', requested: 8_000, ...link('zk-journalists'), justification: 'Source protection is a direct, real-world privacy need.', team: '2 educators' },
  { name: 'Compact in 30 Days', tagline: 'Open video course for new Compact developers.', description: '30 short lessons from first contract to private voting, with exercises.', category: 'Education', requested: 9_500, ...link('compact-30'), justification: 'Developer onboarding is the ecosystem’s biggest multiplier.', team: '1 educator · 1 editor' },
  { name: 'Privacy Literacy Zines', tagline: 'Printed explainers for community organisers.', description: 'Illustrated guides on private voting and data minimisation for local organisers.', category: 'Community', requested: 4_000, ...link('privacy-zines'), justification: 'Reaches people outside crypto who most need privacy tools.', team: '1 illustrator · 1 writer' },
];

function members(seed: string, n: number, choices: number[]): Member[] {
  const rnd = seededBytes(seed);
  return Array.from({ length: n }, (_, i) => ({
    label: `Member ${String(i + 1).padStart(2, '0')}`,
    sk: rnd(32),
    choice: choices[i],
    cast: false,
    revealed: false,
  }));
}

function meta(name: string, description: string, sponsor: string): RoundMeta {
  return { name, description, sponsor, unit: 'USD', methodology: METHOD, allocationRule: RULE, origin: 'demo' };
}

/**
 * Your voter credential for a demo round: a fresh random secret generated on
 * this device (not seeded). Only its hash, voterKey(secret), goes to the admin.
 */
async function issueYourCredential(r: RoundEntry, adminSk: Uint8Array) {
  r.you.voterSk = newSecretKey();
  if (await store.enrol(r, adminSk, voterKey(r.you.voterSk), 'admin', true)) r.you.enrolled = true;
}

export async function seedDemo() {
  const now = Math.floor(Date.now() / 1000);

  // ── Round 1: voting open ──────────────────────────────────────────────────
  {
    const rnd = seededBytes('priveil-wave3');
    const adminSk = rnd(32);
    const id = 'privacy-builders-wave-3';
    adminSecrets.set(id, adminSk);
    const start = now - 2 * DAY + 5 * HOUR;
    const r = await store.createRound(
      id,
      meta(
        'Privacy Builders Fund · Wave 3',
        'Funding open-source builders shipping privacy infrastructure, tooling and applications. Members vote privately; the allocation is computed and verified by the round contract.',
        'Aurora Builders DAO (demo)',
      ),
      { fundingPool: 100_000n, submissionEnd: BigInt(start), votingStart: BigInt(start), votingEnd: BigInt(now + 3 * DAY + 2 * HOUR), revealEnd: BigInt(now + 5 * DAY), quorum: 2n },
      adminSk,
      start - 9 * DAY,
      toHex(rnd(32)),
    );
    for (const [i, doc] of WAVE3.entries()) await store.submitProposal(r, doc, rnd(32), i === 0 ? 'builder' : 'builder');
    // 23 community members; 14 have already voted. Choices live only on each member's device.
    r.members = members('wave3-members', 23, [0, 2, 0, 1, 2, 4, 0, 2, 5, 3, 0, 2, 1, 4, 0, 2, 3, 1, 0, 5, 2, 4, 1]);
    for (const m of r.members) await store.enrol(r, adminSk, voterKey(m.sk), 'admin', true);
    await issueYourCredential(r, adminSk);
    r.sim.at(start + 2 * HOUR);
    await store.membersVote(r, r.members.slice(0, 14));
    r.sim.at(now);
  }

  // ── Round 2: finalized ────────────────────────────────────────────────────
  {
    const rnd = seededBytes('priveil-q3');
    const adminSk = rnd(32);
    const id = 'zk-tooling-q3';
    adminSecrets.set(id, adminSk);
    const start = now - 40 * DAY;
    const r = await store.createRound(
      id,
      meta('ZK Tooling Grants · Q3', 'Quarterly grants for zero-knowledge developer tooling and security research.', 'Open Ledger Guild (demo)'),
      { fundingPool: 80_000n, submissionEnd: BigInt(start + 10 * DAY), votingStart: BigInt(start + 10 * DAY), votingEnd: BigInt(start + 17 * DAY), revealEnd: BigInt(start + 20 * DAY), quorum: 2n },
      adminSk,
      start,
      toHex(rnd(32)),
    );
    for (const doc of Q3) await store.submitProposal(r, doc, rnd(32));
    r.members = members('q3-members', 18, [1, 0, 2, 1, 0, 1, 3, 2, 1, 0, 4, 2, 1, 3, 0, 1, 2, 1]);
    for (const m of r.members) await store.enrol(r, adminSk, voterKey(m.sk), 'admin', true);
    r.sim.at(start + 12 * DAY);
    await store.membersVote(r, r.members);
    r.sim.at(start + 18 * DAY);
    // Two members never reveal: their ballots are excluded from the tally.
    for (const m of r.members.slice(0, 16)) if (await store.reveal(r, m.sk, m.choice!, 'member', true)) m.revealed = true;
    r.sim.at(start + 20 * DAY + HOUR);
    await store.finalize(r);
    r.sim.at(now);
  }

  // ── Round 3: accepting proposals ──────────────────────────────────────────
  {
    const rnd = seededBytes('priveil-edu');
    const adminSk = rnd(32);
    const id = 'privacy-education';
    adminSecrets.set(id, adminSk);
    const r = await store.createRound(
      id,
      meta('Privacy Education Microgrants', 'Small grants for workshops, courses and community material that teach practical privacy.', 'Civic Signal Fund (demo)'),
      { fundingPool: 25_000n, submissionEnd: BigInt(now + 4 * DAY), votingStart: BigInt(now + 4 * DAY), votingEnd: BigInt(now + 9 * DAY), revealEnd: BigInt(now + 11 * DAY), quorum: 1n },
      adminSk,
      now - 3 * DAY,
      toHex(rnd(32)),
    );
    for (const doc of EDU) await store.submitProposal(r, doc, rnd(32));
    r.members = members('edu-members', 10, [0, 1, 1, 2, 0, 1, 0, 1, 2, 1]);
    for (const m of r.members) await store.enrol(r, adminSk, voterKey(m.sk), 'admin', true);
    await issueYourCredential(r, adminSk);
    r.sim.at(now);
  }

  store.toasts = [];
  store.ready = true;
  store.emit();
}
