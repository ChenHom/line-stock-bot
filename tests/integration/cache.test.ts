// tests/integration/cache.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getQuoteWithFallback, getIndustryNews } from '../../lib/providers'
import * as cache from '../../lib/cache'

describe('Cache Performance Tests', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = {
      ...originalEnv,
      UPSTASH_REDIS_REST_URL: 'https://test-redis.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'test-token',
    }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('Quote Caching', () => {
    it('should cache quote results and return within 1s on repeated queries', async () => {
      // Mock TWSE API (empty to trigger fallback)
      const mockFetch = vi.fn()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ Code: 0, Data: [] }),
        text: async () => '{}',
      })

      // Mock Yahoo fallback
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          quoteResponse: {
            result: [
              {
                symbol: '2330.TW',
                regularMarketPrice: 580,
                regularMarketChange: 5,
                regularMarketChangePercent: 0.87,
                regularMarketVolume: 13999,
                regularMarketOpen: 575,
                regularMarketDayHigh: 582,
                regularMarketDayLow: 574,
                regularMarketPreviousClose: 575,
              },
            ],
          },
        }),
        text: async () => '{}',
      })
      global.fetch = mockFetch as any

      // Spy on cache functions
      const cacheGetSpy = vi.spyOn(cache, 'cacheGet')
      const cacheSetSpy = vi.spyOn(cache, 'cacheSet').mockResolvedValue()

      // First call: cache miss (return null for all cache gets)
      cacheGetSpy.mockResolvedValue(null)

      const start1 = Date.now()
      const quote1 = await getQuoteWithFallback('2330')
      const duration1 = Date.now() - start1

      expect(quote1.symbol).toBe('2330')
      expect(mockFetch).toHaveBeenCalledTimes(2) // TWSE + Yahoo
      expect(cacheSetSpy).toHaveBeenCalled()

      // Second call: cache hit (return cached quote for all cache gets)
      cacheGetSpy.mockResolvedValue(quote1)

      const start2 = Date.now()
      const quote2 = await getQuoteWithFallback('2330')
      const duration2 = Date.now() - start2

      expect(quote2).toEqual(quote1)
      expect(mockFetch).toHaveBeenCalledTimes(2) // No additional fetch (cache hit)
      expect(cacheGetSpy).toHaveBeenCalled()

      // Cache hit should be faster than 1000ms
      expect(duration2).toBeLessThan(1000)
    }, 10000)

    it('should handle cache miss and call provider', async () => {
      // Mock TWSE API (empty)
      const mockFetch = vi.fn()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ Code: 0, Data: [] }),
        text: async () => '{}',
      })

      // Mock Yahoo fallback
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          quoteResponse: {
            result: [
              {
                symbol: '2330.TW',
                regularMarketPrice: 580,
                regularMarketChange: 5,
                regularMarketChangePercent: 0.87,
                regularMarketVolume: 13999,
                regularMarketOpen: 575,
                regularMarketDayHigh: 582,
                regularMarketDayLow: 574,
                regularMarketPreviousClose: 575,
              },
            ],
          },
        }),
        text: async () => '{}',
      })
      global.fetch = mockFetch as any

      // Spy on cache functions
      const cacheGetSpy = vi.spyOn(cache, 'cacheGet').mockResolvedValue(null)
      const cacheSetSpy = vi.spyOn(cache, 'cacheSet').mockResolvedValue()

      const quote = await getQuoteWithFallback('2330')

      expect(quote.symbol).toBe('2330')
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(cacheGetSpy).toHaveBeenCalled()
      expect(cacheSetSpy).toHaveBeenCalled()
    })

    it('should bypass cache when disabled', async () => {
      // Disable cache by removing Redis config
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN

      // Mock TWSE API (empty) + Yahoo fallback
      const mockFetch = vi.fn()

      // First query: TWSE + Yahoo
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ Code: 0, Data: [] }),
        text: async () => '{}',
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          quoteResponse: {
            result: [{
              symbol: '2330.TW',
              regularMarketPrice: 580,
              regularMarketChange: 5,
              regularMarketChangePercent: 0.87,
              regularMarketVolume: 13999,
              regularMarketOpen: 575,
              regularMarketDayHigh: 582,
              regularMarketDayLow: 574,
              regularMarketPreviousClose: 575,
            }],
          },
        }),
        text: async () => '{}',
      })

      // Second query: TWSE + Yahoo again
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ Code: 0, Data: [] }),
        text: async () => '{}',
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          quoteResponse: {
            result: [{
              symbol: '2330.TW',
              regularMarketPrice: 580,
              regularMarketChange: 5,
              regularMarketChangePercent: 0.87,
              regularMarketVolume: 13999,
              regularMarketOpen: 575,
              regularMarketDayHigh: 582,
              regularMarketDayLow: 574,
              regularMarketPreviousClose: 575,
            }],
          },
        }),
        text: async () => '{}',
      })
      global.fetch = mockFetch as any

      const quote1 = await getQuoteWithFallback('2330')
      const quote2 = await getQuoteWithFallback('2330')

      expect(quote1.symbol).toBe('2330')
      expect(quote2.symbol).toBe('2330')
      // Should call provider twice (no cache): 2x(TWSE + Yahoo) = 4
      expect(mockFetch).toHaveBeenCalledTimes(4)
    })
  })

  describe('News Caching', () => {
    it('should cache news results and return within 1s on repeated queries', async () => {
      // Mock Google RSS API
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>半導體產業新聞1</title>
      <link>https://example.com/news1</link>
      <pubDate>Wed, 13 Nov 2024 10:00:00 GMT</pubDate>
      <description>新聞摘要1</description>
    </item>
  </channel>
</rss>`,
      })
      global.fetch = mockFetch as any

      // Spy on cache functions
      const cacheGetSpy = vi.spyOn(cache, 'cacheGet')
      const cacheSetSpy = vi.spyOn(cache, 'cacheSet')

      // First call: cache miss
      cacheGetSpy.mockResolvedValueOnce(null)
      cacheSetSpy.mockResolvedValueOnce()

      const start1 = Date.now()
      const news1 = await getIndustryNews('半導體', 5)
      const duration1 = Date.now() - start1

      expect(news1.length).toBeGreaterThan(0)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(cacheSetSpy).toHaveBeenCalledTimes(1)

      // Second call: cache hit
      cacheGetSpy.mockResolvedValueOnce(news1)

      const start2 = Date.now()
      const news2 = await getIndustryNews('半導體', 5)
      const duration2 = Date.now() - start2

      expect(news2).toEqual(news1)
      expect(mockFetch).toHaveBeenCalledTimes(1) // No additional fetch
      expect(cacheGetSpy).toHaveBeenCalledTimes(2)

      // Cache hit should be faster than 1000ms
      expect(duration2).toBeLessThan(1000)
    }, 10000)

    it('should handle cache miss and call provider', async () => {
      // Mock Google RSS API
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>半導體產業新聞1</title>
      <link>https://example.com/news1</link>
      <pubDate>Wed, 13 Nov 2024 10:00:00 GMT</pubDate>
      <description>新聞摘要1</description>
    </item>
  </channel>
</rss>`,
      })
      global.fetch = mockFetch as any

      // Spy on cache functions
      const cacheGetSpy = vi.spyOn(cache, 'cacheGet').mockResolvedValue(null)
      const cacheSetSpy = vi.spyOn(cache, 'cacheSet').mockResolvedValue()

      const news = await getIndustryNews('半導體', 5)

      expect(news.length).toBeGreaterThan(0)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(cacheGetSpy).toHaveBeenCalled()
      expect(cacheSetSpy).toHaveBeenCalled()
    })
  })

  describe('Cache Key Generation', () => {
    it('should generate different keys for different symbols', async () => {
      // Spy on cache functions
      const cacheGetSpy = vi.spyOn(cache, 'cacheGet').mockResolvedValue(null)
      const cacheSetSpy = vi.spyOn(cache, 'cacheSet').mockResolvedValue()

      // Mock TWSE API (empty) + Yahoo fallback
      const mockFetch = vi.fn()

      // First symbol: 2330
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ Code: 0, Data: [] }),
        text: async () => '{}',
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          quoteResponse: {
            result: [{
              symbol: '2330.TW',
              regularMarketPrice: 580,
              regularMarketChange: 5,
              regularMarketChangePercent: 0.87,
              regularMarketVolume: 13999,
              regularMarketOpen: 575,
              regularMarketDayHigh: 582,
              regularMarketDayLow: 574,
              regularMarketPreviousClose: 575,
            }],
          },
        }),
        text: async () => '{}',
      })

      // Second symbol: 2317
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ Code: 0, Data: [] }),
        text: async () => '{}',
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          quoteResponse: {
            result: [{
              symbol: '2317.TW',
              regularMarketPrice: 200,
              regularMarketChange: 2,
              regularMarketChangePercent: 1.0,
              regularMarketVolume: 5000,
              regularMarketOpen: 198,
              regularMarketDayHigh: 201,
              regularMarketDayLow: 197,
              regularMarketPreviousClose: 198,
            }],
          },
        }),
        text: async () => '{}',
      })
      global.fetch = mockFetch as any

      await getQuoteWithFallback('2330')
      await getQuoteWithFallback('2317')

      // Each getQuoteWithFallback calls cacheGet twice (TWSE + Yahoo fallback)
      // So 2 symbols × 2 providers = 4 calls
      expect(cacheGetSpy).toHaveBeenCalled()

      // Check that different cache keys were used for different symbols
      // The first 2 calls are for 2330, the last 2 are for 2317
      const calls = cacheGetSpy.mock.calls
      const key2330 = calls.find((call: any) => call[0].includes('2330'))?.[0]
      const key2317 = calls.find((call: any) => call[0].includes('2317'))?.[0]

      expect(key2330).toBeDefined()
      expect(key2317).toBeDefined()
      expect(key2330).not.toBe(key2317)
      expect(key2330).toContain('2330')
      expect(key2317).toContain('2317')
    })

    it('should generate different keys for different news keywords', async () => {
      // Spy on cache functions
      const cacheGetSpy = vi.spyOn(cache, 'cacheGet').mockResolvedValue(null)
      const cacheSetSpy = vi.spyOn(cache, 'cacheSet').mockResolvedValue()

      // Mock Google RSS API
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>新聞標題</title>
      <link>https://example.com/news1</link>
      <pubDate>Wed, 13 Nov 2024 10:00:00 GMT</pubDate>
      <description>摘要</description>
    </item>
  </channel>
</rss>`,
      })
      global.fetch = mockFetch as any

      await getIndustryNews('半導體', 5)
      await getIndustryNews('電動車', 5)

      // Should call cacheGet with different keys
      expect(cacheGetSpy).toHaveBeenCalledTimes(2)
      const key1 = cacheGetSpy.mock.calls[0][0]
      const key2 = cacheGetSpy.mock.calls[1][0]
      expect(key1).not.toBe(key2)
    })
  })

  describe('Cache TTL', () => {
    it('should set TTL when caching quote data', async () => {
      // Mock TWSE API (empty) + Yahoo fallback
      const mockFetch = vi.fn()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ Code: 0, Data: [] }),
        text: async () => '{}',
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          quoteResponse: {
            result: [{
              symbol: '2330.TW',
              regularMarketPrice: 580,
              regularMarketChange: 5,
              regularMarketChangePercent: 0.87,
              regularMarketVolume: 13999,
              regularMarketOpen: 575,
              regularMarketDayHigh: 582,
              regularMarketDayLow: 574,
              regularMarketPreviousClose: 575,
            }],
          },
        }),
        text: async () => '{}',
      })
      global.fetch = mockFetch as any

      // Spy on cache functions
      const cacheGetSpy = vi.spyOn(cache, 'cacheGet').mockResolvedValue(null)
      const cacheSetSpy = vi.spyOn(cache, 'cacheSet').mockResolvedValue()

      await getQuoteWithFallback('2330')

      // Should call cacheSet with key, value, and TTL
      expect(cacheSetSpy).toHaveBeenCalledTimes(1)
      const setCall = cacheSetSpy.mock.calls[0]
      expect(setCall[0]).toContain('2330') // key contains symbol
      expect(setCall[1]).toBeTruthy() // value
      expect(setCall[2]).toBeGreaterThan(0) // TTL in seconds
    })
  })
})
