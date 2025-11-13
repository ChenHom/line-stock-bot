# Research: Decisions & Clarifications

**Feature**: LINE 聊天機器人指令系統  
**Date**: 2025-11-13

## Summary

This research documents design choices and clarifies implementation details where a single choice matters for scope, security, or UX.

## Question 1: Cache backend choice (Upstash Redis)

- Decision: Use Upstash Redis (REST API) as the canonical caching layer.
- Rationale: Serverless-friendly (REST), simple TTL support, managed service with low ops overhead, and well-suited for short-lived caches.
- Alternatives: In-memory caching (invalid for serverless), Cloudflare Workers KV (global but not good TTL granularity), managed Redis (higher ops costs).

## Question 2: TTL/Key Strategy

- Decision: Use TTLs: quote=45s, news=900s (15m); use time-bucket keys for deterministic invalidation.
- Key Format: `quote:{symbol}:{bucket}` and `news:{keyword}:{bucket}` where `bucket = floor(now/ttl)`
- Rationale: Minimal chance of stale cache and simple eviction without needing explicit `del` calls.

## Question 3: Runtime validation library

- Decision: Use `zod` for runtime schema validation on Provider responses.
- Rationale: Already present in project; small, TypeScript-friendly, easy to integrate with parse() semantics.

## Question 4: Provider fallback order & behavior

- Decision: Keep current fallback order: Yahoo → TWSE for quotes, Google News RSS → Yahoo RSS for news. Fallback should be triggered on fetch errors, invalid responses (per Zod), timeouts, and rate-limiting (416/403/429 as errors).
- Rationale: Yahoo/Google have broader coverage; TWSE is authoritative for specific TW listings but may not cover all queries.

*Clarification update:* Provider order is configurable via environment variable `QUOTE_PRIMARY_PROVIDER` and defaults to `twse`. The fallback behavior is expected to be quick (switching to backup provider within ~1s where feasible) and always provide a reply to the user within 3s.

## Question 5: Stock symbol name mapping

- Decision: Create a small mapping table in `lib/symbol.ts`. Provide an extensible function `resolveSymbol` that:
  - Trims input
  - If a 4-digit numeric code → returns that code
  - Else, check mapping table with normalized company names
- Rationale: Mapping is manageable for a targeted market (TWSE) and allows common name queries.

## Question 6: Test strategies for serverless & cache

- Decision: Use `node:test` or Jest for unit tests; add integration tests that mock external providers; use Upstash free tier for integration tests if needed.
- Rationale: Ensures Zod validation, fallback behavior, and cache wrapper integration is covered.

## Research Outcome / Action Items

1. Add Upstash wrapper (`lib/cache.ts`) with REST client and `setex`/`get` operations.
2. Add `lib/schemas.ts` with Zod schema for Quote and NewsItem.
3. Update providers to run `schema.parse(response)` and rely on fallback on error.
4. Implement `withCache` wrapper used by providers.
5. Add name-to-code mapping and `resolveSymbol` API in `lib/symbol.ts`.

All items were resolved and will be implemented via tasks T003, T004, and T005 as specified in `/specs/001-line-bot-commands/tasks.md`.
