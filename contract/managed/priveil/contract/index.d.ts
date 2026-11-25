import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Proposal = { metadataHash: Uint8Array;
                         requested: bigint;
                         builderPk: Uint8Array
                       };

export type Witnesses<PS> = {
  secretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  voterPath(context: __compactRuntime.WitnessContext<Ledger, PS>,
            pk_0: Uint8Array): [PS, { leaf: Uint8Array,
                                      path: { sibling: { field: bigint },
                                              goes_left: boolean
                                            }[]
                                    }];
  ballotChoice(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
}

export type ImpureCircuits<PS> = {
  submitProposal(context: __compactRuntime.CircuitContext<PS>,
                 metadataHash_0: Uint8Array,
                 requested_0: bigint): Promise<__compactRuntime.CircuitResults<PS, bigint>>;
  enrolVoter(context: __compactRuntime.CircuitContext<PS>, pk_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  castBallot(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  revealBallot(context: __compactRuntime.CircuitContext<PS>,
               nullifier_0: Uint8Array,
               choice_0: bigint,
               salt_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  finalize(context: __compactRuntime.CircuitContext<PS>, order_0: bigint[]): Promise<__compactRuntime.CircuitResults<PS, []>>;
}

export type ProvableCircuits<PS> = {
  submitProposal(context: __compactRuntime.CircuitContext<PS>,
                 metadataHash_0: Uint8Array,
                 requested_0: bigint): Promise<__compactRuntime.CircuitResults<PS, bigint>>;
  enrolVoter(context: __compactRuntime.CircuitContext<PS>, pk_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  castBallot(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  revealBallot(context: __compactRuntime.CircuitContext<PS>,
               nullifier_0: Uint8Array,
               choice_0: bigint,
               salt_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  finalize(context: __compactRuntime.CircuitContext<PS>, order_0: bigint[]): Promise<__compactRuntime.CircuitResults<PS, []>>;
}

export type PureCircuits = {
  adminKey(sk_0: Uint8Array): Uint8Array;
  voterKey(sk_0: Uint8Array): Uint8Array;
  builderKey(sk_0: Uint8Array): Uint8Array;
  ballotNullifier(sk_0: Uint8Array, rid_0: Uint8Array, instance_0: Uint8Array): Uint8Array;
  ballotSalt(sk_0: Uint8Array, rid_0: Uint8Array, instance_0: Uint8Array): Uint8Array;
  ballotCommitment(choice_0: bigint, salt_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  adminKey(context: __compactRuntime.CircuitContext<PS>, sk_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  voterKey(context: __compactRuntime.CircuitContext<PS>, sk_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  builderKey(context: __compactRuntime.CircuitContext<PS>, sk_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  ballotNullifier(context: __compactRuntime.CircuitContext<PS>,
                  sk_0: Uint8Array,
                  rid_0: Uint8Array,
                  instance_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  ballotSalt(context: __compactRuntime.CircuitContext<PS>,
             sk_0: Uint8Array,
             rid_0: Uint8Array,
             instance_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  ballotCommitment(context: __compactRuntime.CircuitContext<PS>,
                   choice_0: bigint,
                   salt_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  submitProposal(context: __compactRuntime.CircuitContext<PS>,
                 metadataHash_0: Uint8Array,
                 requested_0: bigint): Promise<__compactRuntime.CircuitResults<PS, bigint>>;
  enrolVoter(context: __compactRuntime.CircuitContext<PS>, pk_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  castBallot(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  revealBallot(context: __compactRuntime.CircuitContext<PS>,
               nullifier_0: Uint8Array,
               choice_0: bigint,
               salt_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  finalize(context: __compactRuntime.CircuitContext<PS>, order_0: bigint[]): Promise<__compactRuntime.CircuitResults<PS, []>>;
}

export type Ledger = {
  readonly adminPk: Uint8Array;
  readonly roundId: Uint8Array;
  readonly fundingPool: bigint;
  readonly submissionEnd: bigint;
  readonly votingStart: bigint;
  readonly votingEnd: bigint;
  readonly revealEnd: bigint;
  readonly quorum: bigint;
  proposals: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): Proposal;
    [Symbol.iterator](): Iterator<[bigint, Proposal]>
  };
  proposalHashes: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  readonly proposalCount: bigint;
  voters: {
    isFull(): boolean;
    checkRoot(rt_0: { field: bigint }): boolean;
    root(): __compactRuntime.MerkleTreeDigest;
    firstFree(): bigint;
    pathForLeaf(index_0: bigint, leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array>;
    findPathForLeaf(leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array> | undefined
  };
  voterKeys: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  readonly enrolled: bigint;
  ballots: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  readonly ballotsCast: bigint;
  revealed: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  readonly ballotsRevealed: bigint;
  tallies: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): bigint;
    [Symbol.iterator](): Iterator<[bigint, bigint]>
  };
  readonly finalized: boolean;
  readonly ranking: bigint[];
  allocations: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): bigint;
    [Symbol.iterator](): Iterator<[bigint, bigint]>
  };
  readonly totalAllocated: bigint;
  readonly remainingBudget: bigint;
}

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               rid_0: Uint8Array,
               pool_0: bigint,
               subEnd_0: bigint,
               voteStart_0: bigint,
               voteEnd_0: bigint,
               revEnd_0: bigint,
               minVotes_0: bigint): Promise<__compactRuntime.ConstructorResult<PS>>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
export declare const expectedVk: Record<string, string>;
export declare const circuitSignatures: __compactRuntime.CircuitSignatures;
export declare const declaredInterfaces: __compactRuntime.DeclaredInterfaces;
