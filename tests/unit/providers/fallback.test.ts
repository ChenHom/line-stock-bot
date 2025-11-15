// tests/unit/providers/fallback.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getQuoteWithFallback, getIndustryNews } from '../../../lib/providers'

describe('Provider Fallback Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment variables
    delete process.env.QUOTE_PRIMARY_PROVIDER
  })

  describe('getQuoteWithFallback', () => {
    it('should use TWSE as primary provider by default', async () => {
      const mockTwseResponse = {
        msgArray: [{
          c: '2330',
          n: '台積電',
          z: '101.00',
          y: '100.00',
          o: '100.00',
          h: '102.00',
          l: '99.00',
          t: '13:30:00',
          d: '2023/11/01'
        }]
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTwseResponse
      } as Response)

      const result = await getQuoteWithFallback('2330')

      expect(result).toBeDefined()
      expect(result.symbol).toBe('2330')
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('mis.twse.com.tw'),
        expect.any(Object)
      )
    })

    it('should fallback to Yahoo when TWSE fails (default config)', async () => {
      const mockYahooResponse = {
        quoteResponse: {
          result: [{
            symbol: '2330.TW',
            regularMarketPrice: 580,
            regularMarketChange: 5,
            regularMarketChangePercent: 0.87,
            regularMarketOpen: 575,
            regularMarketDayHigh: 582,
            regularMarketDayLow: 574,
            regularMarketPreviousClose: 575
          }]
        }
      }

      let callCount = 0
      global.fetch = vi.fn().mockImplementation(async (url) => {
        callCount++
        if (callCount === 1) {
          // First call to TWSE fails
          return { ok: false, status: 500 } as Response
        }
        // Second call to Yahoo succeeds
        return {
          ok: true,
          json: async () => mockYahooResponse
        } as Response
      })

      const result = await getQuoteWithFallback('2330')

      expect(result).toBeDefined()
      expect(result.symbol).toBe('2330')
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('should use Yahoo as primary when QUOTE_PRIMARY_PROVIDER=yahoo', async () => {
      process.env.QUOTE_PRIMARY_PROVIDER = 'yahoo'

      const mockYahooResponse = {
        quoteResponse: {
          result: [{
            symbol: '2330.TW',
            regularMarketPrice: 580,
            regularMarketChange: 5,
            regularMarketChangePercent: 0.87,
            regularMarketOpen: 575,
            regularMarketDayHigh: 582,
            regularMarketDayLow: 574,
            regularMarketPreviousClose: 575
          }]
        }
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockYahooResponse
      } as Response)

      const result = await getQuoteWithFallback('2330')

      expect(result).toBeDefined()
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('query1.finance.yahoo.com'),
        expect.any(Object)
      )
    })

    it('should fallback to TWSE when Yahoo fails (yahoo config)', async () => {
      process.env.QUOTE_PRIMARY_PROVIDER = 'yahoo'

      const mockTwseResponse = {
        msgArray: [{
          c: '2330',
          n: '台積電',
          z: '101.00',
          y: '100.00',
          o: '100.00',
          h: '102.00',
          l: '99.00',
          t: '13:30:00',
          d: '2023/11/01'
        }]
      }

      let callCount = 0
      global.fetch = vi.fn().mockImplementation(async (url) => {
        callCount++
        if (callCount === 1) {
          // First call to Yahoo fails
          return { ok: false, status: 404 } as Response
        }
        // Second call to TWSE succeeds
        return {
          ok: true,
          json: async () => mockTwseResponse
        } as Response
      })

      const result = await getQuoteWithFallback('2330')

      expect(result).toBeDefined()
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('getIndustryNews', () => {
    it('should use Google RSS as primary provider', async () => {
      const mockRssXml = `<?xml version="1.0"?>
        <rss><channel><item>
          <title>Test News</title>
          <link>https://example.com/1</link>
        </item></channel></rss>`

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockRssXml
      } as Response)

      const result = await getIndustryNews('半導體', 5)

      expect(result).toBeDefined()
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('news.google.com'),
        expect.any(Object)
      )
    })

    it('should fallback to Yahoo RSS when Google fails', async () => {
      const mockYahooRssXml = `<?xml version="1.0"?>
        <rss><channel><item>
          <title>Yahoo News</title>
          <link>https://yahoo.com/1</link>
        </item></channel></rss>`

      let callCount = 0
      global.fetch = vi.fn().mockImplementation(async (url) => {
        callCount++
        if (callCount === 1) {
          // Google RSS fails
          return { ok: false, status: 503 } as Response
        }
        // Yahoo RSS succeeds
        return {
          ok: true,
          text: async () => mockYahooRssXml
        } as Response
      })

      const result = await getIndustryNews('tech', 5)

      expect(result).toBeDefined()
      expect(result[0].source).toBe('Yahoo 財經')
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })
})
