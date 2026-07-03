---
DATE: 2026-07-02
TIME: 14:55 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Add Rooms airflow built-in FieldDefs for fresh documents.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
---

# Phase 01 - Built-In Field Contract

## Goal

Add the two airflow fields to the backend Rooms product seed so new/fresh
project documents receive them by default.

## Tasks

- Add the two built-in `TableFieldDef` entries in
  `backend/features/project_document/tables/rooms.py`.
- Insert them after the Space Type or occupant-count fields, based on the desired
  Rooms column order from Phase 00.
- Use `CustomFieldType.number` with `config.units`, not unit text in
  `display_name`.
- Keep `default=None`; do not backfill row values to `0`.
- Leave `ROOMS_TYPED_COLUMN_FIELD_KEYS` unchanged so values live in
  `custom_values`.
- Update schema/fingerprint expectations if the project-document schema guard
  requires it.
- Add or update backend tests that assert:
  - fresh `empty_project_document(...)` includes both field defs,
  - each field has `origin == "built_in"`,
  - each field has `field_type == "number"`,
  - each field has fixed `airflow` units with `m3_h` / `cfm`,
  - drift reporting sees missing built-ins on a deliberately stale Rooms
    envelope.

## Verification

- Focused backend tests for Rooms defaults and FieldDef drift.
- Schema fingerprint test updated only if the change intentionally changes the
  product document contract.
- Passed on 2026-07-02:
  `cd backend && uv run pytest tests/test_project_document.py::test_empty_project_document_has_room_airflow_field_defs tests/test_project_document_fielddef_drift.py::test_fielddef_drift_reports_stale_rooms_airflow_built_ins tests/test_project_document_schema_guard.py::test_project_document_schema_fingerprint_requires_version_guard_update`.
