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

Phase 4 is implemented on branch `codex/assembly-builder-phase-04`.
Phase 5 is active on branch `codex/assembly-builder-phase-05`, based on
the Phase 4 branch tip because Phase 4 has not yet been flattened into
`main`.

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
`docs/plans/2026-05-26/assembly-builder/phase-05-thermal-hbjson-export.md`.

Primary goal:

- add backend-computed construction-only thermal overlays and a
  saved-version-only HBJSON construction export.

Phase 5 implemented so far on `codex/assembly-builder-phase-05`:

- `GET /envelope/assemblies/{assembly_id}/thermal` over draft or saved
  source with SI canonical R/U values, input hash, warnings, and
  unfinished flags;
- construction-only PH-average thermal calculation for assigned valid
  segments, with null material segments flagged but not blocking the
  preview value when remaining assigned layers are valid;
- `GET /envelope/export/hbjson` that reads the saved version body only,
  rejects incomplete assemblies with structured 422 paths, and exports
  project-material ids, catalog origin, datasheet asset ids, and
  `ref_status` metadata;
- shared thermal issue records used by preview status, selectors, and
  HBJSON export errors;
- Envelope header thermal label that switches between SI U-value and IP
  R-value using shared unit helpers;
- shared frontend/backend download helpers for HBJSON blob delivery and
  JSON attachment responses;
- assembly-scoped thermal query invalidation for local envelope commands
  with broad invalidation retained for shared material or assembly-list
  changes;
- dirty-draft warning before HBJSON download.

Verified on this branch:

- `cd backend && uv run ruff check features/envelope tests/test_envelope_phase04.py tests/test_envelope_phase05.py`
- `cd backend && uv run ty check features/envelope tests/test_envelope_phase05.py`
- `cd backend && uv run pytest tests/test_envelope_phase04.py tests/test_envelope_phase05.py`
- `cd backend && uv run ruff check features/envelope features/shared features/project_document/routes.py tests/test_envelope_phase05.py`
- `cd backend && uv run ty check features/envelope features/shared/responses.py tests/test_envelope_phase05.py`
- `cd frontend && pnpm exec prettier --write src/shared/api/client.ts src/features/envelope/api.ts src/features/envelope/hooks.ts src/features/envelope/__tests__/EnvelopePage.test.tsx`
- `cd frontend && pnpm exec eslint src/features/envelope src/features/catalogs/hooks.ts src/features/project_document/catalog-origin.ts src/features/windows/types.ts`
- `cd frontend && pnpm exec vitest run src/features/envelope/__tests__/EnvelopePage.test.tsx`
- `cd frontend && pnpm exec tsc --noEmit --pretty false 2>&1 | rg "src/features/envelope|src/features/catalogs/hooks|src/features/project_document/catalog-origin|src/features/windows/types" || true`

Remaining before Phase 5 closure:

- add steel-stud equivalent-conductivity regression once the exact AISI
  helper dependency/fixture is available in V2 or replaced with a
  documented deterministic local implementation;
- browser-smoke the full Phase 5 checklist, including downloaded HBJSON
  inspection;
- decide whether the current hand-authored Honeybee-compatible JSON
  shape is enough for V1 export parity or whether V2 should add a
  Honeybee package dependency for stricter object serialization.
