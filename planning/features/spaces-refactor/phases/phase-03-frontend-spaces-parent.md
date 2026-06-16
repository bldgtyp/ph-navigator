---
DATE: 2026-06-16
TIME: 15:59 EDT
STATUS: Planned
AUTHOR: Ed (via Codex)
SCOPE: Frontend routing/navigation refactor from Rooms top-level tab to
  Spaces parent with sub-tabs.
RELATED:
  - planning/features/spaces-refactor/PRD.md
  - frontend/src/features/projects/lib.ts
  - frontend/src/features/projects/components/ProjectTabContent.tsx
  - frontend/src/app/router.tsx
  - frontend/src/features/equipment/routes/RoomsPage.tsx
---

# Phase 03 - Frontend Spaces Parent

## Goal

Replace the top-level Rooms tab with a top-level Spaces tab and route
Spaces sub-tabs for Space-Types and Rooms.

## Preconditions

- Phase 01 is complete enough for the frontend to fetch a Space-Types
  slice.
- Phase 02 may be in progress, but route work should not depend on
  polished linked-cell rendering.

## Tasks

1. Update `PROJECT_TABS`, `ProjectTab`, `TAB_LABELS`, and `TAB_COPY` in
   `frontend/src/features/projects/lib.ts`:
   - remove `rooms`;
   - add `spaces`;
   - label `Spaces`.
2. Add a `SpacesPage` route component with `AppSubTabs` for:
   - `space-types`
   - `rooms`
3. Move `RoomsPage` rendering under `SpacesPage` for the `rooms`
   sub-tab. Keep the Rooms table implementation intact.
4. Add route compatibility for `/projects/:projectId/rooms` to redirect
   to `/projects/:projectId/spaces/rooms`.
5. Update all internal navigation that points at Rooms:
   - heat-pump / equipment room chips;
   - row focus/open links;
   - tests that assert the old route.
6. Preserve query params for `focus`, `open`, and `version` during
   redirects.
7. Add frontend route tests for:
   - project tab list shows Spaces and not Rooms;
   - `/spaces` defaults to `/spaces/space-types`;
   - `/rooms?focus=...&open=1` redirects to `/spaces/rooms?...`.

## Acceptance Criteria

- The project tab bar shows Spaces instead of Rooms.
- Spaces renders a sub-tab bar with Space-Types and Rooms.
- Existing deep links to Rooms continue to land on the Rooms table.
- Browser back/forward works across Spaces sub-tabs.

## Stop Conditions

- Stop if route redirect drops `version`, `focus`, or `open` params.
- Stop if moving Rooms under Spaces causes duplicate data fetching or
  invalidates the existing Rooms modal/deep-link behavior.

## File Entry Points

- `frontend/src/features/projects/lib.ts`
- `frontend/src/features/projects/components/ProjectTabContent.tsx`
- `frontend/src/app/router.tsx`
- `frontend/src/features/spaces/routes/SpacesPage.tsx`
- `frontend/src/features/equipment/routes/RoomsPage.tsx`
