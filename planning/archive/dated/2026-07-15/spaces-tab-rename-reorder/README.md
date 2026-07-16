---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: Complete — squash-merged to main 2026-07-15 (from branch
  `refactor/spaces-tab-rename-reorder`). Deploys to production via Render.
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Under the Spaces tab, reorder the sub-tabs so "Rooms" is first and opens
  by default, and rename the "Rooms" label to "Spaces" (display only — the
  internal `rooms` table key/path is a data contract and must not change).
RELATED:
  - frontend/src/features/spaces/routes/SpacesPage.tsx (sub-tab order + default; ~26, ~59)
  - frontend/src/features/spaces/components/SpaceTypesTable.tsx (~145 tableName="Space Types")
  - backend/frontend `rooms` table key — persisted contract (source_table_path: ["rooms"], tableKey "rooms")
---

# Spaces tab — reorder sub-tabs + rename "Rooms" → "Spaces"

## Item 7 (two parts)

1. **Reorder + default.** The Spaces tab's sub-tabs currently open on "Space
   Types". Make the **Rooms** sub-tab **first in order** and the **default** tab
   when the user clicks Spaces.
2. **Rename label.** Rename **"Rooms" → "Spaces"** — the semantically correct
   term for these model elements, aligning with Honeybee-PH tooling.

## Important constraint — display-only rename

The underlying table key/path is `"rooms"` (`source_table_path: ["rooms"]`,
`tableKey = "rooms"`), used by persisted table-view state, query keys, and likely
MCP/backend. **Rename the user-facing label only; leave the internal `rooms`
key/path untouched** to avoid a data migration and MCP/API breakage. Grep for the
`"Rooms"` display string vs. the `rooms` identifier and change only the former.

## Resolved — naming collision

After the rename, the parent tab **Spaces** contains sub-tabs **Spaces** and
**Space-Types** ("Spaces › Spaces"). **Ed chose (a): accept "Spaces › Spaces"**
(matches the request literally). Options (b) drop/rename parent and (c) label
"Spaces (Rooms)" were declined.

## Acceptance — met

- ✅ Clicking the Spaces tab lands on the Rooms/Spaces sub-tab first (both
  `SpacesPage` `Navigate` fallbacks default to `spacesRoomsPath`).
- ✅ Sub-tab order shows the renamed "Spaces" tab before "Space-Types".
- ✅ Internal `rooms` key/path, table-view persistence, and MCP paths
  unchanged — rename touches only display strings (sub-tab label + table
  title, the latter also driving the CSV/JSON export filename).

## Implementation

Branch `refactor/spaces-tab-rename-reorder`, commit `827cd0d7`.

- `frontend/src/features/spaces/routes/SpacesPage.tsx` — reorder sub-tabs,
  default both redirects to the Rooms path, relabel the sub-tab "Spaces".
- `frontend/src/features/equipment/components/RoomsTable.tsx` — DataTable
  `tableName` "Rooms" → "Spaces".
- `frontend/src/App.test.tsx` — default-redirect test rewritten for the Rooms
  default; sub-tab button assertions → "Spaces"; region aria-label stays
  "Rooms" (internal identity, deliberately unchanged).
- `frontend/tests/e2e/_helpers.ts` — `openRoomsTable` clicks the "Spaces"
  sub-tab button.
- Docs sync: `context/ui/pages/spaces-equipment-tab.md`,
  `context/user-stories/30-tables-equipment.md`.

## Verification

- `make format` — clean. `pnpm run lint` — 0 errors (14 pre-existing warnings).
- `tsc -b && vite build` — pass. Full Vitest — 2165 passed (233 files).
- Playwright e2e not run (display-label swap; helper updated to match). The
  region aria-label diverging from the visible tab label ("Rooms" region under
  a "Spaces" tab) is a deliberate, minor a11y quirk kept to avoid touching the
  internal `rooms` identity.
