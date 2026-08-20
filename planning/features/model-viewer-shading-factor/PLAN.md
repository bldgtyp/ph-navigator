---
DATE: 2026-08-19
TIME: 19:05 EDT
STATUS: Proposed implementation sequence
AUTHOR: Codex
SCOPE: Extraction-first plan for seasonal shading-factor visualization
RELATED:
  - planning/features/model-viewer-shading-factor/PRD.md
  - planning/features/model-viewer-shading-factor/STATUS.md
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
HBJSON fixture and passing characterization/legacy-contract tests. The two
Phase 01 wire-contract tests are strict expected failures until the schema is
implemented.

## Phase 01 — Backend extraction

- Add typed Aperture PH factor schema.
- Extract/validate factors and preserve null/missing state.
- Cover full `/model_data` serialization and legacy artifact compatibility.

## Phase 02 — Color engine and meta carry-through

- Extend frontend wire types and aperture renderable metadata.
- Add the PRD's five-stop sRGB interpolation and missing bucket.
- Test endpoints, midpoints, invalid values, and deterministic output.

## Phase 03 — Theme, season, legend, and inspector

- Register Shading Factor on the Building lens.
- Add URL/store seasonal state and Summer/Winter control.
- Add continuous legend support without disturbing discrete legend filters.
- Surface both factors in the aperture inspector.

## Phase 04 — Render/performance acceptance

- Run focused backend/frontend tests and the viewer performance gate.
- Run `make agent-browser-ready`, open a freshly extracted mixed-factor fixture,
  and verify Summer/Winter screenshots, legend, Missing, URL reload, and
  inspector values.
- Run `graphify update .` and fold the data/URL/theme contracts into context.

No production artifact rebuild or production data write is authorized by this
plan.
