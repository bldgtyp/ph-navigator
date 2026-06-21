---
DATE: 2026-06-21
TIME: -
STATUS: Planned
AUTHOR: Ed (via Claude)
SCOPE: P3 — find the nearest EPW + ASHRAE design conditions and cache the
  certification-load-bearing values per project (#7–8). Reactivates the
  archived "design-conditions" Phase 4.
RELATED:
  - ../PRD.md §5 (#7–8), §4.1 (licensing), ../decisions.md (D-CL-18)
  - ../research.md §5 (access mechanics + licensing)
  - planning/archive/climate/phases/phase-04-design-conditions-and-metrics.md
  - backend/features/project_climate_source/ (cache in `data` JSONB)
---

# Phase 3 — ASHRAE + EPW pulls / design conditions

The heaviest external integration, and the home of the deferred per-source
design-conditions work (archived D-CL-11 / Phase 4).

## Goal

From the project coordinates, find the nearest **EPW** and the nearest
**ASHRAE** design-conditions station, and **cache** the small load-bearing
value-sets per project (three-tier store rule, D-CL-14), honoring the
licensing posture (PRD §4.1).

## Scope

1. **EPW catalog + fetch (#8).** Build/refresh a station catalog by merging
   the 6 per-WMO-region XLSX indices from climate.onebuilding.org (name,
   lat/lon, direct zip URL; ~17k stations) into a queryable table (O7:
   refresh cadence/storage). Haversine-nearest → download zip → store `.epw`
   bytes (existing EPW asset path) + the `.stat` companion.
2. **`.stat` parse.** Extract HDD65 (≈ base 18 °C), CDD50 (= base 10 °C),
   record high/low, and the **2009-edition ASHRAE design conditions** the
   `.stat` already carries. Cache in `project_climate_source.data` +
   `fetched_at`. Flag any missing field.
3. **ASHRAE current-edition (#7), on demand (D-CL-18).** When a project needs
   2021/2025 values, call ashrae-meteo.info (`request_places.php` →
   `request_meteo_parametres.php`, strip BOM) for the **single** nearest
   station; cache that one value-set per project. **Never bulk-cache** the
   copyrighted tables. Default path uses the free `.stat` 2009 set.
4. **Design-conditions shape.** ASHRAE design conditions are a *different*
   shape from `ClimateRecord.peak_loads` — define a small, explicit,
   source-parameterized value-set (Htg 99.6/99 DB, Clg 1% DB/MCWB, DP 1%/MCDB
   …) stored in `data`, with the `basis`/edition named for audit (the archived
   Phase-4 contract).

## Reuse

- The `project_location` EPW asset store + `project_climate_source.data`.
- `ladybug-core` for EPW parsing if needed (already a backend dep; archived
  D-PL-3).

## New work

- `epw_catalog.py` (merge/refresh + nearest), `stat_parser.py`,
  `ashrae_meteo.py` client, and the design-conditions value-set model.

## Relationship to deferred features (D-CL-25)

This phase is the **EPW-metrics + design-conditions production layer** absorbed
from the deferred `climate-design-conditions` (whose consumer-facing contract
endpoint stays deferred until an fRSI/comfort consumer exists). It is also the
shared **EPW-parsing substrate** for the deferred `climate-rain-exposure`;
optionally capture annual rainfall during the `.stat`/EPW parse to de-risk that
feature's RX-1 — though its rainfall-source question stays open.

## Tests

- pytest: `.stat` parser against a checked-in **synthetic** sample (no
  licensed data committed — public-repo rule); HDD/CDD/extreme extraction;
  ashrae-meteo client against a recorded fixture (BOM strip, field mapping);
  missing-field flags; nearest-EPW haversine.
- `make ci` green.

## Exit criteria

Nearest EPW stored with `.stat`-derived metrics + 2009 ASHRAE conditions
cached; on-demand current-edition pull works for a single station;
missing-field flags; licensing posture honored (no bulk ASHRAE cache, no
licensed fixtures committed); CI green.

## Open questions (phase-local)

- O3 (ASHRAE edition default) gates whether current-edition is on-demand only.
- O4 (commercial keys) and O7 (catalog refresh cadence/storage).
- Licensing on ashrae-meteo is medium-confidence (no explicit ToS) — keep to
  single-station per-project; revisit if ASHRAE objects.
