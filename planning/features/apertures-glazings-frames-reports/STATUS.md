---
DATE: 2026-06-24
TIME: 17:45 EDT
STATUS: Active — Phase 1 complete; Phase 2 next
AUTHOR: Claude (Opus 4.8)
SCOPE: apertures-glazings-frames-reports
RELATED: ./README.md, ./PRD.md, ./PLAN.md, ./phases/,
  ../glazing-frame-documentation/
---

# STATUS — Apertures → Glazings / Frames report pages

**State:** `Active`. Phase 1 is complete; resume at Phase 2.

## Blocker

`glazing-frame-documentation` was listed as a blocker in the original packet,
but the current checkout already includes the required backend entities and
commands:

- `ProjectGlazing` / `ProjectFrame` document entities + flat tables.
- The apertures slice exposing `project_glazings` / `project_frames`.
- `update_/remove_project_glazing/frame` commands + the datasheet asset-registry
  extension (prerequisite Phase 3).

## Done

- Confirmed the Materials page is built on the report-table primitive
  (`MaterialsPanel.tsx` + `shared/ui/report-table/`) and that the report-tables
  PRD designated glazing + frame as its intended next consumers — so these pages
  are the planned reuse, not a new pattern.
- Confirmed the Apertures sub-tab bar already declares
  "Apertures · Glazings · Frames" (`AperturesTab.tsx:38-42`, state-based) — the
  nav scaffold is half-built; this feature makes it route-based and fills the two
  pages.
- Mapped the existing interim report (`refsAggregation.ts` + `ProjectRefsView.tsx`)
  to retire.
- Mapped the backend read template (`build_envelope_read_parts`) + the envelope
  read route to clone.
- **Phase 0 complete (2026-06-24):** added
  `backend/features/apertures/` read DTOs, selector, service, and route for
  `GET /api/v1/projects/{project_id}/versions/{version_id}/apertures/spec-report`;
  registered the router in `backend/main.py`; added
  `backend/tests/test_apertures_spec_report.py`.
- **Phase 1 complete (2026-06-24):** converted the Apertures sub-tab bar to
  route-based `AppSubTabLink`s; added `/apertures/builder`,
  `/apertures/glazings`, and `/apertures/frames` path helpers; added frontend
  spec-report API/query plumbing and read types; added Glazings/Frames report
  shell panels using the shared report-table/status-filter pattern.

## Next step — RESUME HERE

**Phase 2:** finish Glazings/Frames columns, datasheet/use-site/spec-status/drift
wiring, and retire `ProjectRefsView` + `refsAggregation`. See
`phases/phase-02-wire-and-retire-modal.md`.

## Verification ledger

- 2026-06-24 Phase 0:
  - `cd backend && uv run pytest tests/test_apertures_spec_report.py` — 2 passed.
  - `cd backend && uv run pytest tests/test_aperture_drift_route.py tests/test_apertures_spec_report.py` — 5 passed.
  - `cd backend && uv run ruff check features/apertures tests/test_apertures_spec_report.py main.py` — passed.
  - `cd backend && uv run ty check features/apertures tests/test_apertures_spec_report.py` — passed.
- 2026-06-24 Phase 1:
  - `cd frontend && pnpm run format` — passed.
  - `make frontend-dev-check` — passed with existing fast-refresh warnings only.
  - Playwright smoke on local Codex fixture
    `846a42ac-cb2c-472f-8239-eabd05fe6d57` — `/apertures/glazings` and
    `/apertures/frames` rendered real report rows and status filters; bare
    `/apertures` redirected to `/apertures/builder`.
- Phase 3 still carries the browser smoke (sign in as **Ed** only when isolated;
  otherwise use the isolated smoke recipe in `planning/features/.instructions.md`).
