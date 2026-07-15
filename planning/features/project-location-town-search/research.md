---
DATE: 2026-07-15
TIME: 14:27 EDT
STATUS: Review complete
AUTHOR: Codex
SCOPE: Current-code and provider findings behind the town-search plan.
RELATED:
  - ./PRD.md
  - ./decisions.md
  - ./PLAN.md
  - planning/archive/dated/2026-06-22/climate-auto-populate/research.md
---

# Research - Project Location Town Search

## Current Frontend Flow

- `SetLocationModal.tsx` sends `values.siteAddress` as the full geocoder query.
- The input is bound directly to the persisted `siteAddress` form value.
- Empty results explicitly say a full street address is required.
- `applyGeocodeCandidateToLocationValues(...)` writes
  `candidate.street_address ?? candidate.label` into `siteAddress`.

Consequence: a correctly streetless locality candidate would still become a
false street address in the frontend.

## Current Backend Flow

- `POST /api/v1/projects/{id}/location/geocode` is editor-only.
- `geocode_address(...)` uses MapTiler when `MAPTILER_API_KEY` is configured.
- Without the key it calls Census `locations/onelineaddress`.
- The MapTiler parser reads context IDs but does not inspect `place_type`.
- The geocode candidate has no address/locality result classification.

## Provider Findings

### MapTiler

Official forward-geocoding documentation says the query may be a place name and
lists municipality, locality, place, postal code, and address result types:

- https://docs.maptiler.com/cloud/api/geocoding/

This is sufficient for town-level search, subject to Phase 00 fixtures confirming
the exact response shape returned by the configured production service.

### Census

Official Census documentation requires structure number and street name; city,
state, and ZIP are optional address qualifiers:

- https://www.census.gov/data/developers/data-sets/Geocoding-services.html
- https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html

Review-time local calls confirmed that town/state/ZIP queries returned no
candidates through the keyless Census fallback. It should not be represented as
a locality provider.

## Existing Storage and Privacy Support

- `project_location` already stores nullable `street_address`, `city`, `state`,
  and `postal_code` separately.
- `compose_full_site_address(...)` already produces `City, ST ZIP` when street
  is absent.
- Existing backend coverage confirms the public projection omits street while
  preserving city/state/postal display.
- No migration is necessary for a town-only location.

## Downstream Consumers

- Climate dataset rosters require latitude/longitude and optionally use state
  for the default region filter.
- Weather roster and ASHRAE lookup use the saved coordinate pair.
- The Climate location map reads the saved coordinate pair.
- County/state, elevation, and IECC climate zone are derived from coordinates.

No downstream consumer requires `street_address`.

## Risks and Controls

| Risk | Control |
|---|---|
| Locality label saved as street | Separate `searchQuery`; remove label-to-street fallback |
| Provider hierarchy parsed incorrectly | Fixture-driven `place_type` parsing |
| Existing street survives mode switch | Locality application explicitly writes empty/null street |
| Census fallback appears to support towns | Add response search-scope metadata and accurate UI copy |
| Town-center elevation affects Phius proximity | Keep manual elevation override and locality approximation note |
| Pin refinement reveals a more exact site | Warn that saved coordinates are shown; stop calling a moved pin town-level |
| Live-provider drift breaks tests | Commit sanitized response fixtures; mock all automated calls |
| Full-address regression | Maintain address fixtures and end-to-end save assertions |

## Documentation Drift Found During Review

`context/technical-requirements/api.md` says an unconfigured MapTiler key returns
`503 geocoder_not_configured`, while current code falls back to Census. Phase 03
must reconcile that contract with the implemented provider behavior.
