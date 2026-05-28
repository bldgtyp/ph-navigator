---
DATE: 2026-05-27
TIME: 17:22 EDT
STATUS: Proposed implementation plan.
AUTHOR: Codex
SCOPE: Assembly Builder UI/Layout parity, phase 16.
RELATED:
  - planning/features/assembly-builder/PRD.md
  - planning/features/assembly-builder/STATUS.md
  - planning/features/assembly-builder/phases/phase-08-mcp-hardening-release.md
  - planning/features/assembly-builder/phases/phase-13-three-pane-assemblies-shell.md
  - planning/features/assembly-builder/phases/phase-14-to-scale-canvas-hover-controls.md
  - planning/features/assembly-builder/phases/phase-15-dialogs-material-picker-specifications-polish.md
  - research/v1-assembly-builder-reference.md
---

# Phase 16 - UI Parity Browser Hardening

## Goal

Close the UI/Layout parity loop with browser evidence, scale evidence,
accessibility checks, and docs updates. This phase is the release
readiness pass for the V1-derived Assembly Builder experience.

Phase 16 is the execution home for the UI/browser/release-evidence debt
that remains after Phase 8's MCP backend work. Phase 8 remains the
provenance plan for the MCP tool surface; this phase owns the final
browser matrix, scale fixture, V1 parity audit, and docs closeout.

## In Scope

- Run a V1 parity audit against:
  - `research/v1-assembly-builder-reference.md`;
  - the V1 reference screenshots in `planning/features/assembly-builder/assets/`;
  - PRD §8, §12, and §13.
- Create one deterministic reusable scale fixture or seed helper with:
  - a named edge-case set covering very thin layers, narrow segments,
    long material names, null materials, drift states, and evidence
    badges;
  - an optional large-scale variant with dozens of assemblies, low
    hundreds of segments, and dozens of project materials.
- Browser-drive one consolidated matrix over the seeded project,
  covering:
  - accumulated Phase 4-7 deferred workflows;
  - Phase 13 sidebar/top-bar switching;
  - Phase 14 canvas hover/focus controls;
  - Phase 15 dialogs and material picker;
  - IP/SI labels and editors.
- Verify locked-version and viewer read-only behavior across all
  Assembly Builder sub-surfaces.
- Check responsive behavior at desktop and narrow widths used by the
  app.
- Update PRD lessons and `STATUS.md` with final evidence and accepted
  parity gaps.

## Out Of Scope

- New feature behavior discovered during audit. Record those as follow-
  up phases or V1.1 candidates unless they block core v1 acceptance.
- HBJSON import.
- Multi-row material division grids.
- Keyboard copy/paste shortcuts.

## Implementation Notes

- Treat this as evidence gathering plus small hardening fixes, not a
  broad redesign phase.
- Save screenshots or notes under `working/` while iterating. Promote
  only durable conclusions into `planning/` or `context/`.
- Do not duplicate the narrow smoke checks already run in Phases 13-15;
  use this phase for the consolidated end-to-end matrix and release
  evidence.
- If full repo gates remain blocked by unrelated table-schema drift,
  document the exact blockers and run scoped Envelope gates plus browser
  smoke.

## Verification

- `git diff --check`
- `cd backend && uv run ruff check features/envelope tests/envelope tests/test_mcp.py`
- `cd backend && uv run ty check features/envelope tests/envelope tests/test_mcp.py`
- `cd backend && uv run pytest tests/envelope tests/test_mcp.py`
- `cd frontend && pnpm run format`
- `cd frontend && pnpm exec eslint src/features/envelope src/shared/lib src/shared/ui`
- `cd frontend && pnpm exec vitest run src/features/envelope/__tests__/`
- `cd frontend && pnpm run build` when unrelated blockers are cleared;
  otherwise capture filtered type/build blockers in `STATUS.md`.
- Consolidated browser smoke on seeded data for editor, locked, and
  viewer modes.

## Exit Criteria

- Assembly Builder looks and works like a V2-native successor to V1's
  Assembly Builder.
- The accepted V1 parity gaps are explicit in the PRD or deferred list.
- Phase 4-8 browser/UI smoke debt is resolved or converted into named
  blockers with evidence.
- `STATUS.md` has current gates, screenshots/notes locations, and next
  follow-up if any.

## Risks

- Scope creep is likely because parity audits reveal many small V1
  behaviors. Keep v1 acceptance tied to PRD §13 and move non-blocking
  items to V1.1.
- Scale fixtures can mask layout problems if they do not include very
  thin layers, narrow segments, long material names, null materials, and
  drift/evidence badges. Include those cases deliberately.
