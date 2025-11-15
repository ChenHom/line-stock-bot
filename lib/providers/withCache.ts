// lib/providers/withCache.ts
import { cacheGet, cacheSet } from '../cache'
import { logger } from '../logger'

export interface CacheConfig {
  /** Cache key generator function */
  keyFn: (...args: any[]) => string
  /** Time to live for fresh data in seconds */
  ttl: number
  /** Optional: whether to enable cache for this call (default: true) */
  enabled?: boolean
  /** Optional: stale-while-revalidate window in seconds (default: ttl) */
  staleWhileRevalidateTtl?: number
}

interface CacheEnvelope<T> {
  data: T
  expiresAt: number
  staleUntil: number
}

/**
 * Wrap a provider function with caching and stale-while-revalidate logic.
 */
type AsyncReturn<T extends (...args: any[]) => Promise<any>> = Awaited<ReturnType<T>>

export function withCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config: CacheConfig
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    if (config.enabled === false) {
      return fn(...args)
    }

    const cacheKey = config.keyFn(...args)
    const staleWindowSeconds = config.staleWhileRevalidateTtl ?? config.ttl
    const storageTtlSeconds = config.ttl + staleWindowSeconds
    const now = Date.now()

    let cachedEnvelope: CacheEnvelope<AsyncReturn<T>> | null = null
    try {
      cachedEnvelope = await readCacheEnvelope<AsyncReturn<T>>(cacheKey)
    } catch (error) {
      logger.warn('cache_read_fallback', { key: cacheKey }, error instanceof Error ? error : String(error))
    }

    if (cachedEnvelope && now <= cachedEnvelope.expiresAt) {
      return cachedEnvelope.data
    }

    const staleCandidate = cachedEnvelope && now <= cachedEnvelope.staleUntil
      ? cachedEnvelope.data
      : null

    try {
      const fresh = await fn(...args)
      await writeCacheEnvelope(cacheKey, fresh, storageTtlSeconds, config.ttl)
      return fresh
    } catch (error) {
      if (staleCandidate) {
        logger.warn('cache_stale_served', { key: cacheKey })
        return markAsStale(staleCandidate)
      }
      throw error
    }
  }) as T
}

async function readCacheEnvelope<T>(key: string): Promise<CacheEnvelope<T> | null> {
  const raw = await cacheGet(key)
  if (raw === null || raw === undefined) {
    return null
  }

  let parsed: any = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch (error) {
      logger.warn('cache_parse_failed', { key }, error instanceof Error ? error : String(error))
      return null
    }
  }

  if (isCacheEnvelope(parsed)) {
    return parsed
  }

  // Legacy cache entry without envelope metadata → treat as forever fresh
  return {
    data: parsed as T,
    expiresAt: Number.MAX_SAFE_INTEGER,
    staleUntil: Number.MAX_SAFE_INTEGER
  }
}

async function writeCacheEnvelope<T>(
  key: string,
  data: T,
  storageTtlSeconds: number,
  freshTtlSeconds: number
) {
  const now = Date.now()
  const freshMs = Math.max(freshTtlSeconds, 1) * 1000
  const storageSeconds = Math.max(storageTtlSeconds, freshTtlSeconds)
  const envelope: CacheEnvelope<T> = {
    data,
    expiresAt: now + freshMs,
    staleUntil: now + storageSeconds * 1000
  }

  try {
    await cacheSet(key, envelope, Math.ceil(storageSeconds))
  } catch (error) {
    logger.warn('cache_write_failed', { key }, error instanceof Error ? error : String(error))
  }
}

function isCacheEnvelope(value: any): value is CacheEnvelope<any> {
  return value && typeof value === 'object' && 'data' in value && 'expiresAt' in value && 'staleUntil' in value
}

function markAsStale<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.defineProperty(value, 'isStale', {
      value: true,
      enumerable: false,
      configurable: true,
      writable: true
    })
  }
  return value
}

export function generateQuoteCacheKey(symbol: string): string {
  const now = Date.now()
  const bucket = Math.floor(now / (45 * 1000))
  return `quote:${symbol}:${bucket}`
}

export function generateNewsCacheKey(keyword: string, limit: number = 5): string {
  const normalized = keyword.trim().toLowerCase() || 'general'
  const now = Date.now()
  const bucket = Math.floor(now / (15 * 60 * 1000))
  return `news:${normalized}:${limit}:${bucket}`
}
