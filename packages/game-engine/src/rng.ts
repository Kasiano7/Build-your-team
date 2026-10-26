/**
 * Deterministic PRNG (mulberry32). The state lives in the room state so draws
 * are reproducible from the persisted snapshot and auditable in tests.
 */
export function nextRandom(state: number): { value: number; state: number } {
  let t = (state + 0x6d2b79f5) >>> 0;
  const nextState = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: nextState };
}

/** Weighted pick. Returns the chosen index and the advanced RNG state. */
export function weightedPick(weights: number[], state: number): { index: number; state: number } {
  const total = weights.reduce((a, b) => a + b, 0);
  const r = nextRandom(state);
  let target = r.value * total;
  for (let i = 0; i < weights.length; i++) {
    target -= weights[i]!;
    if (target < 0) return { index: i, state: r.state };
  }
  return { index: weights.length - 1, state: r.state };
}
