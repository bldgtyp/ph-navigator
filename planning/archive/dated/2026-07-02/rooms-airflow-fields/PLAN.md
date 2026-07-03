---
DATE: 2026-07-02
TIME: 14:55 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Implementation plan for Rooms default airflow fields.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./STATUS.md
---

# PLAN - Rooms Airflow Fields

## Current Code Findings

- Rooms built-ins are declared in
  `backend/features/project_document/tables/rooms.py` as
  `ROOMS_BUILT_IN_FIELD_DEFS`.
- Mutable Rooms built-ins live in `RoomRow.custom_values`; locked typed columns
  are enumerated by `ROOMS_TYPED_COLUMN_FIELD_KEYS`.
- `TableFieldDef.config.units` is the backend number-units shape. `airflow` is
  already registered as SI `m3_h` and IP `cfm`.
- Frontend DataTable converts unit-aware values from canonical SI storage to
  active-display units; blank/null already formats as blank.
- Existing persisted versions carry their own `rooms.field_defs`, so adding
  code seeds alone affects fresh projects but not necessarily old saved bodies.
- No `data_changes` persistence was found in this checkout. Schema/diff/audit
  implications should be checked against `project_versions.body`,
  `project_version_drafts.body`, `user_action_log.details`, and
  `ProjectDiffResponse.changed_paths`.

## Phase 00 - Contract And Data-Format Audit

Detailed plan: `phases/phase-00-contract-and-data-format-audit.md`

Status: Complete. Goal: freeze exact field keys, storage semantics, and
compatibility strategy before touching seeds or write paths.

## Phase 01 - Built-In Field Contract

Detailed plan: `phases/phase-01-built-in-field-contract.md`

Status: Complete. Goal: add backend product built-ins for fresh project
documents with fixed airflow units and focused schema/fingerprint tests.

## Phase 02 - Existing Document Compatibility

Detailed plan: `phases/phase-02-existing-document-compatibility.md`

Status: Complete. Goal: make existing sample/current project documents expose
the two fields without corrupting saved-version or draft semantics.

## Phase 03 - Frontend And DataTable Behavior

Detailed plan: `phases/phase-03-frontend-and-data-table-behavior.md`

Status: Complete. Goal: verify Rooms renders the new fields as ordinary
DataTable unit-number columns and preserves null clears through the shared write
flow.

## Phase 04 - Verification And Closeout

Detailed plan: `phases/phase-04-verification-and-closeout.md`

Status: Complete. Goal: run focused checks, browser smoke Spaces / Rooms,
update graph/docs, then run the appropriate closeout gate before marking
complete.

## Implementation Guardrails

- Do not add unit suffixes to `display_name`.
- Do not add typed `RoomRow` columns unless Phase 00 finds a hard requirement;
  the normal path is `custom_values`.
- Do not use the user-facing `FieldSchemaMutation` endpoint to retrofit product
  built-ins into every document. That path emits user-action audit payloads and
  is for editor gestures, not product baseline evolution.
- Prefer the existing project-document schema/upgrade discipline for persisted
  body changes. If the compatibility decision is overlay-only, document the
  limitation explicitly and add drift coverage.
