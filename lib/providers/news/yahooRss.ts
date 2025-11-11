import type { NewsItem } from '../../types'

// 這裡示範：以關鍵字回 Yahoo Finance 搜尋 RSS（實務可換特定媒體 RSS）
export async function getNewsYahooRss(keyword: string, limit = 5): Promise<NewsItem[]> {
  const q = `https://news.yahoo.com/rss/search?p=${encodeURIComponent(keyword)}&lang=zh-Hant-TW&region=TW`
  const r = await fetch(q, { cache: 'no-store' })
  if (!r.ok) throw new Error(`Yahoo RSS http ${r.status}`)
  const xml = await r.text()
  const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).slice(0, limit)
  return items.map(m => {
    const b = m[1]
    const title = (b.match(/<title>(.*?)<\/title>/)?.[1] || '').trim()
    const link = (b.match(/<link>(.*?)<\/link>/)?.[1] || '').trim()
    const pub = (b.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '').trim()
    const publishedAt = pub ? new Date(pub).toISOString() : undefined
    return { title, url: link, source: 'Yahoo', publishedAt }
  })
}
