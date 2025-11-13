# Implementation Plan: LINE 聊天機器人指令系統

**Branch**: `001-line-bot-commands` | **Date**: 2025-11-13 | **Spec**: `/specs/001-line-bot-commands/spec.md`
**Input**: Feature specification from `/specs/001-line-bot-commands/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement the core LINE chat commands for stock quote (`股價`), industry news (`新聞`), and `help` with reliable, low-latency responses by adopting a serverless-first architecture on Vercel, modular provider abstraction with automatic fallback, and an Upstash Redis caching layer. Use TypeScript plus Zod runtime validation to improve resilience and developer ergonomics. Prioritize security (webhook signature verification) and availability (fallbacks, cache-based reduced API calls).

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.x (Node.js latest LTS)  
**Primary Dependencies**: `@line/bot-sdk`, `zod`, `@upstash/redis`, `tsx`, `node-fetch` (or global fetch), `vercel`  
**Storage**: Upstash Redis for caching (no persistent DB required for this feature)  
**Testing**: Jest/Tap or Node test runner with integration and unit suites  
**Target Platform**: Vercel Serverless Functions (Node runtime)  
**Project Type**: Single serverless project with `api/` serverless endpoints and `lib/` shared logic  
**Performance Goals**: Webhook response < 3s for 95% of requests; cache hit-rate >80%  
**Performance Goals**: Webhook SLO: 95% of requests respond < 3s; cache hit-rate >80%; provider fallback switch < 1s when primary fails
**Constraints**: Vercel Serverless environment cold starts and timeouts; minimal memory footprint and no local disk persistence  
**Scale/Scope**: Expected to support 100+ simultaneous users; scale to thousands with Vercel autoscaling

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution Principles to validate prior to Phase 0:  
- Serverless-First Architecture: endpoints MUST be stateless serverless functions (OK)  
- Provider Abstraction & Fallback: provider modules MUST expose standardized interfaces and fallback (OK)  
- Caching Strategy: responses MUST be cached per TTL (NEEDS WORK — implement Upstash Redis wrapper)  
- TypeScript Type Safety: runtime validation with Zod MUST be added (NEEDS WORK)  
- Flex Message UI: Flex Message templates MUST be centralized in `lib/flex.ts` (OK)

Current blockers to pass Constitution Check:
- Implement `lib/cache.ts` & `lib/providers/withCache.ts` (FR-007)  
- Add Zod runtime validation in `lib/schemas.ts` and use it in providers (Principle IV)
Current blockers to pass Constitution Check:
- Implement `lib/cache.ts` & `lib/providers/withCache.ts` (FR-007)  
- Add Zod runtime validation in `lib/schemas.ts` and use it in providers (Principle IV)
- Instrument telemetry & SLO checks for webhook and provider calls (T020)  
- Add monitoring for cache hit/miss ratio and fallback rates (T017)  

Provider priority: default TWSE, configurable
- Default behavior: use TWSE as the primary data source for quote queries; fallback to Yahoo if TWSE fails or returns invalid data. Make provider order configurable via environment variable (`QUOTE_PRIMARY_PROVIDER=twse|yahoo`) and support per-feature override. Document provider configuration in `quickstart.md` and in `lib/providers/index.ts`.

If those items are addressed in Phase 0 research and task T003/T004 are executed in Phase 1, proceed with design.

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
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: Single serverless project using `api/` for webhook endpoints and `lib/` for providers, templates, and utilities. Tests are under `tests/` and specs under `/specs/001-line-bot-commands/`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
