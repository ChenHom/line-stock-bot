import type { TwseStockItem, TpexStockItem } from './schemas'

export interface Stock {
  symbol: string
  name: string
  market: 'twse' | 'tpex'
  aliases?: string[]
}

function normalizeSymbol(s: string): string {
  return (s || '').toUpperCase().trim()
}

function normalizeName(s: string): string {
  return (s || '').trim()
}

export function fromTwse(items: TwseStockItem[]): Stock[] {
  return items
    .map((it) => ({ symbol: normalizeSymbol(it.Code), name: normalizeName(it.Name), market: 'twse' as const }))
}

export function fromTpex(items: TpexStockItem[]): Stock[] {
  return items
    .map((it) => ({ symbol: normalizeSymbol(it.SecuritiesCompanyCode), name: normalizeName(it.CompanyName), market: 'tpex' as const }))
}

export function mergeStocks(primary: Stock[], secondary: Stock[]): Stock[] {
  const map = new Map<string, Stock>()
  // primary first
  for (const s of primary) {
    if (!s.symbol) continue
    map.set(s.symbol, s)
  }
  for (const s of secondary) {
    if (!s.symbol) continue
    if (!map.has(s.symbol)) {
      map.set(s.symbol, s)
    }
  }
  // convert to array sorted by symbol
  return Array.from(map.values()).sort((a, b) => a.symbol.localeCompare(b.symbol))
}

