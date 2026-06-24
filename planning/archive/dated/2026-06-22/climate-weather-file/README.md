---
DATE: 2026-06-22
TIME: 20:10 EDT
STATUS: ✅ Complete (2026-06-22) — ASHRAE+EPW merged into one `weather` source
  with the full design set (P1); EPW-catalog roster + "Select from map" picker
  (P2); "Upload Climate Data" EPW/STAT/DDY modal (P3). All three asks delivered.
AUTHOR: Claude (for Ed)
SCOPE: Merge the Climate ASHRAE + EPW pages into one "Weather File" item; add a
  Set / Upload Climate Data modal pair (map picker like PHI/PHIUS); surface the
  full STAT design-condition set on the merged page.
RELATED:
  - PRD.md — full scope, data-model deltas, backend/frontend work, phasing.
  - STATUS.md — current state + resolved decisions.
  - phases/phase-01-merge-rename.md — P1 (merge + rename + full data set).
  - phases/phase-02-map-picker.md — P2 ("Select from map" station picker).
  - phases/phase-03-upload-modal.md — P3 ("Upload Climate Data" EPW/STAT/DDY).
  - planning/archive/climate-auto-populate/ (P3 produced the STAT/EPW/ASHRAE
    data this feature reshapes; P4 built the master-detail tab being edited).
  - planning/features_v1.1/climate-design-conditions/ (the deferred consumer
    contract — see PRD §9: this feature advances its production layer but does
    not unblock its gate).
---

# Climate — merge ASHRAE + EPW into one "Weather File" item

## Why

The Climate tab today lists four canonical source cards — Phius, PHI, **ASHRAE**,
**EPW**. ASHRAE and EPW are the *same physical thing*: a single OneBuilding /
EnergyPlus weather station ships an `.epw` + a companion `.stat`, and the `.stat`
**already carries the ASHRAE design conditions**. The backend even parses both
out of one file and stores both on the **`epw`** source — then *redundantly*
duplicates the design conditions onto a second `ashrae` source. Two sidebar
items, two pages, one station. Ed wants them merged.

## The three asks (verbatim intent)

1. **Merge** the ASHRAE and EPW sidebar items / pages into one.
2. **Set / Upload Climate Data** — replace the temporary EPW controls with a
   PHI/PHIUS-style **"Set Climate Data"** button that opens a **map picker**
   (USA map like ladybug `epwmap`, state filter + station list), and a sibling
   **"Upload Climate Data"** button hosting manual upload of **EPW, STAT, DDY**.
3. **Show the full STAT performance set** on the merged page: location name +
   HDD65, CDD50, Record Low/High, Heating DB 99.6%/99%, Cooling DB 0.4%/1%/2%,
   Cooling MCWB 0.4%/1%/2%.

## Headline feasibility (the good news)

- **The map picker is not a heavy lift — it already exists.**
  `ClimateDatasetPickerModal` + `ClimateMap` (Leaflet/OSM) already render exactly
  the requested UX for PHI/PHIUS: a basemap with the project pin, a state filter,
  a proximity-ranked station list, and per-station distance/Δelev. The only new
  backend piece is an **EPW-catalog roster** (filter the existing OneBuilding
  catalog by state, compute distances) that parallels the existing PH roster.
- **The merge is mostly deletion + a rename.** The `epw` source already stores
  `design_conditions`; we stop emitting the duplicate `ashrae` source and
  **rename the `epw` source kind → `weather`** (Ed's call — the source is the
  whole bundle; `.epw`/`.stat`/`.ddy` stay file-typed *asset* kinds). One
  Weather File card renders the design tiles.
- **The display data is mostly already parsed.** Only **4 new fields** are
  needed (Cooling DB/MCWB at 0.4% and 2%); HDD/CDD/records/heating/1%-cooling
  are already extracted.

Net: this is a **medium, mostly-frontend** feature with two small, well-scoped
backend additions (EPW roster + STAT column extension). See PRD for the plan.
