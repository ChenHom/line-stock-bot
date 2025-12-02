# Contract: Provider Functions (Internal)

**Updated**: 2025-11-19 (Phase 1 refresh)

These contracts describe the intended API for provider modules used by the feature.

## getQuoteWithFallback(symbol: string, options?: FetchOptions): Promise<Quote>
- **Input**: 
  - `symbol` - a canonical symbol string (e.g., `2330`, `2330.TW`)
  - `options` - optional { requestId?, timeoutMs? }
- **Behavior**: 
  - Attempts to fetch quote from configurable primary provider (default: TWSE, configurable via `QUOTE_PRIMARY_PROVIDER` env var)
  - Falls back to secondary provider (FinMind `TaiwanStockTick`) on error, timeout, invalid schema, or rate limiting
  - Validates response against `QuoteSchema` (Zod)
  - Logs provider attempts, failures, and fallback events with latency
- **Output**: `Quote` as defined in `data-model.md`
- **Error Handling**: 
  - Throws error if both providers fail and no stale cache available
  - Returns stale cache data with `isStale: true` flag if all providers fail but cache exists
- **Caching**: Wrapped with `withCache` to cache results for `45s`
- **SLO**: Provider fallback should complete within ~1s; total operation < 3s

## getIndustryNews(keyword: string, limit: number = 5, options?: FetchOptions): Promise<NewsItem[]>
- **Input**: 
  - `keyword` - search keyword (supports Traditional Chinese)
  - `limit` - number of results (default: 5)
  - `options` - optional { requestId?, timeoutMs? }
- **Behavior**: 
  - Attempts to fetch news from primary provider (Google News RSS)
  - Falls back to secondary provider (Yahoo RSS)
  - Validates each NewsItem against `NewsItemSchema` (Zod)
  - Filters invalid items, logs validation failures
  - Logs provider attempts, failures, and fallback events
- **Output**: `NewsItem[]` as defined in `data-model.md` (length <= limit)
- **Error Handling**: 
  - Throws error if both providers fail and no stale cache available
  - Returns stale cache data with `isStale: true` flag if all providers fail but cache exists
- **Caching**: Wrapped with `withCache` to cache results for `900s` (15 min)
- **SLO**: Provider fallback < 1s; total operation < 3s

## withCache<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<{ data: T; isStale: boolean }>
- **Input**: 
  - `key` - cache key pattern (e.g., `quote:2330:bucket`)
  - `ttlSeconds` - time to live (45 for quotes, 900 for news)
  - `fetcher` - async function to retrieve fresh data
- **Behavior**: 
  - Checks cache with `redis.get(key)` + `redis.ttl(key)`
  - If cache valid (TTL > 0): returns cached data with `isStale: false`
  - If cache expired/missing: calls `fetcher()` to get fresh data
  - If `fetcher()` succeeds: stores in cache with `setex()`, returns with `isStale: false`
  - If `fetcher()` fails AND expired cache exists: returns stale data with `isStale: true` + warning log
  - If `fetcher()` fails AND no cache: throws error
- **Output**: `{ data: T, isStale: boolean }`
- **Failure Mode**: 
  - On Redis connection errors: bypasses cache, calls `fetcher()` directly (stateless degradation)
  - Logs cache errors at `warn` level with operation details
- **Logging**: Logs cache hits, misses, errors, and stale-serve events

## resolveSymbol(input: string): Promise<FuzzyMatchResult[] | string | null>
- **Input**: `input` - either a stock code (`\d{4}`) or company name
- **Behavior**: 
  - If input matches numeric pattern (`\d{4}`): returns as-is (symbol code)
  - Otherwise: uses Fuse.js fuzzy matcher on stock name mapping
  - Calculates confidence score (0-100%)
  - Returns list of matches sorted by confidence
- **Output**: 
  - Stock code (string) if exact numeric match
  - `FuzzyMatchResult[]` (list of matches) if fuzzy match found
  - `null` if no match found
- **Fallback**: Returns original input if fuzzy matching fails (allows provider to attempt lookup)

## Provider Configuration

### Environment Variables
- `QUOTE_PRIMARY_PROVIDER` - Primary quote provider (`twse` | `finmind`, default: `twse`)
- `NEWS_PRIMARY_PROVIDER` - Primary news provider (`google` | `yahoo`, default: `google`)
- `PROVIDER_TIMEOUT_MS` - Timeout per provider attempt (default: `2000`)
- `LOG_LEVEL` - Logging level (`debug` | `info` | `warn` | `error`, default: `info`)
- `FINMIND_TOKEN` - Required API token for FinMind requests (set via environment / secret store)

### Provider Registry
```typescript
interface ProviderConfig {
  name: string
  fetchFn: (params: any) => Promise<any>
  timeoutMs?: number
  validateFn?: (data: any) => boolean
}

const quoteProviders: ProviderConfig[] = [
  { name: 'twse', fetchFn: fetchFromTWSE, timeoutMs: 2000 },
  { name: 'finmind', fetchFn: fetchFromFinMindTick, timeoutMs: 2000 }
]

const newsProviders: ProviderConfig[] = [
  { name: 'google-rss', fetchFn: fetchFromGoogleRSS, timeoutMs: 2000 },
  { name: 'yahoo-rss', fetchFn: fetchFromYahooRSS, timeoutMs: 2000 }
]
```

### Fallback Strategy
- **Sequential Fallback**: Attempt providers in configured order
- **Timeout Handling**: Each provider gets `PROVIDER_TIMEOUT_MS` (default: 2000ms)
- **Validation**: All provider responses validated with Zod schemas
- **Logging**: All attempts, failures, and fallbacks logged with latency metrics
- **Stale Cache**: On total failure, attempt to serve expired cache data

