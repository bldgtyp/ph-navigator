---
DATE: 2026-06-09
TIME: 14:30
STATUS: Active — planning
AUTHOR: Ed (via Claude)
SCOPE: Shared "report-table" UI primitive + restyle Envelope → Specifications
  as the first consumer, plus global app background-token shift.
RELATED:
  - context/CODING_STANDARDS.md (frontend feature-first organization)
  - context/technical-requirements/data-table.md (the data-entry DataTable —
    distinct from this feature)
  - planning/features/report-tables/PRD.md
  - planning/features/report-tables/decisions.md
  - frontend/src/features/envelope/components/SpecificationsPanel.tsx
---

# Report-Tables — Feature Folder

## Scope

Introduce a shared **report-table** (read-mostly view-table) UI primitive
and migrate Envelope → Specifications to it as the first consumer. Apply
a global background-token shift while we are touching styling.

Report-tables are a **distinct visual and interaction pattern from the
existing `<DataTable>`**:

| Aspect          | `<DataTable>` (data-entry)         | Report-table (this feature)          |
| --------------- | ---------------------------------- | ------------------------------------ |
| Primary purpose | author-edit grid (AirTable-style)  | dense, scannable summary / dashboard |
| Editing         | inline cell editors, drafts, undo  | row-expand → editor inside expansion |
| Sort / filter   | full machinery + tint cascade      | minimal: status-chip filters         |
| Visual density  | medium, cell-borders, gutter chrome| very dense, borderless, off-white BG |
| Other consumers | most feature tabs                  | window glazing, window-frame elements, future "spec rollups" |

Both can coexist; pick by intent. Report-table components and styles
live in `frontend/src/shared/ui/report-table/` so future consumers
(window glazing, frame elements, etc.) get a consistent look out of the
box.

## Read order

1. `PRD.md` — what is being built and the four confirmed decisions.
2. `decisions.md` — accepted/rejected design calls.
3. `STATUS.md` — current state, next step, blockers.

## Out of scope

- No backend changes.
- No changes to the existing `<DataTable>` primitive or its consumers
  (Apertures, Equipment data-entry tables, etc.) except for picking up
  the global background-token change.
- No changes to drift logic, command shapes, or asset upload pipeline.
