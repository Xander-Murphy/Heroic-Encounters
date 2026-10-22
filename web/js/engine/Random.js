/**
 * Small seedable random number generator (mulberry32).
 *
 * Every random choice in a run goes through one of these, so a seed fully
 * determines a run. That is what lets everyone play the same daily challenge
 * and lets tests make enemy choices repeatable.
 */
export class Random {
  #state;

  constructor(seed = Date.now()) {
    this.seed = seed >>> 0;
    this.#state = this.seed;
  }

  static fromString(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return new Random(hash >>> 0);
  }

  /** Float in [0, 1). */
  next() {
    this.#state = (this.#state + 0x6d2b79f5) >>> 0;
    let t = this.#state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [0, max). */
  int(max) {
    return Math.floor(this.next() * max);
  }

  /** Integer in [min, max], inclusive. */
  between(min, max) {
    return min + this.int(max - min + 1);
  }

  pick(items) {
    return items[this.int(items.length)];
  }

  chance(probability) {
    return this.next() < probability;
  }

  shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}
