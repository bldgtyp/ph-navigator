---
DATE: 2026-06-13
TIME: -
STATUS: Reference — findings from the example datasets Ed provided.
AUTHOR: Claude (for Ed)
SCOPE: What the Phius and PHI climate example data actually contain;
  basis for the standardized climate format (PRD §4).
RELATED:
  - PRD.md §4 (standardized format)
  - decisions.md D-CL-8 (reference datasets)
  - example_data/phius_2022_climate_data/
  - example_data/phi_phpp_10_6_climate_data/phi_phpp_10_6_climate_data.xlsx
---

# Climate example-data findings

## Both sources are the canonical PHPP/PH monthly climate format

The Phius and PHI datasets are the **same conceptual record** — the
PHPP monthly climate shape. Phius ships it as per-station tab-delimited
text; PHI ships it as a PHPP "Climate" worksheet. One standardized
internal format covers both (and EPW-derived + custom).

## Phius 2022 (`phius_2022_climate_data/`)

- **1007 US station files**, `USA/<STATE>/<STATION>-mon.txt`,
  tab-delimited, cp1252-ish encoding with some German PHPP labels.
- One station file (full shape, Jan…Dec + 3 design columns = Heating
  load 1 / Heating load 2 / Cooling load):
  - Header: name, `Latitude`, `Longitude`, `Height a.s.l. (m)`,
    `Daily temperature variation summer (K)`.
  - `Temperature outdoor` — 12 monthly °C + 3 design temps.
  - Radiation `North / East / South / West / Global` — 12 monthly
    (kWh/m²·mo, PHPP convention) + 3 design.
  - `Dewpoint` — 12 monthly + 3 design.
  - `Sky temperature` — 12 monthly + 3 design (+ design-period labels).
  - `Heating degree-hours (12/20)`, `Cooling degree-hours (24)`.
  - `Wind speed` Jan / Jul (m/s).
  - `12-h Temperature min` (°C); two summer night-hours fractions (%).
  - `Albedo` (= 0.2).

## PHI PHPP 10.6 (`phi_phpp_10_6_climate_data.xlsx`)

- xlsx with a `Climate` sheet (~1474 rows, 6.4 MB sheet) — the PHPP
  climate database: country / region / climate zone / weather station,
  lat/long/altitude, the same monthly climate quantities, plus
  PHPP-specific extras (PER factors, interpolation) we do **not** need.
- Same monthly PH climate shape as Phius; just packaged differently and
  with German labels.

## Implications for design

- **One standardized format** (PRD §4) normalizes all sources:
  Phius txt, PHI xlsx, EPW-derived, ASHRAE, custom.
- **Small per location** — 12 monthly points × a handful of fields +
  design columns ≈ 1–2 KB/location. Phius (1007) + PHI (~1400) ≈ a few
  thousand locations, a few MB total. App-wide reference, not
  per-project.
- **Reuse PH-Tools parsing (D-CL-10).** The `-mon.txt` shape IS the
  PHPP climate import format; `PHX` / `honeybee-ph` already read/model
  PHPP climate. Investigation findings below.

## PH-Tools reuse investigation (D-CL-10, 2026-06-13)

Read the installed/source PH-Tools libs. The PH climate record is
**already modeled three ways** — all Ed's own libraries:

### 1. `honeybee_ph/honeybee_ph/site.py` — the HBJSON-native model (alignment target)
`Site = { location: Location, climate: Climate, phpp_library_codes: PHPPCodes }`,
with `to_dict()` / `from_dict()` (so it round-trips into HBJSON, and via
`PHX` into PHPP/WUFI). Structure maps **1:1** to the example data:
- `Location`: `latitude`, `longitude`, `site_elevation`, `climate_zone`
  (int, ASHRAE), `hours_from_UTC` (int — the numeric UTC offset the
  sun-path service needs).
- `Climate`: `station_elevation` (m), `summer_daily_temperature_swing`
  (K), `average_wind_speed` (m/s), `ground` (`Climate_Ground`),
  `monthly_temps`, `monthly_radiation`, `peak_loads`.
- `Climate_MonthlyTempCollection`: `air_temps`, `dewpoints`, `sky_temps`,
  `ground_temps` — each a `Climate_MonthlyValueSet` of 12 (°C).
- `Climate_MonthlyRadiationCollection`: `north`, `east`, `south`, `west`,
  `glob` — each 12 (kWh/m²).
- `Climate_PeakLoadCollection`: `heat_load_1`, `heat_load_2`,
  `cooling_load_1`, `cooling_load_2` — each a `Climate_PeakLoadValueSet`
  `{ temp (°C), rad_north/east/south/west/global (W/m²), dewpoint,
  sky_temp, ground_temp }`.
- `Climate_Ground`: conductivity / heat-capacity / density /
  depth_groundwater / flow_rate.
- `PHPPCodes`: `country_code`, `region_code`, `dataset_name` — exactly
  the "select a PHPP/PHI location from a dropdown" identity (D-CL-4/8).
- Every class also has `display_name`, `identifier`, `user_data` (base).

**Caveat:** honeybee_ph is Python-2.7 / IronPython-compatible (type
*comments*, old-style classes). Use it at runtime via its
`to_dict()`/`from_dict()` for round-trip, but **do not subclass** our
Pydantic models from it — mirror the dict shape and provide
`from_honeybee_ph_site()` / `to_honeybee_ph_site()` adapters.

### 2. `PHX/PHX/model/phx_site.py` — the export model
`PhxClimate` with flat 12-element lists (`temperature_air`,
`temperature_dewpoint`, `temperature_sky`,
`radiation_north/east/south/west/global`), `daily_temp_swing`,
`station_elevation`, `monthly_hours`, and `peak_heating_1/2`,
`peak_cooling_1/2` (`PhxClimatePeakLoad`). Confirms the **4 design
conditions** (htg1/htg2/clg1/clg2) and the 12-element monthly arrays.

### 3. `PHX/PHX/to_METr_JSON/` — WUFI/METr JSON exporter
Packs **16-element** arrays (12 monthly + 4 peak loads at positions
12–15) under keys `TMo` / `dewPMo` / `skyTMo` / `nRadMo` / `eRadMo` /
`sRadMo` / `wRadMo` / `gRadMo`, `lat`, `hNN`. The WUFI serialization
convention; useful precedent, not our storage shape.

### Reusable reader for the PHI xlsx
`PHX/PHX/PHPP/sheet_io/io_climate.py` (`class Climate`) already reads
the PHPP **Climate worksheet** — `read_active_country/region/data_set`,
`read_station_elevation`, `read_site_elevation`,
`read_latitude/longitude`, `read_active_monthly_data()`. The PHI example
xlsx **is** a PHPP Climate worksheet, so this is a direct reference (and
possibly reusable) for the PHI seed importer. The Phius `-mon.txt` has
**no** existing reader, but maps field-for-field onto the same `Climate`
+ peak-load structure — a thin custom parser.

### Units confirmed (all SI — matches our wire convention)
Monthly radiation kWh/m²; peak-load radiation W/m²; temps °C; elevation
m; wind m/s; daily swing K. The Phius `-mon.txt` had 3 design columns
(Heating load 1 / 2 / Cooling load) → maps to `heat_load_1`/`heat_load_2`/
`cooling_load_1` (cooling_2 empty); PHI/PHPP may populate all 4.

### Decision (resolved D-CL-10)
**Mirror `honeybee_ph.site` as the canonical `ClimateRecord`** (so it
round-trips to HBJSON/PHX/PHPP/WUFI), add an `aux` extension block for
the source fields honeybee_ph omits (degree-hours, Jan/Jul wind, albedo,
12-h min, summer night fractions — honeybee_ph would put these in
`user_data`), provide adapters (not subclassing), reuse `io_climate.py`
for the PHI seed, and write a thin parser for the Phius `-mon.txt`.
