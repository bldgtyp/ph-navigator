---
DATE: 2026-07-02
TIME: 14:00 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Product contract for Rooms default airflow fields.
RELATED:
  - ./README.md
  - ./PLAN.md
  - ./STATUS.md
---

# PRD - Rooms Airflow Fields

## Problem

Spaces / Rooms needs default ventilation airflow inputs for room-level supply
and extract rates. These should behave like standard built-in fields, not
manually added custom columns.

## Desired Behavior

- Every project Rooms table includes `Supply airflow rate`.
- Every project Rooms table includes `Extract airflow rate`.
- Both fields are nullable.
- Missing/null values render blank.
- Both fields are unit-aware numeric values with IP/SI display:
  - IP: `cfm`
  - SI: `m3/h`
- Units should be attached through the DataTable `numberUnits` path, not encoded
  in the display name.

## Acceptance Criteria

- New/fresh projects include both fields by default.
- Existing sample project data renders both fields without requiring a manual
  user edit.
- Blank/missing values render as blank, not `0`.
- Clearing a value writes/preserves `null` through the Rooms payload path.
- Unit display switches correctly between `cfm` and `m3/h`.
- Existing Rooms fields and Space-Type link behavior remain unchanged.
- Focused backend/frontend tests cover default field registration and nullable
  round-trip behavior.
- `make frontend-dev-check` or the relevant focused checks pass; full `make ci`
  should run before closeout.

## Non-Goals

- No ventilation load calculation.
- No automatic airflow derivation from occupancy or room area.
- No changes to mechanical equipment tables.

## Investigation Notes

- Confirm whether an airflow unit family already exists in the unit registry.
- If not, add one using the established `FieldDef.numberUnits` route.
- Check whether the sample project has persisted Rooms field definitions that
  require a targeted seed patch, read-time schema overlay, or migration.

