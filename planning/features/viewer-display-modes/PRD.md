---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: Draft
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Behavior contract for three 3D viewer display changes.
RELATED: ./README.md; ./STATUS.md
---

# PRD — Viewer display modes

## Item 13 — Spaces lens material (bug)

**Now:** the Spaces lens renders space volumes with a semi-transparent green
material that reads as muddy/chaotic (overlapping translucent boxes).

**Want:** render Spaces with the **standard material** used by the Building view,
not the transparent one. Material config lives per-lens in `lenses.ts`; Building's
material is the reference (`BuildingLens.tsx`).

**Clarify (from Ed — carry into implementation):** spaces are volumetric room
solids. Fully opaque like Building geometry would make spaces occlude each other
so you can't see interior rooms. Two readings of "standard material":
  - (a) fully opaque standard material (accept occlusion), or
  - (b) the standard material's *look/shading* (color, lighting response) but
    keep *some* transparency so overlapping spaces stay legible.

Default assumption: **match the Building material treatment**; if that fully
occludes interiors and reads worse, fall to (b). Confirm with Ed against a
rendered screenshot before finalizing.

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

1. Item 13: opaque vs. keep-some-transparency (see clarify above) — needs an
   eyeball on a real model.
2. Item 15: is the space→ERV mapping in the PHN schema today? (First research
   task — gates the whole item.)
3. Item 15: color assignment when many ERV units exist — categorical palette +
   legend; how many units realistically, and do we need stable colors across
   sessions?

## Acceptance

- Spaces lens reads clean and solid (matches Building material treatment, per the
  resolved clarify).
- Floor Areas lens offers the Airflow color mode with the same legend as Spaces.
- (If research clears) a "color by Ventilator" mode colors spaces by ERV with a
  per-unit legend.
