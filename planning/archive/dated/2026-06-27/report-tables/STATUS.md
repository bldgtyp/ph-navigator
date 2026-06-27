---
DATE: 2026-06-27
TIME: 09:06 EDT
STATUS: Complete — implemented in current codebase and archived
AUTHOR: Ed (via Claude)
SCOPE: Current state of the report-table primitive + Materials restyle.
RELATED:
  - planning/archive/dated/2026-06-27/report-tables/README.md
  - planning/archive/dated/2026-06-27/report-tables/PRD.md
  - planning/archive/dated/2026-06-27/report-tables/decisions.md
---

# Report-Tables — Status

## Current state

`Complete`. Review against the 2026-06-27 checkout found the planned feature
implemented and no longer active. The packet was moved from
`planning/features/report-tables/` to
`planning/archive/dated/2026-06-27/report-tables/`.

## Current implementation evidence

- `frontend/src/shared/ui/report-table/` exists and exports
  `ReportTable.tsx`, `ReportTable.css`, `StatusPill.tsx`,
  `StatusFilterChips.tsx`, `AttachmentChipCell.tsx`, `index.ts`.
- `frontend/src/App.css` imports `./shared/ui/report-table/ReportTable.css`.
- `frontend/src/styles/tokens.css` defines `--bg-page`, `--bg-elev`, and the
  report-table status dot tokens.
- `frontend/src/features/envelope/components/MaterialsPanel.tsx` consumes
  `ReportTable`, `StatusFilterChips`, `StatusDot`, and `AttachmentChipCell`.
  It owns `expandedMaterialId` and `statusFilter`, keeps status writes on the
  existing `update_project_material` command, and shows datasheets/use-sites
  in expanded rows.
- `frontend/src/features/apertures/components/ApertureSpecReportPanel.tsx`
  consumes the same primitive for Apertures -> Glazings and Apertures ->
  Frames, with the follow-on packet archived at
  `planning/archive/dated/2026-06-24/apertures-glazings-frames-reports/`.
- The old `SpecificationsPanel.tsx`, `specifications/DriftSummary.tsx`, and
  `specifications/UseSiteRow.tsx` paths named in the original plan no longer
  exist in current code. Their implemented equivalents are
  `MaterialsPanel.tsx`, `materials/UseSiteRow.tsx`, and shared
  `StatusFilterChips`.

## Implementation deltas from original wording

- The UI route/name is now Envelope -> Materials, not Envelope ->
  Specifications.
- The shared filter primitive is `StatusFilterChips`; no feature-local
  `SpecStatusFilters` component remains.
- Expanded report-table rows expose evidence, use-sites, comments, and drift
  review. Material attribute editing is opened from the row action via
  `ProjectMaterialEditorModal`, rather than embedded directly inside the
  expanded row.
- `AttachmentChipCell` is a compact presence chip backed by the full
  `AttachmentCell` editing flow in the expanded row.

## Next step

No active report-table primitive work. Future read-mostly specification rollups
should keep using this primitive unless they need full AirTable-style
`<DataTable>` behavior.

## Blockers

None.

## Verification plan

This reconciliation was docs/source verification only. Evidence checked:

1. `graphify query` for report-table context. Result was low-signal, so direct
   source inspection was used.
2. `find frontend/src/shared/ui/report-table -maxdepth 2 -type f`.
3. `rg "ReportTable|StatusFilterChips|AttachmentChipCell|StatusPill|report-table" frontend/src planning/archive/dated/2026-06-24/apertures-glazings-frames-reports planning/STATUS.md`.
4. Source reads of `MaterialsPanel.tsx`, `ApertureSpecReportPanel.tsx`,
   `ReportTable.tsx`, `StatusFilterChips.tsx`, `StatusPill.tsx`, and
   `AttachmentChipCell.tsx`.

No runtime browser pass or `make ci` was run in this docs-only status update.
