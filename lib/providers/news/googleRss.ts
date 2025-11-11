import { NewsItem } from '../../types'

export async function getNewsGoogleRss(keyword: string, limit = 5): Promise<NewsItem[]> {
  const base = 'https://news.google.com/rss/search'
  const q = `?q=${encodeURIComponent(keyword)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`
  const url = base + q
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`Google RSS http ${r.status}`)
  const xml = await r.text()

  // 非嚴格 XML 解析，取常見項目
  const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).slice(0, limit)
  return items.map(m => {
    const block = m[1]
    const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
                   block.match(/<title>(.*?)<\/title>/)?.[1] || '').trim()
    const link = (block.match(/<link>(.*?)<\/link>/)?.[1] || '').trim()
    const source = (block.match(/<source.*?>(.*?)<\/source>/)?.[1] || '').trim()
    const pub = (block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '').trim()
    const publishedAt = pub ? new Date(pub).toISOString() : undefined
    return { title, url: link, source, publishedAt }
  })
}
