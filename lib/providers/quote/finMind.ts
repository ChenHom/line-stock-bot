// lib/providers/quote/finMind.ts
import { Quote, QuoteSchema } from '../../schemas'
import { toMarketSymbol } from '../../symbol'

const FINMIND_ENDPOINT = 'https://api.finmindtrade.com/api/v4/data'
const FINMIND_DATASET = 'TaiwanStockTick'

interface FinMindApiResponse {
  msg: string
  status: number
  data: Array<{
    date: string
    stock_id: string
    deal_price?: number
    volume?: number
    Time?: string
  }>
}

interface FinMindStockInfoResponse {
  msg: string
  status: number
  data: Array<{
    stock_id: string
    stock_name: string
    industry_category?: string
    type?: string
  }>
}

/**
 * FinMind quote provider using the TaiwanStockTick dataset.
 * Requires FINMIND_TOKEN environment variable.
 */
export async function getQuoteFinMind(symbol: string): Promise<Quote> {
  const token = process.env.FINMIND_TOKEN
  if (!token) {
    throw new Error('FINMIND_TOKEN not configured')
  }

  const normalized = symbol.trim()
  const today = getToday()

  // Fetch latest tick data
  const tickUrl = buildFinMindUrl({
    dataset: FINMIND_DATASET,
    data_id: normalized,
    start_date: today,
    token
  })

  const tickResponse = await fetch(tickUrl, { cache: 'no-store' })
  if (!tickResponse.ok) {
    throw new Error(`FinMind http ${tickResponse.status}`)
  }

  const tickPayload = (await tickResponse.json()) as FinMindApiResponse
  if (tickPayload.status !== 200) {
    throw new Error(`FinMind API error: ${tickPayload.msg}`)
  }

  const ticks = tickPayload.data || []
  if (ticks.length === 0) {
    throw new Error('FinMind empty payload')
  }

  // Get the most recent tick
  const latestTick = ticks[ticks.length - 1]
  const price = latestTick.deal_price

  if (typeof price !== 'number' || !Number.isFinite(price)) {
    throw new Error('FinMind invalid price data')
  }

  // Fetch stock name (optional, graceful failure)
  let stockName: string | undefined
  try {
    stockName = await fetchStockName(normalized, token)
  } catch {
    // Ignore name fetch errors, use symbol as fallback
  }

  // Calculate daily stats from tick data
  const prices = ticks
    .map((t) => t.deal_price)
    .filter((p): p is number => typeof p === 'number' && Number.isFinite(p))

  const open = prices[0]
  const high = Math.max(...prices)
  const low = Math.min(...prices)
  const totalVolume = ticks.reduce((sum, t) => sum + (t.volume || 0), 0)

  // FinMind tick data doesn't include previous close, so we estimate change as 0
  // In production, you might want to fetch previous day's close for accurate change calculation
  const prevClose = open // Approximation
  const change = price - prevClose
  const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0

  const quote = {
    symbol: normalized,
    marketSymbol: toMarketSymbol(normalized),
    name: stockName,
    price,
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(2)),
    open,
    high,
    low,
    prevClose,
    volume: totalVolume,
    currency: 'TWD',
    marketTime: buildMarketTime(today, latestTick.Time),
    delayed: false
  }

  return QuoteSchema.parse(quote)
}

async function fetchStockName(symbol: string, token: string): Promise<string | undefined> {
  const url = buildFinMindUrl({
    dataset: 'TaiwanStockInfo',
    token
  })

  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    return undefined
  }

  const payload = (await response.json()) as FinMindStockInfoResponse
  const stockInfo = payload.data?.find((item) => item.stock_id === symbol)
  return stockInfo?.stock_name
}

function buildFinMindUrl(params: Record<string, string>): string {
  const url = new URL(FINMIND_ENDPOINT)
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value)
  })
  return url.toString()
}

function getToday(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildMarketTime(date: string, time?: string): string {
  if (time) {
    // FinMind time format: "HH:MM:SS" or "HH:MM:SS.mmm"
    const [hours, minutes, seconds] = time.split(':')
    const dateTime = new Date(`${date}T${hours}:${minutes}:${seconds?.split('.')[0] || '00'}+08:00`)
    return dateTime.toISOString()
  }
  return new Date().toISOString()
}
