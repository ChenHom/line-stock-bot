// tests/unit/providers/cache.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withCache, generateQuoteCacheKey, generateNewsCacheKey } from '../../../lib/providers/withCache'
import * as cache from '../../../lib/cache'

describe('Cache Wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const buildEnvelope = (value: any, freshMs = 60000, staleMs = 120000) => ({
    data: value,
    expiresAt: Date.now() + freshMs,
    staleUntil: Date.now() + staleMs
  })

  describe('withCache', () => {
    it('should return cached value when available', async () => {
      const mockFn = vi.fn().mockResolvedValue({ data: 'fresh' })
      const cacheGetSpy = vi.spyOn(cache, 'cacheGet').mockResolvedValue(buildEnvelope({ data: 'cached' }))
      const cacheSetSpy = vi.spyOn(cache, 'cacheSet').mockResolvedValue()

      const cachedFn = withCache(mockFn, {
        keyFn: (arg: string) => `test:${arg}`,
        ttl: 60
      })

      const result = await cachedFn('key1')

      expect(result).toEqual({ data: 'cached' })
      expect(cacheGetSpy).toHaveBeenCalledWith('test:key1')
      expect(mockFn).not.toHaveBeenCalled()
      expect(cacheSetSpy).not.toHaveBeenCalled()
    })

    it('should call function and cache result when cache miss', async () => {
      const mockFn = vi.fn().mockResolvedValue({ data: 'fresh' })
      const cacheGetSpy = vi.spyOn(cache, 'cacheGet').mockResolvedValue(null)
      const cacheSetSpy = vi.spyOn(cache, 'cacheSet').mockResolvedValue()

      const cachedFn = withCache(mockFn, {
        keyFn: (arg: string) => `test:${arg}`,
        ttl: 60
      })

      const result = await cachedFn('key1')

      expect(result).toEqual({ data: 'fresh' })
      expect(cacheGetSpy).toHaveBeenCalledWith('test:key1')
      expect(mockFn).toHaveBeenCalledWith('key1')
      expect(cacheSetSpy).toHaveBeenCalled()
    })

    it('should fallback to function when cache read fails', async () => {
      const mockFn = vi.fn().mockResolvedValue({ data: 'fresh' })
      const cacheGetSpy = vi.spyOn(cache, 'cacheGet').mockRejectedValue(new Error('Cache error'))
      const cacheSetSpy = vi.spyOn(cache, 'cacheSet').mockResolvedValue()

      const cachedFn = withCache(mockFn, {
        keyFn: (arg: string) => `test:${arg}`,
        ttl: 60
      })

      const result = await cachedFn('key1')

      expect(result).toEqual({ data: 'fresh' })
      expect(mockFn).toHaveBeenCalledWith('key1')
      expect(cacheSetSpy).toHaveBeenCalled()
    })

    it('should not block when cache write fails', async () => {
      const mockFn = vi.fn().mockResolvedValue({ data: 'fresh' })
      const cacheGetSpy = vi.spyOn(cache, 'cacheGet').mockResolvedValue(null)
      const cacheSetSpy = vi.spyOn(cache, 'cacheSet').mockRejectedValue(new Error('Write error'))

      const cachedFn = withCache(mockFn, {
        keyFn: (arg: string) => `test:${arg}`,
        ttl: 60
      })

      const result = await cachedFn('key1')

      expect(result).toEqual({ data: 'fresh' })
      expect(mockFn).toHaveBeenCalledWith('key1')
    })

    it('should bypass cache when enabled=false', async () => {
      const mockFn = vi.fn().mockResolvedValue({ data: 'fresh' })
      const cacheGetSpy = vi.spyOn(cache, 'cacheGet')
      const cacheSetSpy = vi.spyOn(cache, 'cacheSet')

      const cachedFn = withCache(mockFn, {
        keyFn: (arg: string) => `test:${arg}`,
        ttl: 60,
        enabled: false
      })

      const result = await cachedFn('key1')

      expect(result).toEqual({ data: 'fresh' })
      expect(mockFn).toHaveBeenCalledWith('key1')
      expect(cacheGetSpy).not.toHaveBeenCalled()
      expect(cacheSetSpy).not.toHaveBeenCalled()
    })

    it('should return stale cache when fetch fails and stale data exists', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Provider down'))
      const staleEnvelope = {
        data: { data: 'stale' },
        expiresAt: Date.now() - 1000,
        staleUntil: Date.now() + 5000
      }
      vi.spyOn(cache, 'cacheGet').mockResolvedValue(staleEnvelope)

      const cachedFn = withCache(mockFn, {
        keyFn: (arg: string) => `test:${arg}`,
        ttl: 1
      })

      const result = await cachedFn('key1') as any

      expect(result).toEqual({ data: 'stale' })
      expect(result.isStale).toBe(true)
    })
  })

  describe('generateQuoteCacheKey', () => {
    it('should generate time-bucketed cache key for quotes', () => {
      const key1 = generateQuoteCacheKey('2330')
      expect(key1).toMatch(/^quote:2330:\d+$/)

      // Same symbol within 45s should have same bucket
      const key2 = generateQuoteCacheKey('2330')
      expect(key1).toBe(key2)
    })

    it('should generate different keys for different symbols', () => {
      const key1 = generateQuoteCacheKey('2330')
      const key2 = generateQuoteCacheKey('2454')
      expect(key1).not.toBe(key2)
    })
  })

  describe('generateNewsCacheKey', () => {
    it('should generate time-bucketed cache key for news', () => {
      const key1 = generateNewsCacheKey('半導體', 5)
      expect(key1).toMatch(/^news:半導體:5:\d+$/)

      const key2 = generateNewsCacheKey('半導體', 5)
      expect(key1).toBe(key2)
    })

    it('should generate different keys for different keywords or limits', () => {
      const key1 = generateNewsCacheKey('半導體', 5)
      const key2 = generateNewsCacheKey('電子', 5)
      const key3 = generateNewsCacheKey('半導體', 10)

      expect(key1).not.toBe(key2)
      expect(key1).not.toBe(key3)
    })
  })
})
