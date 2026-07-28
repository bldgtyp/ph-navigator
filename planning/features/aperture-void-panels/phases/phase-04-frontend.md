---
DATE: 2026-07-28
TIME: 09:17 EDT
STATUS: Not started
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 4 — builder UI: void rendering, element card, kind toggle,
  pick/paste/merge guards.
RELATED: ../PRD.md §5, ../decisions.md D-1 D-3 D-4,
  ../../..//context/ui/pages/apertures-tab.md, context/DESIGN_SYSTEM.md
---

# Phase 4 — Frontend

Read `context/ui/pages/apertures-tab.md` + `context/DESIGN_SYSTEM.md` before
starting; reuse blessed components/tokens (guards reject off-system CSS).
All work under `frontend/src/features/apertures/`.

## Canvas

- `ApertureSvgCanvas.tsx` (+ overlay/hit-target layers): render
  `kind === "void"` cells as "not there" (D-4): **near-fully transparent
  fill + dashed outline** from design tokens — only very lightly shown. No
  glazing inset, no solid frame edges, no operation symbols, no U-value chip.
  Keep selection affordance (converting back, naming, merging all require
  selecting a void); selection/hover states must remain visible against the
  near-transparent base.
- Void cells get a tooltip carrying the standard explanation (see below).
- Dimension strips/labels, name pill, total-dimensions caption: unchanged.

## Element card — `ApertureElementCard.tsx`

- Void state: hide `FramesPanel`, `GlazingRow`, `OperationRow`, `UValueChip`;
  show caption *"Empty — not part of the aperture. Excluded from U-value and
  exports."* + the kind toggle. Name row stays.
- Glazed state: add the kind toggle ("Empty" label, D-1) in the card
  (placement consistent with `OperationRow`-style rows).
- **Tooltips are part of D-1**: one standard explanation string, used on the
  toggle, the void-state caption, and canvas void cells — e.g. *"Empty panel:
  occupies the layout but is not part of the window unit. The area is wall;
  it is excluded from U-value, spec report, and all exports."* Keep it as a
  single shared constant so wording stays consistent.
- Toggle glazed→void with any assignment present: confirm dialog listing what
  will be cleared (D-3), then dispatch `setElementKind`. Follow the existing
  dialog pattern (`DeleteApertureDialog.tsx` / `DeleteDimensionDialog.tsx`).

## Interaction guards (mirror server; server remains the authority)

- `pick-paste-machine.ts`: voids are invalid pick sources and paste
  targets/sources — same UX as other invalid targets.
- `merge-validation.ts`: mixed-kind merge invalid with a reason string
  consistent with existing invalid-merge messages; void+void allowed.
- `operation-*`/`picker-filters` surfaces: not reachable for voids once the
  card hides the rows; verify nothing else (keyboard shortcuts, context
  menus, `ApertureCanvasToolbar.tsx`) can dispatch picks/operation onto a
  void.

## Command wiring

- `api.ts` / `hooks.ts` / store: dispatch `setElementKind` through the same
  mutation path as `setElementOperation`; optimistic-update strategy identical
  to neighboring commands (copy the established pattern).

## Tests

- vitest: merge-validation kind rules; pick-paste machine void guards; element
  card renders void state (hidden panels + caption + tooltip); confirm-dialog
  flow dispatches the command only on confirm.
- Browser smoke (`make agent-browser-ready` + `frontend/scripts/agent-browser.mjs`,
  per `context/USING_A_WEB_BROWSER.md`): build the S15 layout end-to-end —
  create type, shape the grid, span the door, convert two cells to Empty,
  confirm U-chip + canvas states; `--settle 1200` when verifying persisted
  state. Screenshot into the feature `assets/`.

## Verification

`pnpm run format`, `make frontend-dev-check`, then `make ci` green.
