---
DATE: 2026-07-15
TIME: 15:00 EDT
STATUS: In Progress
AUTHOR: Codex
SCOPE: Phased implementation sequence for Project Location town search.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./STATUS.md
  - ./decisions.md
  - ./research.md
  - ./phases/phase-00-provider-contract-and-fixtures.md
  - ./phases/phase-01-backend-locality-candidates.md
  - ./phases/phase-02-modal-town-search.md
  - ./phases/phase-03-verification-and-docs.md
---

# PLAN - Project Location Town Search

## Current Assessment

This is not a storage or Climate-service feature. The database already has
nullable `street_address`, `city`, `state`, and `postal_code` fields, and
`full_site_address` already composes a locality-only display. Climate roster,
weather, map, and sun-path consumers already use coordinates.

The implementation risk is at three boundaries:

1. **Locality data semantics** - Census Places alone do not cover all legal
   towns; the index must also include County Subdivisions and distinguish an
   internal point from a promised geographic centroid.
2. **Frontend state ownership** - the modal uses the same `siteAddress` value
   as both geocoder query text and persisted `street_address`.
3. **Search routing** - locality lookup must be deterministic while preserving
   the existing full-address Census behavior.

## Phase Map

| Phase | Scope | Dependency | Exit condition |
|---|---|---|---|
| 00 | **Complete** - Census locality data contract and fixtures | None | 2025 source vintage, normalized schema, importer, ZIP qualification, and matching fixtures are frozen |
| 01 | **Complete** - Backend locality index and address fallback | Phase 00 | Typed locality candidates are served keylessly; Census address behavior and explicit failures are verified |
| 02 | Modal query/persistence separation and locality UX | Phase 01 | Address and town selections both save correctly; old streets clear |
| 03 | Integration/browser verification and durable docs | Phases 01-02 | Focused gates, browser matrix, graph update, docs-pass, and status closeout complete |

## Phase 00 - Census Locality Data Contract

See `phases/phase-00-provider-contract-and-fixtures.md`.

- Pin official Census Gazetteer source vintage and files: national Places,
  eligible legal/locality County Subdivisions, and ZCTA data used only for
  optional ZIP distance ranking.
- Define the normalized, versioned runtime index and reproducible importer.
- Freeze matching, ambiguity, deduplication, ZIP, and candidate-label rules.
- Prove representative fixtures including West Stockbridge as a County
  Subdivision and at least one incorporated Place.
- Keep `result_type = "address" | "locality"`; ZIP-only results remain excluded.
- Do not change production Pydantic or TypeScript models in Phase 00.

## Phase 01 - Backend Locality Candidates

See `phases/phase-01-backend-locality-candidates.md`.

- Add a cached loader/search service for the committed Census-derived locality
  index.
- Parse trailing state and optional ZIP, then match normalized locality name +
  state across Place and County Subdivision rows.
- Use optional ZCTA data only for Haversine-distance ranking of same-state
  locality candidates; keep the selected locality internal point as the saved
  coordinate and make no containment claim.
- If no locality candidate exists, preserve the current Census oneline
  full-address request and parsing.
- Add `result_type` and ensure locality candidates always have
  `street_address = null`.
- Remove the dormant MapTiler geocoder branch/config after verifying it has no
  deployed use; do not alter the separate keyless raster-map tile setup.
- Write backend regression tests first, then implement the parser/response
  changes.
- Keep the endpoint editor-only and its existing candidate/query limits.

## Phase 02 - Modal Town Search

See `phases/phase-02-modal-town-search.md`.

- Introduce modal-local `searchQuery`; do not expand the shared persisted form
  shape with display-only text.
- Initialize query text from `location.full_site_address` when available.
- Apply address and locality candidates with explicit field semantics.
- Remove the `candidate.label` fallback into `street_address`.
- Update copy, candidate presentation, no-results behavior, and regression
  coverage.
- Write frontend helper/modal regression tests before changing behavior.

## Phase 03 - Verification and Docs

See `phases/phase-03-verification-and-docs.md`.

- Run focused backend/frontend suites and `make frontend-dev-check`.
- Run `make agent-browser-ready`, then verify full-address and town-only flows
  through the mounted Climate route.
- Verify switching an existing street location to town-only clears the street.
- Verify viewer/public output and map show only the town-level location.
- Verify the feature works with no MapTiler configuration.
- Run `graphify update .`, `simplify`, `docs-pass`, `make format`, and `make ci`.

## Likely Production Files

Backend:

- `backend/features/project_location/models.py`
- `backend/features/project_location/derive.py`
- `backend/features/project_location/service.py`
- `backend/features/project_location/data/` (new versioned Census-derived index)
- `backend/scripts/` (reproducible Gazetteer importer/refresh command)
- `backend/tests/test_project_location.py`

Frontend:

- `frontend/src/features/projects/types.ts`
- `frontend/src/features/projects/location-form.ts`
- `frontend/src/features/climate/components/SetLocationModal.tsx`
- `frontend/src/features/projects/__tests__/location-form.test.ts`
- `frontend/src/features/climate/__tests__/SetLocationModal.test.tsx`

Durable docs likely requiring reconciliation:

- `context/technical-requirements/api.md`
- `context/technical-requirements/data-model.md` only if field semantics need
  clarification; no schema change is planned.

## Implementation Rules

- Preserve full-address behavior and API compatibility through the additive
  `result_type` field.
- Test locality lookup from committed deterministic fixtures; automated tests
  must not download Census files or call a locality API.
- Identify locality input by a valid trailing state plus an exact normalized
  locality-index match; do not classify by punctuation or token count alone.
- Return a deterministic empty result for ZIP-only input without calling the
  Census address geocoder.
- Do not persist the candidate label as a street address.
- Treat candidate application as replacement of the full address-component
  tuple; do not retain old city/state/postal values when the new candidate omits
  them.
- Do not attach or replace climate sources when saving a location.
- Keep the Census locality internal-point approximation visible to the editor.
- Treat Census Gazetteer `INTPTLAT`/`INTPTLONG` as representative internal
  points, not guaranteed centroids.
- Do not allow missing/corrupt bundled index data to silently disable locality
  search; return `503 locality_index_unavailable` without address fallback.
