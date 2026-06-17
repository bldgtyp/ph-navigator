---
DATE: 2026-06-17
TIME: 12:24 EDT
STATUS: Complete - covered by Phase 06 full CI/browser closeout
AUTHOR: Ed (via Claude)
SCOPE: Extract shared column/cell building blocks (link cell, attachment
  column, identifier column, width constants, number-input helpers) and
  adopt them across the equipment tables and Thermal Bridges.
RELATED:
  - planning/archive/data-table-consolidation/PRD.md
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

1. [x] **Link cell + `shortenUrl` (F3).** Add a shared `LinkCell` /
   `linkColumn` helper plus a single `shortenUrl` util in
   `shared/ui/data-table` (or a shared lib). Replace the 7 `shortenUrl`
   copies and the ~6 hand-built `<a className="data-table-link-cell">`
   column blocks. Reconcile the Pumps `link` vs others' `url` field key
   (rename or document why it differs).
2. [x] **Attachment column builder (F3).** Add a shared helper that builds the
   attachment column (the `AttachmentCell` + `sameAttachmentAssetIds`
   guard + `.join`/count `measureText` + `onWrite`). Adopt it in
   Appliances, Fans, HotWaterHeaters, HotWaterTanks, Pumps, and Thermal
   Bridges. Pass a properly typed `assetUrlById` (remove the
   `as never` escapes that Phase 05 will also touch).
3. [x] **Identifier column helper (F7).** Pick one identifier-column
   implementation and expose it as a shared helper adopted by the 7
   equipment tables and Thermal Bridges so the identifier column and its
   default width are uniform. **Baseline is already settled** by the
   landed record-identity-model refactor
   (`planning/archive/record-identity-model/`, schema v8): the pinned
   identifier is the Display Name column flagged
   `isIdentifier: true` on its `DataTableColumnDef` (selected by
   `identifierColumnId()`, pinned by `useGridColumns`, chipped by
   `computeIdentifierDuplicates`) - NOT a hardcoded `record_id` /
   `RECORD_ID_FIELD_KEY` field key and NOT a synthetic `__record_id__`
   column. The shared helper must flag the right column as the
   identifier and feed it the shared default width; it inherits the
   label, non-unique behavior, and "Display Name" naming from the
   identity refactor - do not re-decide them here.
4. [x] **Width constants (F9).** Introduce semantic width constants (link,
   notes, attachment, record-id, small-numeric) and feed them through the
   existing `resolveColumnWidth` / `FIELD_TYPE_DEFAULT_WIDTH` helpers.
   Replace the magic-number `defaultWidth` literals and reconcile the
   `phase`/`volts` width drift.
5. [x] **Number-input helpers (F3).** Consolidate the three number-input
   parsers (`heat-pumps/lib.ts:numericValue`, the `model_viewer` copy,
   `VentilatorRowModal:readNumberInput`) into one shared util. (The
   modal field-wrappers move in Phase 03.)
6. [x] **Dedupe `OPTION_COLOR_PALETTE`.** Make `heat-pumps/lib.ts` import the
   shared `OPTION_COLOR_PALETTE` instead of re-declaring it.
7. [x] **Tests.** Add tests for each shared helper (link rendering,
   attachment column write/guard, identifier column, width resolution)
   and update table tests to assert against shared output.

## Acceptance Criteria

- [x] No feature table defines `shortenUrl`, a hand-built URL column block, a
  hand-built attachment column block, or a bespoke identifier column.
- [x] Column widths come from named constants via the shared resolver; no
  unexplained magic-number `defaultWidth` literals remain on the
  converged columns.
- [x] One shared number-input parser is used; `OPTION_COLOR_PALETTE` has one
  source of truth.
- [x] Link, attachment, and identifier columns render through the same
  helpers across all equipment tables and Thermal Bridges; focused
  helper tests cover the shared output. Browser sweep deferred to
  Phase 06.
- [x] Focused frontend tests pass; `make frontend-dev-check` is green.

## Implementation Notes

- Added `frontend/src/shared/ui/data-table/columns.tsx` with
  `LinkCell`, `linkColumn`, `attachmentColumn`, `identifierColumn`,
  `identifierColumnDef`, `shortenUrl`, and `DATA_TABLE_COLUMN_WIDTHS`.
- Moved editable numeric blank/invalid parsing to the neutral
  `parseNumberInput` helper in `frontend/src/lib/units/format.ts`.
  Model Viewer keeps its previous finite-number-only formatting helper.
- Moved ordered string-array equality to
  `frontend/src/shared/lib/arrays.ts`; `sameAttachmentAssetIds` now
  delegates to it.
- Adopted the shared helpers in Rooms, Pumps, Ventilators, Appliances,
  Fans, HotWaterHeaters, HotWaterTanks, ElectricHeaters, and Thermal
  Bridges. Pumps keeps its persisted `link` field key; other tables keep
  `url`.
- `attachmentColumn` supports both the generic table `onWrite` adapter
  and a direct `(row, next)` callback so Phase 05 Heat Pump builders can
  adopt it without changing the helper API.

## Simplify Outcome

- Reuse/quality/efficiency reviewers flagged three cleanup items:
  neutralize `parseNumberInput`, dedupe ordered string-array equality,
  and generalize `attachmentColumn` beyond `onWrite`.
- Applied those fixes. Kept the attachment no-op guard in
  `attachmentColumn` because the helper accepts any compatible
  attachment cell implementation, not only the current asset
  `AttachmentCell`.
- Heat Pump sub-table attachment columns still carry `as never` casts;
  this is intentionally left for Phase 05, where those sub-tables move
  onto the shared abstraction.

## Verification

- `make format`
- `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/columns.test.tsx src/shared/ui/data-table/__tests__/columnWidths.test.ts src/shared/ui/data-table/__tests__/identifierColumn.test.tsx`
  passed: 3 files, 29 tests.
- `cd frontend && pnpm exec tsc --noEmit` passed.
- `make frontend-dev-check` passed. It still reports Fast Refresh
  warnings in existing Apertures files and in the new shared column
  helper module; there are no lint errors.
- Full `make ci` was intentionally held for Phase 06; Phase 06 later passed full CI.
- Browser smoke was completed in Phase 06.

## Docs-Pass

- Updated `context/technical-requirements/data-table.md` with the
  durable shared column-builder contract.

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
