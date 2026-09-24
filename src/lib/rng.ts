/**
 * Small deterministic PRNG (mulberry32). The question bank is generated from a
 * fixed seed so that a given release always ships the exact same 600 questions.
 */
export interface Rng {
  next(): number;
  int(minInclusive: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
  bool(probability?: number): boolean;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (minInclusive: number, maxInclusive: number): number =>
    minInclusive + Math.floor(next() * (maxInclusive - minInclusive + 1));

  const pick = <T,>(items: readonly T[]): T => {
    if (items.length === 0) throw new Error('pick() called with an empty list');
    return items[int(0, items.length - 1)]!;
  };

  const shuffle = <T,>(items: readonly T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = int(0, i);
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  };

  const bool = (probability = 0.5): boolean => next() < probability;

  return { next, int, pick, shuffle, bool };
}

/** Deterministic 32-bit hash, used to derive per-test/per-section seeds. */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261;
  const input = parts.join('|');
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
