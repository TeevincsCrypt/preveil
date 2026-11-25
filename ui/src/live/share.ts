// Share links for live rounds.
//
// The chain stores only hashes of the round metadata (roundId) and of each
// proposal document (metadataHash). A share link carries the documents
// themselves, base64url-encoded in the URL. Whoever opens it re-hashes every
// document and accepts it ONLY if it matches the on-chain hash, so a link
// can't smuggle in an edited proposal.

import { hashMetadata, toHex } from '@contract/crypto';
import type { Ledger } from '@contract/managed/priveil/contract/index.js';
import type { OffChain } from './vault';

const b64url = {
  encode(s: string) {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(s: string) {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  },
};

export const encodeOffChain = (o: OffChain) => b64url.encode(JSON.stringify(o));

export function decodeOffChain(s: string): OffChain | null {
  try {
    const o = JSON.parse(b64url.decode(s)) as OffChain;
    return o && typeof o === 'object' ? { meta: o.meta, docs: o.docs ?? {} } : null;
  } catch {
    return null;
  }
}

/** Keeps only the documents whose hash matches the on-chain record. */
export async function verifyOffChain(o: OffChain, l: Ledger): Promise<{ accepted: OffChain; rejected: number }> {
  let rejected = 0;
  const accepted: OffChain = { docs: {} };
  if (o.meta) {
    if (toHex(await hashMetadata(o.meta)) === toHex(l.roundId)) accepted.meta = o.meta;
    else rejected++;
  }
  for (const [i, doc] of Object.entries(o.docs)) {
    const id = BigInt(i);
    if (l.proposals.member(id) && toHex(await hashMetadata(doc)) === toHex(l.proposals.lookup(id).metadataHash)) accepted.docs[Number(i)] = doc;
    else rejected++;
  }
  return { accepted, rejected };
}
