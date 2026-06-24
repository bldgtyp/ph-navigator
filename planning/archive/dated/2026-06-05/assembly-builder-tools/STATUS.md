---
DATE: 2026-06-04
TIME: 12:00
STATUS: Complete
AUTHOR: Ed May
SCOPE: Assembly Canvas refactor (Envelope > Assemblies sub-tab)
RELATED:
  - PRD.md
  - README.md
---

# STATUS — Assembly Canvas refactor

## Current state

**Complete and archived after merge to main.**

- Architectural decision locked: Option C (single SVG with
  `viewBox` in mm + HTML overlay for chrome). See `PRD.md` §3.
- Scope locked: canvas substrate + direct interactions only.
  Sidebar, header name picker / labels, Specifications,
  Airtightness, Site Photos are **out of scope** for this
  feature folder and stay owned by their existing user stories.
- All six open questions resolved 2026-06-04. See `PRD.md` §8
  for the locked answers (per-assembly segment flip; dim lines
  stop at assembly left edge; active-unit display + multi-unit
  input parser; magenta `+` left/right with no hover trash/edit
  icons; click-segment opens modal; zoom max 3.0x).
- Phase 01 substrate is implemented in
  `frontend/src/features/envelope/components/AssemblySvgCanvas.tsx`
  and shares geometry from
  `frontend/src/features/envelope/canvas-geometry.ts` with the
  temporary HTML chrome in
  `frontend/src/features/envelope/components/AssemblyCanvasOverlay.tsx`.
  The old layer-height, segment-width, and layer-width-percent clamps
  are removed.
- Phase 02 overlay chrome is implemented in
  `frontend/src/features/envelope/components/AssemblyCanvasOverlay.tsx`:
  dimension-column thickness editing, magenta layer/segment add
  buttons, and keyboard/click segment edit targets. Shared length
  parsing now accepts explicit SI/IP suffixes and fractional inches.
- Phase 03 direct interactions are implemented through
  `frontend/src/features/envelope/canvas-paint.ts`,
  `frontend/src/features/envelope/routes/EnvelopePage.tsx`, and the
  canvas/header components: eyedropper pick, picked-source ring,
  paint-bucket paste, undo-last-paint, ESC / outside cancellation,
  in-flight duplicate-paint guard, and PRD-approved delete reachability
  through the edit dialogs.
- Phase 04 toolbar parity is implemented through
  `backend/features/envelope/commands/assemblies.py`,
  `backend/features/envelope/models.py`,
  `backend/features/envelope/commands/registry.py`,
  `frontend/src/features/envelope/components/AssemblyHeader.tsx`, and
  `frontend/src/features/envelope/routes/EnvelopePage.tsx`: the new
  all-layers Flip Segments command, disabled flip buttons during pick /
  paste and command-pending states, duplicate same-etag command guards,
  and corrected ARIA semantics for one-shot toolbar buttons.

## Next step

Future follow-up, if reopened:

- Authenticated browser screenshot parity against
  `assets/v1-segment-hover-plus-buttons.png` plus pick / paint states
  once a seeded authenticated browser route is available.
- Decide whether to fold simplify-deferred canvas/editor cleanup into
  a separate maintenance slice: `useLengthDraft` reuse for inline
  thickness editing and memoization of paint-controller/canvas props.

## Blockers

None. The PRD does not depend on any external decision; all
referenced behavior already exists in
`context/user-stories/20-envelope.md`.

## Verification

- Phase 01 evidence is captured in
  `phases/phase-01-svg-canvas-substrate.md`.
- Phase 02 evidence is captured in
  `phases/phase-02-html-overlay-chrome.md`.
- Phase 03 evidence is captured in
  `phases/phase-03-direct-interactions.md`.
- Phase 04 evidence is captured in
  `phases/phase-04-toolbar-parity.md`.
- Phase 04 focused verification passed after implementation and
  simplify pass:
  - `cd backend && uv run ruff check features/envelope tests/envelope/test_envelope_commands_geometry.py`
  - `cd backend && uv run ty check features/envelope tests/envelope/test_envelope_commands_geometry.py`
  - `cd backend && DATABASE_URL="postgresql://phn:phn_local_only@localhost:5433/ph_navigator_v2_test" uv run pytest tests/envelope/test_envelope_commands_geometry.py`
  - `cd frontend && pnpm exec eslint src/features/envelope --max-warnings=0`
  - `cd frontend && pnpm exec tsc --noEmit`
  - `cd frontend && pnpm exec vitest run src/features/envelope/__tests__/EnvelopePage.test.tsx`
- `make format` passed with no file changes.
- `make ci` passed after recreating only the local
  `ph_navigator_v2_test` database to clear the shared Docker
  container's stale Alembic stamp from another checkout.
- Archived residual visual QA:
  - **Visual parity** with `assets/v1-reference-to-scale.png`.
  - **IP / SI input** in the dimension column.
  - **Hover-`+` parity** with
    `assets/v1-segment-hover-plus-buttons.png`.
  - **Flip Segments** toolbar command in a real browser.

## Recent activity

- 2026-06-04 — Feature folder created. PRD drafted (`PRD.md`).
  README + STATUS scaffolded. Prior 16-phase plan in
  `planning/archive/assembly-builder-foundation/` flagged as
  superseded.
- 2026-06-04 — All six open questions (Q-AB-1..Q-AB-6) resolved.
  PRD updated; STATUS bumped to "PRD locked." Next step:
  draft Phase 01 (SVG substrate).
- 2026-06-04 — Phase 01 implemented in the current workspace:
  single SVG substrate, shared mm geometry builder, no render clamps,
  discrete zoom steps, and full `make format` / `make ci` verification
  passing. See
  `phases/phase-01-svg-canvas-substrate.md`.
- 2026-06-04 — Phase 02 implemented in the current workspace:
  dimension column, inline thickness edits with suffix/fraction length
  parsing, magenta hover add buttons, narrowed overlay action contract,
  and simplify fixes. See
  `phases/phase-02-html-overlay-chrome.md`.
- 2026-06-04 — Phase 03 implemented in the current workspace:
  eyedropper / paint state machine, undo-last-paint, source and target
  canvas affordances, modal delete reachability, in-flight paint guard,
  and simplify fixes. See
  `phases/phase-03-direct-interactions.md`.
- 2026-06-04 — Phase 04 implemented in the current workspace:
  semantic all-layers Flip Segments command, toolbar disabled-state
  hardening during pick / paste and command-pending states, duplicate
  command guard, one-shot button ARIA correction, and simplify fixes.
  See `phases/phase-04-toolbar-parity.md`.
- 2026-06-04 — Feature merged to main as a flattened commit and moved
  from `planning/features/assembly-builder/` to
  `planning/archive/assembly-builder/`.
