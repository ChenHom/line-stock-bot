# Data Model: 台股列表自動更新機制

**Feature**: 002-stock-list-update  
**Date**: 2025-12-02  
**Status**: Complete

## 實體定義

### 1. Stock（股票）

代表一支上市或上櫃股票的基本資訊。

| 欄位 | 型別 | 說明 | 驗證規則 |
|------|------|------|----------|
| symbol | string | 股票代號 | 4-6 位數字或英數混合 |
| name | string | 公司簡稱 | 非空字串 |
| market | 'twse' \| 'tpex' | 所屬市場 | 必須為 twse 或 tpex |
| aliases | string[] | 別名列表 | 可選，預設空陣列 |

**狀態轉換**: 無（靜態資料）

**關聯**: 無外部關聯

---

### 2. StockDictionaryEntry（股票字典項目）

用於 Fuse.js fuzzy matching 的資料結構（輸出格式）。

| 欄位 | 型別 | 說明 | 驗證規則 |
|------|------|------|----------|
| symbol | string | 股票代號 | 4-6 位數字或英數混合 |
| name | string | 公司簡稱 | 非空字串 |
| aliases | string[] | 別名列表（含自動產生與手動定義） | 可選 |

**來源**: 由 Stock 實體轉換而來

---

### 3. SpecialAliasMapping（特殊別名對照）

人工維護的熱門股票別名對照表。

| 欄位 | 型別 | 說明 | 驗證規則 |
|------|------|------|----------|
| [symbol] | string[] | 股票代號對應的別名陣列 | symbol 必須存在於股票列表 |

**儲存格式**: JSON 檔案 (`scripts/stock-aliases.json`)

**範例**:
```json
{
  "2330": ["TSMC", "台積"],
  "2317": ["Foxconn", "富士康"],
  "2454": ["MediaTek", "MTK"]
}
```

---

## 外部資料來源結構

### TWSE API Response

```typescript
interface TwseStockItem {
  Code: string       // 股票代號
  Name: string       // 公司簡稱
  // 其他欄位（忽略）
  TradeVolume?: string
  TradeValue?: string
  OpeningPrice?: string
  HighestPrice?: string
  LowestPrice?: string
  ClosingPrice?: string
  Change?: string
  Transaction?: string
}
```

### TPEx API Response

```typescript
interface TpexStockItem {
  SecuritiesCompanyCode: string  // 股票代號
  CompanyName: string            // 公司名稱
  // 其他欄位（忽略）
  ClosingPrice?: string
  Change?: string
  OpeningPrice?: string
  HighestPrice?: string
  LowestPrice?: string
  TradingVolume?: string
  TradingValue?: string
  TransactionCount?: string
}
```

---

## 資料轉換流程

```
┌─────────────────┐     ┌─────────────────┐
│   TWSE API      │     │   TPEx API      │
│  (上市股票)      │     │  (上櫃股票)      │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
    ┌────────────────────────────────────┐
    │         正規化 (Normalize)          │
    │  - 統一欄位名稱 (symbol, name)      │
    │  - 標記市場來源 (twse/tpex)         │
    └────────────────┬───────────────────┘
                     │
                     ▼
    ┌────────────────────────────────────┐
    │         合併與去重 (Merge)          │
    │  - 以 symbol 為 key 去除重複        │
    └────────────────┬───────────────────┘
                     │
                     ▼
    ┌────────────────────────────────────┐
    │       別名產生 (Generate Aliases)   │
    │  - 自動規則產生                     │
    │  - 合併特殊別名對照表               │
    └────────────────┬───────────────────┘
                     │
                     ▼
    ┌────────────────────────────────────┐
    │       驗證 (Validate)              │
    │  - 檢查數量 >= 500                 │
    │  - 檢查必要欄位                    │
    └────────────────┬───────────────────┘
                     │
                     ▼
    ┌────────────────────────────────────┐
    │       輸出 (Output)                │
    │  - 產生 lib/stock-list.ts          │
    └────────────────────────────────────┘
```

---

## 輸出檔案結構

### lib/stock-list.ts

```typescript
/**
 * 台股股票列表
 * 
 * ⚠️ 此檔案由 scripts/update-stocks.ts 自動產生，請勿手動編輯
 * 
 * 上次更新: 2025-12-02T01:00:00Z
 * 上市股票: 1,000 支
 * 上櫃股票: 800 支
 * 總計: 1,800 支
 */

import type { StockDictionaryEntry } from './types'

export const STOCK_LIST: StockDictionaryEntry[] = [
  { symbol: '2330', name: '台積電', aliases: ['TSMC', '台積'] },
  { symbol: '2317', name: '鴻海', aliases: ['Foxconn', '富士康'] },
  // ... 其他股票
]

export const STOCK_COUNT = {
  twse: 1000,
  tpex: 800,
  total: 1800
}
```

---

## 驗證規則

### 必要驗證

| 規則 | 描述 | 失敗處理 |
|------|------|----------|
| 最小數量 | 股票總數 >= 500 | 中止更新，回傳錯誤 |
| 代號格式 | symbol 符合 /^[0-9A-Za-z]{4,6}$/ | 記錄警告，跳過該筆 |
| 名稱非空 | name 不為空字串 | 記錄警告，跳過該筆 |

### 資料清洗

| 規則 | 描述 |
|------|------|
| 去除空白 | symbol 和 name 前後空白移除 |
| 去除重複 | 以 symbol 為 key，保留第一筆 |
| 排序 | 依 symbol 升冪排序 |
