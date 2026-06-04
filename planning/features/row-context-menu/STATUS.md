---
DATE: 2026-06-04
TIME: 16:30
STATUS: Active — Phases 1 + 2 landed; Phase 3a next (keystone)
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

`Active` — Phases 1 + 2 shipped on 2026-06-04. The library hosts the
shared `useGridMenuKeyboard` hook, the hoisted
`isPointerInActiveEditor` predicate, the new `RowContextMenu`
component (single-row + multi-row collapse branches), and the
delegated `<tbody>` `contextmenu` + gutter `Shift+F10` triggers.
Single-row `Insert record` / `Expand record` / `Delete record` are
wired against existing handlers. Multi-row collapse (PRD §5 rules
1–3) freezes the selection snapshot at right-click time and reuses
the existing `deleteSelectedRows` path. No WriteOp change and no
backend work yet.

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

Begin Phase 3a (keystone). It lands the `rowDuplicate` `WriteOp`
shape, the Materials backend duplicate endpoint, the `(copy)` suffix
helper, and the Materials controller wiring. Phases 3b / 3c / 4 all
ride on the WriteOp contract from this phase.

## Phase ledger

| Phase | File | Status |
|---|---|---|
| 1 | `phases/phase-01-row-context-menu-shell.md` | Done |
| 2 | `phases/phase-02-multi-row-collapse.md` | Done |
| 3a | `phases/phase-03a-rowduplicate-op-and-materials.md` | Ready |
| 3b | `phases/phase-03b-rooms-slice-replace-duplicate.md` | Ready |
| 3c | `phases/phase-03c-pumps-slice-replace-duplicate.md` | Ready |
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
