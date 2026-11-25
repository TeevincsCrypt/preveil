# PRIVEIL — 2-minute demo script

**Setup before recording:** `npm run build && npm run preview`, open http://localhost:4173 in a
1440×900 window, zoom 110%. Reload once so the demo is freshly seeded. Have the Wave 3 round's
**Vote** tab ready in a second tab.

---

### 0:00–0:15 · Hook (landing page)

> "Grant programs have a problem. To prove funds were allocated fairly, they publish every member's
> vote. That invites pressure, retaliation and bandwagon voting. PRIVEIL keeps the outcome public
> and each voter's decision private, enforced by a Compact contract on Midnight."

Point at the hero's two panels: **On your device** vs **On the Midnight ledger**.

### 0:15–0:30 · The round (Grant rounds → Privacy Builders Fund · Wave 3)

> "Each grant round is one deployment of our contract. Pool, deadlines and quorum are sealed at
> deployment. Builders submit proposals; only the document hash and request go on chain. This
> banner is honest: this is a local simulation running the compiled contract in the browser.
> Proofs and network submission are skipped."

Show the six proposal cards with **sealed** vote counts.

### 0:30–1:05 · Private voting (Vote tab), the key moment

1. Select **ZK Credential Kit**. Click **Cast private ballot**. Let the steps animate.
   > "My browser runs the castBallot circuit with private inputs: my secret, my Merkle path, my
   > choice. It proves I'm one of 24 members, that I haven't voted, and that my choice is a real
   > proposal."
2. Point left, then right:
   > "Left: what only my device knows. Right: what the ledger got: a nullifier and a sealed
   > commitment. No identity. No choice. The privacy scan searches the whole public state for my
   > secret, my salt and my enrolment key. Nothing."

### 1:05–1:20 · Duplicate-vote prevention

Click **Vote again (different proposal)**, then **Vote with an unenrolled credential**.

> "The same contract rejects a second ballot: 'Already voted in this round'. It also rejects a
> credential that was never enrolled. Both fail before a proof could even be generated."

### 1:20–1:30 · Sealed results

Open **Results**: *Results are sealed.*

> "While voting is open there is no running tally, not even for the admin."

### 1:30–1:50 · Reveal and verified allocation

Simulation controls: **N more members vote** → **Close voting** → (Vote tab) **Reveal & count my
ballot** → **Members open their ballots** → (Results) **Finalize & verify**.

> "After voting closes, ballots are opened under anonymous nullifiers. Anyone can finalize. The
> contract checks the ranking is the one correct ordering and computes every allocation itself.
> Shielded Payroll has more votes but doesn't fit the remaining pool, so it's skipped. That rule
> is enforced on chain, and it's re-checked independently here."

Point at the **Verification** checklist.

### 1:50–2:00 · Close (Public ledger tab)

> "This is everything an indexer sees: entry points and public effects, every ballot by an
> anonymous voter. PRIVEIL: fund builders, protect voters. Compact contract, 44 tests, Apache-2.0."

---

**If time allows (B-roll):** `npm test` output; `compact compile` generating keys for 5 circuits;
the **Create round** form rejecting an invalid timeline with the constructor's assert message.
