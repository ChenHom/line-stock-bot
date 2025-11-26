# Implementation Plan: LINE 聊天機器人指令系統

**Branch**: `001-line-bot-commands` | **Date**: 2025-11-19 | **Spec**: `specs/001-line-bot-commands/spec.md`
**Input**: Feature specification from `/specs/001-line-bot-commands/spec.md`

**Note**: This plan is produced via `/speckit.plan` and tracks the artifacts required for implementation.

## Summary

Implement the LINE Stock Bot core commands (`help`, `股價`, `新聞`) on Vercel Serverless using TypeScript 5.x. Stock quotes rely on TWSE as the primary provider with FinMind `TaiwanStockTick` as the new fallback, while news continues to use Google RSS primary and Yahoo RSS backup. Caching (Upstash Redis), Fuse.js fuzzy matching, Zod validation, and Flex Message templates ensure responses stay under the 3-second SLO even when providers degrade; structured logging plus monitoring captures fallback events.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 18 LTS  
**Primary Dependencies**: `@line/bot-sdk`, `zod`, `@upstash/redis`, `Fuse.js`, FinMind REST (`TaiwanStockTick`), `node-fetch`/global `fetch`, custom logger/monitoring utilities  
**Storage**: Upstash Redis (REST) for 45s quote cache + 15m news cache; no persistent DB  
**Testing**: Vitest (unit + integration) with mocked fetch + cache harness  
**Target Platform**: Vercel Serverless Functions (api/line/webhook)  
**Project Type**: Single serverless TypeScript service (api + lib + tests)  
**Performance Goals**: 95% of responses <3s; provider fallback <1s; cache hit rate ≥80%  
**Constraints**: Stateless execution, no local persistence, LINE webhook timeout 3s, FinMind token rate limits, Redis availability fallback  
**Scale/Scope**: ~100 concurrent users, 2 provider families (quotes, news), <10 Flex templates, <20 TypeScript modules

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Serverless-First Architecture** → PASS. Webhook + helpers remain stateless serverless functions on Vercel; no background workers planned.
- **II. Provider Abstraction & Fallback** → PASS. Quote providers: TWSE primary + FinMind fallback with configurable order; news providers unchanged (Google RSS → Yahoo RSS). Abstraction stays in `lib/providers` with metrics/logging.
- **III. Caching Strategy** → PASS. Upstash Redis with existing 45s / 900s TTL buckets via `withCache`; stale-while-revalidate preserved.
- **IV. TypeScript Type Safety** → PASS. All providers validated via Zod schemas, TypeScript strict mode already enabled.
- **V. Flex Message UI** → PASS. Responses continue to use `lib/flex.ts` templates for quotes/news/help with stale indicators.

No constitution violations detected → **GATE PASS**.

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
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
api/
├── ping.ts
└── line/
  └── webhook.ts          # LINE webhook handler (serverless entrypoint)

lib/
├── cache.ts               # Upstash Redis helper
├── flex.ts                # Flex message templates
├── logger.ts              # Structured logger
├── monitoring.ts          # Metrics hooks
├── symbol.ts              # Fuzzy symbol resolution
├── providers/
│   ├── index.ts           # Provider orchestration + fallback
│   ├── withCache.ts       # Cache decorator
│   ├── quote/
│   │   ├── twse.ts        # Primary quote provider
│   │   └── finMind.ts     # NEW fallback provider (TaiwanStockTick)
│   └── news/
│       ├── googleRss.ts   # Primary news provider
│       └── yahooRss.ts    # Fallback news provider

tests/
├── setup.ts
├── integration/
│   ├── cache.test.ts
│   └── webhook.test.ts
└── unit/
  └── providers/
    ├── cache.test.ts
    ├── fallback.test.ts
    ├── news.test.ts
    └── quote.test.ts
```

**Structure Decision**: Single TypeScript serverless project. All runtime code lives under `api/` (entrypoints) and `lib/` (shared logic/providers). Tests mirrored under `tests/` (unit + integration). No separate frontend/backends or mobile targets are needed.

### Constitution Check (Post-Design)

Design artifacts (data model, contracts, quickstart) keep the project aligned with all five principles. FinMind fallback continues to respect provider abstraction, caching TTLs unchanged, and no additional stateful services were introduced → **GATE PASS** reaffirmed.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _None_ |  |  |
