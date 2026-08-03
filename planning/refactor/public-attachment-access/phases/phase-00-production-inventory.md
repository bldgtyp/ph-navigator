---
DATE: 2026-08-03
TIME: 09:10 EDT
STATUS: Not started
AUTHOR: Claude with Ed May
SCOPE: Read-only inventory of stored attachment references on the five
  unreachable tables, before write validation is switched on.
RELATED:
  - ../PRD.md
  - ../research.md
  - ./phase-01-row-walker.md
---

# Phase 00 — Production inventory (read-only preflight)

## Goal

Produce a written list of every stored attachment reference on the five tables
the row walker cannot currently read, annotated with whether it would survive
the validation Phase 01 switches on. No code changes.

## Why this must run first

Phase 01 makes `validate_document_asset_references` start enforcing existence,
same-project ownership, `upload_status == "uploaded"`, per-cell `max_count`, and
`asset_matches_field` on references that have never been checked (PRD §6). A
stored id that fails any of those turns into a 422 rejecting the **entire table
save** the next time Ed edits that table. Finding those now costs one read-only
pass; finding them later costs a production write failure on a live project.

## Scope

Tables to inventory — the five with `rows_walked=0`:

- `thermal_bridges` — columns `datasheet_asset_ids`, `photo_asset_ids`,
  `pdf_report_asset_ids`
- `equipment.heat_pumps.outdoor_equip` — `datasheet_asset_ids`, `photo_asset_ids`
- `equipment.heat_pumps.indoor_equip` — same
- `equipment.heat_pumps.outdoor_units` — same
- `equipment.heat_pumps.indoor_units` — same

Projects: all production projects. There are few; do not sample.

## Method

**Preferred — read-only MCP.** Use the production `phn` server, which is the
supported read path for real project data:

1. `list_projects` to enumerate.
2. Per project, `get_table` for `thermal_bridges` and each heat-pump table to
   read the stored rows and their `*_asset_ids` arrays.
3. `list_assets` per project to resolve each referenced id.

Read-only tools only. Do **not** call `save_draft`, `save_draft_as`, or any
write tool in this phase. If a draft is created incidentally, inspect the diff,
`discard_draft`, and confirm it is gone.

**Fallback — read-only SQL** via Render Shell, Ed-triggered, if MCP cannot
express the join. Never a write statement.

## What to record per reference

| Column | Why |
| --- | --- |
| project, table, row id, field key | locate it |
| asset id | the reference |
| asset exists in this project | else `asset_not_found` on save |
| `upload_status` | else `asset_upload_incomplete` (409) |
| `asset_kind` | must be `datasheet` / `site_photo` per field |
| `content_type` | must satisfy the field's allowlist |
| `size_bytes` | must be ≤ the field cap (25 MB) |
| `deleted_at` | soft-deleted assets still referenced |
| count per row per field | must be ≤ `max_count` (5 datasheet / 10 photo / 5 pdf_report) |
| `metadata.orphaned_status` | see below |

## Also check — has anything already been swept?

Any asset carrying `metadata.orphaned_status == "moved"` **and** referenced from
one of these tables was GC'd while invisible to the sweeper's reference check
(PRD §5). Expected result: none, because the sweeper is manual and dry-run by
default. If any turn up, they are recoverable — the object was copied to the
orphan prefix before the original was deleted, and
`metadata.original_object_key` records where it came from. Record them; recovery
is a separate decision for Ed.

## Deliverable

Append to `../STATUS.md` under a `## Phase 00 findings` heading:

- total references found, by table and column;
- the violation list, or an explicit "zero violations" statement;
- the orphan-sweep check result;
- for each violation, a proposed remediation (re-upload, detach, or relax the
  registry entry) for Ed to approve.

## Decisions this phase feeds

- Whether the Phase 02 `pdf_report_asset_ids` entry can be **PDF-only**
  (mirroring the frontend) or must accept the wider `DATASHEET_CONTENT_TYPES`
  because non-PDF assets are already stored there.
- Whether any `max_count` in the registry is below what production already
  holds.

## Done when

- Every production project has been inventoried across all five tables.
- The findings section exists in `STATUS.md` with a violation list or a clean
  bill.
- Ed has signed off on the remediation for any violation, or there are none.

## Risks

- **Reading production is safe; writing is not.** Read-only tools only.
- Do not run `backend/scripts/sweep_orphaned_assets.py` in this phase, even
  dry-run, to avoid any chance of a wrong flag. The inventory answers the same
  question from data.
