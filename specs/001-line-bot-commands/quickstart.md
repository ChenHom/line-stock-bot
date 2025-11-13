# Quickstart: LINE 聊天機器人指令系統

**Prerequisites**: Node.js LTS, pnpm installed, Vercel account (optional), Upstash Redis credentials, LINE Channel credentials

## Environment Variables
 - `QUOTE_PRIMARY_PROVIDER` - optional; set to `twse` or `yahoo` (default `twse`) to select primary quote provider
 - `MONITORING_ENABLED` - optional; if set, telemetry and monitoring for cache and provider events will be enabled

## Local development

1. Install:
```bash
pnpm install
```

2. Add `.env.local` based on `.env.local.example` (include required env vars)

3. Run a local server using `tsx` or Vercel dev:
```bash
pnpm install -g tsx # if not installed
pnpm exec tsx watch api/line/webhook.ts # or use vercel dev
```

4. Use the LINE Developer console to set webhook URL to `http://localhost:3000/api/line/webhook` when using `vercel dev` or a local tunneling tool (ngrok)

## Run tests
```bash
pnpm test
```

## Deploy to Vercel
 - 1. Add required environment variables to Vercel project settings; consider enabling `MONITORING_ENABLED` and setting `QUOTE_PRIMARY_PROVIDER` if needed.
2. Deploy via `pnpm vercel` or through GitHub Vercel integration

## Notes
- Keep Upstash tokens secret
- For CI: add steps to run tests and verify webhook signature handling
