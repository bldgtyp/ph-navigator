---
DATE: 2026-08-20
TIME: 07:21 EDT
STATUS: Implementation complete — archive cleanup next
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
- Newly extracted `/model_data` artifacts carry nullable Summer/Winter factors;
  legacy immutable artifacts safely omit the optional PH property bag and show
  **Missing**.
- The Building-only `shading-factor` theme colors only `apertureMeshFace`
  instances on a fixed five-stop scale; opaque faces retain neutral shaded
  colors.
- Viewer URL state persists `file`, `lens`, `theme`, and the valid seasonal
  choice as `season=summer|winter` (default Summer).
- The legend is continuous and non-filtering for this theme. The aperture
  inspector always exposes both factors for direct audit.

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

## Acceptance evidence

- `assets/phase-04-summer.png` — fixed scale, Summer control, and Missing count.
- `assets/phase-04-winter.png` — Winter repaint plus the selected aperture's
  dual-value inspector.
- The mounted mixed-factor artifact verified exact stop/Missing colors, URL
  reload, Building-only registration, stable renderer structure/object IDs,
  and zero `/model_data` requests during the season switch.
