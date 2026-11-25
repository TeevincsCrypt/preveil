// PRIVEIL — client-side key and ballot helpers.
// Copyright (C) 2026 PRIVEIL contributors
// SPDX-License-Identifier: Apache-2.0
//
// Every derivation here calls the contract's own `pure circuit`s (compiled
// from priveil.compact), so the client and the circuit can never disagree on
// how a key, nullifier, salt or commitment is computed.
//
// Browser-safe: uses Web Crypto only.

import { pureCircuits } from './managed/priveil/contract/index.js';

export const MAX_PROPOSALS = 8;

export const toHex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export const fromHex = (h: string): Uint8Array => {
  const s = h.startsWith('0x') ? h.slice(2) : h;
  if (s.length % 2 !== 0 || /[^0-9a-f]/i.test(s)) throw new Error('invalid hex');
  return Uint8Array.from({ length: s.length / 2 }, (_, i) => parseInt(s.slice(2 * i, 2 * i + 2), 16));
};

export const randomBytes = (n: number): Uint8Array => {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
};

/** A fresh participant secret. Generated and kept on the participant's device. */
export const newSecretKey = (): Uint8Array => randomBytes(32);

export const adminKey = (sk: Uint8Array): Uint8Array => pureCircuits.adminKey(sk);
/** What a voter hands to the round admin for enrolment. Reveals nothing about `sk`. */
export const voterKey = (sk: Uint8Array): Uint8Array => pureCircuits.voterKey(sk);
export const builderKey = (sk: Uint8Array): Uint8Array => pureCircuits.builderKey(sk);

/** The contract instance bytes the circuit reads as `kernel.self().bytes`. */
export const instanceBytes = (contractAddressHex: string): Uint8Array => {
  const b = fromHex(contractAddressHex);
  if (b.length !== 32) throw new Error('contract address must be 32 bytes');
  return b;
};

export const ballotNullifier = (sk: Uint8Array, roundId: Uint8Array, address: string): Uint8Array =>
  pureCircuits.ballotNullifier(sk, roundId, instanceBytes(address));

export const ballotSalt = (sk: Uint8Array, roundId: Uint8Array, address: string): Uint8Array =>
  pureCircuits.ballotSalt(sk, roundId, instanceBytes(address));

export const ballotCommitment = (choice: number, salt: Uint8Array): Uint8Array =>
  pureCircuits.ballotCommitment(BigInt(choice), salt);

/** Everything needed to open (reveal) a ballot. Private until the voter submits it. */
export type BallotOpening = { nullifier: Uint8Array; choice: number; salt: Uint8Array };

export const ballotOpening = (sk: Uint8Array, choice: number, roundId: Uint8Array, address: string): BallotOpening => ({
  nullifier: ballotNullifier(sk, roundId, address),
  choice,
  salt: ballotSalt(sk, roundId, address),
});

/** SHA-256 over a canonical JSON encoding: commits to off-chain metadata. */
export const hashMetadata = async (value: unknown): Promise<Uint8Array> => {
  const json = canonicalJson(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
  return new Uint8Array(digest);
};

export const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
};

/**
 * The one ranking `finalize` accepts: proposal indices sorted by votes
 * (descending), ties broken by the lower index, padded with zeros to 8.
 */
export const canonicalRanking = (tallies: readonly bigint[]): bigint[] => {
  const order = tallies
    .map((votes, id) => ({ id, votes }))
    .sort((a, b) => (a.votes === b.votes ? a.id - b.id : a.votes > b.votes ? -1 : 1))
    .map((x) => BigInt(x.id));
  while (order.length < MAX_PROPOSALS) order.push(0n);
  return order;
};

/**
 * The allocation `finalize` computes, re-implemented off chain so a UI can
 * preview it and a test can check the contract against an independent model.
 */
export const expectedAllocations = (
  tallies: readonly bigint[],
  requested: readonly bigint[],
  pool: bigint,
  quorum: bigint,
): bigint[] => {
  const out = tallies.map(() => 0n);
  let remaining = pool;
  for (const id of canonicalRanking(tallies).slice(0, tallies.length).map(Number)) {
    if (tallies[id] >= quorum && requested[id] <= remaining) {
      out[id] = requested[id];
      remaining -= requested[id];
    }
  }
  return out;
};
