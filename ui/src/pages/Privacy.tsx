import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Page } from '@/components/Layout';
import { Card, PrivateTag, PublicTag, SectionHeader } from '@/components/ui';

const FIELDS: Array<[string, string, 'public' | 'private']> = [
  ['Round rules: pool, deadlines, quorum, admin key hash', 'sealed at deployment so nobody can change them', 'public'],
  ['Proposals: metadata hash, requested amount, builder key', 'what is being funded, verifiable against the document', 'public'],
  ['Eligibility: Merkle tree of voter keys', 'the roster is public; who is who inside it isn’t revealed by voting', 'public'],
  ['Ballots: nullifier → commitment', 'prevents double voting; hides the choice', 'public'],
  ['Opened ballots: nullifier, choice; tallies; allocations', 'the outcome, after voting closes', 'public'],
  ['Each participant’s secret key', 'derives voter key, nullifier and salt', 'private'],
  ['Which enrolled key cast which ballot', 'the Merkle proof never names the leaf', 'private'],
  ['Ballot choice while voting is open', 'only a salted commitment is stored', 'private'],
  ['Ballot salt', 'checked inside the circuit, never written', 'private'],
];

const FORMULAS = [
  ['voterKey', 'H("priveil:voter", sk)', 'sent to the admin for enrolment'],
  ['nullifier', 'H("priveil:nullifier", sk, roundId, contractAddress)', 'one per voter per round; unlinkable to voterKey'],
  ['salt', 'H("priveil:salt", sk, roundId, contractAddress)', 'never leaves the circuit'],
  ['commitment', 'Commit(choice, salt)', 'hides the choice until opened'],
];

export function Privacy() {
  return (
    <Page className="max-w-5xl">
      <SectionHeader eyebrow="How privacy works" title="The contract enforces the privacy boundary.">
        PRIVEIL is one Compact contract per grant round. Its circuits run on the voter’s device with private inputs, and only a zero-knowledge proof plus the minimum public data reach the Midnight ledger.
      </SectionHeader>

      <Card className="mt-12 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto] gap-x-6 border-b border-line bg-raised px-5 py-3 text-xs uppercase tracking-[0.14em] text-faint">
          <span>Information</span>
          <span>Where it lives</span>
        </div>
        {FIELDS.map(([what, why, where]) => (
          <div key={what} className="grid grid-cols-[1fr_auto] items-center gap-x-6 border-b border-line px-5 py-3.5 last:border-0">
            <div>
              <div className="text-sm">{what}</div>
              <div className="mt-0.5 text-xs text-muted">{why}</div>
            </div>
            {where === 'public' ? <PublicTag /> : <PrivateTag />}
          </div>
        ))}
      </Card>

      <h2 className="mt-16 text-sm font-medium uppercase tracking-[0.14em] text-faint">What castBallot proves</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {[
          ['Membership', 'The voter knows a secret whose voterKey is a leaf of the eligibility tree. Only the root is checked, so the leaf — the voter — stays hidden among every enrolled member.'],
          ['Uniqueness', 'The nullifier is computed from that same secret. If it is already in the ledger, the circuit rejects: one ballot per member per round.'],
          ['Validity', 'The hidden choice is less than the number of proposals. Only the fact that it is valid is disclosed, not the choice.'],
          ['Binding', 'The stored commitment is Commit(choice, salt), so the ballot can later be opened only to the choice that was cast.'],
        ].map(([t, b]) => (
          <Card key={t} className="p-5">
            <h3 className="text-sm font-medium">{t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{b}</p>
          </Card>
        ))}
      </div>

      <h2 className="mt-16 text-sm font-medium uppercase tracking-[0.14em] text-faint">Derivations</h2>
      <Card className="mt-4 divide-y divide-line">
        {FORMULAS.map(([k, f, n]) => (
          <div key={k} className="grid gap-1 px-5 py-4 sm:grid-cols-[8rem_1fr_auto] sm:items-center sm:gap-6">
            <span className="text-sm text-private">{k}</span>
            <code className="font-mono text-[13px] text-fg">{f}</code>
            <span className="text-xs text-muted">{n}</span>
          </div>
        ))}
        <div className="px-5 py-3 text-xs text-faint">H = persistentHash, Commit = persistentCommit (Compact standard library). Each role uses a separate domain tag.</div>
      </Card>

      <h2 className="mt-16 text-sm font-medium uppercase tracking-[0.14em] text-faint">After voting closes</h2>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">
        Anyone holding a ballot’s opening — the voter’s client, or a tally agent the voter handed it to — calls <span className="font-mono text-fg">revealBallot(nullifier, choice, salt)</span>. The circuit checks the opening against the stored commitment; the salt is a private input and is not published. Then <span className="font-mono text-fg">finalize(ranking)</span> verifies that the submitted ranking is the unique ordering by votes and applies the allocation rule inside the contract.
      </p>

      <div className="mt-16 grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-warn">Accepted leaks in this MVP</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            <li>· Once opened, a choice is public under its nullifier. Nothing on chain links a nullifier to a voter, but network metadata could.</li>
            <li>· Turnout and the time of each ballot are public.</li>
            <li>· With very few voters, a unanimous result reveals every vote.</li>
            <li>· A voter can prove how they voted (no coercion resistance yet).</li>
            <li>· The admin is trusted to enrol the agreed roster.</li>
          </ul>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-ok">Tested, not just claimed</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            <li>· No secret key or salt appears anywhere in public state — before and after reveal.</li>
            <li>· No ballot is linked to an enrolled voter key.</li>
            <li>· Sealed commitments can’t be opened by brute force over public data.</li>
            <li>· The same voter’s nullifiers differ across rounds.</li>
            <li>· Every guard (double vote, forged path, foreign tree, deadlines…) is triggered by a test.</li>
          </ul>
        </Card>
      </div>

      <Link to="/rounds/privacy-builders-wave-3/vote" className="mt-14 inline-flex items-center gap-2 rounded-xl bg-fg px-5 py-3 text-sm font-medium text-bg hover:bg-white">
        Try it in the open round <ArrowRight className="size-4" />
      </Link>
    </Page>
  );
}
