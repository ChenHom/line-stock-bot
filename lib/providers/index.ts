import { Quote, NewsItem } from '../schemas'
import { getQuoteYahoo } from './quote/yahooRapid'
import { getQuoteTwseDaily } from './quote/twse'
import { getNewsGoogleRss } from './news/googleRss'
import { getNewsYahooRss } from './news/yahooRss'
import { withCache, generateQuoteCacheKey, generateNewsCacheKey } from './withCache'
import { logger } from '../logger'
import { metrics } from '../monitoring'

// Wrap providers with cache
const getQuoteYahooCached = withCache(getQuoteYahoo, {
  keyFn: generateQuoteCacheKey,
  ttl: 45 // 45 seconds
})

const getQuoteTwseCached = withCache(getQuoteTwseDaily, {
  keyFn: generateQuoteCacheKey,
  ttl: 45 // 45 seconds
})

const getNewsGoogleCached = withCache(getNewsGoogleRss, {
  keyFn: (keyword: string, limit: number = 5) => generateNewsCacheKey(keyword, limit),
  ttl: 900 // 15 minutes
})

const getNewsYahooCached = withCache(getNewsYahooRss, {
  keyFn: (keyword: string, limit: number = 5) => generateNewsCacheKey(keyword, limit),
  ttl: 900 // 15 minutes
})

/**
 * Get quote with automatic fallback based on configured provider priority
 * Default: TWSE primary, Yahoo fallback
 * Configurable via QUOTE_PRIMARY_PROVIDER env var (twse|yahoo)
 */
export async function getQuoteWithFallback(symbol: string): Promise<Quote> {
  const primaryProvider = (process.env.QUOTE_PRIMARY_PROVIDER || 'twse').toLowerCase()

  if (primaryProvider === 'yahoo') {
    // Yahoo primary, TWSE fallback
    try {
      const startTime = Date.now()
      const result = await getQuoteYahooCached(symbol)
      logger.providerSuccess('yahoo', Date.now() - startTime, { symbol })
      metrics.recordProviderSuccess('yahoo')
      return result
    } catch (e) {
      logger.providerFallback('yahoo', 'twse', e instanceof Error ? e.message : String(e))
      metrics.recordProviderError('yahoo')
      metrics.recordProviderFallback('yahoo', 'twse')
      const startTime = Date.now()
      const result = await getQuoteTwseCached(symbol)
      logger.providerSuccess('twse', Date.now() - startTime, { symbol, fallback: true })
      metrics.recordProviderSuccess('twse')
      return result
    }
  } else {
    // TWSE primary (default), Yahoo fallback
    try {
      const startTime = Date.now()
      const result = await getQuoteTwseCached(symbol)
      logger.providerSuccess('twse', Date.now() - startTime, { symbol })
      metrics.recordProviderSuccess('twse')
      return result
    } catch (e) {
      logger.providerFallback('twse', 'yahoo', e instanceof Error ? e.message : String(e))
      metrics.recordProviderError('twse')
      metrics.recordProviderFallback('twse', 'yahoo')
      const startTime = Date.now()
      const result = await getQuoteYahooCached(symbol)
      logger.providerSuccess('yahoo', Date.now() - startTime, { symbol, fallback: true })
      metrics.recordProviderSuccess('yahoo')
      return result
    }
  }
}

/**
 * Get industry news with automatic fallback
 * Google RSS primary, Yahoo RSS fallback
 */
export async function getIndustryNews(keyword: string, limit = 5): Promise<NewsItem[]> {
  try {
    const startTime = Date.now()
    const result = await getNewsGoogleCached(keyword, limit)
    logger.providerSuccess('google-rss', Date.now() - startTime, { keyword, limit })
    metrics.recordProviderSuccess('google-rss')
    return result
  } catch (e) {
    logger.providerFallback('google-rss', 'yahoo-rss', e instanceof Error ? e.message : String(e))
    metrics.recordProviderError('google-rss')
    metrics.recordProviderFallback('google-rss', 'yahoo-rss')
    const startTime = Date.now()
    const result = await getNewsYahooCached(keyword, limit)
    logger.providerSuccess('yahoo-rss', Date.now() - startTime, { keyword, limit, fallback: true })
    metrics.recordProviderSuccess('yahoo-rss')
    return result
  }
}

