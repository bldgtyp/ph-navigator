---
DATE: 2026-06-21
TIME: -
STATUS: Reference — findings from the 2026-06-21 research pass (5 tracks)
AUTHOR: Ed (via Claude)
SCOPE: External-source findings behind the auto-populate design — geocoding,
  derived-geodata APIs, climate-zone tables, certification proximity rules,
  ASHRAE/EPW access. Each claim carries a confidence note + source.
RELATED:
  - PRD.md §5–6, decisions.md (D-CL-15..19)
---

# Climate Auto-Populate — Research

All five tracks were run as parallel web-research agents on 2026-06-21.
Confidence is noted per finding; verify pricing/ToS before shipping.

## 1. Address-search GUI (#1)

**Recommendation: MapTiler primary, Mapbox fallback, avoid Google.**

- **Google trap (high confidence):** ToS permits caching lat/long only ≤ 30
  days, *or* indefinitely only if "logically isolated to the specific End
  User … not used across multiple End Users." Our coords are typed once and
  read by John + the certifier for years = cross-user reuse → breaks the
  exception. Google also requires results render on a Google map.
- **MapTiler:** §6.4 explicitly permits storing geocoding results; official
  `@maptiler/geocoding-control` + MapLibre; 100k lookups/mo free, cheapest
  paid. Supports drop-a-pin + reverse-geocode for address-less rural sites.
- **Mapbox:** `@mapbox/search-js-react`; no storage prohibition found (verify
  product-terms before shipping — medium confidence).
- **Nominatim/OSM:** public instance bans autocomplete + ~47% US hit rate;
  self-host (Pelias/Photon) is an Elasticsearch ops burden — not worth it now.
- Privacy: any hosted geocoder sees the one-time lookup; only self-host avoids
  that. Pragmatic posture: store precise coords in our private store, vendor
  sees only the lookup.

Sources: cloud.google.com/maps-platform/terms · maptiler.com/terms/cloud ·
docs.mapbox.com/mapbox-search-js · operations.osmfoundation.org/policies/nominatim

## 2. Elevation + county/state (#2–3)

All four recommended APIs are **keyless and server-side**. (high confidence;
endpoints live-tested 2026-06)

- **Elevation — USGS EPQS** primary: `GET epqs.nationalmap.gov/v1/json?x={lon}
  &y={lat}&wkid=4326&units=Meters` → `value`. 1–10 m US resolution. (Old
  `ned.usgs.gov/epqs` retired 2023-03-01.) Fallback **Open-Meteo**
  `api.open-meteo.com/v1/elevation` (90 m; free tier is *non-commercial* — O4).
- **County/state — FCC Area API** primary: `GET geo.fcc.gov/api/census/block/
  find?format=json&latitude={lat}&longitude={lon}` → county+state FIPS + names
  in one flat call. Fallback **US Census Geocoder** (`geographies/coordinates`).
  Federal APIs have no SLA — running both mitigates a single-source outage.

Sources: epqs.nationalmap.gov/v1/docs · open-meteo.com/en/docs/elevation-api ·
geo.fcc.gov/api/census · geocoding.geo.census.gov

## 3. Climate zone (#4)

**Recommendation: lat/long → county FIPS (FCC) → static bundled CSV.** No live
API returns an IECC zone. (high confidence on approach)

- Authoritative source: **PNNL-33270** (2022), *Guide to Determining Climate
  Zone by County: Building America and IECC 2021 Updates*. Download:
  `basc.pnnl.gov/guide-determining-climate-zone-county-data-files` →
  `ClimateZoneDataFiles.zip` (GIS shapefiles; extract the ~3,100-row county
  attribute table once into `[county_fips_5, iecc_zone, ba_zone]` CSV).
  US-gov public domain (verify before redistribution — medium confidence).
- **2021 IECC moved ~10% of counties** (almost all to a warmer/lower zone) vs.
  pre-2021. Use 2021 as the design baseline.
- ASHRAE 169-2020 is aligned with IECC (adopted by reference) but adds a
  station-level table for within-county granularity — relevant only for
  high-relief sites (e.g. Berkshires); county table suffices for NYC-metro/NJ.

Sources: basc.pnnl.gov/guide-determining-climate-zone-county-data-files ·
osti.gov/biblio/1893981

## 4. Phius / PHI certification proximity rules (#5–6) — load-bearing

| | **Phius** (2021 CORE / 2024, WUFI-Passive) | **PHI** (PHPP / EnerPHit) |
| --- | --- | --- |
| Max distance | **≤ 50 linear miles** (published, hard) | none published (qualitative) |
| Max elevation Δ | **≤ 400 ft** (published, hard) | none; PHPP altitude-correction input |
| Logic | both must hold; fail either → custom | certifier judgment: "representative" of microclimate |
| Custom path | Phius generates (Meteonorm), **flat $75**, no interpolation | certifier commissions PHI, "fee to cover costs" (unpublished) |

(high confidence — verbatim from sources below)

- **Phius** Certification Guidebook v25.1.0 §1.4.4.2: *"≤ 50 linear miles …
  ≤ 400' difference in elevation … If no standard climate datasets are
  available within the limits above, a custom data set is required."* Also:
  prescriptive path forbids custom data (outside bounds → performance path
  only); NYC Central Park set valid only within 2 blocks; old v3.02 guidebook
  used ambiguous "and" phrasing — use the current ≤/AND form.
- **PHI** Building Certification Guide (3rd ed., p.24): only PHI-approved sets
  (7-digit ID), *"must match the building location … proximity naturally plays
  a key role"* — judged by **microclimate**, not a radius. Elevation handled
  by PHPP altitude correction. Custom set commissioned via the certifier.
  (Note: "£200/£350" figures online are **BRE** (UK vendor), not PHI Darmstadt.)
- **De-facto:** the elevation bound usually bites before distance (varied
  terrain); Phius's own 2021 audit found ~5% of location/altitude pairings
  needed correction. Settle the set with the certifier early.

Sources: phius.org/climate-data · Phius Certification Guidebook v25.1.0
(§1.4.4.2 PDF) · passivehouse.com/downloads/03_building_certification_guide.pdf
· klimadaten.passiv.de

## 5. ASHRAE-meteo + EPW access (#7–8)

**ASHRAE design conditions (ashrae-meteo.info v3.0):** no official API; two
reverse-engineered JSON POST endpoints work (validated by the older
`mj-hahn/ashrae-meteo` tool): `request_places.php` (nearest by lat/long,
`ashrae_version` ∈ 2009/2013/2017/2021/2025) and `request_meteo_parametres.php`
(full design-condition blob by WMO; strip the UTF-8 BOM before JSON parse).
Returns Htg 99.6/99 DB, Clg 0.4/1/2% DB+MCWB, dehum DP + MCDB, extremes.
**Licensing:** underlying data is copyrighted ASHRAE Handbook Ch.14, no site
ToS. Posture: real-time single-station per-project = low/moderate risk; bulk
local DB = high risk → don't. (high confidence on mechanics; medium on legal)

**EPW (climate.onebuilding.org / epwmap):** no single global index — merge the
6 per-WMO-region XLSX catalogs (name, lat/lon, direct zip URL; ~17,315
stations) → haversine → download zip → `.epw` + `.stat`. The **`.stat` file is
the linchpin:** contains ASHRAE design conditions (**2009 edition** when WMO
matches), HDD/CDD (base 10 °C and 18 °C, computed from hourly → HDD65 ≈ base
18 °C, CDD50 = base 10 °C), and record extremes. EPW/.stat are freely
redistributable by community consensus (NOAA ISD public domain + ERA5 with
attribution) → **cacheable per-project** (attribute onebuilding + Lawrie/
Crawley). (high confidence on formats; medium on licensing)

**Architecture:** local station catalog (merged XLSX → SQLite/Parquet, refresh
periodically — O7) → haversine nearest → cache `.epw`+`.stat` per project →
parse `.stat` for the common (2009-OK) case → live ashrae-meteo only when
current-edition is required.

Sources: ashrae-meteo.info/v3.0 · github.com/mj-hahn/ashrae-meteo ·
climate.onebuilding.org · ladybug.tools/epwmap · github.com/MingboPeng/GetOneBuildingEPW
