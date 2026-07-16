---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: Active — captured, not scoped
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Three 3D model-viewer display changes: (13) fix the Spaces lens material
  to match the Building view's standard material, (14) add the Airflow color mode
  to the Floor Areas lens, (15) research + add a new "color by Ventilator (ERV)"
  mode.
RELATED:
  - frontend/src/features/model_viewer/lib/lenses.ts (per-lens material + color modes)
  - frontend/src/features/model_viewer/scene/BatchedLens.tsx
  - frontend/src/features/model_viewer/scene/BuildingLens.tsx (standard material reference)
  - frontend/src/features/model_viewer/scene/LensBatch.ts
  - frontend/src/features/model_viewer/store.ts (active lens + color mode state)
  - frontend/src/features/model_viewer/components/LegendCard.tsx (airflow legend)
  - frontend/src/features/model_viewer/components/LensBar.tsx
  - memory: model-viewer batched substrate (build on LensBatch/BatchedLens, not per-face meshes)
  - memory: MEP element-selection PRD (precedent for "upstream data dropped by PHN schema")
---

# 3D viewer display modes

## Read order

1. `PRD.md` — the three changes, the reuse story, the research gate.
2. `STATUS.md` — disposition + phase map.

## One-liner

Fix the Spaces lens material (bug), extend the existing Airflow color mode to
Floor Areas (easy win), and research/add a new "color by Ventilator (ERV)" mode
(harder — data-availability gated).

## Items folded in

- **Item 13 (bug) — DONE.** Spaces now render fully opaque with the exact Building
  shaded material (white `#ececec`); was a muddy semi-transparent green. One-value
  fix in `lib/colors.ts` (`baseOpacity`/`baseColor`), not `lenses.ts`.
- **Item 14 (feature) — DONE.** The Spaces "Airflow" color mode (supply / extract
  / none) now also runs on the **Floor Areas** lens. 2-line change; floor segments
  already carried the airflow data.
- **Item 15 (feature, research-gated) — backend-first.** A **new "color by
  Ventilator (ERV)" mode**: color each space by its assigned ventilation unit.
  Phase 3a research verdict: the space→ERV mapping is **DROPPED** at PHN
  extraction, so this needs a backend schema/extraction carry-through before the
  frontend color mode (see PRD).

## Why one packet

All three touch the same lens machinery (`lenses.ts`, `BatchedLens`,
`store.ts`, legend). 13 is a quick material swap; 14 reuses the airflow color
path on another lens; 15 adds a sibling color mode but carries a data-research
phase the others don't.
