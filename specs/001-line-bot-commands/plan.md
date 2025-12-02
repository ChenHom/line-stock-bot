# Implementation Plan: LINE 聊天機器人指令系統

**Branch**: `001-line-bot-commands` | **Date**: 2025-12-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-line-bot-commands/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

實作 LINE 聊天機器人的核心指令系統，包含股價查詢、新聞查詢與使用說明。系統採用 Serverless 架構，整合多個外部資料來源 (TWSE, FinMind, Yahoo, Google News) 並實作自動 fallback 機制。使用 Upstash Redis 進行快取以提升效能與可靠性，並透過 Flex Message 提供豐富的視覺化回應。

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 18+ LTS)
**Primary Dependencies**: `@line/bot-sdk`, `zod`, `@upstash/redis`, `fuse.js`, `cheerio` (for scraping if needed), `winston` (logging)
**Storage**: Upstash Redis (Cache only, TTL 45s/15m)
**Testing**: Vitest (Unit & Integration)
**Target Platform**: Vercel Serverless Functions
**Project Type**: Webhook / API
**Performance Goals**: 95% requests < 3s; Cache hit rate > 80%
**Constraints**: Stateless execution, Vercel function timeout (10s default), Memory 1024MB
**Scale/Scope**: Support ~100 concurrent users; ~1000 requests/day initially

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Serverless-First Architecture**: Designed as stateless Vercel functions.
- [x] **II. Provider Abstraction & Fallback**: Multi-provider design (TWSE/FinMind, Google/Yahoo) with fallback logic.
- [x] **III. Caching Strategy**: Redis caching with specific TTLs (45s/15m) implemented.
- [x] **IV. TypeScript Type Safety**: Full TypeScript with Zod validation for external APIs.
- [x] **V. Flex Message UI**: All responses use Flex Message templates.

## Project Structure

### Documentation (this feature)

```text
specs/001-line-bot-commands/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── webhook.md       # LINE Webhook payload definition
│   └── providers.md     # Internal Provider Interface definition
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
api/
└── line/
    └── webhook.ts       # Main entry point for LINE webhook

lib/
├── providers/           # Provider implementations
│   ├── index.ts         # Factory/Strategy selection
│   ├── base.ts          # Abstract base class / Interface
│   ├── twse.ts
│   ├── finmind.ts
│   ├── yahoo.ts
│   └── google-news.ts
├── flex/                # Flex Message templates
│   ├── quote.ts
│   ├── news.ts
│   └── help.ts
├── cache.ts             # Redis wrapper
├── logger.ts            # Structured logging
└── types.ts             # Shared types & Zod schemas

tests/
├── unit/
│   ├── providers/
│   └── flex/
└── integration/
    └── webhook.test.ts
```

**Structure Decision**: Single project structure optimized for Vercel Serverless functions. `api/` contains the entry point, while `lib/` houses the core logic, providers, and utilities to keep the handler clean.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

N/A - Fully compliant with Constitution.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
