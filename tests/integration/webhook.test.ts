// tests/integration/webhook.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'http'
import handler from '../../api/line/webhook'
import { Readable } from 'node:stream'

describe('Webhook Integration Tests', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = {
      ...originalEnv,
      LINE_CHANNEL_SECRET: 'test-secret',
      LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
      DEBUG: 'False',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  function createMockRequest(body: any, signature?: string): IncomingMessage {
    const bodyStr = JSON.stringify(body)
    const bodyBuffer = Buffer.from(bodyStr, 'utf8')
    const stream = Readable.from([bodyBuffer]) as IncomingMessage
    stream.method = 'POST'
    stream.url = '/api/line/webhook'
    stream.headers = signature ? { 'x-line-signature': signature } : {}
    return stream
  }

  function createMockResponse(): ServerResponse & { body: string; headers: Record<string, string> } {
    const res = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: '',
      setHeader: vi.fn((key: string, value: string) => {
        res.headers[key] = value
      }),
      end: vi.fn((data?: string) => {
        if (data) res.body = data
      }),
    } as unknown as ServerResponse & { body: string; headers: Record<string, string> }
    return res
  }

  function signPayload(body: any, secret: string): string {
    const bodyStr = JSON.stringify(body)
    return crypto.createHmac('sha256', secret).update(bodyStr, 'utf8').digest('base64')
  }

  describe('Signature Verification', () => {
    it('should reject request with missing signature', async () => {
      const payload = { events: [] }
      const req = createMockRequest(payload)
      const res = createMockResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(401)
      expect(res.body).toContain('Invalid signature')
    })

    it('should reject request with invalid signature', async () => {
      const payload = { events: [] }
      const req = createMockRequest(payload, 'invalid-signature')
      const res = createMockResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(401)
      expect(res.body).toContain('Invalid signature')
    })

    it('should accept request with valid signature', async () => {
      const payload = { events: [] }
      const signature = signPayload(payload, 'test-secret')
      const req = createMockRequest(payload, signature)
      const res = createMockResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body).toContain('ok')
    })

    it('should bypass signature check when DEBUG=True', async () => {
      process.env.DEBUG = 'True'
      const payload = { events: [] }
      const req = createMockRequest(payload) // no signature
      const res = createMockResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body).toContain('ok')
    })
  })

  describe('Command Parsing', () => {
    let mockFetch: any

    beforeEach(() => {
      mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '',
      })
      global.fetch = mockFetch
    })

    async function sendCommand(text: string): Promise<ServerResponse & { body: string; headers: Record<string, string> }> {
      const payload = {
        events: [
          {
            type: 'message',
            message: { type: 'text', text },
            replyToken: 'test-reply-token',
          },
        ],
      }
      const signature = signPayload(payload, 'test-secret')
      const req = createMockRequest(payload, signature)
      const res = createMockResponse()
      await handler(req, res)
      return res
    }

    it('should handle "help" command and reply with Flex message', async () => {
      await sendCommand('help')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/reply',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          }),
        })
      )

      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.replyToken).toBe('test-reply-token')
      expect(body.messages[0].type).toBe('flex')
      expect(body.messages[0].altText).toBe('可用指令')
      expect(body.messages[0].contents.type).toBe('bubble')
    })

    it('should handle "幫助" command alias and reply with Flex message', async () => {
      await sendCommand('幫助')

      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.messages[0].type).toBe('flex')
      expect(body.messages[0].altText).toBe('可用指令')
    })

    it('should handle "股價 2330" command and reply with quote Flex', async () => {
      // Mock TWSE provider (empty result to trigger fallback)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ Code: 0, Data: [] }),
        text: async () => '{}',
      })

      // Mock Yahoo provider (fallback)
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

      await sendCommand('股價 2330')

      // First call is to TWSE API
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('twse.com.tw'),
        expect.any(Object)
      )

      // Second call is to Yahoo API (fallback)
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('yahoo'),
        expect.any(Object)
      )

      // Third call is to LINE reply API
      const replyCall = mockFetch.mock.calls.find((call: any) =>
        call[0].includes('api.line.me')
      )
      expect(replyCall).toBeDefined()

      const body = JSON.parse(replyCall[1].body)
      expect(body.messages[0].type).toBe('flex')
      expect(body.messages[0].altText).toContain('股價')
    })

    it('should handle "新聞 半導體" command and reply with news Flex', async () => {
      // Mock Google RSS provider
      mockFetch.mockResolvedValueOnce({
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

      await sendCommand('新聞 半導體')

      // First call is to Google RSS API
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('news.google.com'),
        expect.any(Object)
      )

      // Second call is to LINE reply API
      const replyCall = mockFetch.mock.calls.find((call: any) =>
        call[0].includes('api.line.me')
      )
      expect(replyCall).toBeDefined()

      const body = JSON.parse(replyCall[1].body)
      expect(body.messages[0].type).toBe('flex')
      expect(body.messages[0].altText).toContain('新聞 半導體')
    })

    it('should handle unknown command and reply with status Flex', async () => {
      await sendCommand('unknown-command')

      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.messages[0].type).toBe('flex')
      expect(body.messages[0].altText).toBe('未知指令')
      expect(body.messages[0].contents.type).toBe('bubble')
    })

    it('should handle provider error and reply with error Flex', async () => {
      // Mock TWSE provider to fail
      mockFetch.mockRejectedValueOnce(new Error('Provider error'))

      // Mock Yahoo provider to also fail
      mockFetch.mockRejectedValueOnce(new Error('Yahoo Provider error'))

      await sendCommand('股價 2330')

      const replyCall = mockFetch.mock.calls.find((call: any) =>
        call[0].includes('api.line.me')
      )
      expect(replyCall).toBeDefined()

      const body = JSON.parse(replyCall[1].body)
      expect(body.messages[0].type).toBe('flex')
      expect(body.messages[0].altText).toBe('發生錯誤')
    })
  })

  describe('Request Validation', () => {
    it('should reject non-POST requests', async () => {
      const stream = Readable.from([Buffer.from('')]) as IncomingMessage
      stream.method = 'GET'
      stream.url = '/api/line/webhook'
      stream.headers = {}

      const res = createMockResponse()
      await handler(stream, res)

      expect(res.statusCode).toBe(405)
      expect(res.body).toContain('Method Not Allowed')
    })

    it('should reject invalid JSON payload', async () => {
      const invalidBody = Buffer.from('invalid json', 'utf8')
      const stream = Readable.from([invalidBody]) as IncomingMessage
      stream.method = 'POST'
      stream.url = '/api/line/webhook'
      const signature = crypto
        .createHmac('sha256', 'test-secret')
        .update('invalid json', 'utf8')
        .digest('base64')
      stream.headers = { 'x-line-signature': signature }

      const res = createMockResponse()
      await handler(stream, res)

      expect(res.statusCode).toBe(400)
      expect(res.body).toContain('Bad JSON')
    })

    it('should handle empty events array', async () => {
      const payload = { events: [] }
      const signature = signPayload(payload, 'test-secret')
      const req = createMockRequest(payload, signature)
      const res = createMockResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body).toContain('ok')
    })

    it('should ignore non-message events', async () => {
      const payload = {
        events: [
          {
            type: 'follow',
            replyToken: 'test-reply-token',
          },
        ],
      }
      const signature = signPayload(payload, 'test-secret')
      const req = createMockRequest(payload, signature)
      const res = createMockResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body).toContain('ok')
    })
  })
})
