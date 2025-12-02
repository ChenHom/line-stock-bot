# Implementation Plan: 台股列表自動更新機制

**Branch**: `002-stock-list-update` | **Date**: 2025-12-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-stock-list-update/spec.md`

## Summary

建立自動化機制從證交所 (TWSE) 和櫃買中心 (TPEx) OpenAPI 取得上市/上櫃股票列表，自動產生別名以提升 fuzzy matching 準確度，並透過 GitHub Actions 每週定期更新，產生 Pull Request 供維護者審核。

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js latest LTS)  
**Primary Dependencies**: `tsx` (script runner), `node-fetch` (HTTP client), `zod` (schema validation)  
**Storage**: 無資料庫需求，輸出至 `lib/stock-list.ts` 程式碼檔案  
**Testing**: `vitest` - 單元測試 script 邏輯與別名產生  
**Target Platform**: GitHub Actions (CI/CD)、本機 CLI  
**Project Type**: single - 新增 scripts/ 目錄存放更新腳本  
**Performance Goals**: 5 分鐘內完成更新流程（含 API 呼叫、處理、輸出）  
**Constraints**: API 呼叫需處理 timeout 與錯誤，最小股票數量檢查 (>500)  
**Scale/Scope**: 約 1,800 支上市櫃股票，每週更新一次

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Serverless-First | ✅ N/A | 此功能為 CI/CD script，非 serverless function |
| II. Provider Abstraction | ✅ PASS | 資料來源透過獨立函式抽象，可擴展 |
| III. Caching Strategy | ✅ N/A | 更新 script 為批次處理，不需快取 |
| IV. TypeScript Type Safety | ✅ PASS | 使用 Zod 驗證 API 回應，定義明確型別 |
| V. Flex Message UI | ✅ N/A | 非使用者介面功能 |
| VI. Observability | ✅ PASS | Script 需記錄執行結果與錯誤 |

**Pre-Phase 0 Gate**: ✅ PASS

### Post-Phase 1 Re-check

| Principle | Status | Design Compliance |
|-----------|--------|-------------------|
| II. Provider Abstraction | ✅ PASS | TWSE/TPEx 取得邏輯獨立函式化（見 contracts/providers.md） |
| IV. TypeScript Type Safety | ✅ PASS | Zod schema 定義於 contracts，型別匯出至 lib/types.ts |
| VI. Observability | ✅ PASS | Script 執行結果記錄至 stdout/stderr，GitHub Actions 自動收集 |

**Post-Phase 1 Gate**: ✅ PASS - 可進入 Phase 2 (tasks)

## Project Structure

### Documentation (this feature)

```text
specs/002-stock-list-update/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API schemas)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
scripts/
├── update-stocks.ts     # 主要更新腳本
└── stock-aliases.json   # 特殊別名對照表（手動維護）

lib/
├── stock-list.ts        # 自動產生的股票列表（勿手動編輯）
└── symbol.ts            # 既有的 fuzzy matcher（需修改以使用 stock-list）

.github/
└── workflows/
    └── update-stock-list.yml  # GitHub Actions workflow

tests/
└── unit/
    └── update-stocks.test.ts  # 更新腳本測試
```

**Structure Decision**: 採用 Single project 結構，新增 `scripts/` 目錄存放維護腳本，與既有 `lib/` 分離。

## Complexity Tracking

> 無需記錄 - Constitution Check 無違規項目
