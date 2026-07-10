---
DATE: 2026-07-10
TIME: 10:08 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Product and UX contract for the Status dashboard redesign.
RELATED: README.md; research.md; context/ui/pages/status-tab.md; context/technical-requirements/data-table.md
---

# PRD — Status Dashboard

## Goal

On a cold landing, a client or editor can answer within a few seconds:

- What project records still need work or an answer?
- Which equipment/specification areas are complete, incomplete, empty, or not applicable?
- What is the next lifecycle milestone?
- Where do I click to resolve an item?

## Information architecture

Retain one `/status` route and one top-level **Status** tab.

### Desktop

- Page heading: **Project status**, with a short neutral subtitle.
- Main grid: approximately 2fr **Record status** / 1fr **Roadmap**.
- The panes use whitespace and a single divider, not two heavy cards.
- Roadmap may remain visible as the record summary expands, but must not use viewport locking that traps keyboard or touch scrolling.

### Narrow screens

- Stack **Record status**, then **Roadmap**.
- Do not hide either section behind a page-level tab switch.

## Record status

### Scope

Summarize the 12 registered tables in `STATUS_TABLE_NAMES`:

- Ventilators
- Heat Pumps: Outdoor Equipment, Indoor Equipment, Outdoor Units, Indoor Units
- Pumps
- Fans
- Hot Water Heaters
- Hot Water Tanks
- Electric Heaters
- Appliances
- Thermal Bridges

Group the four Heat Pump leaves under one visible **Heat Pumps** section with leaf-level counts inside its disclosure panel. Keep Hot Water Heaters and Hot Water Tanks as separate groups because they are separate owning tables and user tasks.

Rooms, Space Types, Apertures, Materials, Glazings, and Frames are out of v1 summary scope: they do not use this shared DATA-TABLE `status` contract. Their report-specific status semantics must not be silently conflated with DATA-TABLE completeness.

### Summary header

Show compact totals, not score cards:

- `N needed`
- `N questions`
- `N complete`
- `N N/A`

Needed and Question are the attention count. Do not calculate a completion percentage: N/A and empty table applicability make a percentage falsely precise.

### Group rows

Each group is a native disclosure/accordion row with:

- group name;
- total record count;
- small semantic counts for Needed and Question, then Complete/N/A in quieter text;
- a chevron and an explicit accessible expanded state;
- a direct "Open table" link available when expanded.

All groups start collapsed, including on large projects. Preserve expansion state for the current browser session per project. Never auto-expand every attention group.

Groups with zero records show **No records** neutrally; zero records are not automatically "complete" or "needed." Stable ordering follows the product navigation, not a dynamically jumping severity sort.

### Expanded record list

Default expanded content is attention-first:

1. Needed
2. Question
3. Complete
4. N/A

Each record shows only:

- Display Name (fall back to Tag, then `Untitled record`);
- semantic Status chip;
- Notes, when non-empty, clamped to two lines with an explicit expand/collapse control;
- click-through affordance to the exact owning table/leaf and focused row.

For large groups, initially render at most 10 attention records plus a **Show all N** control. Complete and N/A records remain behind **Show resolved**. List expansion must be local to that group.

No CFM, capacity, U-value, psi-value, manufacturer, model, or other specification fields appear here.

### Status semantics

Use the stored option IDs, not labels or colors, as canonical values:

- `opt_status_needed` → Needed
- `opt_status_question` → Question
- `opt_status_complete` → Complete
- `opt_status_na` → N/A

Missing/invalid status data is an explicit **Unknown** compatibility state in the API contract and UI; it must not be counted as Needed. New valid rows already default to Needed.

### Deep links

- Generic equipment: `/projects/{id}/equipment?tab={tab}&focus={row_id}`
- Heat Pumps: `/projects/{id}/equipment/heat-pumps/{leaf}?focus={row_id}`
- Thermal Bridges: `/projects/{id}/thermal-bridges?focus={row_id}`

The owning table must honor `focus`, scroll the record into view, highlight it, and permit the existing row-open flow. Viewer links stay read-only.

## Roadmap

### Visual direction

Use a refined, editorial timeline: compact rows, a hairline rail, restrained state marks, and generous whitespace. Remove the enclosing 620px-minimum card feeling and 4px per-row status bars.

- Current milestone gets one subtle accent, not a filled panel.
- Completed and N/A milestones recede without becoming illegible.
- Description is visible when present; empty "Add notes" is editor-only and visually quiet.
- Dates and status labels remain secondary metadata.

### Progressive editor controls

For editors only:

- The row action trigger (`...`) appears on row hover and `:focus-within`, and remains available on coarse-pointer/touch devices.
- Menu: Edit, Move up, Move down, Mark done/todo/N/A as applicable, Delete.
- Drag handle appears on hover/focus for pointer reordering; keyboard reordering remains available and discoverable.
- State control may remain directly operable because changing milestone state is the primary roadmap action.
- "Add milestone" is a quiet section-level action, not a dominant page CTA.

For anonymous/viewer access:

- Render no drag handle, edit action, delete action, reorder action, add action, or focusable disabled date button.
- Backend mutations remain protected by existing project-edit dependencies.

Hover is an enhancement, never the only access path: keyboard focus and touch must expose the same editor actions.

## Loading, errors, and empty states

Roadmap and Record status load independently. The roadmap must render as soon as its existing request resolves; a slow summary must not blank the whole page.

- Initial route chunk: compact page-shell skeleton.
- Roadmap: 4–5 line-shaped skeleton rows matching final geometry.
- Record status: summary-count skeleton plus 6–8 disclosure-row skeletons.
- Skeletons use `aria-hidden`; one adjacent `role="status"` message announces loading.
- Respect `prefers-reduced-motion`; no shimmer is required. A low-motion opacity pulse is acceptable.
- Reserve final layout dimensions to prevent cumulative layout shift.
- If one section fails, keep the other usable and show an inline retry for the failed section.
- A project with no active version shows a clear summary empty state while the independent roadmap remains usable.

## Performance contract

- Do not mount 12 existing table hooks on the Status page.
- Do not return full FieldDefs, formulas, attachment metadata, or specification columns.
- One summary request loads the selected saved document or editor draft once and projects only group counts plus Display Name, Tag, status, notes, table key, and row ID.
- Query key includes project ID, version ID, and source (`draft` or `version`).
- Cache the response with React Query and invalidate it after accepted writes to any of the 12 status-bearing tables.
- Target: summary JSON under 100 kB for a 500-record project and a single backend document load. Record the measured fixture result rather than asserting this target without evidence.

## Acceptance criteria

1. The existing Status route contains both sections and no new top-level tab.
2. All 12 shared-status tables are represented exactly once.
3. Counts and record rows agree with the selected draft for editors and saved version for viewers.
4. Initial disclosure is bounded regardless of project size.
5. Record click-through reaches and focuses the correct table row.
6. Anonymous/viewer DOM contains no roadmap mutation or reorder controls.
7. Keyboard and touch users can reach every editor action that hover reveals.
8. Roadmap and summary loading/error states are independent and layout-stable.
9. Backend summary work loads the document once per request.
10. Focused tests, frontend gate, live browser smoke, and a cold-load network trace pass.

