---
DATE: 2026-07-29
UPDATED: 2026-07-29 — implementation and verification complete
TIME: 21:52 EDT
STATUS: Complete
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 2 — the report JSON endpoint: names joined, grid-position
  labels, glazing-area-weighted SHGC rollup, provenance block, MCP sibling.
  Backend only.
RELATED: ../PRD.md §4.2/§5.1/§6, ../decisions.md §D-5/§D-6/§D-7,
  backend/features/aperture_u_value/routes.py,
  backend/features/project_document/apertures/lookup.py,
  backend/features/apertures_mcp/tools.py
---

# Phase 2 — Report endpoint

## Goal

`GET /api/v1/projects/{pid}/versions/{vid}/apertures/u-values/report?source=draft|version`
returns everything the page renders — Phase 1's numeric detail joined with
names, per-aperture rollups, and provenance — with **zero frontend math**
beyond unit formatting.

## Hazards

1. **No caching here.** The report DTO carries names, which the existing
   content-hash cache deliberately ignores — serving the report from that
   cache would return stale names. Computation is cheap (pure math over
   the loaded document); compute fresh per request. If profiling ever says
   otherwise, a *separate* name-inclusive namespace is the fix — never a
   reuse of `content_hash_for_aperture` as the key.
2. **The rollup must equal the chip.** Per D-7(a), the report's U-w is the
   *same number* the existing endpoint returns — derive it from the same
   code path (Phase 1's detailed result), never recompute independently.

## Work

1. **Report models** (`models.py`): `ApertureUValueReport` —
   `project_id`, `version_id`, `source`, `provenance`,
   `apertures: list[ApertureReportSection]`.
   `ApertureReportSection` — `aperture_type_id`, `name`,
   `overall_width_m` / `overall_height_m` (sums of `column_widths_mm` /
   `row_heights_mm`), `element_count`, `void_count` (PRD §6.1 footnote),
   `unfinished_count`, `total_area_m2`, `window_u_value_w_m2k` (== chip),
   `shgc_glazing_area_weighted` (`float | None` — None when no element has
   a positive glazing area), `warnings`, `elements`.
   Element rows = Phase 1's `ApertureElementDetail` + `element_name`,
   `grid_label` (`"C{c}_R{r}"` from `column_span[0]`/`row_span[0]`,
   matching the legacy sheet's naming), `glazing_name`, per-edge
   `frame_name`, `unfinished: bool`.
   `ReportProvenance` — `version_label`, `source`, `generated_note`
   (fixed strings: "ISO 10077-1:2006 · uninstalled U-w (excludes
   ψ-install) · 45° corner split · edges as seen from outside").
2. **Service** (`service.py` or a new `report.py` in the slice): build the
   report from `calculate_aperture_u_values_detailed` + `frame_by_id` /
   `glazing_by_id` lookups. SHGC rollup per D-6:
   `Σ(g_value × glazing_area) / Σ glazing_area` over glazed elements with
   glazing assigned; elements with `g_value is None` are excluded from
   both sums and add a warning. `unfinished` = element has any
   `missing_frame` / `incomplete_frame_data` / `missing_glazing` /
   `missing_dimension` warning.
3. **Route** (`routes.py`): same shape as the existing u-values route —
   `require_project_view_access`, `load_document_body(version_id, access,
   source)`. No capability gate (view-only JSON; the gate lands on the
   export in Phase 3 per D-8).
4. **MCP sibling** (`apertures_mcp/tools.py`):
   `get_aperture_u_value_report` with optional `aperture_type_ids` filter,
   mirroring `tool_calculate_aperture_u_values`' wiring. Register in the
   MCP tool listing; keep the description one line.
5. **Tests** (`backend/tests/test_aperture_u_value_report.py`):
   - `window_u_value_w_m2k` equals the existing endpoint's value for the
     same fixture (all Phase 1 fixtures reused);
   - SHGC weighting: two glazings with different g-values and unequal
     glazing areas → hand-computed expected; None when no glazing;
   - `unfinished_count` / `void_count` / `grid_label` correctness;
   - names resolve; deleted/missing frame id → element flagged unfinished,
     endpoint still 200 (error-CSV doctrine: never 422 over content);
   - `source=draft` vs `source=version` both work; route auth follows the
     existing endpoint's tests.

## Out of scope

CSV/XLSX serializers, export route, capability, units conversion, frontend.

## Verification

New test module green; existing u-values endpoint tests untouched;
`make check-backend`; MCP smoke via the project-registered `phn-local`
stdio server (`get_aperture_u_value_report` against the AGENT-BROWSER
fixture); `make ci`.

## Implementation ledger

- Added fresh, uncached REST and MCP report paths with one shared orchestration
  function.
- Added name-bearing report DTOs, exact legacy-rollup reuse, SHGC weighting,
  warning/unfinished counts, provenance, and bounded/deduplicated MCP filters.
- Added a one-row, metadata-only project-version lookup so report assembly
  does not reload the saved document body.
- Focused report/parity/service/MCP suite: `41 passed`; touched-slice Ty:
  passed; MCP schema/source regression: `1 passed`.
- `make check-backend`: `1733 passed, 7 skipped`; registered `phn-local`
  stdio report smoke passed against `AGENT-BROWSER`; `make ci`: backend
  results above plus frontend `253` files / `2346` tests and production
  build; `graphify update .`: passed.
