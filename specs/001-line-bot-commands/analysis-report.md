# Specification Analysis Report (Corrected)

**Feature**: LINE 聊天機器人指令系統  
**Date**: 2025-11-13 (corrected)  
**Summary**: This corrected report updates the previous Analysis Report to reflect the clarification: provider order is configurable with default = TWSE.

## Updated Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation | Status |
|----|----------|----------|-------------|---------|----------------|--------|
| D1 | Duplication / Conflict | HIGH | `spec.md` FR-005; `lib/providers/index.ts` | Spec required TWSE as primary; code/plan favored Yahoo. | Make provider order configurable; default to TWSE; add an env var to control provider order. | RESOLVED (default TWSE) - T019 added |

## Key Changes from Clarification
- `QUOTE_PRIMARY_PROVIDER` env var will control provider priority; default is `twse`.
- `spec.md` now includes a Clarifications section with the decision.
- `plan.md`, `tasks.md` and `architecture-assessment.md` updated to document the change and add required tasks and tests.

## Re-run Critical Check
- Constitution alignment: No new conflicts introduced.
- Tasks updated: T005 updated and T019 added to enforce configuration support and tests.

## SLO & Fallback Update
- FR-004 has been updated to a measurable SLO: 95% of requests < 3s; fallback reply within 3s when Provider errors occur. Corresponding tasks T020 and T021 were added to instrument telemetry and test fallback latency.

## Outstanding Items
- Zod validation (C1) remains CRITICAL and must be gated (T004).  
- Monitoring for cache hit/miss (C2) has been promoted to mandatory and moved into Phase 2 (T017).
- SLO instrumentation & fallback tests were added as native tasks (T020, T021); ensure they are implemented and gated before production deployment.

## Coverage Summary
| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001 | Yes | T005, T007, T010, T011 | Quote support tasks remain mapped | 
| FR-002 | Yes | T005, T010, T011 | News support tasks remain mapped | 
| FR-005 (provider priority) | Yes | T019, T005 | Updated to configurable default TWSE | 

## Next Steps
- Implement T019 early with tests verifying both `twse` and `yahoo` settings.  
- Implement C1 (T004) gating rule for Zod validation.
- Implement T020 (telemetry & SLO) and T017 (monitoring) and add CI gating checks for SLOs.
- Implement T021 fallback tests to validate fallback behavior and latency thresholds.

---

*This file updates and replaces the earlier in-memory report; it was generated after acceptance of the provider priority clarification.*
