---
DATE: 2026-06-24
TIME: 17:45 EDT
STATUS: Complete
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 0 — backend read API for the two report pages.
RELATED: ../PRD.md (Backend read API), ../../glazing-frame-documentation/
---

# Phase 0 — Backend read API

**Completed 2026-06-24.** The prerequisite backend entities were already present
in this checkout, so this phase added the report read API and tests.

Clone the envelope read-model machinery for apertures. Everything here mirrors a
named Materials counterpart.

## Read DTOs — `backend/features/apertures/models.py` (new) or extend an existing aperture models module

Mirror `backend/features/envelope/models.py` `ProjectMaterialRead` /
`ProjectMaterialUseSite`:

- `ProjectGlazingUseSite`: `aperture_type_id`, `aperture_type_name`,
  `element_id`, `element_name`.
- `ProjectFrameUseSite`: the above **plus** `side: ApertureSide`.
- `ProjectGlazingRead(ProjectGlazing)`: adds `use_sites: list[ProjectGlazingUseSite]`.
- `ProjectFrameRead(ProjectFrame)`: adds `use_sites: list[ProjectFrameUseSite]`.

(`ProjectGlazing`/`ProjectFrame` come from the prerequisite, in
`project_document/envelope_models.py`.)

## Selector — `backend/features/apertures/selectors.py` (new)

`build_apertures_read_parts(body) -> tuple[list[ProjectGlazingRead], list[ProjectFrameRead]]`,
mirroring `build_envelope_read_parts`
(`backend/features/envelope/selectors.py:16-53`):

- `glazings_by_id = {g.id: g for g in body.tables.project_glazings}`;
  `frames_by_id` likewise.
- One pass over `body.tables.apertures` → `aperture.elements`:
  - if `element.glazing_id`: append a `ProjectGlazingUseSite` to that id's list.
  - for each populated frame slot id (top/right/bottom/left): append a
    `ProjectFrameUseSite` (with `side`).
- Return `[ProjectGlazingRead(**g.model_dump(), use_sites=...) for g in ...]` and
  the frame equivalent — exactly the materials pattern (`selectors.py:46-52`).

## Read endpoint — mirror the envelope read route

Add a route mirroring `GET /api/v1/projects/{id}/versions/{version_id}/envelope`
(see `backend/features/project_document/routes.py` envelope read +
`backend/features/envelope/routes.py`). Suggested:
`GET .../versions/{version_id}/apertures/spec-report?source=...` →
`{ project_glazings: ProjectGlazingRead[], project_frames: ProjectFrameRead[] }`.
Load the document via the same store path the envelope read uses
(`get_current_document_view` / saved document) so draft vs version + ETags behave
identically.

> Alternative (lighter): extend the existing apertures slice response
> (`tables/apertures.py:apertures_response`) to carry the enriched reads instead
> of a separate endpoint. Pick one in review; a dedicated read endpoint keeps the
> report's shape decoupled from the builder slice and matches Materials most
> closely.

## Drift report — reuse `aperture_drift`

Add a glazing/frame catalog-drift report endpoint mirroring
`GET .../envelope/material-catalog-drift`
(`backend/features/envelope/routes.py:64-70`), backed by the `aperture_drift`
comparator (re-sourced to the flat entities in the prerequisite Phase 2). Returns
per-entity drift items the panel surfaces via a `MaterialDriftBadge`-style badge.

## Tests

- `build_apertures_read_parts`: a catalog glazing used by 3 elements →
  one `ProjectGlazingRead` with 3 use-sites; a frame on 4 sides of one element →
  one `ProjectFrameRead` with 4 use-sites (correct `side`s); an unused entity →
  empty `use_sites`.
- Read endpoint returns draft vs version correctly with ETags.
- Drift endpoint flags a drifted entity once.

## Exit criteria

- Selector + endpoint + drift tests green; full backend suite green; `ruff` +
  `ty` clean.

## Completion evidence

- Added `backend/features/apertures/models.py` with
  `ProjectGlazingRead`/`ProjectFrameRead`, use-site DTOs, and
  `ApertureSpecReportResponse`.
- Added `backend/features/apertures/selectors.py` with
  `build_apertures_read_parts`.
- Added `backend/features/apertures/service.py` and `routes.py` for
  `GET /api/v1/projects/{project_id}/versions/{version_id}/apertures/spec-report`.
- Reused the existing `GET .../apertures/drift-report` route backed by
  `aperture_drift`.
- Added `backend/tests/test_apertures_spec_report.py`.
- Verification:
  - `cd backend && uv run pytest tests/test_apertures_spec_report.py` — 2 passed.
  - `cd backend && uv run pytest tests/test_aperture_drift_route.py tests/test_apertures_spec_report.py` — 5 passed.
  - `cd backend && uv run ruff check features/apertures tests/test_apertures_spec_report.py main.py` — passed.
  - `cd backend && uv run ty check features/apertures tests/test_apertures_spec_report.py` — passed.
