# 台股列表更新機制

本文件說明如何維護與更新股票名稱對照表，以支援 fuzzy matching 功能。

## 概述

系統使用本地股票列表（`lib/stock-list.ts`）進行模糊比對，當使用者輸入公司名稱時，可以找到對應的股票代號。

### 資料範圍

| 市場 | 來源 | 約略數量 |
|------|------|----------|
| 上市 (TWSE) | 證交所 OpenAPI | ~1,000 支 |
| 上櫃 (TPEx) | 櫃買中心 OpenAPI | ~800 支 |
| **合計** | | **~1,800 支** |

### 更新頻率

- **自動更新**：每週日 UTC 00:00（台灣時間週日 08:00）
- **手動觸發**：可透過 GitHub Actions 手動執行

---

## 資料來源

### 1. 證交所 (TWSE) - 上市股票

```
GET https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL
```

回傳欄位：
- `Code`: 股票代號（如 `2330`）
- `Name`: 公司名稱（如 `台積電`）

### 2. 櫃買中心 (TPEx) - 上櫃股票

```
GET https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes
```

回傳欄位：
- `SecuritiesCompanyCode`: 股票代號
- `CompanyName`: 公司名稱

---

## 自動更新流程

### GitHub Actions 工作流程

檔案位置：`.github/workflows/update-stock-list.yml`

```
觸發條件
    ├── 定時：每週日 00:00 UTC
    └── 手動：workflow_dispatch

執行步驟
    1. Checkout 程式碼
    2. 安裝 pnpm 依賴
    3. 執行 `pnpm run update-stocks`
    4. 如有變更，建立 Pull Request （標題 `chore: update stock list [automated]`）
```

### 更新 Script

檔案位置：`scripts/update-stocks.ts`

```typescript
// 執行方式
pnpm run update-stocks
```

功能：
1. 從 TWSE API 取得上市股票列表
2. 從 TPEx API 取得上櫃股票列表
3. 合併並去重
4. 自動產生 aliases（別名）
5. 輸出至 `lib/stock-list.ts`

---

## Aliases 自動產生規則

為提升 fuzzy matching 準確度，系統會自動產生以下別名：

| 規則 | 範例 |
|------|------|
| 移除「控股」「投控」 | 日月光投控 → 日月光 |
| 移除「-KY」「-DR」 | 祥碩-KY → 祥碩 |
| 縮寫（取前 N 字） | 台灣積體電路 → 台積 |
| 英文名稱（若有） | 台積電 → TSMC（需對照表） |

### 特殊別名對照表

部分熱門股票有約定俗成的英文別名，維護於 `scripts/stock-aliases.json`：

```json
{
  "2330": ["TSMC", "台積"],
  "2317": ["Foxconn", "富士康"],
  "2454": ["MediaTek", "MTK"]
}
```

---

## 手動更新方式

### 方式一：透過 GitHub Actions

1. 前往 [Actions 頁面](../../actions/workflows/update-stock-list.yml)
2. 點擊 **Run workflow**
3. 等待執行完成
4. Review 並 merge 產生的 PR

### 方式二：本機執行

```bash
# 1. 執行更新 script
pnpm run update-stocks

# 2. 檢視變更
git diff lib/stock-list.ts

# 3. 提交變更
git add lib/stock-list.ts
git commit -m "chore: update stock list"
git push
```

---

## 檔案結構

```
line-stock-bot/
├── lib/
│   ├── stock-list.ts        # 自動產生的股票列表（勿手動編輯）
│   └── symbol.ts            # Fuzzy matcher（使用 stock-list）
├── scripts/
│   ├── update-stocks.ts     # 更新 script
│   └── stock-aliases.json   # 特殊別名對照表（可手動編輯）
├── .github/
│   └── workflows/
│       └── update-stock-list.yml  # 自動更新 workflow
└── docs/
    └── stock-list-update.md # 本文件
```

---

## 錯誤處理

### API 失敗時

- Script 會輸出錯誤訊息並以非零狀態碼退出
- GitHub Actions 會標記為失敗
- 不會產生 PR（避免覆蓋正常資料）

### 資料異常時

若取得的股票數量異常（< 500 支），script 會中止並報錯，防止錯誤資料覆蓋。

---

## 監控與通知

### GitHub Actions 失敗通知

可在 repository 設定中啟用 email 通知：
- Settings → Notifications → Actions → Email notifications

### 建議設定

- 啟用 PR auto-merge（需通過 CI 檢查）
- 設定 CODEOWNERS 自動 assign reviewer

---

## 常見問題

### Q: 為什麼某支股票搜尋不到？

1. 確認該股票是否為上市/上櫃（興櫃股不在範圍內）
2. 檢查 `lib/stock-list.ts` 是否包含該股票
3. 若為新上市股票，等待下次自動更新或手動觸發更新

### Q: 如何新增自訂別名？

編輯 `scripts/stock-aliases.json`，加入對應的別名：

```json
{
  "2360": ["致茂", "Chroma"]
}
```

然後執行 `pnpm run update-stocks` 重新產生列表。

### Q: 更新後 fuzzy match 仍找不到？

檢查 Fuse.js 的 threshold 設定（`lib/symbol.ts`），過低的 threshold 可能導致匹配失敗。

---

## 版本紀錄

| 日期 | 版本 | 變更說明 |
|------|------|----------|
| 2025-12-02 | v1.0 | 初始版本，支援 TWSE + TPEx |

