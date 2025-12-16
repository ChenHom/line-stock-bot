# Data Model: Gugo 研究引擎整合

**Feature**: 003-gugo-integration  
**Date**: 2025-12-04  
**Status**: Complete

## 概述

本文件定義 line-stock-bot 與 gugo 研究引擎整合所需的資料模型。所有型別定義將新增至 `lib/schemas.ts`，並透過 `lib/types.ts` 匯出。

## 實體定義

### 1. FactorScore（因子評分）

**用途**: 單一股票的多因子量化評分結果

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `symbol` | string | ✅ | 股票代碼（純數字，如 `2330`） |
| `name` | string | ❌ | 股票名稱 |
| `totalScore` | number | ✅ | 總分（0-100） |
| `factors` | FactorBreakdown | ✅ | 各因子細項分數 |
| `keyMetrics` | KeyMetrics | ❌ | 關鍵財務指標 |
| `updatedAt` | string (ISO 8601) | ✅ | 資料更新時間 |

**FactorBreakdown（因子細項）**

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `valuation` | number | ✅ | 估值分數（0-100） |
| `growth` | number | ✅ | 成長分數（0-100） |
| `quality` | number | ✅ | 品質分數（0-100） |
| `momentum` | number | ✅ | 動能分數（0-100） |
| `fundFlow` | number | ✅ | 資金流分數（0-100） |

**KeyMetrics（關鍵指標）**

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `roe` | number | ❌ | 股東權益報酬率（%） |
| `epsGrowth` | number | ❌ | EPS 成長率（%） |
| `revenueGrowth` | number | ❌ | 營收成長率（%） |
| `returnHalfYear` | number | ❌ | 近半年報酬率（%） |
| `pe` | number | ❌ | 本益比 |
| `pb` | number | ❌ | 股價淨值比 |

---

### 2. RankedStock（排行榜股票）

**用途**: 策略股排行榜中的單一股票項目

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `rank` | number | ✅ | 排名（1 為最高） |
| `symbol` | string | ✅ | 股票代碼 |
| `name` | string | ✅ | 股票名稱 |
| `totalScore` | number | ✅ | 總分（0-100） |
| `tags` | string[] | ❌ | 特色標籤（如 `["成長佳", "品質高"]`） |
| `topFactor` | string | ❌ | 最突出的因子名稱 |

---

### 3. StrategyRanking（策略股排行榜）

**用途**: 完整的策略股排行榜回應

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `strategyName` | string | ✅ | 策略名稱（如 `"default"`, `"growth"`, `"value"`） |
| `stocks` | RankedStock[] | ✅ | 排行榜股票清單 |
| `generatedAt` | string (ISO 8601) | ✅ | 排行榜產生時間 |
| `totalCount` | number | ❌ | 符合條件的總股票數 |

---

### 4. BacktestResult（回測結果）

**用途**: 單一標的或策略的歷史回測績效（P2 功能）

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `symbol` | string | ✅ | 回測標的代碼 |
| `strategyName` | string | ❌ | 策略名稱（若為策略回測） |
| `period` | BacktestPeriod | ✅ | 回測期間 |
| `metrics` | BacktestMetrics | ✅ | 績效指標 |
| `generatedAt` | string (ISO 8601) | ✅ | 回測計算時間 |

**BacktestPeriod（回測期間）**

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `from` | string (YYYY-MM-DD) | ✅ | 起始日期 |
| `to` | string (YYYY-MM-DD) | ✅ | 結束日期 |

**BacktestMetrics（績效指標）**

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `annualizedReturn` | number | ✅ | 年化報酬率（%） |
| `maxDrawdown` | number | ✅ | 最大回撤（%，負數） |
| `sharpeRatio` | number | ❌ | Sharpe 比率 |
| `winRate` | number | ❌ | 勝率（%） |
| `totalReturn` | number | ❌ | 累積報酬率（%） |

---

### 5. GugoApiError（API 錯誤）

**用途**: gugo API 回傳的錯誤格式

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `errorCode` | string | ✅ | 錯誤代碼（如 `"SYMBOL_NOT_FOUND"`, `"RATE_LIMIT"`, `"INTERNAL_ERROR"`） |
| `message` | string | ✅ | 人類可讀的錯誤訊息 |
| `details` | Record<string, any> | ❌ | 額外錯誤資訊 |

**已知錯誤代碼**:

| 代碼 | 說明 | line-stock-bot 處理方式 |
|------|------|-------------------------|
| `SYMBOL_NOT_FOUND` | 股票代碼不存在 | 回覆「查不到這檔股票」 |
| `NO_DATA` | 股票存在但無研究資料 | 回覆「暫無此股票的研究資料」 |
| `RATE_LIMIT` | 請求過於頻繁 | 回覆「請求過於頻繁，請稍後再試」 |
| `INTERNAL_ERROR` | 伺服器內部錯誤 | 回覆「暫時無法取得詳解」 |

---

## Zod Schema 定義

以下為新增至 `lib/schemas.ts` 的 Zod schema：

```typescript
// lib/schemas.ts

import { z } from 'zod'

// 因子細項
export const FactorBreakdownSchema = z.object({
  valuation: z.number().min(0).max(100),
  growth: z.number().min(0).max(100),
  quality: z.number().min(0).max(100),
  momentum: z.number().min(0).max(100),
  fundFlow: z.number().min(0).max(100)
})

// 關鍵指標
export const KeyMetricsSchema = z.object({
  roe: z.number().optional(),
  epsGrowth: z.number().optional(),
  revenueGrowth: z.number().optional(),
  returnHalfYear: z.number().optional(),
  pe: z.number().optional(),
  pb: z.number().optional()
})

// 因子評分
export const FactorScoreSchema = z.object({
  symbol: z.string().regex(/^\d{4,6}$/),
  name: z.string().optional(),
  totalScore: z.number().min(0).max(100),
  factors: FactorBreakdownSchema,
  keyMetrics: KeyMetricsSchema.optional(),
  updatedAt: z.string().datetime()
})

// 排行榜股票
export const RankedStockSchema = z.object({
  rank: z.number().int().positive(),
  symbol: z.string().regex(/^\d{4,6}$/),
  name: z.string(),
  totalScore: z.number().min(0).max(100),
  tags: z.array(z.string()).optional(),
  topFactor: z.string().optional()
})

// 策略排行榜
export const StrategyRankingSchema = z.object({
  strategyName: z.string(),
  stocks: z.array(RankedStockSchema),
  generatedAt: z.string().datetime(),
  totalCount: z.number().int().nonnegative().optional()
})

// 回測期間
export const BacktestPeriodSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
})

// 回測指標
export const BacktestMetricsSchema = z.object({
  annualizedReturn: z.number(),
  maxDrawdown: z.number().max(0),
  sharpeRatio: z.number().optional(),
  winRate: z.number().min(0).max(100).optional(),
  totalReturn: z.number().optional()
})

// 回測結果
export const BacktestResultSchema = z.object({
  symbol: z.string(),
  strategyName: z.string().optional(),
  period: BacktestPeriodSchema,
  metrics: BacktestMetricsSchema,
  generatedAt: z.string().datetime()
})

// Gugo API 錯誤
export const GugoApiErrorSchema = z.object({
  errorCode: z.string(),
  message: z.string(),
  details: z.record(z.any()).optional()
})

// Type exports
export type FactorBreakdown = z.infer<typeof FactorBreakdownSchema>
export type KeyMetrics = z.infer<typeof KeyMetricsSchema>
export type FactorScore = z.infer<typeof FactorScoreSchema>
export type RankedStock = z.infer<typeof RankedStockSchema>
export type StrategyRanking = z.infer<typeof StrategyRankingSchema>
export type BacktestPeriod = z.infer<typeof BacktestPeriodSchema>
export type BacktestMetrics = z.infer<typeof BacktestMetricsSchema>
export type BacktestResult = z.infer<typeof BacktestResultSchema>
export type GugoApiError = z.infer<typeof GugoApiErrorSchema>
```

---

## 狀態轉換

### 因子評分查詢流程

```
[使用者輸入] → [symbol 解析] → [呼叫 gugo API] → [驗證回應] → [轉換 Flex] → [回覆使用者]
     │              │               │              │              │
     │              ↓               ↓              ↓              ↓
     │         fuzzyMatch       FactorScore    Zod parse    createFactorFlex
     │              │               │              │              │
     └──────────────┴───────────────┴──────────────┴──────────────┘
                                    │
                            [錯誤處理分支]
                                    ↓
                    GugoApiError → 友善錯誤訊息
```

### 策略股查詢流程

```
[使用者輸入] → [檢查快取] → [呼叫 gugo API] → [更新快取] → [轉換 Flex] → [回覆使用者]
                   │              │               │              │
                   ↓              ↓               ↓              ↓
              cache hit?   StrategyRanking    Redis set    createRankingCarousel
                   │              │               │              │
                  YES ────────────┴───────────────┴──────────────┘
                   │                              
                   └─────────────→ 直接轉換 Flex
```

---

## 驗證規則

| 欄位 | 驗證規則 |
|------|----------|
| `symbol` | 4-6 位數字 |
| `totalScore` | 0-100 整數或浮點數 |
| `factors.*` | 0-100 整數或浮點數 |
| `updatedAt` / `generatedAt` | ISO 8601 格式 |
| `period.from` / `period.to` | YYYY-MM-DD 格式 |
| `maxDrawdown` | 必須為負數或零 |
| `tags` | 字串陣列，每個標籤非空 |
