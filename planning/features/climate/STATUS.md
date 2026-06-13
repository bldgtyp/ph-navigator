---
DATE: 2026-06-13
TIME: -
STATUS: Active — Phase 1 implemented (2026-06-13); Phase 2 ready
  (independent). Phase 1 was the prerequisite for the Model Viewer
  sun-path render and now ships the endpoint it consumes. Scope expanded
  2026-06-13 (multi-source + app-wide reference datasets).
AUTHOR: Claude (for Ed)
SCOPE: Status, gates, and decisions for the Climate feature.
RELATED:
  - README.md
  - PRD.md
  - decisions.md
  - PLAN.md
---

# Climate — Status

## Current state

**Phase 1 (sun-path service) implemented 2026-06-13.** Pure
`build_sun_path(...)` builder + `GET /api/v1/projects/{id}/sun-path`
route + `get_project_sun_path` MCP tool, all in
`backend/features/project_location/` (the eventual `climate` module).
True-north sign verified by fixture as **identity** to ladybug's
`north_angle` (D-PL-4) and recorded inline. Reuses the existing
`model_viewer.schemas.ladybug` DTOs for now (documented Phase-3
relocation follow-up). `make ci` green; pending commit/merge to `main`.

README, PRD, decisions, plan, research, and four phase handoffs authored
2026-06-13. **Scope expanded 2026-06-13** (Ed): store all climate sources
(ASHRAE/EPW/Phius/PHI/custom) backed by app-wide versioned reference
datasets. **D-CL-10 reuse investigation complete (research.md): the
`ClimateRecord` schema is pinned to mirror `honeybee_ph.site`; PHI seed
reuses `PHX`'s `io_climate.py`.** Builds on the implemented + archived
`project_location`.

## Next step

Implement `phases/phase-02-reference-datasets-and-format.md` (the
climate-data foundation) — independent of Phase 1, starts from the
**pinned** schema (PRD §4.3) and the existing PH-Tools code, not a
from-scratch design. Phase 3 (the tab) then needs Phase 1 + Phase 2.

## Decisions

- **Resolved (Ed 2026-06-13):** D-CL-4 (store all sources; ASHRAE
  pointer); **D-CL-10 (investigated) — `ClimateRecord` is PINNED to
  mirror `honeybee_ph.site`; reuse `io_climate.py` for the PHI seed;
  thin parser for Phius `-mon.txt`; adapters, not subclassing
  (research.md, PRD §4.3).**
- **Implemented as recommended (Phase 1):** D-CL-1 (extends, not
  replaces `project_location`), D-CL-2 (sun-path service home + shared
  `GET /projects/{id}/sun-path` endpoint), D-PL-4 (true-north sign =
  identity, fixture-verified).
- **Proposed, recommended (confirm on review):** D-CL-3
  (new 6th tab, gated to Phase 3), D-CL-6 (store the EPW), D-CL-7
  (durable + editable location; reproducibility via pinning),
  **D-CL-8 (app-wide versioned reference datasets)**, **D-CL-9 (custom
  locations)**, **D-CL-11 (per-analysis source selection)**.
- **Deferred to later feature work (Ed 2026-06-13):** the design-
  conditions/use-case layer (Phase 4) and **D-CL-5** (fRSI interior
  assumption) and the temperature-asymmetry use-case. Focus is the data
  store first.
- **Settled:** ASHRAE stays a pointer for now (D-CL-4).

## Blockers

- None for Phase 2 (`project_location` data + `ladybug-core` exist; raw
  seed files are gitignored — provided at Phase-2 impl time, `research.md`
  records their shape).
- Phase 4 is deferred (later feature work).

## Phase ledger

| Phase | State | Gate |
|---|---|---|
| 1 — Sun-path service | **Implemented** (2026-06-13; `make ci` green, pending merge) | none |
| 2 — Reference datasets + standardized format | Planned — ready (**focus**) | none (reuse-investigate first) |
| 3 — Climate tab UI | Planned | Phase 1 + Phase 2 merged |
| 4 — Design conditions + metrics | **Deferred** (later feature work) | scheduled fRSI/comfort consumer (+ D-CL-5) |

## Dependent features (read Climate; built elsewhere)

| Feature | Needs | Where |
|---|---|---|
| Model Viewer sun-path render | Phase 1 endpoint | `planning/features_v1.1/model-viewer-sun-path/` |
| Thermal-Bridges fRSI | Phase 4 design conditions | future feature |
| Window thermal-comfort | Phase 4 design heating temp | future feature |
