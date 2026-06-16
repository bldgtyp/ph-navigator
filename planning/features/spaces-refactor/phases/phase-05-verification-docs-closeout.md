---
DATE: 2026-06-16
TIME: 15:59 EDT
STATUS: Planned
AUTHOR: Ed (via Codex)
SCOPE: Final verification, docs updates, graph refresh, and closeout.
RELATED:
  - planning/features/spaces-refactor/PRD.md
  - planning/features/spaces-refactor/STATUS.md
  - context/user-stories/30-tables-equipment.md
  - context/technical-requirements/data-model.md
---

# Phase 05 - Verification And Docs Closeout

## Goal

Verify the full Spaces workflow and fold durable decisions back into
stable context docs.

## Preconditions

- Phases 01-04 are implemented.
- Focused backend and frontend tests for the feature are green.

## Tasks

1. Run `make format` from the repo root.
2. If formatting changes files, inspect the diff.
3. Run `make ci` from the repo root.
4. Run `graphify update .` after code changes.
5. Browser smoke with frontend `http://localhost:5173` and backend
   `http://localhost:8000`, signed in as `codex@example.com`:
   - open Spaces;
   - create two Space-Types;
   - create/edit a Room;
   - set the Room's Space Type;
   - confirm reverse Rooms link appears on Space-Types;
   - click reverse Room pill and confirm focus/open behavior;
   - confirm legacy `/rooms` URL redirects.
6. Update stable docs:
   - `context/user-stories/30-tables-equipment.md` for the old Rooms
     top-level wording and new Spaces parent;
   - `context/technical-requirements/data-model.md` for
     `tables.space_types` and Rooms `space_type_id`;
   - `context/UI_UX.md` if project tab guidance still lists Rooms.
7. Update `planning/features/spaces-refactor/STATUS.md` with evidence.

## Acceptance Criteria

- `make format` and `make ci` are green.
- Browser smoke validates the end-to-end user workflow.
- Stable docs no longer describe Rooms as a top-level project tab.
- Planning status records completed phases and verification evidence.

## Stop Conditions

- Stop if full `make ci` is red.
- Stop if browser smoke cannot confirm reverse-link rendering or route
  compatibility.
- Stop if context docs would contradict implemented behavior.

## File Entry Points

- `context/user-stories/30-tables-equipment.md`
- `context/technical-requirements/data-model.md`
- `context/UI_UX.md`
- `planning/features/spaces-refactor/STATUS.md`
