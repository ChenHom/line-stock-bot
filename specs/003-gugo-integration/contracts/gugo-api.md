# Gugo API Contract

**Feature**: 003-gugo-integration  
**Date**: 2025-12-04  
**Status**: Draft  
**Version**: 1.0.0

## 概述

本文件定義 line-stock-bot 期待 gugo HTTP 服務提供的 API 契約。gugo 服務需實作這些端點以支援研究型指令。

## Base URL

```
Production: ${GUGO_API_BASE_URL}  (例如 https://gugo-api.example.com)
```

## 認證

若 `GUGO_API_KEY` 環境變數有設定，所有請求需在 Header 帶入：

```
Authorization: Bearer ${GUGO_API_KEY}
```

## 共用錯誤格式

所有錯誤回應使用統一格式：

```json
{
  "errorCode": "SYMBOL_NOT_FOUND",
  "message": "找不到股票代碼 9999",
  "details": {}
}
```

**錯誤代碼列表**:

| 代碼 | HTTP Status | 說明 |
|------|-------------|------|
| `SYMBOL_NOT_FOUND` | 404 | 股票代碼不存在 |
| `NO_DATA` | 404 | 股票存在但無研究資料 |
| `INVALID_SYMBOL` | 400 | 股票代碼格式錯誤 |
| `RATE_LIMIT` | 429 | 請求頻率超過限制 |
| `INTERNAL_ERROR` | 500 | 伺服器內部錯誤 |

---

## API Endpoints

### 1. 取得因子評分

取得單一股票的多因子量化評分。

**Request**

```
GET /api/v1/factor/{symbol}
```

**Path Parameters**

| 參數 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `symbol` | string | ✅ | 股票代碼（純數字，如 `2330`） |

**Response (200 OK)**

```json
{
  "symbol": "2330",
  "name": "台積電",
  "totalScore": 78,
  "factors": {
    "valuation": 65,
    "growth": 85,
    "quality": 90,
    "momentum": 72,
    "fundFlow": 68
  },
  "keyMetrics": {
    "roe": 25.3,
    "epsGrowth": 18.5,
    "revenueGrowth": 12.8,
    "returnHalfYear": 15.2,
    "pe": 22.5,
    "pb": 5.8
  },
  "updatedAt": "2025-12-04T08:30:00Z"
}
```

**Response (404 Not Found)**

```json
{
  "errorCode": "SYMBOL_NOT_FOUND",
  "message": "找不到股票代碼 9999"
}
```

**line-stock-bot 使用方式**:
```typescript
// lib/providers/gugo/factor.ts
export async function getFactorScore(symbol: string): Promise<FactorScore>
```

---

### 2. 取得策略股排行榜

取得多因子策略篩選的高分股票清單。

**Request**

```
GET /api/v1/ranking
GET /api/v1/ranking?strategy={strategyName}&limit={limit}
```

**Query Parameters**

| 參數 | 型別 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| `strategy` | string | ❌ | `default` | 策略名稱 |
| `limit` | number | ❌ | `10` | 回傳股票數量上限 |

**Response (200 OK)**

```json
{
  "strategyName": "default",
  "stocks": [
    {
      "rank": 1,
      "symbol": "2330",
      "name": "台積電",
      "totalScore": 88,
      "tags": ["品質高", "成長佳"],
      "topFactor": "quality"
    },
    {
      "rank": 2,
      "symbol": "2317",
      "name": "鴻海",
      "totalScore": 82,
      "tags": ["估值便宜"],
      "topFactor": "valuation"
    }
  ],
  "generatedAt": "2025-12-04T06:00:00Z",
  "totalCount": 150
}
```

**Response (200 OK - Empty)**

當無符合條件的股票時：

```json
{
  "strategyName": "default",
  "stocks": [],
  "generatedAt": "2025-12-04T06:00:00Z",
  "totalCount": 0
}
```

**line-stock-bot 使用方式**:
```typescript
// lib/providers/gugo/ranking.ts
export async function getStrategyRanking(
  strategy?: string,
  limit?: number
): Promise<StrategyRanking>
```

---

### 3. 取得回測結果

取得單一標的的歷史回測績效。

**Request**

```
GET /api/v1/backtest/{symbol}
GET /api/v1/backtest/{symbol}?from={from}&to={to}
```

**Path Parameters**

| 參數 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `symbol` | string | ✅ | 股票代碼或策略代號 |

**Query Parameters**

| 參數 | 型別 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| `from` | string | ❌ | 一年前 | 起始日期（YYYY-MM-DD） |
| `to` | string | ❌ | 今天 | 結束日期（YYYY-MM-DD） |

**Response (200 OK)**

```json
{
  "symbol": "0050",
  "strategyName": null,
  "period": {
    "from": "2024-12-04",
    "to": "2025-12-04"
  },
  "metrics": {
    "annualizedReturn": 12.5,
    "maxDrawdown": -8.3,
    "sharpeRatio": 1.2,
    "winRate": 58.5,
    "totalReturn": 12.5
  },
  "generatedAt": "2025-12-04T09:00:00Z"
}
```

**line-stock-bot 使用方式**:
```typescript
// lib/providers/gugo/backtest.ts
export async function getBacktestResult(
  symbol: string,
  from?: string,
  to?: string
): Promise<BacktestResult>
```

---

## 效能要求

| 端點 | 預期回應時間 | 逾時設定 |
|------|--------------|----------|
| `/api/v1/factor/{symbol}` | < 500ms | 2000ms |
| `/api/v1/ranking` | < 500ms | 2000ms |
| `/api/v1/backtest/{symbol}` | < 1000ms | 3000ms |

---

## 快取建議

| 端點 | 建議快取時間 | 說明 |
|------|--------------|------|
| `/api/v1/factor/{symbol}` | 不快取 | 使用者期待即時資料 |
| `/api/v1/ranking` | 5 分鐘 | 排行榜每日更新 |
| `/api/v1/backtest/{symbol}` | 30 分鐘 | 歷史資料不常變動 |

---

## 版本演進

### v1.0.0 (Initial)
- 因子評分 API
- 策略股排行榜 API
- 回測結果 API

### Future (v1.1.0)
- 支援多策略選擇
- 支援自訂回測參數
- 支援批次查詢多檔股票
