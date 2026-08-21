---
DATE: 2026-08-20
TIME: 07:21 EDT
STATUS: Complete — Phases 00–04 accepted
AUTHOR: Codex
SCOPE: Extraction-first plan for seasonal shading-factor visualization
RELATED:
  - planning/archive/dated/2026-08-20/model-viewer-shading-factor/PRD.md
  - planning/archive/dated/2026-08-20/model-viewer-shading-factor/STATUS.md
---

# PLAN — Model Viewer Shading Factor

## Phase 00 — Source and artifact characterization — COMPLETE

- Add HBJSON fixtures with distinct Summer/Winter values, nulls, and invalid
  values.
- Prove the current extractor drops `properties.ph` and lock the new wire shape.
- Prove omitted legacy `properties.ph` loads as Missing under the PRD's
  optional/defaulted wire contract.
- Record the forward-only artifact behavior; the warning aggregation and fixed
  color-stop policies are already locked in the PRD.

Evidence: `backend/tests/test_model_viewer_extraction.py` includes a mixed
HBJSON fixture. The initial `1 passed, 2 xfailed` characterization run proved
the gap; Phase 01 resolved both expected failures.

## Phase 01 — Backend extraction — COMPLETE

- Add typed Aperture PH factor schema.
- Extract/validate factors and preserve null/missing state.
- Cover full `/model_data` serialization and legacy artifact compatibility.

Evidence: focused extraction tests cover valid, null, absent, out-of-range,
non-finite, and bounded aggregate-warning cases; the route-level artifact test
carries distinct seasonal values through gzip serialization and `/model_data`.
Ruff, Ty, and both focused backend suites pass (`28 passed, 5 deselected`).

## Phase 02 — Color engine and meta carry-through — COMPLETE

- Extend frontend wire types and aperture renderable metadata.
- Add the PRD's five-stop sRGB interpolation and missing bucket.
- Test endpoints, midpoints, invalid values, and deterministic output.

Evidence: frontend wire types mirror the optional legacy-safe PH bag, loader
metadata retains both seasonal factors, and focused Vitest coverage pins the
five stops, sRGB midpoints, Missing fallback, and deterministic output.

## Phase 03 — Theme, season, legend, and inspector — COMPLETE

- Register Shading Factor on the Building lens.
- Add URL/store seasonal state and Summer/Winter control.
- Add continuous legend support without disturbing discrete legend filters.
- Surface both factors in the aperture inspector.

Evidence: the Building-only theme and shared Season segmented control use URL
and Zustand state; batch subscriptions repaint only the affected aperture
instances for season-only changes. The continuous legend is non-filtering and
counts selected-season Missing values, while the inspector formats both values
to three decimals. Focused Vitest (`40 passed`), TypeScript, targeted ESLint,
hex-token enforcement, and diff checks pass.

## Phase 04 — Render/performance acceptance — COMPLETE

- Run focused backend/frontend tests and the viewer performance gate.
- Run `make agent-browser-ready`, open a freshly extracted mixed-factor fixture,
  and verify Summer/Winter screenshots, legend, Missing, URL reload, and
  inspector values.
- Run `graphify update .` and fold the data/URL/theme contracts into context.

No production artifact rebuild or production data write is authorized by this
plan.

Evidence: the O(1) structural perf gate passes for 4,500 source objects. After
`make agent-browser-ready`, an isolated agent project uploaded and freshly
extracted a mixed-factor HBJSON. Mounted Playwright acceptance verified the
five stops plus Missing under both seasons, dual-value inspection, Building-only
theme registration, URL reload, zero season-switch `/model_data` requests, and
stable object IDs plus renderer call/geometry counts. Summer/Winter screenshots
are in `assets/`. `graphify update .` completed, and full `make ci` passed
(`1907 passed, 7 skipped` backend; `2517 passed` frontend; production build).
