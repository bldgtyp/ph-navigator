---
DATE: 2026-06-21
TIME: 09:38 EDT
STATUS: Implemented on branch
AUTHOR: Claude (for Ed May)
SCOPE: State ledger for the Table CSV Download feature (archived).
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
  - planning/features_v1.1/table-csv-download-followups/README.md
---

# STATUS — Table CSV Download

## State

`Implemented on branch` — all five plan phases landed (frontend-only;
current-view scope). Serializer, menu item, required props, mount-site
threading, and the structural guard are in place and green; full `make ci`
passed. Committed on branch `feat/table-csv-download` (commit `6229f033`);
**merge to `main` is still pending**. Archived here on closeout.

Deferred / optional items live in
[`planning/features_v1.1/table-csv-download-followups/`](../../features_v1.1/table-csv-download-followups/README.md)
(the three PRD §6 open questions + the §5 non-goals).

## What's decided

- Frontend-only, no backend route (backend searched first — see `PLAN.md` § 0).
- Built-in `Download CSV` item in `ViewMenuOverflow`, parent-level, enforced by
  a required `onDownloadCsv` prop + structural guard.
- Current-view (WYSIWYG) scope: `filteredRows` × `visibleColumnDefs`.
- Required `tableName` prop on `DataTable` for the filename.
- RFC-4180 + UTF-8 BOM + `\r\n`; single-select→label, formula→computed text,
  number-units→active SI/IP with unit on the header.

## Next step

Done. Optional follow-ups, none blocking: resolve the three PRD § 6 open
questions if real usage wants different behavior (formula errors visible,
linked_record id→label resolution, catalog JSON/CSV label reconciliation).

## What shipped

- **Phase 1** — `frontend/src/shared/ui/data-table/lib/export/csv.ts`
  (`tableToCsv`, `formatExportCellValue`, `sanitizeFilename`,
  `CSV_MIME_TYPE`) + `__tests__/csv.test.ts` (11 cases).
- **Phase 2** — built-in `Download CSV` item in `ViewMenuOverflow`, required
  `onDownloadCsv` threaded through `GridToolbar`.
- **Phase 3** — required `tableName` on `DataTableProps`; memoized
  `handleDownloadCsv` in `DataTable.tsx`.
- **Phase 4** — `tableName` threaded through all 19 production + 13 test
  mount sites; `tsc` clean.
- **Phase 5** — structural guard (`scripts/check-data-table-contract.mjs`)
  pins the menu item + required handler; verified it fails on regression.
- Decided open questions in v1: Q1 formula-error → `""`; Q2 linked_record →
  export accessor ids; Q3 catalogs keep both JSON export + universal CSV.

## Blockers

None.

## Verification

- `csv.test.ts` (11) + `csvDownload.test.tsx` (3) + `GridToolbar.test.tsx`
  CSV cases green; full data-table suite 1004 passing.
- `node scripts/check-data-table-contract.mjs` green; negative-tested to fail
  when the item/prop is removed.
- Closeout gate: `simplify` + `docs-pass` skills, `make format`, `make ci`.
</content>
