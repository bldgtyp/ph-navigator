---
DATE: 2026-06-13
TIME: -
STATUS: Active — implementation sequence + cross-feature ordering.
AUTHOR: Claude (for Ed)
SCOPE: Phase sequence for Climate and how it orders the dependent
  features.
RELATED:
  - PRD.md
  - decisions.md
  - phases/phase-01-sun-path-service.md
  - phases/phase-02-reference-datasets-and-format.md
  - phases/phase-03-climate-tab-ui.md
  - phases/phase-04-design-conditions-and-metrics.md
  - planning/features_v1.1/model-viewer-sun-path/ (Phase-1 consumer)
---

# Climate — PLAN

## Phases

| Phase | Scope | Gate to start | Unblocks |
|---|---|---|---|
| 1 — Sun-path service ✅ **done** (2026-06-13) | Backend sun-path builder + `GET /projects/{id}/sun-path` + MCP; north-sign verified (identity) | None — `project_location` data + `ladybug-core` exist | Model Viewer Site & Sun render; Climate tab sun-path visual |
| 2 — Reference datasets + standardized format ✅ **done** (2026-06-13; PHI xlsx seed deferred) | Canonical `ClimateRecord` + honeybee_ph adapters; app-wide versioned `climate_dataset*` store; Phius `-mon.txt` importer + idempotent seed; dataset read endpoints + MCP | None | The tab dropdowns/graphs; the design-conditions contract |
| 3 — Climate tab UI | New `climate` tab: location record + multi-source attach/select (ASHRAE/EPW/Phius/PHI/custom) + per-source graph/table + sun-path visual | Phase 1 + Phase 2 (met) | The "see + record + compare sources" goal |
| 4 — Design conditions + metrics | Per-source, source-parameterized design-conditions contract (+ MCP) | **Deferred** (Ed 2026-06-13) — needs a scheduled fRSI/comfort consumer | Thermal-Bridges fRSI; Window comfort |

**Focus (Ed 2026-06-13): the climate data *store* — Phases 1–3.**
Phases 1 and 2 are **done** (2026-06-13); **Phase 3 (the tab) is next.**
The *use* of the data (Phase 4 design conditions + the fRSI/comfort
consumers + the D-CL-5 interior assumption + temperature-asymmetry) is
deferred to later feature work. Phase-2 carry-overs into Phase 3: the
real Phius seed + the PHI xlsx importer (await Ed's files), and promoting
`ClimateRecord` to a `context/` reference doc.

## Cross-feature ordering (the answer to "Climate first?")

```
Climate P1 (sun-path service) ──unblocks──► Model Viewer sun-path render (frontend-only)
                                            (planning/features_v1.1/model-viewer-sun-path)

Climate P1 + P2 (datasets) ──unblocks──► Climate P3 (tab: record + sources + graphs + sun path)

Climate P4 (design conditions) ──unblocks──► Thermal-Bridges fRSI  (separate future feature)
                                └──unblocks──► Window comfort       (separate future feature)
```

- **Phase 1 is the only prerequisite for the 3D sun-path viz.** Build
  it first; the Model-Viewer render then just consumes the endpoint.
- **Phases 1 and 2 are independent** (sun path vs. dataset store) — run
  in parallel if capacity allows.
- **Do not gate the 3D render behind the tab.** Phases 2–4 are not
  prerequisites for the Model-Viewer sun path — only Phase 1 is.
- **Phase 4 is gated** on a scheduled fRSI/comfort consumer (and the
  D-CL-5 interior assumption, likely owned by that consumer). It can lag
  well behind Phases 1–3.

## Build order within Phase 1

The sun-path backend (relocated from `model-viewer-sun-path`):
1. Pure `build_sun_path(...)` (ladybug `Location` + `Sunpath`, unit
   radius, origin-centered, DST off) — fixture-test the **north sign**
   (D-PL-4) before plumbing.
2. `GET /projects/{id}/sun-path` route + service reading
   `project_location` in-process; `null` when unset.
3. MCP tool `get_project_sun_path`.
4. pytest (builder + route incl. null + north sign) + `make ci`.

## Risks / watch-items

- **North sign (D-PL-4)** — the load-bearing correctness item; lock
  with a fixture (Phase 1).
- **Reuse PH-Tools climate parsing (D-CL-10)** — investigate
  `honeybee-ph`/`PHX` before hand-writing the Phius/PHI parsers
  (Phase 2). The `-mon.txt` IS the PHPP climate format.
- **Module home** — author in the location/climate backend
  (`features/project_location/`, the eventual `climate` module), NOT
  `features/model_viewer/`. Keep imports one-way (model_viewer →
  climate, never the reverse).
- **Reference-dataset scope** — `climate_dataset*` tables are
  **app-wide** (no `project_id`); don't accidentally project-scope them.
- **EPW parsing cost (Phase 4)** — hourly EPW → metrics is real work;
  derive-on-read where cheap, persist where not, keyed by the immutable
  EPW asset id (PRD §4).
- **Scope discipline** — the fRSI/comfort *consumers* are separate
  features. Climate ships the per-source contract; it does not compute
  fRSI or comfort.
