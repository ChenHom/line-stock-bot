# Tasks: 台股列表自動更新機制

**Input**: Design documents from `/specs/002-stock-list-update/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: 不包含測試任務（規格說明未明確要求 TDD）

**Organization**: 任務依據 User Story 組織，支援獨立實作與測試

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可並行執行（不同檔案、無依賴）
- **[Story]**: 任務所屬的 User Story（US1, US2, US3, US4）
- 描述中包含確切的檔案路徑

## Path Conventions

依據 plan.md 結構：
- **scripts/**: 更新腳本與設定檔
- **lib/**: 輸出的股票列表與型別定義
- **.github/workflows/**: GitHub Actions 工作流程
- **tests/unit/**: 單元測試

---

## Phase 1: Setup (基礎建設)

**Purpose**: 專案初始化與基本結構建立

 - [x] T001 建立 `scripts/` 目錄結構
 - [x] T002 [P] 新增 `scripts/stock-aliases.json` 特殊別名對照表初始內容
 - [x] T003 [P] 新增 `update-stocks` script 指令至 `package.json`
 - [x] T004 [P] 擴充 `lib/types.ts` 加入 Stock 相關型別定義

---

## Phase 2: Foundational (基礎核心)

**Purpose**: 所有 User Story 依賴的核心元件，必須在進入 User Story 實作前完成

**⚠️ 關鍵**: 此階段完成前無法開始任何 User Story

 - [x] T005 建立 Zod schema 定義於 `scripts/schemas.ts`（TWSE/TPEx API 回應驗證）
 - [x] T006 [P] 實作 TWSE API 取得函式於 `scripts/fetchers.ts`
 - [x] T007 [P] 實作 TPEx API 取得函式於 `scripts/fetchers.ts`
 - [x] T008 實作資料正規化與合併邏輯於 `scripts/transform.ts`
 - [x] T009 [P] 實作別名產生規則函式於 `scripts/aliases.ts`
 - [x] T010 實作檔案輸出函式於 `scripts/output.ts`（產生 `lib/stock-list.ts`）

**Checkpoint**: 核心元件就緒 - 可開始 User Story 實作

---

## Phase 3: User Story 1 - 自動定期更新股票列表 (Priority: P1) 🎯 MVP

**Goal**: 系統能透過排程自動從證交所和櫃買中心取得股票資料並更新本地列表

**Independent Test**: 執行 `pnpm run update-stocks` 後，`lib/stock-list.ts` 包含約 1,800 支股票

### Implementation for User Story 1

 - [x] T011 [US1] 建立主要更新腳本 `scripts/update-stocks.ts`（整合 fetchers, transform, output）
 - [x] T012 [US1] 實作錯誤處理與驗證邏輯於 `scripts/update-stocks.ts`（股票數量 >= 500 檢查）
 - [x] T013 [US1] 實作執行結果輸出至 stdout/stderr 於 `scripts/update-stocks.ts`
 - [x] T014 [US1] 建立 GitHub Actions workflow `/.github/workflows/update-stock-list.yml`（排程觸發）
 - [x] T015 [US1] 設定 workflow 排程為每週日 UTC 00:00

**Checkpoint**: User Story 1 完成 - 可獨立測試自動更新功能

---

## Phase 4: User Story 2 - 手動觸發更新 (Priority: P2)

**Goal**: 維護者可透過本機指令或 GitHub Actions 手動觸發更新

**Independent Test**: 手動執行 `pnpm run update-stocks` 或在 Actions 頁面觸發 workflow 均可成功更新

### Implementation for User Story 2

 - [x] T016 [US2] 於 `/.github/workflows/update-stock-list.yml` 新增 `workflow_dispatch` 觸發器
 - [x] T017 [US2] 驗證本機執行 `pnpm run update-stocks` 正常運作

**Checkpoint**: User Story 2 完成 - 可獨立測試手動觸發功能

---

## Phase 5: User Story 3 - 自動產生股票別名 (Priority: P2)

**Goal**: 系統自動產生常見別名並支援特殊別名對照表

**Independent Test**: 更新後，「日月光投控」產生別名「日月光」，「2330」包含別名「TSMC」

### Implementation for User Story 3

 - [x] T018 [US3] 擴充 `scripts/aliases.ts` 實作移除「控股」「投控」規則
 - [x] T019 [P] [US3] 擴充 `scripts/aliases.ts` 實作移除「-KY」「-DR」後綴規則
 - [x] T020 [US3] 實作讀取 `scripts/stock-aliases.json` 並合併至別名列表
 - [x] T021 [US3] 更新 `lib/symbol.ts` 改為 import `lib/stock-list.ts` 取代硬編碼字典

**Checkpoint**: User Story 3 完成 - 可獨立測試別名搜尋功能

---

## Phase 6: User Story 4 - 變更審核流程 (Priority: P3)

**Goal**: 自動更新產生的變更透過 Pull Request 進行審核

**Independent Test**: 自動更新後產生 PR，標題為 `chore: update stock list [automated]`

### Implementation for User Story 4

 - [x] T022 [US4] 於 `/.github/workflows/update-stock-list.yml` 加入 `peter-evans/create-pull-request` action
 - [x] T023 [US4] 設定 PR 標題、分支名稱、commit 訊息格式
 - [x] T024 [US4] 設定 workflow permissions（contents: write, pull-requests: write）

**Checkpoint**: User Story 4 完成 - 可獨立測試 PR 建立功能

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 跨 User Story 的改進與收尾工作

 - [x] T025 [P] 更新 `docs/stock-list-update.md` 確保文件與實作一致
 - [x] T026 [P] 新增 `lib/stock-list.ts` 至 `.gitignore` 排除區段說明（保留追蹤但標記為自動產生）
 - [x] T027 執行完整流程驗證：執行 `pnpm run update-stocks` 並確認輸出正確
 - [x] T028 驗證 `lib/symbol.ts` fuzzy matching 使用新的 stock-list

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Foundational) ──── 阻擋所有 User Stories
    │
    ├──▶ Phase 3 (US1: 自動更新) 🎯 MVP
    │         │
    │         ▼
    ├──▶ Phase 4 (US2: 手動觸發)
    │         │
    │         ▼
    ├──▶ Phase 5 (US3: 別名產生)
    │         │
    │         ▼
    └──▶ Phase 6 (US4: PR 審核)
              │
              ▼
        Phase 7 (Polish)
```

### User Story Dependencies

| User Story | 依賴 | 可並行於 |
|------------|------|----------|
| US1 (P1) | Phase 2 完成 | - |
| US2 (P2) | US1 完成（需 workflow 存在） | - |
| US3 (P2) | Phase 2 完成 | US1, US2 |
| US4 (P3) | US1 完成（需 workflow 存在） | US3 |

### Within Each Phase

- 標記 [P] 的任務可並行執行
- 未標記 [P] 的任務需依序執行
- 每個 User Story 完成後可獨立驗證

### Parallel Opportunities

**Phase 1 並行**:
```
T002 (stock-aliases.json) ─┐
T003 (package.json)       ─┼─▶ 可同時進行
T004 (types.ts)           ─┘
```

**Phase 2 並行**:
```
T006 (TWSE fetcher) ─┬─▶ 可同時進行
T007 (TPEx fetcher) ─┘

T009 (aliases.ts) ──────▶ 可與 T006/T007 同時進行
```

**Phase 5 並行**:
```
T018 (控股規則)   ─┬─▶ T019 可同時進行
T019 (-KY/-DR 規則)─┘
```

---

## Implementation Strategy

### MVP First (僅 User Story 1)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational（**關鍵** - 阻擋所有 Stories）
3. 完成 Phase 3: User Story 1
4. **驗證點**: 執行 `pnpm run update-stocks`，確認 `lib/stock-list.ts` 產生正確
5. 可部署/展示 MVP

### Incremental Delivery

1. Setup + Foundational → 基礎就緒
2. User Story 1 → 獨立測試 → 部署（MVP！）
3. User Story 2 + 4 → 獨立測試 → 完整 CI/CD 流程
4. User Story 3 → 獨立測試 → 別名搜尋增強
5. Polish → 文件與驗證

### 建議執行順序

由於單一開發者，建議依優先級順序執行：

```
P1 (US1) → P2 (US2) → P2 (US3) → P3 (US4) → Polish
```

---

## Notes

- [P] 任務 = 不同檔案、無依賴，可並行
- [Story] 標籤對應 spec.md 中的 User Story
- 每個 User Story 應可獨立完成與測試
- 每個任務或邏輯群組完成後提交 commit
- 任意 Checkpoint 處可停止並驗證該 Story
- 避免：模糊任務、同檔案衝突、破壞獨立性的跨 Story 依賴
