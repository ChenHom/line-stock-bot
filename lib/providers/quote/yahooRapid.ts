import { toMarketSymbol } from '../../symbol'
import { Quote, QuoteSchema } from '../../schemas'

const YAHOO_BASE_URL = 'https://query1.finance.yahoo.com'
const YAHOO_ENDPOINT = `${YAHOO_BASE_URL}/v7/finance/quote?symbols=`
const YAHOO_CRUMB_URL = `${YAHOO_BASE_URL}/v1/test/getcrumb`
const YAHOO_SESSION_TTL_MS = 30 * 60 * 1000
const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9'
}

interface YahooQuoteResponse {
  quoteResponse?: {
    result?: Array<Record<string, any>>
    error?: unknown
  }
}

interface YahooSession {
  cookie: string
  crumb: string
  expiresAt: number
}

let yahooSession: YahooSession | null = null

/**
 * Yahoo Finance provider (Rapid API compatible endpoint).
 */
export async function getQuoteYahoo(rawSymbol: string): Promise<Quote> {
  const normalized = rawSymbol.trim()
  const markets: Array<'TW' | 'TWO'> = ['TW', 'TWO']
  let lastError: Error | null = null

  for (const market of markets) {
    try {
      const quote = await fetchYahooQuote(normalized, market)
      if (quote) {
        return quote
      }
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error))
      lastError = normalizedError
      if (!isYahooEmptyError(normalizedError)) {
        throw normalizedError
      }
    }
  }

  throw lastError ?? new Error('Yahoo quote empty')
}

async function fetchYahooQuote(symbol: string, market: 'TW' | 'TWO'): Promise<Quote> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const session = await ensureYahooSession(attempt > 0)
      return await fetchYahooQuoteWithSession(symbol, market, session)
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error))
      lastError = normalized
      if (!isYahooAuthError(normalized) || attempt === 1) {
        throw normalized
      }
    }
  }

  throw lastError ?? new Error('Yahoo quote failed')
}

async function fetchYahooQuoteWithSession(symbol: string, market: 'TW' | 'TWO', session: YahooSession): Promise<Quote> {
  const marketSymbol = toMarketSymbol(symbol, market)
  const url = `${YAHOO_ENDPOINT}${encodeURIComponent(marketSymbol)}&crumb=${encodeURIComponent(session.crumb)}`
  const response = await fetch(url, {
    cache: 'no-store',
    headers: buildYahooHeaders(session)
  })
  if (!response.ok) {
    throw new Error(`Yahoo quote http ${response.status}`)
  }

  const payload = (await response.json()) as YahooQuoteResponse
  const quoteData = payload?.quoteResponse?.result?.[0]
  if (!quoteData) {
    throw new Error('Yahoo quote empty')
  }

  const price = chooseNumber(quoteData.regularMarketPrice, quoteData.postMarketPrice, quoteData.preMarketPrice)
  const change = chooseNumber(quoteData.regularMarketChange)
  const changePercent = chooseNumber(quoteData.regularMarketChangePercent)

  const quote = {
    symbol,
    marketSymbol,
    name: quoteData.longName || quoteData.shortName,
    price,
    change,
    changePercent,
    open: chooseNumber(quoteData.regularMarketOpen),
    high: chooseNumber(quoteData.regularMarketDayHigh),
    low: chooseNumber(quoteData.regularMarketDayLow),
    prevClose: chooseNumber(quoteData.regularMarketPreviousClose),
    currency: quoteData.currency || 'TWD',
    marketTime: quoteData.regularMarketTime ? new Date(quoteData.regularMarketTime * 1000).toISOString() : undefined,
    delayed: true
  }

  return QuoteSchema.parse(quote)
}

async function ensureYahooSession(forceRefresh = false): Promise<YahooSession> {
  const staticSession = getStaticYahooSession()
  if (staticSession) {
    yahooSession = staticSession
    return yahooSession
  }

  if (!forceRefresh && yahooSession && yahooSession.expiresAt > Date.now()) {
    return yahooSession
  }

  // 1. Get initial cookie from fc.yahoo.com
  const cookieResponse = await fetch('https://fc.yahoo.com', {
    cache: 'no-store',
    headers: buildYahooHeaders()
  })

  // Even if 404/302, we just want the cookies
  const initialCookies = extractCookies(cookieResponse.headers)
  if (!initialCookies.length) {
    // Fallback: try finance.yahoo.com if fc.yahoo.com fails to set cookies
    const backupResponse = await fetch('https://finance.yahoo.com', {
      cache: 'no-store',
      headers: buildYahooHeaders()
    })
    const backupCookies = extractCookies(backupResponse.headers)
    if (backupCookies.length) {
      initialCookies.push(...backupCookies)
    }
  }

  if (!initialCookies.length) {
    throw new Error('Yahoo initial cookie missing')
  }

  const cookieString = initialCookies.join('; ')

  // 2. Get crumb using the cookie
  const response = await fetch(YAHOO_CRUMB_URL, {
    cache: 'no-store',
    headers: {
      ...buildYahooHeaders(),
      Cookie: cookieString
    }
  })

  if (!response.ok) {
    throw new Error(`Yahoo crumb http ${response.status}`)
  }

  const crumb = (await response.text()).trim()
  if (!crumb) {
    throw new Error('Yahoo crumb empty')
  }

  yahooSession = {
    cookie: cookieString,
    crumb,
    expiresAt: Date.now() + YAHOO_SESSION_TTL_MS
  }

  return yahooSession
}

function buildYahooHeaders(session?: YahooSession) {
  const headers: Record<string, string> = { ...YAHOO_HEADERS }
  if (session?.cookie) {
    headers.Cookie = session.cookie
  }
  return headers
}

function extractCookies(headers?: Headers): string[] {
  if (!headers) return []
  const adapter = (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie
  const setCookies = typeof adapter === 'function' ? adapter.call(headers) : undefined
  const fallback = headers.get('set-cookie')
  const rawCookies = setCookies && setCookies.length > 0
    ? setCookies
    : fallback
      ? [fallback]
      : []
  return rawCookies
    .map((cookie) => (cookie || '').split(';', 1)[0])
    .filter((cookie) => Boolean(cookie))
}

function isYahooAuthError(error: Error): boolean {
  return /Yahoo quote http (401|403)/i.test(error.message) || /crumb/i.test(error.message)
}

function getStaticYahooSession(): YahooSession | null {
  const cookie = process.env.YAHOO_QUOTE_STATIC_COOKIE
  const crumb = process.env.YAHOO_QUOTE_STATIC_CRUMB
  if (!cookie || !crumb) {
    return null
  }
  return {
    cookie,
    crumb,
    expiresAt: Number.POSITIVE_INFINITY
  }
}

function isYahooEmptyError(error: Error): boolean {
  return /Yahoo quote empty/i.test(error.message)
}

function chooseNumber(...candidates: Array<number | string | undefined>): number | undefined {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue
    const parsed = Number(candidate)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}
