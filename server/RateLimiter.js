/**
 * Per-key token bucket: `capacity` requests, refilled at `perMinute`.
 * Keeps one bad actor from flooding the community database.
 */
export class RateLimiter {
  #buckets = new Map();

  constructor({ capacity = 20, perMinute = 20, now = () => Date.now() } = {}) {
    this.capacity = capacity;
    this.refillPerMs = perMinute / 60_000;
    this.now = now;
  }

  /** Spend one token for `key`. Returns false when the bucket is empty. */
  take(key) {
    const now = this.now();
    const bucket = this.#buckets.get(key) ?? { tokens: this.capacity, updated: now };
    bucket.tokens = Math.min(this.capacity, bucket.tokens + (now - bucket.updated) * this.refillPerMs);
    bucket.updated = now;
    const allowed = bucket.tokens >= 1;
    if (allowed) bucket.tokens -= 1;
    this.#buckets.set(key, bucket);
    if (this.#buckets.size > 10_000) this.#prune(now);
    return allowed;
  }

  #prune(now) {
    for (const [key, bucket] of this.#buckets) {
      if (now - bucket.updated > 10 * 60_000) this.#buckets.delete(key);
    }
  }
}
