---
DATE: 2026-05-26
TIME: 18:21 EDT
STATUS: Proposed implementation plan.
AUTHOR: Codex
SCOPE: Semantic command endpoint and editor workflows for assembly,
       layer, and segment geometry.
RELATED:
  - docs/features/assembly-builder-prd.md §§5.2, 5.7, 7.1-7.6, 7.10
  - docs/plans/2026-05-26/assembly-builder/phase-01-backend-domain-contracts.md
  - docs/plans/2026-05-26/assembly-builder/phase-02-readonly-envelope-shell.md
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
- command error handling;
- copy/paste stale material id rejection;
- copy/paste visual state and reset behavior;
- copy/paste does not overwrite width, use-site notes, or photos;
- read-only suppression in viewer/locked modes.

Browser:

1. Create a new assembly from empty state.
2. Rename and reclassify it.
3. Add layers/segments, edit dimensions, flip orientation/layers.
4. Delete a segment/layer with guard behavior visible.
5. Duplicate and delete an assembly.
6. Save, reload, and verify geometry persists.
7. Copy/paste an assignment; verify pulse, undo, Escape exit, and
   use-site notes/photos are unchanged.
8. Lock version and verify commands reject/controls disappear.

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
