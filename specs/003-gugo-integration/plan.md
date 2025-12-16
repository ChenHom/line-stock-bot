# Implementation Plan: Gugo 研究引擎整合

**Branch**: `003-gugo-integration` | **Date**: 2025-12-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-gugo-integration/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

整合 gugo 研究引擎到 line-stock-bot，新增「詳解」、「策略股」、「回測」三個研究型指令。line-stock-bot 作為前端負責指令解析與結果呈現，所有研究計算由 gugo HTTP API 完成。採用與現有 Provider 架構一致的模式，建立統一的 gugo client 模組處理 HTTP 通訊、錯誤處理與快取。

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js LTS)  
**Primary Dependencies**: `@line/bot-sdk`, `zod`, `@upstash/redis`, `Fuse.js`  
**Storage**: Upstash Redis（快取層）  
**Testing**: vitest（單元與整合測試）  
**Target Platform**: Vercel Serverless Functions  
**Project Type**: single（既有 line-stock-bot 專案）  
**Performance Goals**: Webhook 回應時間 < 3 秒，快取命中率 > 80%  
**Constraints**: gugo API 回應 < 800ms，fallback 延遲 < 1 秒  
**Scale/Scope**: 個人使用者，新增 3 個指令處理流程

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 狀態 | 說明 |
|------|------|------|
| I. Serverless-First | ✅ PASS | gugo client 設計為無狀態，透過環境變數設定，符合 Vercel Serverless 架構 |
| II. Provider Abstraction & Fallback | ✅ PASS | gugo client 採用與現有 Quote/News Provider 相同的介面模式；暫無備援 Provider（gugo 為唯一來源），但錯誤時提供友善降級訊息 |
| III. Caching Strategy | ✅ PASS | 策略股清單使用 Redis 快取（TTL: 5 分鐘）；詳解因即時性需求不快取或使用短 TTL |
| IV. TypeScript Type Safety | ✅ PASS | gugo API 回應使用 Zod schema 進行 runtime validation；新增型別集中於 `lib/schemas.ts` |
| V. Flex Message UI | ✅ PASS | 因子詳解與策略股清單皆設計專屬 Flex Message template，放置於 `lib/flex.ts` |
| VI. Observability | ✅ PASS | 使用既有 `lib/logger.ts` 與 `lib/monitoring.ts`；記錄 gugo 呼叫的 symbol、指令類型、成功率、耗時 |

## Project Structure

### Documentation (this feature)

```text
specs/003-gugo-integration/
├── plan.md              # 本檔案（/speckit.plan 指令輸出）
├── research.md          # Phase 0 輸出：技術研究與決策
├── data-model.md        # Phase 1 輸出：資料模型定義
├── quickstart.md        # Phase 1 輸出：開發者快速上手指南
├── contracts/           # Phase 1 輸出：API 契約
│   └── gugo-api.md      # gugo HTTP API 契約
└── tasks.md             # Phase 2 輸出（由 /speckit.tasks 建立）
```

### Source Code (repository root)

```text
line-stock-bot/
├── api/
│   └── line/
│       └── webhook.ts          # 新增詳解、策略股、回測指令處理
├── lib/
│   ├── providers/
│   │   └── gugo/               # 新增：gugo client 模組
│   │       ├── client.ts       # HTTP client、錯誤處理、timeout
│   │       ├── factor.ts       # 因子評分 API 呼叫
│   │       ├── ranking.ts      # 排行榜 API 呼叫
│   │       └── backtest.ts     # 回測 API 呼叫（P2）
│   ├── flex.ts                 # 新增：因子詳解、策略股清單 Flex templates
│   ├── schemas.ts              # 新增：FactorScore、StrategyRanking Zod schemas
│   └── types.ts                # 新增：gugo 相關型別匯出
└── tests/
    ├── unit/
    │   └── providers/
    │       └── gugo.test.ts    # gugo client 單元測試
    └── integration/
        └── gugo.test.ts        # gugo 整合測試（含 mock）
```

**Structure Decision**: 沿用既有的單一專案結構，gugo client 放置於 `lib/providers/gugo/` 目錄下，與現有的 quote/news providers 並列，維持一致的架構模式。

## Complexity Tracking

> 本功能符合 Constitution 所有原則，無需記錄違反項目。
