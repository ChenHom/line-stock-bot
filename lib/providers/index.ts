import { Quote, NewsItem } from '../schemas'
import { logger } from '../logger'
import { metrics } from '../monitoring'
import { getQuoteYahoo } from './quote/yahooRapid'
import { getQuoteTwse } from './quote/twse'
import { getNewsGoogleRss } from './news/googleRss'
import { getNewsYahooRss } from './news/yahooRss'
import { withCache, generateQuoteCacheKey, generateNewsCacheKey } from './withCache'

type QuoteProviderName = 'twse' | 'yahoo-rapid'
type NewsProviderName = 'google-rss' | 'yahoo-rss'

interface ProviderOptions {
  requestId?: string
  timeoutMs?: number
}

interface QuoteProviderConfig {
  name: QuoteProviderName
  fetcher: (symbol: string) => Promise<Quote>
  timeoutMs?: number
}

interface NewsProviderConfig {
  name: NewsProviderName
  fetcher: (keyword: string, limit?: number) => Promise<NewsItem[]>
  timeoutMs?: number
}

const DEFAULT_PROVIDER_TIMEOUT = getDefaultTimeout()

const QUOTE_PROVIDER_ALIASES: Record<string, QuoteProviderName> = {
  twse: 'twse',
  yahoo: 'yahoo-rapid',
  'yahoo-rapid': 'yahoo-rapid'
}

const NEWS_PROVIDER_ALIASES: Record<string, NewsProviderName> = {
  google: 'google-rss',
  'google-rss': 'google-rss',
  yahoo: 'yahoo-rss',
  'yahoo-rss': 'yahoo-rss'
}

const quoteProviders: QuoteProviderConfig[] = [
  { name: 'twse', fetcher: getQuoteTwse },
  { name: 'yahoo-rapid', fetcher: getQuoteYahoo }
]

const newsProviders: NewsProviderConfig[] = [
  { name: 'google-rss', fetcher: getNewsGoogleRss },
  { name: 'yahoo-rss', fetcher: getNewsYahooRss }
]

const fetchQuoteWithFallback = async (symbol: string, options?: ProviderOptions): Promise<Quote> => {
  const providerOrder = orderQuoteProviders(process.env.QUOTE_PRIMARY_PROVIDER)
  return executeWithFallback<Quote, QuoteProviderConfig>(providerOrder, options, {
    symbol,
    requestId: options?.requestId
  }, (provider) => provider.fetcher(symbol))
}

/**
 * Retrieve stock quote with sequential fallback, cached for 45 seconds.
 */
export const getQuoteWithFallback = withCache(fetchQuoteWithFallback, {
  keyFn: (symbol: string) => generateQuoteCacheKey(symbol),
  ttl: 45
})

const fetchNewsWithFallback = async (keyword: string, limit = 5, options?: ProviderOptions): Promise<NewsItem[]> => {
  const providerOrder = orderNewsProviders(process.env.NEWS_PRIMARY_PROVIDER)
  return executeWithFallback<NewsItem[], NewsProviderConfig>(
    providerOrder,
    options,
    { keyword, limit, requestId: options?.requestId },
    (provider) => provider.fetcher(keyword, limit)
  )
}

/**
 * Retrieve industry news with sequential fallback, cached for 15 minutes with stale support.
 */
export const getIndustryNews = withCache(fetchNewsWithFallback, {
  keyFn: (keyword: string, limit: number = 5) => generateNewsCacheKey(keyword, limit),
  ttl: 900,
  staleWhileRevalidateTtl: 900
})

function orderQuoteProviders(preferred?: string): QuoteProviderConfig[] {
  return orderProviders(quoteProviders, preferred ? QUOTE_PROVIDER_ALIASES[preferred.toLowerCase()] : undefined)
}

function orderNewsProviders(preferred?: string): NewsProviderConfig[] {
  return orderProviders(newsProviders, preferred ? NEWS_PROVIDER_ALIASES[preferred.toLowerCase()] : undefined)
}

function orderProviders<T extends { name: string }>(providers: T[], preferred?: string): T[] {
  if (!preferred) return providers
  const idx = providers.findIndex((p) => p.name === preferred)
  if (idx <= 0) return providers
  const reordered = providers.slice()
  const [primary] = reordered.splice(idx, 1)
  reordered.unshift(primary)
  return reordered
}

async function executeWithFallback<T, P extends { name: string; timeoutMs?: number }>(
  providers: P[],
  options: ProviderOptions | undefined,
  context: Record<string, any>,
  runner: (provider: P) => Promise<T>
): Promise<T> {
  if (!providers.length) {
    throw new Error('No providers configured')
  }

  let lastError: unknown
  let notFoundError: Error | null = null

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i]
    const timeoutMs = options?.timeoutMs ?? provider.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT
    const startTime = Date.now()

    try {
      const result = await withTimeout(runner(provider), timeoutMs, provider.name)
      logger.providerSuccess(provider.name, Date.now() - startTime, context)
      metrics.recordProviderSuccess(provider.name)
      return result
    } catch (error) {
      lastError = error
      const reason = error instanceof Error ? error.message : String(error)
      if (!notFoundError && isProviderNotFoundError(error)) {
        notFoundError = error instanceof Error ? error : new Error(reason)
      }
      logger.providerError(provider.name, reason, context)
      metrics.recordProviderError(provider.name)

      const next = providers[i + 1]
      if (next) {
        logger.providerFallback(provider.name, next.name, reason)
        metrics.recordProviderFallback(provider.name, next.name)
      }
    }
  }

  if (notFoundError) {
    throw notFoundError
  }

  throw lastError instanceof Error ? lastError : new Error('All providers failed')
}

function getDefaultTimeout(): number {
  const raw = Number(process.env.PROVIDER_TIMEOUT_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : 2000
}

function isProviderNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /(empty|not\s*found|unknown\s*symbol|invalid\s*symbol)/i.test(message)
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, providerName: string): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise
  }

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${providerName} timeout after ${timeoutMs}ms`))
    }, timeoutMs)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

