# Planning Status

DATE: 2026-06-25
TIME: 00:00 EDT
STATUS: Active routing index for tracked planning material.
AUTHOR: Codex
SCOPE: Current planning folder organization after moving dated docs to
feature-first planning.

## Active / Current Feature Folders

| Feature | State | Current pointer |
|---|---|---|
| DataTable Status Field — Addendum | Complete — `status` extended to the 3 remaining Datasheet-bearing tables (Ventilators, HP Outdoor Units, HP Indoor Units); `make ci` green, live smoke done, committed `d8b59f28` (branch, not yet merged); archived | `archive/dated/2026-06-24/data-table-status-field-addendum/STATUS.md` |
| DataTable Status Field — Backfill | Deferred — whether/how to backfill `status` onto pre-existing persisted documents across all 12 status tables; no migration yet (V2 pre-deploy, likely nothing to migrate); reactivate when the splash dashboard needs historical documents | `features/datatable-status-backfill/STATUS.md` |
| DataTable UI | Complete / numeric precision, unit headers, status chips, shared visual rhythm, route-smoke verification, final `make ci`, and archive cleanup landed | `archive/dated/2026-06-25/data-table-ui/STATUS.md` |
| Delete Project | In review | `features/delete-project/STATUS.md` |
| DataTable Color Field | Complete / implemented on main with CI and browser smoke evidence | `features/color-field/STATUS.md` |
| Attachments | Complete (v1) / implemented on main with automated coverage, R2 smoke, and full Render staging acceptance; Phase-5 polish deferred by decision; archived | `archive/dated/2026-06-15/attachments/STATUS.md` |
| IP/SI Unit Switching | Planned / implementation plan drafted | `features/ip-si-unit-switching/STATUS.md` |
| DataTable Formula Builder | Complete / Phases 01-06 implemented for shared formula editor UI, structured error cards, `&` concat grammar, autocomplete, all-table formula regression coverage, durable docs, and focused re-verification; archived | `archive/dated/2026-06-21/data-table-formula-builder/STATUS.md` |
| Apertures / Aperture Builder | Planned / PRD updated with review decisions; phase planning not started | `features/apertures/STATUS.md` |
| Apertures → Glazings / Frames Reports | Complete / route-based Materials-parity glazings + frames spec reports with browser smoke, screenshots, context docs, CI, and archive evidence | `archive/dated/2026-06-24/apertures-glazings-frames-reports/STATUS.md` |
| CSS Token Guard Sweep | Complete / implemented on main worktree with format + CI evidence; archived | `archive/dated/2026-06-14/css-token-guard-sweep/STATUS.md` |
| Heat Pump Link Fields | Complete / implemented on main with format, CI, graphify update, browser smoke evidence; archived | `archive/dated/2026-06-16/heat-pump-link-fields/STATUS.md` |
| Spaces Refactor | Complete / Phase 05 verified with format, CI, browser smoke, graphify, simplify, and docs-pass evidence; archived | `archive/dated/2026-06-17/spaces-refactor/STATUS.md` |
| DataTable Consolidation | Complete / Phase 06 verified with format, CI, browser smoke, graphify, simplify, and docs-pass evidence; archived | `archive/dated/2026-06-17/data-table-consolidation/STATUS.md` |
| DataTable Maintenance | Complete / cleanup follow-up implemented and archived | `archive/dated/2026-06-19/data-table-maintenance/STATUS.md` |
| DataTable Regression Suite | Complete / all 7 phases implemented — layered e2e suite under `frontend/tests/e2e/table-regression/` (`@table-smoke` route matrix, `@table-behavior` cell behavior, `@table-links` linked-record flows, `@table-view-state` view-state persistence) over the React-free `sharedEditContract` seam; package scripts + run policy + CI decision recorded; not yet in default CI by decision; archived | `archive/dated/2026-06-19/data-table-regression-suite/STATUS.md` |
| DataTable Field Config Modal | Complete / shared Add/Edit field modal select, markup, static guards, browser smoke, format, CI, graphify evidence; archived | `archive/dated/2026-06-20/data-table-field-config-modal/STATUS.md` |
| Climate Dataset Picker | Complete / P1-P4 implemented and verified with focused backend/frontend tests plus `make ci`; O-DP-6 remains a documented non-blocking PHI region-filter follow-up; archived | `archive/dated/2026-06-22/climate-dataset-picker/STATUS.md` |
| Envelope HBJSON Import | Research / design outline drafted; key decisions made (both PHN-native + raw Honeybee-PH sources, project-only new materials, Phase-0 export upgrade); phase planning next | `features/envelope-hbjson-import/STATUS.md` |
| Glazing + Frame Documentation | Complete / Phases 0-5 implemented; flat `ProjectGlazing`/`ProjectFrame` tables, aperture FK migration/write path, docs commands, datasheet registry, frontend API hydration, docs-pass, graphify, and `make ci` verified; archived | `archive/dated/2026-06-24/glazing-frame-documentation/STATUS.md` |

## Active / Current Refactor Folders

| Refactor | State | Current pointer |
|---|---|---|
| Backend Data-Architecture Cleanup | Complete / Phases 1–3, 5, and 6 implemented and verified with `make ci`; old Phase 4 promoted to `table-write-architecture-unification`; Phase 7 deferred to pre-first-deploy gate; archived | `archive/dated/2026-06-24/backend-data-architecture-cleanup/STATUS.md` |
| Table-Write-Architecture Unification | Active / Backend complete (Phases 1, 2, 3a) — shared `write_spine.py` (all draft-write surfaces) + heat-pumps folded onto the registered contract with a generic `dependent_links` cross-table cascade + a generic `:preview-replace` dry-run; bespoke heat-pump write service deleted, old PATCH endpoint kept as a thin shim; `make ci` green (BE 1113, FE 1900). Only Phase 3b (frontend rewire + shim removal) remains — an interactive app pass | `refactor/table-write-architecture-unification/STATUS.md` |
| DataTable Status Field | Complete / Phases 01-05 implemented and verified with `make ci` (backend 1061, frontend 1887), live reset/reseed + browser smoke, graphify, simplify, and docs-pass evidence; durable contract folded into `context/technical-requirements/data-table.md`; archived | `archive/dated/2026-06-24/data-table-status-field/STATUS.md` |
| Frontend Performance Eval | Complete / Phases 0-4 implemented and measured; route/project-tab payloads split, DataTable edit invalidation narrowed, Model route shell split to 7.00 kB gzip, secondary runtime candidates rejected after corrected attribution; archived | `archive/dated/2026-06-25/frontend-perf/STATUS.md` |

## Historical Material

- Legacy dated planning files now live under `archive/dated/<date>/...`.
- Dated code reviews now live under `code-reviews/<date>/...`.
- Feature-specific dated bundles now live under `features/<feature>/...`.
- Completed Assembly Builder canvas-refactor planning now lives under
  `archive/dated/2026-06-04/assembly-builder/`; older foundation precedent remains
  under `archive/dated/2026-06-04/assembly-builder-foundation/`.
- Completed CSS Token Guard Sweep planning now lives under
  `archive/dated/2026-06-14/css-token-guard-sweep/`.
- Completed Heat Pump Link Fields planning now lives under
  `archive/dated/2026-06-16/heat-pump-link-fields/`.
- Completed Spaces Refactor planning now lives under
  `archive/dated/2026-06-17/spaces-refactor/`.
- Completed DataTable Consolidation planning now lives under
  `archive/dated/2026-06-17/data-table-consolidation/`.
- Completed DataTable Maintenance cleanup now lives under
  `archive/dated/2026-06-19/data-table-maintenance/`.
- Completed DataTable Regression Suite planning now lives under
  `archive/dated/2026-06-19/data-table-regression-suite/`.
- Completed DataTable Field Config Modal refactor planning now lives under
  `archive/dated/2026-06-20/data-table-field-config-modal/`.
- Completed Climate Dataset Picker planning now lives under
  `archive/dated/2026-06-22/climate-dataset-picker/`.
- Completed DataTable Formula Builder planning now lives under
  `archive/dated/2026-06-21/data-table-formula-builder/`.
- Completed Glazing + Frame Documentation planning now lives under
  `archive/dated/2026-06-24/glazing-frame-documentation/`.
- Completed Attachments (v1) planning now lives under
  `archive/dated/2026-06-15/attachments/`. The stable implementation contract remains
  current in `context/technical-requirements/attachments.md`; the
  deferred v1.1 candidate stays in
  `planning/features_v1.1/user-defined-attachment-fields/`.
- Completed DataTable Status Field refactor planning now lives under
  `archive/dated/2026-06-24/data-table-status-field/`. The durable contract (built-in
  cross-table `status` single-select stored in `custom_values.status`, option
  list namespaced `<table_label>.status`) is folded into
  `context/technical-requirements/data-table.md` § Backend Data Shapes.
- Completed Model-Viewer rendering-performance refactor now lives under
  `archive/dated/2026-06-19/model-viewer-performance/` (Phases 00–05; Hillandale building
  lens 14 draw calls @ 60 FPS, was 32,045 @ 0.4). The reusable substrate
  convention is in `frontend/src/features/model_viewer/scene/{LensBatch,
  BatchedLens}`. Optional follow-ups (true cross-fade, line merging, the
  OQ-3 opaque-shell look review) are recorded in that folder's `STATUS.md`
  "Next step"; model-viewer feature backlog stays under
  `planning/features_v1.1/model-viewer-*`.
- Completed Frontend Performance Eval planning now lives under
  `archive/dated/2026-06-25/frontend-perf/` (Phases 0-4; perf harness, stress
  seed, route payload splits, DataTable edit invalidation narrowing, Model route
  shell split, and secondary-runtime attribution correction).
- Completed DataTable UI planning now lives under
  `archive/dated/2026-06-25/data-table-ui/` (numeric precision, unit headers,
  status chips, shared visual rhythm, and route-smoke verification).

## Update Rule

When a feature phase lands, update the feature `STATUS.md` first, then
fold durable decisions into `PRD.md`, `decisions.md`, or `context/`.
