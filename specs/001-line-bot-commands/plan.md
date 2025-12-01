# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement LINE Bot commands for stock quotes and news. Uses TWSE/FinMind for quotes, Google/Yahoo RSS for news. Features Redis caching with stale-while-revalidate, Zod validation, and Flex Message UI. Deployed on Vercel Serverless.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.x (Node.js latest LTS)
**Primary Dependencies**: `@line/bot-sdk`, `zod`, `@upstash/redis`, `tsx`, `node-fetch` (or native fetch), `vercel`
**Storage**: Upstash Redis (cache + stale-while-revalidate); no persistent DB
**Testing**: `vitest`
**Target Platform**: Vercel Serverless Functions
**Project Type**: Web / Serverless Function
**Performance Goals**: 95% requests < 3s
**Constraints**: Stateless, <10s execution time (Vercel limit), Memory limits
**Scale/Scope**: 100 concurrent users

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Serverless-First Architecture**: Designed as stateless Vercel functions.
- [x] **II. Provider Abstraction & Fallback**: Multiple providers (TWSE, FinMind, Yahoo) with fallback logic.
- [x] **III. Caching Strategy**: Upstash Redis with TTLs (45s/15m) and stale-while-revalidate.
- [x] **IV. TypeScript Type Safety**: Zod validation for all external data; strict TS config.
- [x] **V. Flex Message UI**: Structured Flex Messages for all responses.

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
	line/
		webhook.ts
lib/
	cache.ts
	flex.ts
	logger.ts
	schemas.ts
	symbol.ts
	types.ts
	providers/
		index.ts
		withCache.ts
		news/
			googleRss.ts
			rssUtils.ts
			yahooRss.ts
		quote/
			finMind.ts
			twse.ts
			yahooRapid.ts
tests/
	integration/
	unit/
```

**Structure Decision**: Single project structure with Vercel Serverless Functions (`api/`) and shared logic in `lib/`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
