import type { RoundSimulator } from '@contract/simulator';

export type ProposalDoc = {
  name: string;
  tagline: string;
  description: string;
  category: string;
  requested: number;
  github: string;
  website: string;
  justification: string;
  team: string;
};

export type RoundMeta = {
  name: string;
  description: string;
  sponsor: string;
  unit: string;
  methodology: string;
  allocationRule: string;
  /** Seeded demonstration round, or one the user created in this session. */
  origin: 'demo' | 'you';
};

/** A simulated community member: a separate device with its own private state. */
export type Member = {
  label: string;
  sk: Uint8Array;
  /** Their (private) intended choice; only their own device knows it. */
  choice?: number;
  cast: boolean;
  revealed: boolean;
};

/** Everything that lives only on the user's own device. */
export type Vault = {
  voterSk?: Uint8Array;
  enrolled: boolean;
  choice?: number;
  cast: boolean;
  revealed: boolean;
  adminSk?: Uint8Array;
  /** proposal index → builder secret */
  builderSks: Record<number, Uint8Array>;
};

export type Actor = 'you' | 'member' | 'admin' | 'builder' | 'anyone';

/** A transaction as the public (an indexer) sees it: entry point + public effects. */
export type TxRecord = {
  id: number;
  blockTime: number;
  circuit: string;
  actor: Actor;
  ok: boolean;
  /** Public effects written to the ledger by this call. */
  effects: Array<[string, string]>;
  error?: string;
};

export type RoundEntry = {
  id: string;
  sim: RoundSimulator;
  meta: RoundMeta;
  /** off-chain proposal documents, keyed by proposal index */
  docs: Record<number, ProposalDoc>;
  members: Member[];
  you: Vault;
  txs: TxRecord[];
};

export type Phase = 'submission' | 'voting' | 'reveal' | 'tally' | 'finalized';
