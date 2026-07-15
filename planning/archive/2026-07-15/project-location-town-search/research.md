---
DATE: 2026-07-15
TIME: 15:00 EDT
STATUS: Complete
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
- `geocode_address(...)` contains a dormant optional MapTiler branch, but the
  deployed/default configuration leaves `MAPTILER_API_KEY` empty.
- The active keyless path calls Census `locations/onelineaddress`.
- The geocode candidate has no address/locality result classification.

## Provider Findings

### Census Address Geocoder

Official Census documentation requires structure number and street name; city,
state, and ZIP are optional address qualifiers:

- https://www.census.gov/data/developers/data-sets/Geocoding-services.html
- https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html

Review-time local calls confirmed that town/state/ZIP queries returned no
candidates through the keyless Census address path. It remains suitable for the
existing full-address behavior but is not a locality lookup service.

### Census Gazetteer Files

The official 2025 Gazetteer release supplies small national, pipe-delimited
files for Places, County Subdivisions, and ZIP Code Tabulation Areas:

- https://www.census.gov/geographies/reference-files/2025/geo/gazetter-file.html
- https://www.census.gov/programs-surveys/geography/technical-documentation/records-layout/gaz-record-layouts.2025.html

Relevant fields include state abbreviation/FIPS, geography name/GEOID, and
`INTPTLAT`/`INTPTLONG`. The internal point is the correct representative
coordinate for this feature, but it must not be described as a guaranteed
mathematical centroid.

National Places covers incorporated places and Census Designated Places. County
Subdivisions is also required because legal towns in New England, including
West Stockbridge, are represented as minor civil divisions rather than Census
Places. The importer must filter functional-status/class codes so statistical,
remainder, unnamed, and nonfunctioning units are not presented as towns. ZCTA
data can distance-rank a supplied ZIP, but a ZCTA point must not replace the
selected locality point, imply containment, or create a ZIP-only result.

The compressed national files are small enough to support a committed,
normalized runtime artifact. A reproducible importer should pin the vintage and
source URLs, validate required columns/coordinates, and generate the artifact;
runtime search should not depend on Census network availability.

### MapTiler Rejected for This Feature

Production and environment documentation intentionally leave
`MAPTILER_API_KEY` unset. Adding an operational secret and commercial-provider
dependency is unnecessary when Census publishes the required representative
points. The optional MapTiler geocoder branch should be retired during
implementation after deployment-use confirmation. This does not affect the
Leaflet map, which already uses keyless raster tile URLs.

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
| Places omit a legal New England town | Index both Places and County Subdivisions |
| Census vintage changes | Pin source vintage and regenerate through a documented importer |
| Duplicate locality names in one state | Return multiple typed candidates; use deterministic labels/ties and optional ZCTA distance ranking |
| ZIP is treated as a town center or containment proof | Use ZCTA only for distance ranking; retain locality internal point |
| Internal point is called an exact centroid/site | Use explicit approximate/internal-point UI copy |
| Existing street survives mode switch | Locality application explicitly writes empty/null street |
| Bundled artifact is missing/corrupt | Validate required columns, row uniqueness, and coordinate ranges; fail visibly |
| Town-center elevation affects Phius proximity | Keep manual elevation override and locality approximation note |
| Pin refinement reveals a more exact site | Warn that saved coordinates are shown; stop calling a moved pin town-level |
| Full-address regression | Maintain address fixtures and end-to-end save assertions |

## Documentation Drift Found During Review

`context/technical-requirements/api.md` describes MapTiler configuration and an
unconfigured-key error, while current production documentation and runtime use
the Census fallback. Phase 03 must document the final split clearly: bundled
Census Gazetteer locality lookup plus live Census street-address lookup, with no
MapTiler requirement.
