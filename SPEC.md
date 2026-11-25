# SPEC — PRIVEIL grant-round contract

`contract/priveil.compact` · Compact language 0.28 · compiler 0.36.1 · Midnight ledger 9

## Purpose

One deployment is one grant round. Builders submit proposals with a funding
request. An admin enrols eligible members into a Merkle tree of voter keys.
Members cast **hidden** ballots: a ZK proof shows the voter is enrolled, has
not voted, and chose a valid proposal, without revealing who they are or what
they chose. After voting closes the ballots are opened and tallied, and a
permissionless `finalize` verifies the ranking and computes every allocation
inside the contract.

## Roles

| Role | Recognised by | Can |
|---|---|---|
| Admin | `adminKey(secretKey) == adminPk` | enrol voters (until voting opens) |
| Builder | anyone, before `submissionEnd` | submit proposals (recorded under a pseudonymous `builderPk`) |
| Voter | a Merkle path from `voterKey(secretKey)` to the `voters` root | cast one ballot per round |
| Anyone | no check | reveal a ballot they hold the opening for; finalize the round |

## Timeline (block time, Unix seconds)

```
deploy ── submissionEnd ≤ votingStart ── votingEnd ── revealEnd ── finalize
 submit + enrol       │  castBallot        │ revealBallot │ (or earlier, once every
                      │                    │              │  cast ballot is revealed)
```

## Public ledger fields

| Field | Type | Written by | Why public |
|---|---|---|---|
| `adminPk` | `Bytes<32>`, sealed | constructor | admin circuits compare against it; a domain-separated hash of the admin secret |
| `roundId` | `Bytes<32>`, sealed | constructor | commits to the round's off-chain metadata; nullifiers and salts are bound to it |
| `fundingPool`, `quorum` | `Uint<64>`, sealed | constructor | the allocation rule's parameters |
| `submissionEnd`, `votingStart`, `votingEnd`, `revealEnd` | `Uint<64>`, sealed | constructor | the phase deadlines every circuit checks |
| `proposals` | `Map<Uint<8>, Proposal>` | `submitProposal` | `{ metadataHash, requested, builderPk }` — what is being funded |
| `proposalHashes` | `Set<Bytes<32>>` | `submitProposal` | rejects duplicate submissions |
| `proposalCount` | `Uint<8>` | `submitProposal` | bounds valid ballot choices (max 8) |
| `voters` | `MerkleTree<10, Bytes<32>>` | `enrolVoter` | ballots prove membership against its root without naming the leaf |
| `voterKeys` | `Set<Bytes<32>>` | `enrolVoter` | rejects double enrolment (the roster is public anyway) |
| `enrolled` | `Counter` | `enrolVoter` | turnout denominator; caps the list at 1024 |
| `ballots` | `Map<Bytes<32>, Bytes<32>>` | `castBallot` | nullifier → `persistentCommit(choice, salt)`; stops double voting, hides the choice |
| `ballotsCast` | `Counter` | `castBallot` | turnout; enables early finalization |
| `revealed` | `Set<Bytes<32>>` | `revealBallot` | stops a ballot being counted twice |
| `ballotsRevealed` | `Counter` | `revealBallot` | enables early finalization |
| `tallies` | `Map<Uint<8>, Uint<64>>` | `revealBallot` | the result; only changes after voting has closed |
| `finalized` | `Boolean` | `finalize` | one finalization per round |
| `ranking` | `Vector<8, Uint<8>>` | `finalize` | the verified ranking |
| `allocations` | `Map<Uint<8>, Uint<64>>` | `finalize` | the funding outcome |
| `totalAllocated`, `remainingBudget` | `Uint<64>` | constructor, `finalize` | audit totals; `remainingBudget` is the running total during `finalize` |

## Private state

Each participant keeps `PriveilPrivateState { secretKey: Bytes<32>; choice?: number }`
(`contract/witnesses.ts`) on their own device. Admin, builder and voter use
separate secrets (`newSecretKey()`); every derived value is domain-separated.

## Witnesses

| Witness | Returns | Source |
|---|---|---|
| `secretKey()` | `Bytes<32>` | private state |
| `voterPath(pk)` | `MerkleTreePath<10, Bytes<32>>` | computed from the public `voters` tree (`findPathForLeaf`) |
| `ballotChoice()` | `Uint<8>` | private state |

## Circuits

| Circuit | Caller | Effect | Asserts |
|---|---|---|---|
| constructor | admin | sets the sealed round config, `adminPk`, `remainingBudget = pool` | `Round id must be set`; `Funding pool must be positive`; `Submissions must close before voting opens`; `Voting must open before it closes`; `Reveal window must end after voting closes`; `Timestamp out of range`; `Quorum must be at least one vote` |
| `submitProposal(metadataHash, requested)` → id | builder | stores the proposal, zero tally and allocation | `Proposal submissions are closed`; `Proposal metadata hash must be set`; `Proposal already submitted`; `Requested amount must be positive`; `Requested amount exceeds the funding pool`; `Round is full (8 proposals max)` |
| `enrolVoter(pk)` | admin | inserts `pk` into `voters` and `voterKeys` | `Only the round admin can do this`; `Enrolment closed when voting opened`; `Voter key must be set`; `Voter already enrolled`; `Voter list is full` |
| `castBallot()` | voter | `ballots[nullifier] = commit(choice, salt)` | `Voting has not opened yet`; `Voting has closed`; `No proposals to vote on`; `Merkle path is not for this voter`; `Not an eligible voter`; `Already voted in this round`; `Ballot is not for a valid proposal` |
| `revealBallot(nullifier, choice, salt)` | anyone with the opening | marks revealed, `tallies[choice] += 1` | `Voting is still open`; `Reveal window has ended`; `No such ballot`; `Ballot already counted`; `Opening does not match the ballot`; `Ballot is not for a valid proposal` |
| `finalize(order)` | anyone | verifies `order`, writes `allocations`, `ranking`, totals | `Round already finalized`; `Voting is still open`; `Reveal window is still open` (unless every cast ballot is revealed); `Ranking names a proposal that does not exist`; `Ranking lists a proposal twice`; `Ranking is not sorted by votes` |

Pure helpers (run off chain, compiled from the same source): `adminKey`,
`voterKey`, `builderKey`, `ballotNullifier`, `ballotSalt`, `ballotCommitment`.

```
voterKey   = persistentHash(["priveil:voter",     sk])
nullifier  = persistentHash(["priveil:nullifier", sk, roundId, kernel.self()])
salt       = persistentHash(["priveil:salt",      sk, roundId, kernel.self()])
commitment = persistentCommit(choice, salt)
```

### Allocation rule (ranked greedy with quorum)

`order` must be the unique ordering of proposals by votes (descending), ties
broken by the lower index. Because that is a strict total order, exactly one
`order` passes the checks, so the caller has no choice to make. Walking it from
the top, a proposal with `votes ≥ quorum` and `requested ≤ remainingBudget`
receives its full request; otherwise it receives nothing and the walk
continues.

## Privacy invariants

Each is asserted over the decoded public ledger in `src/test/privacy.test.ts`.

- Never on chain: any participant's secret key (admin, builder, voter).
- Never on chain: any ballot salt — before or after reveal.
- Never on chain: a link between an enrolled voter key and a ballot.
- While voting is open: no tally changes, and no stored commitment can be
  opened by trying every choice with every public 32-byte value as the salt.
- The same voter's nullifiers differ across rounds (contract instances).

## Accepted leaks (MVP)

- **Opened ballots are public under their nullifier.** After voting closes,
  each `revealBallot` discloses `(nullifier, choice)`. Nothing on chain links a
  nullifier to a voter, but anyone who links the cast or reveal transaction to
  a person (fee payment, network metadata, timing) learns that person's vote.
  With very few voters, a lopsided result can reveal individual votes.
- **Liveness.** A ballot that is never opened is not counted. Any holder of the
  opening can submit it, so a voter can delegate the reveal.
- **Turnout and timing** (`ballotsCast`, block times) are public.
- **Roster.** The admin is trusted to enrol exactly the agreed members; voter
  keys are public. The list freezes when voting opens.
- **No coercion resistance.** A voter can prove how they voted by revealing
  their opening.
- **Circuit names are public** (the indexer shows the entry point), so it is
  public that *someone* voted or revealed.
- **Payouts.** `allocations` are recorded, not transferred.

## Out of scope (roadmap)

Threshold-encrypted ballots (no reveal step), quadratic funding, anonymous
credential issuance, shielded-token payouts, multiple admins.
