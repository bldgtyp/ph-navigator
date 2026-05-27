---
DATE: 2026-05-27
TIME: 21:30 EDT
STATUS: Active progress and next-steps tracker.
AUTHOR: Codex
SCOPE: Assembly Builder implementation progress after Phases 1-3 were
       flattened into main.
RELATED:
  - docs/plans/2026-05-26/assembly-builder/assembly-builder-prd.md
  - docs/plans/2026-05-26/assembly-builder/README.md
  - docs/plans/2026-05-26/assembly-builder/phase-04-materials-picker-specifications.md
---

# Assembly Builder Progress And Next Steps

## Current State

Assembly Builder Phases 1-3 are flattened into `main` as commit
`5c687c9` (`Add assembly builder phases 1-3`). The phase worktrees and
remote phase branches were removed after the squash merge.

Phase 4 is active on branch `codex/assembly-builder-phase-04`.

Completed implementation surface:

- typed backend envelope document/read contracts;
- registered envelope table/read models for `assemblies[]` and
  `project_materials[]`;
- read-only Envelope route, Assemblies canvas, sidebar, and
  Specifications scaffolds;
- semantic `POST /draft/envelope/commands` endpoint;
- assembly create/rename/type/duplicate/delete commands;
- layer and segment add/update/delete commands with guard behavior;
- orientation/layer-order flip commands;
- copy/paste material-assignment command;
- editor dialogs and unit-aware length inputs for layer thickness,
  segment width, and stud spacing;
- in-modal IP/SI preference toggle that keeps active numeric draft
  strings stable until submit.

## Verified Gates

Latest flatten verification from `main`:

- `git diff --cached --check`
- `cd backend && uv run ruff check features/envelope tests/test_envelope_phase03.py`
- `cd backend && uv run ty check features/envelope tests/test_envelope_phase03.py`
- `cd backend && uv run pytest tests/test_envelope_phase01.py tests/test_envelope_phase03.py`
- `cd frontend && pnpm exec tsc --noEmit`
- `cd frontend && pnpm exec vitest run src/features/envelope/__tests__/EnvelopePage.test.tsx`
- `cd frontend && pnpm run lint`
- `cd frontend && pnpm run check:shape && pnpm run build`

Browser smoke completed before flatten on the Phase 03 worktree:

- opened seeded AB-02 assembly project;
- restored draft;
- renamed an assembly;
- edited layer thickness;
- toggled IP/SI while a modal was open;
- copy/pasted a segment assignment;
- saved and reloaded to a clean saved state.

## Known Caveats

- Full backend `uv run ty check` remains blocked by the pre-existing
  custom-field / project-document baseline noted during Phase 1. Use
  scoped envelope Ty gates until that baseline is reconciled.
- Full frontend `pnpm exec tsc --noEmit` is currently dominated by
  unrelated equipment/custom-field transition errors in the dirty
  worktree. Use filtered Envelope/Catalog type output plus targeted
  Envelope tests until that branch is reconciled.
- `make smoke` remains blocked locally when another worktree owns the
  shared Docker container name `phn-v2-postgres`.
- Main still has unrelated local worktree dirt outside Assembly Builder
  tracking (`.claude/worktrees/` and the Plan 31 file move). Do not fold
  that into Assembly Builder commits unless explicitly asked.

## Phase 4 Active Progress

Implemented on `codex/assembly-builder-phase-04` so far:

- backend command DTOs and service handling for
  `pick_project_material`, `pick_catalog_material`,
  `hand_enter_material`, `update_project_material`,
  `update_segment_use_site_notes`, `detach_segment_material`, and
  `remove_unused_project_materials`;
- backend catalog copy-in from the current Materials catalog record,
  with project-material de-dupe by catalog record id and explicit
  ambiguity rejection when multiple project materials share the same
  origin;
- shared material update behavior with catalog-origin
  `local_overrides` tracking against canonical SI values;
- detach-to-custom behavior that copies product values, datasheets,
  status, and notes, clears `catalog_origin`, and leaves segment
  use-site notes/photos on the segment;
- frontend Segment Properties material picker for existing project
  materials, catalog materials, hand-entered materials, detach, and the
  shared material value editor;
- frontend Specifications editing for status, product values, notes,
  segment-owned use-site notes, and unused-material cleanup;
- lazy Materials catalog query only while the editable Segment
  Properties dialog is open, so normal Envelope reads do not add an
  unrelated catalog dependency;
- simplify pass extracted the shared project-material editor and modal
  unit toggle into dedicated components, moved catalog-origin typing to
  a shared project-document type, and replaced the segment dialog's
  partial-command cast with explicit material callbacks;
- simplify pass changed Specifications editing to mount material and
  use-site note editors on demand instead of mounting controlled forms
  for every visible material/use-site;
- simplify pass added frontend dirty guards for material and use-site
  note edits and a backend no-op guard for project-material table
  replacement.

Verified on this branch:

- `cd backend && uv run ruff check features/envelope tests/test_envelope_phase04.py`
- `cd backend && uv run ty check features/envelope tests/test_envelope_phase04.py`
- `cd backend && uv run pytest tests/test_envelope_phase04.py`
- `cd frontend && pnpm exec prettier --write src/features/catalogs/hooks.ts src/features/envelope/components/EnvelopeEditorDialogs.tsx src/features/envelope/components/SpecificationsPanel.tsx src/features/envelope/components/ProjectMaterialEditor.tsx src/features/envelope/components/ModalUnitToggle.tsx src/features/envelope/routes/EnvelopePage.tsx src/features/envelope/types.ts src/features/windows/types.ts src/features/project_document/catalog-origin.ts`
- `cd frontend && pnpm exec eslint src/features/envelope src/features/catalogs/hooks.ts src/features/windows/types.ts src/features/project_document/catalog-origin.ts`
- `cd frontend && pnpm exec vitest run src/features/envelope/__tests__/EnvelopePage.test.tsx`
- `cd frontend && pnpm exec tsc --noEmit --pretty false 2>&1 | rg "src/features/envelope|src/features/catalogs/hooks|src/features/project_document/catalog-origin|src/features/windows/types" || true`

Remaining before Phase 4 closure:

- add direct frontend tests for material pick/catalog pick/hand-enter,
  Specifications value editing, IP/SI material editor submission, and
  use-site note commands;
- browser-smoke the Phase 4 checklist against a seeded project;
- reconcile or isolate unrelated frontend typecheck failures enough to
  run the full build gate;
- decide whether picker catalog grouping/search needs a richer widget
  before Phase 4 is marked complete.

## Next Implementation Target

Start with
`docs/plans/2026-05-26/assembly-builder/phase-04-materials-picker-specifications.md`.

Primary goal:

- make segment material assignment useful by adding project-material
  picker/copy-in/hand-entry flows and shared Specifications editing.

Phase 4 should preserve the contracts already proven in Phases 1-3:

- all mutations go through semantic envelope commands;
- project-material rows remain shared records referenced by segment ids;
- segment-owned `use_site_notes` and site photos stay on the segment;
- material physical values are stored SI-canonical and displayed through
  shared IP/SI helpers;
- focused material numeric editors must follow the Phase 3 modal-unit
  pattern: visible unit preference may change, but active draft text is
  not reinterpreted mid-edit.

## Phase 4 Pre-Flight

Before coding Phase 4:

- read `assembly-builder-prd.md` §§5.4-5.5, 6.4-6.5, and 7.7-7.11;
- read the Phase 4 plan end to end;
- inspect current envelope command DTOs and service helpers before
  adding material commands;
- verify no references to the legacy feature-doc PRD path have
  reappeared.
