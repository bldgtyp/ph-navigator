---
DATE: 2026-06-21
TIME: -
STATUS: Planned — direction LOCKED (D-CL-20, Variant B-refined). Independent of
  P1–P3; may lead.
AUTHOR: Ed (via Claude)
SCOPE: P4 — rebuild the Climate tab as a nav-sidebar + per-type-page layout
  (D-CL-20). Replaces the existing tab (D-CL-24). Fixes today's orphaned-
  visualization gap and makes attached sources first-class.
RELATED:
  - ../PRD.md §7, ../decisions.md (D-CL-20..24, O-units)
  - working/climate-tab-wireframe-B2.html (the agreed record — structure only)
  - frontend/src/features/climate/components/ (ClimateRecordView/Table/Charts,
    ClimateSourcesSection, ClimateDatasetBrowser — reused/restructured)
---

# Phase 4 — Climate tab: nav sidebar + per-type pages

## Goal

Rebuild the tab as a **master-detail** layout: a left **nav sidebar** and a
**main window that shows one climate page at a time**. This makes the attached
sources first-class and visualizable (today's Table/Charts only render for a
*browsed* location, not an *attached* source) and gives each climate-data type
its own page. **Replaces** the current tab (D-CL-24).

Direction is **locked** (D-CL-20) — record at
`working/climate-tab-wireframe-B2.html`. The wireframe conveys **structure
only**; styling/typography/color come from the app CSS tokens + brand items.

## Locked layout (D-CL-20)

**Sidebar = nav.**
- **Location card** on top (clickable → Location page): mini map, coords,
  county·state, elevation, climate zone, "private" marker.
- **One card per climate type** (Phius, PHI, ASHRAE, EPW): type badge, station
  name, key attributes, **status chip** (OK/Check/Fail), the **default ★**, a
  **status-colored left edge**, and an **inline CTA** when relevant (Phius
  "custom req'd →", PHI "confirm →"). Active card highlighted.
- An "＋ Add source · re-populate" affordance.

**Main = the selected item's page, one at a time.**

## Per-page specs

- **Location page** — big map, the four derived facts (P1), and the
  **sun-path** (moved here from the sidebar; it's a property of the site) with
  **N/E/S/W cardinal labels** from project true-north (folded-in follow-up).
  Edit opens the auth-gated address modal (P1).
- **Phius / PHI page (D-CL-22)** — the **monthly values as a chart/viz**
  (temperature, radiation) **plus a separate peak-load element** for the design
  conditions (heating + cooling) from `ClimateRecord.peak_loads`. Header shows
  pinned version, distance·Δelev, fetched-on, default toggle. Reuse
  `ClimateRecordCharts`; add a peak-load component.
- **ASHRAE page (D-CL-23)** — design-condition tiles (Htg 99.6/99, Clg 1%
  DB/MCWB, Dehum DP 1%/MCDB) + a **link to ashrae-meteo.info** for the station;
  edition/`fetched_at` shown.
- **EPW page (D-CL-23)** — derived metrics (HDD/CDD, record high·low), a
  **link to epwmap / climate.onebuilding.org**, and the stored-file download.
- **Fail page** (e.g. Phius over 400 ft) — a CTA-forward page: "Certification
  blocker" hero with **Request custom set · $75** + **Browse to override**, a
  **"Why — nearest candidates"** table (each nearby station failing distance or
  elevation), and the prescriptive-path note.

## Units (D-CL-21 — resolved)

- **No per-tab °C/°F toggle** — obey the app-wide SI/IP preference; all data
  SI/IP-rendered. Remove the local toggle in `ClimateRecordView`/tab.
- **Solar radiation:** add an **IP radiation unit** to the registry —
  kBtu/ft²·mo (monthly), Btu/h·ft² (peak); SI stays kWh/m² · W/m².
  (≈ 1 kWh/m² = 0.317 kBtu/ft².) New — today's registry has no IP radiation
  form, so `ClimateRecordTable`/`Charts` radiation rows must localize.
- **HDD/CDD:** always **HDD65 / CDD50** (°F·days), fixed regardless of toggle.
- **Distance / Δelev:** localized (km·m / mi·ft), but the Phius limit is always
  cited as native **50 mi / 400 ft**.
- Degree-hours (kKh) + ground props stay SI.

## Reuse vs. replace (D-CL-24)

- **Replace/restructure:** `ClimateTab` (→ sidebar + page router),
  `ClimateSourcesSection` (→ sidebar nav cards), `ClimateDatasetBrowser` (→ a
  manual "add/override" surface, reachable from "＋ Add source").
- **Reuse inside pages:** `ClimateRecordTable` / `ClimateRecordCharts` (drop
  the °C/°F toggle), `SunPathDiagram`, the dataset search, the
  `project_climate_source` hooks/mutations.
- Selection can be route-driven (`/climate/:item`) or local state — decide in
  build; route-driven gives deep links per source.

## Folded-in follow-ups (D-CL-25)

Absorbed from the former `climate-tab-followups`:
- **Custom-record entry form** — enter a standardized `ClimateRecord` for a
  `custom` source, in the "＋ Add source" / override surface; also the escape
  hatch when Phius fails (P2 fail page → "enter custom record").
- **Sun-path cardinal labels** — N/E/S/W on the Location-page sun-path (above).
- **Attached-source charts** — this phase *is* that item, generalized (each
  attached source renders its own record, not just a browsed reference).
- **Docs:** promote the `ClimateRecord` contract to a `context/` reference doc
  (today it lives in `record.py` docstrings + the archived PRD §4.3).

## Tests

- vitest/Playwright: sidebar card per type with correct status/CTA; clicking
  shows the right page; Location page shows sun-path; Phius/PHI page shows
  monthly viz + peak-load element; ASHRAE/EPW pages show source links; fail
  page shows the CTA + candidates; viewer read-only (no address, no edit);
  units follow the app SI/IP toggle.
- `make ci` green + Playwright MCP visual pass (editor + viewer).

## Exit criteria

The tab renders as nav-sidebar + per-type pages; an attached source shows its
viz inline (PH = monthly + peak-load; ASHRAE/EPW = values + source link); the
Location page carries the sun-path; the fail page surfaces the custom-set CTA;
the old tab is replaced; gating + app-wide units hold; CI green.

## Open questions (phase-local)

- Compare UX (overlay vs side-by-side) — confirm when building the PH page.
- Route-driven selection vs local state.
