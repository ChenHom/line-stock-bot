# Quickstart: 台股列表自動更新機制

**Feature**: 002-stock-list-update  
**Date**: 2025-12-02

## 概述

本功能提供自動更新台股列表的機制，從證交所和櫃買中心 OpenAPI 取得最新的上市/上櫃股票資料，並透過 GitHub Actions 定期執行。

## 快速開始

### 手動執行更新

```bash
# 執行更新腳本
pnpm run update-stocks

# 檢視變更
git diff lib/stock-list.ts

# 提交變更
git add lib/stock-list.ts
git commit -m "chore: update stock list"
```

### GitHub Actions 自動更新

自動更新會在每週日 UTC 01:00（台灣時間 09:00）執行。

若需手動觸發：
1. 前往 GitHub repository 的 Actions 頁面
2. 選擇 `Update Stock List` workflow
3. 點擊 `Run workflow`
4. 等待執行完成後，審核並 merge 產生的 PR

## 檔案結構

```
line-stock-bot/
├── lib/
│   └── stock-list.ts        # 自動產生的股票列表（勿手動編輯）
├── scripts/
│   ├── update-stocks.ts     # 更新腳本
│   └── stock-aliases.json   # 特殊別名對照表（可手動編輯）
└── .github/
    └── workflows/
        └── update-stock-list.yml  # GitHub Actions workflow
```

## 新增自訂別名

編輯 `scripts/stock-aliases.json`：

```json
{
  "2330": ["TSMC", "台積"],
  "2360": ["致茂", "Chroma"]  // 新增這行
}
```

然後執行更新：

```bash
pnpm run update-stocks
```

## 常見問題排解

### 更新失敗：API 無法連線

**症狀**: 腳本輸出 API 連線錯誤

**可能原因**:
- 證交所/櫃買中心維護中
- 網路問題

**解決方案**:
1. 等待幾分鐘後重試
2. 檢查 [TWSE 系統公告](https://www.twse.com.tw/) 確認是否維護中
3. 若持續失敗，檢查網路連線

### 更新失敗：股票數量異常

**症狀**: 腳本輸出「股票數量少於 500 支」錯誤

**可能原因**:
- API 回傳不完整資料
- API 格式變更

**解決方案**:
1. 手動檢查 API 回應格式是否變更
2. 若格式變更，需更新 `scripts/update-stocks.ts` 中的 schema

### Fuzzy match 找不到特定股票

**可能原因**:
1. 該股票為新上市，尚未更新
2. 該股票為興櫃股（不在支援範圍）
3. Fuse.js threshold 設定過低

**解決方案**:
1. 手動觸發更新
2. 確認股票為上市/上櫃
3. 調整 `lib/symbol.ts` 中的 threshold 設定

## 監控與維護

### 自動更新失敗通知

建議在 GitHub repository 設定中啟用 Actions 失敗通知：
- Settings → Notifications → Actions → 勾選 Email notifications

### 定期檢查項目

| 項目 | 頻率 | 說明 |
|------|------|------|
| 更新成功率 | 每月 | 檢查 Actions 執行歷史 |
| 股票數量 | 每月 | 確認約 1,800 支 |
| API 格式 | 季度 | 確認 API 回應格式未變更 |

## Runbook: 處理更新失敗

### 情境 1: 單次失敗

1. 檢查 Actions log 確認失敗原因
2. 若為暫時性問題（網路、API 維護），手動重新觸發
3. 若成功，無需進一步處理

### 情境 2: 連續失敗

1. 檢查 API 是否可正常存取
2. 檢查 API 回應格式是否變更
3. 若格式變更，更新對應的 Zod schema
4. 提交修正並驗證

### 情境 3: PR 無法 merge

1. 檢查 CI 測試是否通過
2. 檢查是否有 merge conflict
3. 若有 conflict，手動解決後 merge

## 相關文件

- [功能規格](./spec.md)
- [實作計劃](./plan.md)
- [資料模型](./data-model.md)
- [API Contracts](./contracts/providers.md)
