---
DATE: 2026-07-15
TIME: 15:00 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Product contract for address-or-town Project Location search.
RELATED:
  - ./README.md
  - ./PLAN.md
  - ./STATUS.md
  - ./decisions.md
  - ./research.md
---

# PRD - Project Location Town Search

## Problem

The Set Project Location modal currently presents full street address search as
the only geocoded path. Some clients do not want their street address or a
street-level map pin associated with the project. Town-level resolution is
sufficient for selecting nearby climate datasets and weather stations.

The current implementation also conflates two different values:

- the free-form geocoder query shown in the modal, and
- the persisted `street_address` field.

That conflation would cause a locality candidate label to be saved as though it
were a street address.

## User Story

As a project editor, I can enter `West Stockbridge, MA 01266`, select the town
result, see the map pin move to the Census representative point, and save
the location without storing a street address.

## Definitions

- **Address result**: a geocoder result representing a street or structure
  address.
- **Locality result**: a municipality, locality, place, or equivalent populated
  place result.
- **Locality internal point**: the representative point published in the U.S.
  Census Gazetteer. It is not promised to be the mathematical centroid or the
  actual project site.
- **Search query**: modal-local text sent to the geocoder; it is not itself a
  stored address field.

## Desired Behavior

- The search accepts full address, town + state, and town + state + ZIP inputs.
- The UI says `Address or town` and provides examples for both modes.
- Candidate rows make address vs town-level results understandable without
  exposing Census geography jargon.
- Selecting an address result sets coordinates plus normalized street, city,
  state, and postal fields.
- Selecting a locality result sets coordinates plus normalized city, state, and
  postal fields and explicitly clears `street_address`.
- Selecting any candidate replaces the complete stored address-component tuple;
  a component absent from the new candidate clears the old value rather than
  inheriting stale city/state/postal data from the previous location.
- The selected candidate label remains visible as search/display text without
  being copied into `street_address`.
- Existing saved address locations can be replaced by a locality result; the
  old street must not survive that transition.
- Existing full-address behavior remains supported.
- Manual coordinate entry, map pin refinement, elevation override, and reset-to-
  auto behavior remain available.
- A standalone postal-code-area result is not selectable in v1. ZIP/postal code
  remains an input qualifier and normalized address component, not a third
  location mode.

## Privacy Contract

- Town-only mode stores town-level coordinates as the canonical project
  coordinates; it does not secretly retain a precise address coordinate.
- `street_address` is null for a locality selection.
- `full_site_address` may contain city/state/postal information.
- The existing public/viewer projection continues to omit `street_address`.
- This feature does not create separate public and private coordinate pairs.
- Pin refinement or manual coordinate entry can move the saved/public point
  toward the actual site and therefore reduce the privacy benefit. The modal
  must say this plainly; clients seeking town-level privacy should retain the
  locality point.
- After a pin is manually moved or latitude/longitude is directly edited in the
  current modal session, the UI must stop describing that point as town-level.
  Selecting a new locality candidate resets the session state to town-level.
  Persisting that distinction across reopen remains outside v1 because location
  precision is not stored; reopened saved data uses neutral `Saved project
  point` wording until the editor selects a new result.

## Climate and Passive-House Behavior

- Climate and weather-source proximity continue to use saved latitude and
  longitude.
- County/state and IECC climate zone continue to be derived from those
  coordinates.
- Elevation auto-fill runs at the saved locality point. In high-relief terrain,
  this may not represent the site elevation closely enough for the Phius
  400-foot climate-dataset elevation criterion.
- Editors retain the ability to enter actual site elevation or refine the pin
  without storing a street address.
- Selecting or saving a location does not automatically attach or replace a
  climate source.

## Acceptance Criteria

1. `West Stockbridge, MA 01266` returns and applies a locality candidate without
   any MapTiler or other runtime API key.
2. A locality candidate persists coordinates, city, state, and available postal
   code with `street_address = null`.
3. Replacing an existing full address with a locality clears the old street.
   Missing locality components also clear any stale values from the old address.
4. A full address still persists normalized street/city/state/postal data.
5. The modal search box displays the selected locality label after selection.
6. Reopening a town-only location displays useful city/state/postal search text,
   not an empty field or a fake street.
7. Zero-result copy supports both search modes without implying that a street
   number is required.
8. Climate roster and map consumers continue to work from the saved coordinates.
9. Public/viewer output contains no street address for either input mode.
10. Focused backend/frontend tests and live browser verification pass.
11. A locality lookup is served from the bundled Census-derived index and does
    not require network access. Census address-geocoder failure returns
    `502 geocoder_unavailable` only when the request reaches the address path.
12. Standalone postal-code-area results are not offered as selectable
    candidates.
13. Pin movement and direct coordinate edits switch the current modal to custom-
    point privacy copy; selecting a new locality restores town-level copy.

## Non-Goals

- No Google Maps or Google Geocoding integration.
- No MapTiler dependency or new commercial geocoding provider.
- No geocoder autocomplete redesign; search remains explicit-submit.
- No ZIP-only or postal-area location mode.
- No database migration solely to label a location as approximate.
- No separate private exact coordinate and public generalized coordinate.
- No change to climate-station selection thresholds or certification rules.
- No automatic lookup of the client's true site elevation from a hidden address.

## Product Copy Direction

- Modal label: `Address or town`
- Placeholder: `123 Main St, City, ST — or City, ST ZIP`
- Subtitle: explain that a town result uses an approximate town-level point for
  privacy and climate lookup.
- Locality selection note: `Town-level location — refine the pin or elevation if
  site-specific accuracy is needed.`
- Pin-refinement note: `A refined pin is saved and shown on the project map; do
  not place it at the exact site if town-level privacy is required.`

Exact wording may be tightened during Phase 02, but it must not imply that a
Census internal point is the actual site or guaranteed geographic centroid.
