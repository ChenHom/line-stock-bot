# Feature Specification: 台股列表自動更新機制

**Feature Branch**: `002-stock-list-update`  
**Created**: 2025-12-02  
**Status**: Draft  
**Input**: User description: "建立台股列表自動更新機制，支援從證交所和櫃買中心取得股票資料，並透過 GitHub Actions 定期更新"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 自動定期更新股票列表 (Priority: P1)

作為系統維護者，我希望股票列表能夠自動定期更新，以確保使用者在搜尋股票時能找到最新上市/上櫃的股票，而不需要人工維護。

**Why this priority**: 這是核心功能，確保 fuzzy matching 功能能夠涵蓋所有最新的股票資料，直接影響使用者搜尋體驗。

**Independent Test**: 可透過觸發排程任務，驗證是否成功從證交所和櫃買中心取得資料並更新本地股票列表檔案。

**Acceptance Scenarios**:

1. **Given** 排程時間到達（每週日台灣時間 09:00），**When** 自動更新任務執行，**Then** 系統從證交所取得約 1,000 支上市股票資料
2. **Given** 排程時間到達，**When** 自動更新任務執行，**Then** 系統從櫃買中心取得約 800 支上櫃股票資料
3. **Given** 兩個資料來源都成功取得資料，**When** 資料合併處理完成，**Then** 產生包含約 1,800 支股票的更新列表

---

### User Story 2 - 手動觸發更新 (Priority: P2)

作為系統維護者，當有新股票上市或需要緊急更新時，我希望能夠手動觸發股票列表更新，而不需要等待下次自動排程。

**Why this priority**: 提供彈性讓維護者能在特殊情況下立即更新資料，例如 IPO 熱門股票上市時。

**Independent Test**: 可透過手動執行更新指令或在 GitHub Actions 介面觸發 workflow，驗證股票列表是否成功更新。

**Acceptance Scenarios**:

1. **Given** 維護者在本機環境，**When** 執行更新指令，**Then** 股票列表檔案被更新並可提交變更
2. **Given** 維護者在 GitHub Actions 頁面，**When** 手動觸發 workflow，**Then** 系統自動建立包含更新的 Pull Request

---

### User Story 3 - 自動產生股票別名 (Priority: P2)

作為使用者，我希望能用常見的股票暱稱或簡稱搜尋股票，例如用「台積」找到「台積電」，以提升搜尋成功率。

**Why this priority**: 提升 fuzzy matching 準確度，讓使用者更容易找到想要的股票。

**Independent Test**: 可透過輸入各種股票別名進行搜尋，驗證是否能正確對應到股票代號。

**Acceptance Scenarios**:

1. **Given** 股票名稱為「日月光投控」，**When** 更新處理執行，**Then** 自動產生別名「日月光」
2. **Given** 股票名稱包含「-KY」或「-DR」後綴，**When** 更新處理執行，**Then** 自動產生移除後綴的別名
3. **Given** 股票在特殊別名對照表中，**When** 更新處理執行，**Then** 該股票包含對照表中定義的所有別名

---

### User Story 4 - 變更審核流程 (Priority: P3)

作為系統維護者，我希望自動更新產生的變更能透過 Pull Request 進行審核，以確保不會意外覆蓋正確的資料。

**Why this priority**: 確保資料品質和變更可追溯性，避免錯誤資料進入正式環境。

**Independent Test**: 可透過觸發自動更新後，驗證是否產生 Pull Request 並等待審核。

**Acceptance Scenarios**:

1. **Given** 自動更新成功完成，**When** 有資料變更，**Then** 系統建立 Pull Request 供維護者審核
2. **Given** Pull Request 已建立，**When** 維護者 merge，**Then** 變更套用至主分支

---

### Edge Cases

- 當證交所 API 無法連線或回傳錯誤時，更新任務應記錄錯誤並以非零狀態碼結束，不產生 PR
- 當櫃買中心 API 無法連線或回傳錯誤時，更新任務應記錄錯誤並以非零狀態碼結束，不產生 PR
- 當取得的股票數量異常偏低（少於 500 支）時，應中止更新並報錯，防止錯誤資料覆蓋
- 當兩個資料來源有重複股票代號時，應正確去重並合併資料
- 當特殊別名對照表格式錯誤時，應記錄警告但繼續處理其他股票

## Requirements *(mandatory)*

### Functional Requirements

**資料取得**
- **FR-001**: 系統 MUST 從證交所 OpenAPI 取得上市股票列表（代號與名稱）
- **FR-002**: 系統 MUST 從櫃買中心 OpenAPI 取得上櫃股票列表（代號與名稱）
- **FR-003**: 系統 MUST 合併兩個資料來源並去除重複項目

**別名處理**
- **FR-004**: 系統 MUST 自動移除股票名稱中的「控股」「投控」產生別名
- **FR-005**: 系統 MUST 自動移除股票名稱中的「-KY」「-DR」後綴產生別名
- **FR-006**: 系統 MUST 支援從特殊別名對照表讀取並套用自訂別名

**輸出產生**
- **FR-007**: 系統 MUST 將處理後的股票列表輸出至指定的程式碼檔案
- **FR-008**: 產生的檔案 MUST 可直接被 fuzzy matching 模組使用

**排程與觸發**
- **FR-009**: 系統 MUST 支援每週定期自動執行更新
- **FR-010**: 系統 MUST 支援手動觸發更新流程

**錯誤處理**
- **FR-011**: 當任一資料來源 API 失敗時，系統 MUST 以非零狀態碼結束並記錄錯誤
- **FR-012**: 當取得股票數量少於 500 支時，系統 MUST 中止更新並報錯

**變更管理**
- **FR-013**: 自動更新完成後，系統 MUST 建立 Pull Request（若有變更）

### Key Entities

- **Stock（股票）**: 包含股票代號（如 2330）、公司名稱（如 台積電）、所屬市場（上市/上櫃）、別名列表
- **StockAlias（股票別名）**: 股票的替代名稱，用於提升搜尋命中率，包含對應的股票代號
- **SpecialAliasMapping（特殊別名對照）**: 人工維護的熱門股票英文別名或特殊簡稱對照表

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 自動更新任務每週成功執行一次，成功率達到 95% 以上
- **SC-002**: 股票列表涵蓋 1,500 支以上的上市櫃股票
- **SC-003**: 使用者用公司名稱搜尋股票的成功率達到 90% 以上
- **SC-004**: 手動觸發更新後，5 分鐘內完成處理並產生 Pull Request
- **SC-005**: 使用常見別名（如「台積」對應「台積電」）搜尋的成功率達到 95% 以上

## Assumptions

- 證交所和櫃買中心的 OpenAPI 保持穩定且可公開存取
- GitHub Actions 作為 CI/CD 平台可用
- 股票資料更新頻率為每週一次，足以涵蓋新上市/下市的變動
- 興櫃股票不在本次功能範圍內
- 特殊別名對照表由維護者手動編輯維護
