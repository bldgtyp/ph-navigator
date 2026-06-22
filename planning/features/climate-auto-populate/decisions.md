---
DATE: 2026-06-21
TIME: -
STATUS: Active — D-CL-12..24 all accepted; O-units resolved (2026-06-21).
  Remaining open items are operational only (O4–O7).
AUTHOR: Ed (via Claude)
SCOPE: Decision ledger for climate auto-populate. Extends the archived
  climate ledger (D-CL-1..11); numbering continues from there.
RELATED:
  - PRD.md, research.md
  - planning/archive/climate/decisions.md (D-CL-1..11)
---

# Climate Auto-Populate — Decisions

Continues `planning/archive/climate/decisions.md` (D-CL-1..11).

## Accepted (confirmed with Ed, 2026-06-21)

### D-CL-12 · Address-first auto-populate is the primary workflow
A designer enters the site address once; the app derives + attaches the
full climate basis (#1–8, PRD §5). This inverts today's browser-hunt path.
**Confirmed.**

### D-CL-13 · Privacy — only the spelled-out street address is private
Lat/long, county, state, and climate zone are public. The address string is
auth-gated (edited in a modal) and never rendered to viewers; the public
location projection omits it. Soft privacy accepted (exact public coords are
reverse-geocodable; rounding lever noted, not built). **Confirmed.**

### D-CL-14 · Three-tier store rule
Store small derived cert-values + EPW bytes; pointer + version-pin for the
shared/stable PH datasets; copy-into-project only on override (`custom`).
Cached values + `fetched_at` go in `project_climate_source.data` — no schema
change. Licensing tiers per PRD §4.1. **Confirmed.**

### D-CL-15 · Geocoding via MapTiler (Mapbox fallback); not Google
Google's storage ToS only permits indefinite lat/long caching if isolated to
a single end-user — broken by our multi-user, multi-year access — and forces
results onto a Google map. MapTiler explicitly permits storing results, has
an official React component, renders on MapLibre, 100k/mo free. **Confirmed.**
(research.md §1)

### D-CL-16 · Derived geodata via keyless federal APIs + bundled CSV
Elevation: USGS EPQS → Open-Meteo fallback. County/state: FCC Area API →
Census Geocoder fallback. Climate zone: county FIPS → bundled PNNL 2021 IECC
CSV (public domain, committed). All keyless + server-side except MapTiler.
**Confirmed.** (research.md §2–3)

## Accepted — UI direction (confirmed with Ed, 2026-06-21)

### D-CL-20 · Tab IA = nav sidebar + per-type pages
The Climate tab is a master-detail layout (Variant B, refined): a left **nav
sidebar** holds the **Location card** (top) + one **card per climate-data
type** (Phius, PHI, ASHRAE, EPW), each showing key attributes, a status chip,
the default ★, a status-colored edge, and an inline CTA when relevant; the
**main window shows the selected item's page, one at a time**. The **Location
page carries site facts and mapping** (it is the site context page, not a data
source page).
Mockup of record: `working/climate-tab-wireframe-B2.html`. **Confirmed.**

### D-CL-21 · Units obey the app-wide SI/IP toggle — no per-tab toggle
The tab has **no local °C/°F control**; it renders to the existing app-wide
SI/IP preference, and **all data is SI/IP-rendered**. Resolved per-datapoint
(Ed 2026-06-21):
- **Solar radiation → fully localized to IP.** Add an IP radiation unit:
  kBtu/ft²·mo (monthly) + Btu/h·ft² (peak); SI stays kWh/m² · W/m².
  (≈ 1 kWh/m² = 0.317 kBtu/ft²; 1 W/m² = 0.317 Btu/h·ft².) New — today's
  registry has no IP radiation form.
- **HDD/CDD → always HDD65 / CDD50** (base 65/50 °F, °F·days), a fixed IP
  reference regardless of the toggle.
- **Distance / Δelevation → localized** (km·m in SI, mi·ft in IP); the Phius
  limit is always cited in its native **50 mi / 400 ft**.
- Degree-hours (kKh) and ground thermal properties stay SI-only by nature.
**Confirmed.**

### D-CL-22 · PHI & Phius pages = monthly viz + a separate peak-load element
Each PH dataset page shows the **monthly values as a chart/visualization**
(temperature, radiation) **and** a distinct **peak-load element** for the
design conditions (heating + cooling) from `ClimateRecord.peak_loads`
(heat_load_1/2, cooling_load_1/2). **Confirmed.**

### D-CL-23 · EPW & ASHRAE pages link to the source data
The EPW page links to the EPW source (epwmap / climate.onebuilding.org) and
offers the stored file; the ASHRAE page links to ashrae-meteo.info for the
station. Easy reference back to the authoritative source. **Confirmed.**

### D-CL-24 · This replaces the existing Climate tab
The current tab (`frontend/src/features/climate/` — `ClimateTab`,
`ClimateSourcesSection`, `ClimateDatasetBrowser`) is **updated/replaced** by
this IA, not added alongside. `ClimateRecordView/Table/Charts` and the dataset
search are **reused inside the new pages**. Styling/typography/color come from
the app's CSS tokens + brand items — the wireframe conveys **structure only**,
not the visual system. **Confirmed.**

### D-CL-25 · Absorb deferred climate-tab-followups + design-conditions production
Three v1.1 climate features are consolidated here (Ed 2026-06-21):
- **climate-tab-followups → folded in (superseded):** custom-record entry form
  (P4 add/override surface + P2 Phius-fail escape hatch), attached-source
  charts (= P4, generalized), and promoting `ClimateRecord` to a `context/`
  doc (P4 docs task). The earlier Location-page sun-path labels were
  superseded by D-CL-26.
- **climate-design-conditions → partial fold:** its EPW/`.stat` + ASHRAE
  production and tab display are built here (P3/P4); only the consumer-facing
  **source-parameterized contract endpoint** (+ MCP) stays deferred, still
  gated on a scheduled fRSI/comfort consumer + D-CL-5 (no contract without a
  reader). Avoids building the EPW parser twice.
- **climate-rain-exposure → stays deferred:** separable enclosure-risk metric
  with its own open rainfall-source question (RX-1); its EPW-metrics substrate
  is built here in P3, so it becomes a small follow-on. **Confirmed.**

### D-CL-26 · Location page drops the 2D sun-path visual
The Climate Location page no longer renders `climate-sunpath-panel` or the
related 2D SVG sun-path endpoint/tooling. The page should stay focused on the
site map, coordinates, elevation, county/state, climate zone, privacy, and the
Set Location workflow. Sun-path visualization is available in the Model tab,
where site/sun orientation is already part of the 3D workflow. **Confirmed
2026-06-22.**

## Accepted — flags, fetch & trigger (confirmed with Ed, 2026-06-21)

### D-CL-17 · Phius hard gate; PHI advisory
Phius flag = pass/fail on **≤ 50 mi AND ≤ 400 ft** (published rule). PHI has
no published threshold → **advisory** display of distance + Δelev with a
*soft* 50 mi/400 ft warning and "confirm representativeness with certifier."
**Confirmed.** (research.md §4)

### D-CL-18 · ASHRAE edition default
Default to the free `.stat` 2009 ASHRAE design conditions (cacheable); call
live ashrae-meteo only **on demand** for current-edition (2021/2025) values;
**never bulk-cache** the copyrighted tables. **Confirmed.** (research.md §5)

### D-CL-19 · Derive trigger
Explicit **"Populate climate data" button** (auto-run-once on first address
set + manual re-run), not silent auto-run — external calls fail/are slow and
we want an auditable `fetched_at` moment. **Confirmed.**

## Open questions (to refine / discuss)

- **O1–O3, O8, O-units — ✅ all RESOLVED 2026-06-21.** O1→D-CL-17 (PHI
  advisory), O2→D-CL-19 (button), O3→D-CL-18 (.stat-2009 default), O8→D-CL-20
  (IA), O-units→D-CL-21. Remaining items below are operational, not design.
- **O4: commercial API keys.** BLDGTYP is for-profit; Open-Meteo's free tier
  is non-commercial honor-system and MapTiler bills past 100k/mo. Procure
  proper keys before relying on free tiers. *(Procurement, not design.)*
- **O5: seeded PH dataset versions.** Confirm the seeded Phius/PHI versions
  match what we currently certify against (Phius 2021/2024; PHPP 10.6/…).
  The seeded Phius set is labeled "2022" — verify it is the correct cert
  basis or plan a re-seed (admin flow stays deferred).
- **O6: "custom set required" outcome.** Folded in (D-CL-25): the
  custom-record entry form is built here (P4 add/override + the P2 fail escape
  hatch) and the fail page surfaces the $75 Phius request. Remaining nuance:
  exact wording / whether to auto-open the form on a Phius fail.
- **O7: EPW catalog refresh.** Cadence + storage for the merged 6-region
  station index (the nearest-EPW lookup table).
- **O8: tab layout.** ✅ RESOLVED 2026-06-21 → D-CL-20 (Variant B-refined:
  nav sidebar + per-type pages). Mockup: `working/climate-tab-wireframe-B2.html`.
- **O-units: per-datapoint SI/IP rendering.** ✅ RESOLVED 2026-06-21 → D-CL-21:
  (a) radiation converts to IP (kBtu/ft² · Btu/h·ft²); (b) HDD/CDD always
  HDD65/CDD50; (c) distance/Δelev localized, Phius rule cited native (50 mi /
  400 ft). Degree-hours (kKh) + ground props stay SI.
