---
DATE: 2026-07-15
TIME: 14:27 EDT
STATUS: Accepted for implementation planning
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

**Accepted.** A locality selection saves the geocoder's representative point as
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

Unknown provider result types are skipped or mapped only if Phase 00 establishes
a safe explicit rule. Standalone postal-code-area results are skipped in v1;
postal code remains a normalized component/qualifier of address or locality
results. Query punctuation is not used to guess result type.

## D-PLTS-6 - Never fall back from label to street

**Accepted.** `candidate.label` is presentation text. It must never be used as
`street_address` when the provider returns no street component. Selecting a
locality must also clear an old saved street. Candidate application replaces
the complete street/city/state/postal tuple; provider-null components clear old
values instead of inheriting them from the previous project location.

## D-PLTS-7 - Keep MapTiler primary and Census limited

**Accepted.** MapTiler provides address and locality search when configured.
The keyless Census fallback remains available for structure/street addresses
only. The first implementation adds no new third-party fallback.

The response must expose enough capability metadata for the modal to explain a
street-only fallback accurately. Phase 00 may adjust the exact field name, but
the recommended value is:

```text
search_scope = address_and_locality | street_address_only
```

Configured-provider runtime behavior is also fixed:

- successful MapTiler response, including zero candidates -> return
  `address_and_locality`; do not call Census;
- MapTiler network/HTTP/invalid top-level response -> return HTTP `502` with
  `error_code = "geocoder_unavailable"`; do not silently change search scope;
- malformed individual features -> skip those features; if none remain, return
  an empty `address_and_locality` response;
- no configured MapTiler key -> use Census and return `street_address_only`.

The active Census fallback uses the same `502 geocoder_unavailable` envelope if
its external request fails. `search_scope` exists only on successful geocode
responses.

## D-PLTS-8 - Preserve manual accuracy corrections

**Accepted.** Locality elevation and coordinates are approximate. Existing pin
refinement and manual elevation override remain available, especially where
Phius's 400-foot climate-dataset elevation threshold may be affected. Moving the
pin toward the real site also reduces town-level privacy because the saved
coordinate is public/project-visible. The UI must warn about that tradeoff and
stop labeling a manually moved or directly typed coordinate as town-level in the
current modal session. Selecting a new locality resets the session state to
town-level. Because precision is not persisted, reopening uses neutral saved-
point wording rather than inferring town-level from a null street.

## D-PLTS-9 - Defer persisted accuracy metadata

**Deferred.** A future `location_precision` field with `address`, `locality`, or
`coordinates` values could support durable badges or warnings, but it is not
required to make town-only climate lookup correct. This feature keeps
classification in the geocode candidate/UI flow only.
