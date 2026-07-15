---
DATE: 2026-07-15
TIME: 15:00 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Freeze Census locality source, normalized index, matching, and fixtures.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../decisions.md
  - ../research.md
---

# Phase 00 - Census Locality Data Contract and Fixtures

## Current Result

**Complete.** The locality path uses public Census Gazetteer data and does not
require `MAPTILER_API_KEY` or another runtime key.

Phase 00 must pin the Census vintage and define a reproducible normalized index
from three official national Gazetteer files:

- Places: incorporated places and Census Designated Places;
- County Subdivisions: eligible functioning legal/locality minor civil
  divisions, required for New England cases such as West Stockbridge;
- ZCTAs: optional ZIP distance ranking only.

The runtime locality coordinate is the selected Place or County Subdivision
`INTPTLAT`/`INTPTLONG`. It is an approximate internal point, not a guaranteed
centroid. The candidate contract remains:

```text
result_type: address | locality
```

No deployment-dependent `search_scope` field is needed because locality search
is always available from the bundled index.

## Goal

Establish a deterministic data and matching contract before changing production
models, services, or modal behavior. Phase 00 is data/fixture/contract work only.

## Investigation

1. Pin the official Census Gazetteer vintage and source URLs.
2. Define a reproducible importer that accepts/downloads the source archives and
   emits a deterministic, reviewable runtime artifact.
3. Normalize at least:
   - geography kind (`place | county_subdivision`);
   - state abbreviation/FIPS;
   - geography name and GEOID;
   - county FIPS where published;
   - `INTPTLAT`/`INTPTLONG`;
   - source vintage.
4. Record the exact Census functional-status/class allowlist for selectable
   County Subdivisions. Exclude statistical, remainder, unnamed, and
   nonfunctioning units and add an exclusion fixture.
5. Define query normalization and matching for locality name + state. For an
   existing five-digit ZCTA, rank same-state candidates by Haversine distance
   from the ZCTA internal point, followed by a stable
   geography-kind/name/GEOID tie-break. This is ranking only: use no rejection
   threshold and make no containment claim.
6. Define how an accepted user-supplied ZIP is carried into the candidate.
7. Define ambiguity, label, ordering, deduplication, and candidate-limit rules.
8. Preserve a Census full-address fixture for the unchanged address fallback.

The generated artifact may be committed; raw downloaded archives need not be.
The importer must validate required columns, unique source keys, finite US
coordinates, deterministic ordering, and source vintage.

## Contract To Prove

Candidate response gains an additive classification:

```text
result_type: address | locality
```

Locality candidates have `street_address = null`, normalized locality/state,
the Place or County Subdivision internal point, and the supplied ZIP only when
the five-digit ZIP exists in the pinned ZCTA index. Standalone ZCTA rows produce
no candidate.

## Search Routing Contract

- Reject ZIP-only input as a successful empty candidate list without an
  external address-geocoder request.
- Parse a possible trailing state and optional ZIP.
- Search the bundled locality index by normalized name + state.
- Return matching locality candidates without a network call.
- If there is no locality match, call the existing Census oneline address
  geocoder.
- Census address network/HTTP/invalid-response failures remain
  `502 geocoder_unavailable`.
- Missing/corrupt locality data returns HTTP `503` with
  `error_code = "locality_index_unavailable"`, logs the detailed cause, and
  does not call the Census address geocoder.

ZIP/ZCTA use must be documented as distance ranking, not proof of municipal
containment. Query punctuation or digit count alone does not classify a result.

## Phase Boundary

Phase 00 may add the importer, a generated candidate data artifact, fixtures,
and planning evidence. It does not edit production Pydantic/TypeScript response
models. Phase 01 owns backend behavior/test-first changes; Phase 02 owns
frontend test-first changes.

## Likely Files

- `backend/features/project_location/data/`
- `backend/scripts/`
- `backend/tests/fixtures/project_location/geocode/`
- `../decisions.md`
- `../research.md`
- this phase handoff and Phase 01/02 handoffs

## Exit Criteria

- Census source vintage/URLs and refresh command are recorded.
- The generated artifact is deterministic and passes schema/integrity checks.
- Fixtures cover an incorporated Place, West Stockbridge as an eligible County
  Subdivision, an excluded County Subdivision, an ambiguous name, ZIP-ranked
  ordering, ZIP-only input, and no match.
- A standalone ZCTA cannot become a candidate.
- A reviewer can explain how locality city/state/postal fields and coordinates
  are selected.
- The exact additive API field is settled before Phase 01.
- `503 locality_index_unavailable` behavior is frozen for Phase 01 route tests.

## Completed Result

- Pinned the official 2025 national Places, County Subdivisions, and ZCTA
  archive URLs and recorded their SHA-256 hashes in generated metadata.
- Added `backend/scripts/import_census_localities.py`; the default command
  downloads with the repository Python environment's CA bundle, accepts local
  archives/text fixtures, validates schema/keys/coordinates, and writes
  deterministic CSV plus metadata.
- Generated 50,099 selectable locality rows and 33,791 ZCTA ranking rows.
- Froze County Subdivision eligibility at `FUNCSTAT` `A/B/C/G`. The 2025
  Gazetteer does not publish `CLASSFP` in this file, so no name-based class
  inference is used. Places include `A/B/C/G/S` to retain CDPs.
- Froze exact normalized name + state matching, five-candidate limit,
  ambiguity labels, source-key deduplication, Place-before-County-Subdivision
  tie order, and optional-ZIP Haversine ranking in the data README.
- Added deterministic MA/NY/NJ fixtures for West Stockbridge, Hoboken,
  ambiguous Springfield, an excluded statistical County Subdivision, ZCTAs,
  ZIP-only/no-match cases, and a preserved Census address response.
- Kept production Pydantic and TypeScript contracts unchanged as required by
  the Phase 00 boundary.

Verification:

```text
cd backend && uv run pytest tests/test_import_census_localities.py -q
7 passed
cd backend && uv run ruff check scripts/import_census_localities.py tests/test_import_census_localities.py
All checks passed
cd backend && uv run ty check scripts/import_census_localities.py tests/test_import_census_localities.py
All checks passed
```
