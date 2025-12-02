import { describe, it, expect } from 'vitest'
import { fuzzyMatchSymbols, resolveSymbol } from '../../lib/symbol'

describe('Symbol fuzzy matching', () => {
  it('returns multiple matches for broad input', () => {
    const matches = fuzzyMatchSymbols('台', 5)
    expect(Array.isArray(matches)).toBe(true)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('returns a strong match for 台積電', () => {
    const matches = fuzzyMatchSymbols('台積電', 5)
    expect(matches.length).toBeGreaterThanOrEqual(1)
    const best = matches[0]
    expect(best.symbol).toBe('2330')
    expect(best.confidence).toBeGreaterThanOrEqual(80)
  })

  it('resolveSymbol returns the canonical symbol for company name', () => {
    const resolved = resolveSymbol('台積電')
    expect(resolved).toBe('2330')
  })
})
