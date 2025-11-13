# LINE Stock Bot

LINE 聊天機器人指令系統：實作 help、股價查詢、新聞查詢等核心指令，包含自動 fallback、快取與模組化 Provider 設計。

## Features

✅ **Stock Quotes** - Query Taiwan stock prices with automatic fallback (TWSE ↔ Yahoo Finance)
✅ **Industry News** - Get industry news from RSS feeds (Google News ↔ Yahoo News)
✅ **Smart Symbol Resolution** - Support both stock codes (2330) and names (台積電)
✅ **Caching Layer** - Redis-backed caching with configurable TTL (45s for quotes, 15min for news)
✅ **Provider Fallback** - Automatic fallback when primary data source fails (<1s switch time)
✅ **Type Safety** - Runtime validation with Zod schemas
✅ **Structured Logging** - JSON logs with event tracking
✅ **Monitoring** - Cache hit/miss and provider fallback metrics

## Quick Start

### Prerequisites

- Node.js 18+ LTS
- pnpm package manager
- LINE Channel (Channel Access Token & Secret)
- Upstash Redis account

### Installation

```bash
pnpm install
```

### Environment Variables

Create `.env.local` file:

```bash
# LINE Bot Configuration
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here
LINE_CHANNEL_SECRET=your_channel_secret_here

# Upstash Redis Configuration
UPSTASH_REDIS_REST_URL=your_upstash_redis_rest_url_here
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_rest_token_here

# Optional Configuration
DEBUG=False                       # Set to 'True' to skip signature verification in dev
QUOTE_PRIMARY_PROVIDER=twse       # Primary quote provider: 'twse' or 'yahoo' (default: twse)
MONITORING_ENABLED=false          # Enable metrics collection and logging
```

### Local Development

```bash
# Start development server
vercel dev

# Or use tsx directly
pnpm exec tsx watch api/line/webhook.ts
```

Set your LINE webhook URL to `http://localhost:3000/api/line/webhook` (use ngrok for local testing).

### Deployment

Deploy to Vercel:

```bash
pnpm vercel
```

Or connect your GitHub repository to Vercel for automatic deployments.

## Commands

Users can interact with the bot using these commands:

- `help` or `幫助` - Show available commands
- `股價 <symbol>` - Get stock quote (e.g., `股價 2330` or `股價 台積電`)
- `新聞 <keyword>` - Get industry news (e.g., `新聞 半導體`)

## Architecture

### Tech Stack

- **TypeScript 5.x** - Type-safe development
- **Vercel Serverless** - Stateless deployment platform
- **Upstash Redis** - Serverless caching layer
- **Zod** - Runtime type validation
- **LINE Bot SDK** - Webhook handling and messaging

### Project Structure

```
api/
  line/
    webhook.ts          # LINE webhook handler
lib/
  cache.ts             # Redis cache wrapper
  logger.ts            # Structured logging
  monitoring.ts        # Metrics collection
  schemas.ts           # Zod validation schemas
  symbol.ts            # Symbol resolution utilities
  flex.ts              # LINE Flex Message templates
  types.ts             # TypeScript types
  providers/
    index.ts           # Provider orchestration with fallback
    withCache.ts       # Cache decorator
    quote/
      twse.ts          # TWSE data provider
      yahooRapid.ts    # Yahoo Finance provider
    news/
      googleRss.ts     # Google News RSS provider
      yahooRss.ts      # Yahoo News RSS provider
specs/                 # Feature specifications and documentation
```

### Constitution Principles

1. **Serverless-First** - Stateless functions, no local persistence
2. **Provider Abstraction** - Modular data sources with automatic fallback
3. **Caching Strategy** - Redis-backed cache with TTL buckets
4. **Type Safety** - Zod runtime validation for external data
5. **Flex Message UI** - Centralized, reusable message templates

## Configuration

### Provider Priority

Control quote data source priority via `QUOTE_PRIMARY_PROVIDER`:

- `twse` (default) - Use TWSE as primary, Yahoo as fallback
- `yahoo` - Use Yahoo as primary, TWSE as fallback

### Cache TTL

- Stock quotes: 45 seconds (time-bucketed)
- News items: 15 minutes (time-bucketed)

### Monitoring

Enable monitoring with `MONITORING_ENABLED=true`. Metrics include:

- Cache hit/miss rate
- Provider success/error rates
- Fallback events

## Performance Goals

- 95% of webhook requests respond < 3s (SLO)
- Cache hit rate > 80%
- Provider fallback switch < 1s

## Development

### Type Checking

```bash
pnpm exec tsc --noEmit
```

### Testing

Tests are planned for Phase 4 (T010-T013). Test coverage will include:

- Unit tests for providers and validation
- Integration tests for webhook handling
- Cache behavior tests
- Load/performance tests

## Security

- ✅ Webhook signature verification (HMAC-SHA256)
- ✅ Environment variable secrets
- ✅ No sensitive data in logs
- ⚠️ Set `DEBUG=False` in production

## Contributing

This project follows the speckit workflow. See `specs/001-line-bot-commands/` for detailed specifications, tasks, and documentation.

## License

ISC
