---
DATE: 2026-06-13
TIME: -
STATUS: Active — ready to implement; no open decisions.
AUTHOR: Claude (for Ed)
SCOPE: Router for the Model Viewer legend-as-filter feature
  (NEW-VIEW-2).
RELATED:
  - PRD.md
  - PLAN.md
  - phases/phase-01-single-select-isolate.md
  - phases/phase-02-multiselect-polish.md
  - context/user-stories/40-model-viewer.md (NEW-VIEW-2; Q-VIEW-7)
  - planning/archive/model-viewer/decisions.md D-11
  - planning/features_v1.1/model-viewer-post-mvp/ (umbrella router)
---

# Model Viewer — Legend as Filter (NEW-VIEW-2)

Click a legend row/swatch to isolate the matching geometry; click
again (or a clear-filter affordance) to restore. Ed flagged this as
**near-priority post-MVP** ("definitely will want later") — it is the
first non-sun-path candidate to build.

## Why this is cheap

The MVP staged the parts that matter, and the later batched-rendering
refactor (`dbca4650`, 2026-06-19) turned out to *help* the visual
mechanism — not hurt it:

- **D-11:** legend rows are built as inert `<button>`s with a stable
  per-bucket `id` (`color.key`) and counts.
- `lib/themes.ts:colorForThemedObject(meta, lens, theme)` already
  returns each object's bucket key — so "which objects match this
  legend row" is a function that already exists (the shared
  `bucketKeyForObject` predicate is just a thin wrapper over it).
- Mesh lenses now render on the batched substrate (`scene/BatchedLens.tsx`
  → `scene/LensBatch.ts`): per-face visibility is `BatchedMesh.setVisibleAt`
  (raycast skips hidden instances), and the lens draws **one** merged edge
  `LineSegments` for the whole building (`scene/LensBatch.ts`).

So the filter is: hide the non-matching *faces* (`setVisibleAt`) but keep
that merged edge line drawn — recolored a lighter gray — so the rest of
the building stays as a faint wireframe context behind the solid matched
bucket. Add filter state, make the legend rows live, gate face visibility,
recolor edges. See PRD §5 — this "isolate-with-wireframe-context" behavior
replaced the original plain "hide", and it is cheap *because* we keep the
merged edges instead of re-merging them per toggle.

## Read order

1. `PRD.md` — behavior contract and edge cases.
2. `PLAN.md` — phase split.
3. `phases/phase-01-single-select-isolate.md` — the core feature.
4. `phases/phase-02-multiselect-polish.md` — shift-click multi-select
   + polish.

## Scope boundary

Applies to lenses/themes that have a real legend or mini-key: Building
(Surface Type / Boundary / Construction / Window Construction), Spaces
(Ventilation Airflow), Floor Areas (Weighting Factor), Ventilation
(supply/exhaust mini-key), Hot Water (distribution/recirc mini-key).
The "Shaded" theme has no buckets and therefore no filter. Site & Sun
has no legend.
