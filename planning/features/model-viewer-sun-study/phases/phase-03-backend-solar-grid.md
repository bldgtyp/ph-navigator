---
DATE: 2026-07-01
TIME: 18:05
STATUS: Pending
AUTHOR: Claude (for Ed)
SCOPE: Phase 03 — backend hourly solar-position grid on the existing
  /sun-path payload (PRD §6, D-1/D-2). Backend-only; no frontend changes.
RELATED:
  - ../PRD.md §6, §13, D-1/D-2
  - backend/features/project_location/sun_path.py
  - backend/features/project_location/sun_path_schemas.py
  - backend/tests/test_project_location_sun_path.py
---

# Phase 03 — Backend Solar-Position Grid

## Steps

1. `sun_path_schemas.py`: add `SunPositionGridSchema` per PRD §6.1
   (`hours: list[float]` 0..23, `days: list[int]` 1..365, `unit_vectors`
   row-major by day rounded to 4 decimals, `sunrise_sunset` per day with
   `None` tolerance) and a `sun_positions: SunPositionGridSchema` field
   on `SunPathAndCompassDTOSchema`. The app has no users and no
   backwards-compat constraint — the field is required, built alongside
   the dome in the same builder call.
2. `sun_path.py`: build the grid from the **same `Sunpath` instance**
   as the dome (`calculate_sun_from_date_time` / hoy, radius=1 frame;
   `calculate_sunrise_sunset`). Vectors must be in the identical
   unit-radius, true-north-baked frame as the analemma vertices —
   ladybug `Sun.position_3d(radius=1)` from that instance guarantees it.
   Below-horizon vectors included (z < 0).
3. Tests (extend `test_project_location_sun_path.py`):
   - shape: 365 rows × 24 columns, vectors ~unit length;
   - golden: Jun 21 solar-noon altitude ≈ 90° − |lat − 23.45°| (±1.5°)
     at West Stockbridge; azimuth due south (−Y) near solar noon;
   - frame-consistency: grid vector at (day, hour) coincides with the
     matching hourly-analemma vertex from the same build;
   - sunrise/sunset sanity vs published values (±20 min);
   - polar tolerance: extreme latitude yields None pairs, schema OK;
   - payload-size regression bound (serialized JSON < ~350 KB).
4. `uv run pytest tests/test_project_location_sun_path.py` + full
   backend suite.

## Exit criteria

All new tests green; MCP parity test still green (tool returns the
grid transparently); no frontend change required to keep compiling
(TS type extension happens in phase 04).

## Ledger

- (fill on completion)
