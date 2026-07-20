---
DATE: 2026-07-20
TIME: 17:50 EDT
STATUS: Active
AUTHOR: Claude with Ed May
SCOPE: Phased implementation sequence for the modal-consistency refactor.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./CATALOG.md
---

# Modal Consistency Refactor — Implementation Plan

Phases are ordered by leverage: shared components first, then the high-count
clusters that one fix cascades across, then the bespoke islands. Each phase is
independently shippable on a feature branch and leaves `main` deployable. Every
phase ends with `make format` + focused tests + a browser screenshot of the
touched modals against the contract in `PRD.md §"The Modal Contract"`.

Contract acceptance checklist (apply per modal, every phase):
- [ ] Footer via `DialogActions`; Cancel left, primary right; no unstyled buttons
- [ ] Header "Close" dropped (footer modals) / kept only on read-only viewers
- [ ] Labels: literal "Cancel"; specific primary verb; standard busy ellipsis
- [ ] Shared `.modal-panel` box; resize handle if the panel scrolls
- [ ] Backdrop-click: off for forms, on for viewers

---

## Phase 00 — Contract + shared-component upgrades (enabling)

No per-feature modal touched yet; this makes the contract expressible.

- `ModalDialog`: flip `showHeaderClose` default to `false`. Add whatever the
  backdrop-click policy needs (e.g. `dismissOnBackdrop?: boolean`, default
  `false`; wire the backdrop `onClick`).
- `DialogActions`: add a `danger` (or `variant`) prop for destructive primaries;
  add the multi-action slot decided in PRD Open-Q #1.
- `.modal-panel` CSS: add the oversized-resize affordance (`resize` + min/max)
  as an opt-in modifier class (e.g. `.modal-panel--resizable`) so only
  large/data-dense modals get the corner grip.
- Update `context/DESIGN_SYSTEM.md` modal section + `styles/README.md` to state
  the contract as the blessed pattern; add a guard/lint note if feasible.
- Verify the 10 gold modals still render correctly after the default flip
  (they currently pass `showHeaderClose` implicitly true — audit whether any is
  a viewer that must now opt in).

## Phase 01 — Drop the redundant header "Close" app-wide (highest-impact sweep)

Mechanical, one-line-per-modal, resolves the 34 double-dismiss instances.

- With the default now `false`, remove now-redundant `showHeaderClose` and
  confirm each footer modal shows only footer Cancel.
- Add `showHeaderClose` back on the read-only viewers: `UserAuditModal`,
  `ConstructionDetailModal`, read-only `RecordDetailModal`.
- Screenshot sweep: every modal has exactly one obvious dismiss.

## Phase 02 — `RowEditModal` cluster (1 fix → 7 modals)

- Fix `frontend/src/shared/ui/data-table/row-edit.tsx`: footer via `DialogActions`
  (Save gets `primary-button`, Delete gets `danger-button`), contract labels,
  resizable panel (these forms are tall).
- Verifies across: `RoomModal`, `VentilatorRowModal`, `IndoorEquipRowModal`,
  `IndoorUnitRowModal`, `OutdoorEquipRowModal`, `OutdoorUnitRowModal`,
  `RecordDetailModal`.

## Phase 03 — "own-footer, single-primary" partials → `DialogActions`

Bulk mechanical conversion; the biggest count of the "missing `.primary-button`"
defect lives here. Group by feature area for parallel work:

- catalogs: `FrameTypeCreateModal`, `MaterialEditorModal`, 3× `ImportDialog`,
  `CatalogOptionCascadeProgressModal`
- climate: `ClimateDatasetPickerModal`, `ClimateUploadModal`, `SetLocationModal`,
  `WeatherStationPickerModal`
- projects: `NewProjectModal`, `ProjectSettingsModal`, `DeleteProjectsModal`
- admin: `OneTimeLinkModal`
- status: `StatusItemModal`, `StatusDeleteDialog`
- model_viewer: `DeleteFileDialog`
- project_document: `DraftRestoreDialog`, `DocumentConfirmationDialog` (discard)
- equipment: `ConfirmDeleteRoomDialog`, `PhiusExportDialog`, `BlockedDeleteDialog`
- documentation: `DirectionsModal`
- envelope: `SegmentDetailDialog`, `ProjectMaterialEditorModal`

## Phase 04 — Multi-action footers (needs Phase 00 multi-slot)

- `DocumentConfirmationDialog` family (discard / unlock / stale-save / switch —
  up to 4 buttons; the switch variant is HIGH severity).
- `WeatherStationPickerModal` (3-button), `CatalogOptionCascadeProgressModal`
  (Retry/Try-again/Done states).
- Use the `DialogActions` multi-action slot; establish button-priority order.

## Phase 05 — Rogue: apertures bespoke backdrops → `ModalDialog`

- `ManufacturerFiltersModal`, `RefreshDialog`: delete the copy-pasted
  `*-modal__` / `*-dialog__` backdrop+panel CSS, adopt `ModalDialog` +
  `DialogActions`. `RefreshDialog` is large/tabular → resizable panel.

## Phase 06 — Rogue: data-table Radix family (highest judgment)

- Decide per PRD Open-Q #2 (recommend: keep Radix, conform the shell).
- Targets: `FieldConfigModal`, `CreateFieldConfigModal`, `ConfirmDestructiveDialog`,
  `ConfirmDeleteOptionDialog` (and wrappers `DeleteDimensionDialog`,
  `CascadePreviewDialog`).
- Bring width/padding to the shared box, footer to `DialogActions` shape, apply
  the header-Close rule, add resize to `FieldConfigModal`.
- Heaviest phase — `FieldConfigModal` alone is ~960 lines with three nested
  bespoke chrome surfaces (main dialog + confirmation alert + conflict banner).

---

## Sequencing notes

- Phases 00→01 are a natural first PR (shared change + the highest-visibility
  sweep). 02 next (big cascade). 03 can fan out to parallel per-area agents.
  04–06 each carry a decision and should be their own PRs.
- Keep each phase's diff reviewable; do not bundle a rogue migration with the
  mechanical sweeps.
