# Phase 03 — "Installs" sub-tab (library table page)

```
DATE:    2026-08-03
TIME:    11:55
STATUS:  ✅ Complete 2026-08-04 — implemented on feature/aperture-psi-install;
         `make ci` green; as-built amendments at the end of this file
AUTHOR:  Ed + Claude
SCOPE:   Frontend (+ trivial backend none). Fifth Apertures sub-tab hosting the
         aperture_install_types DataTable page — the ThermalBridgesPage recipe
         cloned into the apertures feature.
RELATED: ../decisions.md (D-2, D-6b, D-7, D-9), ../research.md §5.3, phase-01
```

Read first: `frontend/.instructions.md`, `context/ui/pages/apertures-tab.md`,
`context/DESIGN_SYSTEM.md`. Iron law: DataTable affordances are parent-owned —
clone the TB page wholesale, don't hand-roll
(`frontend/src/features/assets/thermal-bridges/` + `routes/ThermalBridgesPage.tsx`
are the template).

## 1. Sub-tab

- `frontend/src/features/apertures/paths.ts`: add `installs` leaf.
- `frontend/src/features/apertures/routes/AperturesTab.tsx` sub-tab bar
  (`:374-393`): `Apertures | Glazings | Frames | Installs | U-Values`.
  Label: **Installs**. Tab copy (one line, match sibling tone): "Window
  install psi-values (Ψ-install) and their justification reports."
- Note `AperturesTab.tsx` carries a `@size-exception`; if the new wiring
  pushes it further, extract the sub-tab routing into a helper rather than
  growing the exception.

## 2. Feature module `frontend/src/features/apertures/installs/`

Clone from `features/assets/thermal-bridges/`:

- `constants.ts` — built-in FieldDef overlay (lock the attachment + status
  columns like TB `constants.ts:107-112`), attachment configs:
  `PDF_REPORT_ATTACHMENT_CONFIG` clone (`assetKind: "datasheet"`,
  `["application/pdf"]`, max 5 × 25 MB) + standard datasheet/photo configs;
  conflict messages.
- `payloads.ts` — `SlicePayloadBuilders` clone (rows / fromCellWrites /
  fromRowInsert / fromRowDelete / fromRowDuplicate / validate). New rows get
  `apit_` ids following the TB id-mint pattern; `apit_default` row: block
  delete client-side too (server 409 is authority — D-8) and surface the
  409 usage-count payload as the row-delete error message.
- `InstallTypesTable.tsx` — column defs: Name, Ψ-install (unit column,
  reuse the shared unit cell used for TB `psi_value_w_mk`), Source
  (single-select), PDF Report (attachmentColumn), Datasheet, Site Photos,
  Spec. Status, Notes. `?focus=` prop wired like
  `ThermalBridgesTable.tsx:203`.
- Page component embedded in the sub-tab (not a new project tab):
  `useSliceTableController` + `SliceTableShell` exactly as
  `ThermalBridgesPage.tsx:117-156`.
- API/hooks: extend the apertures feature api for the
  `aperture_install_types` table slice (generic table routes — follow
  `useThermalBridgesSliceQuery` in `features/equipment/hooks.ts`).

## 3. Status destination

No work: status-ux-unification retired `summary.ts` and the duplicate Status
page. Do not recreate the `aperture_installs` destination (D-9).

## 4. Vocabulary

Status/evidence column headers and value labels must come from the current
shared vocabulary module (`Spec. Status` / `Datasheet` / `Site Photos`) —
never hand-written strings.

## 5. Tests & exit gate

- Vitest: payload builders (insert/delete/duplicate/cell-write), default-row
  delete block, column render smoke.
- e2e: create a type, set Ψ value with unit display, upload a PDF (fixture
  file), delete-blocked default row — extend the TB e2e pattern.
- Agent-browser screenshot of the populated tab
  (`/projects/<id>/apertures/installs`) attached to STATUS.md.
- `make frontend-dev-check` during work; full closeout gate before merge.

## As-built amendments (2026-08-04)

- **Module lives at `frontend/src/features/apertures/installs/`** (types,
  api via `createTableSliceFeature`, constants, payloads,
  `InstallTypesTable`, `InstallTypesPanel`); the sub-tab wiring in
  `AperturesTab.tsx` is ~10 lines (route flag + link + panel mount), and
  the redirect guard now derives from a new `APERTURE_SUBROUTES` tuple in
  `paths.ts` so the next sub-tab is a one-entry change.
- **§2 delete-block seam:** the client-side Default-row guard lives in
  `installTypesPayloadFromRowDelete` (drops `apit_default` from the delete
  set so sibling deletes still land), not in `validate()` — validate runs
  on every op and would have blocked unrelated edits. Server 409 remains
  the authority; `deleteConflict` copy explains both causes.
- **Generalized while cloning:** `PDF_REPORT_ATTACHMENT_CONFIG` moved to
  `features/assets/lib.ts` (TB re-exports it);
  `fieldDefsToSanitizeColumns` extracted to `shared/ui/data-table/lib`
  (TB aliases it); the shared `addRowButton`/`readStringDefault`/
  `readNumberDefault`/`customTextValue` helpers are imported rather than
  re-cloned. No hand-maintained built-in FieldDef fallback — the slice's
  `field_defs` are required and used directly.
- **Wiring gap found+fixed:** the generic table route validates against the
  `RegisteredTableResponse` union in `tables/__init__.py`; the new slice
  type had to be added there (500 otherwise). A route-level backend test
  now locks this in.
- **Tests:** vitest payload suite (7); e2e coverage via the table-regression
  matrix — Installs added as the 15th case (harness, smoke, cell-behavior
  all green). The shared `commitSingleSelect` e2e helper needed a
  race-safe popover-or-chevron branch (the psi column sits immediately
  left of `source`, so the activation click can open the popover
  directly). No bespoke jsdom render test (TB precedent has none; the e2e
  smoke covers mount).
- **Known unrelated drift:** the pre-existing `heat-pumps-equipment-indoor`
  e2e smoke case fails on a stale "Heating Capacity" header expectation
  (v9 units rename); not touched by this phase.
- Screenshot evidence: `working/agent-browser/installs-subtab-phase03.png`
  (gitignored working dir) — Installs sub-tab with the seeded Default row,
  unit-aware Ψ column, Source pill, and shared affordances.
