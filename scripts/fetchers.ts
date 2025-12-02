import { TwseResponseSchema, TpexResponseSchema, TwseStockItem, TpexStockItem } from './schemas'

const TWSE_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'
const TPEX_URL = 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes'

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 30000): Promise<any> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; stock-bot/1.0)',
        'Accept': 'application/json',
      },
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }
    return await res.json()
  } finally {
    clearTimeout(id)
  }
}

async function fetchWithRetry(
  url: string,
  retries = 3,
  delayMs = 2000,
  timeoutMs = 30000
): Promise<any> {
  let lastError: Error | undefined
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetchJsonWithTimeout(url, timeoutMs)
    } catch (err: any) {
      lastError = err
      console.warn(`Attempt ${attempt}/${retries} failed for ${url}: ${err?.message ?? err}`)
      if (attempt < retries) {
        console.log(`Retrying in ${delayMs}ms...`)
        await sleep(delayMs)
        delayMs *= 2 // exponential backoff
      }
    }
  }
  throw lastError
}

export async function fetchTwse(): Promise<TwseStockItem[]> {
  const data = await fetchWithRetry(TWSE_URL)
  const parsed = TwseResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(`TWSE response validation failed: ${JSON.stringify(parsed.error.issues)}`)
  }
  return parsed.data
}

export async function fetchTpex(): Promise<TpexStockItem[]> {
  const data = await fetchWithRetry(TPEX_URL)
  const parsed = TpexResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(`TPEx response validation failed: ${JSON.stringify(parsed.error.issues)}`)
  }
  return parsed.data
}

