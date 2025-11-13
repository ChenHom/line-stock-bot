// lib/providers/withCache.ts
import { cacheGet, cacheSet } from '../cache'
import { logger } from '../logger'

export interface CacheConfig {
  /** Cache key generator function */
  keyFn: (...args: any[]) => string
  /** Time to live in seconds */
  ttl: number
  /** Optional: whether to enable cache for this call (default: true) */
  enabled?: boolean
}

/**
 * Wrap a provider function with caching logic
 * @param fn The provider function to wrap
 * @param config Cache configuration
 * @returns Cached wrapper function
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config: CacheConfig
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const enabled = config.enabled !== false

    if (!enabled) {
      return fn(...args)
    }

    const cacheKey = config.keyFn(...args)

    // Try to get from cache first
    try {
      const cached = await cacheGet(cacheKey)
      if (cached !== null) {
        // Parse cached JSON string back to object
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached
        return parsed as ReturnType<T>
      }
    } catch (error) {
      logger.warn('cache_read_fallback', { key: cacheKey }, error instanceof Error ? error : String(error))
    }

    // Cache miss or error - call the actual function
    const result = await fn(...args)

    // Store in cache (fire and forget)
    try {
      await cacheSet(cacheKey, result, config.ttl)
    } catch (error) {
      logger.warn('cache_write_failed', { key: cacheKey }, error instanceof Error ? error : String(error))
    }

    return result
  }) as T
}

/**
 * Generate a cache key with time bucket for quote data
 * Quote TTL is 45 seconds, so we bucket by 45-second intervals
 */
export function generateQuoteCacheKey(symbol: string): string {
  const now = Date.now()
  const bucket = Math.floor(now / (45 * 1000)) // 45-second buckets
  return `quote:${symbol}:${bucket}`
}

/**
 * Generate a cache key with time bucket for news data
 * News TTL is 15 minutes (900 seconds), so we bucket by 15-minute intervals
 */
export function generateNewsCacheKey(keyword: string, limit: number = 5): string {
  const now = Date.now()
  const bucket = Math.floor(now / (15 * 60 * 1000)) // 15-minute buckets
  return `news:${keyword}:${limit}:${bucket}`
}
