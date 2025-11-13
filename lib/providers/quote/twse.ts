import { Quote, QuoteSchema } from '../../schemas'

export async function getQuoteTwseDaily(symbol: string): Promise<Quote> {
  // 以 TWSE 日資料近似，非即時；做為備援兜底
  const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&stockNo=${encodeURIComponent(symbol)}`
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`TWSE http ${r.status}`)
  const j: any = await r.json()
  const rows = j?.data
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('TWSE empty')

  // 取最後一日
  const last = rows[rows.length - 1]
  // [日期, 成交股數, 成交金額, 開盤價, 最高價, 最低價, 收盤價, 漲跌價差, 交易筆數]
  const open = Number((last[3] || '').toString().replace(/,/g, ''))
  const high = Number((last[4] || '').toString().replace(/,/g, ''))
  const low = Number((last[5] || '').toString().replace(/,/g, ''))
  const close = Number((last[6] || '').toString().replace(/,/g, ''))
  const chg = Number((last[7] || '0').toString().replace(/[,+]/g, ''))

  const quote = {
    symbol,
    marketSymbol: symbol + '.TW',
    name: undefined,
    price: close,
    change: chg,
    changePercent: open ? (chg / open) * 100 : 0,
    open, high, low,
    prevClose: undefined,
    currency: 'TWD',
    marketTime: undefined,
    delayed: true
  }

  // Validate with Zod schema
  return QuoteSchema.parse(quote)
}
