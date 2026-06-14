---
DATE: 2026-06-14
TIME: -
STATUS: Deferred — independent backlog; no item blocks another.
AUTHOR: Claude (for Ed)
SCOPE: Backlog table + acceptance notes for the Climate-tab follow-ups.
RELATED:
  - README.md
---

# Climate tab follow-ups — Status

## Current state

**Deferred backlog.** Four independent refinements collected on 2026-06-14
when the Climate feature was archived. No code written for any of them.

## Backlog

| Item | Size | Where it plugs in | Acceptance |
|---|---|---|---|
| Custom-record entry form | S–M | `frontend/src/features/climate/` (new form) + the existing `POST …/climate/sources` (`kind:"custom"`, `data:<ClimateRecord>`) | An editor can enter a full standardized record for a missing location and attach it as a `custom` source; viewer read-only; `make ci` green |
| Sun-path cardinal labels | S | `frontend/src/features/climate/components/SunPathDiagram.tsx` + `sun-path.ts` | N/E/S/W letters render at the correct compass azimuths, derived from the project true-north (passed in); empty/null state unchanged |
| Attached-source charts | M | `frontend/src/features/climate/` — resolve a `ProjectClimateSource` to a `ClimateRecord` (phius/phi `ref`→record via the dataset detail endpoint; `custom` `data`→record), then feed the Phase-3c `ClimateRecordView` | Selecting an attached source shows its monthly graphs/tables; ashrae/epw (no standardized record yet) degrade gracefully |
| Promote `ClimateRecord` to `context/` | S | `context/` (new reference doc) | The standardized-record contract has a single durable home in `context/`; the archived PRD §4.3 + `record.py` docstrings point to it |

## Gate / depends on

- **All independent.** The first three only need the shipped Climate frontend
  + endpoints. The fourth is a pure docs move.
- Attached-source charts overlap conceptually with
  `../climate-design-conditions/` (both resolve a source to displayable data)
  — coordinate if both are picked up together.

## Next step

Pick any item; none blocks another. The custom-record form is the most
user-visible (it closes the only D-CL-9 gap left from Phase 3b).
