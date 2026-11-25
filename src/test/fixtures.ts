// Shared fixtures for the PRIVEIL contract tests.
// SPDX-License-Identifier: Apache-2.0

import { RoundSimulator, assertMessage, type RoundConfig } from '../../contract/simulator.js';
import { createPrivateState, withChoice, type PriveilPrivateState } from '../../contract/witnesses.js';
import { ballotOpening, newSecretKey, voterKey, randomBytes } from '../../contract/crypto.js';

export const DAY = 86_400;
export const T0 = 1_800_000_000;
export const SUBMISSION_END = T0 + 2 * DAY;
export const VOTING_START = T0 + 2 * DAY;
export const VOTING_END = T0 + 5 * DAY;
export const REVEAL_END = T0 + 7 * DAY;

export const ROUND_ID = Uint8Array.from({ length: 32 }, (_, i) => i + 1);

export const config = (over: Partial<RoundConfig> = {}): RoundConfig => ({
  roundId: ROUND_ID,
  fundingPool: 100_000n,
  submissionEnd: BigInt(SUBMISSION_END),
  votingStart: BigInt(VOTING_START),
  votingEnd: BigInt(VOTING_END),
  revealEnd: BigInt(REVEAL_END),
  quorum: 1n,
  ...over,
});

export const ps = (sk: Uint8Array, choice?: number): PriveilPrivateState => createPrivateState(sk, choice);

/** Runs `fn`, expects it to throw, and returns the contract's assert message. */
export async function rejection(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (e) {
    return assertMessage(e);
  }
  throw new Error('expected the call to be rejected, but it succeeded');
}

export type Round = {
  sim: RoundSimulator;
  adminSk: Uint8Array;
  builders: Uint8Array[];
  voters: Uint8Array[];
};

/**
 * A round with `requests.length` proposals (one builder each) and `nVoters`
 * enrolled voters, positioned at `VOTING_START` (voting open).
 */
export async function setupRound(
  requests: bigint[] = [40_000n, 30_000n, 50_000n],
  nVoters = 5,
  over: Partial<RoundConfig> = {},
): Promise<Round> {
  const adminSk = newSecretKey();
  const sim = await RoundSimulator.deploy(config(over), ps(adminSk), T0);
  const builders: Uint8Array[] = [];
  for (const req of requests) {
    const sk = newSecretKey();
    builders.push(sk);
    await sim.call('submitProposal', ps(sk), randomBytes(32), req);
  }
  const voters = Array.from({ length: nVoters }, () => newSecretKey());
  for (const v of voters) await sim.call('enrolVoter', ps(adminSk), voterKey(v));
  sim.at(VOTING_START);
  return { sim, adminSk, builders, voters };
}

export async function cast(sim: RoundSimulator, sk: Uint8Array, choice: number) {
  return sim.call('castBallot', withChoice(ps(sk), choice));
}

export async function reveal(sim: RoundSimulator, sk: Uint8Array, choice: number, caller: Uint8Array = sk) {
  const o = ballotOpening(sk, choice, sim.ledger().roundId, sim.address);
  return sim.call('revealBallot', ps(caller), o.nullifier, BigInt(o.choice), o.salt);
}

export const talliesOf = (sim: RoundSimulator): bigint[] => {
  const l = sim.ledger();
  return Array.from({ length: Number(l.proposalCount) }, (_, i) => l.tallies.lookup(BigInt(i)));
};

export const allocationsOf = (sim: RoundSimulator): bigint[] => {
  const l = sim.ledger();
  return Array.from({ length: Number(l.proposalCount) }, (_, i) => l.allocations.lookup(BigInt(i)));
};

export const requestsOf = (sim: RoundSimulator): bigint[] => {
  const l = sim.ledger();
  return Array.from({ length: Number(l.proposalCount) }, (_, i) => l.proposals.lookup(BigInt(i)).requested);
};
