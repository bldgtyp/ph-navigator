---
DATE: 2026-06-24
TIME: 00:00 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: First implementation phase for backend field contracts and local seed data.
RELATED: planning/refactor/data-table-status-field/PLAN.md
---

# Phase 01 - Contract And Seeds

## Objective

Make `Status` a built-in single-select field in every in-scope table contract and seed the local starter project with visible status values.

## Tasks

- [ ] Add shared backend constants/helpers for:
  - field key `status`
  - display name `Status`
  - option ids `opt_status_complete`, `opt_status_needed`, `opt_status_question`, `opt_status_na`
  - option labels `Complete`, `Needed`, `Question`, `N/A`
  - namespaced option-list construction for each table key
  - Materials-style color mapping for `Complete` / `Needed` / `Question` / `N/A`
- [ ] Prefer a small helper module near the existing table seed helpers, e.g. `backend/features/project_document/tables/_status_field.py`, unless implementation reveals a better existing home.
- [ ] The helper should expose:
  - `STATUS_FIELD_KEY`
  - `STATUS_DEFAULT_OPTION_ID`
  - `STATUS_OPTION_IDS`
  - `status_field_def()`
  - `status_option_list()`
  - `status_option_key(table_name: str)`
- [ ] Append `built_in_field_def(field_key="status", display_name="Status", field_type=CustomFieldType.single_select, default="opt_status_needed")` to:
  - `THERMAL_BRIDGES_BUILT_IN_FIELD_DEFS`
  - `PUMPS_BUILT_IN_FIELD_DEFS`
  - `FANS_BUILT_IN_FIELD_DEFS`
  - `HOT_WATER_HEATERS_BUILT_IN_FIELD_DEFS`
  - `HOT_WATER_TANKS_BUILT_IN_FIELD_DEFS`
  - `ELECTRIC_HEATERS_BUILT_IN_FIELD_DEFS`
  - `APPLIANCES_BUILT_IN_FIELD_DEFS`
  - `OUTDOOR_EQUIP_BUILT_IN_FIELD_DEFS`
  - `INDOOR_EQUIP_BUILT_IN_FIELD_DEFS`
- [ ] Add `*.status` option lists to new-document defaults in `backend/features/project_document/templates.py`.
- [ ] Add matching status option lists to seed files:
  - `backend/seeds/project/thermal-bridges.json`
  - `backend/seeds/project/pumps.json`
  - `backend/seeds/project/fans.json`
  - `backend/seeds/project/hot-water-heaters.json`
  - `backend/seeds/project/hot-water-tanks.json`
  - `backend/seeds/project/electric-heaters.json`
  - `backend/seeds/project/appliances.json`
  - `backend/seeds/project/heat-pumps.json`
- [ ] Add `custom_values.status` to all in-scope seed rows.
- [ ] Do not add `status` to:
  - `VENTILATORS_BUILT_IN_FIELD_DEFS`
  - `ROOMS_BUILT_IN_FIELD_DEFS`
  - `SPACE_TYPES_BUILT_IN_FIELD_DEFS`
  - `OUTDOOR_UNITS_BUILT_IN_FIELD_DEFS`
  - `INDOOR_UNITS_BUILT_IN_FIELD_DEFS`
- [ ] Run formatting/checks for touched backend files before moving to Phase 02.

## Completion Criteria

- New in-memory documents and local seed documents validate with the added built-in status fields.
- Seed rows show all four statuses somewhere in the starter data.
- No status field is added to out-of-scope Heat Pump Outdoor Units or Indoor Units.

## Suggested Verification

```sh
cd backend && uv run ruff format features/project_document/tables features/project_document/templates.py scripts/seed_dev_db.py
cd backend && uv run ruff check features/project_document/tables features/project_document/templates.py scripts/seed_dev_db.py
```

Defer full backend test execution to Phase 02 after option-model and validator wiring is complete.
