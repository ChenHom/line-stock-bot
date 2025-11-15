import { Quote, QuoteSchema } from '../../schemas'
import { toMarketSymbol } from '../../symbol'

const TWSE_ENDPOINT = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp'

interface TwseApiResponse {
  msgArray?: Array<{
    c: string
    n: string
    z?: string
    y?: string
    h?: string
    l?: string
    o?: string
    v?: string
    ch?: string
    d?: string
    t?: string
  }>
  rtmessage?: string
}

/**
 * TWSE quote provider using the realtime stock info endpoint.
 */
export async function getQuoteTwse(symbol: string): Promise<Quote> {
  const normalized = symbol.trim()
  const channel = buildChannel(normalized)
  const url = `${TWSE_ENDPOINT}?json=1&delay=0&ex_ch=${encodeURIComponent(channel)}`

  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`TWSE http ${response.status}`)
  }

  const payload = (await response.json()) as TwseApiResponse
  const first = payload?.msgArray?.[0]
  if (!first) {
    throw new Error('TWSE empty payload')
  }

  const price = parseNumber(first.z)
  const prevClose = parseNumber(first.y)
  const change = isFiniteNumber(price) && isFiniteNumber(prevClose) ? Number((price - prevClose).toFixed(2)) : undefined
  const changePercent = isFiniteNumber(change) && isFiniteNumber(prevClose) && prevClose !== 0
    ? Number(((change / prevClose) * 100).toFixed(2))
    : undefined

  const quote = {
    symbol: normalized,
    marketSymbol: toMarketSymbol(normalized),
    name: first.n,
    price,
    change,
    changePercent,
    open: parseNumber(first.o),
    high: parseNumber(first.h),
    low: parseNumber(first.l),
    prevClose,
    currency: 'TWD',
    marketTime: buildTimestamp(first.d, first.t),
    delayed: true
  }

  return QuoteSchema.parse(quote)
}

function buildChannel(symbol: string): string {
  // Default to TWSE (tse) board; format: tse_2330.tw
  return `tse_${symbol}.tw`
}

function parseNumber(value?: string): number | undefined {
  if (value == null || value === '' || value === '---') return undefined
  const parsed = Number(value.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : undefined
}

function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function buildTimestamp(date?: string, time?: string): string | undefined {
  if (!date || !time) return undefined
  const normalizedDate = date.replace(/\//g, '-').slice(0, 10)
  const iso = `${normalizedDate}T${time}+08:00`
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}
