<!--
SYNC IMPACT REPORT
==================
Version Change: 1.0.0 → 1.1.0
Change Type: MINOR (Mandate Traditional Chinese outputs)
Change Date: 2025-11-17

Modified Principles:
- None (principle statements unchanged)

Added Sections:
- Technical Standards: Documentation & Response Language requirement

Removed Sections:
- None

Template Status:
✅ plan-template.md - No language guidance updates required
✅ spec-template.md - Existing instructions already assume Traditional Chinese narratives
✅ tasks-template.md - No changes needed

Follow-up TODOs: None
-->

# LINE Stock Bot Constitution

## Core Principles

### I. Serverless-First Architecture

所有功能 MUST 設計為無狀態 (stateless)、事件驅動的 Serverless Functions。每個 API endpoint MUST 可獨立部署、獨立擴展。禁止依賴本地檔案系統持久化、長時間運行的程序或背景服務。

**理由**: Vercel Serverless 的執行環境限制要求無狀態設計，確保低維運成本與自動擴展能力。

### II. Provider Abstraction & Fallback

所有外部資料來源 (股價、新聞) MUST 透過 Provider 介面抽象化。每個功能 MUST 實作至少兩個 Provider，並在主要來源失敗時自動 fallback 至備援來源。

**理由**: 
- 確保服務可靠性，避免單點故障
- 第三方 API 限流或異常時仍能提供服務
- 可輕鬆替換或新增資料來源

**實作要求**:
- Provider 介面 MUST 定義統一的輸入/輸出格式
- Fallback 邏輯 MUST 記錄失敗原因並監控
- Provider 選擇順序 MUST 可設定

### III. Caching Strategy

所有外部 API 呼叫 MUST 經過快取層 (Upstash Redis)。快取策略 MUST 依據資料更新頻率設定適當的 TTL:
- 股價行情: 45 秒
- 產業新聞: 15 分鐘

**理由**: 
- 降低外部 API 呼叫成本
- 提升回應速度
- 避免 rate limiting

**實作要求**:
- 快取 key MUST 包含查詢參數 (如股票代號、關鍵字)
- 快取失敗 MUST fallback 至直接呼叫 API
- 快取 hit/miss MUST 被監控

### IV. TypeScript Type Safety

所有資料結構 MUST 使用 TypeScript 定義型別或介面。外部 API 回應 MUST 使用 Zod 或類似工具進行 runtime validation。禁止使用 `any` 型別，除非有明確註解說明理由。

**理由**: 
- 編譯時期捕捉型別錯誤
- 提升程式碼可維護性與可讀性
- Runtime validation 防止外部資料異常

**實作要求**:
- Provider 回應 MUST 有對應的 Zod schema
- 型別定義 MUST 集中於 `lib/types.ts`
- 複雜型別 MUST 包含註解說明

### V. Flex Message UI

LINE 聊天機器人回應 MUST 使用 Flex Message 格式呈現結構化資料 (股價、新聞)。每種資料類型 MUST 有對應的 Flex Message template。

**理由**: 
- 提供卡片化、視覺化的使用者體驗
- 一致的 UI 呈現
- 支援互動元素 (按鈕、連結)

**實作要求**:
- Flex Message template MUST 集中於 `lib/flex.ts`
- Template MUST 可重用與組合
- 錯誤訊息 MUST 以簡潔的文字訊息呈現

### VI. Observability & Incident Visibility

所有 Serverless 函式 MUST 產出可查詢的結構化日誌，並回報快取命中率、Provider 成功率與 fallback 事件。事件追蹤 MUST 使用既有的 `lib/logger.ts` 與 `lib/monitoring.ts` 抽象，禁止重新發明 logging/metrics 介面。

**理由**:
- 伺服器無狀態、壽命短，必須透過集中式日誌與指標掌握健康狀況
- 快速界定 provider 或快取異常，縮短修復時間
- 避免觀測資料分散在 ad-hoc `console.log`

**實作要求**:
- 所有錯誤、fallback、快取 miss MUST 使用 `logger` 的結構化介面
- `monitoring` 模組 MUST 紀錄 cache hit/miss 與 provider latency；若監控停用也需安全短路
- 日誌需包含 `requestId` 或可追蹤的相依資訊 (如 symbol, command)
- 新增監控事件 MUST 同步更新 README 或運維文件

## Technical Standards

**Platform**: Vercel Serverless Functions  
**Runtime**: Node.js (latest LTS)  
**Language**: TypeScript 5.x  
**Package Manager**: pnpm  
**Primary Dependencies**: 
- `@line/bot-sdk` - LINE Messaging API handler
- `zod` - Schema validation
- `@upstash/redis` - Serverless caching層
- `Fuse.js` - 指令/代號模糊比對
- `tsx` - TypeScript runtime/開發伺服器
- `vitest` - 單元與整合測試框架

**API Integrations**:
- LINE Messaging API - 聊天機器人介面
- TWSE API - 台灣證券交易所股價資料 (主要)
- Yahoo Finance (RapidAPI) - 股價資料 (備援)
- Google News RSS - 新聞來源 (主要)
- Yahoo RSS - 新聞來源 (備援)

**Performance Targets**:
- Webhook 回應時間: < 3 秒 (LINE API timeout)
- 快取命中率: > 80%
- Provider fallback 延遲: < 1 秒

**Observability Stack**:
- `lib/logger.ts` - JSON 結構化日誌
- `lib/monitoring.ts` - Cache/provider 指標與事件
- Vercel log drains - 供查詢之集中式儲存 (可接 Slack/警報)

**Testing Framework**:
- `vitest` - 單元、整合測試
- `@vitest/coverage-istanbul` (選用) - 覆蓋率量測

**Security Requirements**:
- LINE Webhook MUST 驗證 signature
- 環境變數 MUST 儲存所有 API keys 與 secrets
- 禁止將敏感資訊提交至版本控制

**Documentation & Response Language**:
- 所有說明文件、系統自動產生的流程輸出與對使用者的回應 MUST 全數使用正體中文
- 若外部來源提供非正體中文內容，MUST 以正體中文摘要或翻譯後才可呈現給使用者

## Development Workflow

**Code Organization**:
- `/api` - Vercel Serverless Functions (webhook endpoints)
- `/lib` - 可重用的業務邏輯、型別定義、Provider 實作
- `/lib/providers` - 外部資料來源的 Provider 實作

**Modularity Requirements**:
- Provider MUST 可獨立測試與模擬 (mock)
- Flex Message template MUST 與業務邏輯分離
- 每個 Provider 檔案 MUST 只負責一個資料來源

**Error Handling**:
- 所有錯誤 MUST 記錄至 console (Vercel logs)
- 使用者看到的錯誤訊息 MUST 簡潔且友善
- Provider 失敗 MUST 記錄來源與原因

**Testing**:
- 單元與整合測試 MUST 使用 `vitest`
- Provider 整合測試 MUST 以 mock/fixture 覆蓋失敗與 fallback 流程
- Flex Message template MUST 透過 snapshot 或視覺化驗證保持穩定
- Webhook 端點 MUST 可用 LINE Bot SDK 測試工具驗證簽章與互動

**Observability Operations**:
- `logger` 與 `monitoring` 呼叫 MUST 於 PR 中接受檢視，避免靜默錯誤
- 每次新增 Provider 或 cache 策略時 MUST 定義對應的指標維度 (symbol, provider, ttl bucket)
- 重大事件 (fallback storm, cache miss 突增) MUST 有 runbook 在 `specs/.../quickstart.md` 或 README 連結

## Governance

本 Constitution 定義 LINE Stock Bot 專案的核心原則與技術標準，所有功能開發、架構決策、程式碼審查 MUST 遵守本文件。

**Amendment Process**:
1. 提案變更 MUST 包含理由、影響範圍與遷移計畫
2. 變更 MUST 更新 `CONSTITUTION_VERSION` (遵循語意化版本)
3. 變更 MUST 同步更新相關 template 檔案
4. 變更 MUST 包含 Sync Impact Report

**Version Policy**:
- MAJOR: 移除或重新定義核心原則
- MINOR: 新增原則或實質擴充指引
- PATCH: 文字修正、澄清說明

**Compliance**:
- 所有程式碼變更 MUST 符合 Core Principles
- 架構偏離 MUST 在 plan.md 的 "Complexity Tracking" 中說明
- 定期審查專案是否符合 Technical Standards

**Guidance Files**: 參考 `.github/prompts/` 中的 speckit 命令進行功能開發流程。

**Version**: 1.1.0 | **Ratified**: 2025-11-13 | **Last Amended**: 2025-11-17
