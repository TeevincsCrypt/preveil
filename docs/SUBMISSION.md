# AKINDO submission text — PRIVEIL

**Project name:** PRIVEIL

**Tagline:** Fund builders. Protect voters.

**One-liner:** Privacy-preserving grant allocation on Midnight. Members vote on proposals with
hidden, unlinkable ballots, and the contract verifiably computes the public funding outcome.

## Description

Grant programs face a trade-off. To prove funds were allocated by the rules, they publish every
member's vote, which exposes members to social pressure, retaliation and bandwagon effects.
PRIVEIL removes the trade-off: **public outcomes, private decisions.**

Each grant round is one deployment of the PRIVEIL Compact contract:

- **Builders** submit proposals. A hash of the document and the funding request go on chain.
- **Members** generate a secret on their own device. The admin enrols only its hash into a
  `MerkleTree` of eligible voters.
- **`castBallot`** proves in zero knowledge that the voter is enrolled (Merkle membership, leaf
  never disclosed), hasn't voted (domain-separated **nullifier**), and chose a valid proposal (only
  `choice < proposalCount` is disclosed). Only the nullifier and a salted `persistentCommit` go on
  chain, so there is **no running tally**.
- After voting closes, ballots are opened and checked against their commitments; the salt stays
  private.
- **`finalize`** is open to anyone. The contract verifies the submitted ranking is the unique correct
  ordering and computes every allocation itself (ranked greedy with quorum and budget).

## What's built (Wave 3)

- `contract/priveil.compact`: 5 circuits; compiles with compactc 0.36.1 (language 0.28),
  including proving keys.
- 44 tests running the compiled contract on compact-runtime: every assert/guard, allocation vs. an
  independent model, and **privacy invariants asserted over the decoded public ledger** (no
  secrets/salts on chain, no ballot linked to a voter, commitments not brute-forceable,
  nullifiers unlinkable across rounds).
- Web app: landing, dashboard, round pages, proposal submission, round creation, private voting
  with a side-by-side private/public view and live privacy scan, sealed results, verified
  allocation, public-ledger explorer. In **Local Simulation** (clearly labelled), the compiled
  contract executes in the browser.
- **Live mode:** deploy and run real rounds on a Midnight test network through Lace (DApp Connector
  API, midnight-js 5.0.1). The wallet makes the ZK proofs; share links carry documents that are
  verified against on-chain hashes. The full transaction lifecycle is tested offline through
  midnight-js's transaction builders.
- `SPEC.md` with the threat model and accepted leaks. CI compiles, tests, builds and runs a
  Playwright end-to-end flow.

## Honest limitations

Opened choices are public under anonymous nullifiers after voting closes. Unrevealed ballots aren't
counted. The admin is trusted for the roster. Wallet proving and submission on a live network
still need a run with a funded Lace wallet. Proofs are not generated in Local Simulation.

## Links

- GitHub: `<repository URL>` (Apache-2.0, topic `midnightntwrk`)
- Demo video: `<link>`
- Pitch deck: `<link>`
