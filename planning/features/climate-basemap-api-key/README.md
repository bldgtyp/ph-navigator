# Climate Basemap API Key

DATE: 2026-10-24
TIME: 15:33 EDT
STATUS: `Scoped` — packet drafted, awaiting Ed's review before implementation
AUTHOR: Claude (with Ed May)
SCOPE: Frontend-only change restoring real CARTO Positron basemap tiles across
the climate-area maps by carrying the new CARTO Basemaps API key in the tile
URL templates. No backend, data-model, or persistence changes.
RELATED: `planning/archive/dated/2026-06-22/climate-dataset-picker/` (D-DP-6,
the original keyless-basemap decision this supersedes)
ISSUE: https://github.com/bldgtyp/ph-navigator/issues/103

## Read order

1. `PRD.md` — what and why (the broken keyless assumption, the behavior contract).
2. `PLAN.md` — the step-by-step implementation sequence you will review.
3. `STATUS.md` — state, verification, blockers.

## Phase map

Single-phase implementation (`PLAN.md`); no `phases/` breakdown is warranted
for a change of this size. The map surface code, the tile-loading tracker, and
the test fallback contract are all touched by one coherent edit set.
