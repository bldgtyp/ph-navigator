---
DATE: 2026-07-02
TIME: 14:55 EDT
STATUS: Planned / reviewed
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
- Field keys are stable built-in slugs, tentatively:
  - `supply_airflow_m3h`
  - `extract_airflow_m3h`
- Both fields are nullable.
- Missing/null values render blank.
- Both fields are unit-aware numeric values with IP/SI display:
  - IP: `cfm`
  - SI: `m3/h`
- Units should be attached through the DataTable `numberUnits` path, not encoded
  in the display name.
- Stored row values are canonical SI `m3/h`, because the current number-units
  path stores SI and converts to the active display unit.
- Values live in `RoomRow.custom_values`, not as typed `RoomRow` columns.

## Acceptance Criteria

- New/fresh projects include both fields by default.
- Existing sample project data renders both fields without requiring a manual
  user edit.
- Blank/missing values render as blank, not `0`.
- Clearing a value writes/preserves `null` through the Rooms payload path at
  `custom_values.<field_key>`.
- Unit display switches correctly between `cfm` and `m3/h`.
- Field headers show the active unit through the existing unit-header pill; the
  display names remain `Supply airflow rate` and `Extract airflow rate`.
- Existing Rooms fields and Space-Type link behavior remain unchanged.
- Focused backend/frontend tests cover default field registration and nullable
  round-trip behavior.
- `make frontend-dev-check` or the relevant focused checks pass; full `make ci`
  should run before closeout.

## Non-Goals

- No ventilation load calculation.
- No automatic airflow derivation from occupancy or room area.
- No changes to mechanical equipment tables.
- No user-facing schema-mutation write is required just to introduce product
  built-ins.

## Investigation Notes

- Confirm whether an airflow unit family already exists in the unit registry.
- Airflow already exists in both registries:
  - Backend: `NUMBER_UNIT_REGISTRY["airflow"]` accepts `m3_h` / `cfm`.
  - Frontend: `NUMBER_UNIT_TYPES` includes `airflow` with `m3_h` / `cfm`.
- Check whether the sample project has persisted Rooms field definitions that
  require a targeted seed patch, read-time schema overlay, or migration.
- There is no `data_changes` storage surface in the current project-document
  code path. The concrete persisted surfaces are saved/draft document bodies,
  `user_action_log.details`, and diff `changed_paths`; implementation must
  validate the real format before choosing a compatibility strategy.
