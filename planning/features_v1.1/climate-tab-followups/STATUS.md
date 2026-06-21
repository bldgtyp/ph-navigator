---
DATE: 2026-06-14
TIME: -
STATUS: Superseded (2026-06-21) — all items folded into
  planning/features/climate-auto-populate (D-CL-25).
AUTHOR: Claude (for Ed)
SCOPE: Backlog table + acceptance notes for the Climate-tab follow-ups.
RELATED:
  - README.md
  - planning/features/climate-auto-populate/ (where these now live)
  - planning/features/climate-auto-populate/decisions.md (D-CL-25)
---

# Climate tab follow-ups — Status

## Current state

**Superseded (2026-06-21).** All four items are folded into
`planning/features/climate-auto-populate/` (decision **D-CL-25**); no code was
written here. This folder is retained for history. Item → where it now lives:

| Item | Now in |
|---|---|
| Custom-record entry form | climate-auto-populate **P4** (＋ Add source / override) + **P2** (Phius-fail escape hatch) |
| Sun-path cardinal labels | climate-auto-populate **P4** (Location page sun-path) |
| Attached-source charts | climate-auto-populate **P4** (the per-type pages — this item, generalized) |
| Promote `ClimateRecord` → `context/` | climate-auto-populate **P4** (docs task) |

## Backlog (historical — for reference)

| Item | Size | Where it plugs in | Acceptance |
|---|---|---|---|
| Custom-record entry form | S–M | `frontend/src/features/climate/` (new form) + the existing `POST …/climate/sources` (`kind:"custom"`, `data:<ClimateRecord>`) | An editor can enter a full standardized record for a missing location and attach it as a `custom` source; viewer read-only; `make ci` green |
| Sun-path cardinal labels | S | `frontend/src/features/climate/components/SunPathDiagram.tsx` + `sun-path.ts` | N/E/S/W letters render at the correct compass azimuths, derived from the project true-north (passed in); empty/null state unchanged |
| Attached-source charts | M | `frontend/src/features/climate/` — resolve a `ProjectClimateSource` to a `ClimateRecord` (phius/phi `ref`→record via the dataset detail endpoint; `custom` `data`→record), then feed the Phase-3c `ClimateRecordView` | Selecting an attached source shows its monthly graphs/tables; ashrae/epw (no standardized record yet) degrade gracefully |
| Promote `ClimateRecord` to `context/` | S | `context/` (new reference doc) | The standardized-record contract has a single durable home in `context/`; the archived PRD §4.3 + `record.py` docstrings point to it |

## Next step

None here — track these under `climate-auto-populate` (P2/P4). Folder kept for
history only.
