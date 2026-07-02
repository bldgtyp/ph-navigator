---
DATE: 2026-07-02
TIME: 14:00 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Implementation plan for Rooms default airflow fields.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./STATUS.md
---

# PLAN - Rooms Airflow Fields

## Phase 01 - Contract Audit

- Locate Rooms default field definitions and payload normalization.
- Locate the DataTable number-units registry.
- Decide whether to reuse or add an airflow unit type.
- Inspect sample seed/project data for persisted Rooms schema behavior.

## Phase 02 - Default Fields

- Add `Supply airflow rate` and `Extract airflow rate` as built-in nullable
  unit-aware Rooms fields.
- Ensure display names exclude unit suffixes.
- Preserve null/blank rendering in frontend and backend payloads.

## Phase 03 - Existing Sample Alignment

- If required, patch seed/sample data or add render-time field overlay so the
  existing sample project exposes the new fields.
- Avoid broad migrations unless the audit shows persisted project documents need
  them.

## Phase 04 - Verification

- Add focused tests for defaults, null clearing, and unit metadata.
- Browser-smoke Spaces / Rooms field visibility and blank rendering.
- Run full closeout checks before marking complete.

