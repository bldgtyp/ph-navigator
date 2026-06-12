---
DATE: 2026-06-12
TIME: 18:08 EDT
STATUS: Active — Phase 3 complete
AUTHOR: Claude (for Ed)
SCOPE: Status ledger for the Project Location feature.
RELATED:
  - planning/features/project-location/README.md
  - planning/features/project-location/PRD.md
  - planning/features/project-location/PLAN.md
  - planning/features/project-location/decisions.md
---

# Project Location — Status

`Active — Phase 3 complete.` Requirements stub (2026-06-12) expanded
into a full PRD + 3-phase plan. The two open forks are resolved
(decisions.md): **dedicated `project_location` table + module**
(D-PL-1) and **sun-path wiring deferred to model-viewer** (D-PL-2).
Phase 1 backend code exists, `make format` + `make ci` pass, and the
code graph has been updated. Phase 2 frontend implementation is
complete with focused tests, browser smoke, `make format`, `make ci`,
and `graphify update .` passing. Phase 3 EPW linkage is implemented
with focused backend/frontend tests, `$ simplify`, `$ docs-pass`,
`make format`, `make ci`, and `graphify update .` passing.

## Phases

| Phase | Title | State |
|-------|-------|-------|
| 1 | Location backbone (BE: table + REST + MCP) | Complete — REST + MCP live, tested, formatted, CI-green, graph updated |
| 2 | Location UI (FE: Project Settings section) | Complete — Project Settings editor/viewer UI live, tested, formatted, CI-green, graph updated |
| 3 | EPW linkage (BE+FE) | Complete — EPW asset kind, parse/apply, warnings, tests, format, CI |

## Phase 1 implementation ledger

- [x] Added Alembic revision `20260612_0023_project_location.py`
  creating the 1:1 `project_location` table.
- [x] Added `backend/features/project_location/` with Pydantic
  models, raw-SQL repository, service transaction boundary, REST
  routes, and MCP read tool.
- [x] Registered `GET/PUT /api/v1/projects/{id}/location` and
  `get_project_location`.
- [x] Added focused backend tests in `backend/tests/test_project_location.py`
  for validation, public read, editor write, explicit-null clears,
  write auth, MCP read, and MCP project-scope rejection.
- [x] Updated existing backend test truncation fixtures to include the
  new FK-owned `project_location` table.
- [x] `/simplify` pass complete: extracted shared blank-string
  normalization, reused existing MCP test helpers, and kept MCP tool
  registration on the existing `features.mcp.tools` import surface.
- [x] `/docs-pass` complete: no new context/ADR doc required; this
  feature status ledger remains the right durable status record.
- [x] Focused verification passed:
  `cd backend && uv run pytest tests/test_project_location.py`;
  `cd backend && uv run ruff check features/project_location tests/test_project_location.py`;
  `cd backend && uv run ty check features/project_location tests/test_project_location.py`.
- [x] `make format` passed.
- [x] `make ci` passed: backend Ruff format/check, Ty, Alembic
  upgrade, pytest (`748 passed, 2 skipped`); frontend Prettier check,
  ESLint, structural checks, Vitest (`1549 passed`), and production
  build.
- [x] `graphify update .` passed.

## Phase 2 implementation ledger

- [x] Added frontend project-location API types and TanStack Query
  hooks for `GET/PUT /api/v1/projects/{id}/location`.
- [x] Added a Project Settings **Location** section after Metadata and
  before MCP tokens.
- [x] Wired editor form fields for latitude, longitude, elevation,
  time zone, true north, address, city, and state into the modal's
  single Save flow.
- [x] Added viewer read-only rendering and "No location set" empty
  state.
- [x] Added elevation SI/IP conversion while leaving coordinate and
  true-north values as angular degrees.
- [x] Added client-side validation for latitude, longitude, elevation,
  and true-north ranges.
- [x] Added warning-banner slot for Phase 3 EPW mismatch warnings.
- [x] Added focused Vitest coverage for unit conversion, partial PUT
  payloads, explicit-null clears, validation, editor save, and viewer
  read-only rendering.
- [x] Added a viewer-safe Project Settings affordance so public viewers
  can read metadata/location without exposing mutating controls.
- [x] Playwright smoke passed on `http://localhost:5173` /
  `http://localhost:8000`: editor saved a fresh project's location,
  reload showed persisted values, and logged-out viewer saw read-only
  coordinates with no inputs or Save button.
- [x] `$ simplify` pass complete: reused shared unit-format helpers,
  exposed viewer Project Settings read-only, removed unused helper,
  parallelized metadata/location saves, memoized MCP token section, and
  fixed the Phase 2 checklist.
- [x] `$ docs-pass` complete: updated `context/UI_UX.md` so Viewer
  Project Settings is documented as read-only instead of hidden.
- [x] `make format` passed.
- [x] `make ci` passed: backend Ruff format/check, Ty, Alembic
  upgrade, pytest (`748 passed, 2 skipped`); frontend Prettier check,
  ESLint, structural checks, Vitest (`1556 passed`), and production
  build.
- [x] `graphify update .` passed.

## Phase 3 implementation ledger

- [x] Added Alembic revision `20260612_0024_epw_asset_kind.py`
  extending the `project_assets_kind_allowed` CHECK constraint to
  include `epw`.
- [x] Registered the `epw` asset kind in backend/frontend asset types
  with `.epw` upload policy (`text/plain` and
  `application/octet-stream`) and a 25 MB cap.
- [x] Added EPW magic/header validation during asset upload completion,
  keyed by `asset_kind='epw'` and using the same parser-backed header
  validation as the parse endpoint.
- [x] Added dependency-free EPW `LOCATION` header parsing under
  `backend/features/project_location/epw.py`, including conservative
  IANA time-zone suggestion for common single-zone US states and
  retention of numeric UTC offset.
- [x] Added editor-only
  `POST /api/v1/projects/{id}/location/epw/parse?asset_id=...` that
  reads the asset prefix through `AssetService`, returns a suggestion,
  and stores `metadata.epw_location` without mutating the saved
  project-location row.
- [x] Added linked-EPW descriptor resolution on location reads and
  public download authorization for location-linked EPWs.
- [x] Added non-blocking >1° entered-vs-EPW latitude/longitude warning
  on location save.
- [x] Added Project Settings EPW upload, parse, one-click Apply,
  editable source URL, saved EPW download link, and viewer read-only
  download rendering.
- [x] Added focused backend coverage for EPW upload validation, parse
  metadata retention, mismatch warning, and editor-gated parse.
- [x] Added focused Vitest coverage for EPW apply/save and viewer
  read-only download affordance.
- [x] Playwright smoke reached the editor Project Settings EPW upload
  control on `http://localhost:5173` / `http://localhost:8000`, but
  the real signed-object PUT failed in the browser with `Failed to
  fetch` in the local environment. The fake-R2 backend and Vitest
  upload/parse/apply paths pass; rerun real upload smoke when local R2
  signed PUT/CORS is configured.
- [x] `$ simplify` pass complete: shared parser-backed EPW validation,
  removed duplicate frontend parse-error state, narrowed Location
  section props, skipped EPW thumbnail work, avoided no-op metadata
  rewrites on repeat parse, and reduced single-asset public-reference
  DB work.
- [x] `$ docs-pass` complete: updated this status ledger, README,
  Phase 3 handoff, and `context/UI_UX.md`.
- [x] `make format` passed.
- [x] `make ci` passed: backend Ruff format/check, Ty, Alembic
  upgrade, pytest (`752 passed, 2 skipped`); frontend Prettier check,
  ESLint (existing Fast Refresh warnings only), structural checks,
  Vitest (`1557 passed`), and production build.
- [x] `graphify update .` passed.

## Next step

Rerun the real browser EPW upload smoke when local R2 signed PUT/CORS
is available.

## Blockers

None for Phases 1–3.

## Deferred / external

The model-viewer **sun-path wiring** (populating the `sun_path` wire
key via `Sunpath.from_location`) is owned by model-viewer, not this
plan (decisions.md D-PL-2). It is schedulable once model-viewer
Phase 2 (extraction + ladybug dep) and Phase 6 (renderer stub) are
merged; the seam is specified in PRD §10. Until then the Site & Sun
lens shows the building + shades + a "Set project location" hint, and
this feature's Phase 2 UI is where that location is set.
