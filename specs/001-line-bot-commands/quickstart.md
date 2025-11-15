# Quickstart: LINE 聊天機器人指令系統

**Updated**: 2025-11-13 (Phase 1 completion)

**Prerequisites**: 
- Node.js LTS (v18+)
- pnpm installed
- Vercel account (for deployment)
- Upstash Redis credentials ([upstash.com](https://upstash.com))
- LINE Messaging API credentials ([developers.line.biz](https://developers.line.biz))

## Environment Variables

Create `.env.local` file based on `.env.local.example`:

### Required
- `LINE_CHANNEL_SECRET` - LINE Channel secret for webhook signature verification
- `LINE_CHANNEL_ACCESS_TOKEN` - LINE Channel access token for sending messages
- `UPSTASH_REDIS_REST_URL` - Upstash Redis REST endpoint
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis REST token

### Optional
- `QUOTE_PRIMARY_PROVIDER` - Primary quote provider (`twse` | `yahoo`, default: `twse`)
- `NEWS_PRIMARY_PROVIDER` - Primary news provider (`google` | `yahoo`, default: `google`)
- `PROVIDER_TIMEOUT_MS` - Timeout per provider attempt (default: `2000`)
- `LOG_LEVEL` - Logging level (`debug` | `info` | `warn` | `error`, default: `info`)
- `NODE_ENV` - Environment (`development` | `production`, default: `development`)
- `MONITORING_ENABLED` - Enable telemetry and monitoring (default: `false`)

## Local Development

1. **Install dependencies**:
```bash
pnpm install
```

2. **Setup environment variables**:
```bash
cp .env.local.example .env.local
# Edit .env.local with your credentials
```

3. **Run local development server**:

Option A - Using Vercel Dev (recommended):
```bash
pnpm vercel dev
# Server starts at http://localhost:3000
```

Option B - Using tsx watch:
```bash
pnpm install -g tsx  # if not installed
tsx watch api/line/webhook.ts
```

4. **Expose local server for LINE webhook** (required for testing):
```bash
# Using ngrok
ngrok http 3000

# Or use Vercel dev with public URL
pnpm vercel dev --listen 3000
```

5. **Configure LINE webhook URL**:
- Go to LINE Developer Console
- Set webhook URL to `https://your-ngrok-url.ngrok.io/api/line/webhook`
- Enable webhook
- Verify webhook connection

## Testing Commands

Once webhook is configured, send these messages to your LINE Bot:

```
股價 2330        # Query TSMC stock quote
股價 台積電      # Query by company name (fuzzy matching)
新聞 台積電      # Query news about TSMC
新聞 半導體      # Query semiconductor industry news
help           # Show all available commands
幫助            # Show help in Chinese
```

Expected behaviors:
- Quote queries return Flex Message card with price, change%, volume
- Fuzzy matching suggests top 2 matches if confidence > 80%
- News queries return 3-5 news items in carousel format
- Stale cache warning if providers fail: "資料可能稍有延遲"
- Error message if all providers fail and no cache: "目前無法取得資料，請稍後再試"

## Run Tests

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test tests/unit/providers/quote.test.ts
pnpm test tests/unit/providers/cache.test.ts
pnpm test tests/integration/webhook.test.ts

# Run tests in watch mode
pnpm test --watch

# Generate coverage report
pnpm test --coverage
```

## Deploy to Vercel

### Via CLI
```bash
# Install Vercel CLI
pnpm install -g vercel

# Deploy
pnpm vercel

# Deploy to production
pnpm vercel --prod
```

### Via GitHub Integration (Recommended)
1. Connect your GitHub repository to Vercel
2. Vercel automatically deploys on push to main branch
3. Preview deployments created for pull requests

### Configure Environment Variables in Vercel
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Add all required variables:
   - `LINE_CHANNEL_SECRET`
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. Optional variables:
   - `QUOTE_PRIMARY_PROVIDER=twse`
   - `NEWS_PRIMARY_PROVIDER=google`
   - `LOG_LEVEL=info`
   - `MONITORING_ENABLED=true`

### Update LINE Webhook URL
After deployment, update LINE Developer Console:
- Webhook URL: `https://your-vercel-app.vercel.app/api/line/webhook`
- Verify webhook connection

## Monitoring & Logs

### View Logs in Vercel
1. Go to Vercel Dashboard → Project → Functions
2. Click on `/api/line/webhook`
3. View real-time logs with structured JSON output

### Log Entry Format
```json
{
  "timestamp": "2025-11-13T12:34:56.789Z",
  "level": "info",
  "message": "Provider call successful",
  "requestId": "req_abc123",
  "userId": "hash_u1234",
  "providerName": "twse",
  "latency": 125
}
```

### Key Metrics to Monitor
- Provider success/failure rates
- Cache hit/miss ratios
- Average latency per provider
- Stale cache serve frequency
- Fallback trigger frequency

## Troubleshooting

### Webhook Signature Verification Failed
- Check `LINE_CHANNEL_SECRET` is correct
- Ensure webhook payload is not modified in transit
- Verify `x-line-signature` header is present

### Cache Connection Errors
- Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- Check Upstash Redis instance is active
- System will degrade gracefully to direct API calls

### Provider Timeout
- Check provider API status (TWSE, Yahoo, Google News)
- Adjust `PROVIDER_TIMEOUT_MS` if needed (default: 2000ms)
- Check Vercel function execution time limits

### Fuzzy Matching Not Working
- Ensure stock name is in `lib/symbol.ts` mapping
- Check confidence threshold (default: 80%)
- Verify Traditional Chinese character encoding

## Notes
- Keep Upstash and LINE credentials secret
- Never commit `.env.local` to version control
- For CI: add steps to run tests and verify webhook signature handling
- Monitor Vercel function execution time (must stay under 10s limit)
- Review logs regularly to identify provider reliability issues
