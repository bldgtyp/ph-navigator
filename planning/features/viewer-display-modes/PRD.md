---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: Draft
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Behavior contract for three 3D viewer display changes.
RELATED: ./README.md; ./STATUS.md
---

# PRD — Viewer display modes

## Item 13 — Spaces lens material (bug) — DONE

**Was:** the Spaces lens rendered space volumes with a semi-transparent green
material that read as muddy/chaotic (overlapping translucent boxes).

**Shipped (option (a), Ed-confirmed on a render):** Spaces render **fully opaque
with the *exact* Building shaded material** — same near-white `#ececec` fill,
same `MeshStandardMaterial` (roughness 0.78, metalness 0), same AO/lighting. The
Spaces lens now matches the Building lens material exactly; only the geometry
differs (interior room volumes vs. envelope surfaces). Interiors are occluded by
design — the **section/clipping plane** is the way to cut in.

**Implementation (not as the PRD assumed):** the material is *not* in `lenses.ts`.
The whole opaque-vs-transparent split is driven by one number,
`baseOpacity("spaceGroup")` in `frontend/src/features/model_viewer/lib/colors.ts`
(any type with opacity < 1 routes into the blending BatchedMesh). The fix was
`0.32 → 1` for opacity plus `#7aa58d → #ececec` for the base color — both done by
merging `spaceGroup` into `faceMesh`'s existing case branches. To revert, split
those case labels back out.

## Item 14 — Airflow color mode on Floor Areas (feature)

The Spaces lens supports an "Airflow" color mode (supply / extract / none) that
works well. Add the **same mode to the Floor Areas lens**, reusing the existing
airflow-coloring logic and legend (`store.ts` color-mode state, `LegendCard.tsx`,
`lenses.ts`). No new data needed — Floor Areas derive from the same spaces.

## Item 15 — Color by Ventilator (ERV) mode (feature, research-gated)

Add a **new color mode** that colors each space by the **ventilation unit (ERV)
assigned to it**, alongside the existing Airflow mode.

**Research gate (do first):** confirm the **space→ERV assignment** is available
in the HBJSON / PHX model **and** survives into the PHN document schema. Signal:
the MCP tool `list_hbjson_ventilation_systems` exists, so ventilation systems are
present — the open question is whether the *per-space assignment mapping* is
carried through (not dropped in translation, à la the duct-length gap noted in
the MEP element-selection PRD).

- If the mapping is present → wire a new color mode (assign a color per ERV unit,
  build a legend keyed by unit name), following the Airflow-mode pattern.
- If it's dropped by the PHN schema → this becomes a schema/translation task
  first (add the computed field upstream), and the coloring is a follow-on.

## Reuse story

13 = material config change only. 14 and 15 both extend the per-lens color-mode
machinery: a lens declares which color modes it supports; `store.ts` holds the
active mode; `LegendCard` renders the legend for the active mode. Adding a mode
should be "register a mode + its color function + its legend", not a new render
path (build on `LensBatch`/`BatchedLens`, per the batched-substrate constraint).

## Open questions

1. ~~Item 13: opaque vs. keep-some-transparency~~ — **RESOLVED:** fully opaque,
   exact Building material (white), Ed-confirmed on a render.
2. Item 15: is the space→ERV mapping in the PHN schema today? (First research
   task — gates the whole item.)
3. Item 15: color assignment when many ERV units exist — categorical palette +
   legend; how many units realistically, and do we need stable colors across
   sessions?

## Acceptance

- ✅ Spaces lens reads clean and solid — matches the Building material exactly
  (opaque white), interiors occluded (section plane to cut in).
- Floor Areas lens offers the Airflow color mode with the same legend as Spaces.
- (If research clears) a "color by Ventilator" mode colors spaces by ERV with a
  per-unit legend.
