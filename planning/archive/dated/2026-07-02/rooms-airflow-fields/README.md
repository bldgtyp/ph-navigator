---
DATE: 2026-07-02
TIME: 14:55 EDT
STATUS: Complete / archived
AUTHOR: Codex
SCOPE: Add default nullable unit-aware supply/extract airflow fields to Spaces /
  Rooms.
RELATED:
  - ./PRD.md
  - ./PLAN.md
  - ./STATUS.md
  - ./phases/phase-00-contract-and-data-format-audit.md
  - ./phases/phase-01-built-in-field-contract.md
  - ./phases/phase-02-existing-document-compatibility.md
  - ./phases/phase-03-frontend-and-data-table-behavior.md
  - ./phases/phase-04-verification-and-closeout.md
  - context/technical-requirements/data-table.md
---

# Rooms Airflow Fields

## Scope

Add two default Rooms fields:

- `Supply airflow rate`
- `Extract airflow rate`

Both should be nullable unit-aware numeric fields with IP/SI display as
`cfm <> m3/h`, rendering blank when no value is present. Values should store
canonical SI `m3/h` numbers in `RoomRow.custom_values`, matching the existing
DataTable number-units contract.

## Read Order

1. `PRD.md`
2. `PLAN.md`
3. `STATUS.md`
4. Active phase files under `phases/`, starting with
   `phase-00-contract-and-data-format-audit.md`

## Phase Map

| Phase | Focus | Deliverable |
|---|---|---|
| 00 | Contract + data-format audit | Pin exact field keys, unit config, saved/draft body behavior, and audit/diff surfaces before code changes. |
| 01 | Built-in field contract | Add field seeds and backend schema/fingerprint coverage for fresh projects. |
| 02 | Existing document compatibility | Decide and implement overlay/migration/seed alignment for existing sample and production documents. |
| 03 | Frontend DataTable behavior | Verify Rooms renders, edits, clears, filters, exports, and switches units correctly. |
| 04 | Verification + closeout | Focused backend/frontend tests, browser smoke, docs-pass, and final gate selection. |

## Completion

Completed on 2026-07-02. The packet was archived after backend/frontend
focused tests, `make frontend-dev-check`, full `make ci`, in-app Browser smoke
on Spaces / Rooms, `graphify update .`, simplify review, and docs-pass.

## Classification

`planning/features` because this adds default project data fields to the Spaces /
Rooms product contract.
