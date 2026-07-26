/**
 * Simple in-memory TTL cache to reduce redundant Firestore reads.
 * 
 * On serverless (Vercel), this cache lives within a single warm instance.
 * Multiple concurrent requests to the same instance will share the cache,
 * dramatically cutting Firestore reads when many clients poll simultaneously.
 * 
 * TTLs are kept short (5-15s) so data stays near real-time while avoiding
 * hammering Firestore on every single request.
 */

class MemoryCache {
  constructor() {
    this.store = new Map();
  }

  /**
   * Get a cached value. Returns null if expired or not found.
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  /**
   * Set a value with a TTL in milliseconds (default 10s).
   */
  set(key, value, ttlMs = 10000) {
    this.store.set(key, {
      value,
      expiry: Date.now() + ttlMs
    });
  }

  /**
   * Remove a specific key from the cache.
   */
  invalidate(key) {
    this.store.delete(key);
  }

  /**
   * Remove all keys that start with a given prefix.
   * Useful for invalidating all election-related caches when a vote is cast.
   */
  invalidatePrefix(prefix) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get a value, or compute and cache it if not present.
   * This is the primary method for cache-through reads.
   * @param {string} key Cache key
   * @param {Function} fetchFn Async function that returns the value to cache
   * @param {number} ttlMs TTL in milliseconds
   */
  async getOrSet(key, fetchFn, ttlMs = 10000) {
    const cached = this.get(key);
    if (cached !== null) return cached;

    const value = await fetchFn();
    this.set(key, value, ttlMs);
    return value;
  }
}

const cache = new MemoryCache();
module.exports = cache;
