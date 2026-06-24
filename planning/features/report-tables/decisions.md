---
DATE: 2026-06-09
TIME: 14:30
STATUS: Active
AUTHOR: Ed (via Claude)
SCOPE: Accepted/rejected design calls for the report-table primitive
  and the Envelope → Specifications restyle.
RELATED:
  - planning/features/report-tables/PRD.md
---

# Report-Tables — Decisions Log

## Accepted

### A1 — `DriftSummary` is replaced by `SpecStatusFilters` chip row (2026-06-09)

The top-of-page summary band on Specifications becomes a chip-row
filter (`All`/`Missing`/`Question`/`Complete`/`N/A` with counts) plus
an `N/M resolved` indicator on the right.

Per-material drift information continues to surface via
`MaterialDriftBadge` and the "Refresh from catalog" affordance, but
they live inside the expanded row for that material — not as a
top-of-page band.

### A2 — Background palette (2026-06-09)

| Surface             | Color                |
| ------------------- | -------------------- |
| Topbar              | `#ffffff`            |
| Project tabs        | `#ffffff`            |
| App sub-tabs        | `rgb(249, 250, 251)` |
| Project / workspace | `rgb(247, 248, 249)` |

Tokens to be defined / updated in `frontend/src/styles/tokens.css`:
`--bg-page` and `--bg-elev`. These tokens are already referenced
throughout `base.css`, `DataTable.css`, and `attachments.css` but have
no explicit value today; setting them here propagates the change
globally.

### A3 — Report-table is its own primitive, not `<DataTable>` (2026-06-09)

The Specifications view is a **reporting/view-table**, semantically
distinct from the existing `<DataTable>` data-entry grid. It gets its
own home under `frontend/src/shared/ui/report-table/` with its own
styles. Future report-table consumers — window glazing, window-frame
elements, additional spec rollups — reuse the same primitives so the
visual style stays consistent across the app.

2026-06-24 update: the window glazing and window-frame consumers are now
realized as `Apertures → Glazings` and `Apertures → Frames`, implemented by
`planning/archive/dated/2026-06-24/apertures-glazings-frames-reports/`.

### A4 — Status pill colors (2026-06-09)

| Status   | Color role             |
| -------- | ---------------------- |
| Missing  | amber (warning)        |
| Question | teal/blue (info)       |
| Complete | green (success)        |
| N/A      | neutral grey (muted)   |

A new `--phn-info` token is added if no existing token fits.

## Rejected / Deferred

### R1 — Adopt `<DataTable>` for Specifications

Rejected. `<DataTable>` is the AirTable-style data-entry grid; carrying
its inline-editing, cell-tint, sort/filter/group machinery into a
read-mostly dashboard would obscure the dense scannable style we want.
Report-table stays a separate, lighter primitive.

### R2 — Per-column sort / filter / hide / resize on report-tables

Deferred. Status-chip filtering is enough for v1. Add only when a
specific consumer needs more.
