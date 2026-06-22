---
DATE: 2026-06-21
TIME: 13:52 EDT
STATUS: Complete — merged to main (2026-06-22).
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

## Implementation notes

> **UI fidelity pass (2026-06-21).** The first cut *approximated* the
> wireframe; the tab now renders B2's full structure on app tokens —
> sidebar location card (decorative map placeholder + coords/elev/zone
> pills + privacy marker), a "Climate sources" divider, per-type colour
> **badges** (token-driven via `data-kind`), status-colored card edges,
> **default ★** markers, **OK/Check/Fail LED status chips**, inline CTAs,
> and a dashed add affordance. Detail pages gained a shared page-head
> (badge + status chip + metadata + Set-default/Remove actions), the
> Phius/PHI **peak-load tiles**, and the fail-page **"Certification
> blocker" hero** + candidate verdict table. The Location page is now
> read-first (facts grid + map) with an **Edit ▸** reveal of
> the existing editor. The decorative map is a placeholder pending the
> MapTiler key (O4). New shared atoms live in `components/ClimateAtoms.tsx`
> (`ClimateTypeBadge`, `ClimateStatusChip`, `LocationPrivacyTag`).
> **D-CL-21 fix:** ASHRAE/EPW/peak temperature tiles previously hardcoded
> `°C`; they now route through `formatTemperatureFromC` and follow the
> app-wide SI/IP preference.

- `ClimateTab` is now a local-state master-detail router with a sticky source
  sidebar and one main detail page at a time.
- `ClimateSourceDetailPage` renders PH/Phius reference records through
  `ClimateRecordCharts` + `ClimateRecordTable`, ASHRAE design-condition tiles,
  EPW STAT metric tiles + source/download links, custom records, and a Phius
  fail page with custom-set CTA plus candidate rows when present in source
  data.
- `ClimateSourcesSection` remains the Add/re-populate surface and now includes
  ASHRAE pointer attach, project EPW attach, custom `ClimateRecord` JSON attach,
  and the dataset browser below it.
- `ClimateRecordTable` and `ClimateRecordCharts` now localize radiation for
  the app-wide unit preference: SI `kWh/m²` / `W/m²`; IP `kBtu/ft²·mo` /
  `Btu/h·ft²`.
- *(Superseded 2026-06-22)* `SunPathDiagram` and the Climate-page 2D
  sun-path panel were removed; site/sun visualization belongs in the Model tab.

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
  auth-gated Set Location workflow. Edit opens the address modal (P1). The
  former 2D sun-path visual was removed on 2026-06-22; use the Model tab for
  site/sun visualization.
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
  the °C/°F toggle), the dataset search, the
  `project_climate_source` hooks/mutations.
- Selection can be route-driven (`/climate/:item`) or local state — decide in
  build; route-driven gives deep links per source.

## Folded-in follow-ups (D-CL-25)

Absorbed from the former `climate-tab-followups`:
- **Custom-record entry form** — enter a standardized `ClimateRecord` for a
  `custom` source, in the "＋ Add source" / override surface; also the escape
  hatch when Phius fails (P2 fail page → "enter custom record").
- **Sun-path cardinal labels** — superseded 2026-06-22; the Climate Location
  page no longer owns a 2D sun-path visual.
- **Attached-source charts** — this phase *is* that item, generalized (each
  attached source renders its own record, not just a browsed reference).
- **Docs:** promote the `ClimateRecord` contract to a `context/` reference doc
  (today it lives in `record.py` docstrings + the archived PRD §4.3).

## Tests

- vitest/Playwright: sidebar card per type with correct status/CTA; clicking
  shows the right page; Location page shows the site map/facts and Set
  Location workflow; Phius/PHI page shows monthly viz + peak-load element;
  ASHRAE/EPW pages show source links; fail page shows the CTA + candidates;
  viewer read-only (no address, no edit); units follow the app SI/IP toggle.
- `make ci` green + Playwright MCP visual pass (editor + viewer).

## Exit criteria

The tab renders as nav-sidebar + per-type pages; an attached source shows its
viz inline (PH = monthly + peak-load; ASHRAE/EPW = values + source link); the
Location page carries map/facts and the Set Location workflow; the fail page
surfaces the custom-set CTA; the old tab is replaced; gating + app-wide units
hold; CI green.

## Open questions (phase-local)

- Route-driven selection was intentionally deferred; local state keeps the P4
  replacement narrow and avoids router churn.
- The "nearest candidates" fail table renders when candidate rows are present
  in source data; backend candidate-population can be expanded later without
  another frontend surface change.

## Verification

### UI fidelity pass (2026-06-21)

- `cd frontend && pnpm exec vitest run src/features/climate` — 34 passed
  (8 files); `pnpm exec tsc --noEmit` — passed.
- `ClimateTab.test.tsx` extended: asserts the read-first location facts
  (county/state + zone), the sidebar OK status chips, and the Edit-reveal
  of the editor. The ASHRAE temp assertion moved from the old hardcoded
  `-18.8 °C` to the app-units `-18.8 deg C` (D-CL-21).
- Live Playwright (codex@example.com, project `3a7d86b5-…`): Location,
  Phius (peak-load tiles + Table/Charts), and ASHRAE (design tiles) pages
  render the B2 structure; the top-bar SI↔IP toggle flips every temperature
  tile and the elevation pill (`290.6 m` ↔ `953.4 ft`).

### Initial implementation (2026-06-21)

- `cd frontend && pnpm exec vitest run src/features/climate/__tests__/ClimateRecordTable.test.tsx src/features/climate/__tests__/chart-data.test.ts src/features/climate/__tests__/ClimateSourcesSection.test.tsx src/features/climate/__tests__/ClimateTab.test.tsx src/features/climate/__tests__/sun-path.test.tsx` — 19 passed.
  *(Historical 2026-06-21 gate; `sun-path.test.tsx` was removed on 2026-06-22
  with the Climate-page sun-path panel.)*
- `cd frontend && pnpm exec tsc --noEmit` — passed.
- Playwright live smoke on project
  `3a7d86b5-60b5-4186-998b-d0388f19852f` — passed for Location, EPW, and mobile
  ASHRAE pages. Screenshots: `/tmp/phn-climate-p4-location.png`,
  `/tmp/phn-climate-p4-epw.png`,
  `/tmp/phn-climate-p4-mobile-ashrae-fixed.png`.
- `make format` — passed.
- `make ci` — passed: backend `935 passed, 2 skipped`; frontend `187` test
  files / `1787` tests passed; Vite build passed.
