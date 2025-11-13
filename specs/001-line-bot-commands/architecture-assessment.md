# 架構評估與調整建議

**評估日期**: 2025-11-13  
**規格文件**: [spec.md](./spec.md)  
**目標**: 評估現有架構與規格的差距，並提出調整建議

## 📋 現有架構概覽

### 目錄結構

```
line-stock-bot/
├── api/
│   ├── ping.ts
│   └── line/
│       └── webhook.ts          # LINE Webhook 主要處理邏輯
├── lib/
│   ├── types.ts                # Quote, NewsItem 型別定義
│   ├── symbol.ts               # 股票代號轉換工具
│   ├── flex.ts                 # Flex Message 模板
│   └── providers/
│       ├── index.ts            # Fallback 邏輯
│       ├── quote/
│       │   ├── twse.ts         # TWSE 股價 Provider
│       │   └── yahooRapid.ts   # Yahoo Finance Provider
│       └── news/
│           ├── googleRss.ts    # Google News RSS Provider
│           └── yahooRss.ts     # Yahoo RSS Provider
└── specs/
    └── 001-line-bot-commands/
        ├── spec.md
        └── checklists/
            └── requirements.md
```

### 現有實作狀況

#### ✅ 已完成的功能

1. **Provider 抽象與 Fallback** ✅
   - `lib/providers/index.ts` 已實作 `getQuoteWithFallback()` 和 `getIndustryNews()`
  - 自動 fallback 機制：Yahoo → TWSE (股價)、Google RSS → Yahoo RSS (新聞)
  - 決策: Provider 順序由環境變數 `QUOTE_PRIMARY_PROVIDER` 控制，預設為 `twse` (TWSE)；若設定為 `yahoo`，則以 Yahoo 為主要來源。
   - 符合 Constitution Principle II

2. **Flex Message UI** ✅
   - `lib/flex.ts` 已實作 `buildPriceFlexFromData()` 和 `buildNewsFlexFromItems()`
   - 提供卡片化視覺呈現
   - 符合 Constitution Principle V

3. **TypeScript 型別定義** ✅
   - `lib/types.ts` 定義 `Quote` 和 `NewsItem` 型別
   - 部分符合 Constitution Principle IV（需加強 Zod validation）

4. **核心指令處理** ✅
   - Webhook 已處理 `help`、`股價`、`新聞` 指令
   - 指令解析邏輯 `parseCommand()` 已實作
   - 符合 Spec FR-001, FR-002, FR-003

5. **LINE Webhook 簽章驗證** ⚠️ 部分實作
   - 已實作 `verifyLineSignature()` 函式
   - 但目前被 `DEBUG` 環境變數略過（需修正）
   - 部分符合 Spec FR-009

## ❌ 缺少的關鍵功能

### 1. **快取層 (Caching Strategy)** - 優先度：🔴 極高

**現況**: 
- 所有 Provider 都使用 `{ cache: 'no-store' }`，完全沒有快取
- 不符合 Constitution Principle III
- 不符合 Spec FR-007, SC-003

**影響**:
- 無法達成 80% 快取命中率目標 (SC-003)
- 外部 API 呼叫成本高
- 無法滿足「第二次查詢回應時間 < 1 秒」的需求

**必須調整**:
1. 整合 **Upstash Redis** 作為快取層
2. 實作快取 wrapper 函式，包裝所有 Provider 呼叫
3. 設定 TTL：
   - 股價查詢：45 秒
   - 新聞查詢：15 分鐘 (900 秒)
4. 快取 key 策略：
   - 股價：`quote:{symbol}:{timestamp_bucket}`
   - 新聞：`news:{keyword}:{timestamp_bucket}`
5. 降級處理：快取失敗時直接呼叫 API

**建議新增檔案**:
```
lib/
├── cache.ts              # Redis 快取邏輯與降級處理
└── providers/
    └── withCache.ts      # Provider 快取 wrapper
```

### 2. **Runtime Validation (Zod Schema)** - 優先度：🟡 中

**現況**:
- 型別定義存在於 `lib/types.ts`
- 但沒有 runtime validation
- 不完全符合 Constitution Principle IV

**影響**:
- 外部 API 回應異常時無法及早發現
- 可能導致 Flex Message 渲染錯誤

**必須調整**:
1. 為 `Quote` 和 `NewsItem` 建立 Zod schema
2. 在每個 Provider 的回應解析處加入 `.parse()` 驗證
3. 驗證失敗時記錄錯誤並拋出，觸發 fallback

**建議新增檔案**:
```
lib/
└── schemas.ts            # Zod schemas for Quote, NewsItem
```

### 3. **錯誤記錄與監控** - 優先度：🟡 中

**現況**:
- 有基本的 `console.error()` 記錄
- 但缺乏結構化記錄與監控指標
- 部分符合 Spec FR-010

**影響**:
- 無法追蹤 Provider fallback 頻率
- 無法監控快取命中率
- 除錯困難

**必須調整**:
1. 結構化錯誤記錄（JSON 格式）
2. 記錄關鍵事件：
   - Provider fallback（含來源與原因）
   - 快取 hit/miss
   - API 呼叫延遲
3. 考慮整合 Vercel Analytics 或其他監控工具

**建議新增檔案**:
```
lib/
└── logger.ts             # 結構化日誌工具
```

### 4. **Webhook 簽章驗證邏輯錯誤** - 優先度：🔴 極高

**現況**:
```typescript
const skip = process.env.DEBUG === 'True'
if (skip) {
  // 驗證簽章
}
```

**問題**: 邏輯顛倒！應該是「當 DEBUG 模式時才 skip 驗證」，而非「當 DEBUG 時才驗證」

**必須調整**:
```typescript
const skip = process.env.DEBUG === 'true'
if (!skip) {
  // 驗證簽章
}
```

### 5. **指令別名支援不完整** - 優先度：🟢 低

**現況**:
- `help` 指令有別名：`/help`、`？`
- 但 Spec 要求「幫助」別名（User Story 3）

**必須調整**:
```typescript
if (cmd === 'help' || cmd === '/help' || cmd === '？' || cmd === '幫助') {
  // ...
}
```

### 6. **股票名稱查詢功能** - 優先度：🟡 中

**現況**:
- 僅支援股票代號查詢（如「2330」）
- Spec User Story 1 要求支援「股價 台積電」（使用股票名稱）

**影響**:
- 不符合 Spec Acceptance Scenario 1.2

**必須調整**:
1. 建立股票名稱→代號的映射表
2. 在 `lib/symbol.ts` 新增 `resolveSymbol(input: string): string` 函式
3. 在 webhook 處理股價指令前呼叫此函式

**建議實作**:
```typescript
// lib/symbol.ts
const NAME_TO_SYMBOL: Record<string, string> = {
  '台積電': '2330',
  '鴻海': '2317',
  // ... 更多映射
}

export function resolveSymbol(input: string): string {
  const trimmed = input.trim()
  // 如果是 4 位數字，直接返回
  if (/^\d{4}$/.test(trimmed)) return trimmed
  // 否則查找映射表
  return NAME_TO_SYMBOL[trimmed] || trimmed
}
```

## 📊 符合度評估

### Constitution Principles 符合度

| Principle | 狀態 | 說明 |
|-----------|------|------|
| I. Serverless-First | ✅ 符合 | Vercel Functions, 無狀態設計 |
| II. Provider Abstraction & Fallback | ✅ 符合 | 已實作雙 Provider 與自動 fallback |
| III. Caching Strategy | ❌ 不符合 | **缺少 Redis 快取層** |
| IV. TypeScript Type Safety | ⚠️ 部分符合 | 有型別定義，但缺 Zod validation |
| V. Flex Message UI | ✅ 符合 | 已實作卡片化 UI |

### Functional Requirements 符合度

| FR ID | 需求 | 狀態 | 缺口 |
|-------|------|------|------|
| FR-001 | 股價查詢指令 | ⚠️ 部分 | 缺股票名稱查詢 |
| FR-002 | 新聞查詢指令 | ✅ 符合 | - |
| FR-003 | help 指令 | ⚠️ 部分 | 缺「幫助」別名 |
| FR-004 | 3 秒內回應 | ✅ 符合 | 取決於 API 效能 |
| FR-005 | 股價雙 Provider | ✅ 符合 | - |
| FR-006 | 新聞雙 Provider | ✅ 符合 | - |
| FR-007 | 快取策略 | ❌ 不符合 | **缺 Redis 快取** |
| FR-008 | Flex Message | ✅ 符合 | - |
| FR-009 | Webhook 驗證 | ⚠️ 部分 | 驗證邏輯錯誤 |
| FR-010 | 錯誤記錄 | ⚠️ 部分 | 缺結構化記錄 |
| FR-011 | 無效指令提示 | ✅ 符合 | - |
| FR-012 | 快取降級 | ❌ 不符合 | **缺快取實作** |

### Success Criteria 達成風險

| SC ID | 指標 | 風險 | 原因 |
|-------|------|------|------|
| SC-001 | 95% 股價查詢 < 3 秒 | 🟢 低 | 取決於外部 API |
| SC-002 | 95% 新聞查詢 < 3 秒 | 🟢 低 | 取決於外部 API |
| SC-003 | 快取命中率 > 80% | 🔴 高 | **無快取實作** |
| SC-004 | Fallback < 1 秒 | 🟢 低 | 已實作 fallback |
| SC-005 | 100% 友善錯誤提示 | ✅ 達成 | 已實作 |
| SC-006 | 支援 100 並發使用者 | 🟢 低 | Vercel 自動擴展 |
| SC-007 | 記錄 fallback 事件 | 🟡 中 | 缺結構化記錄 |
| SC-008 | 1 分鐘理解指令 | ✅ 達成 | Help 訊息清晰 |

## 🎯 建議調整優先順序

### Phase 1: 關鍵缺口修補（必須完成）

1. **修正 Webhook 簽章驗證邏輯** 🔴
   - 檔案：`api/line/webhook.ts`
   - 時間：5 分鐘
   - 影響：安全性

2. **整合 Upstash Redis 快取** 🔴
   - 新增檔案：`lib/cache.ts`, `lib/providers/withCache.ts`
   - 修改檔案：`lib/providers/index.ts`
   - 時間：2-3 小時
   - 影響：SC-003, FR-007, FR-012, Principle III

3. **新增 Zod Schema Validation** 🟡
   - 新增檔案：`lib/schemas.ts`
   - 修改檔案：所有 Provider 檔案
   - 時間：1-2 小時
   - 影響：Principle IV, 資料可靠性

### Phase 2: 功能完善（建議完成）

4. **股票名稱查詢支援** 🟡
   - 修改檔案：`lib/symbol.ts`, `api/line/webhook.ts`
   - 時間：1 小時
   - 影響：User Story 1 Acceptance 1.2

5. **結構化錯誤記錄** 🟡
   - 新增檔案：`lib/logger.ts`
   - 修改檔案：所有 Provider 與 webhook
   - 時間：1 小時
   - 影響：FR-010, SC-007, 可維護性

6. **指令別名補完** 🟢
   - 修改檔案：`api/line/webhook.ts`
   - 時間：5 分鐘
   - 影響：User Story 3 Acceptance 3.2

## 📦 建議新增的 Dependencies

```json
{
  "dependencies": {
    "@upstash/redis": "^1.34.3",     // Redis 快取
    "zod": "^4.1.12"                  // 已存在，需使用
  }
}
```

## 🔧 實作建議：快取層架構

### 快取 Key 設計

```typescript
// lib/cache.ts
function getCacheKey(type: 'quote' | 'news', query: string): string {
  const now = Date.now()
  const ttl = type === 'quote' ? 45000 : 900000 // 45s or 15min
  const bucket = Math.floor(now / ttl)
  return `${type}:${query}:${bucket}`
}
```

### Provider Wrapper 範例

```typescript
// lib/providers/withCache.ts
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function withCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  try {
    const cached = await redis.get<T>(key)
    if (cached) return cached
  } catch (e) {
    console.error('Cache read failed, fallback to API:', e)
  }

  const data = await fetcher()
  
  try {
    await redis.setex(key, ttl, data)
  } catch (e) {
    console.error('Cache write failed:', e)
  }

  return data
}
```

## ✅ 調整檢查清單

完成以下調整後，專案將完全符合規格與憲章要求：

### 安全性
- [ ] 修正 Webhook 簽章驗證邏輯 (`api/line/webhook.ts`)
- [ ] 確保 `LINE_CHANNEL_SECRET` 環境變數已設定

### 快取層
- [ ] 安裝 `@upstash/redis` 依賴
- [ ] 建立 `lib/cache.ts` 工具函式
- [ ] 建立 `lib/providers/withCache.ts` wrapper
- [ ] 更新 `lib/providers/index.ts` 使用快取 wrapper
- [ ] 設定 Upstash Redis 環境變數
- [ ] 測試快取命中與降級機制

### 型別安全
- [ ] 建立 `lib/schemas.ts` 定義 Zod schemas
- [ ] 更新所有 Provider 加入 `.parse()` 驗證
- [ ] 測試異常資料的錯誤處理

### 功能完善
- [ ] 擴充 `lib/symbol.ts` 支援股票名稱查詢
- [ ] 更新 webhook 股價指令處理邏輯
- [ ] 新增「幫助」指令別名
- [ ] 建立 `lib/logger.ts` 結構化日誌工具
- [ ] 更新所有錯誤記錄點使用新 logger

### 測試驗證
- [ ] 測試股價查詢（代號 + 名稱）
- [ ] 測試新聞查詢
- [ ] 測試 help 指令（含別名）
- [ ] 測試快取機制（重複查詢）
- [ ] 測試 Provider fallback
- [ ] 測試無效指令處理
- [ ] 驗證 Webhook 簽章機制
- [ ] 壓力測試（模擬並發請求）

## 📝 總結

**目前完成度**: ~60%

**主要缺口**:
1. 🔴 快取層完全缺失（影響最大）
2. 🔴 Webhook 驗證邏輯錯誤（安全問題）
3. 🟡 Runtime validation 不完整
4. 🟡 股票名稱查詢功能缺失

**建議執行順序**:
1. 立即修正 Webhook 驗證邏輯（5 分鐘）
2. 整合 Redis 快取層（2-3 小時）- **最關鍵**
3. 新增 Zod validation（1-2 小時）
4. 完善其他功能（2-3 小時）

**預估總工時**: 6-9 小時可完成所有調整

完成這些調整後，專案將：
- ✅ 100% 符合 Constitution 五大原則
- ✅ 100% 符合 Spec 功能需求
- ✅ 達成所有 Success Criteria
- ✅ 可直接進入 `/speckit.plan` 與 `/speckit.tasks` 階段

## 🔗 Tasks & Implementation Plan

Implementation tasks have been created and organized under `/specs/001-line-bot-commands/tasks.md`.

Follow the Phase order described in the tasks file. The minimal safe implementation order (first iteration) is:

1. T001: Fix webhook signature verification (security)
2. T003: Create cache wrapper (`lib/cache.ts` + `withCache`) and configure Upstash env variables
3. T004: Create Zod validation schemas and integrate into providers
4. T005: Update providers to use `withCache` wrapper
5. T006: Add structured logging (`lib/logger.ts`) and error events
6. T007–T009: Implement UX improvements (symbol resolution, aliases, Flex messages)
7. T020: Instrument telemetry & SLO checks for webhook and provider calls

Each task listed in the tasks file includes explicit acceptance criteria and test cases. Developers should:

- Create a short PR per task with one primary change (and all necessary tests) to make each change small and reviewable.
- Reference the task ID in PR title and commit message, e.g., `chore(T003): add Upstash cache wrapper`.
- Ensure `Constitution Check` gate passes before merging (see `.specify/templates/plan-template.md` "Constitution Check").

## ✅ 完成準則

Mark the implementation as complete when:

- All tasks T001–T006 are completed and merged
- Unit and integration tests are passing in CI
- Quick load-test passes (basic 100 concurrent users)
- `spec.md` and `architecture-assessment.md` updated to reflect any deviations or follow-up tasks

