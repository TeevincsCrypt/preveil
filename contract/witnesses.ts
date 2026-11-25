// PRIVEIL — witness implementations.
// Copyright (C) 2026 PRIVEIL contributors
// SPDX-License-Identifier: Apache-2.0
//
// Witnesses are the off-chain half of the contract: they run on the
// participant's own device, read the participant's PRIVATE state, and feed
// values into the circuit as private inputs to the zero-knowledge proof.
// Nothing returned here reaches the public ledger unless the contract
// explicitly `disclose()`s it and writes it.
//
// This file is browser-safe (no node:* imports): the UI uses it too.

import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger, Witnesses } from './managed/priveil/contract/index.js';

/**
 * A participant's private state. Each participant (admin, builder, voter)
 * has their own and it never leaves their device.
 */
export type PriveilPrivateState = {
  /** 32 random bytes. Voter key, nullifier and salt are all derived from it. */
  readonly secretKey: Uint8Array;
  /** The proposal index this voter is about to vote for (castBallot only). */
  readonly choice?: number;
};

export const createPrivateState = (secretKey: Uint8Array, choice?: number): PriveilPrivateState => {
  if (secretKey.length !== 32) throw new Error('secretKey must be 32 bytes');
  return choice === undefined ? { secretKey } : { secretKey, choice };
};

export const withChoice = (ps: PriveilPrivateState, choice: number): PriveilPrivateState => ({ ...ps, choice });

export const witnesses: Witnesses<PriveilPrivateState> = {
  secretKey: ({ privateState }: WitnessContext<Ledger, PriveilPrivateState>) => [privateState, privateState.secretKey],

  // The path is computed from the public `voters` tree in the ledger state the
  // circuit runs against, so it always matches the root `castBallot` checks.
  // Enrolment is frozen once voting opens, so the path can't go stale.
  voterPath: ({ privateState, ledger }: WitnessContext<Ledger, PriveilPrivateState>, pk: Uint8Array) => {
    const path = ledger.voters.findPathForLeaf(pk);
    if (path === undefined) throw new Error('This voter key is not enrolled in the round');
    return [privateState, path];
  },

  ballotChoice: ({ privateState }: WitnessContext<Ledger, PriveilPrivateState>) => {
    if (privateState.choice === undefined) throw new Error('No ballot choice set in private state');
    return [privateState, BigInt(privateState.choice)];
  },
};
