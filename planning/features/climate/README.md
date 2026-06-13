---
DATE: 2026-06-13
TIME: -
STATUS: Active — planned. Phase 1 is the foundation other features
  (Model Viewer sun path, fRSI, window comfort) wait on.
AUTHOR: Claude (for Ed)
SCOPE: Router for the project-scoped Climate feature — a top-level tab
  that owns and visualizes project location + weather basis, and serves
  climate-derived design conditions to other features.
RELATED:
  - PRD.md
  - decisions.md
  - PLAN.md
  - phases/phase-01-sun-path-service.md
  - phases/phase-02-climate-tab-ui.md
  - phases/phase-03-design-conditions-and-metrics.md
  - planning/archive/project-location/ (the data foundation this builds on)
  - planning/features_v1.1/model-viewer-sun-path/ (a Phase-1 consumer)
---

# Climate

A project-scoped **Climate** top-level tab (alongside Status /
Apertures / Envelope / Equipment / Model) that is the single
authoritative home for a project's **location + weather basis**, and
the source of **climate-derived design conditions** that several
analyses consume.

## Why this exists (Ed, 2026-06-13)

Location and climate are cross-cutting project inputs, not Model-Viewer-
local ones. A user wants to set location + EPW once, *see and visualize*
the climate, keep a clear record of the building location, and have
other features reuse it:

- **Model Viewer** Site & Sun lens — sun path over the building.
- **Thermal Bridges** — fRSI condensation-resistance assessment needs
  the design exterior temperature + interior humidity load.
- **Window U-values** — thermal-comfort checks need the design winter
  exterior temperature.
- **Future** — degree-days, PHPP/WUFI climate cross-checks.

The `project-location` feature (implemented + archived) already built
the data foundation and deliberately retained the full EPW "for future
climate-aware features." Climate is that future home: it **extends**
`project_location`, it does not replace it.

## What Climate owns vs. consumes

| Owns | Consumes / depends on |
|---|---|
| Location + EPW record (extends `project_location`) | `project_location` table + setter (existing) |
| Sun-path service + `GET /projects/{id}/sun-path` (Phase 1) | `ladybug-core` (already a backend dep from Model Viewer Phase 2) |
| Climate tab UI + visualizations (Phase 2) | The project tab roster (`PROJECT_TABS`) |
| EPW-derived metrics + the design-conditions contract (Phase 3) | EPW bytes in R2 (existing) |

Downstream **consumers are separate features** — they read Climate's
endpoints, they are not built here: Model Viewer sun-path render,
Thermal Bridges fRSI, Window comfort.

## Read order

1. `decisions.md` — what Climate owns, extends-not-replaces, and the
   two CPHC-domain decisions to make (design-condition basis; interior
   RH assumption).
2. `PRD.md` — behavior contract.
3. `PLAN.md` — phase sequence and the cross-feature ordering.
4. `phases/phase-01-sun-path-service.md` — build first.

## Sequence headline

**Phase 1 (sun-path service) is the foundation to build first** — it
unblocks the Model Viewer Site & Sun 3D render
(`planning/features_v1.1/model-viewer-sun-path/`, now frontend-only).
Phases 2 (tab UI) and the Model-Viewer render can then proceed in
parallel. Phase 3 (design conditions) gates the fRSI/comfort consumers.
