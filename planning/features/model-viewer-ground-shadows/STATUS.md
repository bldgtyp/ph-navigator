---
DATE: 2026-07-01
TIME: 16:18 EDT
STATUS: Planned / ready for implementation. No code changes made.
AUTHOR: Codex
SCOPE: Status ledger for the Model Viewer ground-shadow correction.
RELATED:
  - README.md
  - PRD.md
  - PLAN.md
---

# Status - Model Viewer Ground Shadows

## Current state

`Planned.` Investigation from the 2026-07-01 screenshots indicates the
giant gray sheet is not HBJSON geometry. It behaves like a non-interactive
viewer helper and matches the `ContactShadows` receiver plane in
`frontend/src/features/model_viewer/scene/ViewerCanvas.tsx`.

The desired outcome is not to delete all grounding cues. The viewer should
retain a soft ground-shadow/ground-plane effect, but the helper plane itself
must not be visible as a vertical gray sheet or be confused with model data.

## Next step

Start Phase 1 in `PLAN.md`: reproduce the issue in the local browser and
confirm the exact Three scene object before editing. Then correct or replace
the ground-shadow helper with the smallest change that preserves a soft
grounding effect.

## Blockers

None.

## Verification target

At closeout, record:

- before/after screenshot paths,
- exact render-helper object identified,
- `make frontend-dev-check`,
- focused browser smoke for Building, Site & Sun, one line lens, and section
  plane enabled.
