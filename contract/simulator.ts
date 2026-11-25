// PRIVEIL — in-memory execution of the compiled contract.
// Copyright (C) 2026 PRIVEIL contributors
// SPDX-License-Identifier: Apache-2.0
//
// Runs the JavaScript the Compact compiler generated from priveil.compact
// (contract/managed/priveil/contract/index.js) on compact-runtime. Every
// circuit executes exactly as it would before proving: the same asserts, the
// same ledger operations, the same witnesses. What it does NOT do is produce
// a zero-knowledge proof or submit a transaction to a Midnight node — that is
// the job of the proof server and the wallet on a real network.
//
// The tests use this engine, and the UI's "Local Simulation" mode uses it, so
// that the demo enforces the real contract rules rather than a JS imitation.
//
// The pattern (fresh circuit context per call, explicit block time) follows
// the in-memory harness in midnightntwrk/midnight-examples.

import {
  type ChargedState,
  type CircuitContext,
  type CircuitResults,
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger, type Ledger } from './managed/priveil/contract/index.js';
import { type PriveilPrivateState, witnesses } from './witnesses.js';

export type PriveilContract = Contract<PriveilPrivateState>;
type Impure = PriveilContract['impureCircuits'];
export type CircuitName = keyof Impure & string;
type ArgsOf<K extends CircuitName> = Impure[K] extends (ctx: never, ...a: infer A) => unknown ? A : never;
type ResultOf<K extends CircuitName> =
  Awaited<ReturnType<Impure[K]>> extends CircuitResults<unknown, infer R> ? R : never;

export type RoundConfig = {
  roundId: Uint8Array;
  fundingPool: bigint;
  submissionEnd: bigint;
  votingStart: bigint;
  votingEnd: bigint;
  revealEnd: bigint;
  quorum: bigint;
};

/** Hex coin public key used for every caller (no shielded coins are involved). */
const COIN_PK = '00'.repeat(32);

export class RoundSimulator {
  /** The contract address (`kernel.self()`), hex. */
  readonly address: string;
  /** Block time (Unix seconds) the next call sees. */
  time: number;
  private state: ChargedState;
  readonly contract: PriveilContract;

  private constructor(contract: PriveilContract, state: ChargedState, time: number, address: string) {
    this.contract = contract;
    this.state = state;
    this.time = time;
    this.address = address;
  }

  /** Runs the constructor: creates the grant round with `adminPrivateState` as admin. */
  static async deploy(
    config: RoundConfig,
    adminPrivateState: PriveilPrivateState,
    time: number,
    address: string = sampleContractAddress(),
  ): Promise<RoundSimulator> {
    const contract = new Contract(witnesses);
    const result = await contract.initialState(
      createConstructorContext(adminPrivateState, COIN_PK),
      config.roundId,
      config.fundingPool,
      config.submissionEnd,
      config.votingStart,
      config.votingEnd,
      config.revealEnd,
      config.quorum,
    );
    return new RoundSimulator(contract, result.currentContractState.data, time, address);
  }

  at(time: number): this {
    this.time = time;
    return this;
  }

  /**
   * Executes one circuit as one transaction, as `privateState`'s owner. On
   * success the public state advances; if an assert fails the error is
   * thrown and nothing changes (on a real network the transaction would be
   * rejected before a proof is even generated).
   */
  async call<K extends CircuitName>(
    circuit: K,
    privateState: PriveilPrivateState,
    ...args: ArgsOf<K>
  ): Promise<{ result: ResultOf<K>; ledger: Ledger; privateState: PriveilPrivateState }> {
    const fn = this.contract.impureCircuits[circuit] as unknown as (
      ctx: CircuitContext<PriveilPrivateState>,
      ...a: unknown[]
    ) => Promise<CircuitResults<PriveilPrivateState, ResultOf<K>>>;
    const context = createCircuitContext<PriveilPrivateState>({
      circuitId: circuit,
      contractAddress: this.address,
      coinPublicKeyOrZswapState: COIN_PK,
      contractState: this.state,
      privateState,
      time: this.time,
    });
    const out = await fn.call(this.contract.impureCircuits, context, ...args);
    this.state = out.context.callContext.currentQueryContext.state;
    return {
      result: out.result,
      ledger: ledger(this.state),
      privateState: out.context.callContext.currentPrivateState as PriveilPrivateState,
    };
  }

  /** The decoded public ledger — exactly what an indexer would show anyone. */
  ledger(): Ledger {
    return ledger(this.state);
  }
}

/** Strips the runtime's prefix from a failed-assert message. */
export const assertMessage = (e: unknown): string => {
  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.match(/failed assert: (.*)$/s);
  return (m ? m[1] : msg).trim();
};
