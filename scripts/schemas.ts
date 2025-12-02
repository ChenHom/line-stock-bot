import { z } from 'zod'

export const TwseStockItemSchema = z.object({
  Code: z.string().min(1),
  Name: z.string().min(1),
  TradeVolume: z.string().optional(),
  TradeValue: z.string().optional(),
  OpeningPrice: z.string().optional(),
  HighestPrice: z.string().optional(),
  LowestPrice: z.string().optional(),
  ClosingPrice: z.string().optional(),
  Change: z.string().optional(),
  Transaction: z.string().optional()
})

export const TwseResponseSchema = z.array(TwseStockItemSchema)
export type TwseStockItem = z.infer<typeof TwseStockItemSchema>

export const TpexStockItemSchema = z.object({
  SecuritiesCompanyCode: z.string().min(1),
  CompanyName: z.string().min(1),
  ClosingPrice: z.string().optional(),
  Change: z.string().optional(),
  OpeningPrice: z.string().optional(),
  HighestPrice: z.string().optional(),
  LowestPrice: z.string().optional(),
  TradingVolume: z.string().optional(),
  TradingValue: z.string().optional(),
  TransactionCount: z.string().optional()
})

export const TpexResponseSchema = z.array(TpexStockItemSchema)
export type TpexStockItem = z.infer<typeof TpexStockItemSchema>

export const StockAliasesSchema = z.record(z.string(), z.array(z.string()))
export type StockAliases = z.infer<typeof StockAliasesSchema>
