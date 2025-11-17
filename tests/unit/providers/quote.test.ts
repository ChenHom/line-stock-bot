// tests/unit/providers/quote.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getQuoteTwse } from '../../../lib/providers/quote/twse'
import { getQuoteYahoo } from '../../../lib/providers/quote/yahooRapid'

describe('Quote Providers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getQuoteTwse', () => {
    it('should fetch and parse TWSE data successfully', async () => {
      const mockResponse = {
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
        json: async () => mockResponse
      } as Response)

      const result = await getQuoteTwse('2330')

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
        json: async () => ({ msgArray: [] })
      } as Response)

      await expect(getQuoteTwse('9999')).rejects.toThrow('TWSE empty payload')
    })

    it('should throw error when TWSE API fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      } as Response)

      await expect(getQuoteTwse('2330')).rejects.toThrow('TWSE http 500')
    })

    it('should validate response with Zod schema and reject invalid data', async () => {
      const invalidResponse = {
        msgArray: [{
          c: '2330',
          n: '台積電',
          z: '---',
          y: '100.00'
        }]
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => invalidResponse
      } as Response)

      await expect(getQuoteTwse('2330')).rejects.toThrow()
    })

    it('should retry OTC channel when TSE payload is empty', async () => {
      const emptyResponse = { msgArray: [] }
      const otcResponse = {
        msgArray: [{
          c: '6584',
          n: '南俊國際',
          z: '347.50',
          y: '316.00',
          o: '328.00',
          h: '347.50',
          l: '322.50',
          t: '11:30:00',
          d: '2025/11/17'
        }]
      }

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => emptyResponse } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => otcResponse } as Response)

      const result = await getQuoteTwse('6584')

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(global.fetch).toHaveBeenNthCalledWith(1, expect.stringContaining('tse_6584.tw'), expect.any(Object))
      expect(global.fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('otc_6584.tw'), expect.any(Object))
      expect(result.marketSymbol).toBe('6584.TWO')
      expect(result.price).toBeCloseTo(347.5)
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

    it('should retry with TWO suffix when TW symbol not found', async () => {
      const emptyResult = { quoteResponse: { result: [] } }
      const validResult = {
        quoteResponse: {
          result: [{
            symbol: '6584.TWO',
            shortName: '南俊國際',
            regularMarketPrice: 347.5,
            regularMarketChange: 5.3,
            regularMarketChangePercent: 1.5,
            regularMarketOpen: 340,
            regularMarketDayHigh: 348,
            regularMarketDayLow: 332,
            regularMarketPreviousClose: 342,
            currency: 'TWD',
            regularMarketTime: 1699876800
          }]
        }
      }

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => emptyResult } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => validResult } as Response)

      const quote = await getQuoteYahoo('6584')

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(global.fetch).toHaveBeenNthCalledWith(1, expect.stringContaining('6584.TW'), expect.any(Object))
      expect(global.fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('6584.TWO'), expect.any(Object))
      expect(quote.marketSymbol).toBe('6584.TWO')
      expect(quote.price).toBeCloseTo(347.5)
    })
  })
})
