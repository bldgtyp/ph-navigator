---
DATE: 2026-07-02
TIME: 14:55 EDT
STATUS: Planned
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

- Focused grep/review proves no active `data_changes` symbol exists or identifies
  the actual current equivalent.
- A short note in `STATUS.md` names the chosen compatibility path and why.
- No code changes beyond docs in this phase unless the audit itself exposes a
  broken current contract.
