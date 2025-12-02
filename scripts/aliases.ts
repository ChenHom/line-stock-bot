import fs from 'fs'
import path from 'path'
import type { Stock } from './transform'
import { StockAliasesSchema, StockAliases } from './schemas'

export function generateAliases(stocks: Stock[], aliasesFilePath?: string): Stock[] {
  const manualAliases: StockAliases = loadManualAliases(aliasesFilePath)

  return stocks.map((s) => {
    const auto = generateAutoAliases(s.name, s.symbol)
    const manual = manualAliases[s.symbol] ?? []
    const merged = Array.from(new Set([...auto, ...manual]))
    return { ...s, aliases: merged }
  })
}

export function generateAutoAliases(name: string, symbol: string): string[] {
  const aliases = new Set<string>()
  const raw = (name || '').trim()
  if (!raw) return []

  // Chinese shortenings: remove 控股 / 投控
  const cn = raw.replace(/(控股|投控)$/u, '')
  if (cn !== raw) aliases.add(cn)

  // Remove common suffixes like -KY, -DR from symbol or name
  // Some names include '-KY' etc, remove those
  const stripped = raw.replace(/-KY$|-DR$/iu, '')
  if (stripped !== raw) aliases.add(stripped)

  // If name contains '股份有限公司' or other long forms, try to trim common phrases (simple rules)
  const shortName = raw.replace(/股份有限公司|有限公司|公司$/u, '')
  if (shortName !== raw) aliases.add(shortName)

  // fallback: lowercase/uppercase symbol-based alias? Not required
  return Array.from(aliases).map((a) => a.trim()).filter(Boolean)
}

function loadManualAliases(filePath?: string): StockAliases {
  const defaultPath = path.join(process.cwd(), 'scripts', 'stock-aliases.json')
  const p = filePath || defaultPath
  if (!fs.existsSync(p)) return {}
  try {
    const content = fs.readFileSync(p, 'utf-8')
    const parsed = JSON.parse(content)
    const validation = StockAliasesSchema.safeParse(parsed)
    if (!validation.success) {
      console.warn('Invalid stock-aliases.json format; ignoring manual aliases')
      return {}
    }
    return validation.data
  } catch (e) {
    console.warn('Error loading stock-aliases.json', e)
    return {}
  }
}
