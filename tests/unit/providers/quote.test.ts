// tests/unit/providers/quote.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getQuoteTwseDaily } from '../../../lib/providers/quote/twse'
import { getQuoteYahoo } from '../../../lib/providers/quote/yahooRapid'

describe('Quote Providers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getQuoteTwseDaily', () => {
    it('should fetch and parse TWSE data successfully', async () => {
      // Mock fetch for TWSE API
      const mockResponse = {
        stat: 'OK',
        data: [
          ['113/11/01', '1000', '500000', '100.00', '102.00', '99.00', '101.00', '+1.00', '1000']
        ]
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response)

      const result = await getQuoteTwseDaily('2330')

      expect(result).toBeDefined()
      expect(result.symbol).toBe('2330')
      expect(result.marketSymbol).toBe('2330.TW')
      expect(result.price).toBe(101)
      expect(result.change).toBe(1)
      expect(result.open).toBe(100)
      expect(result.high).toBe(102)
      expect(result.low).toBe(99)
      expect(result.currency).toBe('TWD')
      expect(result.delayed).toBe(true)
    })

    it('should throw error when TWSE API returns empty data', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ stat: 'OK', data: [] })
      } as Response)

      await expect(getQuoteTwseDaily('9999')).rejects.toThrow('TWSE empty')
    })

    it('should throw error when TWSE API fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      } as Response)

      await expect(getQuoteTwseDaily('2330')).rejects.toThrow('TWSE http 500')
    })

    it('should validate response with Zod schema and reject invalid data', async () => {
      const invalidResponse = {
        stat: 'OK',
        data: [
          ['113/11/01', '1000', '500000', 'invalid', '102.00', '99.00', '101.00', '+1.00', '1000']
        ]
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => invalidResponse
      } as Response)

      // Should throw Zod validation error for NaN price
      await expect(getQuoteTwseDaily('2330')).rejects.toThrow()
    })
  })

  describe('getQuoteYahoo', () => {
    it('should fetch and parse Yahoo Finance data successfully', async () => {
      const mockResponse = {
        quoteResponse: {
          result: [{
            symbol: '2330.TW',
            longName: 'Taiwan Semiconductor',
            regularMarketPrice: 580.00,
            regularMarketChange: 5.00,
            regularMarketChangePercent: 0.87,
            regularMarketOpen: 575.00,
            regularMarketDayHigh: 582.00,
            regularMarketDayLow: 574.00,
            regularMarketPreviousClose: 575.00,
            currency: 'TWD',
            regularMarketTime: 1699876800
          }]
        }
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response)

      const result = await getQuoteYahoo('2330')

      expect(result).toBeDefined()
      expect(result.symbol).toBe('2330')
      expect(result.name).toBe('Taiwan Semiconductor')
      expect(result.price).toBe(580.00)
      expect(result.change).toBe(5.00)
      expect(result.changePercent).toBe(0.87)
      expect(result.currency).toBe('TWD')
      expect(result.delayed).toBe(true)
    })

    it('should throw error when Yahoo API returns empty result', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ quoteResponse: { result: [] } })
      } as Response)

      await expect(getQuoteYahoo('INVALID')).rejects.toThrow('Yahoo quote empty')
    })

    it('should throw error when Yahoo API fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      } as Response)

      await expect(getQuoteYahoo('2330')).rejects.toThrow('Yahoo quote http 404')
    })
  })
})
