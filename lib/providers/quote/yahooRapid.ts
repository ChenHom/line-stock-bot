import { toMarketSymbol } from '../../symbol'
import { Quote, QuoteSchema } from '../../schemas'

const Y_URL = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols='

export async function getQuoteYahoo(rawSymbol: string): Promise<Quote> {
  const marketSymbol = toMarketSymbol(rawSymbol)
  const r = await fetch(Y_URL + encodeURIComponent(marketSymbol), { cache: 'no-store' })
  if (!r.ok) throw new Error(`Yahoo quote http ${r.status}`)
  const j: any = await r.json()
  const q = j?.quoteResponse?.result?.[0]
  if (!q) throw new Error('Yahoo quote empty')

  const price = Number(q.regularMarketPrice ?? q.postMarketPrice ?? q.preMarketPrice ?? NaN)
  const change = Number(q.regularMarketChange ?? 0)
  const changePercent = Number(q.regularMarketChangePercent ?? 0)

  const quote = {
    symbol: rawSymbol,
    marketSymbol,
    name: q.longName || q.shortName,
    price,
    change,
    changePercent,
    open: Number(q.regularMarketOpen ?? NaN),
    high: Number(q.regularMarketDayHigh ?? NaN),
    low: Number(q.regularMarketDayLow ?? NaN),
    prevClose: Number(q.regularMarketPreviousClose ?? NaN),
    currency: q.currency,
    marketTime: q.regularMarketTime ? new Date(q.regularMarketTime * 1000).toISOString() : undefined,
    delayed: true
  }

  // Validate with Zod schema
  return QuoteSchema.parse(quote)
}
