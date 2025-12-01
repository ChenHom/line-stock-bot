# Data Model

**Feature**: LINE 聊天機器人指令系統  
**Updated**: 2025-11-19 (Phase 1 refresh)

## Core Entities

### Stock Quote (Quote)
- `symbol` (string) - canonical market symbol, e.g., `2330.TW` or `2330`
- `marketSymbol` (string) - full market symbol for API calls
- `name` (string) - company name (optional)
- `price` (number)
- `change` (number) - price change absolute value
- `changePercent` (number) - percent change
- `open`, `high`, `low`, `prevClose` (numbers, optional)
- `volume` (number, optional) - trading volume
- `currency` (string, optional)
- `marketTime` (string iso 8601, optional)
- `delayed` (boolean) - whether data is delayed

Validation Rules:
- `symbol` MUST be non-empty string
- `price` MUST be a finite number >= 0
- `changePercent` MUST be finite number
- `volume` MUST be non-negative if present

### News Item
- `title` (string)
- `url` (string) - valid URL
- `source` (string, optional) - Publisher/Author prioritized, fallback to domain
- `publishedAt` (string, ISO 8601, optional)
- `imageUrl` (string, optional) - Preview image URL

Validation Rules:
- `title` MUST be non-empty
- `url` MUST be a valid URL (https://)
- `publishedAt` MUST be valid ISO 8601 if present
- `imageUrl` MUST be valid URL if present

### Command
- `cmd` (enum): `price`, `news`, `help`
- `args` (string) - user query parameters (stock symbol/name, news keyword, etc.)
- `rawInput` (string) - original user text used for logging + quick reply context

Parsing Rules:
- Command extracted from message text (e.g., "股價 2330" → cmd: `price`, args: "2330")
- Trim whitespace from args
- Case-insensitive command matching
- Numeric-only `rawInput` (e.g., `3017`) is treated as an unknown command but persisted so quick replies can reuse it

### Fuzzy Match Result
- `symbol` (string) - matched stock symbol
- `name` (string) - matched stock name
- `confidence` (number) - confidence score 0-100
- `score` (number, optional) - raw Fuse.js score (0=perfect, 1=worst)

Validation Rules:
- `confidence` MUST be between 0-100
- Returns null if confidence < 80% threshold

### Cache Entry
- `key` (string) - cache key pattern
- `value` (string) - JSON-serialized entity
- `ttl` (number) - time to live in seconds
- `isStale` (boolean) - whether data is expired but served as fallback

TTL Rules:
- Quote: 45 seconds
- News: 900 seconds (15 minutes)
- Stale data can be served when providers fail

### Provider Event / Log Entry
- `timestamp` (string, ISO 8601) - when event occurred
- `level` (enum): `debug`, `info`, `warn`, `error`
- `message` (string) - human-readable log message
- `requestId` (string, optional) - unique request identifier for tracing
- `userId` (string, optional) - hashed LINE user ID
- `providerName` (string, optional) - provider name (e.g., `twse`, `finmind`, `google-rss`)
- `latency` (number, optional) - operation latency in milliseconds
- `details` (object, optional) - additional context data
- `error` (string, optional) - error message
- `stack` (string, optional) - error stack trace

Log Levels:
- `debug`: Cache hits/misses, detailed flow
- `info`: Provider success, webhook requests
- `warn`: Provider failures, stale cache served, fallback triggered
- `error`: Critical failures, validation errors

## Validation: Zod Schemas

Create Zod schemas for runtime validation:

```typescript
import { z } from 'zod'

export const QuoteSchema = z.object({
  symbol: z.string().min(1),
  marketSymbol: z.string(),
  name: z.string().optional(),
  price: z.number().finite().nonnegative(),
  change: z.number().finite(),
  changePercent: z.number().finite(),
  open: z.number().finite().optional(),
  high: z.number().finite().optional(),
  low: z.number().finite().optional(),
  prevClose: z.number().finite().optional(),
  volume: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  marketTime: z.string().datetime().optional(),
  delayed: z.boolean().default(false)
})

export const NewsItemSchema = z.object({
  title: z.string().min(1),
  url: z.string().url().startsWith('https://'),
  source: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  description: z.string().optional()
})

export const FuzzyMatchResultSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  confidence: z.number().min(0).max(100),
  score: z.number().min(0).max(1).optional()
})

export const LogEntrySchema = z.object({
  timestamp: z.string().datetime(),
  level: z.enum(['debug', 'info', 'warn', 'error']),
  message: z.string().min(1),
  requestId: z.string().optional(),
  userId: z.string().optional(),
  providerName: z.string().optional(),
  latency: z.number().nonnegative().optional(),
  details: z.record(z.any()).optional(),
  error: z.string().optional(),
  stack: z.string().optional()
})

export type Quote = z.infer<typeof QuoteSchema>
export type NewsItem = z.infer<typeof NewsItemSchema>
export type FuzzyMatchResult = z.infer<typeof FuzzyMatchResultSchema>
export type LogEntry = z.infer<typeof LogEntrySchema>
```

## Storage Model

### Caching Layer (Upstash Redis)
- **Technology**: Upstash Redis REST API
- **Purpose**: Temporary storage for quote/news data with TTL-based expiration

### Key Patterns
- **Quote cache**: `quote:{symbol}:{bucket}` where `bucket = floor(timestamp / 45)`
  - Example: `quote:2330:1699900000`
  - TTL: 45 seconds
  - Stores: JSON-serialized `Quote` object
  
- **News cache**: `news:{keyword}:{bucket}` where `bucket = floor(timestamp / 900)`
  - Example: `news:台積電:1699900000`
  - TTL: 900 seconds (15 minutes)
  - Stores: JSON-serialized array of `NewsItem[]`

### Cache Operations
- `get(key)`: Retrieve cached value
- `setex(key, ttl, value)`: Store value with TTL
- `ttl(key)`: Check remaining TTL (-1 if expired, -2 if not exists)

### Stale-While-Revalidate Pattern
1. Check cache with `get(key)` + `ttl(key)`
2. If valid (TTL > 0): return cached data
3. If expired or missing: try fetch from provider
4. If fetch fails AND expired cache exists: return stale data + log warning
5. If fetch succeeds: update cache with fresh data

### No Persistent Storage
- No database required
- All data is transient (cached from external APIs)
- Stock symbol mappings stored in code (`lib/symbol.ts`)

## Data Flow

### Quote Query Flow
```
User Input (stock name/code) 
  → Fuzzy Match (if name) → Stock Symbol
  → Check Cache (quote:symbol:bucket)
  → [Cache Hit] Return cached Quote
  → [Cache Miss] Provider Fallback Chain
     → TWSE API → Parse + Validate (Zod)
     → [Success] Store in Cache + Return
     → [Fail] Yahoo API → Parse + Validate
     → [Success] Store in Cache + Return
     → [Fail] Check Stale Cache
        → [Exists] Return stale + warning
        → [Not Exists] Return error message
```

### News Query Flow
```
User Input (keyword)
  → Normalize keyword
  → Check Cache (news:keyword:bucket)
  → [Cache Hit] Return cached NewsItem[]
  → [Cache Miss] Provider Fallback Chain
     → Google News RSS → Parse + Validate (Zod)
     → [Success] Store in Cache + Return top 3-5
     → [Fail] Yahoo RSS → Parse + Validate
     → [Success] Store in Cache + Return top 3-5
     → [Fail] Check Stale Cache
        → [Exists] Return stale + warning
        → [Not Exists] Return error message
```

## State Transitions

### Provider Fallback States
- `Idle` → Provider not yet called
- `Attempting` → Calling primary provider (TWSE/Google)
- `Success` → Primary provider returned valid data
- `Fallback` → Primary failed, trying secondary (Yahoo)
- `Partial Success` → Secondary provider succeeded
- `All Failed` → All providers failed, checking stale cache
- `Stale Served` → Returned expired cache data with warning
- `Total Failure` → No cache available, return error message

### Cache States
- `Valid` → TTL > 0, data fresh
- `Expired` → TTL ≤ 0, data stale but still in Redis
- `Missing` → Key not found in Redis
- `Error` → Redis connection/operation failed

### Quick Reply Action
- `label` (string) - button text displayed to the user (e.g., `查股價`)
- `text` (string) - command text injected back into the chat when tapped (e.g., `股價 3017`)
- `sourceInput` (string) - last numeric input captured from the user; logged for observability
- `type` (string, literal `message`) - LINE quick reply action type

Validation Rules:
- `label` MUST be <= 20 characters per LINE requirement
- `text` MUST include the canonical keyword followed by the numeric input (FR-013)
- `sourceInput` MUST match `/^\d{1,6}$/` before reuse; otherwise quick replies fall back to generic help buttons

### Unrecognized Numeric Input Flow
- `DetectedRawNumber` → Webhook parses message, detects it only contains digits
- `ClarificationReply` → Help Flex message renders with quick replies that inject `股價 {digits}` and `新聞 {digits}`
- `UserSelectsQuote` → Quick reply sends `股價 {digits}` back to webhook → standard quote flow resumes
- `UserSelectsNews` → Quick reply sends `新聞 {digits}` back to webhook → news flow resumes


