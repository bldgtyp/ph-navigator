---
DATE: 2026-07-15
TIME: 14:27 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Freeze geocoder result semantics and capture sanitized provider fixtures.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../decisions.md
  - ../research.md
---

# Phase 00 - Provider Contract and Fixtures

## Goal

Establish a provider-independent candidate contract before changing production
parsing, models, or modal behavior. Phase 00 is fixture/contract work only.

## Investigation

1. Capture sanitized MapTiler responses for:
   - a full US street address;
   - a municipality/locality/place query such as `West Stockbridge, MA 01266`;
   - a postal-code result that v1 will explicitly skip;
   - an ambiguous place name producing multiple candidates.
2. Confirm stable fields for type, label, coordinates, city, state, postal code,
   and country.
3. Confirm whether `geometry.coordinates` or `center` is the stable point field.
4. Preserve a Census full-address fixture and a no-match locality fixture.

Do not commit API keys, raw request headers, account identifiers, or provider
usage metadata.

## Contract To Prove

Candidate response gains an additive classification:

```text
result_type: address | locality
```

Geocode response also reports provider capability. Recommended shape:

```text
search_scope: address_and_locality | street_address_only
```

Phase 00 may rename these fields if an existing repo convention is better, but
must preserve the semantics recorded in `../decisions.md`. Standalone
postal-code-area features produce no candidate.

## Provider Runtime Contract

- configured MapTiler success, including zero candidates, retains
  `address_and_locality` scope and does not call Census;
- configured MapTiler network/HTTP/invalid top-level failure returns
  `502 geocoder_unavailable`;
- malformed individual features are skipped;
- absent MapTiler key selects Census with `street_address_only` scope.
- active Census request failure also returns `502 geocoder_unavailable`.

Record this contract in `../decisions.md` if Phase 00 evidence requires wording
changes. Do not silently introduce configured-provider fallback.

## Phase Boundary

Phase 00 may add committed sanitized fixture JSON and planning evidence. It does
not edit production Pydantic/TypeScript models and does not need compiling red
tests. Phase 01 owns backend test-first changes; Phase 02 owns frontend
test-first changes.

## Likely Files

- `backend/tests/fixtures/project_location/geocode/`
- `planning/features/project-location-town-search/decisions.md`
- `planning/features/project-location-town-search/research.md`
- this phase handoff and Phase 01/02 handoffs

## Exit Criteria

- Sanitized fixtures cover address and locality result shapes.
- The postal-code fixture is explicitly classified as non-selectable v1 input.
- A reviewer can explain how locality city/state/postal fields are selected.
- The exact additive API fields are settled before Phase 01.
- An authorized MapTiler environment is identified for final live smoke, or the
  operational prerequisite is explicitly marked blocked.
