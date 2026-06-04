---
DATE: 2026-06-04
TIME: 14:30
STATUS: Active — phase files ready for handoff
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

`Active` — PRD revised after architectural review (2026-06-04). Six
phase files written and ready for hand-off. No code written yet.

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

Begin Phase 1 implementation. The phase file
(`phases/phase-01-row-context-menu-shell.md`) is self-contained and
includes the acceptance criteria, file list, key code shapes, and
test plan. The closeout gate per `CLAUDE.md` (`make format` +
`make ci`) is the final check.

## Phase ledger

| Phase | File | Status |
|---|---|---|
| 1 | `phases/phase-01-row-context-menu-shell.md` | Ready |
| 2 | `phases/phase-02-multi-row-collapse.md` | Ready |
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
