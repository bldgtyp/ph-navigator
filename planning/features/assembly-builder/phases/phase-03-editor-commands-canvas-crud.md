---
DATE: 2026-05-26
TIME: 18:21 EDT
STATUS: Implemented; flattened into main with Phases 1-3.
AUTHOR: Codex
SCOPE: Semantic command endpoint and editor workflows for assembly,
       layer, and segment geometry.
RELATED:
  - planning/features/assembly-builder/PRD.md §§5.2, 5.7, 7.1-7.6, 7.10
  - planning/features/assembly-builder/phases/phase-01-backend-domain-contracts.md
  - planning/features/assembly-builder/phases/phase-02-readonly-envelope-shell.md
  - context/technical-requirements/save-versioning.md
  - context/user-stories/20-envelope.md US-ENV-2..9
---

# Phase 3 - Editor Commands And Canvas CRUD

## Goal

Make the visual builder editable through semantic envelope commands.
This phase proves the deepest architectural boundary: the UI expresses
intent, the backend applies safe draft mutations, and nested array edits
cannot land on the wrong entity after reorder/delete conflicts.

## In Scope

- `POST /draft/envelope/commands` command dispatcher.
- Assembly commands:
  - create;
  - rename;
  - update type;
  - duplicate;
  - delete.
- Layer commands:
  - add above/below;
  - update thickness;
  - delete with last-layer guard.
- Segment commands:
  - add left/right;
  - update width, continuous-insulation flag, steel-stud fields;
  - delete with last-segment guard.
- Orientation and layer-order commands:
  - flip orientation;
  - flip layers.
- Copy/paste assignment command for material id + CI/stud fields,
  deliberately not copying width, use-site notes, or photos.
- Frontend dialogs/modals for geometry and destructive actions.
- Unit-aware layer thickness, segment width, and steel-stud spacing
  editors using shared IP/SI length helpers.
- Draft ETag handling, stale-conflict UI, locked-version rejection, and
  same-editor tab behavior for this feature.

## Out Of Scope

- Catalog material picking.
- Full project-material editor.
- Specifications evidence upload.
- Thermal calculation.
- HBJSON export.
- MCP write tools.

## Backend Work

The command dispatcher should:

- accept one command at a time;
- check editor access and locked-version state;
- create the draft lazily on first mutation;
- verify stable ids before positional mutations;
- apply the mutation server-side;
- validate the full project document or affected envelope slice;
- return the updated envelope slice and ETags;
- produce structured conflict and validation errors.

Do not expose generic "replace assemblies array" as the primary canvas
write API.

## Frontend Work

Add editor controls to the Phase 2 shell:

- assembly sidebar/header actions;
- layer thickness modal;
- segment properties modal for geometry/function fields;
- unit-aware display/input for `thickness_mm`, `width_mm`, and
  `steel_stud_spacing_mm`, including active-editor behavior when units
  are toggled mid-edit;
- hover add controls;
- destructive confirmations with site-photo detach counts;
- pick/paste mode state, target highlighting, paste pulse, Escape /
  click-outside exit behavior, assembly-switch reset, and undo stack;
- stale-command recovery messaging.

The UI may continue to show null materials. Material assignment is
limited to copying/pasting existing `project_material_id` values from
seed/fixture data until Phase 4.

## Verification Gates

Backend:

- command happy paths;
- stale ETag;
- wrong stable id / deleted target;
- locked version;
- last-layer and last-segment guards;
- duplicate assembly name;
- duplicate assembly clears segment photos and use-site notes while
  preserving project-material references;
- layer/segment order contiguity after insert/delete;
- destructive commands preserve project-material rows.

Frontend:

- modal form behavior;
- length parsing/formatting through shared unit helpers;
- focused layer/segment numeric editors are not rewritten when IP/SI is
  toggled, and still commit canonical mm;
- command error handling;
- copy/paste stale material id rejection;
- copy/paste visual state and reset behavior;
- copy/paste does not overwrite width, use-site notes, or photos;
- read-only suppression in viewer/locked modes.

Browser:

1. Create a new assembly from empty state.
2. Rename and reclassify it.
3. Add layers/segments, edit dimensions, flip orientation/layers.
4. Toggle SI/IP while a thickness or segment-width modal is open; verify
   the draft string is stable and commit writes canonical mm.
5. Delete a segment/layer with guard behavior visible.
6. Duplicate and delete an assembly.
7. Save, reload, and verify geometry persists.
8. Copy/paste an assignment; verify pulse, undo, Escape exit, and
   use-site notes/photos are unchanged.
9. Lock version and verify commands reject/controls disappear.

Commands:

```bash
cd backend
uv run ruff check .
uv run ty check
uv run pytest tests/test_project_document.py

cd ../frontend
pnpm run format
pnpm test -- --run src/features/envelope
pnpm run build
```

Run `make smoke` plus a browser smoke before closeout.

## Success Criteria

1. All canvas geometry edits use semantic commands.
2. No UI component hand-builds nested array JSON-Patch.
3. Draft/save behavior matches existing project-document controls.
4. Conflict handling preserves user context rather than closing modals
   on failed writes.

## Implementation Progress Notes

2026-05-27 - Implemented on branch `codex/assembly-builder-phase-03`
in worktree
`/Users/em/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator-v2-assembly-builder-phase-03`.

Delivered:

- backend `POST /draft/envelope/commands` with semantic command DTOs,
  editor/locked guards, lazy draft creation, ETag conflict handling,
  stable-id validation, full document validation, and updated envelope
  response;
- assembly create/rename/type/duplicate/delete commands;
- layer add/update/delete commands with last-layer guard;
- segment add/update/delete commands with last-segment guard;
- orientation flip, layer-order flip, and paste-assignment commands;
- frontend command mutation plumbing that replaces local envelope state
  from the command response;
- editor controls and dialogs for assembly, layer, and segment CRUD;
- unit-aware modal inputs for layer thickness, segment width, and stud
  spacing, including an in-modal IP/SI preference toggle that leaves
  the active draft string and parser unit frozen until submit;
- copy/paste assignment mode with target highlighting, Escape reset,
  and Save/reload persistence through the project-document controls.

Verification completed:

- `git diff --check`
- `cd backend && uv run ruff check features/envelope tests/test_envelope_phase03.py`
- `cd backend && uv run ruff check .`
- `cd backend && uv run ty check features/envelope tests/test_envelope_phase03.py`
- `cd backend && uv run pytest tests/test_envelope_phase01.py tests/test_envelope_phase03.py`
- `cd frontend && pnpm exec prettier --write 'src/features/envelope/**/*.{ts,tsx,css}'`
- `cd frontend && pnpm exec tsc --noEmit`
- `cd frontend && pnpm exec vitest run src/features/envelope/__tests__/EnvelopePage.test.tsx`
- `cd frontend && pnpm run lint`
- `cd frontend && pnpm run check:shape && pnpm run build`
- browser smoke on `http://127.0.0.1:5176`: restored the AB-02 draft,
  renamed `WALL-C3`, edited layer thickness, toggled IP/SI while the
  modal was open, copy/pasted a segment assignment, saved, reloaded,
  and verified clean saved state.

Known verification caveats:

- `cd backend && uv run ty check` still fails on the pre-existing
  custom-field / project-document baseline noted in Phase 1; the scoped
  envelope Ty gate passes.
- `make smoke` is blocked locally because the shared Docker container
  name `phn-v2-postgres` is already owned by another worktree's running
  compose stack.

2026-05-27 - Simplify follow-up committed as `1d87078`. The follow-up
kept Phase 3 behavior unchanged while reducing editor plumbing:

- reused shared draft write header selection for envelope command
  writes;
- stored copied segment assignments as a small material/CI/stud-spacing
  payload instead of the full segment object;
- extracted a shared frozen-unit length draft helper for modal
  thickness, width, and stud-spacing inputs;
- avoided unnecessary sibling renumbering for in-place layer and
  segment updates;
- tightened backend insert-position helper types to preserve the
  command `Literal` contract.

Simplify verification repeated:

- `git diff --check`
- `cd backend && uv run ruff check features/envelope tests/test_envelope_phase03.py`
- `cd backend && uv run ty check features/envelope tests/test_envelope_phase03.py`
- `cd backend && uv run pytest tests/test_envelope_phase01.py tests/test_envelope_phase03.py`
- `cd frontend && pnpm exec prettier --write 'src/features/envelope/**/*.{ts,tsx,css}' 'src/features/project_document/table-slice.ts'`
- `cd frontend && pnpm exec tsc --noEmit`
- `cd frontend && pnpm exec vitest run src/features/envelope/__tests__/EnvelopePage.test.tsx`
- `cd frontend && pnpm run lint`
- `cd frontend && pnpm run check:shape && pnpm run build`

## Risks

- **Command dispatcher becomes a shallow switch statement.** Mitigation:
  keep mutation helpers named by domain intent and test them through the
  public command API.
- **Frontend optimistic state diverges from backend validation.**
  Mitigation: replace local envelope slice from command response after
  each successful mutation.
- **Undo scope expands too far.** Mitigation: only paste undo is in
  scope; broad document undo remains out of scope.

## Lessons To Capture

Record lessons for:

- stable-id guard shape;
- modal conflict UX;
- command response shape;
- any command split/merge that changes later phase planning.
