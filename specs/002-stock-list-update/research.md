# Research: 台股列表自動更新機制

**Feature**: 002-stock-list-update  
**Date**: 2025-12-02  
**Status**: Complete

## 研究任務

### 1. TWSE OpenAPI 回應格式

**任務**: 確認證交所 OpenAPI 的回應結構與欄位

**發現**:
- **Endpoint**: `https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL`
- **Method**: GET
- **Response Format**: JSON Array
- **關鍵欄位**:
  - `Code`: 股票代號（字串，如 "2330"）
  - `Name`: 公司簡稱（字串，如 "台積電"）
  - 其他欄位：交易量、開高低收等（本功能不需使用）

**Decision**: 使用 `Code` 和 `Name` 欄位，其他欄位忽略  
**Rationale**: 最小化資料處理，只取必要欄位  
**Alternatives Considered**: 無其他官方 API 提供完整上市股票列表

---

### 2. TPEx OpenAPI 回應格式

**任務**: 確認櫃買中心 OpenAPI 的回應結構與欄位

**發現**:
- **Endpoint**: `https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes`
- **Method**: GET
- **Response Format**: JSON Array
- **關鍵欄位**:
  - `SecuritiesCompanyCode`: 股票代號（字串）
  - `CompanyName`: 公司名稱（字串）

**Decision**: 使用 `SecuritiesCompanyCode` 和 `CompanyName` 欄位  
**Rationale**: 與 TWSE 保持一致的資料結構  
**Alternatives Considered**: 爬取 TPEx 網頁 HTML（不穩定，不推薦）

---

### 3. 別名自動產生規則

**任務**: 定義自動產生別名的規則

**發現**:
根據台股命名慣例，常見的可移除後綴包括：
- 控股類：「控股」「投控」「金控」
- 海外掛牌標記：「-KY」「-DR」「*」
- 特殊標記：「-創」（創新板）

**Decision**: 實作以下別名規則：
1. 移除「控股」→ 如「日月光投控」→「日月光」
2. 移除「投控」→ 同上
3. 移除「-KY」後綴 → 如「祥碩-KY」→「祥碩」
4. 移除「-DR」後綴
5. 移除「*」標記

**Rationale**: 涵蓋最常見的搜尋需求，避免過度複雜的規則  
**Alternatives Considered**: 
- NLP 分詞（過於複雜）
- 人工維護全部別名（維護成本高）

---

### 4. GitHub Actions Workflow 設計

**任務**: 設計自動更新的 CI/CD 流程

**發現**:
- GitHub Actions 支援 `schedule` trigger（cron 語法）
- 可使用 `peter-evans/create-pull-request` action 自動建立 PR
- 需要設定適當的權限以允許 push 和建立 PR

**Decision**: 
- 排程：每週日 UTC 00:00（台灣時間 08:00）
- 使用 `peter-evans/create-pull-request@v5` 建立 PR
- PR 標題格式：`chore: update stock list [automated]`

**Rationale**: 
- 週日更新避免影響工作日的開發流程
- 自動 PR 確保變更可審核

**Alternatives Considered**:
- 直接 push 到 main（缺乏審核機制）
- 使用 GitHub Bot token（設定較複雜）

---

### 5. 輸出檔案格式

**任務**: 決定股票列表的輸出格式

**發現**:
- 現有 `lib/symbol.ts` 使用硬編碼的 `STOCK_DICTIONARY` 陣列
- Fuse.js 需要 `{ symbol, name, aliases }` 結構

**Decision**: 
- 輸出至獨立檔案 `lib/stock-list.ts`
- 格式為 TypeScript 陣列，可直接 import
- 包含自動產生的 header 註解標記「自動產生，勿手動編輯」

**Rationale**: 
- 獨立檔案便於追蹤變更
- TypeScript 格式提供型別安全

**Alternatives Considered**:
- JSON 檔案（需額外 import 和型別轉換）
- 直接修改 symbol.ts（不利於 diff 審核）

---

### 6. 錯誤處理與驗證

**任務**: 定義 API 失敗與資料異常的處理策略

**發現**:
- 外部 API 可能因維護、流量限制而暫時無法存取
- 資料異常可能導致錯誤覆蓋正確資料

**Decision**:
- API 錯誤：記錄錯誤訊息，以非零狀態碼結束
- 資料驗證：若股票數量 < 500，視為異常並中止
- Timeout：設定 30 秒超時

**Rationale**: 防禦性設計，避免不完整資料覆蓋正常資料  
**Alternatives Considered**: 
- 部分成功（只更新成功的來源）—— 可能導致資料不一致

---

### 7. 特殊別名對照表格式

**任務**: 定義人工維護的別名對照表格式

**發現**:
- 部分熱門股票有約定俗成的英文名稱（如 TSMC、MTK）
- 這些別名無法透過規則自動產生

**Decision**:
- 使用 JSON 格式：`scripts/stock-aliases.json`
- 結構：`{ "股票代號": ["別名1", "別名2"] }`
- 範例：`{ "2330": ["TSMC", "台積"], "2454": ["MediaTek", "MTK"] }`

**Rationale**: JSON 格式簡單易編輯，便於維護者手動更新  
**Alternatives Considered**:
- YAML（需額外 parser）
- TypeScript（維護者可能不熟悉）

---

## 技術決策摘要

| 項目 | 決策 | 理由 |
|------|------|------|
| 資料來源 | TWSE + TPEx OpenAPI | 官方來源，資料可靠 |
| 輸出格式 | TypeScript 檔案 | 型別安全，易於整合 |
| 別名規則 | 移除常見後綴 + JSON 對照表 | 平衡自動化與彈性 |
| 排程 | 每週日 UTC 01:00 | 避免影響工作日 |
| 變更管理 | 自動 PR | 確保變更可審核 |
| 錯誤處理 | 嚴格驗證，失敗即中止 | 防禦性設計 |

## 待確認事項

✅ 所有 NEEDS CLARIFICATION 已解決

## 參考資料

- [TWSE OpenAPI 文件](https://openapi.twse.com.tw/)
- [TPEx OpenAPI 文件](https://www.tpex.org.tw/openapi/)
- [peter-evans/create-pull-request](https://github.com/peter-evans/create-pull-request)
- [Fuse.js 文件](https://fusejs.io/)
