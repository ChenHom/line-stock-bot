<!--
SYNC IMPACT REPORT
==================
Version Change: 0.0.0 → 1.0.0
Change Type: MAJOR (Initial constitution establishment)
Change Date: 2025-11-13

Modified Principles:
- [NEW] I. Serverless-First Architecture
- [NEW] II. Provider Abstraction & Fallback
- [NEW] III. Caching Strategy
- [NEW] IV. TypeScript Type Safety
- [NEW] V. Flex Message UI

Added Sections:
- Core Principles (5 principles)
- Technical Standards
- Development Workflow
- Governance

Template Status:
✅ plan-template.md - Aligned (Technical Context includes serverless platform, caching, performance)
✅ spec-template.md - Aligned (User stories support independent testing)
✅ tasks-template.md - Aligned (Phase structure supports modular implementation)

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

## Technical Standards

**Platform**: Vercel Serverless Functions  
**Runtime**: Node.js (latest LTS)  
**Language**: TypeScript 5.x  
**Package Manager**: pnpm  
**Primary Dependencies**: 
- `@line/bot-sdk` - LINE Messaging API
- `zod` - Schema validation
- `@upstash/redis` - Caching layer

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

**Security Requirements**:
- LINE Webhook MUST 驗證 signature
- 環境變數 MUST 儲存所有 API keys 與 secrets
- 禁止將敏感資訊提交至版本控制

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

**Testing** (當需要時):
- Provider 整合測試 MUST 使用 mock 資料
- Flex Message template MUST 可視化驗證
- Webhook 端點 MUST 可使用 LINE Bot SDK 的測試工具

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

**Version**: 1.0.0 | **Ratified**: 2025-11-13 | **Last Amended**: 2025-11-13
