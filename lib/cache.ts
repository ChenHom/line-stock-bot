// lib/cache.ts
import { Redis } from '@upstash/redis'
import { logger } from './logger'
import { metrics } from './monitoring'

let redisClient: Redis | null = null

/**
 * Get or create the Redis client singleton
 */
function getRedisClient(): Redis | null {
  if (redisClient) return redisClient

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    logger.warn('cache_config_missing', { message: 'Redis credentials not configured. Caching disabled.' })
    return null
  }

  try {
    redisClient = new Redis({ url, token })
    return redisClient
  } catch (error) {
    logger.error('cache_init_failed', {}, error instanceof Error ? error : String(error))
    return null
  }
}

/**
 * Get a value from cache
 * @param key Cache key
 * @returns Cached value or null if not found/error
 */
export async function cacheGet<T = any>(key: string): Promise<T | null> {
  const client = getRedisClient()
  if (!client) return null

  try {
    const value = await client.get(key)
    if (value !== null) {
      logger.cacheHit(key)
      metrics.recordCacheHit()
    } else {
      logger.cacheMiss(key)
      metrics.recordCacheMiss()
    }
    return value as T | null
  } catch (error) {
    logger.cacheError('get', error instanceof Error ? error : String(error))
    metrics.recordCacheError()
    return null
  }
}

/**
 * Set a value in cache with TTL
 * @param key Cache key
 * @param value Value to cache (will be JSON serialized)
 * @param ttlSeconds Time to live in seconds
 */
export async function cacheSet(key: string, value: any, ttlSeconds: number): Promise<void> {
  const client = getRedisClient()
  if (!client) return

  try {
    await client.setex(key, ttlSeconds, JSON.stringify(value))
  } catch (error) {
    logger.cacheError('set', error instanceof Error ? error : String(error))
    metrics.recordCacheError()
  }
}

/**
 * Delete a value from cache
 * @param key Cache key
 */
export async function cacheDel(key: string): Promise<void> {
  const client = getRedisClient()
  if (!client) return

  try {
    await client.del(key)
  } catch (error) {
    logger.cacheError('delete', error instanceof Error ? error : String(error))
  }
}

/**
 * Check if cache is available
 */
export function isCacheAvailable(): boolean {
  return getRedisClient() !== null
}
