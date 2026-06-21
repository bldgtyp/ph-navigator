> Split from `context/UI_UX.md` §2 (Pages — narrative). Cross-cutting design
> intent (§0), common elements incl. the DataTable model (§1 / §1.7), flows
> (§3), and the state-indicator cheatsheet (§4) stay in `../../UI_UX.md` —
> read it alongside this page.

# 2.5 Status tab (`/projects/{id}/status`) — placeholder

**(Full spec in US-Status.)**

Default landing for the project workspace. Vertical timeline of
project lifecycle / certification milestones. Each item: state icon +
title + completion date or free-text description (Markdown).
User-managed list — add, reorder (drag), edit, mark done, delete.

**Empty state (brand-new project, zero items):**

The Status tab is the default landing tab, so a brand-new project
opens directly into an empty Status surface. No auto-populate; user
gets explicit control.

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│              No status items yet for this project.               │
│                                                                  │
│       Track lifecycle milestones — CAD received, design          │
│       complete, Phius reviews, certification — to know           │
│       where this project stands at a glance.                     │
│                                                                  │
│        [ Apply BLDGTYP default template ]   ← primary            │
│        [ Add custom item ]                  ← secondary          │
│                                                                  │
│                  Skip to Envelope → (link)                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**"Apply BLDGTYP default template"** populates 4 starter items in
order:
1. CAD files received
2. Design Model complete
3. Phius review complete
4. Certification Complete

All four start in `state='todo'`. User edits / reorders / dates / adds
freely from there. The template is hardcoded in code; no
template-management UI in v1.

**Populated state:** vertical timeline component (similar to V1's
Status page). Each row:
- State icon (○ todo / ✓ done / – n/a)
- Item number (auto from order)
- Title (clickable to edit)
- Completion date (if state = done) OR free-text description
  (Markdown, may include in-app links — internal anchors v1.1+)
- Optional next action / owner / linked work surface when a status item
  is acting as a workflow gate.
- Drag handle for reorder
- `⋯` row menu: Edit, Mark done, Mark todo, Mark n/a, Delete

Each milestone should read as a compact status record: state, title,
date/description, and a direct link to the surface that resolves it
where applicable. Avoid treating Airtightness/Site Photos links as
small annotations; if they are gates, they need action affordance.

Reference: V1 Status page screenshot supplied 2026-05-10.

