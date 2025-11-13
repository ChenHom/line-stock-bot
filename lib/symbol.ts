// Symbol mapping for common Taiwan stocks
// In production, this could be loaded from a database or external API
const SYMBOL_NAME_MAP: Record<string, string> = {
  '台積電': '2330',
  '聯發科': '2454',
  '鴻海': '2317',
  '台達電': '2308',
  '聯電': '2303',
  '日月光': '2311',
  '國巨': '2327',
  '長榮': '2603',
  '陽明': '2609',
  '中鋼': '2002',
  '華碩': '2357',
  '廣達': '2382',
  '和碩': '4938',
  '大立光': '3008',
  '玉山金': '2884',
  '兆豐金': '2886',
  '富邦金': '2881',
  '中信金': '2891',
  '國泰金': '2882',
  '台新金': '2887'
}

/**
 * Resolve a stock symbol from name or code
 * @param input Stock name (Chinese) or symbol code
 * @returns Symbol code (e.g., '2330')
 */
export function resolveSymbol(input: string): string {
  const trimmed = input.trim()

  // If it's already a numeric symbol, return as-is
  if (/^\d{4}$/.test(trimmed)) {
    return trimmed
  }

  // Try to find in name mapping
  const resolved = SYMBOL_NAME_MAP[trimmed]
  if (resolved) {
    return resolved
  }

  // If not found, return original input (let downstream handle it)
  return trimmed
}

export function toMarketSymbol(symbol: string, board?: 'TW'|'TWO'): string {
  const s = symbol.trim()
  if (!/^\d{4}$/.test(s)) return s
  if (board === 'TWO') return `${s}.TWO`
  // 簡易判斷：一般預設 TW（後續可維護映射表）
  return `${s}.TW`
}

