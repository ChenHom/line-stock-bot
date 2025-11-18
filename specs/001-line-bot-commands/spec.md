# Feature Specification: LINE 聊天機器人指令系統

**Feature Branch**: `001-line-bot-commands`  
**Created**: 2025-11-13  
**Status**: Draft  
**Input**: User description: "LINE 聊天機器人指令系統：實作 help、股價查詢、新聞查詢等核心指令，包含自動 fallback、快取與模組化 Provider 設計"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 查詢台股即時行情 (Priority: P1)

使用者在 LINE 對話中輸入「股價 2330」或「股價 台積電」，聊天機器人立即回應該股票的即時行情資訊，包含現價、漲跌幅、成交量等關鍵數據,並以視覺化卡片呈現。

**Why this priority**: 股價查詢是核心功能，提供即時投資決策所需的關鍵資訊，是使用者使用聊天機器人的主要目的。

**Independent Test**: 可透過發送「股價 2330」訊息至 LINE Bot，驗證是否在 3 秒內收到包含台積電股價的 Flex Message 卡片回應，即可完整測試此功能。

**Acceptance Scenarios**:

1. **Given** 使用者已加入 LINE Bot 為好友，**When** 使用者發送「股價 2330」，**Then** 系統在 3 秒內回應台積電的即時股價卡片，包含股票名稱、代號、現價、漲跌幅、成交量
2. **Given** 使用者已加入 LINE Bot 為好友，**When** 使用者發送「股價 台積電」(使用股票名稱)，**Then** 系統使用模糊比對識別股票，若信心分數 >80% 則回應最多前 2 筆符合的即時行情卡片
3. **Given** 主要股價資料來源 (TWSE API) 無法回應，**When** 使用者發送「股價 2330」，**Then** 系統自動切換至備援來源 (Yahoo Finance) 並在 3 秒內回應行情資料
4. **Given** 使用者在 45 秒內重複查詢同一股票，**When** 使用者發送「股價 2330」兩次，**Then** 第二次查詢應從快取讀取，回應時間小於 1 秒

---

### User Story 2 - 查詢產業新聞 (Priority: P2)

使用者在 LINE 對話中輸入「新聞 台積電」或「新聞 半導體」，聊天機器人回應相關產業或公司的最新新聞標題與連結，以卡片列表形式呈現，方便使用者快速掌握市場動態。

**Why this priority**: 新聞查詢提供投資決策的背景資訊與市場脈絡，是股價查詢的重要補充功能，幫助使用者理解價格波動原因。

**Independent Test**: 可透過發送「新聞 台積電」訊息至 LINE Bot，驗證是否收到包含 3-5 則相關新聞的 Flex Message 卡片列表，每則新聞包含標題、來源、時間與連結，即可完整測試此功能。

**Acceptance Scenarios**:

1. **Given** 使用者已加入 LINE Bot 為好友，**When** 使用者發送「新聞 台積電」，**Then** 系統回應 3-5 則與台積電相關的最新新聞卡片，包含標題、來源、發布時間與連結
2. **Given** 使用者已加入 LINE Bot 為好友，**When** 使用者發送「新聞 半導體」(產業關鍵字)，**Then** 系統回應半導體產業的相關新聞
3. **Given** 主要新聞來源 (Google News RSS) 無法回應，**When** 使用者發送「新聞 台積電」，**Then** 系統自動切換至備援來源 (Yahoo RSS) 並回應新聞列表
4. **Given** 使用者在 15 分鐘內重複查詢相同關鍵字，**When** 使用者發送「新聞 台積電」兩次，**Then** 第二次查詢應從快取讀取，回應時間顯著縮短

---

### User Story 3 - 查詢使用說明 (Priority: P3)

使用者在 LINE 對話中輸入「help」或「幫助」，聊天機器人回應所有可用指令的說明與範例，幫助新使用者快速上手。

**Why this priority**: 使用說明是新使用者的入口，但相對於核心功能 (股價、新聞查詢) 優先度較低，因為指令設計簡單直觀，大部分使用者可透過嘗試學習。

**Independent Test**: 可透過發送「help」訊息至 LINE Bot，驗證是否收到包含所有可用指令 (股價、新聞、help) 與使用範例的說明訊息，即可完整測試此功能。

**Acceptance Scenarios**:

1. **Given** 使用者已加入 LINE Bot 為好友，**When** 使用者發送「help」，**Then** 系統回應指令說明卡片，列出「股價 <代號>」、「新聞 <關鍵字>」、「help」等指令與使用範例
2. **Given** 使用者已加入 LINE Bot 為好友，**When** 使用者發送「幫助」(中文別名)，**Then** 系統回應相同的指令說明
3. **Given** 使用者已加入 LINE Bot 為好友，**When** 使用者發送無法識別的指令 (例如「test123」)，**Then** 系統回應「無法識別的指令，請輸入 help 查看使用說明」

---

### Edge Cases

- **無效的股票代號**: 使用者輸入「股價 9999」(不存在的代號) 時，系統應回應「查無此股票代號，請確認後再試」
- **模糊名稱比對信心分數過低**: 使用者輸入「股價 電子」等過於模糊的名稱，導致最高信心分數 ≤80% 時，系統應回應「找到多筆相似結果，請使用更精確的名稱或股票代號」
- **網路逾時或 API 全數失敗**: 當主要與備援資料來源皆無法回應時，系統應優先回應快取中的過期資料 (若存在)，並附註「資料可能稍有延遲」；若無快取資料則在 3 秒內回應「目前無法取得資料，請稍後再試」
- **查詢關鍵字過於籠統**: 使用者輸入「新聞 股票」等過於廣泛的關鍵字時，系統應回應通用財經新聞或提示「請輸入更具體的關鍵字 (如公司名稱或產業)」
- **快取失效處理**: 當 Redis 快取服務無法連線時，系統應直接呼叫 API 取得資料，確保服務可用性
- **並發查詢**: 多位使用者同時查詢相同股票時，系統應正確處理快取共享，避免重複呼叫外部 API
- **LINE Webhook 簽章驗證失敗**: 當收到無效的 webhook 請求時，系統應拒絕處理並記錄安全事件
- **Flex Message 傳送失敗**: 當 LINE Messaging API 無法傳送 Flex Message 時，系統應記錄錯誤詳情並回應使用者「服務暫時無法使用，請稍後再試」

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 支援「股價 <股票代號或名稱>」指令，回應該股票的即時行情資訊。當使用者輸入股票名稱時，系統 MUST 使用模糊比對 (fuzzy matching) 並計算信心分數；若最高信心分數 >80%，則回應前 1 筆符合結果；若 ≤80% 則提示「找到多筆相似結果，請使用更精確的名稱或股票代號」
- **FR-002**: 系統 MUST 支援「新聞 <關鍵字>」指令，回應相關的最新產業新聞 (至少 3 則)
- **FR-003**: 系統 MUST 支援「help」指令，回應所有可用指令的說明與使用範例
- **FR-004**: 系統 MUST 定義並滿足服務等級目標 (SLO): 至少 95% 的查詢請求在 3 秒內取得回應。對於外部 Provider 錯誤或異常情況，系統 MUST 在 3 秒內回應備援內容或友善錯誤訊息。
- **FR-005**: 股價資料 MUST 透過至少兩個 Provider (TWSE API 為主、Yahoo Finance 為備援) 取得，並在主要來源失敗時自動 fallback；Yahoo Provider 必須先取得 crumb 與 cookie 並在有效期限內重複使用，以避免 401 錯誤
- **FR-006**: 新聞資料 MUST 透過至少兩個 Provider (Google News RSS 為主、Yahoo RSS 為備援) 取得，並在主要來源失敗時自動 fallback
- **FR-007**: 股價查詢結果 MUST 快取 45 秒，新聞查詢結果 MUST 快取 15 分鐘。當快取過期且所有 Provider 失敗時，系統 MUST 回應快取中的過期資料 (stale data) 並在背景嘗試更新，確保使用者立即獲得回應
- **FR-008**: 系統 MUST 使用 Flex Message 格式呈現結構化資料 (股價、新聞)，提供卡片化視覺體驗。當 Flex Message 傳送失敗時，系統 MUST 記錄錯誤並回應「服務暫時無法使用，請稍後再試」
- **FR-009**: 系統 MUST 驗證 LINE Webhook 請求的簽章 (signature)，拒絕處理無效請求
- **FR-010**: 系統 MUST 使用結構化日誌系統 (structured logger, 例如 pino 或 winston) 記錄所有錯誤與 Provider fallback 事件，輸出 JSON 格式並包含 log levels (info/warn/error)，確保在 Vercel 環境中可追蹤與查詢。每筆日誌 MUST 包含以下欄位: timestamp (時間戳記), level (日誌等級), message (訊息), requestId (請求追蹤ID), userId (雜湊後的 LINE 使用者ID), providerName (資料來源名稱), latency (回應延遲時間)
- **FR-011**: 系統 MUST 在無法識別指令時，提示使用者輸入「help」查看說明
- **FR-012**: 快取服務失敗時，系統 MUST 降級至直接呼叫 API，確保服務可用性
- **FR-013**: 當使用者輸入僅有數字的內容而觸發「無法識別的指令」回應時，回應中顯示的「查股價」與「看新聞」快速按鈕 MUST 自動帶入該次輸入的數字並送出「股價 <代號>」或「新聞 <代號>」，避免使用者重複輸入

### Key Entities

- **股價行情 (Stock Quote)**: 表示特定股票在某時間點的交易資訊，包含股票代號、名稱、現價、漲跌金額、漲跌幅、成交量、最高價、最低價、開盤價等屬性
- **新聞項目 (News Item)**: 表示一則新聞報導，包含標題、來源、發布時間、摘要、原文連結等屬性
- **查詢指令 (Command)**: 表示使用者輸入的指令，包含指令類型 (股價、新聞、help)、參數 (股票代號、關鍵字) 等屬性
- **資料提供者 (Provider)**: 表示外部資料來源的抽象介面，定義統一的查詢方法與回應格式，具體實作包含 TWSE Provider、Yahoo Finance Provider、Google News Provider、Yahoo News Provider

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% 的股價查詢請求在 3 秒內完成回應
- **SC-002**: 95% 的新聞查詢請求在 3 秒內完成回應
- **SC-003**: 快取命中率達到 80% 以上，有效減少外部 API 呼叫次數
- **SC-004**: 當主要資料來源失敗時，系統在 1 秒內自動切換至備援來源
- **SC-008**: 當主要資料來源失敗時，系統 MUST 在 3 秒內回應替代內容或友善錯誤訊息（即使用於外部提供者故障）
- **SC-005**: 使用者在發送無效指令時，100% 收到友善的錯誤提示與說明引導
- **SC-006**: 系統支援至少 100 位使用者同時查詢，無效能衰退
- **SC-007**: 所有 Provider 失敗事件與 fallback 行為皆被記錄，可追蹤查詢
- **SC-008**: 使用者首次使用時，能在 1 分鐘內透過「help」指令理解所有可用功能

## Assumptions

- 假設使用者主要查詢台灣證券交易所 (TWSE) 的上市股票，因此 TWSE API 為主要資料來源
- 假設新聞查詢以繁體中文關鍵字為主，因此選用 Google News RSS 與 Yahoo RSS 作為新聞來源
- 假設 LINE Bot 的使用者已完成好友加入，本功能不處理好友邀請或驗證流程
- 假設 Upstash Redis 快取服務的可用性為 99% 以上，快取失敗時降級至直接 API 呼叫
- 假設股價資料的即時性要求為分鐘級 (45 秒快取可接受)，新聞資料可容忍 15 分鐘的延遲
- 假設每位使用者的查詢頻率不超過每分鐘 10 次，無需實作流量限制 (rate limiting)

## Development Tasks

Implementation work is tracked in `/specs/001-line-bot-commands/tasks.md` and organized by phases: Setup & Critical Fixes, Core Reliability & Safety, Feature Implementation, Testing & Validation, Docs & Release. Prioritized tasks (Phase 1) MUST be completed before Phase 3 work begins.

High priority tasks to start with:

- T001: Fix webhook signature verification in `api/line/webhook.ts` (security)
- T003: Add Redis cache wrapper and integrate caching with TTLs for quote (45s) and news (15min)
- T004: Add Zod runtime validation for providers and ensure providers fail fast on invalid responses
- T005: Use `withCache` wrapper inside providers and update `lib/providers/index.ts` accordingly

See `/specs/001-line-bot-commands/tasks.md` for the full task list, acceptance criteria, and test coverage requirements.

## Clarifications

### Session 2025-11-13

- Q: Provider priority (primary source for quotes) → A: Provider order MUST be configurable; default = TWSE.
- Q: FR-004 vs SC-001 SLO → A: 95% of requests respond in <3s; on provider failure the bot must return a friendly fallback or alternate content within 3s (and provider fallback should occur as quickly as practical; aim for <1s where feasible).
- Q: Logging implementation for Vercel observability (FR-010 requires recording errors & fallback events) → A: Implement structured logger (e.g., pino, winston) with Vercel-compatible JSON output + log levels
- Q: Cache behavior when TTL expires during provider outage (FR-007 defines TTLs but not stale data handling) → A: Serve stale data from cache if providers fail + attempt background refresh
- Q: Behavior when LINE Flex Message API fails (FR-008 requires Flex Message but doesn't specify failure handling) → A: Log error and return generic "服務暫時無法使用" message (no data)
- Q: Stock name matching strategy when multiple companies have similar names (FR-001 mentions "股票代號或名稱" but not matching logic) → A: Fuzzy matching with confidence score; show top 2 matches if >80% confidence
- Q: Structured logging metadata fields (FR-010 requires JSON output but not field specification) → A: Standard + trace: timestamp, level, message, requestId, userId (hashed), providerName, latency

	*Details*: The system MUST support at least two providers for quotes. The default primary provider is TWSE; implement a configuration (environment variable) to change priority (e.g., `QUOTE_PRIMARY_PROVIDER=twse|yahoo`). Providers MUST be selectable per feature and respected by `lib/providers/index.ts` logic and `withCache` wrappers.

### Session 2025-11-15

- Q: 當使用者輸入純數字後出現「無法識別的指令」提示時，快速按鈕是否要自動帶入該數字？ → A: 是，兩個快速按鈕都要帶入最後一次輸入的數字並組合成完整指令

### Session 2025-11-18

- Q: Yahoo fallback 401 mitigation策略？ → A: 保留原生 query1 endpoint，但必須實作 crumb + cookie 取得與快取流程，並在憑證失效前重複使用

