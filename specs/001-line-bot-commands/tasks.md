---
description: "Task list for implementing LINE bot commands and required infra adjustments"
---

# Tasks: LINE 聊天機器人指令系統

**Input**: Design documents from `/specs/001-line-bot-commands/spec.md` and `/specs/001-line-bot-commands/architecture-assessment.md`
**Prerequisites**: plan.md (recommended), spec.md

## Phase 1: Setup & Critical Fixes (Blocking)

**Goal**: Resolve security and infra gaps so development can proceed safely.

- [X] T001 [P] [Setup] Fix Webhook signature verification logic in `api/line/webhook.ts`
  - Files: `api/line/webhook.ts`
  - Acceptance: Webhook requests with correct signature are accepted, requests with incorrect signature are rejected; test should verify rejection when signature missing or invalid.

- [X] T002 [P] [Infra] Add Upstash Redis dependency and environment configuration
  - Files: `package.json` (update optional dev instructions), `.env.local.example` (add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`), `README.md` or docs
  - Acceptance: Local dev instructions added, environment variables documented.

- [X] T003 [P] [Infra] Create `lib/cache.ts` and `lib/providers/withCache.ts` implementing Redis wrapper and TTL logic
  - Files: `lib/cache.ts`, `lib/providers/withCache.ts`
  - Acceptance: `withCache` returns cached data when present, sets cache on writes; fallback to source when Redis fails; unit tests cover hit/miss and failure path.

## Phase 2: Core Reliability & Safety

**Goal**: Add validation, logging, and integrate caching into providers.

- [X] T004 [P] [Validation] Create `lib/schemas.ts` with Zod schemas for `Quote` and `NewsItem` and add `.parse()` in provider responses
  - Files: `lib/schemas.ts`, `lib/providers/quote/*`, `lib/providers/news/*`
  - Acceptance: Invalid responses cause provider to throw, triggering fallback; tests verify validation rejects malformed sample payloads.

- [X] T005 [P] [Providers] Update `lib/providers/index.ts` and individual providers to use `withCache` wrapper
  - Files: `lib/providers/index.ts`, `lib/providers/quote/*`, `lib/providers/news/*`
  - Acceptance: Repeated identical requests hit cache and do not call external APIs; tests simulate repeated calls to ensure cache set/get used.
  - Notes: Make provider order configurable and documented; providers should respect `QUOTE_PRIMARY_PROVIDER` env var and tests should verify both TWSE-primary and Yahoo-primary behaviors.

- [X] T006 [P] [Logging] Add `lib/logger.ts` and replace `console.*` with structured logging (fallback events, cache hit/miss, API errors)
  - Files: `lib/logger.ts`, `lib/providers/*`, `api/line/webhook.ts`
  - Acceptance: Logs are emitted in JSON with keys: `event`, `level`, `source`, `details`; tests assert structured logs contain expected keys.

 - [X] T017 [P] [Ops] Add monitoring for cache hit/miss ratio and fallback rates (move from optional to required)
   - Files: `lib/logger.ts`, `lib/providers/*`, `scripts/monitoring/` or simple dashboard config
   - Acceptance: Emit metrics for cache hit / miss and fallback events; add a basic dashboard/metrics output in QA environment and tests that assert metrics are emitted.

## Phase 3: Feature Implementation & UX

**Goal**: Ensure all commands fully implement spec and edge cases.

- [X] T007 [P] [Feature] Implement stock name resolution `resolveSymbol()` in `lib/symbol.ts` and wire into webhook
  - Files: `lib/symbol.ts`, `api/line/webhook.ts`
  - Acceptance: `股價 台積電` resolves to `2330` and result is shown; unit test for mapping and fallback path if unknown.

- [X] T008 [P] [Feature] Add command alias support for `幫助` in webhook and ensure `help` reply uses Flex templates
  - Files: `api/line/webhook.ts`, `lib/flex.ts`
  - Acceptance: `幫助` returns the same content as `help`; verify with unit/integration test.

- [X] T009 [P] [Feature] Ensure Flex Message templates are reused and cover new status messages (cache hit, fallback) with friendly UX
  - Files: `lib/flex.ts`, `api/line/webhook.ts`
  - Acceptance: Messages present for normal flow, cache-hit response is not intrusive to UX.

## Phase 4: Testing & Validation

**Goal**: Add unit tests, integration tests, and a simple load test script.

- [X] T010 [P] [Test] Unit tests for provider logic (quote/news providers) to verify Zod validation, fallback, and cache wrapper
  - Files: `tests/unit/providers/*`
  - Acceptance: All unit tests pass locally.
  - **Status**: ✅ Complete (28/28 tests passing)

- [X] T011 [P] [Test] Integration tests for webhook handling commands including signature verification, command parsing, and reply formatting
  - Files: `tests/integration/webhook.test.ts`
  - Acceptance: Integration tests emulate LINE webhook and verify replies and statuses.
  - **Status**: ✅ Complete (14/14 tests passing)

- [X] T012 [P] [Test] Caching behavior tests that simulate repeated queries and verify < 1s response for cached requests
  - Files: `tests/integration/cache.test.ts`
  - Acceptance: Repeated query uses cache, response time verified.
  - **Status**: ✅ Complete (8/8 tests passing)

- [ ] T013 [P] [Perf] Add a simple load test script to simulate 100 concurrent requests and ensure no major performance regressions
  - Files: `scripts/load-test.sh` or `scripts/load-test.js`
  - Acceptance: Load test runs successfully and reports basic metrics.

## Phase 5: Docs & Release

**Goal**: Finalize docs, update spec and checklist, release notes.

- [ ] T014 [P] [Docs] Update `README.md` with environment variables, deployment notes, and Upstash configuration
  - Files: `README.md`, `.env.local.example`
  - Acceptance: README includes instructions for setting `UPSTASH` variables and testing locally.

- [ ] T015 [P] [CI] Add unit/integration tests to CI workflow (if present) and add a task to validate Webhook signature and cache on merge
  - Files: `.github/workflows/*` or `vercel.json` for deployment checks
  - Acceptance: CI runs the tests and blocks merge on test failures.

## Phase 6: Optional Enhancements

- [ ] T016 [P?] [UX] Add fallback notice (non-intrusive) when fallback used to ensure transparency
- [ ] T017 [P?] [Ops] Add monitoring for cache hit/miss ratio and fallback rates
- [ ] T018 [P?] [Ops] Add alerts for high fallback rate or provider errors
 - [ ] T020 [P] [Observability] Instrument latency telemetry and SLO checks for webhook and provider calls
   - Files: `lib/logger.ts`, `lib/providers/*`, `api/line/webhook.ts`, `tests/integration/*`
   - Acceptance: Telemetry emits duration metrics for webhook requests and provider calls; SLO checks or simple thresholds added to CI tests and documented in `quickstart.md`.

 - [ ] T021 [P] [Test] Add fallback latency tests and assertions to verify fallback behavior (<1s switch, <3s user reply)
   - Files: `tests/integration/fallback.test.ts`, `scripts/load-test.sh`
   - Acceptance: Simulate primary provider failure and assert system switches to fallback within 1s (for provider call), and that the webhook responds with an alternate content or friendly error within 3s.

## Additional Tasks

- [X] T019 [P] [Providers] Make provider order configurable with env var `QUOTE_PRIMARY_PROVIDER` and add tests
  - Files: `lib/providers/index.ts`, `lib/providers/quote/*`, `specs/001-line-bot-commands/quickstart.md`
  - Acceptance: The code respects `QUOTE_PRIMARY_PROVIDER` env var; default is `twse`; tests verify both configurations produce correct fallback behavior and cache keys.

**Notes**:
- Prioritize T001-T006 in the first iteration
- Tasks are written with file paths for quick PR references
- Each task MUST reference the acceptance test and be independently testable


---

**Structure Decision**: Single project; source code under `/api`, logic under `/lib`, tests under `/tests`.


