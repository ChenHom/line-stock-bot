# line-stock-bot Development Guidelines

強制要求使用繁體中文對話

Auto-generated from all feature plans. Last updated: 2025-11-13

## Active Technologies
- TypeScript 5.x (Node.js latest LTS) + `@line/bot-sdk`, `zod`, `@upstash/redis`, `tsx`, `node-fetch` (or native fetch), `vercel` (001-line-bot-commands)
- Upstash Redis (快取層，無持久化資料庫需求) (001-line-bot-commands)
- TypeScript 5.x on Node.js 18 LTS + `@line/bot-sdk`, `zod`, `@upstash/redis`, `node-fetch` (or global fetch), `Fuse.js`, custom `logger`, `tsx`, `vitest` (001-line-bot-commands)
- Upstash Redis (cache + stale-while-revalidate); no persistent DB (001-line-bot-commands)
- TypeScript 5.x on Node.js 18 LTS + `@line/bot-sdk`, `zod`, `@upstash/redis`, `Fuse.js`, FinMind REST (`TaiwanStockTick`), `node-fetch`/global `fetch`, custom logger/monitoring utilities (001-line-bot-commands)
- Upstash Redis (REST) for 45s quote cache + 15m news cache; no persistent DB (001-line-bot-commands)
- TypeScript 5.x (Node.js 18+ LTS) + `@line/bot-sdk`, `zod`, `@upstash/redis`, `fuse.js`, `cheerio` (for scraping if needed), `winston` (logging) (001-line-bot-commands)
- Upstash Redis (Cache only, TTL 45s/15m) (001-line-bot-commands)

- TypeScript 5.x (Node.js latest LTS) + `@line/bot-sdk`, `zod`, `@upstash/redis`, `tsx`, `node-fetch` (or global fetch), `vercel` (001-line-bot-commands)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x (Node.js latest LTS): Follow standard conventions

## Recent Changes
- 001-line-bot-commands: Added TypeScript 5.x (Node.js 18+ LTS) + `@line/bot-sdk`, `zod`, `@upstash/redis`, `fuse.js`, `cheerio` (for scraping if needed), `winston` (logging)
- 001-line-bot-commands: Added TypeScript 5.x (Node.js latest LTS) + `@line/bot-sdk`, `zod`, `@upstash/redis`, `tsx`, `node-fetch` (or native fetch), `vercel`
- 001-line-bot-commands: Added TypeScript 5.x on Node.js 18 LTS + `@line/bot-sdk`, `zod`, `@upstash/redis`, `Fuse.js`, FinMind REST (`TaiwanStockTick`), `node-fetch`/global `fetch`, custom logger/monitoring utilities


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
