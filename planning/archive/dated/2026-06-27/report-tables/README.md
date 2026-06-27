---
DATE: 2026-06-27
TIME: 09:06 EDT
STATUS: Complete — implemented in current codebase and archived
AUTHOR: Ed (via Claude)
SCOPE: Shared "report-table" UI primitive + Envelope Materials restyle,
  plus global app background-token shift.
RELATED:
  - context/CODING_STANDARDS.md (frontend feature-first organization)
  - context/technical-requirements/data-table.md (the data-entry DataTable —
    distinct from this feature)
  - planning/archive/dated/2026-06-27/report-tables/PRD.md
  - planning/archive/dated/2026-06-27/report-tables/decisions.md
  - frontend/src/shared/ui/report-table/
  - frontend/src/features/envelope/components/MaterialsPanel.tsx
  - frontend/src/features/apertures/components/ApertureSpecReportPanel.tsx
---

# Report-Tables — Archived Feature Folder

## Scope

Introduce a shared **report-table** (read-mostly view-table) UI primitive
and migrate Envelope -> Materials to it as the first consumer. Apply a
global background-token shift while touching styling.

Report-tables are a **distinct visual and interaction pattern from the
existing `<DataTable>`**:

| Aspect          | `<DataTable>` (data-entry)         | Report-table (this feature)          |
| --------------- | ---------------------------------- | ------------------------------------ |
| Primary purpose | author-edit grid (AirTable-style)  | dense, scannable summary / dashboard |
| Editing         | inline cell editors, drafts, undo  | row-expand for evidence/use-sites; row action for feature editor |
| Sort / filter   | full machinery + tint cascade      | minimal: status-chip filters         |
| Visual density  | medium, cell-borders, gutter chrome| very dense, borderless, off-white BG |
| Other consumers | most feature tabs                  | Materials, Apertures Glazings, Apertures Frames, future spec rollups |

Both can coexist; pick by intent. Report-table components and styles
live in `frontend/src/shared/ui/report-table/` so future consumers
(window glazing, frame elements, etc.) get a consistent look out of the
box.

Current codebase status: complete. The shared primitive lives at
`frontend/src/shared/ui/report-table/`, Envelope Materials consumes it in
`frontend/src/features/envelope/components/MaterialsPanel.tsx`, and
Apertures Glazings/Frames consume it through
`frontend/src/features/apertures/components/ApertureSpecReportPanel.tsx`.

The first follow-on consumers landed in
`planning/archive/dated/2026-06-24/apertures-glazings-frames-reports/`:
Apertures -> Glazings and Apertures -> Frames reuse the report-table primitive
for project glazing and frame specification reports.

## Read order

1. `STATUS.md` — current codebase reconciliation and evidence.
2. `PRD.md` — original product/behavior contract plus implementation notes.
3. `decisions.md` — accepted/rejected design calls.

## Out of scope

- No backend changes.
- No changes to the existing `<DataTable>` primitive or its consumers
  (Apertures, Equipment data-entry tables, etc.) except for picking up
  the global background-token change.
- No changes to drift logic, command shapes, or asset upload pipeline.
