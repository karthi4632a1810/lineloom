# LineLoom metric definitions

This document describes how waiting, consultation, care, billing, lab, and aggregate metrics are computed in the backend so dashboard figures match operational expectations.

## Data sources

- **Token** ([backend/models/Token.js](../backend/models/Token.js)): visit identity, department, `status`, `created_at`.
- **TimeTracking** ([backend/models/TimeTracking.js](../backend/models/TimeTracking.js)): stage timestamps (`waiting_start`, `consult_start`, `consult_end`, `billing_*`, `lab_*`, `care_*`, `break_*`).

## Core helpers

- **`buildTatMetrics(tracking, status)`** — [backend/services/dashboardService.js](../backend/services/dashboardService.js): turn-a-round (TAT) style durations in **minutes** (two decimal places), aligned with live “clock still running” behavior for in-progress stages.
- **`calculateTimeMetrics(tracking)`** — [backend/utils/timeMetrics.js](../backend/utils/timeMetrics.js): the same underlying intervals in a slightly different shape (used by token detail responses). Consult both when adding features; prefer **`buildTatMetrics`** for dashboard averages.

## Stage durations (`buildTatMetrics`)

| Field | Interval | Notes |
|--------|-----------|--------|
| `waiting_tat_minutes` | `waiting_start` → `consult_start` | If status is `WAITING` (or legacy `ACTIVE`), end may be “now” so live wait is visible. |
| `consulting_tat_minutes` | `consult_start` → `consult_end` | If status is `CONSULTING` and consult not ended, end may be “now”. |
| `billing_tat_minutes` | `billing_start` → `billing_end` | Only while consult is open and billing is in progress (see code for the exact “open interval” rule). |
| `lab_wait_tat_minutes` | `billing_end` → `lab_start` | Post-payment queue until lab starts. |
| `lab_test_tat_minutes` | `lab_start` → `lab_end` | Active lab testing. |
| `treatment_tat_minutes` | effective treatment start → `care_end` | Effective start is **`resolveEffectiveTreatmentStart(care_start, consult_end)`** so idle gaps after consult are not counted as treatment. |
| `break_tat_minutes` | `break_start` → `break_end` | **Excluded** from `overall_tat_minutes` (breaks are tracked separately). If break is open, end may be “now” when applicable. |
| `overall_tat_minutes` | Sum of non-null waiting, consulting, billing, lab wait, lab test, treatment | **Does not** include break time. |

## Dashboard aggregates

- **`avg_waiting_time_minutes`**: Mean of `waiting_tat_minutes` over tokens in the selected date range **for which waiting TAT is non-null** (tokens still waiting contribute once they have both ends or a live end).
- **`avg_consultation_time_minutes`**: Mean of `consulting_tat_minutes` where non-null.
- **Counts** (`waiting_patient_count`, etc.): Derived from **Token.status** (`WAITING` and legacy `ACTIVE` both count as waiting for display).

## Edge cases to be aware of

1. **Missing timestamps**: If a stage never started, its duration is null and is omitted from that stage’s average.
2. **Branching / new token**: When branching to another department, a new token may receive initial **TimeTracking** rows that reuse `break_end` in a special way; journey timelines should still show chronological stage times—see journey API.
3. **ACTIVE status**: Treated as waiting in queue UIs and counts; prefer `WAITING` for new data.
4. **Break vs overall TAT**: Break minutes are reported separately and are **not** part of `overall_tat_minutes`.

## Intelligence layer (Phase 4)

Downstream analytics and forecasting should use the same definitions above. Any change to `buildTatMetrics` or `resolveEffectiveTreatmentStart` should be reflected in tests and in this document.
