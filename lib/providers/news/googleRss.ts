import { NewsItem } from '../../schemas'
import { buildNewsList, extractAttribute, extractItemBlocks, extractTag, normalizeUrl, parsePublishedDate, sanitizeText } from './rssUtils'

const REQUEST_HEADERS = {
  'User-Agent': 'line-stock-bot/1.0 (+https://github.com/ChenHom/line-stock-bot)'
}

export async function getNewsGoogleRss(keyword: string, limit = 5): Promise<NewsItem[]> {
  const params = new URLSearchParams({
    q: keyword,
    hl: 'zh-TW',
    gl: 'TW',
    ceid: 'TW:zh-Hant'
  })

  const response = await fetch(`https://news.google.com/rss/search?${params.toString()}`, {
    cache: 'no-store',
    headers: REQUEST_HEADERS
  })

  if (!response.ok) {
    throw new Error(`Google RSS http ${response.status}`)
  }

  const xml = await response.text()
  const blocks = extractItemBlocks(xml)
  const newsItems = buildNewsList(blocks, 'google-rss', limit, (block) => {
    const url = normalizeUrl(extractTag(block, 'link'))
    if (!url) {
      return null
    }

    // Try to extract image from media:content or enclosure
    let imageUrl = extractAttribute(block, 'media:content', 'url')
    if (!imageUrl) {
      imageUrl = extractAttribute(block, 'enclosure', 'url')
    }
    // If not found, try to find img src in description
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
      source: sanitizeText(extractTag(block, 'source')),
      publishedAt: parsePublishedDate(extractTag(block, 'pubDate')),
      imageUrl: normalizeUrl(imageUrl)
    }
  })

  if (!newsItems.length) {
    throw new Error('Google RSS returned no valid news items')
  }

  return newsItems
}
