---
DATE: 2026-06-25
TIME: 00:57 EDT
STATUS: Phase 00 complete - route matrix and written baseline captured
AUTHOR: Codex
SCOPE: Representative DataTable consumers, high-risk behaviors, and written visual baseline for the DataTable UI redesign.
RELATED:
  - planning/features/data-table-ui/phases/phase-00-redesign-baseline-and-route-matrix.md
  - planning/features/data-table-ui/PLAN.md
  - frontend/src/shared/ui/data-table/DataTable.tsx
  - frontend/src/app/router.tsx
---

# DataTable UI - Route Matrix And Baseline

## Source Inventory

Discovery used:

- `graphify query "DataTable consumers and routes for data-table-ui route matrix"`
- `rg -n "<DataTable|DataTable\\(" frontend/src --glob '*.{tsx,ts}'`
- targeted prop searches for `footerAction`, `onRowOpen`, `attachment`, `linked_record`,
  `numberUnits`, `buildEmptyRow`, and `status`.

The project router mounts project tabs through
`frontend/src/features/projects/components/ProjectTabContent.tsx`; catalog routes mount directly
from `frontend/src/app/router.tsx`.

## Route Matrix

| Surface | Route / state | DataTable owner | Risk markers for redesign QA |
|---|---|---|---|
| Rooms | `/projects/:projectId/spaces/rooms` | `frontend/src/features/equipment/components/RoomsTable.tsx` via `RoomsPage.tsx` | Custom fields, formulas, linked-record cells to Space Types and Pumps, `onRowOpen`, `footerAction`, `buildEmptyRow`, row modal, focus deep link. No built-in status/datasheet. |
| Space Types | `/projects/:projectId/spaces/space-types` | `frontend/src/features/spaces/components/SpaceTypesTable.tsx` | Custom fields, inverse Rooms linked-record display columns, `footerAction`, `buildEmptyRow`, inverse-link edit affordance. No built-in status/datasheet. |
| Ventilators | `/projects/:projectId/equipment?tab=ventilators` | `frontend/src/features/equipment/components/VentilatorsTable.tsx` | Attachment `Datasheet`, built-in `status`, custom fields, `number` fields, linked Heat Pump records, `onRowOpen`, `footerAction`, `buildEmptyRow`. |
| Pumps | `/projects/:projectId/equipment?tab=pumps` | `frontend/src/features/equipment/components/PumpsTable.tsx` | Attachment `Datasheet`, built-in `status`, custom fields, `numberUnits` flow-rate field, `footerAction`, `buildEmptyRow`, focus deep link. |
| Fans | `/projects/:projectId/equipment?tab=fans` | `frontend/src/features/equipment/components/FansTable.tsx` | Attachment `Datasheet`, built-in `status`, custom fields, `number` phase/flow fields, `footerAction`, `buildEmptyRow`. |
| Hot Water Heaters | `/projects/:projectId/equipment?tab=hot-water-heaters` | `frontend/src/features/equipment/components/HotWaterHeatersTable.tsx` | Attachment `Datasheet`, built-in `status`, custom fields, numeric electrical fields, `footerAction`, `buildEmptyRow`. |
| Hot Water Tanks | `/projects/:projectId/equipment?tab=hot-water-tanks` | `frontend/src/features/equipment/components/HotWaterTanksTable.tsx` | Attachment `Datasheet`, built-in `status`, custom fields, built-in single-select, `footerAction`, `buildEmptyRow`. |
| Electric Heaters | `/projects/:projectId/equipment?tab=electric-heaters` | `frontend/src/features/equipment/components/ElectricHeatersTable.tsx` | Attachment `Datasheet`, built-in `status`, custom fields, numeric fields, `footerAction`, `buildEmptyRow`. |
| Appliances | `/projects/:projectId/equipment?tab=appliances` | `frontend/src/features/equipment/components/AppliancesTable.tsx` | Attachment `Datasheet`, built-in `status`, custom fields, `numberUnits` Annual Energy field, `footerAction`, `buildEmptyRow`. |
| Heat Pump Outdoor Equipment | `/projects/:projectId/equipment?tab=heat-pumps` | `frontend/src/features/equipment/heat-pumps/components/OutdoorEquipTable.tsx` | Heat-pump leaf adapter, built-in `status`, linked indoor units, custom fields, `onRowOpen`, `footerAction`, modal editing, stale-ETag handling. |
| Heat Pump Indoor Equipment | `/projects/:projectId/equipment?tab=heat-pumps` | `frontend/src/features/equipment/heat-pumps/components/IndoorEquipTable.tsx` | Heat-pump leaf adapter, built-in `status`, linked outdoor equipment/indoor units, custom fields, `onRowOpen`, `footerAction`, modal editing. |
| Heat Pump Outdoor Units | `/projects/:projectId/equipment?tab=heat-pumps` | `frontend/src/features/equipment/heat-pumps/components/OutdoorUnitsTable.tsx` | Heat-pump leaf adapter, built-in `status`, linked equipment, custom fields, `onRowOpen`, `footerAction`, modal editing, stale-ETag handling. |
| Heat Pump Indoor Units | `/projects/:projectId/equipment?tab=heat-pumps` | `frontend/src/features/equipment/heat-pumps/components/IndoorUnitsTable.tsx` | Heat-pump leaf adapter, built-in `status`, linked equipment, custom fields, `onRowOpen`, `footerAction`, modal editing, stale-ETag handling. |
| Thermal Bridges | `/projects/:projectId/thermal-bridges` | `frontend/src/features/assets/thermal-bridges/ThermalBridgesTable.tsx` | Attachment report column, built-in `status` without Datasheet, custom fields, numeric psi/length style fields, `footerAction`, `buildEmptyRow`. |
| Attachment Rows | Envelope/Aperture attachment workbench panels | `frontend/src/features/assets/components/AttachmentRowsTable.tsx` | Minimal DataTable with an `attachment` column, read-only toggle, `Download all` overflow action, empty controlled view state, no custom fields. |
| Materials Catalog | `/catalog/materials` | `frontend/src/features/catalogs/routes/MaterialsCatalogPage.tsx` | Catalog import/export overflow action, bulk selection actions, `onRowOpen`, `buildEmptyRow`, material `numberUnits` overlays. |
| Glazing Types Catalog | `/catalog/glazing-types` | `frontend/src/features/catalogs/routes/GlazingTypesCatalogPage.tsx` | Catalog import/export overflow action, bulk selection actions, `buildEmptyRow`, U-value `numberUnits` overlay. |
| Frame Types Catalog | `/catalog/frame-types` | `frontend/src/features/catalogs/routes/FrameTypesCatalogPage.tsx` | Catalog import/export overflow action, bulk selection actions, `buildEmptyRow`, fixed length/U-value/conductivity `numberUnits` overlays. |

## Baseline Checklist

No browser screenshots were captured in Phase 00. This written baseline is the accepted
pre-change reference for later visual review; Phase 04 should capture browser evidence across the
representative routes below after shared CSS and markup changes land.

Current baseline to preserve while restyling:

- Shared DataTables use the fixed `colgroup` layout; do not adopt the mockup's `table-layout: auto`
  without a separate parity prototype.
- Header cells currently host field type icon, display name, optional unit chip, optional
  description marker, lock/menu affordances, resize, sort/filter/group tinting, and field-config
  actions in the shared `GridHeader` path.
- Body cells support active-cell, editing, fill handle, range selection, row selection, row context
  actions, attachment thumbnails, linked-record pills, custom field renderers, and formula/computed
  overlays through shared `DataTable` mechanics.
- Equipment, heat-pump, Thermal Bridges, and attachment surfaces carry the highest risk for row
  height and cell clipping because they combine attachments, status chips, linked-record pills,
  custom fields, and footer actions.
- Catalog tables carry the highest risk for bulk-selection and overflow-toolbar styling because
  they are full-page catalog screens rather than project-tab panels.
- Rooms and Space Types carry the highest linked-record risk because they render forward links,
  reverse/inverse Rooms columns, and row-modal edit affordances.
- Number-with-units visual QA must include at least Pumps (`flow_rate_gpm`), Appliances
  (`annual_energy_kwh`), Materials, Glazing Types, and Frame Types.
- Status chip visual QA must include the Datasheet-bearing equipment tables, all four Heat Pump
  leaves, and Thermal Bridges, because Thermal Bridges is the intentional status-without-Datasheet
  exception.

## Representative Browser Set For Later Phases

Use these as the minimum browser pass before final closeout:

1. `/projects/:projectId/spaces/rooms`
2. `/projects/:projectId/spaces/space-types`
3. `/projects/:projectId/equipment?tab=pumps`
4. `/projects/:projectId/equipment?tab=ventilators`
5. `/projects/:projectId/equipment?tab=heat-pumps`
6. `/projects/:projectId/thermal-bridges`
7. `/catalog/materials`
8. `/catalog/glazing-types`
9. `/catalog/frame-types`

If time permits, add one Attachment Rows panel smoke through an Envelope or Apertures attachment
workbench route after the shared table shell changes are complete.

## Phase 00 Decision

Global search stays deferred. The current redesign will restyle existing toolbar controls only;
search needs a separate behavior contract for formatted-cell matching, persistence in `ViewState`,
and interaction with existing filters/groups.
