import fs from 'fs'
import path from 'path'
import type { Stock } from './transform'

export function writeStockList(outPath: string, stocks: Stock[]): void {
  const now = new Date().toISOString()
  const counts = {
    twse: stocks.filter((s) => s.market === 'twse').length,
    tpex: stocks.filter((s) => s.market === 'tpex').length
  }
  const total = counts.twse + counts.tpex
  const entries = stocks.map((s) => ({ symbol: s.symbol, name: s.name, aliases: s.aliases ?? [] }))

  const content = `/**\n * 台股股票列表\n *\n * ⚠️ 此檔案由 scripts/update-stocks.ts 自動產生，請勿手動編輯\n *\n * 上次更新: ${now}\n * 上市股票: ${counts.twse}\n * 上櫃股票: ${counts.tpex}\n * 總計: ${total}\n */\n\nimport type { StockDictionaryEntry } from '../lib/types'\n\nexport const STOCK_LIST: StockDictionaryEntry[] = ${JSON.stringify(entries, null, 2)}\n\nexport const STOCK_COUNT = {\n  twse: ${counts.twse},\n  tpex: ${counts.tpex},\n  total: ${total}\n}\n`

  // Ensure directory exists
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, content, 'utf-8')
}
