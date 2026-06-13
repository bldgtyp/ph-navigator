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
  PHPP climate import format; `PHX` / `honeybee-ph` (Ed's own libs,
  already a backend dep via `honeybee-ph`/`ladybug`) very likely
  already read/model PHPP climate. Investigate before writing a parser
  from scratch, and align the standardized schema with the honeybee-ph
  PH-climate model so it round-trips into HBJSON/PHPP export.
