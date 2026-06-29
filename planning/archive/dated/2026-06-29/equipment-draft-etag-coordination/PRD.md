---
DATE: 2026-06-29
TIME: 16:52 EDT
STATUS: Complete - behavior contract implemented and verified.
AUTHOR: Codex
SCOPE: User-facing and technical acceptance criteria for stale draft ETag coordination.
RELATED:
  - README.md
  - PLAN.md
  - STATUS.md
  - phases/
---

# PRD - Equipment Draft ETag Coordination

## Problem

A user editing a project draft can make a valid change in one Equipment table
and then be blocked when editing another Equipment table in the same page and
same browser tab.

The visible error says another tab changed the draft, but the reproduction does
not require another tab. The first Equipment edit advances the shared document
`draft_etag`; the second mounted Equipment table still holds the pre-edit guard.

## User Story

As a PH-Navigator editor, I can add or edit Equipment records across multiple
Equipment sub-tabs before saving the project version, without being forced to
reload the draft after each sub-tab change.

## Current Behavior

- The first table edit succeeds and creates or updates the user's draft.
- The accepted write response updates the table that was edited.
- Sibling editor table slices are marked invalid, but active refetch is
  suppressed for performance.
- Switching to another already-mounted Equipment sub-tab reuses its stale
  slice data.
- The second table edit sends the stale `draft_etag`.
- Backend returns `409 draft_etag_mismatch`.
- UI shows the table's `activeRowConflict` copy, for example:
  `The Hot Water Tanks draft changed in another tab. Reload the draft before editing.`

## Target Behavior

- A same-session write on Table A may keep sibling table queries invalidated
  but not eagerly refetched.
- Before Table B sends a write, if its editor slice query was invalidated by
  a sibling write, the frontend refreshes Table B or otherwise obtains a fresh
  Table B slice.
- The Table B payload is built against the fresh Table B slice.
- The Table B request uses the latest document-level `draft_etag`.
- No false "changed in another tab" blocker appears for sequential same-session
  edits.
- True stale conflicts from another browser tab, MCP write, or locked version
  continue to block visibly.

## Acceptance Criteria

1. `Equipment / Fans -> Hot-water tanks` row insert/edit succeeds without
   saving the version between edits.
2. The same pattern succeeds for another non-heat-pump Equipment pair, for
   example `Pumps -> Appliances`.
3. The same pattern succeeds for heat-pump leaf tables if they share the generic
   table-slice write path.
4. A stale `draft_etag_mismatch` from a real external writer still shows a
   reload/review blocker.
5. One edit does not eagerly refetch every inactive Equipment table.
6. Focused unit tests prove the fresh target slice is used before mutation.
7. Focused Playwright coverage exercises the user reproduction through the UI.
8. Durable docs continue to state that `draft_etag` is document-scoped.

## Non-Goals

- Do not make `replace_table` table-scoped concurrency.
- Do not silently merge overlapping true concurrent edits.
- Do not broaden the default CI suite unless the table-regression run policy is
  explicitly changed.
- Do not rename Equipment tabs or restructure the page.

## Copy Note

The current banner copy says "changed in another tab." That wording is accurate
for true cross-tab conflicts, but misleading for this regression. The preferred
implementation should prevent the false blocker. If any same-session stale guard
can still surface, replace copy at the generic conflict seam with a neutral
message such as:

```text
The draft changed before this edit. Reload the draft before editing.
```
