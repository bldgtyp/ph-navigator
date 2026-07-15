---
DATE: 2026-07-15
TIME: 15:00 EDT
STATUS: Planned
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

**Planned. No production implementation has started.**

The current modal/backend flow has been traced and the feature contract is
documented. Existing storage already supports a streetless location, and
downstream Climate consumers already use coordinates rather than requiring a
street address.

The implementation no longer depends on MapTiler. Town/locality candidates will
come from a versioned repository index derived from official U.S. Census
Gazetteer files. The index must include both Places and County Subdivisions so
New England legal towns such as West Stockbridge resolve. The existing keyless
Census oneline geocoder remains the full-street-address path.

## Next Action

Begin `phases/phase-00-provider-contract-and-fixtures.md`:

1. define the normalized Census locality-index schema and source vintage;
2. define a reproducible importer for Places, eligible County Subdivisions, and
   ZCTA ZIP ranking data;
3. freeze locality matching, ambiguity, and optional-ZIP ranking semantics;
4. create deterministic fixtures for representative MA, NY, and NJ cases.

## Phase Ledger

| Phase | State | Purpose |
|---|---|---|
| 00 - Census locality data contract | Planned | Freeze source files, normalized index, matching rules, and fixtures |
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

None. The selected locality source is public, versionable Census data and the
runtime design is keyless. Phase 00 must still pin the source vintage and prove
the importer output before production implementation begins.

## Verification Baseline

Review-time focused baseline on 2026-07-15:

- `cd backend && uv run pytest tests/test_project_location.py -q` - `28 passed`.
- `cd frontend && pnpm exec vitest run src/features/climate/__tests__/SetLocationModal.test.tsx src/features/projects/__tests__/location-form.test.ts` - `14 passed`.
- Local keyless searches for `West Stockbridge, MA 01266` and
  `Brooklyn, NY 11232` returned no Census candidates, matching the Census
  street-address-only contract.
