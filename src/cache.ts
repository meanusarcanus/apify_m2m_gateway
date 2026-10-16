/**
 * In-Memory High-Performance TTL Cache for Apify Scraper Results.
 * Enables sub-15ms response times for repeated machine queries
 * and eliminates redundant Apify compute costs.
 */
interface CacheEntry {
  data: unknown;
  expiresAt: number;
  itemsCount: number;
}

export class ScraperCache {
  private cache = new Map<string, CacheEntry>();
  private defaultTtlMs: number;

  constructor(defaultTtlSeconds = 900) { // 15 minutes default TTL
    this.defaultTtlMs = defaultTtlSeconds * 1000;
  }

  private generateKey(endpoint: string, input: Record<string, unknown>): string {
    const sortedKeys = Object.keys(input).sort();
    const normalizedInput: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      normalizedInput[key] = input[key];
    }
    return `${endpoint}:${JSON.stringify(normalizedInput)}`;
  }

  get(endpoint: string, input: Record<string, unknown>): { hit: boolean; data?: unknown; itemsCount?: number } {
    const key = this.generateKey(endpoint, input);
    const entry = this.cache.get(key);

    if (!entry) {
      return { hit: false };
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return { hit: false };
    }

    return { hit: true, data: entry.data, itemsCount: entry.itemsCount };
  }

  set(endpoint: string, input: Record<string, unknown>, data: unknown, itemsCount: number, ttlSeconds?: number): void {
    const key = this.generateKey(endpoint, input);
    const ttl = (ttlSeconds ? ttlSeconds * 1000 : this.defaultTtlMs);
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
      itemsCount,
    });
  }

  clear(): void {
    this.cache.clear();
  }
}
