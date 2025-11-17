import { toMarketSymbol } from '../../symbol'
import { Quote, QuoteSchema } from '../../schemas'

const YAHOO_ENDPOINT = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols='

interface YahooQuoteResponse {
  quoteResponse?: {
    result?: Array<Record<string, any>>
    error?: unknown
  }
}

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
  const marketSymbol = toMarketSymbol(symbol, market)
  const response = await fetch(YAHOO_ENDPOINT + encodeURIComponent(marketSymbol), { cache: 'no-store' })
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
