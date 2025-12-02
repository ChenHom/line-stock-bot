import Fuse from 'fuse.js'
import { STOCK_LIST } from './stock-list'

const NUMERIC_SYMBOL_REGEX = /^\d{4}$/
export const CONFIDENCE_THRESHOLD = 80

interface StockDictionaryEntry {
  symbol: string
  name: string
  aliases?: string[]
}

export interface FuzzyMatchResult {
  symbol: string
  name: string
  confidence: number
  score?: number
}

const STOCK_DICTIONARY: StockDictionaryEntry[] = STOCK_LIST ?? []

const fuse = new Fuse<StockDictionaryEntry>(STOCK_DICTIONARY, {
  includeScore: true,
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 1,
  keys: [
    { name: 'name', weight: 0.6 },
    { name: 'aliases', weight: 0.4 }
  ]
})

/**
 * Resolve a stock symbol from user input. Uses fuzzy matching for non-numeric input.
 */
export function resolveSymbol(input: string): string {
  const normalized = normalizeInput(input)
  if (!normalized) return ''

  if (NUMERIC_SYMBOL_REGEX.test(normalized)) {
    return normalized
  }

  const fuzzyResults = fuzzyMatchSymbols(normalized, 1)
  const best = fuzzyResults && fuzzyResults.length > 0 ? fuzzyResults[0] : undefined
  if (best) return best.symbol

  return normalized
}

/**
 * Attempt to fuzzy-match a stock name, returning confidence metadata.
 */
export function fuzzyMatchSymbol(input: string): FuzzyMatchResult | null {
  const normalized = normalizeInput(input)
  if (!normalized) return null

  const results = fuzzyMatchSymbols(normalized, 1)
  return results && results.length > 0 ? results[0] : null
}

/**
 * Fuzzy match returning top N results sorted by confidence (desc).
 */
export function fuzzyMatchSymbols(input: string, limit = 5): FuzzyMatchResult[] {
  const normalized = normalizeInput(input)
  if (!normalized) return []

  const raw = fuse.search(normalized, { limit })
  if (!raw || raw.length === 0) return []

  const mapped = raw
    .filter((r) => typeof r.score === 'number')
    .map((r) => ({
      symbol: r.item.symbol,
      name: r.item.name,
      confidence: scoreToConfidence(r.score as number),
      score: r.score
    }))
    .filter((m) => m.confidence >= CONFIDENCE_THRESHOLD)
    .sort((a, b) => b.confidence - a.confidence)

  return mapped.slice(0, limit)
}

export function toMarketSymbol(symbol: string, board?: 'TW' | 'TWO'): string {
  const normalized = normalizeInput(symbol)
  if (!NUMERIC_SYMBOL_REGEX.test(normalized)) return normalized
  if (board === 'TWO') return `${normalized}.TWO`
  return `${normalized}.TW`
}

function normalizeInput(input: string): string {
  return (input || '').trim()
}

function scoreToConfidence(score: number): number {
  const boundedScore = Math.min(Math.max(score, 0), 1)
  return Math.round((1 - boundedScore) * 100)
}

