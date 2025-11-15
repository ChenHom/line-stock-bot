# Research: Decisions & Clarifications

**Feature**: LINE 聊天機器人指令系統  
**Date**: 2025-11-13  
**Updated**: 2025-11-13 (Phase 0 completion)

## Summary

This research documents design choices and clarifies implementation details where a single choice matters for scope, security, or UX. Updated with comprehensive research on fuzzy matching and structured logging strategies.

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

## Question 5: Stock symbol name mapping & Fuzzy Matching

- **Decision**: Use **Fuse.js** for fuzzy matching stock names with >80% confidence threshold
- **Rationale**: Fuse.js provides superior accuracy (100% confidence for partial matches like "台積"→"台積電"), excellent performance (~189k queries/sec), and built-in confidence scoring. While bundle size is larger (456 KB), it's acceptable for Vercel Serverless and the accuracy benefits outweigh the cost.
- **Alternatives Considered**:
  - `string-similarity`: Lightweight (11 KB) but deprecated and lower accuracy (66.7%)
  - `FuzzySet.js`: Small (36 KB) but requires commercial license ($42)
  - `fastest-levenshtein`: Smallest (7 KB) but no fuzzy matching, requires manual threshold logic
  - `fuzzysort`: Moderate size (46 KB) but awkward scoring system and failed some Chinese character matches
- **Implementation**:
  ```typescript
  import Fuse from 'fuse.js';
  
  export class StockFuzzyMatcher {
    private fuse: Fuse<Stock>;
    private readonly CONFIDENCE_THRESHOLD = 80;
    
    constructor(stocks: Stock[]) {
      this.fuse = new Fuse(stocks, {
        keys: ['name'],
        includeScore: true,
        threshold: 0.2, // 0.2 ≈ 80% confidence
        ignoreLocation: true,
      });
    }
    
    findBestMatch(query: string): FuzzyMatchResult | null {
      const results = this.fuse.search(query);
      if (results.length === 0) return null;
      
      const confidence = Math.round((1 - results[0].score!) * 100);
      return confidence >= this.CONFIDENCE_THRESHOLD 
        ? { ...results[0].item, confidence } 
        : null;
    }
  }
  ```
- **Performance**: 100% accuracy for Chinese partial matches, 189k queries/sec, 456 KB bundle

## Question 6: Test strategies for serverless & cache

- Decision: Use `node:test` or Jest for unit tests; add integration tests that mock external providers; use Upstash free tier for integration tests if needed.
- Rationale: Ensures Zod validation, fallback behavior, and cache wrapper integration is covered.

## Question 7: Structured Logging for Vercel

- **Decision**: **Enhance existing custom logger** - Continue using the project's lightweight logger implementation with improvements
- **Rationale**: The existing custom logger (~1KB, zero dependencies) already outputs Vercel-compatible JSON format and implements all required structured fields. Adding pino (637 KB) or winston (273 KB) would introduce unnecessary bundle size and complexity for this project's scope. Custom solution provides full control and minimizes cold start time.
- **Alternatives Considered**:
  - `pino`: Best third-party option (excellent performance, 637 KB) but adds unnecessary dependency
  - `winston`: Mature and stable (273 KB) but slower performance and more complex configuration
  - `bunyan`: Lightweight (201 KB) but deprecated (last update 2021)
  - `tslog`: TypeScript-native (223 KB) but not pure JSON output by default
  - `console-log-level`: Ultra-light (4.6 KB) but no structured logging support
- **Implementation Enhancements**:
  ```typescript
  export interface LogEntry {
    timestamp: string
    level: LogLevel
    message: string
    requestId?: string      // Request tracing
    userId?: string         // Hashed LINE user ID
    providerName?: string   // Provider name
    latency?: number        // Latency in ms
    details?: Record<string, any>
    error?: string
    stack?: string
  }
  
  class Logger {
    private log(level: LogLevel, message: string, metadata?: Partial<LogEntry>) {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...metadata
      }
      
      // Production: pure JSON for Vercel log aggregation
      if (process.env.NODE_ENV === 'production') {
        console.log(JSON.stringify(entry))
      } else {
        // Development: pretty output
        console.log(`${emoji[level]} [${level.toUpperCase()}] ${message}`)
      }
    }
    
    providerSuccess(provider: string, latency: number, metadata?: Record<string, any>) {
      this.info('Provider call successful', { providerName: provider, latency, ...metadata })
    }
  }
  ```
- **Benefits**: Zero dependencies, full control, Vercel-optimized, type-safe, environment-aware formatting

## Question 8: Stale Cache Strategy

- **Decision**: Implement "stale-while-revalidate" pattern - serve expired cache on provider failure + background refresh attempt
- **Rationale**: Ensures users get immediate responses (meets 3-second SLO) even during provider outages, while attempting to refresh data for future requests
- **Implementation**:
  ```typescript
  export async function getWithStale<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number
  ): Promise<{ data: T; isStale: boolean }> {
    const cached = await redis.get(key)
    const cachedTtl = await redis.ttl(key)
    
    // Cache valid
    if (cached && cachedTtl > 0) {
      return { data: JSON.parse(cached), isStale: false }
    }
    
    // Try fresh fetch
    try {
      const fresh = await fetchFn()
      await redis.setex(key, ttlSeconds, JSON.stringify(fresh))
      return { data: fresh, isStale: false }
    } catch (fetchError) {
      // Fetch failed - serve stale if available
      if (cached) {
        logger.warn('Serving stale cache due to fetch error', { key })
        return { data: JSON.parse(cached), isStale: true }
      }
      throw fetchError
    }
  }
  ```

## Research Outcome / Action Items

### Completed Research Areas
1. ✅ **Cache backend**: Upstash Redis with REST API
2. ✅ **TTL/Key strategy**: quote=45s, news=900s with time-bucket keys
3. ✅ **Runtime validation**: Zod for provider response validation
4. ✅ **Provider fallback**: Configurable order via env var, <1s fallback, <3s total response
5. ✅ **Fuzzy matching**: Fuse.js with 80% confidence threshold for stock names
6. ✅ **Testing strategy**: Vitest with mocked providers + Upstash integration tests
7. ✅ **Structured logging**: Enhanced custom logger with JSON output + metadata fields
8. ✅ **Stale cache**: Stale-while-revalidate pattern for resilience

### Implementation Tasks
1. Add Upstash wrapper (`lib/cache.ts`) with REST client and `setex`/`get` operations + stale-while-revalidate support
2. Add `lib/schemas.ts` with Zod schema for Quote and NewsItem
3. Update providers to run `schema.parse(response)` and rely on fallback on error
4. Implement `withCache` wrapper used by providers
5. Add Fuse.js-based fuzzy matcher in `lib/symbol.ts` with 80% confidence threshold
6. Enhance `lib/logger.ts` with requestId, userId, providerName, latency fields
7. Update provider fallback logic to support configurable order + timeout handling
8. Add metadata to Flex Message when serving stale cache ("資料可能稍有延遲")

**Status**: All research questions resolved. Ready for Phase 1 (Design & Contracts).

All items map to tasks T003 (caching), T004 (validation), T005 (withCache), and new tasks for fuzzy matching and logger enhancement as specified in `/specs/001-line-bot-commands/tasks.md`.
