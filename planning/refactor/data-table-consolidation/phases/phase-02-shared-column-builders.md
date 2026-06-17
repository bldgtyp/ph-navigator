---
DATE: 2026-06-16
TIME: 16:09 EDT
STATUS: Planned
AUTHOR: Ed (via Claude)
SCOPE: Extract shared column/cell building blocks (link cell, attachment
  column, identifier column, width constants, number-input helpers) and
  adopt them across the equipment tables and Thermal Bridges.
RELATED:
  - planning/refactor/data-table-consolidation/PRD.md
  - planning/code-reviews/2026-06-16/data-table-consistency-review.md
  - frontend/src/shared/ui/data-table/
  - frontend/src/features/equipment/components/
  - frontend/src/features/assets/thermal-bridges/ThermalBridgesTable.tsx
---

# Phase 02 - Shared Column Builders

## Goal

Remove the copy-paste column/render code that every table re-implements
by extracting shared, typed building blocks and adopting them. Targets:
the URL/link column (and `shortenUrl`), the attachment column, the
identifier column, named width constants, and number-input helpers
(review F3, F7, F9).

## Preconditions

- Phase 00 complete (shared single-select cell exported; dead render code
  removed), so the tables are at a smaller, correct baseline.

## Tasks

1. **Link cell + `shortenUrl` (F3).** Add a shared `LinkCell` /
   `linkColumn` helper plus a single `shortenUrl` util in
   `shared/ui/data-table` (or a shared lib). Replace the 7 `shortenUrl`
   copies and the ~6 hand-built `<a className="data-table-link-cell">`
   column blocks. Reconcile the Pumps `link` vs others' `url` field key
   (rename or document why it differs).
2. **Attachment column builder (F3).** Add a shared helper that builds the
   attachment column (the `AttachmentCell` + `sameAttachmentAssetIds`
   guard + `.join`/count `measureText` + `onWrite`). Adopt it in
   Appliances, Fans, HotWaterHeaters, HotWaterTanks, Pumps, and Thermal
   Bridges. Pass a properly typed `assetUrlById` (remove the
   `as never` escapes that Phase 05 will also touch).
3. **Identifier column helper (F7).** Pick one identifier-column
   implementation and expose it as a shared helper adopted by the 7
   equipment tables and Thermal Bridges so the identifier column and its
   default width are uniform. **Baseline is already settled** by the
   landed record-identity-model refactor
   (`planning/refactor/record-identity-model/`, schema v8): the pinned
   identifier is the Display Name column flagged
   `isIdentifier: true` on its `DataTableColumnDef` (selected by
   `identifierColumnId()`, pinned by `useGridColumns`, chipped by
   `computeIdentifierDuplicates`) - NOT a hardcoded `record_id` /
   `RECORD_ID_FIELD_KEY` field key and NOT a synthetic `__record_id__`
   column. The shared helper must flag the right column as the
   identifier and feed it the shared default width; it inherits the
   label, non-unique behavior, and "Display Name" naming from the
   identity refactor - do not re-decide them here.
4. **Width constants (F9).** Introduce semantic width constants (link,
   notes, attachment, record-id, small-numeric) and feed them through the
   existing `resolveColumnWidth` / `FIELD_TYPE_DEFAULT_WIDTH` helpers.
   Replace the magic-number `defaultWidth` literals and reconcile the
   `phase`/`volts` width drift.
5. **Number-input helpers (F3).** Consolidate the three number-input
   parsers (`heat-pumps/lib.ts:numericValue`, the `model_viewer` copy,
   `VentilatorRowModal:readNumberInput`) into one shared util. (The
   modal field-wrappers move in Phase 03.)
6. **Dedupe `OPTION_COLOR_PALETTE`.** Make `heat-pumps/lib.ts` import the
   shared `OPTION_COLOR_PALETTE` instead of re-declaring it.
7. **Tests.** Add tests for each shared helper (link rendering,
   attachment column write/guard, identifier column, width resolution)
   and update table tests to assert against shared output.

## Acceptance Criteria

- No feature table defines `shortenUrl`, a hand-built URL column block, a
  hand-built attachment column block, or a bespoke identifier column.
- Column widths come from named constants via the shared resolver; no
  unexplained magic-number `defaultWidth` literals remain on the
  converged columns.
- One shared number-input parser is used; `OPTION_COLOR_PALETTE` has one
  source of truth.
- Link, attachment, and identifier columns render identically across all
  equipment tables and Thermal Bridges - verified in the browser.
- Focused frontend tests pass; `make frontend-dev-check` is green.

## Stop Conditions

- Stop if a "shared" attachment column needs per-table branching that
  would make the helper more complex than the copies it replaces;
  re-scope the helper's parameters first.
- Stop if adopting the shared identifier helper on a table changes its
  persisted view-state keys in a way that breaks saved widths/sort. The
  identifier column now has an ordinary column id (no `__record_id__`
  reserved key), so `sanitizeViewStateForSchema` round-trips it through
  the generic `columnIds` set; confirm that still holds for each adopted
  table before shipping.

## File Entry Points

- `frontend/src/shared/ui/data-table/` (new shared column/cell helpers
  + `index.ts` exports)
- `frontend/src/features/equipment/components/*Table.tsx`
- `frontend/src/features/equipment/heat-pumps/lib.ts`
- `frontend/src/features/assets/thermal-bridges/ThermalBridgesTable.tsx`
- `frontend/src/shared/ui/data-table/__tests__/columnWidths.test.ts`
