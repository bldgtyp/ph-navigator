# Phase 03 — "Installs" sub-tab (library table page)

```
DATE:    2026-08-03
TIME:    11:55
STATUS:  Not started
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
