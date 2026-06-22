---
DATE: 2026-06-21
TIME: -
STATUS: Active — planning (open questions O1–O5 pending Ed)
AUTHOR: Ed (via Claude)
SCOPE: Product / behavior contract for address-first climate auto-populate
  + the privacy model + the roster-first tab redesign. Extends the shipped
  climate STORE (planning/archive/climate/PRD.md), it does not replace it.
RELATED:
  - README.md, decisions.md, research.md, STATUS.md
  - planning/archive/climate/PRD.md §4.3 (the ClimateRecord schema — unchanged)
  - planning/archive/climate/decisions.md (D-CL-1..11)
  - backend/features/climate/, backend/features/project_climate_source/
  - frontend/src/features/climate/
---

# Climate Auto-Populate — PRD

## 1. Goal

One action — **enter the site address** — should populate the project's
entire climate basis, with each derived value stored under the three-tier
store rule (§4) and each certification-relevant choice **flagged** when it
fails the certifier's proximity rules (§5). The Climate tab is reshaped so
the **attached sources** a project uses are the first-class, visualizable
surface, instead of today's browser-only visualization.

This **extends** the shipped climate store (archived Phases 1–3). The
`ClimateRecord` schema (archived PRD §4.3, mirrored to `honeybee_ph.site`)
and the `project_climate_source` model are unchanged; this feature adds the
address front-door, the derive routines, the proximity flags, the cached
design conditions, and the UI redesign.

## 2. Primary user story

> As a designer starting a project, I enter the building's site address
> once. The app pins the location, derives the county, elevation, and
> climate zone, finds and attaches the nearest Phius, PHI, ASHRAE, and EPW
> climate bases, and tells me — per certifier — whether each basis is close
> enough to certify against. I can then inspect and compare each attached
> basis (table + charts) without re-hunting for it. The precise address is
> visible only to signed-in editors; the public project page shows only the
> coarse location.

## 3. Privacy model (D-CL-13)

- **Only the spelled-out street address is private.** Lat/long, county,
  state, and climate zone are public — they are how we *show* the location.
- The address string is entered/edited in an **auth-gated modal** and is
  **never rendered to viewers**. The public projection of the location
  returns `{ latitude, longitude, elevation_m, county, state, country,
  climate_zone }` and omits the address line.
- **Soft privacy is accepted:** exact coordinates are public, even though a
  determined viewer can reverse-geocode them back to the address. If real
  privacy is ever wanted, the lever is rounding the *public* coordinates to
  ~2 decimals while the modal keeps exact coords (not built now).
- The former Climate-page sun-path endpoint was removed on 2026-06-22; sun
  visualization belongs in the Model tab.

## 4. Store rule (three-tier) (D-CL-14)

1. **Always store the small, derived, certification-load-bearing values** —
   ASHRAE design conditions, EPW-derived metrics (HDD/CDD, record high·low),
   the monthly record for the chosen PH basis. KB-sized, read by downstream
   features, and **must be frozen** for reproducibility across review rounds.
2. **Store the bytes** for the one large reproducibility-critical input — the
   EPW file (already done; archived D-CL-6).
3. **Pointer + provenance URL** for the large/shared/stable artifact — the
   app-wide Phius/PHI datasets (stored once, **pinned by version** per
   project, never duplicated) and the source URLs.

Copy-into-project only happens on **override/edit** — the existing `custom`
source kind (archived D-CL-9). Cached values + a `fetched_at` timestamp live
in `project_climate_source.data` (JSONB) — **no schema change** needed.

### 4.1 Licensing constraints (this repo is PUBLIC)

- Bundled **PNNL IECC county→zone CSV** — US-gov public domain → OK to commit.
- **Phius / PHI** climate sets — licensed → DB / private object store only,
  never committed (already the seeding design).
- **EPW / `.stat`** — freely redistributable by community consensus → cache
  per-project in the private object store; attribute climate.onebuilding.org.
- **ASHRAE current-edition** design conditions (ashrae-meteo.info) —
  copyrighted → real-time single-station per-project only; **never** bulk
  cache the tables.

## 5. The auto-populate routines

Each routine: data source, store-vs-pointer, and flag logic. Items #5/#6
**reuse the existing nearest-to-coords search** over the seeded
`climate_dataset_location` table; the rest are net-new.

| # | Routine | Source | Store / pointer | Flag |
| --- | --- | --- | --- | --- |
| 1 | Address → lat/long | MapTiler geocode (Mapbox fallback) | Store lat/long (key) + address (auth-gated) | Invalid/ambiguous → drop-a-pin map fallback |
| 2 | State + county | FCC Area API → Census Geocoder | Store FIPS + names | — |
| 3 | Site elevation | USGS EPQS → Open-Meteo | Store m | Both miss → flag |
| 4 | Climate zone | FCC county FIPS → bundled PNNL 2021 IECC CSV | Store (e.g. "5A") | High-relief county → note ASHRAE-169 may differ |
| 5 | Nearest **Phius** | Seeded dataset (`near` search) | Pin + store distance + Δelev | **Fail iff > 50 mi OR > 400 ft** → "custom set required ($75)" |
| 6 | Nearest **PHI** | Seeded dataset (`near` search) | Pin + store distance + Δelev | **Advisory** (PHI has no hard rule); soft 50 mi/400 ft warning + "confirm w/ certifier" |
| 7 | Nearest **ASHRAE** | `.stat` (2009, free) default; ashrae-meteo (2021/2025) on demand | Pointer + cache value-set + `fetched_at` | Missing any of Htg 99.6/99, Clg 1% DB/MCWB, DP 1%/MCDB |
| 8 | Nearest **EPW** | climate.onebuilding.org (merge 6 region XLSX → haversine) | Store bytes + cache `.stat` metrics | Missing HDD65 / CDD50 / record high·low |

The EPW `.stat` companion ships ASHRAE design conditions (2009) **and**
HDD/CDD **and** record extremes — so #8 delivers most of #7 for free, and we
spend the copyright-sensitive live ashrae-meteo call only when a project
needs current-edition numbers.

## 6. Certification proximity rules (research.md §4)

The two certifiers are **not symmetric** — this shapes the flags:

- **Phius — hard, published** (Certification Guidebook v25.1.0 §1.4.4.2):
  dataset must be **≤ 50 linear miles AND ≤ 400 ft elevation difference**.
  Fail either → custom set required ($75; Phius generates from Meteonorm; no
  interpolation). Prescriptive path forbids custom data entirely. NYC Central
  Park set valid only within 2 blocks. → **computable pass/fail (#5).**
- **PHI — no published number.** Qualitative "must be representative,"
  microclimate-driven; PHPP altitude-correction handles elevation. Custom
  sets commissioned via the certifier at cost. → **advisory only (#6).**

Use a proper **haversine** distance for the gate (the existing search uses
planar cos-lat distance — fine for ranking, not for a pass/fail boundary).

## 7. Reshaped tab — LOCKED IA (D-CL-20; detail in `phases/phase-04`)

Auto-populate inverts the UX into a **master-detail** layout (Variant
B-refined; record at `working/climate-tab-wireframe-B2.html`, structure only —
styling comes from app CSS/brand tokens):

- **Sidebar = nav:** the **Location card** (top) + one **card per climate
  type** (Phius, PHI, ASHRAE, EPW), each with key attributes, a status chip,
  the default ★, a status-colored edge, and an inline CTA when relevant.
- **Main = one page at a time:** the selected item's page.
  - **Location page:** map + derived facts + Set Location workflow.
  - **Phius/PHI page (D-CL-22):** monthly viz + a separate **peak-load**
    (heating/cooling) element.
  - **ASHRAE / EPW pages (D-CL-23):** values + a **link to the source**
    (ashrae-meteo.info / epwmap).
  - **Fail page:** the custom-set CTA + the "why — nearest candidates" table.
- **Units (D-CL-21):** no per-tab toggle — obey the app-wide SI/IP preference;
  all data SI/IP-rendered (per-datapoint specifics open, O-units).
- **Privacy:** public shows county/state/zone/coords; the address string +
  edit are behind the auth'd modal (§3).
- **Replaces** the existing tab (D-CL-24); the dataset browser demotes to a
  manual "add/override" surface.

## 8. Reuse vs. net-new

- **Reused:** `ClimateRecord` schema; `climate_dataset_location` + its
  nearest-to-coords search; `project_climate_source` CRUD/JSONB;
  the existing `ClimateRecordView/Table/Charts` (re-pointed at attached
  sources); `project_location` EPW upload.
- **Net-new:** address field + geocoding modal + public projection;
  the derive service (external API clients #1–4); haversine proximity gate +
  auto-attach (#5/6); the EPW catalog + `.stat` parser + ashrae-meteo client
  (#7/8); the roster visualization/redesign.

## 9. Acceptance gates (per phase — detail in `phases/`)

- **P1:** address set in the modal pins lat/long; county/elevation/zone
  derived and stored; public projection omits the address; `make ci` green.
- **P2:** nearest Phius/PHI auto-pinned with distance/Δelev; Phius pass/fail
  flag correct against the 50 mi/400 ft rule; PHI advisory; `make ci` green.
- **P3:** nearest EPW found + stored with `.stat`-derived metrics + 2009
  ASHRAE conditions cached; on-demand current-edition ASHRAE pull;
  missing-field flags; licensing posture honored; `make ci` green.
- **P4:** an attached source renders its table/charts + flag/version inline;
  roster-first layout; viewer/editor gating holds; `make ci` green.
