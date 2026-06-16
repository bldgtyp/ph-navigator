---
DATE: 2026-06-16
TIME: 15:59 EDT
STATUS: Active - Phase 04 complete; Phase 05 next
AUTHOR: Ed (via Codex)
SCOPE: Refactor the current Rooms top-level tab into a Spaces parent tab,
  add a Space-Types project-document DataTable, link Rooms to Space-Types,
  and surface the reverse Rooms link on Space-Types.
RELATED:
  - planning/features/spaces-refactor/PRD.md
  - planning/features/spaces-refactor/PLAN.md
  - planning/features/spaces-refactor/STATUS.md
  - context/user-stories/30-tables-equipment.md
  - context/technical-requirements/data-model.md
  - context/technical-requirements/data-table.md
  - frontend/src/features/equipment/routes/RoomsPage.tsx
  - backend/features/project_document/tables/rooms.py
---

# Spaces Refactor - Feature Folder

## Scope

Refactor the current **Rooms** project tab into a **Spaces** parent tab
with two sub-tabs:

1. **Space-Types** - a new project-document DataTable where users define
   per-building space type records such as Hallway, Restroom, Apartment,
   or project-specific equivalents.
2. **Rooms** - the existing Rooms table, extended with a single-link
   field to one Space-Type row.

Space-Types are not pre-populated. Each project builds its own type
list. Space-Types also render a read-only reverse-link field showing the
Rooms that point at each type.

## Read Order

1. `PRD.md` - product/data/UX contract.
2. `PLAN.md` - implementation sequence and cross-cutting risks.
3. `STATUS.md` - current state and next action.
4. Phase files under `phases/` when implementing.

## Phase Map

| Phase | File | Goal |
|---|---|---|
| 01 | `phases/phase-01-backend-space-types-table.md` | Add the backend Space-Types table contract, document shape, schema version, and table-slice response. |
| 02 | `phases/phase-02-rooms-space-type-link.md` | Add the Rooms single-link FieldDef, enforce `max_links=1`, and expose inverse Rooms links on Space-Types. |
| 03 | `phases/phase-03-frontend-spaces-parent.md` | Replace the Rooms top-level tab with Spaces and add Space-Types / Rooms sub-tabs with redirects. |
| 04 | `phases/phase-04-frontend-table-link-ui.md` | Build the Space-Types DataTable UI and wire Rooms single-link picker plus reverse-link display. |
| 05 | `phases/phase-05-verification-docs-closeout.md` | Run gates, browser smoke, and fold durable decisions into context docs. |

## Current Assumptions

- Table key: `space_types`.
- User-facing tab label: `Spaces`.
- User-facing sub-tab label: `Space-Types`.
- Default `Spaces` sub-tab: `Space-Types`, because it is the setup
  table for the Rooms link field.
- Existing `/projects/:projectId/rooms` routes should redirect to
  `/projects/:projectId/spaces/rooms` to preserve deep links.
- Space-Type user-facing primary key is **Tag**. Implement this through
  the existing FieldDef convention as `record_id` with display name
  `Tag`, unless implementation discovers a stronger local precedent.

## Out Of Scope

- Pre-populating Space-Types with standard labels.
- HBJSON import/sync from model room metadata.
- Deriving iCFA, ventilation, occupancy, or PHPP program assumptions
  from a Space-Type.
- Shared/global Space-Type catalogs.
- Removing the existing `rooms` document key. Rooms remains the
  canonical table key; only the UI parent tab changes to Spaces.
