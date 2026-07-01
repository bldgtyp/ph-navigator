---
DATE: 2026-07-01
TIME: 16:18 EDT
STATUS: Superseded — folded into
  planning/features/model-viewer-sun-study/ (Ed, 2026-07-01, sun-study
  PRD D-12). PRD.md/PLAN.md here remain the imported behavior contract
  for that feature's ground-shadow baseline phase; track progress in
  the sun-study folder, not here.
AUTHOR: Codex
SCOPE: Status ledger for the Model Viewer ground-shadow correction.
RELATED:
  - README.md
  - PRD.md
  - PLAN.md
  - ../model-viewer-sun-study/PRD.md (successor — see D-12)
---

# Status - Model Viewer Ground Shadows

## Current state

`Superseded.` Folded into `planning/features/model-viewer-sun-study/`
as that feature's baseline phase (its PRD §5.3 / D-12) on 2026-07-01,
per Ed — both efforts rewrite the same `ViewerCanvas.tsx` shadow
strategy. The PRD/PLAN in this folder are imported as-is; no separate
implementation will run from here.

Original investigation (still current): the 2026-07-01 screenshots
indicate the
giant gray sheet is not HBJSON geometry. It behaves like a non-interactive
viewer helper and matches the `ContactShadows` receiver plane in
`frontend/src/features/model_viewer/scene/ViewerCanvas.tsx`.

The desired outcome is not to delete all grounding cues. The viewer should
retain a soft ground-shadow/ground-plane effect, but the helper plane itself
must not be visible as a vertical gray sheet or be confused with model data.

## Next step

None here — the work proceeds as the ground-shadow baseline phase of
`model-viewer-sun-study` (see that folder's STATUS.md/PLAN.md). The
`PLAN.md` phases in this folder are executed there verbatim.

## Blockers

None.

## Verification target

At closeout, record:

- before/after screenshot paths,
- exact render-helper object identified,
- `make frontend-dev-check`,
- focused browser smoke for Building, Site & Sun, one line lens, and section
  plane enabled.
