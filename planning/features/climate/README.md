---
DATE: 2026-06-13
TIME: -
STATUS: Active — Phase 1 (sun-path service) + Phase 2 (standardized
  record + app-wide reference datasets) implemented 2026-06-13. Phase 3
  (the Climate tab) is next. PHI/PHPP xlsx seed importer + the real-data
  bulk seed are the deferred Phase-2 slices (await Ed's files).
AUTHOR: Claude (for Ed)
SCOPE: Router for the project-scoped Climate feature — a top-level tab
  that owns and visualizes project location + weather basis, and serves
  climate-derived design conditions to other features.
RELATED:
  - PRD.md
  - decisions.md
  - PLAN.md
  - research.md
  - phases/phase-01-sun-path-service.md
  - phases/phase-02-reference-datasets-and-format.md
  - phases/phase-03-climate-tab-ui.md
  - phases/phase-04-design-conditions-and-metrics.md
  - planning/archive/project-location/ (the data foundation this builds on)
  - planning/features_v1.1/model-viewer-sun-path/ (a Phase-1 consumer)
---

# Climate

A project-scoped **Climate** top-level tab (alongside Status /
Apertures / Envelope / Equipment / Model) that is the single
authoritative home for a project's **location + multiple
weather/climate sources** (ASHRAE pointer · EPW · Phius · PHI · custom),
backed by **app-wide versioned reference datasets**, and the source of
**climate-derived design conditions** that several analyses consume.

## Why this exists (Ed, 2026-06-13)

Location and climate are cross-cutting project inputs, not Model-Viewer-
local ones. A CPHC wants to record location, attach/compare several
climate sources (you don't know in advance which basis you'll evaluate),
*see and visualize* the data, and have other features reuse it:

- **Model Viewer** Site & Sun lens — sun path over the building.
- **Thermal Bridges** — fRSI condensation-resistance needs the design
  exterior temperature + interior humidity load.
- **Window U-values** — thermal-comfort checks need the design winter
  exterior temperature.
- **Future** — degree-days, PHPP/WUFI climate cross-checks.

The `project-location` feature (implemented + archived) already built
the location/EPW data foundation. Climate **extends** it (not replaces)
and adds the big new piece: **app-wide reference climate datasets**
(Phius, PHI/PHPP — the same canonical PHPP monthly format; see
`research.md`), versioned, shared across all projects/users.

## What Climate owns vs. consumes

| Owns | Consumes / depends on |
|---|---|
| Sun-path service + `GET /projects/{id}/sun-path` (Phase 1) | `ladybug-core` (backend dep); `project_location` data |
| Standardized climate record + app-wide versioned Phius/PHI reference datasets + seed importers (Phase 2) | `honeybee-ph`/`PHX` parsing (reuse — D-CL-10); Ed's source files |
| Climate tab: location record + multi-source attach/select + per-source graph/table + sun path (Phase 3) | `PROJECT_TABS`; `ProjectLocationSettingsSection` (reuse/migrate) |
| Per-source design-conditions contract (Phase 4) | EPW bytes in R2; PH-dataset design columns (Phase 2) |

Downstream **consumers are separate features** — they read Climate's
endpoints, not built here: Model Viewer sun-path render, Thermal Bridges
fRSI, Window comfort.

## Read order

1. `research.md` — what the Phius/PHI example data contain (basis for
   the standardized format).
2. `decisions.md` — what Climate owns, extends-not-replaces, the
   app-wide reference datasets (D-CL-8), store-all-sources (D-CL-4), and
   the one open fRSI-interior question (D-CL-5).
3. `PRD.md` — behavior contract + the standardized record (§4.3).
4. `PLAN.md` — phase sequence and cross-feature ordering.
5. `phases/phase-01-sun-path-service.md` (+ `phase-02-…`) — build first.

## Sequence headline

**Phase 1 (sun-path service) and Phase 2 (reference datasets +
standardized format) are implemented (2026-06-13).** Phase 1 ships the
`GET /projects/{id}/sun-path` endpoint that unblocks the Model Viewer
Site & Sun 3D render (`planning/features_v1.1/model-viewer-sun-path/`, now
frontend-only). Phase 2 ships the `ClimateRecord` schema, the app-wide
`climate_dataset*` store, the Phius importer + seed routine, and the
`GET /api/v1/climate/datasets…` read endpoints + MCP. **Phase 3 (the
Climate tab) is next** and needs both (met). Phase 4 (per-source design
conditions) gates the fRSI/comfort consumers. Deferred Phase-2 slices:
the PHI/PHPP xlsx importer and the real-data bulk seed (await Ed's files).
