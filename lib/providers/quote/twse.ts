import { Quote, QuoteSchema } from '../../schemas'
import { toMarketSymbol } from '../../symbol'

const TWSE_ENDPOINT = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp'

interface TwseApiResponse {
  msgArray?: Array<{
    c: string
    n: string
    nf?: string
    ex?: string
    z?: string
    pz?: string
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
  const boards: TwseBoardConfig[] = [
    { channel: 'tse', market: 'TW' },
    { channel: 'otc', market: 'TWO' }
  ]

  let lastError: Error | null = null

  for (const board of boards) {
    try {
      const quote = await fetchQuoteFromBoard(normalized, board)
      if (quote) {
        return quote
      }
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error))
      lastError = normalizedError
      if (!isEmptyPayloadError(normalizedError)) {
        throw normalizedError
      }
    }
  }

  throw lastError ?? new Error('TWSE empty payload')
}

interface TwseBoardConfig {
  channel: 'tse' | 'otc'
  market: 'TW' | 'TWO'
}

type TwseEntry = NonNullable<TwseApiResponse['msgArray']>[number]

async function fetchQuoteFromBoard(symbol: string, board: TwseBoardConfig): Promise<Quote> {
  const channel = `${board.channel}_${symbol}.tw`
  const url = `${TWSE_ENDPOINT}?json=1&delay=0&ex_ch=${encodeURIComponent(channel)}`
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`TWSE http ${response.status}`)
  }

  const payload = (await response.json()) as TwseApiResponse
  const entry = payload?.msgArray?.find((item) => (item.c || '').trim() === symbol)
  if (!entry) {
    throw new Error('TWSE empty payload')
  }

  const quote = buildQuoteFromEntry(entry, symbol, board.market)
  return QuoteSchema.parse(quote)
}

function buildQuoteFromEntry(entry: TwseEntry, symbol: string, market: 'TW' | 'TWO') {
  const price = parseNumber(entry.z) ?? parseNumber(entry.pz)
  const prevClose = parseNumber(entry.y)

  if (!isFiniteNumber(price) || !isFiniteNumber(prevClose)) {
    throw new Error('TWSE empty payload')
  }

  const change = Number((price - prevClose).toFixed(2))
  const changePercent = prevClose !== 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0

  return {
    symbol,
    marketSymbol: toMarketSymbol(symbol, market),
    name: entry.n || entry.nf,
    price,
    change,
    changePercent,
    open: parseNumber(entry.o),
    high: parseNumber(entry.h),
    low: parseNumber(entry.l),
    prevClose,
    currency: 'TWD',
    marketTime: buildTimestamp(entry.d, entry.t),
    delayed: true
  }
}

function isEmptyPayloadError(error: Error): boolean {
  return /empty/i.test(error.message)
}

function parseNumber(value?: string): number | undefined {
  if (value == null || value === '' || /^-+$/.test(value)) return undefined
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
