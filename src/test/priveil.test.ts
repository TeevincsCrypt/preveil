// PRIVEIL contract tests — run the compiled Compact contract in memory.
// SPDX-License-Identifier: Apache-2.0
//
// Every guard in priveil.compact has a test that triggers it. Results are
// checked against an independent TypeScript model of the allocation rule.

import { describe, expect, it } from 'vitest';
import { RoundSimulator } from '../../contract/simulator.js';
import { withChoice } from '../../contract/witnesses.js';
import {
  adminKey,
  ballotCommitment,
  ballotNullifier,
  ballotSalt,
  builderKey,
  canonicalRanking,
  expectedAllocations,
  newSecretKey,
  randomBytes,
  voterKey,
} from '../../contract/crypto.js';
import {
  DAY,
  REVEAL_END,
  ROUND_ID,
  SUBMISSION_END,
  T0,
  VOTING_END,
  VOTING_START,
  allocationsOf,
  cast,
  config,
  ps,
  rejection,
  requestsOf,
  reveal,
  setupRound,
  talliesOf,
} from './fixtures.js';

// ─── Grant rounds ───────────────────────────────────────────────────────────

describe('grant round creation', () => {
  it('creates a round with the configured rules and the deployer as admin', async () => {
    const adminSk = newSecretKey();
    const sim = await RoundSimulator.deploy(config(), ps(adminSk), T0);
    const l = sim.ledger();
    expect(l.adminPk).toEqual(adminKey(adminSk));
    expect(l.roundId).toEqual(ROUND_ID);
    expect(l.fundingPool).toBe(100_000n);
    expect(l.remainingBudget).toBe(100_000n);
    expect(l.votingStart).toBe(BigInt(VOTING_START));
    expect(l.votingEnd).toBe(BigInt(VOTING_END));
    expect(l.revealEnd).toBe(BigInt(REVEAL_END));
    expect(l.quorum).toBe(1n);
    expect(l.proposalCount).toBe(0n);
    expect(l.finalized).toBe(false);
  });

  it.each([
    ['zero round id', { roundId: new Uint8Array(32) }, 'Round id must be set'],
    ['empty funding pool', { fundingPool: 0n }, 'Funding pool must be positive'],
    ['submissions closing after voting opens', { submissionEnd: BigInt(VOTING_START + 1) }, 'Submissions must close before voting opens'],
    ['voting closing before it opens', { votingEnd: BigInt(VOTING_START) }, 'Voting must open before it closes'],
    ['reveal window ending before voting closes', { revealEnd: BigInt(VOTING_END) }, 'Reveal window must end after voting closes'],
    ['zero quorum', { quorum: 0n }, 'Quorum must be at least one vote'],
  ])('rejects a round with %s', async (_name, over, message) => {
    expect(await rejection(() => RoundSimulator.deploy(config(over), ps(newSecretKey()), T0))).toBe(message);
  });

  it('rejects voter enrolment by anyone but the round admin', async () => {
    const { sim } = await setupRound([10n], 0);
    sim.at(T0);
    const intruder = newSecretKey();
    expect(await rejection(() => sim.call('enrolVoter', ps(intruder), voterKey(intruder)))).toBe(
      'Only the round admin can do this',
    );
    expect(sim.ledger().enrolled).toBe(0n);
  });

  it('never changes the sealed round configuration during a full round', async () => {
    const { sim, voters } = await setupRound();
    const before = sim.ledger();
    await cast(sim, voters[0], 1);
    sim.at(VOTING_END);
    await reveal(sim, voters[0], 1);
    await sim.call('finalize', ps(newSecretKey()), canonicalRanking(talliesOf(sim)));
    const after = sim.ledger();
    for (const f of ['fundingPool', 'votingStart', 'votingEnd', 'revealEnd', 'quorum', 'submissionEnd'] as const)
      expect(after[f]).toBe(before[f]);
    expect(after.adminPk).toEqual(before.adminPk);
    expect(after.roundId).toEqual(before.roundId);
  });
});

// ─── Proposals ──────────────────────────────────────────────────────────────

describe('proposal submission', () => {
  it('accepts valid proposals, numbers them in order and records the builder key', async () => {
    const sim = await RoundSimulator.deploy(config(), ps(newSecretKey()), T0);
    const builder = newSecretKey();
    const hash = randomBytes(32);
    const { result, ledger } = await sim.call('submitProposal', ps(builder), hash, 25_000n);
    expect(result).toBe(0n);
    const p = ledger.proposals.lookup(0n);
    expect(p.metadataHash).toEqual(hash);
    expect(p.requested).toBe(25_000n);
    expect(p.builderPk).toEqual(builderKey(builder));
    expect(ledger.tallies.lookup(0n)).toBe(0n);
    const second = await sim.call('submitProposal', ps(newSecretKey()), randomBytes(32), 1n);
    expect(second.result).toBe(1n);
    expect(second.ledger.proposalCount).toBe(2n);
  });

  it('rejects invalid proposals', async () => {
    const sim = await RoundSimulator.deploy(config(), ps(newSecretKey()), T0);
    const b = ps(newSecretKey());
    expect(await rejection(() => sim.call('submitProposal', b, randomBytes(32), 0n))).toBe(
      'Requested amount must be positive',
    );
    expect(await rejection(() => sim.call('submitProposal', b, randomBytes(32), 100_001n))).toBe(
      'Requested amount exceeds the funding pool',
    );
    expect(await rejection(() => sim.call('submitProposal', b, new Uint8Array(32), 5n))).toBe(
      'Proposal metadata hash must be set',
    );
    const h = randomBytes(32);
    await sim.call('submitProposal', b, h, 5n);
    expect(await rejection(() => sim.call('submitProposal', b, h, 5n))).toBe('Proposal already submitted');
    expect(sim.ledger().proposalCount).toBe(1n);
  });

  it('caps a round at 8 proposals', async () => {
    const sim = await RoundSimulator.deploy(config(), ps(newSecretKey()), T0);
    for (let i = 0; i < 8; i++) await sim.call('submitProposal', ps(newSecretKey()), randomBytes(32), 1n);
    expect(await rejection(() => sim.call('submitProposal', ps(newSecretKey()), randomBytes(32), 1n))).toBe(
      'Round is full (8 proposals max)',
    );
  });

  it('rejects proposals after the submission deadline', async () => {
    const sim = await RoundSimulator.deploy(config(), ps(newSecretKey()), SUBMISSION_END - 1);
    await sim.call('submitProposal', ps(newSecretKey()), randomBytes(32), 1n);
    sim.at(SUBMISSION_END);
    expect(await rejection(() => sim.call('submitProposal', ps(newSecretKey()), randomBytes(32), 1n))).toBe(
      'Proposal submissions are closed',
    );
  });
});

// ─── Eligibility ────────────────────────────────────────────────────────────

describe('voter enrolment', () => {
  it('enrols voter keys into the eligibility tree', async () => {
    const { sim, voters } = await setupRound([1n], 3);
    const l = sim.ledger();
    expect(l.enrolled).toBe(3n);
    for (const v of voters) expect(l.voterKeys.member(voterKey(v))).toBe(true);
  });

  it('rejects duplicate and empty voter keys', async () => {
    const { sim, adminSk, voters } = await setupRound([1n], 1);
    sim.at(T0);
    expect(await rejection(() => sim.call('enrolVoter', ps(adminSk), voterKey(voters[0])))).toBe(
      'Voter already enrolled',
    );
    expect(await rejection(() => sim.call('enrolVoter', ps(adminSk), new Uint8Array(32)))).toBe(
      'Voter key must be set',
    );
  });

  it('freezes the voter list once voting opens', async () => {
    const { sim, adminSk } = await setupRound([1n], 1);
    expect(await rejection(() => sim.call('enrolVoter', ps(adminSk), voterKey(newSecretKey())))).toBe(
      'Enrolment closed when voting opened',
    );
  });
});

// ─── Voting ─────────────────────────────────────────────────────────────────

describe('private voting', () => {
  it('lets an eligible voter cast a hidden ballot under their nullifier', async () => {
    const { sim, voters } = await setupRound();
    const { ledger } = await cast(sim, voters[0], 2);
    expect(ledger.ballotsCast).toBe(1n);
    const n = ballotNullifier(voters[0], ROUND_ID, sim.address);
    expect(ledger.ballots.member(n)).toBe(true);
    expect(ledger.ballots.lookup(n)).toEqual(ballotCommitment(2, ballotSalt(voters[0], ROUND_ID, sim.address)));
    // Nothing is tallied while voting is open: there is no running result.
    expect(talliesOf(sim)).toEqual([0n, 0n, 0n]);
  });

  it('rejects a voter who is not enrolled', async () => {
    const { sim } = await setupRound();
    // An honest client can't even build a proof: there is no Merkle path.
    expect(await rejection(() => cast(sim, newSecretKey(), 0))).toMatch(/not enrolled/);
  });

  it('rejects a Merkle path that belongs to another voter', async () => {
    const { sim, voters } = await setupRound();
    const outsider = newSecretKey();
    const stolenPath = sim.ledger().voters.findPathForLeaf(voterKey(voters[0]))!;
    // A malicious client swaps in another voter's (public) path.
    const contract = sim.contract;
    const original = contract.witnesses.voterPath;
    contract.witnesses.voterPath = ({ privateState }) => [privateState, stolenPath];
    try {
      expect(await rejection(() => cast(sim, outsider, 0))).toBe('Merkle path is not for this voter');
    } finally {
      contract.witnesses.voterPath = original;
    }
  });

  it('rejects a valid-looking path from a different voter tree', async () => {
    const { sim } = await setupRound();
    // The attacker enrols themselves in a round they control and reuses that path.
    const attacker = newSecretKey();
    const other = await setupRound([1n], 0);
    other.sim.at(T0);
    await other.sim.call('enrolVoter', ps(other.adminSk), voterKey(attacker));
    const foreignPath = other.sim.ledger().voters.findPathForLeaf(voterKey(attacker))!;
    const original = sim.contract.witnesses.voterPath;
    sim.contract.witnesses.voterPath = ({ privateState }) => [privateState, foreignPath];
    try {
      expect(await rejection(() => cast(sim, attacker, 0))).toBe('Not an eligible voter');
    } finally {
      sim.contract.witnesses.voterPath = original;
    }
  });

  it('rejects a second ballot from the same voter, even for another proposal', async () => {
    const { sim, voters } = await setupRound();
    await cast(sim, voters[0], 0);
    expect(await rejection(() => cast(sim, voters[0], 0))).toBe('Already voted in this round');
    expect(await rejection(() => cast(sim, voters[0], 1))).toBe('Already voted in this round');
    expect(sim.ledger().ballotsCast).toBe(1n);
  });

  it('rejects ballots before voting opens and after it closes', async () => {
    const { sim, voters } = await setupRound();
    sim.at(VOTING_START - 1);
    expect(await rejection(() => cast(sim, voters[0], 0))).toBe('Voting has not opened yet');
    sim.at(VOTING_END);
    expect(await rejection(() => cast(sim, voters[0], 0))).toBe('Voting has closed');
    sim.at(VOTING_END - 1);
    await cast(sim, voters[0], 0); // the last second is still open
  });

  it('rejects a hidden ballot for a proposal that does not exist', async () => {
    const { sim, voters } = await setupRound([1n, 2n]);
    expect(await rejection(() => cast(sim, voters[0], 2))).toBe('Ballot is not for a valid proposal');
    expect(await rejection(() => cast(sim, voters[0], 200))).toBe('Ballot is not for a valid proposal');
  });

  it('rejects voting in a round with no proposals', async () => {
    const { sim, voters } = await setupRound([], 1);
    expect(await rejection(() => cast(sim, voters[0], 0))).toBe('No proposals to vote on');
  });
});

// ─── Reveal ─────────────────────────────────────────────────────────────────

describe('ballot reveal', () => {
  it('counts a correctly opened ballot', async () => {
    const { sim, voters } = await setupRound();
    await cast(sim, voters[0], 1);
    sim.at(VOTING_END);
    const { ledger } = await reveal(sim, voters[0], 1);
    expect(ledger.ballotsRevealed).toBe(1n);
    expect(talliesOf(sim)).toEqual([0n, 1n, 0n]);
  });

  it('lets a tally agent the voter handed the opening to reveal it', async () => {
    const { sim, voters } = await setupRound();
    await cast(sim, voters[0], 2);
    sim.at(VOTING_END);
    await reveal(sim, voters[0], 2, newSecretKey());
    expect(talliesOf(sim)).toEqual([0n, 0n, 1n]);
  });

  it('rejects reveals while voting is open and after the reveal window', async () => {
    const { sim, voters } = await setupRound();
    await cast(sim, voters[0], 1);
    expect(await rejection(() => reveal(sim, voters[0], 1))).toBe('Voting is still open');
    sim.at(REVEAL_END);
    expect(await rejection(() => reveal(sim, voters[0], 1))).toBe('Reveal window has ended');
  });

  it('rejects an opening for a different choice than the one committed', async () => {
    const { sim, voters } = await setupRound();
    await cast(sim, voters[0], 1);
    sim.at(VOTING_END);
    expect(await rejection(() => reveal(sim, voters[0], 0))).toBe('Opening does not match the ballot');
  });

  it('rejects an opening with the wrong salt', async () => {
    const { sim, voters } = await setupRound();
    await cast(sim, voters[0], 1);
    sim.at(VOTING_END);
    const n = ballotNullifier(voters[0], ROUND_ID, sim.address);
    expect(await rejection(() => sim.call('revealBallot', ps(voters[0]), n, 1n, randomBytes(32)))).toBe(
      'Opening does not match the ballot',
    );
  });

  it('rejects unknown ballots and double counting', async () => {
    const { sim, voters } = await setupRound();
    await cast(sim, voters[0], 1);
    sim.at(VOTING_END);
    expect(await rejection(() => reveal(sim, voters[1], 1))).toBe('No such ballot');
    await reveal(sim, voters[0], 1);
    expect(await rejection(() => reveal(sim, voters[0], 1))).toBe('Ballot already counted');
    expect(talliesOf(sim)).toEqual([0n, 1n, 0n]);
  });
});

// ─── Results and allocation ─────────────────────────────────────────────────

describe('final results', () => {
  /** Casts `choices[i]` for voter i, reveals all of them, returns the round. */
  async function runRound(requests: bigint[], choices: number[], over = {}, revealAll = true) {
    const r = await setupRound(requests, choices.length, over);
    for (let i = 0; i < choices.length; i++) await cast(r.sim, r.voters[i], choices[i]);
    r.sim.at(VOTING_END);
    if (revealAll) for (let i = 0; i < choices.length; i++) await reveal(r.sim, r.voters[i], choices[i]);
    return r;
  }

  it('computes tallies and allocations that match the published rule', async () => {
    // Pool 100k. Votes: P0=2, P1=3, P2=1. Ranking P1, P0, P2.
    // P1 (30k) funded, P0 (40k) funded, P2 (50k) doesn't fit in the 30k left.
    const { sim } = await runRound([40_000n, 30_000n, 50_000n], [1, 0, 1, 2, 0, 1]);
    expect(talliesOf(sim)).toEqual([2n, 3n, 1n]);
    const { ledger } = await sim.call('finalize', ps(newSecretKey()), canonicalRanking(talliesOf(sim)));
    expect(ledger.finalized).toBe(true);
    expect(ledger.ranking.slice(0, 3)).toEqual([1n, 0n, 2n]);
    expect(allocationsOf(sim)).toEqual([40_000n, 30_000n, 0n]);
    expect(ledger.totalAllocated).toBe(70_000n);
    expect(ledger.remainingBudget).toBe(30_000n);
  });

  it('skips a top proposal that does not fit and keeps funding lower ones', async () => {
    // P0 asks for 90k with most votes; P1 (60k) can't fit after; P2 (10k) can.
    const { sim } = await runRound([90_000n, 60_000n, 10_000n], [0, 0, 0, 1, 1, 2]);
    await sim.call('finalize', ps(newSecretKey()), canonicalRanking(talliesOf(sim)));
    expect(allocationsOf(sim)).toEqual([90_000n, 0n, 10_000n]);
  });

  it('does not fund proposals below the quorum', async () => {
    const { sim } = await runRound([10n, 10n, 10n], [0, 0, 0, 1, 1, 2], { quorum: 2n });
    await sim.call('finalize', ps(newSecretKey()), canonicalRanking(talliesOf(sim)));
    expect(allocationsOf(sim)).toEqual([10n, 10n, 0n]);
  });

  it('excludes ballots that were never revealed', async () => {
    const r = await runRound([10n, 10n], [0, 1, 1], {}, false);
    await reveal(r.sim, r.voters[0], 0); // voters 1 and 2 never reveal
    r.sim.at(REVEAL_END);
    const { ledger } = await r.sim.call('finalize', ps(newSecretKey()), canonicalRanking(talliesOf(r.sim)));
    expect(ledger.ballotsCast).toBe(3n);
    expect(ledger.ballotsRevealed).toBe(1n);
    expect(talliesOf(r.sim)).toEqual([1n, 0n]);
    // quorum 1: P1 had no counted votes, so it gets nothing
    expect(allocationsOf(r.sim)).toEqual([10n, 0n]);
  });

  it('only finalizes early when every cast ballot has been revealed', async () => {
    const r = await runRound([10n, 10n], [0, 1], {}, false);
    const rank = () => canonicalRanking(talliesOf(r.sim));
    expect(await rejection(() => r.sim.call('finalize', ps(newSecretKey()), rank()))).toBe(
      'Reveal window is still open',
    );
    await reveal(r.sim, r.voters[0], 0);
    await reveal(r.sim, r.voters[1], 1);
    await r.sim.call('finalize', ps(newSecretKey()), rank()); // early: all revealed
    expect(r.sim.ledger().finalized).toBe(true);
  });

  it('rejects finalizing while voting is open, and finalizing twice', async () => {
    const r = await setupRound([10n], 1);
    expect(await rejection(() => r.sim.call('finalize', ps(newSecretKey()), canonicalRanking([0n])))).toBe(
      'Voting is still open',
    );
    r.sim.at(REVEAL_END);
    await r.sim.call('finalize', ps(newSecretKey()), canonicalRanking([0n]));
    expect(await rejection(() => r.sim.call('finalize', ps(newSecretKey()), canonicalRanking([0n])))).toBe(
      'Round already finalized',
    );
  });

  it('accepts only the canonical ranking', async () => {
    // Votes: P0=1, P1=2, P2=1  → canonical [1, 0, 2] (tie P0/P2 → lower index first)
    const { sim } = await runRound([10n, 10n, 10n], [1, 1, 0, 2]);
    const bad = async (order: number[]) =>
      rejection(() => sim.call('finalize', ps(newSecretKey()), [...order, 0, 0, 0, 0, 0].map(BigInt)));
    expect(await bad([0, 1, 2])).toBe('Ranking is not sorted by votes');
    expect(await bad([1, 2, 0])).toBe('Ranking is not sorted by votes'); // wrong tie-break
    expect(await bad([1, 1, 0])).toBe('Ranking lists a proposal twice');
    expect(await bad([1, 0, 5])).toBe('Ranking names a proposal that does not exist');
    expect(canonicalRanking(talliesOf(sim)).slice(0, 3)).toEqual([1n, 0n, 2n]);
    await sim.call('finalize', ps(newSecretKey()), canonicalRanking(talliesOf(sim)));
  });

  it('matches an independent model of the allocation rule on random rounds', async () => {
    for (let trial = 0; trial < 6; trial++) {
      const nProps = 2 + (trial % 7);
      const requests = Array.from({ length: nProps }, (_, i) => BigInt(5_000 + ((i * 7919 + trial * 104729) % 45_000)));
      const choices = Array.from({ length: 9 }, (_, i) => (i * (trial + 3) + trial) % nProps);
      const quorum = BigInt(1 + (trial % 2));
      const { sim } = await runRound(requests, choices, { quorum });
      await sim.call('finalize', ps(newSecretKey()), canonicalRanking(talliesOf(sim)));
      expect(allocationsOf(sim)).toEqual(expectedAllocations(talliesOf(sim), requestsOf(sim), 100_000n, quorum));
      const total = allocationsOf(sim).reduce((a, b) => a + b, 0n);
      expect(total).toBeLessThanOrEqual(100_000n);
      expect(sim.ledger().totalAllocated).toBe(total);
    }
  });
});

// ─── Timing sanity ──────────────────────────────────────────────────────────

describe('round timeline', () => {
  it('runs a full round end to end across every phase', async () => {
    const { sim, voters } = await setupRound([20_000n, 20_000n], 4);
    for (const [i, v] of voters.entries()) await sim.at(VOTING_START + i * (DAY / 2)).call('castBallot', withChoice(ps(v), i % 2));
    sim.at(VOTING_END + DAY);
    for (const [i, v] of voters.entries()) await reveal(sim, v, i % 2);
    await sim.call('finalize', ps(newSecretKey()), canonicalRanking(talliesOf(sim)));
    expect(talliesOf(sim)).toEqual([2n, 2n]);
    expect(allocationsOf(sim)).toEqual([20_000n, 20_000n]);
  });
});
