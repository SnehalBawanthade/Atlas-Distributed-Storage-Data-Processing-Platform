/**
 * FNV-1a: a fast, non-cryptographic hash function.
 * Deterministic: the same input string always produces the same output number.
 * Good distribution: small changes in input produce very different outputs,
 * which is what we need to spread keys evenly around the ring.
 */

export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  const prime = 0x01000193;

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, prime);
  }

  hash = hash >>> 0;

  // Finalization step: mix the bits further to fix FNV-1a's weak
  // avalanche behavior for inputs that differ only slightly (e.g.
  // "chunk-0" vs "chunk-1"). This is the same style of finalizer
  // used by MurmurHash to spread small input changes across the
  // entire output.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;

  return hash >>> 0;
}