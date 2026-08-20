---
DATE: 2026-08-19
TIME: 19:05 EDT
STATUS: Active — color engine complete
AUTHOR: Ed May / Codex
SCOPE: 3D window coloring by Summer/Winter shading factor
RELATED:
  - planning/features/model-viewer-shading-factor/PRD.md
  - planning/features/model-viewer-shading-factor/PLAN.md
  - planning/features/model-viewer-shading-factor/STATUS.md
  - planning/archive/dated/2026-07-16/viewer-display-modes/
  - planning/archive/dated/2026-06-23/model-viewer-legend-filter/
  - planning/2026-08-19-ui-batch.md
---

# Model Viewer Shading Factor

Add a Building-lens color mode that colors each window by its Passive House
shading factor, with Summer and Winter sub-options.

## Read order

1. `PRD.md` — data, scale, legend, URL, and missing-value contract.
2. `PLAN.md` — extraction-first implementation sequence.
3. `STATUS.md` — current state and forward-only artifact note.

## Current truth

- Source HBJSON already carries
  `aperture.properties.ph.summer_shading_factor` and
  `winter_shading_factor`.
- `backend/features/model_viewer/schemas/honeybee.py` explicitly mirrors only
  Aperture `energy` properties, so both factors are dropped from the immutable
  `/model_data` artifact.
- The browser's `ApertureModelData` and `ApertureMeshFaceMeta` likewise carry
  energy construction only.
- The existing `window-construction` mode proves the right rendering path:
  register a Building theme, color `apertureMeshFace` objects, and derive a
  legend without creating a second scene.
- Viewer URL state currently persists `file`, `lens`, and `theme`; seasonal
  shading selection must join that shareable state.

## Primary code anchors

- `backend/features/model_viewer/schemas/honeybee.py`
- `backend/features/model_viewer/extraction.py`
- `frontend/src/features/model_viewer/types.ts`
- `frontend/src/features/model_viewer/loaders/building.ts`
- `frontend/src/features/model_viewer/lib/themeState.ts`
- `frontend/src/features/model_viewer/lib/themes.ts`
- `frontend/src/features/model_viewer/components/LegendCard.tsx`
- `frontend/src/features/model_viewer/routes/ModelTab.tsx`

Before mounted browser work, read the archived Model Viewer browser notes
referenced by `planning/features/.instructions.md` and run
`make agent-browser-ready`.
