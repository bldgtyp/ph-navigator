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
- `make smoke` remains blocked locally when another worktree owns the
  shared Docker container name `phn-v2-postgres`.
- Main still has unrelated local worktree dirt outside Assembly Builder
  tracking (`.claude/worktrees/` and the Plan 31 file move). Do not fold
  that into Assembly Builder commits unless explicitly asked.

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
