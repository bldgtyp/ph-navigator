---
DATE: 2026-06-22
TIME: 20:25 EDT
STATUS: ✅ Complete (2026-06-22) — P1 merge/rename + full design set, P2
  EPW-catalog roster + "Select from map" picker, P3 "Upload Climate Data"
  (EPW/STAT/DDY). All three asks delivered; backend + frontend tests green.
AUTHOR: Claude (for Ed)
SCOPE: State + resolved decisions for the Weather File merge.
RELATED:
  - README.md, PRD.md
---

# Weather File merge — Status

## Current state

**Planning.** Reviewed the live backend + frontend climate implementation
(see PRD §1). Key findings that shape the plan:

- The map picker UX Ed wants **already exists** for PHI/PHIUS
  (`ClimateDatasetPickerModal` + `ClimateMap`); the weather picker is a
  generalization + an EPW-catalog roster, not a new component.
- The `epw` source **already stores `design_conditions`**; the separate
  `ashrae` source is redundant. Merge = delete the duplicate + relabel.
- Only **4 new data fields** are needed (Cooling DB/MCWB at 0.4% and 2%); the
  rest of the requested metrics are already parsed.

## Decisions (resolved, Ed 2026-06-22)

1. **Source kind** — **rename `epw` → `weather`** (the bundle = epw+stat+ddy;
   EPW names only one part). Asset kinds stay file-typed `epw`/`stat`/`ddy`.
   PRD D1.
2. **Set affordances** — keep **"Set from nearest"** *and* **"Select from map"**
   as separate buttons (+ "Upload climate data"); user chooses. PRD D6.
3. **Picker scope** — **USA + state filter** for v1. PRD D4.
4. **ASHRAE current-edition** — **on-page "update design conditions" action**,
   not a sidebar item. PRD D3.

## Phases (vertical slices — each keeps app + CI green)

Detailed implementation plans in `phases/`:

- **P1 ✅ shipped** `phase-01-merge-rename.md` — merged + renamed `epw`→`weather`
  (+ data migration `0034`) + full design-condition set on one Weather File page.
  Asks #1 + #3. Cooling offsets pinned by the synthetic `.stat` fixture.
- **P2 ✅ shipped** `phase-02-map-picker.md` — EPW-catalog roster
  (`GET …/climate/epw-roster`) + from-catalog attach
  (`POST …/climate/sources/weather/from-catalog`); a dedicated
  `WeatherStationPickerModal` reusing `ClimateMap` (no cert gate). Marquee of #2.
- **P3 ✅ shipped** `phase-03-upload-modal.md` — "Upload Climate Data" modal
  (EPW/STAT/DDY) replacing `ProjectEpwControls`; `stat`/`ddy` asset kinds +
  from-upload attach. Completes the three-action row.

Order P1 → P2 → P3 — all complete.

## Next step

None — the feature is complete. The Weather File page now offers the full
three-action row (Set from nearest · Select from map · Upload climate data) with
the merged design-condition set, the map picker, and manual EPW/STAT/DDY upload.

## Cross-feature note

The design-condition set was completed + renamed here in P1 (the 0.4%/2% cooling
percentiles now parse; the kind is `weather`). A pointer was added to
`planning/features_v1.1/climate-design-conditions/STATUS.md`. This work does
**not** unblock that feature's gate (still needs a scheduled fRSI/comfort
consumer).
