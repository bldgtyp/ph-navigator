---
DATE: 2026-07-15
TIME: 15:00 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Decisions for Project Location address-or-town search.
RELATED:
  - ./PRD.md
  - ./PLAN.md
  - ./research.md
---

# Decisions - Project Location Town Search

## D-PLTS-1 - Support address and locality input

**Accepted.** The same explicit-submit search accepts full addresses and
town/locality queries. ZIP is useful but not required when town + state resolves
unambiguously.

## D-PLTS-2 - Persist one canonical coordinate pair

**Accepted.** A locality selection saves the Census locality internal point as
the project's canonical coordinates. This feature does not retain hidden exact
site coordinates or create separate public/private coordinates.

## D-PLTS-3 - Reuse the existing address columns

**Accepted.** No schema migration is required. Locality results persist
`street_address = null` plus city/state/available postal code. Existing
`full_site_address` composition remains authoritative.

## D-PLTS-4 - Separate query text from persisted street

**Accepted.** The modal owns a display/search query independent of
`ProjectLocationFormValues.siteAddress`. The query may be a full formatted
label; only normalized candidate fields enter the persisted form.

## D-PLTS-5 - Add typed candidate semantics

**Accepted.** Geocode candidates gain an additive result classification:

```text
address | locality
```

Locality candidates are created only from the normalized Census locality index;
Census oneline results remain address candidates. Standalone postal-code-area
results are skipped in v1; postal code remains a normalized component/qualifier
of address or locality results. Query punctuation alone is not used to guess
result type.

## D-PLTS-6 - Never fall back from label to street

**Accepted.** `candidate.label` is presentation text. It must never be used as
`street_address` when a candidate has no street component. Selecting a
locality must also clear an old saved street. Candidate application replaces
the complete street/city/state/postal tuple; candidate-null components clear old
values instead of inheriting them from the previous project location.

## D-PLTS-7 - Use a keyless Census split

**Accepted.** Locality search uses a versioned repository index derived from the
official Census Gazetteer. It includes national Places and County Subdivisions;
the latter is required for New England legal towns. It uses `INTPTLAT` and
`INTPTLONG` as representative points and labels them as approximate Census
internal points, not mathematical centroids.

The existing Census oneline address geocoder remains the full-street-address
path. Search routing is deterministic:

- parse a possible trailing state and optional ZIP, then query the local
  locality index by normalized locality name + state;
- when locality candidates exist, return them without a network call;
- when no locality candidate exists, call the existing Census address geocoder;
- an external Census address failure returns HTTP `502` with
  `error_code = "geocoder_unavailable"`.

No `search_scope` response field is required because locality capability does
not vary with deployment configuration. No `MAPTILER_API_KEY` is required.

## D-PLTS-8 - Treat ZIP as a locality qualifier

**Accepted.** The optional ZIP is not the canonical town coordinate. If the
five-digit ZIP exists in the bundled ZCTA Gazetteer, rank same-state locality
candidates by Haversine distance from the ZCTA internal point, then apply the
stable geography-kind/name/GEOID tie-break. Do not reject a locality by an
arbitrary distance threshold and do not claim municipal containment. The
selected coordinate remains the Place or County Subdivision internal point;
the accepted query ZIP may be returned as a user-supplied qualifier.

A ZIP-only query returns an empty candidate list without calling the Census
address geocoder. The UI does not offer a ZIP-only candidate.

## D-PLTS-9 - Preserve manual accuracy corrections

**Accepted.** Locality elevation and coordinates are approximate. Existing pin
refinement and manual elevation override remain available, especially where
Phius's 400-foot climate-dataset elevation threshold may be affected. Moving the
pin toward the real site also reduces town-level privacy because the saved
coordinate is public/project-visible. The UI must warn about that tradeoff and
stop labeling a manually moved or directly typed coordinate as town-level in the
current modal session. Selecting a new locality resets the session state to
town-level. Because precision is not persisted, reopening uses neutral saved-
point wording rather than inferring town-level from a null street.

## D-PLTS-10 - Version and reproduce the locality index

**Accepted.** Runtime requests do not download Census data. Implementation adds
a committed normalized data artifact plus a reproducible importer/refresh path,
records the Census vintage and source URLs, validates required columns and
coordinate ranges, and covers representative Place and County Subdivision rows.
The County Subdivision importer must use an explicit allowlist of Census
functional-status/class codes for functioning legal/locality geographies and
exclude statistical, remainder, unnamed, and nonfunctioning units; Phase 00
records the exact codes from the pinned Census definitions.

If the bundled locality artifact is missing or fails integrity validation, the
geocode endpoint returns HTTP `503` with
`error_code = "locality_index_unavailable"`, logs the detailed cause, and does
not fall through to the Census address geocoder.

## D-PLTS-11 - Retire the dormant MapTiler geocoder path

**Accepted.** The unused optional MapTiler forward-geocoder branch and its
configuration should be removed during Phase 01 after confirming there is no
active deployment dependency. Keyless raster map tiles are unrelated and remain
unchanged.

## D-PLTS-12 - Defer persisted accuracy metadata

**Deferred.** A future `location_precision` field with `address`, `locality`, or
`coordinates` values could support durable badges or warnings, but it is not
required to make town-only climate lookup correct. This feature keeps
classification in the geocode candidate/UI flow only.
