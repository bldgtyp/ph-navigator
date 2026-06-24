---
DATE: 2026-06-22
TIME: 20:10 EDT
STATUS: ✅ Complete (2026-06-22) — §3 D1–D6 + §4 data delta + §5/§6 all
  implemented across P1 (merge/rename), P2 (roster/picker), P3 (upload modal).
AUTHOR: Claude (for Ed)
SCOPE: Detailed plan for merging Climate ASHRAE+EPW into one "Weather File"
  item, the Set/Upload Climate Data modal pair, and the full STAT metric set.
RELATED:
  - README.md, STATUS.md
  - backend/features/project_climate_source/ (source model, roster, service)
  - backend/features/climate/{stat_parser,design_conditions,epw_catalog,
    ashrae_meteo}.py
  - backend/features/project_location/service.py (weather derive + payloads)
  - frontend/src/features/climate/ (ClimateTab, ClimateSourceSidebar,
    ClimateSourceDetailPage, ClimateDatasetPickerModal, ClimateMap)
---

# Weather File merge — PRD

## 1. Current state (what already exists)

**Backend**
- `project_climate_source` stores one source per `kind` ∈
  `phius | phi | ashrae | epw | custom`. `ref` + `data` (JSONB) interpretation
  is per-kind. One-source-per-kind via `upsert_source_by_kind`.
- **Weather derive** (`POST /projects/{id}/location/derive/weather`,
  `project_location/service.py::derive_weather_source`):
  `nearest_epw_entry` → `download_epw_zip` → `parse_stat_file` →
  `build_weather_source_payloads`. That function:
  - stores the EPW bytes as an `epw` asset,
  - parses the `.stat` into `ParsedStatPayload{metrics, design_conditions}`,
  - writes **both** `stat_metrics` *and* `design_conditions` onto the **`epw`**
    source `data`,
  - **then also appends a separate `ashrae` source** carrying the same
    `design_conditions` (the redundancy this feature removes).
- `stat_parser.parse_stat_file` extracts HDD65, CDD50, record low/high, and
  design conditions: heating 99.6/99 DB, **cooling 1% DB/MCWB only**, dehum 1%
  DP/MCDB. (`cooling_010_*` = the 1% columns.)
- `ashrae_meteo.py` + `POST …/climate/sources/ashrae/current`
  (`refresh_ashrae_design_conditions`) pulls a single nearest station's
  **current-edition** (2021/2025) conditions from ashrae-meteo.info and writes
  a fresh `ashrae` source. Same 6-field shape.
- `epw_catalog.py` loads the **global** OneBuilding TMYx XLSX catalogs
  (~17k stations, 24h in-process cache) and exposes **`nearest_epw_entry` only**
  — no state/region roster yet. `download_epw_zip` pulls the `.epw` + `.stat`
  from the zip (**`.ddy` is ignored**).
- PH dataset roster (`get_project_dataset_roster`) is the picker feed for
  phius/phi — state filter (defaults to project state) / `near` mode, each
  station with a backend proximity verdict.

**Frontend** (`features/climate/`)
- `ClimateTab` = master-detail. Sidebar (`ClimateSourceSidebar`) shows the
  location card + one card per `CANONICAL_CLIMATE_KINDS = [phius, phi, ashrae,
  epw]` (attached card or `MissingSourceCard`), then non-canonical (custom).
- `ClimateSourceDetailPage` routes per kind: `PassiveHouseSourcePage`,
  `AshraeSourcePage` (design tiles: Htg 99.6/99, Clg 1% DB/MCWB, Dehum DP/MCDB),
  `EpwSourcePage` (HDD65/CDD50/record tiles + `ProjectEpwControls`),
  `CustomSourcePage`.
- `ProjectEpwControls` = the temporary UI in the screenshot (EPW source URL +
  Upload EPW + Save), driven by `useProjectLocationForm` (writes
  `project_location.epw_asset_id` / `epw_source_url`).
- **`ClimateDatasetPickerModal`** (phius/phi only) is the exact target UX:
  `ClimateMap` Leaflet basemap (project pin + station pins + 50 mi ring),
  `AutocompleteSelect` state filter, ranked list with distance/Δelev/zone +
  status chip, attach/replace. Feeds from `useClimateDatasetRosterQuery`.

## 2. Goals

G1. One **"Weather File"** sidebar item + page replacing the separate ASHRAE
    and EPW items.
G2. A **"Set Climate Data"** button → station **map picker** (USA, state
    filter), styled like the PH picker. A sibling **"Upload Climate Data"**
    button → modal for manual **EPW / STAT / DDY** upload.
G3. The merged page shows **location name** + the full metric set:
    HDD65, CDD50, Record Low/High, Heating DB 99.6%/99%,
    Cooling DB 0.4%/1%/2%, Cooling MCWB 0.4%/1%/2%.

## 3. Recommended design + decisions

> **All four open decisions resolved by Ed, 2026-06-22.** D1 = rename;
> D2/D3/D4/D5 as below.

- **D1 — Rename the source `kind` from `epw` to `weather` (RESOLVED: rename).**
  Ed's rationale: "EPW" names *one part* of the bundle (bundle = `.epw` + `.stat`
  + `.ddy`); the merged source is the *whole station bundle*, so `weather` is the
  honest name. Clean separation falls out of this:
  - **Source kind** = `weather` (the bundle). `ClimateSourceKind` becomes
    `phius | phi | weather | custom`.
  - **Asset kinds** stay file-typed — `epw` / `stat` / `ddy` — because each names
    an actual file. The `.epw` asset is still `asset_kind="epw"`; that's correct.
  - The `weather` source's `ref` stays the **primary EPW asset id** (kept by
    `_validate_*_ref`); the `.stat` / `.ddy` asset ids live in `data`.
  - Bonus: the derive route enum already uses `weather`
    (`ClimateSourceDeriveKind`), so the source kind now matches the derive kind.
  - Churn (accepted): the `Literal` in `models.py`, `_REF_KINDS`/`_DATA_KINDS`,
    `validate_source_shape`, the `_validate_source`/`build_weather_source_payloads`/
    `existing_weather_source_values` branches, the frontend `ClimateSourceKind` +
    `CANONICAL_CLIMATE_KINDS` + labels + `data-kind` CSS tokens + page component,
    and tests. A tiny Alembic data migration renames any existing dev
    `kind='epw'` rows → `weather` and deletes `kind='ashrae'` rows (dev DB is
    reseedable, so this is belt-and-suspenders).
- **D2 — Drop the separate `ashrae` source (RESOLVED).** Pure duplication of the
  `weather` source's `design_conditions`. Remove the `ashrae` append in
  `build_weather_source_payloads`; remove `ashrae` from the kind literal +
  `CANONICAL_CLIMATE_KINDS`; `AshraeSourcePage` is absorbed into the Weather
  page.
- **D3 — ASHRAE current-edition = an *action on the Weather page*, not a sidebar
  item (RESOLVED: yes).** Repoint `refresh_ashrae_design_conditions` to **update
  the `weather` source's `design_conditions`** (tagging `source="ashrae-meteo"`
  + `edition`) instead of writing an `ashrae` source. Small "Update to ASHRAE
  2021/2025" control under the design-conditions section; the `.stat` set (free,
  ships with the file) stays the default basis.
- **D4 — Picker scope = USA + state filter first (RESOLVED).** Matches the
  ask and the PH picker's state model; international is a later filter, not a
  rebuild. No certification proximity *gate* for weather files — distance/Δelev
  is **informational** (no pass/fail chip, no limit ring).
- **D5 — DDY is store-only (RESOLVED).** No parser/consumer today; keep the bytes
  as an asset for downstream Rhino/EnergyPlus sizing exports. EPW + STAT uploads
  are parsed (STAT → metrics + design conditions; EPW header → location suggestion).
- **D6 — Two distinct "set" affordances, user's choice (RESOLVED, Ed-2).** Keep
  the one-click **"Set from nearest"** *and* a **"Select from map"** picker as
  separate buttons — the user picks the workflow. Plus **"Upload climate data"**.
  Three actions on the page; wording adjustable.

## 4. Data-model delta (design conditions)

Extend `ClimateDesignConditions` (`design_conditions.py`) with the missing
cooling percentiles so the page can show 0.4/1/2%:

```
cooling_004_db_c     cooling_004_mcwb_c      # NEW (0.4%)
cooling_010_db_c     cooling_010_mcwb_c      # exists (1%)
cooling_020_db_c     cooling_020_mcwb_c      # NEW (2%)
```

- Keep heating_996/990, dehum 1% DP/MCDB, record low/high as-is. All `| None`
  with `missing_fields` tracking (unchanged pattern).
- **Name the fields as the eventual `climate-design-conditions` contract shape**
  (SI `_c`, percentile-in-name) so that deferred endpoint becomes a thin
  pass-through (PRD §9).

`EpwStatMetrics` is unchanged (HDD/CDD/records already present).

## 5. Backend work

> Per D1, the `epw` source kind is **renamed to `weather`**. Below, "the weather
> source" means `kind="weather"`; asset kinds stay `epw`/`stat`/`ddy`.

0. **Rename `epw` → `weather` source kind** (`project_climate_source/models.py`
   + service branches + `project_location/service.py` weather builders +
   `existing_weather_source_values` query + tests). Add the small Alembic data
   migration (rename existing `epw` rows, delete `ashrae` rows).

1. **STAT parser — add cooling percentiles** (`stat_parser.py`).
   The EnergyPlus `.stat` "Cooling" design row lists, after the month token:
   `…, 0.4% DB, 0.4% MCWB, 1% DB, 1% MCWB, 2% DB, 2% MCWB, …`. Existing code uses
   `cooling[4]/[5]` for 1% DB/MCWB ⇒ expected `cooling[2]/[3]` = 0.4%,
   `cooling[6]/[7]` = 2%. **Verify the exact indices against a real OneBuilding
   TMYx `.stat`** and update the synthetic test fixture to mirror the real column
   order before trusting the offsets. Add the 4 `_value_at` extractions + map to
   the new model fields; extend `missing_fields`.
2. **ashrae-meteo mapping** (`ashrae_meteo.py`) — add the 0.4%/2% DB/MCWB keys to
   `design_conditions_from_ashrae_station` (the response carries all
   percentiles) so a current-edition refresh fills the same expanded shape.
   *(Secondary — the `.stat` path is the default.)*
3. **Drop the duplicate `ashrae` source** in `build_weather_source_payloads`
   (remove the `sources.append({"kind": "ashrae", …})` block; the weather source
   already carries `design_conditions`). Location name is already in
   `data.station.name` — confirm the page surfaces it.
4. **Repoint `refresh_ashrae_design_conditions`** to upsert onto the **`weather`**
   source's `data.design_conditions` (D3), with an audit entry; 409 if no weather
   source exists yet ("Set the weather file first").
5. **EPW-catalog roster** — new feed paralleling `get_project_dataset_roster`:
   - `epw_catalog.py`: add `epw_entries_for_region(country, region)` /
     `nearest_epw_entries(lat, long, limit)` returning entries with
     `distance_mi` (+ Δelev vs site).
   - `project_climate_source` service+route: `GET …/climate/epw-roster?region=`
     returning `{project, items:[{name, wmo, lat, long, elevation_m,
     distance_mi, elevation_delta_ft, source_url}], total}`. Reuse
     `RosterProjectLocation`. No proximity *verdict* (D4) — distance/Δelev only.
   - Performance: filter the in-memory cached catalog; cap page size (mirror
     `_MAX_PAGE_SIZE`). USA filter = `country == "USA" & region == <state>`.
6. **Attach-by-pick path** — picking a station in the modal must run the same
   download+parse+store as the auto-derive (it needs the `.epw`/`.stat` bytes,
   not just catalog coords). Options:
   - (a) Reuse derive: a `derive` variant that takes an explicit catalog
     `url`/`wmo` instead of nearest — cleanest reuse of
     `build_weather_source_payloads`.
   - (b) A `POST …/climate/sources/weather/from-catalog {url}` that downloads +
     parses + upserts the `weather` source. **Recommended (b)** — keeps the
     picker's create-path symmetric with the PH picker's create mutation.
7. **STAT/DDY upload** — extend the upload path so a user-supplied bundle is
   parsed like the derived one:
   - asset kinds `stat` and `ddy` alongside `epw` (confirm the asset model
     accepts these kind strings; add if enumerated).
   - On EPW(+STAT) upload: parse STAT → write `stat_metrics` +
     `design_conditions` onto the `weather` source `data` (today the temporary
     `ProjectEpwControls` only parses the EPW header for a location suggestion).
   - `.stat` / `.ddy` asset ids stored on the source `data` (DDY store-only, D5).

## 6. Frontend work

1. **Sidebar** (`ClimateSourceSidebar` + `lib.ts`): `CANONICAL_CLIMATE_KINDS =
   [phius, phi, weather]`. Label `weather` → "Weather File"
   (`climateSourceKindLabel` / `CLIMATE_KIND_LABELS`); update the `data-kind`
   badge token. Remove the ASHRAE card.
2. **Generalize the picker** (`ClimateDatasetPickerModal` → support a weather
   mode): accept the EPW roster feed; for `kind="weather"` use
   `useEpwRosterQuery(projectId, region)`, hide the cert verdict chip + 50 mi
   ring (D4), show distance/Δelev. Keep the same `ModalDialog`, state filter,
   `ClimateMap`, list-row layout for visual consistency. Attach → the
   from-catalog create mutation (§5.6b).
3. **Weather page** (rename `EpwSourcePage` → `WeatherSourcePage`, fold in
   `AshraeSourcePage`):
   - Header: **location name** (`data.station.name` / `label`), station/WMO,
     distance, basis/edition, source link, download EPW/STAT/DDY.
   - **Performance** tiles: HDD65, CDD50, Record Low, Record High.
   - **Design conditions** tiles: Heating DB 99.6%/99%; Cooling DB
     0.4%/1%/2%; Cooling MCWB 0.4%/1%/2% (route temps through
     `formatTemperatureFromC`, app SI/IP — D-CL-21). Keep dehum tiles too.
   - **Actions row — three distinct buttons (D6):** **"Set from nearest"**
     (one-click derive), **"Select from map"** (opens the picker modal), and
     **"Upload climate data"** (opens the upload modal). The user chooses the
     workflow; none is folded into another.
   - "Update to ASHRAE 2021/2025" control (D3) beside design conditions.
4. **Upload modal** — new `ClimateUploadModal`: three labelled file inputs
   (EPW / STAT / DDY), accepts each, posts to the upload+parse path, shows the
   parsed location suggestion + missing-field flags. Replaces the inline
   `ProjectEpwControls` block (and the screenshot's "Temporary home …" copy).
5. **Empty state** (`MissingSourcePage` for `weather`): the same three actions
   (Set from nearest · Select from map · Upload climate data); drop the
   ASHRAE-specific note.
6. **Types**: `ClimateSourceDeriveKind` unchanged (`weather` already its value —
   now matches the source kind); rename `epw`→`weather` in `ClimateSourceKind`;
   add the EPW roster types; expand the design-conditions display type with the
   4 new fields.

## 7. Phasing

Each phase is a **vertical slice** (backend + frontend together) that keeps the
app + `make ci` green and is independently shippable — a backend-only rename
phase would leave the frontend red mid-rename, so the rename lands as one slice.
Detailed implementation plans live in `phases/`.

- **P1 — Unify to one "Weather File" item** (`phases/phase-01-merge-rename.md`).
  Rename `epw`→`weather` (+ data migration), drop the duplicate `ashrae`
  source, extend `ClimateDesignConditions` + STAT parser (4 cooling fields),
  repoint the current-edition refresh, and render one Weather File card/page
  with the **full** metric + design-condition set. The existing "Set from
  nearest" + the temporary inline upload stay (relabeled). **Delivers asks #1 +
  #3.**
- **P2 — "Select from map" station picker**
  (`phases/phase-02-map-picker.md`). EPW-catalog roster endpoint +
  `from-catalog` attach; generalize the PH picker (map + state filter, no cert
  gate) to weather mode; add the "Select from map" button. **Delivers the
  marquee of ask #2.**
- **P3 — "Upload Climate Data" modal**
  (`phases/phase-03-upload-modal.md`). Dedicated EPW/STAT/DDY upload + STAT
  parse/store + asset kinds; replace the temporary `ProjectEpwControls`;
  finalize the three-action row. **Delivers the rest of ask #2** and removes the
  interim scaffolding.

Order is value-first: P1 (merge + data) → P2 (picker) → P3 (upload). P2 and P3
are independent and could swap.

## 8. Risks / unknowns

- **STAT cooling column offsets** (§5.1) — must be verified against a real
  TMYx `.stat`; the synthetic fixture currently under-specifies the cooling row.
  Highest-confidence-needed item. Low blast radius (additive fields).
- **ashrae-meteo response keys** for 0.4%/2% — needs a recorded fixture to map;
  secondary path, can ship P1 with `.stat` only.
- **Catalog perf** — 17k-row in-memory filter per roster call is fine, but keep
  it behind the existing 24h cache; don't re-download per request.
- **Licensing** — unchanged posture: no bulk ASHRAE cache (single station,
  on-demand); no licensed fixtures in this public repo (synthetic only).

## 9. Relationship to deferred `climate-design-conditions`

That feature's **production + display** half was already absorbed into
`climate-auto-populate` P3/P4; only its **consumer-facing contract endpoint**
(`GET …/design-conditions?source=`) remains, gated on a scheduled fRSI/comfort
consumer + D-CL-5.

- This feature **advances that production layer** — it completes the design
  set (0.4/1/2% cooling) and unifies the display.
- It **does not unblock the gate** — no consumer is scheduled, so the contract
  endpoint stays deferred.
- **Action:** name the new fields as the contract's canonical shape (PRD §4) so
  the eventual endpoint is a thin read-through. Add a one-line note to that
  feature's STATUS pointing here once P1 lands. No other items there are
  resolved by this work.

## 10. Exit criteria

- One "Weather File" sidebar item/page; no separate ASHRAE item.
- Weather page shows location name + HDD65, CDD50, Record Low/High,
  Heating DB 99.6/99, Cooling DB 0.4/1/2, Cooling MCWB 0.4/1/2 — app SI/IP.
- "Set Climate Data" opens the USA/state map picker (PH-picker-styled), attach
  downloads+parses+stores the station; "Upload Climate Data" handles EPW/STAT/DDY.
- Derive emits a single `weather` source carrying both metric sets; the `epw`
  and `ashrae` kinds are gone; current-edition refresh updates it in place.
- `make ci` green; Playwright visual pass (editor + viewer read-only).
