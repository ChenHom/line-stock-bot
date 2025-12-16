# Research: Gugo 研究引擎整合

**Feature**: 003-gugo-integration  
**Date**: 2025-12-04  
**Status**: Complete

## 研究任務

### 1. Gugo HTTP API 整合模式

**問題**: line-stock-bot 如何與 gugo HTTP API 通訊？

**Decision**: 建立獨立的 gugo client 模組，採用與現有 Provider 一致的架構模式

**Rationale**:
- 現有 `lib/providers/` 已有成熟的 Provider 模式（quote/news）
- 統一的錯誤處理、timeout、logging 機制可直接複用
- 符合 Constitution 的 Provider Abstraction 原則
- 便於未來擴展（例如新增備援 gugo 服務）

**Alternatives considered**:
- 直接在 webhook.ts 內呼叫 gugo API → 違反模組化原則，難以測試與維護
- 使用通用 HTTP client library → 過度抽象，增加學習成本

---

### 2. 股票代碼格式標準化

**問題**: gugo 接受何種股票代碼格式？line-stock-bot 需要做哪些轉換？

**Decision**: line-stock-bot 負責將使用者輸入轉換為純數字代碼（如 `2330`），gugo 接受純數字格式

**Rationale**:
- line-stock-bot 已有完整的 `lib/symbol.ts` 處理名稱→代碼轉換
- 複用現有的 `fuzzyMatchSymbols()` 函式
- 避免 gugo 端重複實作模糊比對邏輯
- 純數字格式是台股的標準表示法

**Alternatives considered**:
- gugo 接受含 `.TW` 後綴 → 增加不必要的複雜度
- gugo 接受中文名稱 → 需在 gugo 端維護股票名稱對照表，增加維護成本

---

### 3. 錯誤處理與降級策略

**問題**: gugo 服務不可用時，line-stock-bot 如何處理？

**Decision**: 採用三層錯誤處理策略

**Rationale**:
1. **Timeout（2 秒）**: 防止 LINE Webhook 逾時（3 秒限制）
2. **友善錯誤訊息**: 不暴露技術細節，引導使用者嘗試其他功能
3. **隔離性**: gugo 錯誤不影響既有的股價/新聞查詢功能

**實作細節**:
```typescript
// 錯誤類型對應訊息
const errorMessages = {
  timeout: '研究系統回應過慢，請稍後再試或改查基本股價',
  notFound: '查不到這檔股票的研究資料',
  serverError: '暫時無法取得詳解，請稍後再試',
  networkError: '研究系統暫時無法連線'
}
```

**Alternatives considered**:
- 無降級直接拋錯 → 用戶體驗差
- 快取上次成功結果作為 fallback → 資料可能過時，造成誤導

---

### 4. 快取策略

**問題**: 哪些 gugo 資料適合快取？TTL 應如何設定？

**Decision**: 策略股清單快取 5 分鐘；因子詳解不快取

**Rationale**:
- **策略股清單**: 每日更新頻率低，多位使用者可能同時查詢，快取效益高
- **因子詳解**: 使用者期待即時資料，且不同股票的查詢分散，快取命中率低
- **回測結果**: 計算耗時但結果穩定，可考慮較長 TTL（30 分鐘）

**實作細節**:
```typescript
// 快取 key 格式
const cacheKeys = {
  ranking: 'gugo:ranking:default',           // 策略股清單
  backtest: (symbol: string) => `gugo:backtest:${symbol}`  // 回測結果
}
```

**Alternatives considered**:
- 全部不快取 → 不必要的 API 負載
- 因子詳解也快取 → 用戶可能看到過時資料

---

### 5. 環境變數設計

**問題**: 需要哪些新的環境變數來設定 gugo 整合？

**Decision**: 新增三個環境變數

| 變數名稱 | 說明 | 預設值 |
|----------|------|--------|
| `GUGO_API_BASE_URL` | gugo 服務的 Base URL | (必填) |
| `GUGO_API_KEY` | API 認證金鑰（若 gugo 有做驗證） | (選填) |
| `GUGO_TIMEOUT_MS` | API 請求逾時時間（毫秒） | `2000` |

**Rationale**:
- 遵循 Constitution 的安全要求，敏感資訊不寫死在程式碼
- 可在 Vercel 的不同環境（dev/prod）設定不同值
- Timeout 可設定，便於調校效能

---

### 6. Flex Message 設計

**問題**: 因子詳解與策略股清單應如何呈現？

**Decision**: 因子詳解使用單一 Bubble，策略股使用 Carousel

**因子詳解 Flex 設計**:
- 標題：股票名稱與代碼
- 總分：大字體突顯
- 五大因子：橫向進度條或數字列表
- 關鍵指標：ROE、EPS 成長率等 1-2 個數字
- Footer：「查看新聞」、「查看策略股」快捷按鈕

**策略股清單 Flex 設計**:
- Carousel 格式，每檔股票一個 Bubble
- 顯示：代碼、名稱、總分、特色標籤
- Footer：「詳解」按鈕，點擊觸發詳解指令

**Rationale**:
- 符合 Constitution 的 Flex Message UI 原則
- 一眼可見的資訊密度適合手機閱讀
- 按鈕提供流暢的指令串接體驗

---

### 7. 指令解析擴展

**問題**: 如何擴展現有的指令解析邏輯支援新指令？

**Decision**: 在 webhook.ts 的 `parseCommand` 後新增 switch-case 分支

**實作位置**:
```typescript
// webhook.ts 中新增
if (cmd === '詳解' || cmd === 'explain') {
  await handleExplainCommand(ev.replyToken, args)
} else if (cmd === '策略股' || cmd === '高潛力' || cmd === 'strategy') {
  await handleStrategyCommand(ev.replyToken)
} else if (cmd === '回測' || cmd === 'backtest') {
  await handleBacktestCommand(ev.replyToken, args)
}
```

**Rationale**:
- 與現有的 `股價`、`新聞`、`help` 指令處理模式一致
- 簡單的字串比對足以滿足需求
- 便於未來新增更多指令

---

### 8. 監控指標設計

**問題**: 需要記錄哪些 gugo 相關的監控指標？

**Decision**: 使用現有的 `lib/monitoring.ts` 新增 gugo 專屬指標

**指標項目**:
| 指標名稱 | 類型 | 維度 |
|----------|------|------|
| `gugo.request.count` | Counter | command (explain/strategy/backtest) |
| `gugo.request.success` | Counter | command |
| `gugo.request.error` | Counter | command, errorType |
| `gugo.request.latency` | Histogram | command |

**Rationale**:
- 複用現有的 `metrics.recordProviderSuccess/Error` 模式
- 可追蹤各指令的使用頻率與成功率
- 便於偵測 gugo 服務異常

---

## 技術決策摘要

| 決策領域 | 選擇 | 理由 |
|----------|------|------|
| 整合模式 | 獨立 Provider 模組 | 符合現有架構，便於測試 |
| 代碼格式 | 純數字，line-stock-bot 轉換 | 複用現有 symbol 處理邏輯 |
| 錯誤處理 | 三層降級策略 | 保護用戶體驗與服務穩定性 |
| 快取 | 策略股 5 分鐘，詳解不快取 | 平衡即時性與效能 |
| UI 呈現 | Flex Bubble/Carousel | 符合 Constitution 且易於閱讀 |

## 依賴確認

- [x] gugo HTTP API 契約已定義（見 `contracts/gugo-api.md`）
- [x] 現有 symbol 轉換邏輯可直接複用
- [x] Redis 快取機制可直接複用
- [x] Flex Message 樣板設計模式已確立
