export function toMarketSymbol(symbol: string, board?: 'TW'|'TWO'): string {
  const s = symbol.trim()
  if (!/^\d{4}$/.test(s)) return s
  if (board === 'TWO') return `${s}.TWO`
  // 簡易判斷：一般預設 TW（後續可維護映射表）
  return `${s}.TW`
}
