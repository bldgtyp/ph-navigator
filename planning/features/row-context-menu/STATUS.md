---
DATE: 2026-06-04
TIME: 17:00
STATUS: Active — Phases 1 + 2 + 3 landed; Phase 4 next
AUTHOR: Ed May / Claude
SCOPE: DataTable row context menu — status ledger
RELATED:
  - planning/features/row-context-menu/README.md
  - planning/features/row-context-menu/PRD.md
  - planning/features/row-context-menu/decisions.md
  - planning/features/row-context-menu/phases/
---

# Row Context Menu — Status

## Current state

`Active` — Phases 1 + 2 + 3 shipped on 2026-06-04. The library hosts
the shared `useGridMenuKeyboard` hook, the hoisted
`isPointerInActiveEditor` predicate, the new `RowContextMenu`
component, and the delegated `<tbody>` `contextmenu` + gutter
`Shift+F10` triggers. The full four-item menu (Insert / Duplicate /
Expand / Delete) is live with PRD §5 multi-row collapse. The
`rowDuplicate` `WriteOp` variant carries a full source-row snapshot
per PRD §6; CRUD consumers (Materials) call the new
`POST /catalogs/materials/{id}/duplicate` backend route with
server-side `(copy)` suffix resolution, and slice-replace consumers
(Rooms, Pumps) clone client-side via `nextCopySuffix` +
`*PayloadFromRowDuplicate` helpers without a per-row endpoint.

The revision corrected three structural issues in the V1 PRD:

1. The "every resource ships its own duplicate endpoint" rule
   contradicted the `project_document` slice-replace write model used
   by Rooms / Equipment. Resolved by D-1 (per-consumer-write-model
   dispatch) and D-2 (WriteOp carries `sourceRow` snapshot).
2. The library had no extension contract for consumer-defined row
   actions, even though consumers will need them as soon as feature
   work like "Submit to Phius library" lands. Resolved by D-3
   (`rowActions` render-prop slot) — Phase 4.
3. Phase 3 bundled five resources into one PR and three layers
   (library / backend / frontend). Resolved by D-10 (split into
   3a / 3b / 3c).

Two cross-cutting maintainability improvements bundle into Phase 1:
extract `useGridMenuKeyboard` from `HeaderContextMenu.tsx` (D-8) and
hoist `isPointerInActiveEditor` to a shared predicate (D-7).

## Next step

Begin Phase 4 (rowActions extension slot). Ships the
`rowActions?: (ctx) => RowAction[]` prop on `DataTableProps`, the
`RowAction` / `RowActionContext<TRow>` types, the menu renderer (with
the divider + suppression rule for the multi-row collapse branch),
and one DataTable-test consumer fixture. No production wiring; this
phase only delivers the slot.

## Phase ledger

| Phase | File | Status |
|---|---|---|
| 1 | `phases/phase-01-row-context-menu-shell.md` | Done |
| 2 | `phases/phase-02-multi-row-collapse.md` | Done |
| 3a | `phases/phase-03a-rowduplicate-op-and-materials.md` | Done |
| 3b | `phases/phase-03b-rooms-slice-replace-duplicate.md` | Done |
| 3c | `phases/phase-03c-pumps-slice-replace-duplicate.md` | Done |
| 4 | `phases/phase-04-row-actions-extension-slot.md` | Ready |

## Blockers

None.

## Verification

Per `PRD.md` §13. The closeout gate is `make format && make ci` from
the repo root, plus the new Playwright e2e cases for the gesture
surfaces and per-consumer Duplicate flows listed in each phase file.

## Open follow-ups (not blocking)

- Materials Duplicate + ⌘Z across an invalidate cycle is a pre-
  existing tmp-id ↔ real-id reconcile gap (PRD §14). Tracked here
  but not addressed by this feature.
- A future cell-context menu may justify revisiting D-9 and adopting
  `@radix-ui/react-context-menu` for all three menu surfaces.
- ERV and Fan tables will pick up the slice-replace duplicate
  helper pattern when their real tables land
  (today they render `PlaceholderEquipmentTable`).
