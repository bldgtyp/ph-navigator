> Split from `context/UI_UX.md` §2 (Pages — narrative). Cross-cutting design
> intent (§0), common elements incl. the DataTable model (§1 / §1.7), flows
> (§3), and the state-indicator cheatsheet (§4) stay in `../../UI_UX.md` —
> read it alongside this page.

# 2.8c Thermal Bridges tab (`/projects/{id}/thermal-bridges`)

**Purpose:** The project's thermal-bridge datasheets and simulation files —
one row per thermal bridge with its Ψ-value, type, evidence, and
specification status. A shipped **top-level** workspace tab (in
`PROJECT_TABS` as `thermal-bridges`), **not** an Equipment sub-tab.

The route renders `ThermalBridgesPage` (`features/assets/routes/`), which
reads its data through the equipment feature's hooks
(`features/equipment/hooks.ts`, `useThermalBridgesSliceQuery`); the row
model, columns, and payload builders live in
`features/assets/thermal-bridges/`.

## Layout — single versioned DATA-TABLE

The tab is one dense `<DataTable>` (§1.7) wrapped in the shared
`SliceTableShell` — the same slice-table pattern the Equipment and Apertures
report tables use. There is no second-level sub-tab bar.

- Rows are the project's thermal bridges (`ThermalBridgesTable`), sorted for
  a stable order. Columns include the thermal-bridge **type**
  (a single-select whose option list is editable in-grid), Ψ-value, and a
  **status** column following the §1.8 evidence/status grammar.
- Custom fields and single-select option edits are supported through the
  shared controller (`useSliceTableController`), so option renames/removals
  go through the same replace-table flow as other slice tables.
- A footer "Add thermal bridge" **+** inserts a row (editors only).

## Versioning, editing, access

Thermal Bridges is versioned DATA-TABLE content: it reads the working draft
(editors) or the selected saved version (viewers), keyed by
`project.active_version_id`. Editing is gated on `access_mode === "editor"`
and an unlocked active version; on a locked version the shell shows the
locked banner and the grid is read-only. A restored local draft surfaces a
"Thermal Bridges draft restored" banner.

## Status linkage

Each row's `specification_status` feeds the Status tab (§2.5); the Status
tab's thermal-bridge record links deep-link back here with `?focus={row_id}`
so the grid scrolls to and focuses that row.
