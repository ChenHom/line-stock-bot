# Contract: LINE Webhook (Public-facing)

## Endpoint
- POST `/api/line/webhook`
- Content-Type: `application/json`

## Request
- Body: LINE webhook event envelope (per LINE Messaging API)
  - `events`: array of events; this contract focuses on `message` events with `type: 'text'`

## Behavior
- Verify `x-line-signature` header to validate the request signature and reject invalid requests with 401
- For `cmd` parsing: recognized commands `股價|price`, `新聞|news`, `help|幫助` (including aliases)
- For `股價`: call `lib/providers/getQuoteWithFallback(symbol)` and reply with Flex Message
- For `新聞`: call `lib/providers/getIndustryNews(keyword, limit)` and reply with Flex Message
- For `help`: reply with help Flex Message

## Response
- `200 OK` with JSON ack: `{ ok: true }` on successful processing
- 401 on invalid signature
- 400 on invalid JSON
- 405 on unsupported method

## Non-functional
- Webhook must respond within 3 seconds for 95% of requests

## Example
- Request includes a single event for `message` with text `股價 2330` and `replyToken`
- Response: `200 OK` and reply via LINE `reply` API

## Notes
- The webhook does not store data persistently. It may use `lib/cache.ts` internally to get cached results.
