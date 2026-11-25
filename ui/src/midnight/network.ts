// PRIVEIL on a real Midnight network (preprod / preview / local devnet).
//
// Ported from the official browser UI template in midnightntwrk/midnight-examples
// (packages/mnkit/templates/ui/src/midnight/providers.ts), which is verified
// in Midnight's CI. The wallet (Lace, via the DApp Connector API) supplies the
// network configuration, balances and submits transactions; proofs are made
// by the wallet or by a local proof server.
//
// Used by the Live mode (ui/src/pages/Live*.tsx). Requirements: a Midnight
// wallet (Lace) on a test network with DUST for fees, and the compiled proving
// keys served at /managed/priveil (committed under contract/managed/priveil/keys
// and copied by `npm run copy:zk`, which the dev and build scripts run).

import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { deployContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { dappConnectorProofProvider } from '@midnight-ntwrk/midnight-js-dapp-connector-proof-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { CostModel, Transaction, type FinalizedTransaction } from '@midnight-ntwrk/midnight-js-protocol/v9';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/v9/compact-js';
import { ContractState, type ContractAddress, type SigningKey } from '@midnight-ntwrk/midnight-js-protocol/v9/compact-runtime';
import {
  createLedger9MidnightProvider,
  createLedger9WalletProvider,
  type ContractPrivateStates,
  type ContractStateRead,
  type MidnightProviders,
  type PrivateStateProvider,
  type ProofProvider,
} from '@midnight-ntwrk/midnight-js-types';
import { assertIsContractAddress, fromHex, parseCoinPublicKeyToHex, parseEncPublicKeyToHex, toHex } from '@midnight-ntwrk/midnight-js-utils';
import { Contract, ledger, type Ledger } from '@contract/managed/priveil/contract/index.js';
import { witnesses, type PriveilPrivateState } from '@contract/witnesses';
import type { RoundConfig } from '@contract/simulator';

export type PriveilCircuit = 'submitProposal' | 'enrolVoter' | 'castBallot' | 'revealBallot' | 'finalize';
export const PRIVATE_STATE_ID = 'priveilPrivateState';
export const ZK_ASSETS_PATH = 'managed/priveil';

export type PriveilProviders = MidnightProviders<PriveilCircuit, typeof PRIVATE_STATE_ID, PriveilPrivateState>;

export const CompiledPriveil = CompiledContract.make('PriveilContract', Contract).pipe(
  CompiledContract.withWitnesses(witnesses as never),
  CompiledContract.withCompiledFileAssets(ZK_ASSETS_PATH),
);

export type ProvingMode = 'wallet' | 'local';
export const DEFAULT_PROOF_SERVER_URL = 'http://127.0.0.1:6300';

export function contractStateData(read: ContractStateRead) {
  if (read.contractState.era !== 'v9') throw new Error('Expected a ledger 9 contract state');
  return read.contractState.deserialize({ v9: ContractState }).data;
}

export async function createProviders(api: ConnectedAPI, mode: ProvingMode, proofServerUrl = DEFAULT_PROOF_SERVER_URL): Promise<PriveilProviders> {
  const config = await api.getConfiguration();
  const publicDataProvider = indexerPublicDataProvider(
    config.indexerUri,
    config.indexerWsUri,
    window.WebSocket as unknown as Parameters<typeof indexerPublicDataProvider>[2],
  );
  const zkConfigProvider = new FetchZkConfigProvider<PriveilCircuit>(new URL(ZK_ASSETS_PATH, window.location.origin).toString(), {
    fetchFunc: fetch.bind(window),
  });
  const proofProvider: ProofProvider =
    mode === 'local'
      ? httpClientProofProvider(proofServerUrl, zkConfigProvider)
      : await dappConnectorProofProvider(api, zkConfigProvider, CostModel.initialCostModel());

  const { shieldedCoinPublicKey, shieldedEncryptionPublicKey } = await api.getShieldedAddresses();
  const coinPublicKey = parseCoinPublicKeyToHex(shieldedCoinPublicKey, config.networkId);
  const encryptionPublicKey = parseEncPublicKeyToHex(shieldedEncryptionPublicKey, config.networkId);

  const walletProvider = createLedger9WalletProvider({
    getCoinPublicKey: () => coinPublicKey,
    getEncryptionPublicKey: () => encryptionPublicKey,
    balanceTx: async (tx) => {
      const { tx: balancedHex } = await api.balanceUnsealedTransaction(toHex(tx.serialize()));
      return Transaction.deserialize('signature', 'proof', 'binding', fromHex(balancedHex)) satisfies FinalizedTransaction;
    },
  });
  const midnightProvider = createLedger9MidnightProvider(async (handle) => {
    const bytes = handle.serialize();
    await api.submitTransaction(toHex(bytes));
    const [txId] = Transaction.deserialize('signature', 'proof', 'binding', bytes).identifiers();
    if (!txId) throw new Error('Submitted transaction has no identifier');
    return txId;
  });

  return {
    privateStateProvider: inMemoryPrivateStateProvider(),
    publicDataProvider,
    zkConfigProvider,
    proofProvider,
    walletProvider,
    midnightProvider,
    config: { networkId: config.networkId, ttlSeconds: 3600 },
  } as PriveilProviders;
}

/** Deploys one grant round. The deployer's private state makes them the admin. */
export type TxResult<R = unknown> = { txId: string; blockHeight?: number; result?: R };

export async function deployRound(p: PriveilProviders, cfg: RoundConfig, adminSk: Uint8Array): Promise<{ address: ContractAddress; txId: string; blockHeight?: number }> {
  const deployed = await deployContract(p, {
    compiledContract: CompiledPriveil,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: { secretKey: adminSk },
    args: [cfg.roundId, cfg.fundingPool, cfg.submissionEnd, cfg.votingStart, cfg.votingEnd, cfg.revealEnd, cfg.quorum],
  } as never);
  const pub = (deployed as { deployTxData: { public: { contractAddress: ContractAddress; txId: string; blockHeight?: number } } }).deployTxData.public;
  return { address: pub.contractAddress, txId: pub.txId, blockHeight: pub.blockHeight };
}

/** Proves and submits one circuit call as `who` (whose private state is set first). */
export async function callCircuit<R = unknown>(
  p: PriveilProviders,
  address: ContractAddress,
  who: PriveilPrivateState,
  circuitId: PriveilCircuit,
  args: unknown[],
): Promise<TxResult<R>> {
  await p.privateStateProvider.forContract(address).set(PRIVATE_STATE_ID, who);
  const tx = (await submitCallTx(p, { compiledContract: CompiledPriveil, contractAddress: address, privateStateId: PRIVATE_STATE_ID, circuitId, args } as never)) as unknown as {
    public: { txId: string; blockHeight?: number };
    private?: { result?: R };
  };
  return { txId: tx.public.txId, blockHeight: tx.public.blockHeight, result: tx.private?.result };
}

/** Subscribes to the round's public ledger through the indexer. Returns an unsubscribe function. */
export function observeLedger(p: PriveilProviders, address: ContractAddress, onLedger: (l: Ledger, blockHeight: number) => void, onError: (e: unknown) => void): () => void {
  const sub = p.publicDataProvider.contractStateObservable(address, { type: 'latest' }).subscribe({
    next: (rec) => {
      try {
        onLedger(ledger(contractStateData(rec.value as unknown as ContractStateRead)), rec.blockHeight);
      } catch (e) {
        onError(e);
      }
    },
    error: onError,
  });
  return () => sub.unsubscribe();
}

/** Reads and decodes the round's public ledger from the indexer. */
export async function readLedger(p: PriveilProviders, address: ContractAddress): Promise<Ledger | null> {
  const read = await p.publicDataProvider.queryContractState(address);
  return read ? ledger(contractStateData(read as unknown as ContractStateRead)) : null;
}

/** In-memory private state (from the official template): lost on reload. */
function inMemoryPrivateStateProvider<PSI extends string, PS>(): PrivateStateProvider<PSI, PS> {
  const states = new Map<string, Map<PSI, PS>>();
  const signingKeys = new Map<string, SigningKey>();
  const unsupported = (m: string) => async (): Promise<never> => {
    throw new Error(`in-memory private state does not support ${m}`);
  };
  const forContract = (address: ContractAddress): ContractPrivateStates<PSI, PS> => {
    assertIsContractAddress(address);
    const a = address.toLowerCase();
    const scoped = () => {
      let m = states.get(a);
      if (!m) states.set(a, (m = new Map()));
      return m;
    };
    return {
      contractAddress: a,
      set: async (id: PSI, s: PS) => void scoped().set(id, s),
      get: async (id: PSI) => states.get(a)?.get(id) ?? null,
      remove: async (id: PSI) => void states.get(a)?.delete(id),
      clear: async () => void states.delete(a),
      exportPrivateStates: unsupported('exportPrivateStates'),
      importPrivateStates: unsupported('importPrivateStates'),
    } as ContractPrivateStates<PSI, PS>;
  };
  return {
    forContract,
    clearAll: async () => states.clear(),
    setSigningKey: async (a: ContractAddress, k: SigningKey) => void signingKeys.set(a, k),
    getSigningKey: async (a: ContractAddress) => signingKeys.get(a) ?? null,
    removeSigningKey: async (a: ContractAddress) => void signingKeys.delete(a),
    clearSigningKeys: async () => signingKeys.clear(),
    exportSigningKeys: unsupported('exportSigningKeys'),
    importSigningKeys: unsupported('importSigningKeys'),
  } as PrivateStateProvider<PSI, PS>;
}
