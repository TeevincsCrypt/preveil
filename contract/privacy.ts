// PRIVEIL — public-state privacy checks.
// Copyright (C) 2026 PRIVEIL contributors
// SPDX-License-Identifier: Apache-2.0
//
// Walks the decoded public ledger (what an indexer exposes to everyone) and
// collects every byte string in it, so tests can assert that no secret value
// appears anywhere on chain. The walker follows the ledger itself: a new
// ledger field is covered automatically. (Approach adapted from the privacy
// harness in midnightntwrk/midnight-examples.)

import { toHex } from './crypto.js';

export type PublicBytes = { label: string; bytes: Uint8Array };

const isIterable = (v: object): v is Iterable<unknown> =>
  typeof (v as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function';

export function collectPublicBytes(value: unknown, root = ''): PublicBytes[] {
  const out: PublicBytes[] = [];
  const seen = new Set<object>();
  const walk = (v: unknown, label: string): void => {
    if (v instanceof Uint8Array) {
      out.push({ label, bytes: v });
      return;
    }
    if (v === null || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, `${label}[${i}]`));
      return;
    }
    if (isIterable(v)) {
      const isMap = typeof (v as { lookup?: unknown }).lookup === 'function';
      let i = 0;
      for (const entry of v) {
        if (isMap && Array.isArray(entry) && entry.length === 2) {
          walk(entry[0], `${label}[${i}].key`);
          walk(entry[1], `${label}[${i}].value`);
        } else walk(entry, `${label}[${i}]`);
        i++;
      }
      return;
    }
    for (const key of Object.keys(v)) {
      const field = (v as Record<string, unknown>)[key];
      if (typeof field !== 'function') walk(field, label ? `${label}.${key}` : key);
    }
  };
  walk(value, root);
  return out;
}

/** Label of the first public byte string containing `secret`, or null. */
export function findInPublicState(ledger: unknown, secret: Uint8Array): string | null {
  const target = toHex(secret);
  if (!target) return null;
  for (const { label, bytes } of collectPublicBytes(ledger)) if (toHex(bytes).includes(target)) return label;
  return null;
}

/** Throws if any named secret appears anywhere in public state. */
export function assertNotInPublicState(ledger: unknown, secrets: Record<string, Uint8Array>): void {
  const leaks = Object.entries(secrets)
    .map(([name, bytes]) => [name, findInPublicState(ledger, bytes)] as const)
    .filter(([, at]) => at !== null)
    .map(([name, at]) => `${name} found in public state at ${at}`);
  if (leaks.length) throw new Error(`privacy invariant broken:\n  ${leaks.join('\n  ')}`);
}
