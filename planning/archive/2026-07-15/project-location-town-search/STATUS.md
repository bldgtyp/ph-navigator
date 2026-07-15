---
DATE: 2026-07-15
TIME: 15:00 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Current state and next action for Project Location town search.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
  - ./decisions.md
  - ./phases/phase-00-provider-contract-and-fixtures.md
---

# STATUS - Project Location Town Search

## Current State

**Phases 00-03 complete. Address-or-town search is implemented and verified.**

The current modal/backend flow has been traced and the feature contract is
documented. Existing storage already supports a streetless location, and
downstream Climate consumers already use coordinates rather than requiring a
street address.

The deterministic 2025 Census locality artifact feeds a cached,
integrity-validating backend search. Candidates are typed as address/locality;
locality results are keyless and streetless, while non-locality queries retain
the live Census oneline address path. The dormant MapTiler geocoder branch and
setting are removed. The modal keeps search text separate from persisted street
data, classifies candidates, clears stale address components on selection, and
tracks town/saved/custom-point privacy presentation without changing storage.
Ambiguous locality labels are unique through county, geography type, and a
last-resort Census GEOID qualifier.

## Next Action

Archive this completed packet and update `planning/STATUS.md` to the archived
path. No implementation work remains.

## Phase Ledger

| Phase | State | Purpose |
|---|---|---|
| 00 - Census locality data contract | Complete | Pinned 2025 sources, deterministic index/importer, matching rules, and fixtures |
| 01 - Backend locality candidates | Complete | Typed local Census candidates, ZIP ranking, Census address fallback, and explicit 503/502 errors |
| 02 - Modal town search | Complete | Separate search text from street persistence, typed candidate application, privacy copy, and stale-response guards |
| 03 - Verification and docs | Complete | Focused/full gates, mounted browser matrix, ambiguity hardening, context reconciliation, simplify/docs-pass |

## Accepted Boundaries

- Census Gazetteer data provides keyless locality internal points.
- Census oneline geocoding remains the street-address path.
- No MapTiler key, new commercial provider, or database migration is required.
- Places and eligible legal/locality County Subdivisions are both required;
  ZCTA is only a distance-ranking qualifier, not municipal-containment proof or
  a ZIP-only location mode.
- Locality selection persists `street_address = null`.
- Town-level elevation is approximate; manual elevation/pin refinement remains
  the correction path.

## Blockers

None.

## Verification Baseline

Review-time focused baseline on 2026-07-15:

- `cd backend && uv run pytest tests/test_project_location.py -q` - `28 passed`.
- `cd frontend && pnpm exec vitest run src/features/climate/__tests__/SetLocationModal.test.tsx src/features/projects/__tests__/location-form.test.ts` - `14 passed`.
- Local keyless searches for `West Stockbridge, MA 01266` and
  `Brooklyn, NY 11232` returned no Census candidates, matching the Census
  street-address-only contract.
- Phase 00 importer suite: `7 passed`; focused Ruff and ty checks passed.
- Reproducible import output: 50,099 locality rows; 33,791 ZCTA rows.
- Phase 01 combined backend/importer suite: `43 passed`; focused Ruff and ty
  checks passed.
- Phase 02 frontend helper/modal/presentation suite: `31 passed`; TypeScript and
  `make frontend-dev-check` passed.
- Phase 03 backend focused suite: `47 passed`; frontend focused suite: `31
  passed`; Ruff, ty, and TypeScript passed.
- Mounted Climate route verified full-address and town-only save/reopen,
  street clearing, public privacy projection, elevation override, pin privacy,
  ambiguous/no-match results, and Phius/hourly picker loading.
- Final `make ci`: backend `1373 passed, 7 skipped`; frontend `2165 passed`;
  production build passed.
