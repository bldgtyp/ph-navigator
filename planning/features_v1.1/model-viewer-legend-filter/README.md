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

The MVP already did the staging work:

- **D-11:** legend rows are built as inert `<button>`s with a stable
  per-bucket `id` (`color.key`) and counts.
- `lib/themes.ts:colorForThemedObject(meta, lens, theme)` already
  returns each object's bucket key — so "which objects match this
  legend row" is a function that already exists. The filter is its
  inversion: render an object iff its bucket key is in the active set.

So this is mostly: add filter state, make the legend rows live, and
gate per-object rendering in `scene/BuildingLens.tsx`.

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
