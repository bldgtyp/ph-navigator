---
DATE: 2026-07-10
TIME: 10:08 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Current-code review supporting the Status dashboard plan.
RELATED: PRD.md; frontend/src/features/project_status/; backend/features/project_document/tables/_status_field.py
---

# Research — Current Status and DATA-TABLE Surfaces

## Existing Status page

- `StatusTab.tsx` independently fetches relational `project_status_items` from `GET /api/v1/projects/{id}/status-items`.
- `project.access_mode === "editor"` already gates add, state mutation, edit, delete, drag, and arrow-reorder UI.
- Backend POST/PATCH/DELETE routes already require project edit access; GET requires view access.
- `StatusItemRow.tsx` renders editor move/edit/delete buttons permanently. Viewer rows omit them.
- `project_status.css` creates the heavy presentation: a bordered `status-body` with `min-height: 620px`, large padded rows, a 4px left border, and an always-visible action column.
- The existing load state is plain `Loading status items...`; it replaces the entire Status surface.
- Current context design already calls for a compact status record and a `...` menu, so this redesign reconciles implementation with documented intent rather than inventing a new pattern.

## Shared DATA-TABLE status contract

`backend/features/project_document/tables/_status_field.py` is the source of truth. Its module comment explicitly reserves the field for a future splash-page completeness dashboard.

- Values live in `row.custom_values["status"]`.
- Options: Complete, Needed, Question, N/A.
- New records default to Needed.
- `tables/registry.py` has a drift guard requiring the 12-table inventory to match contracts carrying the field.
- Every in-scope row also has a `notes` field and a human-facing name/Tag seam.
- Rooms and Space Types intentionally do not carry status.

## Loading architecture

- Existing route pages use per-table slice reads.
- The editor has `GET .../draft/tables?names=...`, which avoids repeated draft loads but still returns full table slices.
- There is no equivalent saved-version batch endpoint and no compact summary projection.
- Reusing 12 table hooks would cause a request/payload and render fan-out on the default landing page.
- A dedicated read model can reuse `STATUS_TABLE_NAMES`, open the selected document once, and omit FieldDefs/specification data.

## Version/source rule

- Editors read working draft table slices.
- Viewers read the selected saved version.
- The summary must preserve that distinction so an anonymous client never sees unsaved editor work.
- Suggested route symmetry:
  - `GET .../draft/status-summary` — edit access.
  - `GET .../document/status-summary` — view access.

## Navigation seams

- Generic equipment already accepts `?tab=<key>&focus=<row_id>`.
- Heat Pump leaves have stable nested paths under `/equipment/heat-pumps/{leaf}`; add/verify `focus` forwarding per leaf.
- Thermal Bridges owns `/thermal-bridges`; add/verify `focus` support there.
- Shared DataTable focus/highlight behavior already exists and should be reused rather than opening a second record-detail implementation on Status.

## Design conclusion

One page is preferable. Record completeness and roadmap milestones differ in data ownership but jointly answer project orientation. A quiet two-pane layout creates enough conceptual separation without adding a top-level route, duplicated page heading, or another client navigation choice.

