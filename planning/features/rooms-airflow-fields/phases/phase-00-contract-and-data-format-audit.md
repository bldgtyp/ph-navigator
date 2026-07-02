---
DATE: 2026-07-02
TIME: 14:55 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Audit Rooms airflow field contract and persistence formats before implementation.
RELATED:
  - ../README.md
  - ../PLAN.md
  - ../STATUS.md
---

# Phase 00 - Contract And Data-Format Audit

## Goal

Freeze the exact field contract and existing-document strategy before changing
code. This phase exists because a built-in FieldDef addition is product schema
evolution, not a normal user schema mutation.

## Findings To Verify

- Backend `NUMBER_UNIT_REGISTRY` already supports `airflow` with `m3_h` / `cfm`.
- Frontend `NUMBER_UNIT_TYPES` already supports `airflow` with `m3_h` / `cfm`.
- DataTable number-units values are stored as canonical SI and converted for IP
  display, so Rooms row values should be `m3/h` numbers.
- Current persisted project-document formats are saved/draft bodies plus audit
  details and diff paths; no `data_changes` surface was found in this checkout.

## Tasks

- Confirm field keys:
  - `supply_airflow_m3h`
  - `extract_airflow_m3h`
- Confirm labels:
  - `Supply airflow rate`
  - `Extract airflow rate`
- Confirm units config:
  - `mode: "fixed"`
  - `unit_type: "airflow"`
  - `si_unit: "m3_h"`
  - `ip_unit: "cfm"`
  - proposed precision: `precision_si: 1`, `precision_ip: 1`
- Confirm storage:
  - `RoomRow.custom_values.supply_airflow_m3h`
  - `RoomRow.custom_values.extract_airflow_m3h`
  - value type `number | null`
- Confirm whether fresh-project seed behavior alone is enough for the current
  deployment state.
- Inspect at least one seeded/current project document and one draft, if present,
  to see whether `rooms.field_defs` is stale relative to the code seed.
- Decide compatibility path:
  - seed-only,
  - read overlay,
  - schema-version bump/read-time upgrade,
  - explicit data backfill/migration.
- Record the decision in `STATUS.md` before Phase 01 starts.

## Data-Change Format Guard

Do not implement this by sending `addField` mutations through
`/draft/tables/rooms/custom-fields:mutate`. That surface writes editor-draft
state and emits user-action audit details. Product built-ins should enter through
the product schema/seed path, with any existing-document compatibility handled
by the chosen schema evolution strategy.

## Verification

- `graphify query "rooms airflow fields data-change format project document field definitions saved drafts audit diff" --budget 4000`
  returned no useful scoped context.
- Focused grep/review found no active `data_changes` storage surface. The
  current surfaces are `project_versions.body`, `project_version_drafts.body`,
  `user_action_log.details`, and `ProjectDiffResponse.tables[*].changed_paths`.
- `backend/features/project_document/custom_fields.py` confirms
  `NUMBER_UNIT_REGISTRY["airflow"]` accepts SI `m3_h` and IP `cfm`.
- `backend/features/project_document/tables/rooms.py` confirms Rooms mutable
  built-ins live outside `ROOMS_TYPED_COLUMN_FIELD_KEYS`, so airflow values
  should live in `RoomRow.custom_values`.
- `backend/seeds/project/rooms.json` contains only rows/options; the seed
  builder in `backend/scripts/seed_dev_db.py` combines rows with current
  `ROOMS_BUILT_IN_FIELD_DEFS`.
- Local dev DB sample on 2026-07-02:
  - `project_versions`: 115 rows.
  - `project_version_drafts`: 19 rows.
  - Latest sampled saved version and latest sampled draft both had Rooms
    `field_defs` ending at `icfa_factor`; neither included airflow fields.
- Decision: use schema-bump/read-time upgrade in Phase 02. Saved versions remain
  immutable until saved again; stale draft rows can be rewritten through the
  existing `rewrite_draft_if_upgraded(...)` path. Seed-only is insufficient for
  current local/staging data, and read-overlay-only would make ETag/diff
  behavior harder to reason about.
