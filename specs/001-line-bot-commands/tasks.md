# Tasks: LINE 聊天機器人指令系統

**Feature**: `001-line-bot-commands`
**Status**: Planned




## Phase 1: Setup & Infrastructure (Blocking) ✅

**Goal**: Initialize project dependencies, environment configuration, and core utilities in repo.

**Independent Test**: Run `pnpm install` and `pnpm test` successfully with no errors.

### Tasks

- [X] T001 [P] Update LINE webhook signature verification at `api/line/webhook.ts`
- [X] T002 Add Upstash Redis dependency and update `package.json` & `.env.local.example` (add `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`) - file paths: `package.json`, `.env.local.example`
- [X] T003 [P] Install Fuse.js for fuzzy matching by adding dependency to `package.json` and `pnpm-lock.yaml` - file path: `package.json`
- [X] T004 [P] Confirm and add environment variable docs to `specs/001-line-bot-commands/quickstart.md` and `.env.local.example` - file paths: `specs/001-line-bot-commands/quickstart.md`, `.env.local.example`

**Parallel Opportunities**: T001, T002, T003, T004 can be executed in parallel (different files, no blocking).

---

## Phase 2: Foundational Layer (Blocking) ✅

**Goal**: Implement core infra required by all user stories (caching, logging, validation, provider framework).

**Independent Test**: Run unit tests for cache, logger, schemas, and provider framework successfully.

### Tasks

- [X] T005 Create `lib/schemas.ts` with Zod schemas for Quote, NewsItem, FuzzyMatchResult, LogEntry - file path: `lib/schemas.ts`
- [X] T006 Implement Upstash Redis wrapper with stale-while-revalidate in `lib/cache.ts` (get/set/ttl, and getWithStale helper) - file path: `lib/cache.ts`
- [X] T007 [P] Implement `lib/providers/withCache.ts` wrapper using `lib/cache.ts` and TTLs (quote:45s news:900s) - file path: `lib/providers/withCache.ts`
- [X] T008 Enhance `lib/logger.ts` with structured JSON logging fields (timestamp, level, requestId, userId, providerName, latency) - file path: `lib/logger.ts`
- [X] T009 Implement provider orchestration and fallback in `lib/providers/index.ts` with configurable env (`QUOTE_PRIMARY_PROVIDER`, `NEWS_PRIMARY_PROVIDER`, `PROVIDER_TIMEOUT_MS`) - file path: `lib/providers/index.ts`
- [X] T010 [P] Add env parsing/configuration support in `lib/providers/index.ts` and `api/line/webhook.ts` for provider selection - file paths: `lib/providers/index.ts`, `api/line/webhook.ts`

**Dependencies**: T005 → T007 & T009 depend on T005. T006 is independent and should finish before T007.

**Parallel Opportunities**: T005, T006, T008 can be implemented in parallel.

---

## Phase 3: User Story 1 - 查詢台股即時行情 (Priority: P1) 🎯 MVP ✅

**Story Goal**: 使用者可輸入股票代號/名稱查詢即時股價；系統使用 Flex Message 呈現行情卡片，支援 Provider fallback、快取與模糊比對。

**Independent Test**:
1. 發送 `股價 2330` → 在 3 秒內收到包含現價/漲跌/成交量的 Flex Message 卡片
2. 發送 `股價 台積電` → 模糊比對識別且信心分數 >80%，回傳股價卡片
3. 主要 Provider (TWSE) 失敗 → 自動切換 FinMind / fallback，並於 3 秒內回應
4. 45 秒內重複查詢同一股票 → 從快取讀取 (< 1s 回應)

### Implementation Tasks (Tests optional - add if requested by devs)

- [X] T011 [P] [US1] Implement Fuse.js-based fuzzy matcher, `lib/symbol.ts` with 80% confidence threshold and tests in `tests/unit/symbol.test.ts` - file paths: `lib/symbol.ts`, `tests/unit/symbol.test.ts`
- [X] T011-B [US1] Refactor fuzzy matcher in `lib/symbol.ts` to return multiple results (top 5) instead of single result - file path: `lib/symbol.ts`
- [X] T012 [P] [US1] Implement TWSE provider at `lib/providers/quote/twse.ts` with Zod validation using `lib/schemas.ts` - file path: `lib/providers/quote/twse.ts`
- [X] T013 [P] [US1] Implement FinMind provider at `lib/providers/quote/finMind.ts` with token auth + Zod validation - file path: `lib/providers/quote/finMind.ts`
- [x] T014 [US1] Update `api/line/webhook.ts` to handle `股價` command and reply with Flex Message
- [x] T015 [US1] Implement Yahoo Finance session flow (Cookie/Crumb) in `lib/providers/quote/yahooRapid.ts` (Optional backup)
- [x] T016 [US1] Create unit tests for quote providers in `tests/unit/providers/quote.test.ts`
- [X] T015 [P] [US1] Create stock quote Flex Message template `createStockQuoteMessage` in `lib/flex.ts` (include quick reply variation) - file path: `lib/flex.ts`
- [X] T015-B [US1] Add `createMultiMatchMessage` template to `lib/flex.ts` for ambiguous stock selection - file path: `lib/flex.ts`
- [X] T016 [US1] Implement webhook handler for `股價` command in `api/line/webhook.ts` including parsing, `resolveSymbol`, `getQuoteWithFallback` and reply with `createStockQuoteMessage` - file path: `api/line/webhook.ts`
- [X] T017 [US1] Add error handling for invalid symbol and low-confidence fuzzy matches in `api/line/webhook.ts` (provide helpful messages and quick replies) - file path: `api/line/webhook.ts`
- [X] T017-B [US1] Update `api/line/webhook.ts` to handle multiple fuzzy matches and reply with selection Flex Message - file path: `api/line/webhook.ts`
- [X] T018 [US1] Add stale cache handling and stale notice (「資料可能稍有延遲」) in `api/line/webhook.ts` and include tests in `tests/integration/webhook.test.ts` - file paths: `api/line/webhook.ts`, `tests/integration/webhook.test.ts`

**Dependencies**: Phase 2 must be complete before these tasks.

**Parallel Opportunities**: T011, T012, T013, T015 can be done in parallel. T014 depends on T012/T013; T016/T017/T018 depend on T014 & T015.

**Acceptance Criteria**:
- `股價 2330` returns quote within 3 seconds using TWSE or FinMind fallback
- `股價 台積電` returns quote via fuzzy match when confidence >= 80%
- Cache TTL & stale behavior functions as described
- Fallback occurs and is logged

---

## Phase 4: User Story 2 - 查詢產業新聞 (Priority: P2) ✅

**Story Goal**: 使用者可輸入關鍵字查詢相關新聞（公司或產業），回傳 3-5 則新聞卡片，支援 Provider fallback 與 15 分鐘快取。

**Independent Test**:
1. 發送 `新聞 台積電` → 回應 3-5 則新聞的 Flex Message 卡片
2. 發送 `新聞 半導體` → 回應該產業的新聞
3. Google News RSS 失敗 → 自動 fallback 至 Yahoo RSS
4. 15 分鐘內重複查詢 → 從快取讀取

### Tasks

- [X] T019 [P] [US2] Implement `lib/providers/news/googleRss.ts` with Zod validation (extract source/image) and tests in `tests/unit/providers/news.test.ts` - file paths: `lib/providers/news/googleRss.ts`, `tests/unit/providers/news.test.ts`
- [X] T020 [P] [US2] Implement `lib/providers/news/yahooRss.ts` with Zod validation (extract source/image) - file path: `lib/providers/news/yahooRss.ts`
- [X] T021 [US2] Implement `getIndustryNews(keyword, limit=5)` in `lib/providers/index.ts` with fallback behavior and `withCache` (900s TTL) - file path: `lib/providers/index.ts`
- [X] T022 [US2] Create news list Flex Message template `createNewsListMessage` in `lib/flex.ts` (UTC+8, hide img, source priority) and add unit tests `tests/unit/flex.test.ts` - file paths: `lib/flex.ts`, `tests/unit/flex.test.ts`
- [X] T023 [US2] Implement `新聞` command handler in `api/line/webhook.ts` (parse keyword, call `getIndustryNews`, reply with `createNewsListMessage` [UTC+8]) - file path: `api/line/webhook.ts`
- [X] T024 [US2] Add handling for overly broad keywords and return generic financial news or suggestion in `api/line/webhook.ts` - file path: `api/line/webhook.ts`

**Parallel Opportunities**: T019, T020, T022 can be done in parallel; T021 depends on T019/T020.

**Acceptance Criteria**: As per spec - 3-5 relevant items, fallback behavior, cache usage.

---

## Phase 5: User Story 3 - 查詢使用說明 (Priority: P3) ✅

**Story Goal**: 使用者可透過 `help`/`幫助` 查詢所有可用指令的說明與使用範例；當收到無法識別的指令時，系統建議`help`且提供快速按鈕自動填充數字輸入。

**Independent Test**: Send `help` and verify response; send `test123` and verify help suggestion with quick reply buttons.

### Tasks

- [X] T025 [P] [US3] Implement `createHelpMessage` in `lib/flex.ts` and add unit tests in `tests/unit/flex.test.ts` - file paths: `lib/flex.ts`, `tests/unit/flex.test.ts`
- [X] T026 [US3] Implement `help`/`幫助` handler in `api/line/webhook.ts` and ensure both aliases return the same Flex Message - file path: `api/line/webhook.ts`
- [X] T027 [US3] Implement unknown command handler in `api/line/webhook.ts` to detect numeric-only input and attach FR-013 quick replies (use input digits) - file path: `api/line/webhook.ts`
- [X] T028 [P] [US3] Implement quick reply factory that injects numeric-only input into quick reply messageAction payloads in `lib/flex.ts` - file path: `lib/flex.ts`

**Acceptance Criteria**:
- `help` returns informative Flex Message with `股價 <代號>`, `新聞 <關鍵字>`, `help` examples
- Unknown commands provide `help` suggestion and quick replies auto-populated with numeric input

---

## Phase 6: Polish & Cross-Cutting Concerns

**Goal**: Finalize tests, docs, monitoring, performance, and production readiness.

### Tasks

- [X] T029 [P] Add unit tests for fuzzy matching & symbol resolution in `tests/unit/symbol.test.ts` - file path: `tests/unit/symbol.test.ts`
- [X] T030 [P] Add unit tests for Flex Message templates in `tests/unit/flex.test.ts` - file path: `tests/unit/flex.test.ts`
- [X] T031 [P] Add integration test for end-to-end stock quote flow in `tests/integration/webhook.test.ts` - file path: `tests/integration/webhook.test.ts`
- [X] T032 [P] Add integration test for news query flow in `tests/integration/webhook.test.ts` - file path: `tests/integration/webhook.test.ts`
- [ ] T033 Implement performance/load test script to simulate 100 concurrent users at `scripts/load-test.ts` and document run steps in `specs/001-line-bot-commands/quickstart.md` - file paths: `scripts/load-test.ts`, `specs/001-line-bot-commands/quickstart.md`
- [X] T034 [P] Update `README.md` with setup, deployment, and troubleshooting sections relevant to this feature - file path: `README.md`
- [X] T035 [P] Add CI workflow to run unit & integration tests in `.github/workflows/test.yml` - file path: `.github/workflows/test.yml`
- [ ] T036 Add monitoring dashboard configuration for provider fallback and cache hit ratio in `lib/monitoring.ts` and `specs/001-line-bot-commands/plan.md` - file paths: `lib/monitoring.ts`, `specs/001-line-bot-commands/plan.md`
- [ ] T037 Add alert rules for SLO violations later in ops docs in `specs/001-line-bot-commands/checklists/requirements.md` - file path: `specs/001-line-bot-commands/checklists/requirements.md`
- [X] T038 [P] Implement Flex Message send failure handling and retry/error logging in `api/line/webhook.ts` - file path: `api/line/webhook.ts`
- [X] T039 [P] Add comprehensive error messages for all edge cases per spec in `api/line/webhook.ts` - file path: `api/line/webhook.ts`
- [ ] T040 Add tests for provider fallback latency tracing and <1s fallback expectation in `tests/integration/fallback.test.ts` - file path: `tests/integration/fallback.test.ts`
- [ ] T041 Add SLO validation script or CI step to verify that 95% of requests respond in <3s under test load at `scripts/slo-test.ts` - file path: `scripts/slo-test.ts`
- [ ] T042 [P] Final docs & cross-check: Validate `specs/001-line-bot-commands/quickstart.md`, `plan.md`, `README.md` and `spec.md` alignment - file paths: `specs/001-line-bot-commands/quickstart.md`, `specs/001-line-bot-commands/plan.md`, `README.md`, `specs/001-line-bot-commands/spec.md`

---

## Dependencies & Execution Order

**Phase Dependencies**:
- Setup (Phase 1) → Foundation (Phase 2) → User Stories (Phase 3/4/5) → Polish (Phase 6)

**User Story Dependencies**:
- US1 (P1): Depends on Phase 1 & 2
- US2 (P2): Depends on Phase 1 & 2 (can run in parallel with US1)
- US3 (P3): Depends on Phase 1 & 2 (can run in parallel with US1/US2)

**Implementation Strategy**: MVP-first (complete US1, validate, and deploy), then add US3 (help), then US2 (news), then polish and tests.

---

## Summary Report

- Total tasks generated: 42
- Tasks per story:
  - Phase 1: 4 ✅
  - Phase 2: 6 ✅
  - US1 (Phase 3): 8 ✅
  - US2 (Phase 4): 6 ✅
  - US3 (Phase 5): 4 ✅
  - Phase 6 (Polish): 14 (in progress)
- Parallel opportunities identified: many [P] tasks (Fmt: `- [ ] Txxx [P] ...`)
- Independent test criteria per story: Provided in each story's phase section above.
- Suggested MVP: US1 (股價 queries) only; then ship incrementally

---

## Format Validation (Checklist Enforcement)

All tasks in this document follow the required checklist format:
- Begin with `- [ ]` or `- [X]`
- Include sequential Task ID
- Include optional `[P]` markers (parallelizable)
- Include `[USx]` labels for tasks in user story phases
- Include concrete file paths for every task


