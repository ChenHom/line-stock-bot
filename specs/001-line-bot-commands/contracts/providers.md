# Contract: Provider Functions (Internal)

These contracts describe the intended API for provider modules used by the feature.

## getQuoteWithFallback(symbol: string): Promise<Quote>
- Input: `symbol` - a canonical symbol string (e.g., `2330`, `2330.TW`)
- Behavior: Attempts to fetch quote from the primary provider (Yahoo) and falls back to TWSE on error or invalid schema
- Output: `Quote` as defined in `data-model.md`
- Error Handling: Throws an error if both providers fail
- Caching: Should be wrapped with `withCache` to cache results for `45s`

## getIndustryNews(keyword: string, limit: number = 5): Promise<NewsItem[]>
- Input: `keyword` - search keyword; `limit` - number of results
- Behavior: Attempts to fetch news from primary provider (Google News RSS) and falls back to Yahoo RSS
- Output: `NewsItem[]` as defined in `data-model.md` (length <= limit)
- Error Handling: Throws error if both providers fail
- Caching: Should be wrapped with `withCache` to cache results for `15min`

## withCache<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T>
- Input: `key`, `ttlSeconds`, `fetcher` function to retrieve data
- Behavior: Returns cached data when present; otherwise calls `fetcher`, stores result in cache with TTL, and returns result
- Failure Mode: On cache read/write errors, proceed to call `fetcher` and return its result (stateless degradation)

## resolveSymbol(input: string): string
- Input: `input` - either a stock code (`\d{4}`) or company name
- Output: a canonical symbol (numeric code or marketSymbol), or original input if not resolvable
- Behavior: map common names to codes where possible

