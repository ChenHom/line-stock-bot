import { NewsItem } from '../../schemas'
import { buildNewsList, extractAttribute, extractItemBlocks, extractTag, normalizeUrl, parsePublishedDate, sanitizeText } from './rssUtils'

const REQUEST_HEADERS = {
  'User-Agent': 'line-stock-bot/1.0 (+https://github.com/ChenHom/line-stock-bot)'
}

export async function getNewsYahooRss(keyword: string, limit = 5): Promise<NewsItem[]> {
  const response = await fetch(
    `https://news.yahoo.com/rss/search?p=${encodeURIComponent(keyword)}&lang=zh-Hant-TW&region=TW`,
    { cache: 'no-store', headers: REQUEST_HEADERS }
  )

  if (!response.ok) {
    throw new Error(`Yahoo RSS http ${response.status}`)
  }

  const xml = await response.text()
  const blocks = extractItemBlocks(xml)
  const newsItems = buildNewsList(blocks, 'yahoo-rss', limit, (block) => {
    const url = normalizeUrl(extractTag(block, 'link'))
    if (!url) {
      return null
    }

    let imageUrl = extractAttribute(block, 'media:content', 'url')
    if (!imageUrl) {
      const description = extractTag(block, 'description')
      if (description) {
        const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/)
        if (imgMatch) {
          imageUrl = imgMatch[1]
        }
      }
    }

    return {
      title: sanitizeText(extractTag(block, 'title')) ?? '(無標題)',
      url,
      source: sanitizeText(extractTag(block, 'source')) ?? 'Yahoo 財經',
      publishedAt: parsePublishedDate(extractTag(block, 'pubDate')),
      imageUrl: normalizeUrl(imageUrl)
    }
  })

  if (!newsItems.length) {
    throw new Error('Yahoo RSS returned no valid news items')
  }

  return newsItems
}
