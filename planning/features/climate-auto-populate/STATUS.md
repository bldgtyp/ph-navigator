---
DATE: 2026-06-21
TIME: -
STATUS: Active — planning COMPLETE; all design decisions accepted
  (D-CL-12..24, O-units). Ready to implement. Open items are operational only.
AUTHOR: Ed (via Claude)
SCOPE: Current state of the climate auto-populate feature.
RELATED:
  - README.md, PRD.md, decisions.md, research.md
  - phases/phase-01..04
---

# Climate Auto-Populate — Status

## Current state

`Active — planning`. PRD, decisions, research, and four phase plans logged.
No code changes yet. Builds on the shipped climate store (archived Phases
1–3): app-wide Phius/PHI datasets, `project_climate_source`, sun-path, and the
dataset browser all exist and are reused.

## Next step

Planning is complete — all design decisions accepted (D-CL-12..24, O-units).
**Ready to implement.** Suggested entry points:

1. **P4 (the new tab)** can lead independently for an early UX win — nav
   sidebar + per-type pages (D-CL-20), styled with app CSS/brand tokens (the
   wireframe `working/climate-tab-wireframe-B2.html` is structure only).
2. **P1 (address + geocoding + derived geodata)** is the foundation for the
   auto-populate engine; P2 then P3 follow.
3. Before P2 ships proximity flags, confirm **O5** (seeded Phius/PHI dataset
   versions are a valid current cert basis). Procure **O4** keys (MapTiler /
   Open-Meteo) before relying on free tiers.

Remaining open items are operational only: O4 (API keys), O5 (dataset
versions), O6 ("custom set required" workflow + custom-record editor), O7
(EPW catalog refresh cadence).

## Blockers

- **O1–O3** (design decisions) — not hard blockers; recommendations stand if
  Ed defers.
- **O5** — confirm the seeded Phius/PHI dataset versions are a valid current
  cert basis before P2 ships proximity flags against them.
- **O4** — commercial API keys (MapTiler / Open-Meteo) needed before relying
  on free tiers in production.

## Files expected to change (high level — detail per phase)

- **Backend** — new `backend/features/climate/derive/` (or extend
  `project_climate_source/service.py`): external API clients (MapTiler proxy
  optional, EPQS, FCC/Census), the PNNL CSV + county→zone lookup, the EPW
  catalog + `.stat` parser, the ashrae-meteo client, the haversine proximity
  gate. New migration only if we add columns beyond `data` JSONB (not expected).
- **Frontend** — `frontend/src/features/climate/`: address modal +
  MapTiler component, the derive action, the roster visualization refactor
  (re-point `ClimateRecordView` at attached sources), public location
  projection. `frontend/src/features/projects/` location editor/summary
  adjustments for the privacy split.
- **Repo data** — `climate_zones.csv` (PNNL 2021 IECC, public domain).

## Verification plan

Per-phase `make ci` green + Playwright MCP visual pass on the Climate tab
(editor + viewer), plus focused pytest for each derive routine and the
proximity-gate math. Privacy check: the public projection / viewer DOM never
contains the address string.
