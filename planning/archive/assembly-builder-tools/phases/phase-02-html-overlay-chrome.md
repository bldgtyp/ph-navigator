---
DATE: 2026-06-04
TIME: 13:18 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Assembly Canvas Phase 02 — HTML overlay chrome, dimension column, hover add controls
RELATED:
  - planning/archive/assembly-builder/PRD.md
  - planning/archive/assembly-builder/STATUS.md
  - frontend/src/features/envelope/components/AssemblyCanvasOverlay.tsx
  - frontend/src/features/envelope/envelope.css
  - frontend/src/lib/units/length.ts
---

# Phase 02 — HTML Overlay Chrome

## Goal

Replace the temporary canvas hover toolbar with V1-style direct canvas
chrome: a CAD-like layer thickness dimension column, magenta hover
add buttons, and segment/layer hit targets that stay aligned to the
same millimeter geometry as the SVG substrate.

## Implemented

- Added a fixed dimension column left of the SVG assembly body, with
  per-layer thickness labels and dashed extension lines stopping at the
  assembly left edge.
- Added inline layer thickness editing from the dimension label.
  Submits through the existing `update_layer_thickness` envelope command
  path; unchanged values do not submit no-op commands.
- Extended shared length parsing for explicit suffixes and fractional
  inch input, including `"4 in"`, `"156 mm"`, `"6.5 cm"`, and
  `2-1/2"`.
- Replaced the old hover toolbar with magenta circular `+` controls:
  add layer above / below in the dimension column, and add segment
  before / after inside each segment.
- Made segment overlays keyboard/click edit targets while keeping
  read-only segments non-button semantics.
- Removed the inert canvas copy/paste overlay path from this phase.
  The backend `paste_assignment` command remains available for the
  later eyedropper / paint phase.

## Verification

Focused frontend checks on 2026-06-04:

- `cd frontend && pnpm run lint` — passed.
- `cd frontend && pnpm run build` — passed.
- `cd frontend && pnpm test -- src/lib/units/units.test.ts src/features/envelope/__tests__/EnvelopePage.test.tsx src/features/envelope/__tests__/useLengthDraft.test.tsx`
  — passed; Vitest currently runs the full frontend suite for this
  invocation (`94` files / `1073` tests).

Browser smoke:

- `http://localhost:5174/` loaded the frontend but failed session
  checks because that fallback Vite port is not in backend CORS.
- `http://localhost:5173/` reached the sign-in page through the
  allowed origin. The available Playwright tools in this session did
  not expose form-fill/click actions, so canvas visual interaction was
  verified through unit/component tests rather than an authenticated
  browser route.

Simplify pass:

- Three review agents checked reuse, quality, and efficiency.
- Fixes folded in: stage width accounts for the dimension column,
  inline edits avoid duplicate/no-op submits, overlay action props were
  narrowed, read-only segment semantics were corrected, stale SVG hover
  CSS was removed, and unsupported length units now report
  `unsupported_unit`.

## Deferred To Phase 03

- Eyedropper / paint assignment mode.
- Any richer segment modal trigger behavior beyond click / Enter.
- Screenshot parity against the V1 hover reference once an authenticated
  browser flow is available in this worktree.
