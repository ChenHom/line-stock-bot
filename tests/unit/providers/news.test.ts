// tests/unit/providers/news.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getNewsGoogleRss } from '../../../lib/providers/news/googleRss'
import { getNewsYahooRss } from '../../../lib/providers/news/yahooRss'

describe('News Providers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getNewsGoogleRss', () => {
    it('should fetch and parse Google News RSS successfully', async () => {
      const mockRssXml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title><![CDATA[台積電股價創新高]]></title>
              <link>https://example.com/news/1</link>
              <source>經濟日報</source>
              <pubDate>Mon, 13 Nov 2023 10:00:00 GMT</pubDate>
              <media:content url="https://example.com/image1.jpg" medium="image" />
            </item>
            <item>
              <title>半導體產業展望</title>
              <link>https://example.com/news/2</link>
              <source>工商時報</source>
              <pubDate>Mon, 13 Nov 2023 09:00:00 GMT</pubDate>
              <description><![CDATA[<img src="https://example.com/image2.jpg" /> Some description]]></description>
            </item>
          </channel>
        </rss>`

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockRssXml
      } as Response)

      const result = await getNewsGoogleRss('半導體', 5)

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(2)
      expect(result[0].title).toBe('台積電股價創新高')
      expect(result[0].url).toBe('https://example.com/news/1')
      expect(result[0].source).toBe('經濟日報')
      expect(result[0].publishedAt).toBeDefined()
      expect(result[0].imageUrl).toBe('https://example.com/image1.jpg')
      expect(result[1].imageUrl).toBe('https://example.com/image2.jpg')
    })

    it('should limit results to specified limit', async () => {
      const mockRssXml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            ${Array(10).fill(0).map((_, i) => `
              <item>
                <title>News ${i}</title>
                <link>https://example.com/news/${i}</link>
              </item>
            `).join('')}
          </channel>
        </rss>`

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockRssXml
      } as Response)

      const result = await getNewsGoogleRss('test', 3)
      expect(result.length).toBeLessThanOrEqual(3)
    })

    it('should throw error when Google RSS API fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503
      } as Response)

      await expect(getNewsGoogleRss('test')).rejects.toThrow('Google RSS http 503')
    })

    it('should validate response with Zod schema and reject invalid URLs', async () => {
      const invalidRssXml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>Valid Title</title>
              <link>not-a-valid-url</link>
            </item>
          </channel>
        </rss>`

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => invalidRssXml
      } as Response)

      await expect(getNewsGoogleRss('test')).rejects.toThrow()
    })
  })

  describe('getNewsYahooRss', () => {
    it('should fetch and parse Yahoo News RSS successfully', async () => {
      const mockRssXml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>Yahoo News Title</title>
              <link>https://yahoo.com/news/1</link>
              <pubDate>Mon, 13 Nov 2023 08:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockRssXml
      } as Response)

      const result = await getNewsYahooRss('tech', 5)

      expect(result).toBeDefined()
      expect(result[0].title).toBe('Yahoo News Title')
      expect(result[0].url).toBe('https://yahoo.com/news/1')
      expect(result[0].source).toBe('Yahoo 財經')
    })

    it('should throw error when Yahoo RSS API fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      } as Response)

      await expect(getNewsYahooRss('test')).rejects.toThrow('Yahoo RSS http 500')
    })
  })
})
