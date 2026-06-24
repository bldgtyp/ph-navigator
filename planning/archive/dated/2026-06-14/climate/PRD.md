---
DATE: 2026-06-13
TIME: -
STATUS: Complete (archived 2026-06-14) — behavior contract for the shipped
  Phases 1–3. §5.4 (design conditions) is realized later by
  planning/features_v1.1/climate-design-conditions.
AUTHOR: Claude (for Ed)
SCOPE: Product / behavior contract for the Climate feature — a
  top-level tab that owns project location + multiple weather/climate
  sources (ASHRAE, EPW, Phius, PHI), backed by app-wide versioned
  reference datasets, and serves climate-derived design conditions to
  other features.
RELATED:
  - README.md
  - decisions.md
  - PLAN.md
  - research.md (example-data findings → standardized format)
  - planning/archive/project-location/PRD.md
  - context/USER_STORIES.md (tab roster US-3.6)
  - context/PRD.md §6.1 (thin relational layer), §11.5 (SI canonical),
    §10.3 (MCP)
---

# Climate — PRD

## 1. Goal

One authoritative home for a project's **location and weather/climate
basis**, that:

1. keeps a clear, visible **record** of the building location;
2. lets a CPHC attach and compare **multiple climate sources** — ASHRAE
   (pointer), EPW (stored), a selected **Phius** dataset location, a
   selected **PHI/PHPP** dataset location, and **custom** data — because
   we don't know in advance which a user wants to evaluate (D-CL-4);
3. **visualizes** each source (sun path; monthly temperature / radiation
   / degree-day graphs + tables);
4. **serves** location + climate-derived **design conditions**
   (per-source) to other features — the Model Viewer sun path,
   Thermal-Bridges fRSI, Window thermal-comfort — SI-canonical and
   MCP-readable.

Climate **extends** the implemented `project_location` feature (D-CL-1)
and introduces **app-wide, versioned reference climate datasets**
(D-CL-8) that all projects/users share.

## 2. Audiences

- **CPHC (Ed/John):** record location once; attach/compare ASHRAE / EPW
  / Phius / PHI sources; read per-source design conditions downstream;
  audit which dataset version produced a value.
- **Owners/architects (public viewers):** see where the building is and
  a legible climate picture; no editing.

## 3. Scope

**Current focus = the climate data *store* (Ed 2026-06-13).** The *use*
of the data (design conditions, fRSI, comfort) comes next.

**In scope now (phased):**
- **Sun-path service** — one project-scoped, location-reactive endpoint
  (Phase 1; the Model-Viewer-render unblocker).
- **Standardized climate format + app-wide reference datasets** — the
  canonical record (§4.3), the Phius/PHI versioned reference stores, and
  seed importers (Phase 2). **This is the focus.**
- **Climate tab** — location record + multi-source attach/select
  (ASHRAE pointer, EPW, Phius/PHI dataset selection, custom) + per-source
  visualization (graph + table) + sun-path visual (Phase 3).

**Deferred to later feature work (Ed 2026-06-13):**
- **Design-conditions contract (Phase 4)** — per-source design
  conditions the fRSI/comfort consumers read. Reopen with the first
  consumer.
- **fRSI interior assumption / temperature-asymmetry use-cases**
  (D-CL-5) — belong to the Thermal-Bridges fRSI feature.

**Out of scope (separate features / later):**
- The **consumers** — Model Viewer sun-path render
  (`model-viewer-sun-path`), Thermal-Bridges fRSI, Window comfort. They
  read Climate's endpoints; not built here.
- The **admin upload/update flow** for new reference-dataset versions
  (Ed: "worry about that later"). Phase 2 seeds the data Ed has; the
  data model carries `version` from day one.
- Address↔lat/long geocoding, map preview (inherited non-goals).

## 4. Data model

### 4.1 Two scopes

- **App-wide reference datasets (shared, versioned, immutable — D-CL-8).**
  Not per-project. Suggested shape:
  - `climate_dataset` — `(id, provider ∈ {phius, phi}, version
    [e.g. '2022','10.6'], label, source, created_at)`; `(provider,
    version)` unique. Immutable once seeded; new release = new row.
  - `climate_dataset_location` — `(id, dataset_id FK, name, country,
    region/state, climate_zone, latitude, longitude, elevation_m,
    station_id, data JSONB)` where `data` is the standardized record
    (§4.3). Indexed for lookup (country/region, and lat/long for
    nearest-station search).
  - Seeded via a seed routine from Ed's files (Phius `-mon.txt` set;
    PHI from PHPP) — Phase 2.
- **Per-project climate (extends `project_location`).** The existing
  table stays the input store for raw location + EPW. Add the project's
  **sources** (D-CL-4) — store all simultaneously:
  - ASHRAE: `ashrae_station_id` + `ashrae_url` (+ optional cached
    fetched design values).
  - EPW: existing `epw_asset_id` + `epw_source_url` (stored asset,
    D-CL-6).
  - Phius selection: a pinned `(climate_dataset_location_id)` from a
    Phius dataset.
  - PHI selection: a pinned `(climate_dataset_location_id)` from a PHI
    dataset.
  - Custom: a per-project standardized record (D-CL-9) for missing
    locations.
  A small `project_climate_source` sibling table (one row per attached
  source, with a `kind` and a pointer/JSONB) is the clean way to "store
  all of them"; one source may be flagged the project default per
  consumer (D-CL-11). Exact table split is a Phase-2/3 implementation
  detail.

### 4.2 Storage principles (inherited)

- **EPW stored, not pointed-to (D-CL-6).** R2 asset; URL is provenance.
- **Location durable + editable, not document-versioned (D-CL-7).**
  Edits propagate. Reproducibility = immutable artifacts + **pinning**:
  the HBJSON upload + EPW asset are frozen, and the **selected reference
  dataset version is pinned** (D-CL-8) — that pin is what lets an old
  model show the climate basis it used, without document-versioning the
  live location.

### 4.3 The standardized climate record — PINNED to `honeybee_ph.site` (D-CL-10)

One canonical schema all sources normalize into (Phius txt, PHI xlsx,
EPW-derived, ASHRAE, custom). **Pinned to mirror `honeybee_ph.site`**
(the HBJSON-native PH model — research.md), so it round-trips into
HBJSON/PHX/PHPP/WUFI via the existing `to_dict()`/`from_dict()`. Our
Pydantic v2 `ClimateRecord` mirrors the `Site.to_dict()` shape exactly
for the core, adds an `aux` block for source fields honeybee_ph omits,
and provides `from_honeybee_ph_site()` / `to_honeybee_ph_site()`
adapters — we do **not** subclass the py2.7 classes. Shape (SI):

```
ClimateRecord {                          // mirrors honeybee_ph.site.Site
  identity:
    display_name
    phpp_codes: { country_code, region_code, dataset_name }   // honeybee_ph.PHPPCodes — the dropdown identity
    provider, version, station_id        // OUR additions for the reference-dataset model (D-CL-8)
  location:                              // honeybee_ph.Location
    latitude, longitude, site_elevation_m, climate_zone, hours_from_UTC
  climate:                               // honeybee_ph.Climate
    station_elevation_m
    summer_daily_temperature_swing_k
    average_wind_speed_ms
    ground: { thermal_conductivity, heat_capacity, density,
              depth_groundwater_m, flow_rate_groundwater }     // honeybee_ph.Climate_Ground
    monthly_temps:     { air_c[12], dewpoint_c[12], sky_c[12], ground_c[12] }    // Climate_MonthlyTempCollection
    monthly_radiation: { north[12], east[12], south[12], west[12], global[12] }  // kWh/m²; Climate_MonthlyRadiationCollection
    peak_loads:                          // Climate_PeakLoadCollection (4 design conditions)
      heat_load_1, heat_load_2, cooling_load_1, cooling_load_2:
        { temp_c, rad_north, rad_east, rad_south, rad_west, rad_global,  // rad W/m²
          dewpoint_c, sky_c, ground_c }                                  // Climate_PeakLoadValueSet
  aux:                                   // source fields honeybee_ph keeps in user_data
    heating_degree_hours_12_20, cooling_degree_hours_24,
    wind_speed_jan_ms, wind_speed_jul_ms,
    temp_min_12h_c, summer_night_fraction_dry_pct,
    summer_night_fraction_humid_pct, albedo
}
```

Field names/units mirror `honeybee_ph.site` verbatim (research.md):
monthly radiation kWh/m², peak-load radiation W/m², temps °C, elevation
m, wind m/s, swing K. The Phius `-mon.txt` 3-column design set maps to
`heat_load_1`/`heat_load_2`/`cooling_load_1`. This schema becomes a
stable `context/` reference doc once Phase 2 lands it.

## 5. Behavior contract

### 5.1 Sun-path service (Phase 1)
- `GET /api/v1/projects/{id}/sun-path` → `SunPathAndCompassDTOSchema |
  null`. Public-readable. `null` when no location / lat-long unset.
- Pure ladybug computation from location (lat/long/true-north/
  time-zone), unit radius, origin-centered, DST off, true-north sign
  verified (D-PL-4). No HBJSON, no model dependency.
- MCP-readable (`get_project_sun_path`).
- The single endpoint the Model Viewer Site & Sun lens AND the Climate
  tab consume.

### 5.2 Reference datasets + standardized format (Phase 2)
- The `climate_dataset` / `climate_dataset_location` stores (§4.1),
  seeded with Phius (2022) and PHI (PHPP 10.6) from Ed's files, in the
  standardized format (§4.3).
- Read endpoints (+ MCP): list dataset versions; search/list locations
  in a dataset (by country/region, nearest to lat/long); fetch a
  location's standardized record.
- Reuse `honeybee-ph`/`PHX` parsing where it exists (D-CL-10).

### 5.3 Climate tab (Phase 3)
- A new top-level **Climate** tab in `PROJECT_TABS` (6th tab).
- **Location record** (coords, elevation, time zone, true north,
  address), editor-editable / viewer read-only — reuse or migrate
  `ProjectLocationSettingsSection` (D-CL-3 sub-question).
- **Sources** (D-CL-4), each attachable + independently visualized:
  ASHRAE pointer (station + URL); EPW (upload/replace, provenance);
  Phius dataset-location **dropdown** (by version); PHI dataset-location
  **dropdown** (by version); **custom** entry.
- **Visualization:** for any selected source, monthly **graph + table**
  (temperature, radiation, degree-days …); plus the **sun-path visual**
  (consumes §5.1).
- SI wire; elevation m/ft toggle; angles invariant.

### 5.4 Design-conditions contract (Phase 4)
- Per-source design conditions (PH datasets' design columns; EPW-derived
  percentiles; ASHRAE fetched values), exposed as a small, explicit,
  **source-parameterized**, versioned, SI shape with the `basis` named
  (D-CL-11) — the contract fRSI/comfort read. Endpoint + MCP.
- Tab gains a design-conditions table comparing sources.

## 6. Cross-feature contract (who reads Climate)

| Consumer | Reads | Phase it needs |
|---|---|---|
| Model Viewer Site & Sun render (`model-viewer-sun-path`) | `GET …/sun-path` | Phase 1 |
| Climate tab sun-path visual | `GET …/sun-path` | Phase 1 |
| Climate tab dataset dropdowns + graphs | dataset read endpoints | Phase 2 |
| Thermal-Bridges fRSI (future feature) | design-conditions contract (selected source) + its own interior assumption (D-CL-5) | Phase 4 |
| Window thermal-comfort (future feature) | design heating temp (selected source) | Phase 4 |

## 7. Acceptance gate (per phase)

- **Phase 1:** sun-path endpoint returns a correct, north-verified
  diagram for a project with location, `null` without; MCP parity;
  the Model-Viewer render can consume it; `make ci` green.
- **Phase 2:** standardized record defined; Phius (2022) + PHI (10.6)
  seeded and queryable (counts match the source files — ~1007 Phius
  stations); version carried; dataset read endpoints + MCP; reuse of
  PH-Tools parsing investigated/recorded; `make ci` green.
- **Phase 3:** Climate tab renders for editor + viewer; location record;
  all sources attachable; Phius/PHI dropdowns; per-source graph+table;
  sun-path visual; tab in roster; units behave; `make ci` green.
- **Phase 4:** per-source, source-parameterized design-conditions
  contract endpoint + MCP, `basis` named; D-CL-5 resolved by the fRSI
  consumer; `make ci` green. Wiring fRSI/comfort is their own features.
