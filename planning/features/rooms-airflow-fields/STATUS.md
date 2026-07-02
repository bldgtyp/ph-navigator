---
DATE: 2026-07-02
TIME: 14:55 EDT
STATUS: Phase 00 complete / Phase 01 next
AUTHOR: Codex
SCOPE: Current state for Rooms default airflow fields.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
---

# STATUS - Rooms Airflow Fields

## State

`Phase 00 complete` - field contract and existing-document compatibility path
are decided. No product code has been changed yet.

## Next Step

Start Phase 01 by adding the two Rooms built-in `TableFieldDef` entries in
`backend/features/project_document/tables/rooms.py`, then update focused backend
tests/schema fingerprint expectations as needed.

## Blockers

None for Phase 01.

Phase 02 compatibility decision: use a schema-bump/read-time upgrade. Saved
versions stay immutable unless saved again; stale drafts can be rewritten via
the existing `rewrite_draft_if_upgraded(...)` path. Seed-only is insufficient
because the local dev DB currently has stale saved versions and drafts; a pure
read overlay would make ETag/diff behavior less explicit.

## Verification Ledger

- `graphify query "rooms airflow fields data-change format project document field definitions" --budget 4000`
  returned no useful scoped context.
- Manual code review:
  - `backend/features/project_document/tables/rooms.py`
  - `backend/features/project_document/custom_fields.py`
  - `backend/features/project_document/rows.py`
  - `backend/features/project_document/fielddef_drift.py`
  - `backend/features/project_document/{drafts.py,write_spine.py,store.py}`
  - `frontend/src/lib/units/numberUnits.ts`
  - `frontend/src/shared/ui/data-table/lib/numberDisplay.ts`
- No tests run; docs-only planning pass.
- Phase 00 audit:
  - `graphify query "rooms airflow fields data-change format project document field definitions saved drafts audit diff" --budget 4000`
    returned no useful scoped context.
  - Focused grep/review found no active `data_changes` surface. Current
    persistence/diff/audit surfaces are `project_versions.body`,
    `project_version_drafts.body`, `user_action_log.details`, and
    `ProjectDiffResponse.tables[*].changed_paths`.
  - `NUMBER_UNIT_REGISTRY["airflow"]` already accepts SI `m3_h` and IP `cfm`.
  - `frontend/src/lib/units/numberUnits.ts` already includes airflow display
    units.
  - `backend/seeds/project/rooms.json` stores rows/options only; fresh seed
    bodies receive current code field defs via `seed_dev_db.py`.
  - Local dev DB sample on 2026-07-02: `project_versions=115`,
    `project_version_drafts=19`; latest sampled saved version and latest
    sampled draft both lacked `supply_airflow_m3h` and `extract_airflow_m3h`.
