# Quickstart: Gugo 研究引擎整合

**Feature**: 003-gugo-integration  
**Date**: 2025-12-04

## 概述

本指南說明如何開發與測試 gugo 研究引擎整合功能。

## 前置需求

1. **gugo HTTP 服務**: 需有可連線的 gugo API 端點（或使用 mock）
2. **環境變數**: 在 `.env.local` 設定：
   ```bash
   GUGO_API_BASE_URL=http://localhost:3001  # 或正式環境 URL
   GUGO_API_KEY=your-api-key                # 選填，若 gugo 有驗證
   GUGO_TIMEOUT_MS=2000                     # 選填，預設 2000ms
   ```

## 快速開始

### 1. 安裝依賴

```bash
cd line-stock-bot
pnpm install
```

### 2. 啟動本地開發

```bash
pnpm dev
```

### 3. 測試指令

使用 LINE Bot Tester 或直接發送 Webhook 測試：

```bash
# 測試詳解指令
curl -X POST http://localhost:3000/api/line/webhook \
  -H "Content-Type: application/json" \
  -d '{"events":[{"type":"message","message":{"type":"text","text":"詳解 2330"},"replyToken":"test"}]}'

# 測試策略股指令
curl -X POST http://localhost:3000/api/line/webhook \
  -H "Content-Type: application/json" \
  -d '{"events":[{"type":"message","message":{"type":"text","text":"策略股"},"replyToken":"test"}]}'
```

## 開發指南

### 新增 Gugo Provider

```typescript
// lib/providers/gugo/client.ts
import { logger } from '../../logger'

const GUGO_BASE_URL = process.env.GUGO_API_BASE_URL
const GUGO_API_KEY = process.env.GUGO_API_KEY
const GUGO_TIMEOUT = Number(process.env.GUGO_TIMEOUT_MS) || 2000

export async function gugoFetch<T>(
  endpoint: string,
  options?: { signal?: AbortSignal }
): Promise<T> {
  const url = `${GUGO_BASE_URL}${endpoint}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  
  if (GUGO_API_KEY) {
    headers['Authorization'] = `Bearer ${GUGO_API_KEY}`
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GUGO_TIMEOUT)

  try {
    const response = await fetch(url, {
      headers,
      signal: options?.signal ?? controller.signal
    })

    if (!response.ok) {
      const error = await response.json()
      throw new GugoApiError(error.errorCode, error.message)
    }

    return response.json()
  } finally {
    clearTimeout(timeout)
  }
}
```

### 新增 Flex Message 樣板

```typescript
// lib/flex.ts 新增

export function createFactorScoreFlex(score: FactorScore) {
  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: `${score.name}（${score.symbol}）`, weight: 'bold', size: 'lg' },
        { type: 'text', text: `總分：${score.totalScore}`, size: 'xxl', color: getScoreColor(score.totalScore) },
        // ... 因子細項
      ]
    }
  }
}
```

## 測試

### 單元測試

```bash
# 執行 gugo 相關測試
pnpm test -- --grep gugo

# 執行所有測試
pnpm test
```

### 撰寫測試

```typescript
// tests/unit/providers/gugo.test.ts
import { describe, it, expect, vi } from 'vitest'
import { getFactorScore } from '../../../lib/providers/gugo/factor'

describe('gugo factor provider', () => {
  it('should return factor score for valid symbol', async () => {
    // Mock fetch
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        symbol: '2330',
        totalScore: 78,
        factors: { valuation: 65, growth: 85, quality: 90, momentum: 72, fundFlow: 68 },
        updatedAt: '2025-12-04T08:30:00Z'
      })
    }))

    const result = await getFactorScore('2330')
    
    expect(result.symbol).toBe('2330')
    expect(result.totalScore).toBe(78)
  })

  it('should throw on symbol not found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ errorCode: 'SYMBOL_NOT_FOUND', message: '找不到股票' })
    }))

    await expect(getFactorScore('9999')).rejects.toThrow('SYMBOL_NOT_FOUND')
  })
})
```

## 錯誤處理

### 常見錯誤情境

| 情境 | 處理方式 | 使用者看到的訊息 |
|------|----------|------------------|
| gugo 服務逾時 | 記錄 log，回傳友善訊息 | 「研究系統回應過慢，請稍後再試」 |
| 股票代碼不存在 | 回傳 warning Flex | 「查不到這檔股票」 |
| gugo 伺服器錯誤 | 記錄錯誤，回傳友善訊息 | 「暫時無法取得詳解」 |
| 網路連線失敗 | 記錄錯誤，回傳友善訊息 | 「研究系統暫時無法連線」 |

### Runbook：gugo 服務異常

1. **檢查 gugo 服務狀態**
   ```bash
   curl ${GUGO_API_BASE_URL}/health
   ```

2. **查看 Vercel logs**
   - 搜尋 `gugo` 或 `provider_error` 關鍵字
   - 確認錯誤代碼與頻率

3. **暫時停用 gugo 功能**（緊急情況）
   - 在 Vercel Dashboard 設定 `GUGO_ENABLED=false`
   - 重新部署

4. **通知使用者**
   - 若預期停機時間長，可在 help 訊息中說明

## 部署檢查清單

- [ ] 環境變數已設定（`GUGO_API_BASE_URL`）
- [ ] gugo 服務可連線
- [ ] 所有測試通過
- [ ] Flex Message 在 LINE 上正確顯示
- [ ] 錯誤訊息以正體中文呈現
- [ ] 監控指標正常記錄

## 相關文件

- [spec.md](./spec.md) - 功能規格
- [data-model.md](./data-model.md) - 資料模型定義
- [contracts/gugo-api.md](./contracts/gugo-api.md) - API 契約
- [research.md](./research.md) - 技術研究與決策
