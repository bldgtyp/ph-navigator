---
DATE: 2026-07-02
TIME: 14:55 EDT
STATUS: Planned / reviewed and phased
AUTHOR: Codex
SCOPE: Current state for Rooms default airflow fields.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
---

# STATUS - Rooms Airflow Fields

## State

`Planned` - packet reviewed against current backend/frontend code; detailed
phase plans drafted; no implementation started.

## Next Step

Start Phase 00 by confirming the compatibility decision for existing saved
versions and drafts:

- overlay missing built-ins on read,
- schema-bump/read-time upgrade with draft rewrite only,
- explicit production backfill/migration, or
- seed-only if current production data can be reset/reseeded safely.

## Blockers

Decision needed in Phase 00: how aggressive existing-document alignment should
be now that PH-Navigator has production deployment history.

The "data-change format" concern does not map to a `data_changes` table/field in
this checkout. The implementation should verify the real surfaces:
`project_versions.body`, `project_version_drafts.body`, `user_action_log.details`,
and diff `changed_paths`.

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
