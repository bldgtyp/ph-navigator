---
DATE: 2026-06-13
TIME: -
STATUS: Active — planned. Phases 1 & 2 ready (independent); Phase 1 is
  the prerequisite for the Model Viewer sun-path render. Scope expanded
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

`Active — planned.` README, PRD, decisions, plan, research, and four
phase handoffs authored 2026-06-13. **Scope expanded 2026-06-13** (Ed):
store all climate sources (ASHRAE/EPW/Phius/PHI/custom) backed by
app-wide versioned reference datasets. No code written. Builds on the
implemented + archived `project_location` feature.

## Next step

Implement `phases/phase-01-sun-path-service.md` (unblocks the Model
Viewer render) — and/or `phases/phase-02-reference-datasets-and-format.md`
(the climate-data foundation); the two are independent and can run in
parallel. Phase 2 should start with the PH-Tools reuse investigation
(D-CL-10).

## Decisions

- **Resolved (Ed 2026-06-13):** D-CL-4 — store all sources; don't pick
  one basis.
- **Proposed, recommended (confirm on review):** D-CL-1 (extends, not
  replaces `project_location`), D-CL-2 (sun-path service home), D-CL-3
  (new 6th tab, gated to Phase 3), D-CL-6 (store the EPW), D-CL-7
  (durable + editable location; reproducibility via pinning),
  **D-CL-8 (app-wide versioned reference datasets)**, **D-CL-9 (custom
  locations)**, **D-CL-10 (reuse PH-Tools/PHX parsing; align with
  honeybee-ph)**, **D-CL-11 (per-analysis source selection)**.
- **Deferred to later feature work (Ed 2026-06-13):** the design-
  conditions/use-case layer (Phase 4) and **D-CL-5** (fRSI interior
  assumption) and the temperature-asymmetry use-case. Focus is the data
  store first.
- **Settled:** ASHRAE stays a pointer for now (D-CL-4).

## Blockers

- None for Phase 1 or Phase 2 (`project_location` data + `ladybug-core`
  exist; raw seed files are gitignored — provided at Phase-2 impl time,
  `research.md` records their shape).
- Phase 4 is deferred (later feature work).

## Phase ledger

| Phase | State | Gate |
|---|---|---|
| 1 — Sun-path service | Planned — ready | none |
| 2 — Reference datasets + standardized format | Planned — ready (**focus**) | none (reuse-investigate first) |
| 3 — Climate tab UI | Planned | Phase 1 + Phase 2 merged |
| 4 — Design conditions + metrics | **Deferred** (later feature work) | scheduled fRSI/comfort consumer (+ D-CL-5) |

## Dependent features (read Climate; built elsewhere)

| Feature | Needs | Where |
|---|---|---|
| Model Viewer sun-path render | Phase 1 endpoint | `planning/features_v1.1/model-viewer-sun-path/` |
| Thermal-Bridges fRSI | Phase 4 design conditions | future feature |
| Window thermal-comfort | Phase 4 design heating temp | future feature |
