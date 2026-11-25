// PRIVEIL demo engine.
//
// Every grant round here is a RoundSimulator: the *compiled* PRIVEIL Compact
// contract executing on compact-runtime in this browser tab. Every action
// (submit, enrol, vote, reveal, finalize) is a real circuit call, so the
// contract's own asserts accept or reject it. What the simulation does not
// do: generate zero-knowledge proofs, or submit transactions to a Midnight
// node. That is what "Local Simulation" means in the UI.

import { useSyncExternalStore } from 'react';
import { RoundSimulator, assertMessage, type RoundConfig } from '@contract/simulator';
import { createPrivateState, withChoice } from '@contract/witnesses';
import {
  ballotCommitment,
  ballotNullifier,
  ballotOpening,
  ballotSalt,
  builderKey,
  canonicalRanking,
  hashMetadata,
  newSecretKey,
  toHex,
  voterKey,
} from '@contract/crypto';
import type { Ledger } from '@contract/managed/priveil/contract/index.js';
import type { Actor, Member, Phase, ProposalDoc, RoundEntry, RoundMeta, TxRecord } from './types';

export const short = (b: Uint8Array | string, n = 6) => {
  const h = typeof b === 'string' ? b : toHex(b);
  return `0x${h.slice(0, n)}…${h.slice(-4)}`;
};

export const rootHex = (l: Ledger) => l.voters.root().field.toString(16).padStart(64, '0');

export function phaseOf(l: Ledger, time: number): Phase {
  if (l.finalized) return 'finalized';
  const t = BigInt(time);
  if (t < l.votingStart) return 'submission';
  if (t < l.votingEnd) return 'voting';
  if (t < l.revealEnd) return 'reveal';
  return 'tally';
}

export const PHASE_LABEL: Record<Phase, string> = {
  submission: 'Accepting proposals',
  voting: 'Voting open',
  reveal: 'Revealing ballots',
  tally: 'Awaiting finalization',
  finalized: 'Finalized',
};

export type Toast = { id: number; ok: boolean; title: string; body?: string };

type Listener = () => void;

class DemoStore {
  rounds = new Map<string, RoundEntry>();
  order: string[] = [];
  toasts: Toast[] = [];
  ready = false;
  private version = 0;
  private listeners = new Set<Listener>();
  private txSeq = 1;

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getVersion = () => this.version;
  emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  toast(ok: boolean, title: string, body?: string) {
    const t = { id: this.txSeq++, ok, title, body };
    this.toasts = [...this.toasts, t];
    this.emit();
    setTimeout(() => {
      this.toasts = this.toasts.filter((x) => x.id !== t.id);
      this.emit();
    }, 5200);
  }

  get(id: string) {
    return this.rounds.get(id);
  }

  list() {
    return this.order.map((id) => this.rounds.get(id)!);
  }

  // ─── Round lifecycle ──────────────────────────────────────────────────────

  async createRound(
    id: string,
    meta: RoundMeta,
    cfg: Omit<RoundConfig, 'roundId'>,
    adminSk: Uint8Array,
    time: number,
    address?: string,
  ): Promise<RoundEntry> {
    const roundId = await hashMetadata(meta);
    const sim = await RoundSimulator.deploy({ ...cfg, roundId }, createPrivateState(adminSk), time, address);
    const entry: RoundEntry = {
      id,
      sim,
      meta,
      docs: {},
      members: [],
      you: { enrolled: false, cast: false, revealed: false, builderSks: {}, adminSk: meta.origin === 'you' ? adminSk : undefined },
      txs: [],
    };
    this.log(entry, 'constructor', meta.origin === 'you' ? 'you' : 'admin', true, [
      ['roundId', short(roundId)],
      ['fundingPool', fmt(cfg.fundingPool, meta.unit)],
      ['adminPk', short(sim.ledger().adminPk)],
      ['voting', `${date(cfg.votingStart)} → ${date(cfg.votingEnd)}`],
      ['quorum', `${cfg.quorum} vote(s)`],
    ]);
    this.rounds.set(id, entry);
    this.order.push(id);
    this.emit();
    return entry;
  }

  private log(r: RoundEntry, circuit: string, actor: Actor, ok: boolean, effects: Array<[string, string]>, error?: string) {
    r.txs.unshift({ id: this.txSeq++, blockTime: r.sim.time, circuit, actor, ok, effects, error } satisfies TxRecord);
  }

  /** Runs a circuit; logs rejections as "rejected locally" (never submitted). */
  private async run<T>(r: RoundEntry, circuit: string, actor: Actor, fn: () => Promise<T>, effects: (res: T) => Array<[string, string]>, quiet = false): Promise<T | null> {
    try {
      const res = await fn();
      this.log(r, circuit, actor, true, effects(res));
      return res;
    } catch (e) {
      const msg = assertMessage(e);
      this.log(r, circuit, actor, false, [], msg);
      if (!quiet) this.toast(false, `${circuit} rejected by the contract`, msg);
      this.emit();
      return null;
    }
  }

  async submitProposal(r: RoundEntry, doc: ProposalDoc, builderSk: Uint8Array, actor: Actor = 'builder') {
    const hash = await hashMetadata(doc);
    const res = await this.run(r, 'submitProposal', actor,
      () => r.sim.call('submitProposal', createPrivateState(builderSk), hash, BigInt(doc.requested)),
      (out) => [
        ['proposal', `#${out.result}`],
        ['metadataHash', short(hash)],
        ['requested', fmt(BigInt(doc.requested), r.meta.unit)],
        ['builderPk', short(builderKey(builderSk))],
      ]);
    if (res === null) return null;
    const id = Number(res.result);
    r.docs[id] = doc;
    if (actor === 'you') r.you.builderSks[id] = builderSk;
    this.emit();
    return id;
  }

  async enrol(r: RoundEntry, adminSk: Uint8Array, pk: Uint8Array, actor: Actor = 'admin', quiet = false) {
    const res = await this.run(r, 'enrolVoter', actor,
      () => r.sim.call('enrolVoter', createPrivateState(adminSk), pk),
      (out) => [['voterKey', short(pk)], ['enrolled', `${out.ledger.enrolled}`], ['newRoot', short(rootHex(out.ledger))]], quiet);
    this.emit();
    return res !== null;
  }

  /** The user requests a voter credential: generated locally, key sent to the admin. */
  async joinAsVoter(r: RoundEntry) {
    if (!r.you.voterSk) r.you.voterSk = newSecretKey();
    const admin = r.you.adminSk ?? adminSecrets.get(r.id);
    if (!admin) return false;
    const ok = await this.enrol(r, admin, voterKey(r.you.voterSk), 'admin');
    if (ok) {
      r.you.enrolled = true;
      this.toast(true, 'Credential issued', 'Your secret stays on this device. The admin only received its hash.');
    }
    this.emit();
    return ok;
  }

  async cast(r: RoundEntry, sk: Uint8Array, choice: number, actor: Actor) {
    const res = await this.run(r, 'castBallot', actor,
      () => r.sim.call('castBallot', withChoice(createPrivateState(sk), choice)),
      (out) => {
        const n = ballotNullifier(sk, out.ledger.roundId, r.sim.address);
        return [
          ['nullifier', short(n)],
          ['commitment', short(out.ledger.ballots.lookup(n))],
          ['ballotsCast', `${out.ledger.ballotsCast}`],
        ];
      }, actor !== 'you');
    this.emit();
    return res !== null;
  }

  async castYours(r: RoundEntry, choice: number) {
    if (!r.you.voterSk) return false;
    const ok = await this.cast(r, r.you.voterSk, choice, 'you');
    if (ok) {
      r.you.cast = true;
      r.you.choice = choice;
      this.toast(true, 'Ballot accepted', 'Only your nullifier and a hiding commitment were published.');
    }
    this.emit();
    return ok;
  }

  /** Deliberately tries to vote again with the same credential. */
  async tryDoubleVote(r: RoundEntry) {
    if (!r.you.voterSk) return;
    const other = ((r.you.choice ?? 0) + 1) % Math.max(1, Number(r.sim.ledger().proposalCount));
    await this.cast(r, r.you.voterSk, other, 'you');
  }

  /** Tries to vote with a fresh, never-enrolled credential. */
  async tryIneligibleVote(r: RoundEntry) {
    await this.cast(r, newSecretKey(), 0, 'you');
  }

  async reveal(r: RoundEntry, sk: Uint8Array, choice: number, actor: Actor, quiet = false) {
    const l = r.sim.ledger();
    const o = ballotOpening(sk, choice, l.roundId, r.sim.address);
    const res = await this.run(r, 'revealBallot', actor,
      () => r.sim.call('revealBallot', createPrivateState(newSecretKey()), o.nullifier, BigInt(o.choice), o.salt),
      (out) => [
        ['nullifier', short(o.nullifier)],
        ['choice', `#${choice} ${r.docs[choice]?.name ?? ''}`.trim()],
        ['tally', `#${choice} → ${out.ledger.tallies.lookup(BigInt(choice))}`],
      ], quiet);
    this.emit();
    return res !== null;
  }

  async revealYours(r: RoundEntry) {
    if (!r.you.voterSk || r.you.choice === undefined) return;
    if (await this.reveal(r, r.you.voterSk, r.you.choice, 'you')) {
      r.you.revealed = true;
      this.toast(true, 'Ballot opened and counted', 'Published: nullifier + choice. Your identity stays unlinked.');
    }
    this.emit();
  }

  async revealMembers(r: RoundEntry) {
    let n = 0;
    for (const m of r.members) {
      if (m.cast && !m.revealed && m.choice !== undefined && (await this.reveal(r, m.sk, m.choice, 'member', true))) {
        m.revealed = true;
        n++;
      }
    }
    this.toast(true, `${n} member ballots opened`, 'Each member’s own client submitted its opening.');
    this.emit();
  }

  async finalize(r: RoundEntry) {
    const l = r.sim.ledger();
    const tallies = Array.from({ length: Number(l.proposalCount) }, (_, i) => l.tallies.lookup(BigInt(i)));
    const order = canonicalRanking(tallies);
    const res = await this.run(r, 'finalize', 'anyone',
      () => r.sim.call('finalize', createPrivateState(newSecretKey()), order),
      (out) => [
        ['ranking', order.slice(0, tallies.length).map((x) => `#${x}`).join(' › ')],
        ['totalAllocated', fmt(out.ledger.totalAllocated, r.meta.unit)],
        ['remainingBudget', fmt(out.ledger.remainingBudget, r.meta.unit)],
      ]);
    if (res) this.toast(true, 'Round finalized', 'The contract verified the ranking and computed every allocation.');
    this.emit();
  }

  /** Simulation control: move this round's block clock. */
  advanceTo(r: RoundEntry, t: number) {
    r.sim.at(Math.max(r.sim.time, t));
    this.emit();
  }

  /** Simulated members cast their ballots (each from their own device). */
  async membersVote(r: RoundEntry, members: Member[]) {
    const count = Number(r.sim.ledger().proposalCount);
    for (const m of members) {
      // A member decides on their own device; for members of rounds created in
      // this session, pick a choice now that the proposals exist.
      if (m.choice === undefined && count > 0) m.choice = m.sk[0] % count;
      if (m.choice !== undefined && !m.cast && (await this.cast(r, m.sk, m.choice, 'member'))) m.cast = true;
    }
  }
}

/** Admin secrets of the seeded demo rounds (the simulated round operator's device). */
export const adminSecrets = new Map<string, Uint8Array>();

export const store = new DemoStore();

export function useStore() {
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store;
}

// ─── formatting ─────────────────────────────────────────────────────────────

export const fmt = (v: bigint | number, unit = 'USD') => {
  const n = typeof v === 'bigint' ? Number(v) : v;
  return unit === 'USD' ? `$${n.toLocaleString('en-US')}` : `${n.toLocaleString('en-US')} ${unit}`;
};

export const date = (t: bigint | number) =>
  new Date(Number(t) * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const relative = (target: bigint | number, now: number) => {
  const d = Number(target) - now;
  const abs = Math.abs(d);
  const days = Math.floor(abs / 86400);
  const hours = Math.floor((abs % 86400) / 3600);
  const mins = Math.floor((abs % 3600) / 60);
  const s = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  return d >= 0 ? `in ${s}` : `${s} ago`;
};

export const talliesOf = (l: Ledger) =>
  Array.from({ length: Number(l.proposalCount) }, (_, i) => l.tallies.lookup(BigInt(i)));
export const allocationsOf = (l: Ledger) =>
  Array.from({ length: Number(l.proposalCount) }, (_, i) => l.allocations.lookup(BigInt(i)));
export const requestsOf = (l: Ledger) =>
  Array.from({ length: Number(l.proposalCount) }, (_, i) => l.proposals.lookup(BigInt(i)).requested);

/** Your private ballot material (only computable with your secret). */
export function yourBallot(r: RoundEntry) {
  const sk = r.you.voterSk;
  if (!sk) return null;
  const l = r.sim.ledger();
  const salt = ballotSalt(sk, l.roundId, r.sim.address);
  const nullifier = ballotNullifier(sk, l.roundId, r.sim.address);
  return {
    sk,
    voterKey: voterKey(sk),
    salt,
    nullifier,
    commitment: r.you.choice !== undefined ? ballotCommitment(r.you.choice, salt) : undefined,
  };
}
