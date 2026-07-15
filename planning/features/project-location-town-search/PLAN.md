---
DATE: 2026-07-15
TIME: 14:27 EDT
STATUS: Planned
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

The implementation risk is at two boundaries:

1. **Provider semantics** - the MapTiler parser does not currently distinguish
   address from municipality/locality/place/postal results.
2. **Frontend state ownership** - the modal uses the same `siteAddress` value
   as both geocoder query text and persisted `street_address`.

## Phase Map

| Phase | Scope | Dependency | Exit condition |
|---|---|---|---|
| 00 | Provider contract and response fixtures | None | Address/locality shapes and provider runtime semantics are frozen without production model changes |
| 01 | Backend parsing and response capability metadata | Phase 00 | MapTiler locality returns typed streetless candidate; Census behavior remains intact |
| 02 | Modal query/persistence separation and locality UX | Phase 01 | Address and town selections both save correctly; old streets clear |
| 03 | Integration/browser verification and durable docs | Phases 01-02 | Focused gates, browser matrix, graph update, docs-pass, and status closeout complete |

## Phase 00 - Provider Contract and Fixtures

See `phases/phase-00-provider-contract-and-fixtures.md`.

- Capture sanitized MapTiler fixtures for address, municipality/locality/place,
  and a postal-code result that v1 will explicitly skip.
- Confirm which response fields are stable enough to parse (`place_type`,
  `text`, `place_name`, `context`, geometry/center).
- Settle `result_type = "address" | "locality"`; standalone postal-code
  results are excluded from v1 candidates.
- Decide the exact zero-result capability signal. Recommended additive response
  field: `search_scope = "address_and_locality" | "street_address_only"`.
- Record configured MapTiler success/zero/failure behavior. Do not change
  production Pydantic or TypeScript models in Phase 00.

## Phase 01 - Backend Locality Candidates

See `phases/phase-01-backend-locality-candidates.md`.

- Parse MapTiler result type before deriving normalized address pieces.
- Treat municipality/locality/place as streetless locality candidates.
- Skip standalone postal-code-area results; still parse postal code when it is a
  component of an address/locality result.
- Preserve Census full-address parsing and identify its search scope honestly.
- Write backend regression tests first, then implement the parser/response
  changes.
- Keep the endpoint editor-only and keep provider keys server-side.

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
- Run `graphify update .`, `simplify`, `docs-pass`, `make format`, and `make ci`.

## Likely Production Files

Backend:

- `backend/features/project_location/models.py`
- `backend/features/project_location/derive.py`
- `backend/features/project_location/service.py`
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

- Preserve full-address behavior and API compatibility through additive
  response fields.
- Test provider payload parsing from committed fixtures; do not require live
  MapTiler calls in automated tests.
- Do not infer locality vs address from commas or token count in the user query.
- Do not persist the provider label as a street address.
- Treat candidate application as replacement of the full address-component
  tuple; do not retain old city/state/postal values when the new candidate omits
  them.
- Do not attach or replace climate sources when saving a location.
- Keep town-center approximation visible to the editor.
- Do not silently fall back from a configured-but-failing MapTiler request to
  Census; that would change query capability without the user knowing.
