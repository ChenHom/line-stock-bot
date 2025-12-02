import { TwseResponseSchema, TpexResponseSchema, TwseStockItem, TpexStockItem } from './schemas'

const TWSE_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'
const TPEX_URL = 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes'

async function fetchJsonWithTimeout(url: string, timeoutMs = 30000): Promise<any> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }
    return await res.json()
  } finally {
    clearTimeout(id)
  }
}

export async function fetchTwse(): Promise<TwseStockItem[]> {
  const data = await fetchJsonWithTimeout(TWSE_URL)
  const parsed = TwseResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(`TWSE response validation failed: ${JSON.stringify(parsed.error.issues)}`)
  }
  return parsed.data
}

export async function fetchTpex(): Promise<TpexStockItem[]> {
  const data = await fetchJsonWithTimeout(TPEX_URL)
  const parsed = TpexResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(`TPEx response validation failed: ${JSON.stringify(parsed.error.issues)}`)
  }
  return parsed.data
}

