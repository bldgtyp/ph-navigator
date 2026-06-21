---
DATE: 2026-06-21
TIME: -
STATUS: Deferred
AUTHOR: Claude (for Ed)
SCOPE: State + gate for the auto-derived rain-exposure-class Climate metric.
RELATED:
  - README.md
  - PRD.md
  - ../climate-design-conditions/STATUS.md
---

# Rain Exposure Class — STATUS

**Status:** `Deferred` — candidate captured for later evaluation. Not
scheduled. Originated from Ed's 2026-06-21 research into Straube's rain-control
framework + the PNNL BASC / BEMMI annual-rainfall thresholds.

## Gate / dependencies

1. **EPW-metrics layer.** Cleanest to build on (or alongside)
   `climate-design-conditions`, which already owns EPW parsing via
   `ladybug-core`, the compute-once-by-EPW-asset-id pattern, and the per-source
   `basis` contract. Could ship standalone, but would then duplicate that
   parser — avoid.
2. **Annual-rainfall source decided (RX-1).** The one missing input. EPW's
   liquid-precipitation column is often blank/zero; pick a validated source +
   fallback before trusting the number.
3. No scheduled consumer required — this is an advisory display metric — so
   the only real blocker is (2), and (1) is a strong sequencing preference.

## Already in place (reduces the build)

- **Mean annual wind speed** is already a `ClimateRecord` field
  (`average_wind_speed_ms`, plus Jan/Jul) — no new ingest needed for the wind
  input.
- Per-source contract shape + `basis` convention already designed in
  `climate-design-conditions` — reuse, don't reinvent.
- Filter-chip styling (`report-status-chip`) exists for the tier chip.

## Open decisions (see PRD §6)

- **RX-1** Annual-rainfall source + fallback chain (EPW-validated → ASHRAE →
  NOAA/PRISM normals → user override).
- **RX-2** Classification standard: scalar BEMMI/BASC bands for v1; DRI as an
  additive readout; ISO 15927-3 directional as a later upgrade.
- **RX-3** Scalar (whole-building) v1 vs. per-orientation driving-rain rose.
- **RX-4** Keep the cladding output advisory + cited, not a code determination.

## Next step

When promoted: resolve RX-1, then implement the backend derive-on-read metric
+ endpoint/MCP reusing the `climate-design-conditions` EPW-metrics layer, then
the Climate-tab card. No code written yet.

## Verification (when built)

- Backend unit test: a NYC-metro EPW fixture (~40–50 in/yr) → `exposure_class:
  "severe"`; a sentinel/zeroed-precip EPW → `confidence: "low"` + fallback
  path, not a false "sheltered".
- `make ci` green; Climate-tab card renders tier + cited strategy.
