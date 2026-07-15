---
DATE: 2026-07-15
TIME: 15:00 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Implement keyless Census locality lookup and preserve address geocoding.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../decisions.md
  - ./phase-00-provider-contract-and-fixtures.md
---

# Phase 01 - Backend Locality Candidates

## Goal

Return normalized, typed candidates from the bundled Census locality index
without breaking the existing Census full-address geocoder.

## Implementation

1. Add the Phase 00 `result_type` classification to Pydantic response models.
   Write backend tests first and observe the expected red assertions.
2. Add a cached, read-only locality repository that loads and validates the
   committed generated artifact.
3. Return a successful empty list for ZIP-only input without calling Census.
   Otherwise parse a possible trailing state and optional ZIP, normalize the
   locality name, and search Place plus eligible County Subdivision rows.
4. Return deterministic ambiguity ordering and labels that expose geography
   type when needed; apply the Phase 00 Haversine-distance ZCTA ranking rule
   when ZIP is supplied.
5. For every locality candidate:
   - set `result_type = "locality"`;
   - set `street_address = None`;
   - use the Census geography name/state and internal-point coordinates;
   - include postal code only under the accepted ZIP qualification rule.
6. When locality lookup has no match, preserve the existing Census oneline
   address request/parser and classify its candidates as `address`.
7. Preserve Census external-failure normalization to
   `502 geocoder_unavailable`. A locality-index integrity error returns
   `503 locality_index_unavailable` and never calls Census.
8. Remove the dormant MapTiler forward-geocoder branch and configuration after
   confirming no active deployment dependency. Do not change Leaflet raster
   tiles.
9. Preserve editor access controls, query length validation, candidate limit,
   and US country restriction.

## Guardrails

- Do not classify by comma count, presence of digits, or ZIP regex alone; a
  locality classification requires an index match.
- Do not use the ZCTA internal point as the canonical town coordinate.
- Do not change saved project-location state in the geocode endpoint.
- Do not remove or rewrite the working Census address path.
- Do not add a runtime geocoding dependency/provider or network data download.

## Tests

- Write the deterministic backend tests specified by the Phase 00 contract,
  confirm the expected failures, then make them green.
- Candidate serialization includes classification and computed
  `full_site_address`.
- Existing editor-only route test remains green.
- Existing Census URL/parse test remains green.
- Place and County Subdivision matches return valid locality candidates.
- Ambiguous same-state names are deterministic; optional ZIP changes ranking
  only under the documented Haversine rule.
- ZIP-only input returns no candidates without an external request.
- Missing/corrupt index fixtures return `503 locality_index_unavailable`.
- `tests/test_project_location.py` saves a locality-only project location and
  verifies editor/public projections keep `street_address = null`, compose
  city/state/postal correctly, and expose no prior street value.

## Verification

```bash
cd backend
uv run pytest tests/test_project_location.py -q
uv run ruff check features/project_location tests/test_project_location.py
uv run ty check features/project_location tests/test_project_location.py
```

## Exit Criteria

- West Stockbridge returns a typed County Subdivision candidate with no street.
- An incorporated Place returns the same normalized locality contract.
- Standalone ZIP/ZCTA input produces no candidate.
- Full-address fixtures retain normalized street fields and use the current
  Census request path.
- Census external failures return `502 geocoder_unavailable`.
- The locality-only editor/public projection regression is green.
- Locality tests require no live provider call or API key.
