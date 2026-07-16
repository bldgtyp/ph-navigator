---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: Active — captured, needs one naming decision from Ed
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

## Open question for Ed (naming collision)

After the rename, the parent tab **Spaces** would contain sub-tabs **Spaces** and
**Space Types** — i.e. "Spaces › Spaces". Options:

- (a) Accept "Spaces › Spaces" (matches the request literally).
- (b) Drop/rename the parent so it isn't doubled.
- (c) Rename the sub-tab to something like "Spaces (Rooms)" or another label.

Defaulting to (a) unless Ed says otherwise; this is the only thing blocking a
clean write-up of the change.

## Acceptance

- Clicking the Spaces tab lands on the Rooms/Spaces sub-tab first.
- Sub-tab order shows the renamed "Spaces" tab before "Space Types".
- Internal `rooms` key/path, table-view persistence, and MCP paths unchanged.
