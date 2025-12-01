import { NewsItem, NewsItemSchema } from '../../schemas'
import { logger } from '../../logger'

const ITEM_PATTERN = /<item>([\s\S]*?)<\/item>/gi
const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'"
}

export function extractItemBlocks(xml: string): string[] {
  if (!xml) return []
  return Array.from(xml.matchAll(ITEM_PATTERN)).map((match) => match[1])
}

export function extractTag(block: string, tag: string): string | undefined {
  if (!block) return undefined
  const cdata = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`, 'i'))
  if (cdata?.[1]) {
    return cdata[1].trim()
  }
  const plain = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'))
  if (plain?.[1]) {
    return plain[1].trim()
  }
  return undefined
}

export function extractAttribute(block: string, tagName: string, attributeName: string): string | undefined {
  const regex = new RegExp(`<${tagName}[^>]*${attributeName}=["']([^"']+)["']`, 'i')
  const match = block.match(regex)
  return match ? match[1] : undefined
}

export function sanitizeText(value?: string): string | undefined {
  if (!value) return undefined
  const withoutHtml = value.replace(/<[^>]+>/g, ' ')
  const decoded = Object.entries(ENTITY_MAP).reduce((acc, [entity, replacement]) => acc.replace(new RegExp(entity, 'g'), replacement), withoutHtml)
  const normalized = decoded.replace(/\s+/g, ' ').trim()
  return normalized || undefined
}

export function normalizeUrl(value?: string): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
    return undefined
  }
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:') {
      parsed.protocol = 'https:'
    }
    return parsed.toString()
  } catch {
    return undefined
  }
}

export function parsePublishedDate(value?: string): string | undefined {
  if (!value) return undefined
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return undefined
  return new Date(timestamp).toISOString()
}

export function buildNewsList(
  blocks: string[],
  provider: string,
  limit: number,
  mapper: (block: string) => Partial<NewsItem> | null
): NewsItem[] {
  if (!Array.isArray(blocks) || !blocks.length) return []

  const results: NewsItem[] = []
  const maxItems = Math.max(1, limit)

  for (const block of blocks) {
    if (results.length >= maxItems) {
      break
    }

    const candidate = mapper(block)
    if (!candidate) {
      continue
    }

    const parsed = NewsItemSchema.safeParse(candidate)
    if (parsed.success) {
      results.push(parsed.data)
    } else {
      logger.warn('news_item_validation_failed', { provider, issues: parsed.error.issues })
    }
  }

  return results
}
