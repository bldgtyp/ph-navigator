# Census locality index

`census_localities_2025.csv` and `census_zctas_2025.csv` are deterministic
runtime artifacts generated from the official 2025 national U.S. Census
Gazetteer archives. Runtime requests read these files; they do not download
Gazetteer data.

Regenerate from `backend/`:

```bash
uv run python -m scripts.import_census_localities
```

The pinned URLs, source SHA-256 hashes, output hashes, row counts, schema
version, and functional-status allowlists are recorded in
`census_localities_2025.metadata.json`.

## Source and selection contract

- Places: active incorporated Places plus Census-designated Places
  (`FUNCSTAT` `A`, `B`, `C`, `G`, or `S`).
- County Subdivisions: functioning legal governments only (`FUNCSTAT` `A`,
  `B`, `C`, or `G`). Statistical, fictitious, inactive, and nonfunctioning
  County Subdivisions are excluded.
- ZCTAs: ranking references only. They never become locality candidates.

The 2025 Gazetteer County Subdivision file exposes `FUNCSTAT`, but not
`CLASSFP`. Eligibility therefore uses the Census functional-status definition
directly rather than inferring class from the geography name.

## Runtime matching contract

The Phase 01 loader/search service must enforce these rules:

1. Match an exact normalized locality name plus two-letter state. Normalization
   is accent-insensitive, case-insensitive, and collapses punctuation and
   whitespace.
2. Return at most five candidates. Distinct Place and County Subdivision GEOIDs
   are not cross-deduplicated; ambiguity is real and must remain visible.
3. Without ZIP, sort by geography kind (`place`, then
   `county_subdivision`), display name, and GEOID.
4. When a supplied five-digit ZIP exists in the ZCTA index, first rank by
   Haversine distance from its internal point, then apply the stable ordering
   above. The selected coordinate remains the locality internal point.
5. Carry the supplied ZIP into candidates only when it exists in the bundled
   ZCTA index. ZIP-only input returns no candidates.
6. Candidate city is `name`; state is `state`; street is null; country is
   `US`. The default label is `Name, ST` with an accepted ZIP appended. When
   multiple rows match, append a user-readable `Place` or `Town / county
   subdivision` qualifier.
7. Duplicate `(kind, GEOID)` source keys, invalid coordinates, missing columns,
   or metadata/artifact integrity failures are fatal. The API maps a bundled
   index failure to `503 locality_index_unavailable` without trying the live
   address geocoder.

`INTPTLAT`/`INTPTLONG` are representative Census internal points. They are not
mathematical centroids, project sites, or proof that a ZIP is contained by a
municipality.
