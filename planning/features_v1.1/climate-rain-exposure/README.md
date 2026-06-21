---
DATE: 2026-06-21
TIME: -
STATUS: Deferred — candidate. Best built on top of the EPW-metrics layer
  (climate-design-conditions); can ship standalone if prioritized.
AUTHOR: Claude (for Ed)
SCOPE: Router for an auto-derived "rain exposure class" climate metric —
  computed from annual rainfall + mean wind (EPW / ASHRAE) and surfaced on
  the Climate tab as a wall-cladding-strategy indicator.
RELATED:
  - PRD.md
  - STATUS.md
  - ../climate-design-conditions/PRD.md  (sibling EPW-derived metric layer)
  - ../climate-tab-followups/STATUS.md   (other small Climate-tab refinements)
  - ../../archive/climate/ (the complete Climate feature this extends)
  - backend/features/climate/record.py (ClimateRecord — already carries wind)
---

# Climate — Rain Exposure Class

Add an **automatically calculated rain-exposure classification** to the
Climate tab. From a project's attached climate source (EPW-derived and/or
ASHRAE), derive the two inputs that govern wind-driven-rain load on a wall —
**annual rainfall** and **mean annual wind speed** — and classify the site
into a rain-exposure tier (e.g. *sheltered / moderate / severe*). The tier
maps to a wall-cladding-strategy hint (when a rainscreen / drained cavity is
warranted, and the recommended minimum airspace), each line cited back to its
source.

This is the building-science metric Ed researched on 2026-06-21:
Straube's rain-control framework (BSD-018 → BSD-013) operationalized by the
PNNL **Building America Solution Center** + **BEMMI** annual-rainfall
thresholds. See `PRD.md` §References for the full citation list.

## Why this is a good fit

- The inputs are already in (or one parse away from) the Climate data store:
  **mean wind speed is already a `ClimateRecord` field**
  (`average_wind_speed_ms`); annual rainfall is the one missing input.
- It is a pure derived-on-read metric — no new user data entry, no new
  document-versioned state. It rides the existing "compute once, key off the
  immutable EPW asset id" pattern (D-15).
- It gives the design-phase HUGO report a defensible, sourced enclosure-risk
  signal for free from data the project already attaches.

## Why deferred / gated

1. **Shares EPW-parsing infrastructure with `climate-design-conditions`.**
   That sibling feature already owns "parse EPW with `ladybug-core`, derive
   metrics, expose per-source with a `basis` field." Rain exposure should
   reuse it rather than stand up a second EPW parser. Cleanest sequencing:
   build (or co-build) with that layer.
2. **Annual-rainfall data source is unresolved** (the central risk — see PRD
   §3). EPW's liquid-precipitation column is frequently missing/zero; a
   fallback source must be chosen before the number can be trusted.
3. No scheduled consumer yet — this is an advisory display metric, valuable
   but not blocking v1.

## Read order

1. `PRD.md` — the metric definition, inputs, data-source risk, output
   contract, open decisions, and citations.
2. `STATUS.md` — the gate, dependencies, and open decisions to resolve before
   building.
