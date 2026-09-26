/**
 * FNV-1a: a fast, non-cryptographic hash function.
 * Deterministic: the same input string always produces the same output number.
 * Good distribution: small changes in input produce very different outputs,
 * which is what we need to spread keys evenly around the ring.
 */
export function fnv1a(input: string): number {
  // These two constants are standard, fixed values defined by the FNV-1a spec.
  // They are not arbitrary — they were chosen by the algorithm's designers
  // for good distribution properties. We don't need to tune them.
  let hash = 0x811c9dc5; // FNV offset basis
  const prime = 0x01000193; // FNV prime

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // Multiply by the prime, keeping only the lowest 32 bits.
    // Math.imul does 32-bit integer multiplication correctly and fast;
    // a plain `*` would lose precision for numbers this large in JS.
    hash = Math.imul(hash, prime);
  }

  // Force the result to be treated as an unsigned 32-bit integer
  // (JS bitwise ops produce signed 32-bit results by default).
  return hash >>> 0;
}