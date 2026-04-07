// Tiny seeded PRNG (mulberry32) + chunk hash helper.
// Used to make world/yeti generation reproducible across clients in multiplayer.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash (seed, cx, cy) -> u32. Used to derive a per-chunk RNG seed.
export function hashChunk(seed, cx, cy) {
  let h = (seed >>> 0) ^ 0x9E3779B9;
  h = Math.imul(h ^ (cx + 0x85EBCA6B), 0xC2B2AE35);
  h = Math.imul(h ^ (cy + 0x27D4EB2F), 0x165667B1);
  h ^= h >>> 16;
  return h >>> 0;
}
