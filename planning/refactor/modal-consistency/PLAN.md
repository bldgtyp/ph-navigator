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

## Phase 00 — Contract + shared-component upgrades (enabling) — ✅ DONE

No per-feature modal touched yet; this makes the contract expressible.

Delivered: `showHeaderClose` default flipped to `false` + `dismissOnBackdrop`
prop on `ModalDialog`; `danger` + `extraActions` slot on `DialogActions`;
`.modal-panel--resizable` + `.modal-actions-extra` in `modals.css`; contract
documented in `DESIGN_SYSTEM.md` + `styles/README.md`. Footer-less consumers
`UserAuditModal` / `DirectionsModal` (viewers) and `ProjectMaterialEditorModal`
(form, Phase-03 TODO) protected from the flip.

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

## Phase 01 — Drop the redundant header "Close" app-wide (highest-impact sweep) — ✅ DONE

Mechanical, one-line-per-modal, resolves the 34 double-dismiss instances.

- With the default now `false`, remove now-redundant `showHeaderClose` and
  confirm each footer modal shows only footer Cancel.
- Add `showHeaderClose` back on the read-only viewers: `UserAuditModal`,
  `ConstructionDetailModal`, read-only `RecordDetailModal`.
- Screenshot sweep: every modal has exactly one obvious dismiss.

Delivered: the Phase-00 default flip already removed header Close from every
footer modal. Removed the now-redundant `showHeaderClose={false}` from
`SegmentDialog` + `LengthDialog`. Conformed `ConstructionDetailModal` to the
standard viewer affordance — dropped its custom `X` icon-button close for
`showHeaderClose` + `dismissOnBackdrop`, and made it `resizable` (dense layer
table). `UserAuditModal` + `DirectionsModal` already opted in (Phase 00);
read-only `RecordDetailModal` keeps its single footer "Close" (via
`RowEditModal`), so no header Close is added there (would double-dismiss).
Added a `resizable` prop to `ModalDialog` to apply `.modal-panel--resizable`.
`CatalogOptionCascadeModal`'s conditional header Close is deferred to Phase 04
(multi-action footer rework).

## Phase 02 — `RowEditModal` cluster (1 fix → 7 modals) — ✅ DONE

- Fix `frontend/src/shared/ui/data-table/row-edit.tsx`: footer via `DialogActions`
  (Save gets `primary-button`, Delete gets `danger-button`), contract labels,
  resizable panel (these forms are tall).
- Verifies across: `RoomModal`, `VentilatorRowModal`, `IndoorEquipRowModal`,
  `IndoorUnitRowModal`, `OutdoorEquipRowModal`, `OutdoorUnitRowModal`,
  `RecordDetailModal`.

Delivered: edit mode now renders the footer through `DialogActions` — Save is a
styled `primary-button` (was an unstyled submit), Delete rides the new
`extraActions` slot as a `danger-button`, error uses the `DialogActions`
`.form-error` slot. Read-only mode keeps its single "Close" viewer footer and
gains backdrop dismiss; the panel is `resizable`. All 7 consumers inherit the
fix. Verified by the row-edit + record-detail + heat-pump unit suites (268
tests green) + `make ci`; live modal is reachable only via a right-click
context menu (outside the browser-driver `--click` DSL), so verification is
code + unit-test based for this phase.

## Phase 03 — "own-footer, single-primary" partials → `DialogActions` — ✅ DONE

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

Delivered: converted the hand-rolled single-primary footers to `DialogActions`
across catalogs (`FrameTypeCreateModal`, `MaterialEditorModal`), climate
(`ClimateUploadModal`, both branches of `ClimateDatasetPickerModal`), projects
(`NewProjectModal`, `ProjectSettingsModal` edit-mode; viewer-mode keeps a single
"Close"), status (`StatusItemModal`, `StatusDeleteDialog`), model_viewer
(`DeleteFileDialog`), project_document (`DraftRestoreDialog` two-choice styled;
`SaveAsDialog` → DialogActions; `DiffDialog` was a **stranded** footer-less
viewer — restored header Close + backdrop + resizable), equipment
(`ConfirmDeleteRoomDialog`, `PhiusExportDialog` ready-state, `BlockedDeleteDialog`
→ single "Close"), and envelope (`ProjectMaterialEditor` child footer +
`SegmentDetailDialog` backdrop). Destructive confirms use `danger`; busy labels
standardized to the "…" ellipsis; `DeleteFileDialog` primary is now "Delete file".
`OneTimeLinkModal` "Done" → "Close" (info viewer). Bulk mechanical batch of 9 was
implemented by gpt-5.5/Codex and reviewed here; the nuanced ones by Claude.

Deliberate exceptions (already contract-compliant / would regress):
- `SetLocationModal` — primary is already a styled `.primary-button` with a
  MapPin icon + contextual multi-error layout; converting would drop the icon
  for no visual gain. Left as-is.
- 3× `ImportDialog` (materials/glazings/frames) — multi-stage wizards; the
  report stage already uses a styled `primary-button` (Cancel + "Import N rows"),
  the pick stage has no primary, the done stage is a single acknowledge. All
  buttons already styled; DialogActions doesn't model the wizard stages. Left.
- `DirectionsModal` — handled in Phase 00 as a read-only viewer (not a footer
  conversion).
- `CatalogOptionCascadeModal`, `WeatherStationPickerModal`,
  `DocumentConfirmationDialog`/Save-Version dialog — multi-action, deferred to
  Phase 04.

## Phase 04 — Multi-action footers (needs Phase 00 multi-slot) — ✅ DONE

- `DocumentConfirmationDialog` family (discard / unlock / stale-save / switch —
  up to 4 buttons; the switch variant is HIGH severity).
- `WeatherStationPickerModal` (3-button), `CatalogOptionCascadeProgressModal`
  (Retry/Try-again/Done states).
- Use the `DialogActions` multi-action slot; establish button-priority order.

Delivered: all five `DocumentConfirmationDialog` variants → `DialogActions`.
Button priority is fixed by the shared anchors: Cancel (left), secondary/tertiary
actions in `extraActions` (middle), the recommended primary (right). Specifically —
discard: `danger` "Discard draft"; unlock: "Unlock version"; switch (4-button):
Cancel · [Save As… then open, Discard changes(danger)] · **Save then open**;
stale-save & locked-save (shared `StaleOrLockedActions` helper): Cancel ·
[Discard draft(danger)] · **Save As**. The old "Keep draft" cancel-slot label is
now the literal "Cancel" (per contract). `WeatherStationPickerModal` (both
branches) → DialogActions with the shared "Upload Climate Data" `extraActions`.
`CatalogOptionCascadeModal` error/failed states → DialogActions; the completed
state's generic "Done" → a single "Close". Removed the now-orphaned
`.climate-picker-actions*`, `.catalog-option-cascade-actions`, and
`.modal-actions-stack` CSS. Verified by `App.test` (DocumentConfirmationDialog
flows) + `WeatherStationPickerModal.test` + `make ci`.

Minor tradeoff: the switch variant's locked-primary lost its hover tooltip
("Locked versions cannot be saved directly.") since DialogActions' primary has
no title slot — the modal body already explains the locked state.

## Phase 05 — Rogue: apertures bespoke backdrops → `ModalDialog` — ✅ DONE

- `ManufacturerFiltersModal`, `RefreshDialog`: delete the copy-pasted
  `*-modal__` / `*-dialog__` backdrop+panel CSS, adopt `ModalDialog` +
  `DialogActions`. `RefreshDialog` is large/tabular → resizable panel.

Delivered: both adopted `ModalDialog` + `DialogActions`, `resizable`. Their
bespoke backdrop dismissed on click even though they hold unsaved input — the
shared shell now correctly does NOT dismiss forms on backdrop (edit mode);
`ManufacturerFiltersModal`'s read-only viewer mode opts into `dismissOnBackdrop`
+ a single "Close". Read-only / catalog-row-missing states render a single
"Close"; edit states use the Save primary. Removed the orphaned
`.manufacturer-modal__{backdrop,header,footer,save}`, `.manufacturer-modal`
panel, and the `.refresh-dialog__{backdrop,subtitle,footer,save}` / panel CSS
(surgically split out of the rules shared with the still-rogue
`aperture-drift-modal` / `project-refs`, which are out of scope). Verified by
the ManufacturerFiltersModal + RefreshDialog suites + `make ci`.

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
