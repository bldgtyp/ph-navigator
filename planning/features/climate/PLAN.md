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
  - phases/phase-02-climate-tab-ui.md
  - phases/phase-03-design-conditions-and-metrics.md
  - planning/features_v1.1/model-viewer-sun-path/ (Phase-1 consumer)
---

# Climate — PLAN

## Phases

| Phase | Scope | Gate to start | Unblocks |
|---|---|---|---|
| 1 — Sun-path service | Backend sun-path builder + `GET /projects/{id}/sun-path` + MCP, in the location/climate module; north-sign verified | None — `project_location` data + `ladybug-core` exist | Model Viewer Site & Sun render; Climate tab sun-path visual |
| 2 — Climate tab UI | New top-level `climate` tab: location/EPW record + sun-path visualization | Phase 1 merged | The "see + record" goal |
| 3 — Design conditions + metrics | EPW-derived metrics + design-conditions contract endpoint (+ MCP) | D-CL-4 + D-CL-5 resolved by Ed | Thermal-Bridges fRSI; Window comfort |

## Cross-feature ordering (the answer to "Climate first?")

```
Climate P1 (sun-path service)  ──unblocks──►  Model Viewer sun-path render (frontend-only)
        │                                       (planning/features_v1.1/model-viewer-sun-path)
        └──unblocks──►  Climate P2 (tab + sun-path visual)

Climate P3 (design conditions) ──unblocks──►  Thermal-Bridges fRSI  (separate future feature)
                                └──unblocks──►  Window comfort       (separate future feature)
```

- **Phase 1 is the only true prerequisite for the 3D sun-path viz.**
  Build it first; then the Model-Viewer render and Climate Phase 2 can
  run in parallel (both just consume the endpoint).
- **Do not gate the 3D render behind the whole tab.** The tab (Phase 2)
  and the analytical metrics (Phase 3) are not prerequisites for the
  Model-Viewer sun path — only the Phase 1 service is.
- **Phase 3 is gated on Ed's domain decisions** (D-CL-4 design basis,
  D-CL-5 interior assumption) and on the consumers actually being
  scheduled. It can lag well behind Phases 1–2.

## Build order within Phase 1

Identical to the backend originally drafted in
`model-viewer-sun-path/phases/phase-01` §2 — that backend now lands
**here**:
1. Pure `build_sun_path(...)` (ladybug `Location` + `Sunpath`, unit
   radius, origin-centered, DST off) — fixture-test the **north sign**
   (D-PL-4) before plumbing.
2. `GET /projects/{id}/sun-path` route + service reading
   `project_location` in-process; `null` when unset.
3. MCP tool `get_project_sun_path`.
4. pytest (builder + route incl. null + north sign) + `make ci`.

## Risks / watch-items

- **North sign (D-PL-4)** — the load-bearing correctness item; lock
  with a fixture.
- **Module home** — author in the location/climate backend
  (`features/project_location/`, the eventual `climate` module), NOT
  `features/model_viewer/`, so consumers don't trigger a later move
  (D-CL-2). Keep imports one-way (model_viewer → climate, never the
  reverse).
- **EPW parsing cost (Phase 3)** — hourly EPW → metrics is real work;
  derive-on-read where cheap, persist where not (PRD §4).
- **Scope discipline** — the fRSI/comfort *consumers* are separate
  features. Climate ships the contract; it does not compute fRSI.
