// Per-round secrets and off-chain documents for LIVE rounds, kept in this
// browser's localStorage.
//
// What is stored here never goes on chain: your secret keys (admin, builder,
// voter) and the proposal you chose, which you need again to reveal your
// ballot after voting closes. localStorage is NOT encrypted: anyone with
// access to this browser profile can read it. That is the MVP trade-off; the
// roadmap item is midnight-js's encrypted level private-state provider.

import type { ProposalDoc, RoundMeta } from '@/engine/types';

const PREFIX = 'priveil:live:v1';

export type TxLogEntry = { label: string; txId: string; blockHeight?: number; at: number };

export type LiveVault = {
  adminSk?: string;
  voterSk?: string;
  /** The proposal this browser voted for (needed to reveal). */
  choice?: number;
  builderSks: Record<string, string>;
  txs: TxLogEntry[];
};

export type OffChain = { meta?: RoundMeta; docs: Record<number, ProposalDoc> };

export type KnownRound = { address: string; name: string; createdAt: number; role: 'admin' | 'joined' };

const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode): secrets then live only in memory */
  }
};

const k = (net: string, address: string, part: string) => `${PREFIX}:${net}:${address.toLowerCase()}:${part}`;

export const loadVault = (net: string, address: string): LiveVault => ({ builderSks: {}, txs: [], ...read<Partial<LiveVault>>(k(net, address, 'vault'), {}) });
export const saveVault = (net: string, address: string, v: LiveVault) => write(k(net, address, 'vault'), v);
export const updateVault = (net: string, address: string, f: (v: LiveVault) => LiveVault) => {
  const next = f(loadVault(net, address));
  saveVault(net, address, next);
  return next;
};

export const loadOffChain = (net: string, address: string): OffChain => ({ docs: {}, ...read<Partial<OffChain>>(k(net, address, 'docs'), {}) });
export const saveOffChain = (net: string, address: string, o: OffChain) => write(k(net, address, 'docs'), o);

export const knownRounds = (net: string): KnownRound[] => read<KnownRound[]>(`${PREFIX}:${net}:rounds`, []);
export const rememberRound = (net: string, r: KnownRound) => {
  const list = knownRounds(net).filter((x) => x.address.toLowerCase() !== r.address.toLowerCase());
  write(`${PREFIX}:${net}:rounds`, [r, ...list].slice(0, 30));
};
