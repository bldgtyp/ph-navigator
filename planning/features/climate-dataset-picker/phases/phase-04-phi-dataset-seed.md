---
DATE: 2026-06-22
TIME: -
STATUS: **PLANNED** — not started. Pulled out of the shipped P1–P3 work as the
  one remaining follow-up (O-DP-5). Blocked on a **data/ops** dependency (a PHI
  dataset for the dev DB), not on code. No schedule.
AUTHOR: Ed (via Claude)
SCOPE: P4 — seed a PHI climate dataset in the dev DB and exercise the PHI
  instance of the picker (and the PHI advisory proximity semantics) end-to-end.
  The picker's PHI half is already built and shipped (shared component, P2b/P3)
  but has never run against real PHI data, because the dev DB seeds only
  Phius/NY today.
RELATED:
  - ../PRD.md §3 (PHI advisory semantics), §11 (out of scope: dev-DB PHI seeding)
  - ../decisions.md O-DP-5 (PHI dataset availability — the open question)
  - ../STATUS.md (feature complete; O-DP-5 the only open item)
  - phases/phase-01 (the roster endpoint + dataset/location tables this reuses)
  - planning/features/climate-auto-populate/ (parent O5 — same seed gap)
---

# Phase 4 — PHI dataset seed + PHI picker verification (PLANNED)

> **Status: planned, not scheduled.** P1–P3 shipped the full picker — including
> the PHI instance, which is the *same* generic `ClimateDatasetPickerModal` /
> `<ClimateMap>` mounted with `kind="phi"`. What's missing is **data**: the dev
> DB has only the Phius/NY dataset seeded, so the PHI path has only ever been
> exercised against its empty-state (`dataset:null`). This phase lands once a
> PHI dataset is available for dev (O-DP-5). It is **not** required to call the
> picker feature done; it closes the last verification gap.

## Goal

Run the PHI instance of the picker against a **real seeded PHI dataset** and
confirm the PHI-specific behaviour the code already implements but that has
never been seen live:

- the roster endpoint resolves the pinned **PHI** dataset for `kind="phi"` and
  returns its stations with per-station proximity;
- the picker lists PHI stations nearest-first, plots them on the basemap, and
  attaches the chosen one to the project's `kind="phi"` `project_climate_source`
  row (independent of the Phius row, D-DP-1);
- **PHI advisory semantics** (PRD §3/§8): distance/Δelev shown, a *soft*
  50 mi/400 ft warning, no hard pass/fail gate — selecting a far station
  attaches `status:"warning"` with the "confirm representativeness with the
  certifier" note, never a blocking `status:"fail"`.

## Precondition — the PHI seed (O-DP-5, data/ops)

A PHI climate dataset must exist for the dev DB: one `climate_dataset` row
(provider `phi`, pinned version) plus its `climate_dataset_location` rows
(name/region/lat/long/elevation/zone/`data`=`ClimateRecord`). Source + license
of the PHI station data is the open question (must respect the public-repo /
licensed-data rule — route any licensed source data through the private object
store, never commit it). Until this lands, the PHI picker correctly shows its
"No PHI dataset is available yet" empty state.

## Work (once the seed exists)

1. **Seed path.** Add a dev seed for the PHI dataset mirroring the existing
   Phius seed (same tables, same shape) — a script/fixture, not committed
   licensed data.
2. **Verify the roster endpoint** returns PHI stations with proximity for
   `kind="phi"` (the math + sort are already the shared seam from P1; this is a
   data-driven check, likely no code change).
3. **Confirm advisory attach** writes `status:"warning"` (not `"fail"`) for a
   far PHI station and surfaces the certifier note — fix the PHI branch only if
   the live data exposes a gap.

## Tests

- Backend: a focused pytest seeding a small PHI dataset and asserting the roster
  endpoint + advisory attach payload for `kind="phi"`.
- Frontend: the picker modal already has a `kind="phi"` test path; extend it /
  the Playwright pass to drive a *seeded* PHI roster (today it only asserts the
  unseeded empty state).
- `make ci` green.

## Exit criteria

From the PHI page the editor opens the picker, sees real PHI stations on the
basemap, and attaches one with advisory (`warning`, never `fail`) semantics;
the PHI `project_climate_source` row is independent of the Phius one; backend +
frontend tests cover the seeded PHI path; no licensed data is committed (public
repo); `make ci` green. **O-DP-5 closed.**
