---
DATE: 2026-06-12
TIME: -
STATUS: Active — sequence proposed; detailed handoff plans for all six
  phases authored 2026-06-12 under phases/ (phase-NN-*.md). The phase
  files are the implementation-agent entry points; this file remains
  the one-screen sequence overview.
AUTHOR: Claude (for Ed)
SCOPE: Implementation phase sequence for the Model Viewer. Each phase
  is one PR-sized, independently verifiable slice.
RELATED:
  - planning/features/model-viewer/PRD.md
  - planning/features/model-viewer/UI_SPEC.md
  - planning/features/model-viewer/decisions.md
  - context/user-stories/40-model-viewer.md
---

# Model Viewer — Implementation Plan

Detailed per-phase handoff docs (authored 2026-06-12):

1. `phases/phase-01-hbjson-file-management.md`
2. `phases/phase-02-extraction-backend.md`
3. `phases/phase-03-viewer-core.md`
4. `phases/phase-04-remaining-lenses.md`
5. `phases/phase-05-themes-legend.md`
6. `phases/phase-06-measure-site-sun-polish.md`

Dependency order: files → data → scene → lenses → themes → tools.
Each phase ends green on `make format` + `make ci` and, from Phase 3
on, a Playwright-MCP walkthrough against a real HBJSON.

## Phase 1 — HBJSON file management (US-VIEW-1) — DONE 2026-06-12

Backend: `project_hbjson_files` migration (incl. geometry-summary
columns with `extraction_status='pending'`, per D-13 — the
consuming Airtightness feature is FUTURE, nothing here reads them);
`backend/features/model_viewer/` routes for list / create-link /
rename / notes / delete riding the existing generic asset
upload-intent flow (`asset_kind='hbjson'` already registered);
content-hash dedup; airtightness-pin cascade stub. MCP tool
registration for the CRUD routes.

Frontend: Model tab route + file chip + popover (UI_SPEC §2)
including the `extraction_status` "Failed to parse" badge (D-16 —
inert until the Phase 2 job exists), upload with progress (100 MB
cap, D-17), empty state, `?file=` URL param. No 3D yet — the
"viewer" area shows the empty/placeholder state.

**Verify:** upload → list → rename → note → delete round-trip via UI
and pytest; dedup toast; viewer-role hides write affordances.

## Phase 2 — Extraction backend (US-VIEW-7)

`uv add honeybee-ph ladybug-core` (D-02). Port V1
`services/model_elements.py` + schema subtrees to
`backend/features/model_viewer/` (Pydantic v2, SI canonical):
faces/apertures (punched, triangulated), spaces + floor segments,
ventilation, hot-water, merged shades, `load_summary`. Model units
normalized to Meters before extraction (the multifamily fixture is
in **Inches**). The upload-time job (one parse, D-13 + D-15) writes
the geometry summary columns AND persists `CombinedModelData` to R2
as a gzip'd derived artifact; bulk `GET .../{file_id}/model_data`
streams the artifact with `Cache-Control: immutable` + ETag
(self-healing on `pending`; typed permanent error on `failed` —
D-16 taxonomy). Per-feature routes (MCP-live) read the same
artifact. Construction schemas ship all four U/R fields
(`u_factor`/`u_value`/`r_factor`/`r_value`) per D-12.

**Verify:** pytest against BOTH fixture HBJSONs (golden counts:
faces, spaces, shades-merged, skipped air boundaries); m³/s on the
wire asserted; artifact round-trip + cache headers; permanent vs.
transient error paths; Hillandale extraction wall-time recorded in
STATUS.md (the perf canary — do not defer to Phase 6).

Canonical fixtures:
- **Primary (provided by Ed 2026-06-12):**
  `planning/features/model-viewer/ph_nav_v2_example.hbjson`
  (459 KB) — copy into `backend/tests/fixtures/` in this phase and
  use for ALL smoke / e2e / verification work. Coverage: 4 rooms,
  25 faces (16 Wall / 5 Floor / 4 RoofCeiling), boundary conditions
  Outdoors 12 / Surface 6 / Ground 7, 30 apertures, **5 orphaned
  shades** with distinct display_names (exercises server-side shade
  grouping/merging + Site & Sun lens), 4 PH spaces with 5 floor
  segments, ventilation system with **4 supply + 4 exhaust duct
  elements** (blue/red split), hot-water system with the **full
  4-level tree** (trunk → branch → fixture → 4 segments).
  (Supersedes `my_example_project.hbjson`, which can be removed.)
- **Scale fixture (provided by Ed 2026-06-12, review round 3):**
  `planning/features/model-viewer/Hillandale_Gateway_NAR_260402.hbjson`
  (51.99 MB — the trigger for D-17's 100 MB cap; copy into
  `backend/tests/fixtures/` in Phase 2 alongside the primary).
  Schema 2.0.4, model units **Inches** (exercises units→SI
  normalization; the primary is Meters), tolerance 0.05. Coverage:
  583 rooms, 6,178 faces (4,591 Wall / 798 Floor / 789 RoofCeiling),
  boundary conditions Outdoors 831 / Surface 5,248 / Ground 99,
  1,024 apertures, 253 orphaned shades sharing **one** display_name
  (merge → 1 group — the merging stress test), 583 PH spaces with
  583 floor segments, weighting factors 1.0 ×561 / 0.0 ×22 (covers
  the FullyTreated and NonTreated buckets), **71 named
  constructions** (9 opaque / 62 window — exercises both dynamic
  Construction themes), and scale/perf. It has NO duct or pipe
  geometry — which makes it the real-data test for the
  disabled-lens-segment behavior (Ventilation / Hot Water).
- Gaps in BOTH fixtures — synthetic-test only (hand-built HBJSON
  dicts / DTOs in unit tests): Adiabatic boundaries, AirBoundary
  faces (skip-count stays 0 in both), recirc piping and any
  duct/pipe geometry at scale, intermediate weighting buckets
  (0.3 / 0.5 / 0.6 boundaries).

## Phase 3 — Viewer core: canvas + Building lens + selection (US-VIEW-2/4/6 partial)

`pnpm add three @react-three/fiber @react-three/drei
@react-three/postprocessing`. Canvas (Z-up, FOV 45, damping,
`frameloop="demand"`), scene dressing (D-08: ContactShadows, fading
grid, SMAA, fit-on-load), `modelViewerStore` (Zustand), face +
aperture loaders, always-on hover/click selection (D-04), inspector
panel with the Opaque Surface + Window configs (IP/SI live), loading
progress chip + error state (D-06), camera cluster (gizmo, Fit,
Home), double-click zoom-to. Selection/hover wired to the brand
`--highlight` token family, resolved via `getComputedStyle` (D-14).

**Verify:** load both fixtures via UI (Hillandale is the perf
canary — orbit must stay smooth; record findings in STATUS.md);
orbit/fit/select/inspect; units toggle re-renders panel; error chip
shows Retry only on transient failures (D-16); e2e smoke for load +
select.

## Phase 4 — Remaining lenses (US-VIEW-3)

Lens bar (UI_SPEC §3) + crossfade; Spaces, Floor Areas, Ventilation
(supply/exhaust split), Hot Water lenses with ghost-building context;
inspector configs for space / floor segment / duct / pipe (all
Q-VIEW-4 pipe fields); disabled-segment handling for absent systems;
`&lens=` URL param (D-10).

Note: duct/pipe picking raycasts against thick lines
(`Line2`/`LineSegments2`) — set an explicit raycast threshold so
hover/select feels as forgiving as V1's (`selectLineSegment2`
precedent).

**Verify:** per-lens visibility/selectability matrix against
UI_SPEC §3 table; e2e lens-switch test.

## Phase 5 — Color themes + legend (US-VIEW-5)

Theme menu per lens; six themes incl. cyrb53 dynamic construction
colors; legend card with counts (D-11) + scene-info popover
(load_summary surfacing); derived-material model (D-09);
`&theme=` URL param.

**Verify:** theme switch keeps selection; deselect lands on theme
color; legend counts match backend `load_summary`/client tallies;
weighting-factor buckets per US-VIEW-5 crit. 2 (0.3 boundary fixed).

## Phase 6 — Measure, Site & Sun, polish (US-VIEW-4 + D-07)

Measure mode (snap, dimension lines, unit-aware labels, lifecycle);
Site & Sun lens — building + shades + "Set project location" hint.
**The sun path itself is blocked on the separate `project-location`
feature** (`planning/features/project-location/`, OQ-1 resolution) —
wire `Sunpath.from_location` against it when it ships; no Model-tab
rework expected. Keyboard map (UI_SPEC §9); a11y pass; full e2e
suite; Playwright-MCP walkthrough scripted as the acceptance run
(PRD §8 incl. the "John test").

**Verify:** measured distance matches known fixture dimensions in
both unit systems; Site & Sun shows shades + the location hint
(sun-path render test moves to the project-location integration);
§16 no-regression checklist walked and checked off in STATUS.md.

## Sequencing notes

- Phases 1–2 are backend-heavy and can proceed while UI decisions
  are still being tuned; Phase 3 is the first visible 3D.
- Phase 2 before 3 so the frontend never builds against a mock wire
  format.
- Site & Sun deliberately last: its sun path depends on the
  separate, currently-deferred `project-location` feature.
- Post-MVP queue (separate planning when reached): NEW-VIEW-2
  legend-as-filter (near-priority per Ed), NEW-VIEW-1 cross-check,
  clipping planes, sun scrubber.
