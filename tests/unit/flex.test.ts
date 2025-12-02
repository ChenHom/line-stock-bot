import { describe, it, expect } from 'vitest'
import { createNewsListMessage } from '../../lib/flex'
import { NewsItem } from '../../lib/schemas'
import { createMultiMatchMessage } from '../../lib/flex'

describe('Flex Messages', () => {
  describe('createNewsListMessage', () => {
    it('should return status flex for empty news list', () => {
      const result = createNewsListMessage('test', [])
      expect(result.type).toBe('bubble')
      expect(JSON.stringify(result)).toContain('找不到相關新聞')
    })

    it('should create a carousel with bubbles for news items', () => {
      const newsItems: NewsItem[] = [
        {
          title: 'Test News 1',
          url: 'https://example.com/1',
          source: 'Source 1',
          publishedAt: '2023-01-01T12:00:00Z',
          imageUrl: 'https://example.com/image1.jpg'
        },
        {
          title: 'Test News 2',
          url: 'https://example.com/2',
          source: 'Source 2',
          publishedAt: '2023-01-02T12:00:00Z'
        }
      ]

      const message = createNewsListMessage('test', newsItems)
      expect(message).not.toBeNull()
      expect(message.type).toBe('carousel')
      expect(message.contents).toHaveLength(2)

      const bubble1 = message.contents[0]
      expect(bubble1.type).toBe('bubble')
      expect(bubble1.hero).toBeDefined()
      expect(bubble1.hero.url).toBe('https://example.com/image1.jpg')
      expect(bubble1.body.contents[0].text).toBe('Test News 1')

      const bubble2 = message.contents[1]
      expect(bubble2.type).toBe('bubble')
      expect(bubble2.hero).toBeUndefined()
      expect(bubble2.body.contents[0].text).toBe('Test News 2')
    })
  })

  describe('createMultiMatchMessage', () => {
    it('renders a carousel for multiple matches', () => {
      const matches = [
        { symbol: '2330', name: '台積電', confidence: 95 },
        { symbol: '2303', name: '聯電', confidence: 85 }
      ]
      const flex = createMultiMatchMessage('台', matches)
      expect(flex).not.toBeNull()
      expect(flex.type).toBe('carousel')
      expect(flex.contents.length).toBe(2)
      expect(flex.contents[0].body.contents[0].text).toContain('2330')
    })

    it('returns a status flex when no matches', () => {
      const flex = createMultiMatchMessage('foo', [])
      expect(flex.type).toBe('bubble')
      expect(JSON.stringify(flex)).toContain('找不到')
    })
  })
})
