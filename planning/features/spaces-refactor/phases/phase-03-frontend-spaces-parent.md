---
DATE: 2026-06-16
TIME: 17:34 EDT
STATUS: Complete
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

1. [x] Update `PROJECT_TABS`, `ProjectTab`, `TAB_LABELS`, and `TAB_COPY` in
   `frontend/src/features/projects/lib.ts`:
   - remove `rooms`;
   - add `spaces`;
   - label `Spaces`.
2. [x] Add a `SpacesPage` route component with `AppSubTabs` for:
   - `space-types`
   - `rooms`
3. [x] Move `RoomsPage` rendering under `SpacesPage` for the `rooms`
   sub-tab. Keep the Rooms table implementation intact.
4. [x] Add route compatibility for `/projects/:projectId/rooms` to redirect
   to `/projects/:projectId/spaces/rooms`.
5. [x] Update all internal navigation that points at Rooms:
   - heat-pump / equipment room chips;
   - row focus/open links;
   - tests that assert the old route.
6. [x] Preserve query params for `focus`, `open`, and `version` during
   redirects.
7. [x] Add frontend route tests for:
   - project tab list shows Spaces and not Rooms;
   - `/spaces` defaults to `/spaces/space-types`;
   - `/rooms?focus=...&open=1` redirects to `/spaces/rooms?...`.

## Progress

- 2026-06-16 17:18 EDT: Phase 03 started. Scope is frontend route and
  navigation structure only; Phase 04 remains responsible for the
  editable Space-Types DataTable and Rooms Space Type picker UI.
- 2026-06-16 17:25 EDT: Implementation complete. Added the Spaces top
  tab, nested `SpacesPage`, `/spaces -> /spaces/space-types` redirect,
  `/rooms -> /spaces/rooms` redirect with query/hash preservation,
  moved Rooms rendering under the Spaces/Rooms sub-tab, updated inverse
  source routing, and refreshed stale E2E selectors.
- 2026-06-16 17:25 EDT: Feature-shape guard required standard
  `frontend/src/features/spaces/` package boundary files. Added empty
  API/hooks/types/query-key surfaces plus README notes so Phase 04 can
  fill the Space-Types slice without moving route code.
- 2026-06-16 17:31 EDT: `$ simplify` complete. Accepted findings:
  added canonical Spaces path helpers, made the top Spaces project tab
  land directly on `/spaces/space-types`, and centralized E2E Rooms
  navigation in `openRoomsTable`. Deferred the broader `AppSubTabLink`
  button-vs-link accessibility concern because it affects shared sub-tab
  behavior beyond this phase.
- 2026-06-16 17:34 EDT: `$ docs-pass` complete. No stable `context/`
  edits for this phase; Phase 05 remains responsible for final context
  doc updates after the Space-Types table and Rooms link UI are verified.

## Verification

- `cd frontend && pnpm exec vitest run src/App.test.tsx src/features/equipment/__tests__/PumpsTable.reuse.test.tsx`
  - 33 passed on 2026-06-16 17:30 EDT.
- `cd frontend && pnpm exec eslint src/App.test.tsx src/app/router.tsx src/features/spaces src/features/projects/lib.ts src/features/projects/components/ProjectTabContent.tsx src/features/equipment/lib/inverseRoutes.ts src/features/equipment/routes/RoomsPage.tsx src/features/equipment/heat-pumps/components/IndoorUnitsTable.tsx src/features/equipment/__tests__/PumpsTable.reuse.test.tsx`
  - Passed on 2026-06-16 17:30 EDT.
- `cd frontend && pnpm run check:shape`
  - Passed on 2026-06-16 17:30 EDT.
- `cd frontend && pnpm exec prettier --check src/features/spaces/README.md src/features/spaces/api.ts src/features/spaces/hooks.ts src/features/spaces/query-keys.ts src/features/spaces/types.ts src/features/spaces/routes/SpacesPage.tsx src/App.test.tsx`
  - Passed on 2026-06-16 17:24 EDT.
- `cd frontend && pnpm run build`
  - Passed on 2026-06-16 17:30 EDT; Vite emitted the existing large
    chunk warning.
- `make format`
  - Passed on 2026-06-16 17:33 EDT; no files changed.
- `graphify update .`
  - Passed on 2026-06-16 17:33 EDT.
- `$ docs-pass`
  - Completed on 2026-06-16 17:34 EDT; no stable `context/` edits.
- Full `make ci`
  - Deferred until Phase 05 per current direction.

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
