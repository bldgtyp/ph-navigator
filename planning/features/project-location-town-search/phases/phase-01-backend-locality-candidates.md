---
DATE: 2026-07-15
TIME: 14:27 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Implement typed address/locality parsing and honest fallback capability.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../decisions.md
  - ./phase-00-provider-contract-and-fixtures.md
---

# Phase 01 - Backend Locality Candidates

## Goal

Return normalized, typed geocoder candidates that distinguish street addresses
from locality-level results without breaking the Census full-address fallback.

## Implementation

1. Add the Phase 00 result classification to Pydantic response models.
   Write/confirm the backend fixture tests first and observe the expected red
   assertions before implementing parser behavior.
2. Split MapTiler parsing into narrow helpers for:
   - result type;
   - coordinates;
   - feature-self vs context hierarchy;
   - normalized address pieces.
3. Map municipality/locality/place equivalents to `locality`; skip standalone
   postal-code-area results in v1.
4. For locality candidates:
   - use the feature's own name as city/locality when appropriate;
   - read state/postal/country from context;
   - set `street_address = None`.
5. Preserve address parsing for structure/street results.
6. Return provider search scope so the frontend can distinguish full service
   from Census street-only fallback.
7. Implement the provider runtime contract from Phase 00: MapTiler zero results
   remain full-scope results; configured-provider failures surface errors; only
   a missing key selects Census.
   Normalize active-provider network/HTTP/invalid top-level failures to
   `502 geocoder_unavailable`; do not leak provider URLs or keys in the response.
8. Preserve editor access controls, query length validation, server-side key
   handling, candidate limit, and US country restriction.

## Guardrails

- Do not classify by comma count, presence of digits, or ZIP regex alone.
- Do not pass unknown provider result types through as addresses.
- Do not change saved project-location state in the geocode endpoint.
- Do not remove the Census fallback.
- Do not add a new geocoding dependency/provider.

## Tests

- Write the fixture-driven backend tests specified by the Phase 00 contract,
  confirm the expected failures, then make them green.
- Candidate serialization includes classification and computed
  `full_site_address`.
- Existing editor-only route test remains green.
- Existing Census URL/parse test remains green.
- Empty/invalid provider features are skipped without producing malformed
  candidates.
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

- MapTiler locality fixture returns a typed candidate with no street.
- Standalone postal-code-area fixture produces no candidate.
- Full-address fixtures retain normalized street fields.
- Census results are explicitly identified as street-address-only capability.
- Configured MapTiler success/zero/failure cases have regression coverage.
- MapTiler and Census external failures return `502 geocoder_unavailable`.
- The locality-only editor/public projection regression is green.
- No live provider call is required by the test suite.
