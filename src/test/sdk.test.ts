// Offline integration test of the LIVE path: builds real (unproven) Midnight
// transactions with midnight-js 5.0.1 from the compiled contract, our
// witnesses and the committed ZK assets — the same SDK code the browser's
// Live mode runs before the wallet proves and submits. No network needed.
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createUnprovenCallTxFromInitialStates, createUnprovenDeployTxFromVerifierKeys } from '@midnight-ntwrk/midnight-js-contracts';
import { SerializedContractState, SerializedLedgerParameters, SerializedZswapChainState } from '@midnight-ntwrk/midnight-js-types';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/v9/compact-js';
import { LedgerParameters, ZswapChainState, sampleCoinPublicKey, sampleEncryptionPublicKey, sampleSigningKey } from '@midnight-ntwrk/midnight-js-protocol/v9';
import { ChargedState, ContractState } from '@midnight-ntwrk/midnight-js-protocol/v9/compact-runtime';
import { Contract, ledger } from '../../contract/managed/priveil/contract/index.js';
import { witnesses } from '../../contract/witnesses.js';
import { adminKey, ballotOpening, canonicalRanking, newSecretKey, voterKey } from '../../contract/crypto.js';

const ASSETS = path.resolve(__dirname, '../../contract/managed/priveil');
const zk = new FetchZkConfigProvider<string>('http://assets.local/managed/priveil', {
  fetchFunc: (async (url: string | URL) => {
    const rel = String(url).replace('http://assets.local/managed/priveil/', '');
    try {
      return new Response(await readFile(path.join(ASSETS, rel)));
    } catch {
      return new Response(null, { status: 404 });
    }
  }) as typeof fetch,
});

const Compiled = CompiledContract.make('PriveilContract', Contract).pipe(
  CompiledContract.withWitnesses(witnesses as never),
  CompiledContract.withCompiledFileAssets(ASSETS),
);

describe('midnight-js integration (offline)', () => {
  it('builds an unproven deploy transaction for a round', async () => {
    const adminSk = newSecretKey();
    const now = BigInt(Math.floor(Date.now() / 1000));
    const out = (await createUnprovenDeployTxFromVerifierKeys(
      zk as never,
      sampleCoinPublicKey(),
      {
        compiledContract: Compiled,
        signingKey: sampleSigningKey(),
        initialPrivateState: { secretKey: adminSk },
        args: [new Uint8Array(32).fill(1), 1000n, now + 600n, now + 600n, now + 1200n, now + 1800n, 1n],
      } as never,
      sampleEncryptionPublicKey(),
      { networkId: 'undeployed', ttlSeconds: 3600 } as never,
    )) as unknown as { public: Record<string, unknown>; private: Record<string, unknown> };
    expect(typeof out.public.contractAddress).toBe('string');
    // Decoded exactly as ui/src/midnight/network.ts contractStateData() does.
    const st = out.public.initialContractState as { era: string; deserialize: (d: unknown) => { data: never } };
    expect(st.era).toBe('v9');
    const l = ledger(st.deserialize({ v9: ContractState }).data);
    expect(l.adminPk).toEqual(adminKey(adminSk));
    expect(l.fundingPool).toBe(1000n);
  });

  it('runs a full round lifecycle through the SDK call path', async () => {
    const coin = sampleCoinPublicKey();
    const enc = sampleEncryptionPublicKey();
    const config = { networkId: 'undeployed', ttlSeconds: 3600 } as never;
    const zswap = SerializedZswapChainState.fromBytes('v9', new ZswapChainState().serialize());
    const params = SerializedLedgerParameters.fromBytes('v9', LedgerParameters.initialParameters().serialize());
    const sleepUntil = async (t: bigint) => {
      while (BigInt(Math.floor(Date.now() / 1000)) <= t) await new Promise((r) => setTimeout(r, 250));
    };

    const adminSk = newSecretKey();
    const voters = [newSecretKey(), newSecretKey()];
    const now = BigInt(Math.floor(Date.now() / 1000));
    const votingStart = now + 4n;
    const votingEnd = votingStart + 4n;
    const deployed = (await createUnprovenDeployTxFromVerifierKeys(
      zk as never,
      coin,
      { compiledContract: Compiled, signingKey: sampleSigningKey(), initialPrivateState: { secretKey: adminSk }, args: [new Uint8Array(32).fill(2), 1000n, votingStart, votingStart, votingEnd, votingEnd + 600n, 1n] } as never,
      enc,
      config,
    )) as unknown as { public: { contractAddress: string; initialContractState: SerializedContractState } };
    const address = deployed.public.contractAddress;
    // A template ContractState (operations, maintenance authority) whose data we swap per step.
    const template = deployed.public.initialContractState.deserialize({ v9: ContractState } as never) as unknown as InstanceType<typeof ContractState>;
    let state: SerializedContractState = deployed.public.initialContractState;

    const call = async (circuitId: string, secretKey: Uint8Array, args: unknown[], choice?: number) => {
      const out = (await createUnprovenCallTxFromInitialStates(
        zk as never,
        {
          compiledContract: Compiled,
          circuitId,
          contractAddress: address,
          coinPublicKey: coin,
          initialContractState: state,
          initialZswapChainState: zswap,
          ledgerParameters: params,
          initialPrivateState: choice === undefined ? { secretKey } : { secretKey, choice },
          ...(args.length ? { args } : {}),
          config,
        } as never,
        enc,
      )) as unknown as { public: { nextContractState: unknown } };
      template.data = new ChargedState(out.public.nextContractState as never);
      state = SerializedContractState.fromBytes('v9', template.serialize());
      return ledger(template.data);
    };

    for (const v of voters) await call('enrolVoter', adminSk, [voterKey(v)]);
    await call('submitProposal', newSecretKey(), [new Uint8Array(32).fill(7), 400n]);
    let l = await call('submitProposal', newSecretKey(), [new Uint8Array(32).fill(8), 300n]);
    expect(l.enrolled).toBe(2n);
    expect(l.proposalCount).toBe(2n);

    await sleepUntil(votingStart);
    await call('castBallot', voters[0], [], 1);
    l = await call('castBallot', voters[1], [], 1);
    expect(l.ballotsCast).toBe(2n);
    await expect(call('castBallot', voters[0], [], 0)).rejects.toThrow(/Already voted/);

    await sleepUntil(votingEnd);
    for (const v of voters) {
      const o = ballotOpening(v, 1, l.roundId, address);
      l = await call('revealBallot', newSecretKey(), [o.nullifier, BigInt(o.choice), o.salt]);
    }
    expect(l.tallies.lookup(1n)).toBe(2n);
    l = await call('finalize', newSecretKey(), [canonicalRanking([0n, 2n])]);
    expect(l.finalized).toBe(true);
    expect(l.allocations.lookup(1n)).toBe(300n);
    expect(l.allocations.lookup(0n)).toBe(0n);
  }, 60_000);
});
