#!/usr/bin/env tsx
import path from 'path'
import { fetchTwse, fetchTpex } from './fetchers'
import { fromTwse, fromTpex, mergeStocks } from './transform'
import { generateAliases } from './aliases'
import { writeStockList } from './output'

async function main() {
  try {
    console.log('Fetching TWSE data...')
    const twseRaw = await fetchTwse()
    console.log(`TWSE items: ${twseRaw.length}`)

    console.log('Fetching TPEx data...')
    const tpexRaw = await fetchTpex()
    console.log(`TPEx items: ${tpexRaw.length}`)

    const twse = fromTwse(twseRaw)
    const tpex = fromTpex(tpexRaw)

    const merged = mergeStocks(twse, tpex)

    console.log(`Merged total: ${merged.length}`)

    if (merged.length < 500) {
      console.error('Stock count below 500, aborting.')
      process.exit(1)
    }

    const withAliases = generateAliases(merged, path.join(process.cwd(), 'scripts', 'stock-aliases.json'))

    const outPath = path.join(process.cwd(), 'lib', 'stock-list.ts')
    writeStockList(outPath, withAliases)

    console.log(`Stock list generated: ${outPath}`)
    console.log('Done')
    process.exit(0)
  } catch (err: any) {
    console.error('Error updating stocks:', err?.message ?? err)
    process.exit(2)
  }
}

if (require.main === module) {
  main()
}
