---
DATE: 2026-06-04
TIME: 15:30 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Assembly Canvas Phase 04 — header toolbar parity and Flip Segments command
RELATED:
  - planning/archive/assembly-builder/PRD.md
  - planning/archive/assembly-builder/STATUS.md
  - backend/features/envelope/models.py
  - backend/features/envelope/commands/assemblies.py
  - backend/features/envelope/commands/registry.py
  - frontend/src/features/envelope/components/AssemblyHeader.tsx
  - frontend/src/features/envelope/routes/EnvelopePage.tsx
---

# Phase 04 — Toolbar Parity

## Goal

Finish the PRD §5.7 toolbar surface by adding the new all-layers
**Flip Segments** operation next to the existing Flip Orientation and
Flip Layers commands, while keeping pick / paste modes and in-flight
commands from producing ambiguous geometry edits.

## Implemented

- Added a semantic backend `flip_segments` envelope command and routed
  it through the command registry. The command reverses segments inside
  every layer of the target assembly and renumbers each layer's segment
  order independently.
- Added a no-op short-circuit so assemblies with zero or one segment
  per layer return unchanged instead of rebuilding the document body.
- Added the frontend `flip_segments` command type and wired the header
  button through `AssemblyWorkspace` / `EnvelopePage`.
- Kept all three flip buttons disabled while the canvas is in pick or
  paste mode, and while another envelope command is in flight.
- Added a route-level in-flight guard around semantic envelope
  commands so rapid toolbar clicks cannot post duplicate commands with
  the same draft etag before TanStack Query updates the read model.
- Corrected toolbar button ARIA semantics: only real toggles
  (eyedropper and paint) expose `aria-pressed`; one-shot commands such
  as zoom, download, and flip do not.

## Verification

Focused checks on 2026-06-04:

- `cd backend && uv run ruff check features/envelope tests/envelope/test_envelope_commands_geometry.py`
  — passed.
- `cd backend && uv run ty check features/envelope tests/envelope/test_envelope_commands_geometry.py`
  — passed.
- `cd backend && DATABASE_URL="postgresql://phn:phn_local_only@localhost:5433/ph_navigator_v2_test" uv run pytest tests/envelope/test_envelope_commands_geometry.py`
  — passed (`4` tests).
- `cd frontend && pnpm exec eslint src/features/envelope --max-warnings=0`
  — passed.
- `cd frontend && pnpm exec tsc --noEmit` — passed.
- `cd frontend && pnpm exec vitest run src/features/envelope/__tests__/EnvelopePage.test.tsx`
  — passed (`27` tests).
- `make format` — passed; no files changed.
- `make ci` — passed after recreating only the local
  `ph_navigator_v2_test` database to clear the shared Docker
  container's stale Alembic stamp from another checkout.

Simplify pass:

- Three review agents checked reuse, quality, and efficiency.
- Findings fixed in this phase: false `aria-pressed` on one-shot
  toolbar buttons, duplicate same-etag command risk for rapid flip
  clicks, and unnecessary backend work for visually no-op segment
  flips.
- Deferred from simplify because it spans earlier canvas/editor work:
  reuse of `useLengthDraft` inside inline thickness editing and broader
  canvas paint-controller memoization.

## Remaining

- Authenticated browser screenshot parity against the V1 hover /
  pick / paint references once a seeded authenticated browser route is
  available in this worktree.
- Full `make ci` is green for the current worktree after the local test
  DB was recreated.
