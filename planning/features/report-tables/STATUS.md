---
DATE: 2026-06-24
TIME: 19:20 EDT
STATUS: Implemented — shared primitive has multiple consumers
AUTHOR: Ed (via Claude)
SCOPE: Current state of the report-table primitive + Specifications restyle.
RELATED:
  - planning/features/report-tables/README.md
  - planning/features/report-tables/PRD.md
  - planning/features/report-tables/decisions.md
---

# Report-Tables — Status

## Current state

`Implemented`. The shared `frontend/src/shared/ui/report-table/` primitive is
used by Envelope Materials/Specifications and now by Apertures → Glazings and
Apertures → Frames
(`planning/archive/dated/2026-06-24/apertures-glazings-frames-reports/`).

## Files expected to change

- `frontend/src/styles/tokens.css` — define `--bg-page`, `--bg-elev`,
  add `--phn-info` if needed.
- `frontend/src/shared/ui/report-table/` — new directory:
  `ReportTable.tsx`, `ReportTable.css`, `StatusPill.tsx`,
  `StatusFilterChips.tsx`, `AttachmentChipCell.tsx`, `index.ts`.
- `frontend/src/App.css` — `@import` for the new report-table CSS.
- `frontend/src/features/envelope/components/SpecificationsPanel.tsx`
  — restructure to consume `<ReportTable>`; manage
  `expandedMaterialId` + `selectedStatus` state.
- `frontend/src/features/envelope/components/specifications/UseSiteRow.tsx`
  — tighten styling for inline-in-expanded-row use; behavior
  unchanged.
- `frontend/src/features/envelope/components/specifications/DriftSummary.tsx`
  — removed (functionality folded into `SpecStatusFilters`).
- `frontend/src/features/envelope/envelope.css` — drop the old
  `.specifications-grid` / `.spec-card` / `.spec-values` blocks.
- `frontend/src/features/assets/components/AttachmentCell.tsx` — only
  if the chip variant cannot be cleanly built as a separate
  `AttachmentChipCell` that shares the upload pipeline; preferred is
  to leave `AttachmentCell` untouched and compose.

## Next step

No active report-table primitive work. Future additions should keep using this
primitive for read-mostly specification rollups unless they need full
AirTable-style `<DataTable>` behavior.

## Blockers

None.

## Verification plan

1. `make ci` green.
2. Playwright MCP visual pass on:
   - Envelope → Specifications (primary target).
   - Envelope → Assemblies, Apertures, Equipment, Status, Thermal
     Bridges — check no background regressions from token shift.
3. Manual: status-chip filter cycles each status, counts match;
   row-expand reveals datasheets + use-sites + editor; status pill
   changes commit via `update_project_material`; attachment chip
   columns upload through the existing pipeline.
