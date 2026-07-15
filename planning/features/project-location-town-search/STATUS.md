---
DATE: 2026-07-15
TIME: 15:00 EDT
STATUS: In Progress
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

**Phase 00 complete. Production API behavior remains unchanged.**

The current modal/backend flow has been traced and the feature contract is
documented. Existing storage already supports a streetless location, and
downstream Climate consumers already use coordinates rather than requiring a
street address.

The deterministic 2025 Census locality artifact, reproducible importer, source
hash metadata, and contract fixtures are now committed in the working tree.
The generated index includes 50,099 eligible Places/County Subdivisions and
33,791 ZCTA ranking references. Production models and routing intentionally
remain unchanged until Phase 01.

## Next Action

Begin `phases/phase-01-backend-locality-candidates.md`:

1. add the typed `result_type` response field with red/green tests;
2. add the cached integrity-validating locality repository and routing;
3. preserve Census street-address fallback and normalize failure responses;
4. remove the dormant MapTiler geocoder branch after configuration audit.

## Phase Ledger

| Phase | State | Purpose |
|---|---|---|
| 00 - Census locality data contract | Complete | Pinned 2025 sources, deterministic index/importer, matching rules, and fixtures |
| 01 - Backend locality candidates | Planned | Add the local Census index and preserve Census street-address fallback |
| 02 - Modal town search | Planned | Separate search text from street persistence and implement locality UX |
| 03 - Verification and docs | Planned | Focused gates, live browser matrix, context reconciliation, closeout |

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

None. The Phase 00 source/importer contract is proven; Phase 01 can implement
the production loader and endpoint behavior against it.

## Verification Baseline

Review-time focused baseline on 2026-07-15:

- `cd backend && uv run pytest tests/test_project_location.py -q` - `28 passed`.
- `cd frontend && pnpm exec vitest run src/features/climate/__tests__/SetLocationModal.test.tsx src/features/projects/__tests__/location-form.test.ts` - `14 passed`.
- Local keyless searches for `West Stockbridge, MA 01266` and
  `Brooklyn, NY 11232` returned no Census candidates, matching the Census
  street-address-only contract.
- Phase 00 importer suite: `7 passed`; focused Ruff and ty checks passed.
- Reproducible import output: 50,099 locality rows; 33,791 ZCTA rows.
