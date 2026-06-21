---
DATE: 2026-06-21
TIME: 09:38 EDT
STATUS: Implemented
AUTHOR: Claude (for Ed May)
SCOPE: Add a parent-level "Download CSV" affordance to the shared DataTable
       "..." overflow menu, available on every table instance.
RELATED:
  - context/technical-requirements/data-table.md
  - context/CODING_STANDARDS.md (Frontend TypeScript)
  - frontend/src/shared/ui/data-table/components/ViewMenuOverflow.tsx
  - frontend/src/shared/ui/data-table/DataTable.tsx
  - frontend/src/shared/ui/data-table/lib/paste/tsv.ts
  - frontend/src/shared/lib/downloadBlob.ts
  - frontend/scripts/check-data-table-contract.mjs
---

# Table CSV Download

Per-table "Download CSV" item in the DataTable `...` overflow menu. The user
clicks it and immediately gets a CSV of *that one table* — a local-use copy of
the data they are looking at.

## Read order

1. `PRD.md` — what the feature does and the exact serialization/scope contract.
2. `PLAN.md` — the implementation sequence, exact files, reuse inventory, and
   the structural-guard requirement.
3. `STATUS.md` — current state, next step, verification.

## One-paragraph summary

This is a **frontend-only** feature. The DataTable already serializes its
own cells client-side for "copy as TSV" (`formatClipboardCellValue` resolves
single-select option labels and number-with-units in the active SI/IP system),
and a `downloadBlob()` helper already exists. So CSV download is: one new pure
`tableToCsv()` serializer (headers + RFC-4180 quoting + the formula/computed
branch the clipboard path lacks) wired to an **always-present built-in menu
item** inside `ViewMenuOverflow`, fed the table's already-in-scope
current-view rows/columns from `DataTable.tsx`. It is **parent-level**: built
into the shared component so every table — Rooms, equipment, heat-pump leaves,
catalogs, pickers — gets it with no per-table opt-in, enforced by a required
prop and a structural guard (the DataTable uniformity iron-law).

## Key decisions (locked with Ed, 2026-06-21)

- **Frontend-only**, no backend route. The backend was searched first
  (see `PLAN.md` § Backend search); the existing JSON download route is not a
  good fit (not uniform across table families, SI-only, duplicates frontend
  display logic).
- **Current view (WYSIWYG)** scope: the CSV reflects the active sort, filters,
  hidden columns, and column order — exactly what is on screen.
</content>
</invoke>
