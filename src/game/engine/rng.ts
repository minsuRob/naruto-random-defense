/**
 * Seeded RNG (mulberry32).
 *
 * Every random draw in the engine goes through one of these so a run is
 * reproducible from its seed — needed for the determinism test today and for
 * lockstep multiplayer later.
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** True with the given probability (0..1). */
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Pick by weight; `weightOf` must return a non-negative number. */
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T;
  /** Current internal state, for snapshotting. */
  state(): number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;

  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (maxExclusive) => Math.floor(next() * maxExclusive),
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
    weighted(items, weightOf) {
      let total = 0;
      for (const item of items) total += weightOf(item);
      if (total <= 0) return items[0];
      let roll = next() * total;
      for (const item of items) {
        roll -= weightOf(item);
        if (roll < 0) return item;
      }
      return items[items.length - 1];
    },
    state: () => a,
  };
}
