---
DATE: 2026-07-20
TIME: 19:45 EDT
STATUS: Complete
AUTHOR: Claude with Ed May
SCOPE: Final state of the modal-consistency refactor (archived).
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
  - ./CATALOG.md
---

# Status — Modal Consistency Refactor

**State: Complete. Merged to `main` via #42 (2026-07-20) and archived here.**
All phases 00–06 landed and `make ci`-verified; the contract is folded into
`context/DESIGN_SYSTEM.md`. Merging was Ed's call. (Merging does not deploy —
production deploys are a separate, explicit step.)

## Done — all phases complete

- Static audit of all ~50 modal components (58 instances) → `CATALOG.md`;
  three-tier conformance model + defect quantification → `PRD.md`; contract
  **ratified by Ed 2026-07-20**; phased plan → `PLAN.md` (per-phase delivery
  notes in each section).
- **Phase 00** — shared-component upgrades: `ModalDialog` `showHeaderClose`
  default → `false`, new `dismissOnBackdrop` + `resizable` props; `DialogActions`
  gained `danger` + `extraActions`; `.modal-panel--resizable` + `.modal-actions-extra`
  CSS; contract documented in `DESIGN_SYSTEM.md` + `styles/README.md`.
- **Phase 01** — header-Close sweep; conformed `ConstructionDetailModal`; dropped
  redundant props.
- **Phase 02** — `RowEditModal` footer → `DialogActions` (Save primary, Delete
  danger extra, resizable), cascading to all 7 row-edit modals.
- **Phase 03** — ~15 single-primary partials → `DialogActions` (catalogs /
  climate / projects / status / model_viewer / project_document / equipment /
  envelope); caught + fixed the stranded `DiffDialog` viewer.
- **Phase 04** — multi-action footers via `extraActions`
  (`DocumentConfirmationDialog` ×5 variants, `WeatherStationPickerModal`,
  `CatalogOptionCascadeModal`); removed orphaned footer CSS.
- **Phase 05** — apertures rogue modals (`ManufacturerFiltersModal`,
  `RefreshDialog`) → `ModalDialog` + `DialogActions`; removed bespoke chrome CSS;
  forms no longer dismiss on backdrop.
- **Phase 06** — Radix data-table family conformed (D-3): chrome aligned to the
  shared `.modal-panel` box + resize on `FieldConfigModal`; footers → `.modal-actions`
  shape; four unstyled primaries styled.

## Next step

None — refactor complete, merged, and archived. Follow-up candidates only:
`EditUserFieldModal`'s generic "OK" primary (label-polish sweep) and the
deliberate deviations listed below.

## Blockers / decisions

None. Contract ratified (D-1); multi-action footer shape (D-2, `extraActions`);
Radix family disposition (D-3, keep + conform). See `decisions.md`.

## Verification (evidence)

- Every phase: `make format` + `make ci` **green** (full local CI mirror —
  frontend build + the complete vitest suite + all guards + backend).
- Focused/updated RTL coverage for touched modals, e.g. the data-table suite
  (1074 tests), `App.test` (DocumentConfirmationDialog flows),
  `WeatherStationPickerModal`, `RowEditModal`/`recordDetailExpand`,
  `ManufacturerFiltersModal`/`RefreshDialog`, `PhiusExportDialog`, `ImportDialog`.
- Phase 00 ran the 4-agent `simplify` fan-out; Phase 03 ran two independent
  review agents (all findings applied).
- Live browser screenshot (`agent-browser.mjs`) of `NewProjectModal` confirmed
  the live contract: shared panel, **Cancel (left) + styled Create Project
  (right)**, no header Close. Most modals need selected-row / admin / draft state
  and were code + unit-test verified (per the plan's reachability caveat).

## Residual / deliberate deviations (all recorded in `PLAN.md`)

- `SetLocationModal` left as-is (primary already styled + MapPin icon).
- 3× `ImportDialog` wizards left as-is (report stage already styled; pick/done
  stages don't fit the single-primary `DialogActions` shape).
- `ConfirmDeleteOptionDialog` primary kept as "Delete" (title already specifies).
- `EditUserFieldModal` still has a generic "OK" primary — a gold modal already on
  `DialogActions`, out of the partial/rogue conversion scope; a candidate for a
  future label-polish sweep.
- The switch-variant `DocumentConfirmationDialog` locked-primary lost its hover
  tooltip (DialogActions primary has no title slot; the body explains the state).

## Notes

- `working/modal-consistency-catalog.md` scratch draft can be deleted; the
  tracked copy is `CATALOG.md`.
