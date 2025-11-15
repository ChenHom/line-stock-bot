# Implementation Plan: LINE 聊天機器人指令系統

**Branch**: `001-line-bot-commands` | **Date**: 2025-11-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-line-bot-commands/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

實作 LINE 聊天機器人核心指令系統，支援股價查詢、新聞查詢、使用說明等功能。採用 Provider 抽象化設計搭配自動 fallback 機制，確保服務可靠性。使用 Upstash Redis 實作快取層提升效能，並透過 Flex Message 提供視覺化卡片呈現。系統符合 95% 查詢在 3 秒內回應的 SLO，並使用結構化日誌確保 Vercel 環境可觀測性。

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js latest LTS)  
**Primary Dependencies**: `@line/bot-sdk`, `zod`, `@upstash/redis`, `tsx`, `node-fetch` (or native fetch), `vercel`  
**Storage**: Upstash Redis (快取層，無持久化資料庫需求)  
**Testing**: Vitest (已配置於專案)  
**Target Platform**: Vercel Serverless Functions  
**Project Type**: Web API (Serverless webhook handlers)  
**Performance Goals**: 
- 95% 查詢請求 < 3 秒回應
- 快取命中率 > 80%
- Provider fallback < 1 秒  
**Constraints**: 
- Vercel Serverless 執行時間限制 (10 秒)
- LINE Webhook 回應必須在 3 秒內
- 無狀態設計 (stateless functions)  
**Scale/Scope**: 
- 支援至少 100 位並發使用者
- 3 種核心指令 (股價、新聞、help)
- 4 個外部 Provider (2 股價 + 2 新聞)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Compliance Notes |
|-----------|--------|------------------|
| **I. Serverless-First Architecture** | ✅ PASS | 所有功能設計為 Vercel Serverless Functions，webhook handler 無狀態，無本地持久化 |
| **II. Provider Abstraction & Fallback** | ✅ PASS | 股價 (TWSE + Yahoo) 與新聞 (Google RSS + Yahoo RSS) 皆有至少 2 個 Provider，支援自動 fallback |
| **III. Caching Strategy** | ✅ PASS | 使用 Upstash Redis，股價快取 45 秒、新聞快取 15 分鐘，快取失敗降級至直接 API 呼叫 |
| **IV. TypeScript Type Safety** | ✅ PASS | 使用 TypeScript 5.x，Zod 進行 runtime validation，Provider 回應需 schema 驗證 |
| **V. Flex Message UI** | ✅ PASS | 股價與新聞使用 Flex Message 卡片呈現，template 集中於 `lib/flex.ts` |

**Gate Result**: ✅ ALL PASSED - 可進入 Phase 0 研究

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
api/
├── ping.ts                    # Health check endpoint
└── line/
    └── webhook.ts             # LINE webhook handler (主要進入點)

lib/
├── cache.ts                   # Upstash Redis wrapper
├── flex.ts                    # Flex Message templates
├── logger.ts                  # Structured logger (pino/winston)
├── monitoring.ts              # 監控與 metrics
├── schemas.ts                 # Zod validation schemas
├── symbol.ts                  # Stock symbol/name mapping & fuzzy matching
├── types.ts                   # TypeScript type definitions
└── providers/
    ├── index.ts               # Provider registry & fallback logic
    ├── withCache.ts           # Cache wrapper HOC
    ├── quote/
    │   ├── twse.ts            # TWSE API provider (主要)
    │   └── yahooRapid.ts      # Yahoo Finance provider (備援)
    └── news/
        ├── googleRss.ts       # Google News RSS provider (主要)
        └── yahooRss.ts        # Yahoo RSS provider (備援)

tests/
├── unit/
│   └── providers/
│       ├── cache.test.ts      # Cache wrapper tests
│       ├── fallback.test.ts   # Fallback logic tests
│       ├── quote.test.ts      # Quote provider tests
│       └── news.test.ts       # News provider tests
└── integration/
    ├── webhook.test.ts        # E2E webhook tests
    └── cache.test.ts          # Redis integration tests
```

**Structure Decision**: 採用 Serverless API 架構，`/api` 目錄為 Vercel Functions 進入點，`/lib` 包含可重用業務邏輯與 Provider 實作。Provider 依資料類型 (quote/news) 分組，支援獨立測試與替換。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

無違反 Constitution 原則的複雜度需要說明。所有設計決策符合 Serverless-First、Provider Abstraction、Caching Strategy、TypeScript Type Safety 與 Flex Message UI 原則。

---

## Phase 0: Research ✅ COMPLETED

**Status**: All research questions resolved. No "NEEDS CLARIFICATION" remaining.

**Deliverables**:
- ✅ `research.md` - 8 research questions answered with decisions, rationale, and alternatives
- ✅ Fuzzy matching strategy: Fuse.js with 80% confidence threshold
- ✅ Structured logging: Enhanced custom logger with JSON output
- ✅ Stale cache strategy: Stale-while-revalidate pattern
- ✅ Provider fallback: Sequential with timeout and circuit breaker
- ✅ Configuration: Environment variables for provider priority

**Key Decisions**:
1. **Fuzzy Matching**: Fuse.js (456 KB, 100% accuracy for Chinese partial matches)
2. **Logging**: Enhanced custom logger (zero dependencies, Vercel-optimized)
3. **Cache Resilience**: Serve stale data on provider failure + background refresh
4. **Provider Timeout**: 2 seconds per provider, <1s fallback, <3s total

---

## Phase 1: Design & Contracts ✅ COMPLETED

**Status**: Data model, API contracts, and quickstart guide finalized.

**Deliverables**:
- ✅ `data-model.md` - Core entities with Zod schemas (Quote, NewsItem, FuzzyMatchResult, LogEntry)
- ✅ `contracts/providers.md` - Internal provider API contracts with fallback & caching specifications
- ✅ `contracts/webhook.md` - LINE webhook endpoint specification
- ✅ `quickstart.md` - Local development, testing, and deployment guide
- ✅ Agent context updated (`.github/copilot-instructions.md`) with new technologies

**Re-check Constitution Compliance** (Post-Design):

| Principle | Status | Compliance Notes |
|-----------|--------|------------------|
| **I. Serverless-First Architecture** | ✅ PASS | Design confirmed: stateless functions, no persistent storage, Vercel-optimized |
| **II. Provider Abstraction & Fallback** | ✅ PASS | Detailed fallback strategy with timeout, validation, and logging documented |
| **III. Caching Strategy** | ✅ PASS | Stale-while-revalidate pattern added, TTL strategies confirmed (45s/900s) |
| **IV. TypeScript Type Safety** | ✅ PASS | Zod schemas defined for all entities, runtime validation enforced |
| **V. Flex Message UI** | ✅ PASS | Template patterns documented, error handling specified |

**Final Gate Result**: ✅ ALL PASSED - Design符合所有 Constitution 原則

---

## Next Steps

**Phase 2 Planning** (NOT included in `/speckit.plan` - requires separate `/speckit.tasks` command):
- Generate `tasks.md` with detailed implementation tasks
- Break down into phases: Setup, Core Reliability, Feature Implementation, Testing, Docs
- Define acceptance criteria for each task
- Establish dependencies and execution order

**Command to proceed**: `/speckit.tasks`
