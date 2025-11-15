---
description: "Task list for implementing LINE bot commands and required infra adjustments"
---

# Tasks: LINE 聊天機器人指令系統

**Feature Branch**: `001-line-bot-commands`  
**Generated**: 2025-11-14  
**Input**: Design documents from `spec.md`, `plan.md`, `data-model.md`, `contracts/`

**Total Tasks**: 32  
**Completion**: 15/32 (46.9%)

---

## Implementation Strategy

**MVP Scope** (User Story 1 only):
- Stock quote query by symbol/name
- Fuzzy matching for company names
- Provider fallback (TWSE → Yahoo)
- Cache with 45s TTL
- Flex Message display

**Incremental Delivery Order**:
1. Phase 1-2: Setup & Foundation (blocking)
2. Phase 3: User Story 1 (MVP) - Stock quote query
3. Phase 4: User Story 2 - News query
4. Phase 5: User Story 3 - Help command
5. Phase 6: Polish & observability

---

## Phase 1: Setup & Infrastructure (Blocking)

**Goal**: Initialize project dependencies, environment configuration, and core utilities.

**Independent Test**: Run `pnpm install` and `pnpm test` successfully with no errors.

### Tasks

- [X] T001 Fix webhook signature verification logic in api/line/webhook.ts
- [X] T002 Add Upstash Redis dependency and update .env.local.example with UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
- [ ] T003 Install Fuse.js for fuzzy matching in package.json

**Parallel Opportunities**: T001, T002, T003 can be executed in parallel (different files, no dependencies).

---

## Phase 2: Foundational Layer (Blocking)

**Goal**: Implement core infrastructure required by all user stories (caching, logging, validation, provider framework).

**Independent Test**: Run unit tests for cache, logger, schemas, and provider framework - all pass.

### Tasks

- [X] T004 Create lib/schemas.ts with Zod schemas for Quote, NewsItem, FuzzyMatchResult, LogEntry
- [X] T005 Implement lib/cache.ts with Upstash Redis wrapper supporting getWithStale pattern
- [X] T006 Create lib/providers/withCache.ts implementing cache HOC with TTL and stale-while-revalidate logic
- [X] T007 Enhance lib/logger.ts with structured JSON logging including requestId, userId, providerName, latency fields
- [ ] T008 Implement lib/providers/index.ts with sequential fallback strategy and timeout handling
- [ ] T009 Add environment variable support for QUOTE_PRIMARY_PROVIDER and NEWS_PRIMARY_PROVIDER in lib/providers/index.ts

**Parallel Opportunities**: T004, T005, T007 can be executed in parallel. T006 depends on T005. T008-T009 depend on T004-T007.

---

## Phase 3: User Story 1 - 查詢台股即時行情 (Priority: P1) 🎯 MVP

**Story Goal**: 使用者可透過股票代號或名稱查詢即時股價，系統使用 Flex Message 呈現行情卡片，支援 Provider fallback 與快取。

**Independent Test**: 
1. 發送「股價 2330」→ 3秒內收到台積電股價 Flex Message 卡片
2. 發送「股價 台積電」→ 模糊比對識別，回應股價卡片
3. 主要 Provider 失敗 → 自動切換備援，3秒內回應
4. 45秒內重複查詢 → 從快取讀取，<1秒回應

### Tasks

- [ ] T010 [P] [US1] Implement lib/symbol.ts with Fuse.js fuzzy matcher for stock name resolution (80% confidence threshold)
- [ ] T011 [P] [US1] Create lib/providers/quote/twse.ts implementing TWSE API provider with Zod validation
- [ ] T012 [P] [US1] Create lib/providers/quote/yahooRapid.ts implementing Yahoo Finance provider with Zod validation
- [ ] T013 [US1] Implement getQuoteWithFallback in lib/providers/index.ts with configurable provider order and timeout
- [ ] T014 [US1] Integrate quote providers with withCache wrapper (45s TTL) in lib/providers/index.ts
- [ ] T015 [P] [US1] Create Flex Message template for stock quote display in lib/flex.ts (createStockQuoteMessage)
- [ ] T016 [US1] Implement stock quote command handler in api/line/webhook.ts (parse「股價」command, resolve symbol, fetch quote, reply with Flex Message)
- [ ] T017 [US1] Add error handling for invalid stock symbols and low-confidence fuzzy matches in api/line/webhook.ts
- [ ] T018 [US1] Add stale cache handling with warning message「資料可能稍有延遲」in api/line/webhook.ts

**Dependencies**: Requires Phase 1-2 completion.

**Parallel Opportunities**: T010, T011, T012, T015 can be executed in parallel. T013-T014 depend on T011-T012. T016-T018 depend on T013-T015.

**Acceptance Criteria**:
- ✅ `股價 2330` returns TSMC quote Flex Message in <3s
- ✅ `股價 台積電` uses fuzzy matching and returns quote if confidence >80%
- ✅ `股價 電子` (low confidence) returns「找到多筆相似結果，請使用更精確的名稱或股票代號」
- ✅ TWSE failure → automatic fallback to Yahoo within 1s
- ✅ Repeated query within 45s → cache hit, response <1s
- ✅ All providers fail + stale cache exists → returns stale data with warning
- ✅ All providers fail + no cache → returns「目前無法取得資料，請稍後再試」

---

## Phase 4: User Story 2 - 查詢產業新聞 (Priority: P2)

**Story Goal**: 使用者可透過關鍵字查詢相關產業新聞，系統回應3-5則新聞卡片，支援 Provider fallback 與15分鐘快取。

**Independent Test**:
1. 發送「新聞 台積電」→ 收到3-5則相關新聞 Flex Message 卡片
2. 發送「新聞 半導體」→ 收到半導體產業新聞
3. 主要 Provider 失敗 → 自動切換備援，3秒內回應
4. 15分鐘內重複查詢 → 從快取讀取

### Tasks

- [X] T019 [P] [US2] Create lib/providers/news/googleRss.ts implementing Google News RSS provider with Zod validation
- [X] T020 [P] [US2] Create lib/providers/news/yahooRss.ts implementing Yahoo RSS provider with Zod validation
- [X] T021 [US2] Implement getIndustryNews in lib/providers/index.ts with fallback logic and limit parameter
- [X] T022 [US2] Integrate news providers with withCache wrapper (900s / 15min TTL) in lib/providers/index.ts
- [X] T023 [P] [US2] Create Flex Message template for news list display in lib/flex.ts (createNewsListMessage)
- [X] T024 [US2] Implement news query command handler in api/line/webhook.ts (parse「新聞」command, fetch news, reply with Flex Message)
- [X] T025 [US2] Add handling for overly broad keywords with suggestion message in api/line/webhook.ts

**Dependencies**: Requires Phase 1-2 completion. Can be developed in parallel with Phase 3.

**Parallel Opportunities**: T019, T020, T023 can be executed in parallel. T021-T022 depend on T019-T020. T024-T025 depend on T021-T023.

**Acceptance Criteria**:
- ✅ `新聞 台積電` returns 3-5 relevant news items with title, source, time, link
- ✅ `新聞 半導體` returns semiconductor industry news
- ✅ Google RSS failure → automatic fallback to Yahoo RSS
- ✅ Repeated query within 15min → cache hit
- ✅ Broad keyword like `新聞 股票` → returns generic financial news or suggestion
- ✅ All providers fail + stale cache → returns stale news with warning
- ✅ All providers fail + no cache → returns error message

---

## Phase 5: User Story 3 - 查詢使用說明 (Priority: P3)

**Story Goal**: 使用者可查詢所有可用指令的說明與範例，包含「help」與「幫助」別名支援。

**Independent Test**:
1. 發送「help」→ 收到指令說明 Flex Message
2. 發送「幫助」→ 收到相同說明
3. 發送「test123」(無效指令) → 收到「無法識別的指令，請輸入 help 查看使用說明」

### Tasks

- [ ] T026 [P] [US3] Create Flex Message template for help command in lib/flex.ts (createHelpMessage)
- [ ] T027 [US3] Implement help command handler with alias support (help/幫助) in api/line/webhook.ts
- [ ] T028 [US3] Implement unknown command handler with help suggestion in api/line/webhook.ts

**Dependencies**: Requires Phase 1-2 completion. Can be developed in parallel with Phase 3-4.

**Parallel Opportunities**: T026, T027, T028 can be executed in parallel (minimal dependencies).

**Acceptance Criteria**:
- ✅ `help` returns Flex Message with all command descriptions and examples
- ✅ `幫助` returns same help message
- ✅ Unknown command returns friendly error with help suggestion
- ✅ Help message includes: 股價 <代號>, 新聞 <關鍵字>, help

---

## Phase 6: Polish & Cross-Cutting Concerns

**Goal**: Complete testing, documentation, monitoring, and production readiness.

### Tasks

- [ ] T029 [P] Add unit tests for fuzzy matching in tests/unit/symbol.test.ts
- [ ] T030 [P] Add unit tests for Flex Message templates in tests/unit/flex.test.ts
- [ ] T031 [P] Add integration test for end-to-end stock query flow in tests/integration/webhook.test.ts
- [ ] T032 [P] Add integration test for news query flow in tests/integration/webhook.test.ts
- [ ] T033 Add performance test script simulating 100 concurrent users in scripts/load-test.ts
- [ ] T034 [P] Update README.md with setup, deployment, and troubleshooting guide
- [ ] T035 [P] Add CI/CD configuration for automated testing in .github/workflows/test.yml
- [ ] T036 Add monitoring dashboard configuration for cache hit rate and provider fallback metrics
- [ ] T037 Add alert rules for SLO violations (>5% requests >3s) and high fallback rates
- [ ] T038 Add fallback latency tests verifying <1s provider switch in tests/integration/fallback.test.ts
- [ ] T039 Implement Flex Message send failure handling with error logging in api/line/webhook.ts
- [ ] T040 Add comprehensive error messages for all edge cases per spec in api/line/webhook.ts

**Parallel Opportunities**: Most tasks in this phase can be executed in parallel except dependencies: T031-T032 depend on Phase 3-4 completion. T033 depends on T031-T032.

---

## Dependency Graph

```
Phase 1 (Setup)
  ├─> Phase 2 (Foundation) ─┬─> Phase 3 (US1 - Stock Quote) ─┐
  │                         ├─> Phase 4 (US2 - News)         ─┤─> Phase 6 (Polish)
  │                         └─> Phase 5 (US3 - Help)         ─┘
```

**Critical Path**: Phase 1 → Phase 2 → Phase 3 (MVP)

**User Story Independence**:
- US1, US2, US3 can be developed in parallel after Phase 2 completion
- Each story has independent test criteria and can ship separately
- Recommended order: US1 (MVP) → US3 (quick win) → US2 (complex)

---

## Parallel Execution Examples

### Phase 2 (Foundation) Parallel Work
```
Developer A: T004 (schemas) + T007 (logger)
Developer B: T005 (cache) → T006 (withCache)
Developer C: T008 (provider framework) → T009 (config)
```

### Phase 3 (US1) Parallel Work
```
Developer A: T010 (fuzzy matcher) + T015 (Flex template)
Developer B: T011 (TWSE provider)
Developer C: T012 (Yahoo provider)
→ Merge → T013-T014 (integration)
→ T016-T018 (webhook handlers)
```

### Phase 4 (US2) Parallel Work
```
Developer A: T019 (Google RSS) + T023 (Flex template)
Developer B: T020 (Yahoo RSS)
→ Merge → T021-T022 (integration)
→ T024-T025 (webhook handlers)
```

---

## Testing Strategy

**Unit Tests** (Required for Phase 2-5):
- `tests/unit/symbol.test.ts` - Fuzzy matching logic
- `tests/unit/providers/*.test.ts` - Provider validation, fallback, caching
- `tests/unit/flex.test.ts` - Flex Message templates
- `tests/unit/logger.test.ts` - Structured logging

**Integration Tests** (Required for Phase 3-5):
- `tests/integration/webhook.test.ts` - End-to-end command flows
- `tests/integration/cache.test.ts` - Cache behavior with Redis
- `tests/integration/fallback.test.ts` - Provider fallback scenarios

**Performance Tests** (Phase 6):
- `scripts/load-test.ts` - 100 concurrent users simulation
- SLO validation: 95% requests <3s, cache hit >80%

---

## Success Metrics

**Phase 3 (MVP) Exit Criteria**:
- ✅ All US1 acceptance scenarios pass
- ✅ Unit test coverage >80% for quote providers
- ✅ Integration tests pass for stock query flow
- ✅ Manual testing: 股價 2330, 股價 台積電, fallback scenario
- ✅ Performance: <3s response for 95% requests

**Phase 4-5 Exit Criteria**:
- ✅ All US2 and US3 acceptance scenarios pass
- ✅ Full integration test suite passes
- ✅ Documentation updated

**Phase 6 Exit Criteria**:
- ✅ Load test passes (100 concurrent users)
- ✅ CI/CD pipeline configured and passing
- ✅ Monitoring dashboard operational
- ✅ All edge cases handled per spec

---

## Notes

- **Priority markers**: [P] = Parallelizable task (independent file/module)
- **Story markers**: [US1]/[US2]/[US3] = Maps to user story from spec.md
- **Task IDs**: Sequential execution order (T001→T002→...)
- **File paths**: All paths are absolute from repository root
- **Testing**: Unit tests created alongside implementation (TDD approach)
- **MVP**: Phase 3 (US1) represents minimum viable product
- **Incremental delivery**: Each user story phase is independently deployable


