---
DATE: 2026-06-24
TIME: 19:20 EDT
STATUS: Complete — archived 2026-06-24
AUTHOR: Claude (Opus 4.8)
SCOPE: apertures-glazings-frames-reports
RELATED: ./README.md, ./PRD.md, ./PLAN.md, ./phases/,
  ../glazing-frame-documentation/
---

# STATUS — Apertures → Glazings / Frames report pages

**State:** `Complete`. Phases 0–3 are implemented, verified, documented, and
ready for archive under `planning/archive/dated/2026-06-24/`.

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
- **Phase 2 complete (2026-06-24):** wired full Materials-parity report panels
  for glazings and frames: product/manufacturer/numeric columns, datasheet chips
  and expanded `AttachmentCell` zones, status filters and editable
  specification-status controls, grouped in-scope/N/A/unused sections, use-site
  rows, catalog-drift badges and refresh actions, unused-row removal, viewer
  hiding for N/A/unused rows, and report-route write mutations. Retired
  `ProjectRefsView`, `refsAggregation.ts`, and its test.
- **Phase 3 complete (2026-06-24):** updated `context/UI_UX.md`,
  `context/ui/pages/apertures-tab.md`, and the report-tables planning packet to
  record Glazings/Frames as realized report-table consumers; captured closeout
  screenshots under `assets/`; ran browser smoke for filters, expansion,
  status persistence, datasheet upload/detach, report-route network guards, and
  bare-route redirect.

## Next step

Archived. Future report-table cleanup candidates from simplify are shared
helper extraction for attachment diff/apply loops and spec-report section/status
helpers, but they are non-blocking follow-ups and not required for this feature.

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
- 2026-06-24 Phase 2:
  - `cd frontend && pnpm exec vitest run src/features/apertures/__tests__/ApertureSpecReportPanel.test.tsx` — 3 passed.
  - `make frontend-dev-check` — passed with existing fast-refresh warnings and
    Vite chunk-size warning only.
  - Playwright smoke on local Codex fixture
    `846a42ac-cb2c-472f-8239-eabd05fe6d57` — `/apertures/glazings` rendered
    `Browser Smoke Triple Glazing` with U-value/g-value columns and expanded
    datasheets/use-sites; `/apertures/frames` rendered `Browser Smoke Frame`
    with Psi-install/Width columns and expanded use-sites; report routes did not
    hit builder-only aperture slice or U-value APIs; bare `/apertures`
    redirected to `/apertures/builder`.
  - Simplify pass — fixed duplicate draft-summary invalidation, indexed drift
    lookups by `element_id:target`, constrained datasheet URL fetches to the
    expanded row, and added typed product command config/status guarding.
- 2026-06-24 Phase 3:
  - Playwright smoke on fixture `846a42ac-cb2c-472f-8239-eabd05fe6d57` —
    filters, expansion, status persist/restore, datasheet upload/detach,
    frames side-aware use-sites, report-route network guard, and bare-route
    redirect passed.
  - Screenshots captured:
    `assets/apertures-glazings-report.png`,
    `assets/apertures-glazings-expanded.png`,
    `assets/apertures-glazings-datasheet-upload.png`,
    `assets/apertures-frames-expanded.png`.
  - `make format` — passed.
  - `make ci` — passed: backend `1099 passed, 2 skipped, 1 warning`; frontend
    `200 passed`, `1900 passed`; build succeeded with the existing Vite
    chunk-size warning.
  - `graphify update .` — passed.
