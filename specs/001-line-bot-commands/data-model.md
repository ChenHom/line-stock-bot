# Data Model

**Feature**: LINE 聊天機器人指令系統

## Entities

### Stock Quote (Quote)
- `symbol` (string) - canonical market symbol, e.g., `2330.TW` or `2330`
- `marketSymbol` (string) - full market symbol for API calls
- `name` (string) - company name (optional)
- `price` (number)
- `change` (number) - price change absolute value
- `changePercent` (number) - percent change
- `open`, `high`, `low`, `prevClose` (numbers, optional)
- `currency` (string, optional)
- `marketTime` (string iso 8601, optional)
- `delayed` (boolean) - whether data is delayed

Validation Rules:
- `symbol` MUST be non-empty string
- `price` MUST be a finite number
- `changePercent` MUST be finite number

### News Item
- `title` (string)
- `url` (string) - valid URL
- `source` (string, optional)
- `publishedAt` (string, ISO 8601, optional)

Validation Rules:
- `title` MUST be non-empty
- `url` MUST be a valid URL

### Command
- `cmd` (enum): `price`, `news`, `help`
- `args` (string)

### Provider Event / Log
- `provider` (string)
- `status` (enum): `success`, `error`, `fallback`
- `latencyMs` (number)
- `error` (string optional)

## Validation: Zod Schemas
- Create Zod schemas for `Quote` and `NewsItem` that enforce the validation rules above.

## Storage Model
- Caching only; use Upstash Redis
- Key patterns:
  - quote:{symbol}:{bucket}
  - news:{keyword}:{bucket}
- Payloads stored as JSON strings of the entities above


