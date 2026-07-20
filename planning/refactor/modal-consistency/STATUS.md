---
DATE: 2026-07-20
TIME: 17:50 EDT
STATUS: Active
AUTHOR: Claude with Ed May
SCOPE: Current state of the modal-consistency refactor.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
  - ./CATALOG.md
---

# Status — Modal Consistency Refactor

**State:** Implementation in progress on branch `refactor/modal-consistency`
(off `main`). Phases 00–04 complete; Phases 05–06 pending.

## Done

- Static audit of all ~50 modal components (58 instances) via 9-agent fan-out →
  `CATALOG.md`.
- Three-tier conformance model + recurring-defect quantification → `PRD.md`.
- Modal contract **ratified by Ed 2026-07-20**: canonical footer Cancel / drop
  header Close; footer always `DialogActions`; specific labels; shared box with
  resize handle when oversized; backdrop-click off for forms / on for viewers.
- Phased plan → `PLAN.md`.
- **Phase 00 (shared-component upgrades) — DONE.** `ModalDialog`
  `showHeaderClose` default flipped to `false` + new `dismissOnBackdrop` prop;
  `DialogActions` gained `danger` + `extraActions` slot; `.modal-panel--resizable`
  + `.modal-actions-extra` CSS; contract documented in `DESIGN_SYSTEM.md` +
  `styles/README.md`. Three footer-less consumers protected from the default
  flip (`UserAuditModal`, `DirectionsModal` as viewers; `ProjectMaterialEditorModal`
  with a Phase-03 TODO). Two modal tests updated for the new default.

## Next step

Phase 05 — rogue apertures bespoke backdrops → `ModalDialog`:
`ManufacturerFiltersModal` and `RefreshDialog` (delete the copy-pasted
`*-modal__` / `*-dialog__` backdrop+panel CSS, adopt `ModalDialog` +
`DialogActions`; `RefreshDialog` is large/tabular → resizable).

## Blockers / decisions

None outstanding. Contract ratified (D-1); multi-action footer shape decided
(D-2, `extraActions` slot); Radix family disposition decided (D-3, keep + conform).

## Verification approach

Static audit only so far. Implementation phases each add: focused RTL tests for
touched modals, `make format`, `make ci` for substantial phases, and a live
browser screenshot (`agent-browser.mjs`) of each touched modal checked against
the contract. Reachability varies (some modals need selected rows / admin /
draft state) — screenshot the reachable ones, code-verify the rest.

## Notes

- `working/modal-consistency-catalog.md` was the scratch draft; the tracked copy
  is `CATALOG.md` here. The scratch copy can be deleted.
