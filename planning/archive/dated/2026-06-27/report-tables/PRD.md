---
DATE: 2026-06-27
TIME: 09:06 EDT
STATUS: Complete — original PRD with current-code reconciliation notes
AUTHOR: Ed (via Claude)
SCOPE: Product/behavior contract for the report-table primitive and the
  Envelope Materials restyle.
RELATED:
  - planning/archive/dated/2026-06-27/report-tables/README.md
  - planning/archive/dated/2026-06-27/report-tables/decisions.md
  - frontend/src/features/envelope/components/MaterialsPanel.tsx
  - frontend/src/styles/tokens.css
---

# Report-Tables — PRD

## Reference design

Source: `working/design/B _ Dense data table.html` (Claude Design
export). Screenshot lives under `assets/` once added. Key visual
characteristics:

- Single row per record, very dense (~34 px row height).
- Off-white shell, lighter surface for the table area, no heavy cell
  borders — separation is by row gap + light hairlines.
- Status as a colored-dot pill (Missing/Question/Complete/N/A).
- Attachment columns render compact presence chips.
- Top-of-page filter chip row replaces the old summary band; each chip
  is a status with a count.
- Expanding a row reveals the detail/evidence content inline
  (datasheets + use-sites + drift/comments) — same evidence the previous
  card layout exposed.

## Confirmed decisions

These four calls were confirmed by Ed before planning was recorded; see
`decisions.md` for the running log.

### D1 — Replace `DriftSummary` with a status-filter chip row

`DriftSummary` (`frontend/src/features/envelope/components/specifications/DriftSummary.tsx`)
is removed from the Specifications view and replaced by a new
status-filter chip row. In current code this is the shared
`StatusFilterChips` primitive, not a feature-local `SpecStatusFilters`
component:

- One chip per `SpecificationStatus`: `All`, `Missing`, `Question`,
  `Complete`, `N/A`, each with a live count.
- Selecting a chip filters `visibleMaterials` to that status; `All`
  clears the filter.
- The `4/12 resolved` indicator moves to the top-right of the same row.
- Drift information for individual materials still surfaces through the
  existing `MaterialDriftBadge` and "Refresh from catalog" affordance,
  but those live **inside the expanded row** for the material in
  question — no separate top-of-page drift band.

### D2 — Confirmed colors

Background-token values, applied globally in `frontend/src/styles/tokens.css`:

| Surface                                      | Token            | Color                |
| -------------------------------------------- | ---------------- | -------------------- |
| Top bar (`PH-NAV` / project breadcrumb)      | (topbar surface) | `#ffffff`            |
| Project tabs (STATUS / APERTURES / …)        | (tabs surface)   | `#ffffff`            |
| App sub-tabs (Assemblies / Specifications)   | `--bg-elev`      | `rgb(249, 250, 251)` |
| Project page / workspace body                | `--bg-page`      | `rgb(247, 248, 249)` |

Status-pill dot colors (report-table convention; reused across all
future report-table consumers):

| Status     | Dot color (token role)            |
| ---------- | --------------------------------- |
| Missing    | amber (`--phn-warning`)           |
| Question   | teal/blue (new `--phn-info`)      |
| Complete   | green (`--phn-success`)           |
| N/A        | neutral grey (`--text-muted`)     |

If a token is missing it is added in `tokens.css` rather than hardcoded
at the call site.

### D3 — Report-table is a distinct primitive, NOT `<DataTable>`

Materials is a **reporting/view table**, not a data-entry table. It
uses a unique, dense, read-mostly visual style and must NOT be built on
top of `<DataTable>` (which is the AirTable-style data-entry grid
documented in `context/technical-requirements/data-table.md`).

Implementation lives at:

```text
frontend/src/shared/ui/report-table/
  ReportTable.tsx          # generic shell, column config, row-expand
  ReportTable.css          # shared report-table styles
  StatusPill.tsx           # colored-dot + label pill
  StatusFilterChips.tsx    # chip-row filter primitive
  AttachmentChipCell.tsx   # compact presence-chip variant of AttachmentCell
  index.ts                 # public exports
```

The Materials page consumes these via column-config. Follow-on consumers
(Apertures Glazings, Apertures Frames, additional spec rollups) reuse the
same primitives so the visual style stays consistent.

Editing inside a report-table happens by expanding the row to reveal
the existing per-feature evidence/use-site components (`AttachmentCell`,
`UseSiteRow`, etc.); the row itself stays display-only. Current
implementation opens material attribute editing through the row action and
`ProjectMaterialEditorModal`.

### D4 — Background palette stack

Per D2, the surface stack from outermost to innermost:

```
topbar          : #ffffff
project tabs    : #ffffff
app sub-tabs    : rgb(249, 250, 251)  → --bg-elev
workspace body  : rgb(247, 248, 249)  → --bg-page
report-table row: #ffffff (sits on the workspace body)
```

This is a global change. Other tabs (Apertures, Equipment, Status,
Thermal Bridges, Model) inherit the new background automatically; the
mandatory closeout gate (`make ci`, plus visual smoke through
Playwright MCP) verifies nothing regresses.

## Materials page after restyle

Columns (left → right):

```
▸  Material  Category  Lambda      Density     Spec. Heat   Uses  Datasheet  Photos  Status
                       W/(m·K)     kg/m³       J/(kg·K)
```

- `▸` toggles row expansion; one row expanded at a time.
- `Material` is bold/primary.
- Numeric columns are right-aligned with a two-line header (label + unit).
- `Uses` shows the count of use-sites.
- `Datasheet` / `Photos` columns render `AttachmentChipCell` (compact
  variant of the existing `AttachmentCell`).
- `Status` renders the existing `AutocompleteSelect` styled as a
  `StatusPill` with a chevron, preserving the change command.

Expanded row content:

- Left column: `Datasheets` block (full `AttachmentCell`),
  comments, drift-refresh affordance.
- Right column: `Use-sites & site photos` — reuses `UseSiteRow`
  components, tightened to drop the card chrome.

Current implementation note: material attribute editing is not embedded in the
expanded row; it opens through the row action as `ProjectMaterialEditorModal`.

## Behavior (unchanged)

- All commands routed through `onCommand` keep their existing shapes.
- Drift detection / refresh logic unchanged.
- Viewer vs. editor permission gates unchanged.
- Sort order of materials unchanged (`sortProjectMaterials`).
- Empty state unchanged.

## Out of scope

- Sort / multi-filter machinery beyond the status chips.
- Column resize, reorder, hide.
- Pagination — Materials is bounded by project material count.
- Touching the V1 codebase.
