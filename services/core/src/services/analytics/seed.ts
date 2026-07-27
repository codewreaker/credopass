/**
 * Deterministic PRNG behind the fabricated analytics.
 *
 * The same `scope|range` always produces the same believable numbers, which
 * buys two things: re-fetches don't make the dashboard flicker, and a demo
 * shows the same figures twice. Pure — no framework, no DB — so this folder can
 * be lifted into a standalone service, or replaced by real aggregates, without
 * anything above it changing.
 */

/** Hash a string into a 32-bit seed (xmur3). */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** mulberry32 — small, fast, well-distributed. */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seeded random source with helpers for believable fabricated data. */
export class Rng {
  private next: () => number;

  constructor(seed: string) {
    const hash = xmur3(seed);
    this.next = mulberry32(hash());
  }

  /** Float in [0, 1). */
  float(): number {
    return this.next();
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** True with the given probability. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Pick one element. */
  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  /**
   * A smooth-ish walk of `count` values around `base` (±`spread`), so time
   * series look organic rather than random noise.
   */
  walk(count: number, base: number, spread: number, min = 0, max = Infinity): number[] {
    const out: number[] = [];
    let v = base;
    for (let i = 0; i < count; i++) {
      v += this.range(-spread, spread);
      v = Math.max(min, Math.min(max, v));
      out.push(Math.round(v));
    }
    return out;
  }
}
