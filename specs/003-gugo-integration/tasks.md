# Tasks: Gugo 研究引擎整合

**Input**: Design documents from `/specs/003-gugo-integration/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: 可平行執行（不同檔案、無相依性）
- **[Story]**: 所屬 User Story（US1、US2、US3、US4）
- 所有路徑皆為相對於 `line-stock-bot/` 目錄

---

## Phase 1: Setup（共用基礎設施）

**Purpose**: 專案初始化與 gugo 整合基礎設定

- [ ] T001 新增環境變數文件範例，加入 `GUGO_API_BASE_URL`、`GUGO_API_KEY`、`GUGO_TIMEOUT_MS` 至 `.env.local.example`
- [ ] T002 [P] 建立 `lib/providers/gugo/` 目錄結構
- [ ] T003 [P] 新增 gugo 相關 Zod schemas 至 `lib/schemas.ts`（FactorBreakdown、KeyMetrics、FactorScore、RankedStock、StrategyRanking、GugoApiError）
- [ ] T004 [P] 新增 gugo 相關型別匯出至 `lib/types.ts`

---

## Phase 2: Foundational（阻塞性前置作業）

**Purpose**: 所有 User Story 都依賴的核心基礎設施

**⚠️ 關鍵**: 此階段必須完成後才能開始任何 User Story

- [ ] T005 實作 gugo HTTP client 核心模組 `lib/providers/gugo/client.ts`（URL 組裝、Header 設定、timeout、錯誤處理）
- [ ] T006 實作 GugoApiError 自訂錯誤類別於 `lib/providers/gugo/client.ts`
- [ ] T007 [P] 新增 gugo provider 監控指標至 `lib/monitoring.ts`（gugo.request.count、success、error、latency）
- [ ] T008 [P] 新增 gugo 相關 log 格式至 `lib/logger.ts`（gugoRequest、gugoSuccess、gugoError）

**Checkpoint**: 基礎設施就緒 — 可開始 User Story 實作

---

## Phase 3: User Story 1 - 單一股票因子詳解查詢 (Priority: P1) 🎯 MVP

**Goal**: 使用者輸入「詳解 2330」後取得該股票的多因子評分與關鍵指標

**Independent Test**: 發送「詳解 2330」指令，驗證回傳包含總分、五大因子分數的 Flex Message

### Implementation for User Story 1

- [ ] T009 [US1] 實作因子評分 API 呼叫函式 `lib/providers/gugo/factor.ts`（getFactorScore）
- [ ] T010 [US1] 新增因子詳解 Flex Message 模板 `createFactorScoreFlex()` 至 `lib/flex.ts`
- [ ] T011 [US1] 新增分數顏色輔助函式 `getScoreColor()` 至 `lib/flex.ts`
- [ ] T012 [US1] 實作詳解指令處理函式 `handleExplainCommand()` 於 `api/line/webhook.ts`
- [ ] T013 [US1] 整合股票名稱→代碼轉換（複用 `lib/symbol.ts` 的 fuzzyMatchSymbols）
- [ ] T014 [US1] 新增詳解指令路由判斷至 webhook.ts 主處理流程（`詳解`、`explain`）
- [ ] T015 [US1] 實作詳解指令的錯誤處理與友善訊息回覆

**Checkpoint**: User Story 1 可獨立運作並測試

---

## Phase 4: User Story 2 - 策略股清單查詢 (Priority: P1)

**Goal**: 使用者輸入「策略股」或「高潛力」後取得前 10 名高分股票清單

**Independent Test**: 發送「策略股」指令，驗證回傳包含股票清單的 Carousel Flex Message

### Implementation for User Story 2

- [ ] T016 [US2] 實作排行榜 API 呼叫函式 `lib/providers/gugo/ranking.ts`（getStrategyRanking）
- [ ] T017 [US2] 實作策略股快取邏輯（使用 withCache，TTL: 5 分鐘）於 `lib/providers/gugo/ranking.ts`
- [ ] T018 [US2] 新增策略股清單 Carousel Flex Message 模板 `createStrategyRankingFlex()` 至 `lib/flex.ts`
- [ ] T019 [US2] 新增單一策略股 Bubble 模板 `createRankedStockBubble()` 至 `lib/flex.ts`
- [ ] T020 [US2] 實作策略股指令處理函式 `handleStrategyCommand()` 於 `api/line/webhook.ts`
- [ ] T021 [US2] 新增策略股指令路由判斷至 webhook.ts（`策略股`、`高潛力`、`strategy`）
- [ ] T022 [US2] 實作空清單情境的友善訊息回覆

**Checkpoint**: User Story 2 可獨立運作並測試

---

## Phase 5: User Story 3 - Gugo 服務異常的優雅降級 (Priority: P1)

**Goal**: gugo 服務異常時提供友善錯誤訊息，不影響既有功能

**Independent Test**: 模擬 gugo 逾時或錯誤，驗證 2 秒內回傳友善降級訊息

### Implementation for User Story 3

- [ ] T023 [US3] 實作 timeout 包裝函式 `withTimeout()` 於 `lib/providers/gugo/client.ts`
- [ ] T024 [US3] 定義錯誤代碼對應的使用者訊息常數 `GUGO_ERROR_MESSAGES` 於 `lib/providers/gugo/client.ts`
- [ ] T025 [US3] 實作統一的 gugo 錯誤處理函式 `handleGugoError()` 於 `api/line/webhook.ts`
- [ ] T026 [US3] 確保 gugo 呼叫失敗不影響 webhook handler 的穩定性（try-catch 隔離）
- [ ] T027 [P] [US3] 新增 gugo 錯誤情境的 Flex Message 模板（使用現有 `buildStatusFlex`）

**Checkpoint**: User Story 3 完成，系統具備錯誤容錯能力

---

## Phase 6: User Story 4 - 回測結果查詢 (Priority: P2)

**Goal**: 使用者輸入「回測 0050」後取得該標的的歷史回測績效

**Independent Test**: 發送「回測 0050」指令，驗證回傳包含年化報酬率、最大回撤的 Flex Message

### Implementation for User Story 4

- [ ] T028 [US4] 新增回測相關 Zod schemas 至 `lib/schemas.ts`（BacktestPeriod、BacktestMetrics、BacktestResult）
- [ ] T029 [US4] 實作回測 API 呼叫函式 `lib/providers/gugo/backtest.ts`（getBacktestResult）
- [ ] T030 [US4] 實作回測結果快取邏輯（TTL: 30 分鐘）於 `lib/providers/gugo/backtest.ts`
- [ ] T031 [US4] 新增回測結果 Flex Message 模板 `createBacktestResultFlex()` 至 `lib/flex.ts`
- [ ] T032 [US4] 實作回測指令處理函式 `handleBacktestCommand()` 於 `api/line/webhook.ts`
- [ ] T033 [US4] 新增回測指令路由判斷至 webhook.ts（`回測`、`backtest`）
- [ ] T034 [US4] 實作回測逾時的特殊處理（timeout 可能較長）

**Checkpoint**: User Story 4 完成，所有研究型指令可獨立運作

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 跨 User Story 的改進與優化

- [ ] T035 [P] 更新 help 指令說明，新增詳解、策略股、回測指令於 `lib/flex.ts` 的 `HELP_COMMANDS`
- [ ] T036 [P] 更新 `buildHelpQuickReplies()` 新增研究型指令快捷按鈕
- [ ] T037 [P] 新增 gugo provider 單元測試 `tests/unit/providers/gugo.test.ts`
- [ ] T038 [P] 新增 gugo 整合測試（含 mock）`tests/integration/gugo.test.ts`
- [ ] T039 執行 quickstart.md 驗證流程，確認所有指令正常運作
- [ ] T040 更新 README.md 說明新指令用法

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 無相依性 — 可立即開始
- **Foundational (Phase 2)**: 依賴 Setup 完成 — 阻塞所有 User Stories
- **User Stories (Phase 3-6)**: 依賴 Foundational 完成
  - US1 與 US2 可平行進行（皆為 P1）
  - US3 應與 US1、US2 同步開發（錯誤處理）
  - US4 可在 US1-3 穩定後再進行（P2）
- **Polish (Phase 7)**: 依賴所有 User Stories 完成

### User Story Dependencies

- **User Story 1 (P1)**: 依賴 Phase 2 完成 — 無其他 Story 相依
- **User Story 2 (P1)**: 依賴 Phase 2 完成 — 無其他 Story 相依
- **User Story 3 (P1)**: 與 US1、US2 整合 — 提供錯誤處理機制
- **User Story 4 (P2)**: 依賴 Phase 2 完成 — 可在 US1-3 之後進行

### Within Each User Story

- Provider 函式 → Flex 模板 → Webhook 處理 → 路由整合
- 完成單一 Story 後再進行下一個

### Parallel Opportunities

- T002、T003、T004 可平行執行（Setup 階段）
- T007、T008 可平行執行（Foundational 階段）
- US1 與 US2 可由不同開發者平行進行
- Phase 7 的 T035-T038 可平行執行

---

## Parallel Example: Setup Phase

```bash
# 可同時啟動以下任務：
Task T002: "建立 lib/providers/gugo/ 目錄結構"
Task T003: "新增 gugo 相關 Zod schemas 至 lib/schemas.ts"
Task T004: "新增 gugo 相關型別匯出至 lib/types.ts"
```

---

## Parallel Example: User Story 1 + 2

```bash
# Developer A: User Story 1
Task T009: "實作因子評分 API 呼叫函式"
Task T010: "新增因子詳解 Flex Message 模板"
...

# Developer B: User Story 2 (可同時進行)
Task T016: "實作排行榜 API 呼叫函式"
Task T017: "實作策略股快取邏輯"
...
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 + 3)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational（關鍵 — 阻塞所有 Stories）
3. 完成 Phase 3: User Story 1（詳解指令）
4. 完成 Phase 4: User Story 2（策略股指令）
5. 完成 Phase 5: User Story 3（錯誤處理）
6. **停止並驗證**: 測試 MVP 功能
7. 部署 MVP

### Incremental Delivery

1. Setup + Foundational → 基礎就緒
2. 新增 US1（詳解）→ 獨立測試 → 部署
3. 新增 US2（策略股）→ 獨立測試 → 部署
4. 新增 US3（錯誤處理）→ 整合測試 → 部署
5. 新增 US4（回測）→ 獨立測試 → 部署（第二階段）

---

## Summary

| Phase | 任務數 | 可平行 | 說明 |
|-------|--------|--------|------|
| Setup | 4 | 3 | 環境設定與目錄結構 |
| Foundational | 4 | 2 | gugo client 核心模組 |
| US1 詳解 | 7 | 0 | 因子評分查詢 |
| US2 策略股 | 7 | 0 | 排行榜查詢 |
| US3 錯誤處理 | 5 | 1 | 優雅降級機制 |
| US4 回測 | 7 | 0 | 回測結果查詢（P2） |
| Polish | 6 | 4 | 文件更新與測試 |
| **總計** | **40** | **10** | |

---

## Notes

- [P] 任務 = 不同檔案、無相依性
- [US*] 標籤對應 spec.md 的 User Story
- 每個 User Story 可獨立完成與測試
- 在每個 Checkpoint 停止驗證 Story 獨立運作
- 避免：模糊任務、同檔案衝突、破壞獨立性的跨 Story 相依
