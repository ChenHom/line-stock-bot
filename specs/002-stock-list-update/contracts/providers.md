# API Contracts: 外部資料來源

**Feature**: 002-stock-list-update  
**Date**: 2025-12-02

## 1. TWSE OpenAPI - 上市股票

### Endpoint

```
GET https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL
```

### Request

- **Method**: GET
- **Headers**: None required
- **Query Parameters**: None

### Response

- **Content-Type**: application/json
- **Status**: 200 OK

```typescript
// Response Schema (Zod)
import { z } from 'zod'

export const TwseStockItemSchema = z.object({
  Code: z.string().min(1),
  Name: z.string().min(1),
  // 以下欄位為選填，本功能不使用
  TradeVolume: z.string().optional(),
  TradeValue: z.string().optional(),
  OpeningPrice: z.string().optional(),
  HighestPrice: z.string().optional(),
  LowestPrice: z.string().optional(),
  ClosingPrice: z.string().optional(),
  Change: z.string().optional(),
  Transaction: z.string().optional(),
})

export const TwseResponseSchema = z.array(TwseStockItemSchema)

export type TwseStockItem = z.infer<typeof TwseStockItemSchema>
```

### Example Response

```json
[
  {
    "Code": "2330",
    "Name": "台積電",
    "TradeVolume": "25,000,000",
    "ClosingPrice": "580.00"
  },
  {
    "Code": "2317",
    "Name": "鴻海",
    "TradeVolume": "15,000,000",
    "ClosingPrice": "105.00"
  }
]
```

### Error Handling

| Status | Description | Action |
|--------|-------------|--------|
| 200 | Success | Parse and process |
| 4xx | Client error | Log error, abort |
| 5xx | Server error | Log error, abort |
| Timeout | > 30 seconds | Log error, abort |

---

## 2. TPEx OpenAPI - 上櫃股票

### Endpoint

```
GET https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes
```

### Request

- **Method**: GET
- **Headers**: None required
- **Query Parameters**: None

### Response

- **Content-Type**: application/json
- **Status**: 200 OK

```typescript
// Response Schema (Zod)
import { z } from 'zod'

export const TpexStockItemSchema = z.object({
  SecuritiesCompanyCode: z.string().min(1),
  CompanyName: z.string().min(1),
  // 以下欄位為選填，本功能不使用
  ClosingPrice: z.string().optional(),
  Change: z.string().optional(),
  OpeningPrice: z.string().optional(),
  HighestPrice: z.string().optional(),
  LowestPrice: z.string().optional(),
  TradingVolume: z.string().optional(),
  TradingValue: z.string().optional(),
  TransactionCount: z.string().optional(),
})

export const TpexResponseSchema = z.array(TpexStockItemSchema)

export type TpexStockItem = z.infer<typeof TpexStockItemSchema>
```

### Example Response

```json
[
  {
    "SecuritiesCompanyCode": "6510",
    "CompanyName": "精測",
    "ClosingPrice": "850.00",
    "Change": "+15.00"
  },
  {
    "SecuritiesCompanyCode": "5765",
    "CompanyName": "技鼎",
    "ClosingPrice": "125.00",
    "Change": "-2.00"
  }
]
```

### Error Handling

| Status | Description | Action |
|--------|-------------|--------|
| 200 | Success | Parse and process |
| 4xx | Client error | Log error, abort |
| 5xx | Server error | Log error, abort |
| Timeout | > 30 seconds | Log error, abort |

---

## 3. 統一輸出格式

### Stock Entry (Internal)

```typescript
// 統一的內部資料結構
export interface Stock {
  symbol: string     // 股票代號
  name: string       // 公司簡稱
  market: 'twse' | 'tpex'  // 市場來源
}

// 轉換函式
export function fromTwse(item: TwseStockItem): Stock {
  return {
    symbol: item.Code.trim(),
    name: item.Name.trim(),
    market: 'twse'
  }
}

export function fromTpex(item: TpexStockItem): Stock {
  return {
    symbol: item.SecuritiesCompanyCode.trim(),
    name: item.CompanyName.trim(),
    market: 'tpex'
  }
}
```

### Stock Dictionary Entry (Output)

```typescript
// 輸出至 stock-list.ts 的格式
export interface StockDictionaryEntry {
  symbol: string
  name: string
  aliases?: string[]
}
```

---

## 4. 特殊別名對照表格式

### File: scripts/stock-aliases.json

```typescript
// Schema
import { z } from 'zod'

export const StockAliasesSchema = z.record(
  z.string(),  // symbol
  z.array(z.string())  // aliases
)

export type StockAliases = z.infer<typeof StockAliasesSchema>
```

### Example

```json
{
  "2330": ["TSMC", "台積"],
  "2317": ["Foxconn", "富士康"],
  "2454": ["MediaTek", "MTK"],
  "2303": ["UMC", "聯電"],
  "2308": ["Delta", "台達"],
  "2357": ["ASUS", "華碩"],
  "2382": ["Quanta", "廣達"],
  "4938": ["PEGATRON", "和碩"]
}
```
