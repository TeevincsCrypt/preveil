// PRIVEIL privacy tests — assertions over the decoded PUBLIC ledger.
// SPDX-License-Identifier: Apache-2.0
//
// Compiling and passing functional tests says nothing about privacy. These
// tests read back exactly what an indexer would show anyone, and check that
// the SPEC.md privacy invariants hold:
//
//   1. No participant secret key is ever on chain.
//   2. No ballot salt is ever on chain (not even after reveal).
//   3. Which enrolled voter cast which ballot is not on chain: nullifiers are
//      unrelated to the enrolled voter keys and can't be recomputed from
//      public data.
//   4. While voting is open the ballot choice is not on chain: commitments
//      can't be matched to a choice by brute force over public data, and the
//      public tally stays at zero.
//   5. A voter's nullifiers in two different rounds are unlinkable.

import { describe, expect, it } from 'vitest';
import { assertNotInPublicState, collectPublicBytes, findInPublicState } from '../../contract/privacy.js';
import { ballotCommitment, ballotNullifier, ballotSalt, toHex, voterKey } from '../../contract/crypto.js';
import { VOTING_END, cast, reveal, setupRound, talliesOf } from './fixtures.js';

describe('privacy invariants of the public ledger', () => {
  it('never publishes a secret key or a ballot salt, before or after reveal', async () => {
    const { sim, adminSk, builders, voters } = await setupRound([10n, 10n, 10n], 4);
    const choices = [0, 2, 2, 1];
    for (const [i, v] of voters.entries()) await cast(sim, v, choices[i]);

    const secrets = (): Record<string, Uint8Array> => ({
      adminSecretKey: adminSk,
      ...Object.fromEntries(builders.map((b, i) => [`builderSecretKey[${i}]`, b])),
      ...Object.fromEntries(voters.map((v, i) => [`voterSecretKey[${i}]`, v])),
      ...Object.fromEntries(voters.map((v, i) => [`ballotSalt[${i}]`, ballotSalt(v, sim.ledger().roundId, sim.address)])),
    });

    assertNotInPublicState(sim.ledger(), secrets()); // during voting
    sim.at(VOTING_END);
    for (const [i, v] of voters.entries()) await reveal(sim, v, choices[i]);
    assertNotInPublicState(sim.ledger(), secrets()); // after reveal: salts were checked in-circuit only
  });

  it('does not link any ballot to an enrolled voter key', async () => {
    const { sim, voters } = await setupRound([10n, 10n], 3);
    for (const v of voters) await cast(sim, v, 0);
    const l = sim.ledger();
    const enrolledKeys = voters.map((v) => toHex(voterKey(v)));
    const nullifiers = [...l.ballots].map(([n]) => toHex(n));
    expect(nullifiers).toHaveLength(3);
    // No nullifier equals or embeds any enrolled key, and vice versa.
    for (const n of nullifiers) for (const k of enrolledKeys) expect(n.includes(k) || k.includes(n)).toBe(false);
    // The ballots map holds only nullifiers and commitments — the voter keys
    // appear in public state solely in the enrolment structures.
    for (const v of voters) {
      const at = findInPublicState({ ballots: l.ballots, revealed: l.revealed }, voterKey(v));
      expect(at).toBeNull();
    }
  });

  it('hides the choice while voting is open: no public tally, no brute-forceable commitment', async () => {
    const { sim, voters } = await setupRound([10n, 10n, 10n, 10n], 4);
    for (const v of voters) await cast(sim, v, 3);
    const l = sim.ledger();
    expect(talliesOf(sim)).toEqual([0n, 0n, 0n, 0n]);

    // An observer tries every possible choice against every byte string that
    // is public (and the all-zero salt). None of them opens a commitment.
    const candidateSalts = [new Uint8Array(32), ...collectPublicBytes(l).map((p) => p.bytes).filter((b) => b.length === 32)];
    for (const [, commitment] of l.ballots) {
      for (let choice = 0; choice < 8; choice++) {
        for (const salt of candidateSalts) expect(ballotCommitment(choice, salt)).not.toEqual(commitment);
      }
    }
    // And identical choices by different voters produce unrelated commitments.
    const commitments = new Set([...l.ballots].map(([, c]) => toHex(c)));
    expect(commitments.size).toBe(4);
  });

  it('gives the same voter unlinkable nullifiers in different rounds', async () => {
    const a = await setupRound([10n], 0);
    const b = await setupRound([10n], 0);
    const voter = new Uint8Array(32).fill(7);
    const nA = ballotNullifier(voter, a.sim.ledger().roundId, a.sim.address);
    const nB = ballotNullifier(voter, b.sim.ledger().roundId, b.sim.address);
    expect(toHex(nA)).not.toBe(toHex(nB));
  });

  it('reveals only the opened choice under an anonymous nullifier after voting closes', async () => {
    const { sim, voters } = await setupRound([10n, 10n], 2);
    await cast(sim, voters[0], 1);
    await cast(sim, voters[1], 0);
    sim.at(VOTING_END);
    await reveal(sim, voters[0], 1);
    const l = sim.ledger();
    // The revealed set contains the nullifier, the tally moved; the voter's
    // enrolled key is not attached to either.
    const n0 = ballotNullifier(voters[0], l.roundId, sim.address);
    expect(l.revealed.member(n0)).toBe(true);
    expect(talliesOf(sim)).toEqual([0n, 1n]);
    expect(findInPublicState({ revealed: l.revealed, tallies: l.tallies }, voterKey(voters[0]))).toBeNull();
  });
});
