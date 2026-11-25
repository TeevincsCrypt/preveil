// Deterministic byte generator for DEMO data only, so the seeded demo is
// identical on every load. Real participant secrets use crypto.getRandomValues
// (contract/crypto.ts → newSecretKey).

export function seededBytes(seed: string): (n: number) => Uint8Array {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  let state = h || 1;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) & 0xff;
  };
  return (n) => Uint8Array.from({ length: n }, next);
}
