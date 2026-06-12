---
DATE: 2026-06-12
TIME: 17:19 EDT
STATUS: Active — implementation sequence for Phases 1–3.
AUTHOR: Claude (for Ed)
SCOPE: High-level phase map, dependency graph, and sequencing for the
  Project Location feature. Per-phase handoffs in phases/.
RELATED:
  - planning/features/project-location/PRD.md
  - planning/features/project-location/decisions.md
  - planning/features/project-location/phases/phase-01-location-backbone.md
  - planning/features/project-location/phases/phase-02-location-ui.md
  - planning/features/project-location/phases/phase-03-epw-linkage.md
---

# Project Location — Implementation Plan

Three phases. Phase 1 is the critical path and **unblocks the
model-viewer location data dependency on its own** (lat/long/north
become readable via REST + MCP). Phases 2 and 3 make it a usable
product feature. The sun-path wiring is deferred to model-viewer
(decisions.md D-PL-2; seam in PRD §10) and is **not** a phase here.

## Phase map

| Phase | Title | Layer | Unblocks |
|-------|-------|-------|----------|
| 1 | Location backbone | backend (new `project_location` module + table + REST + MCP) | model-viewer data dependency; everything below |
| 2 | Location UI | frontend (Project Settings section) | human-usable location editing |
| 3 | EPW linkage | backend + frontend (asset_kind, parse, apply, warnings) | climate provenance; future climate consumers |

## Dependency graph

```
Phase 1 (BE: table + GET/PUT /location + MCP get_project_location)
   │   └── unblocks → model-viewer sun-path DATA seam (PRD §10)
   ▼
Phase 2 (FE: Location section in ProjectSettingsModal)
   ▼
Phase 3 (EPW: asset_kind='epw' + parse/apply/warn)

(model-viewer sun-path WIRING — separate, owned by model-viewer,
 scheduled when MV Phase 2 + Phase 6 are merged; consumes Phase 1.)
```

Phase 1 has no dependency beyond the existing `projects`, `assets`,
and `mcp` features (all built). Phase 2 needs Phase 1's API. Phase 3
needs Phases 1–2 plus the existing R2 asset system. Phases 2 and 3
together are the product surface; once Phase 2 lands, Phase 3's
backend (asset_kind + parse endpoint) and its frontend (uploader +
apply) can proceed as one slice.

## Sequencing notes

- **Ship Phase 1 first and independently.** It is small (one new
  module mirroring the projects feature), fully testable with pytest,
  and is the only thing the deferred sun-path wiring actually needs.
  Landing it early lets the model-viewer integration be scheduled the
  moment MV Phases 2 + 6 are ready, with zero further backend work
  here.
- **Phase 2 before Phase 3's UI.** The EPW uploader and "apply parsed
  values" affordance live *inside* the Location section built in
  Phase 2; don't build the EPW UI against a non-existent section.
- **Phase 3 backend can start in parallel with Phase 2** if desired
  (asset_kind migration + registry + parse endpoint are independent of
  the UI), but the user-visible EPW flow needs Phase 2's section.

## Cross-feature contracts touched

- `backend/features/assets/registry.py` + the `project_assets`
  `asset_kind` CHECK constraint (new migration) — Phase 3 only.
- `backend/features/mcp/server.py` — register one new read tool —
  Phase 1.
- `frontend/src/features/assets/types.ts` `AssetKind` union — Phase 3.
- `frontend/src/features/projects/` types/hooks + `ProjectSettingsModal`
  — Phases 2–3.
- **No** changes to the `projects` table or the projects feature's
  write path (D-PL-1 keeps location in its own module).

## Closeout (every phase)

`make format` + `make ci` green (mandatory gate, CLAUDE.md). Frontend
iterations may use `make frontend-dev-check` for fast feedback but the
full gate is still required before "done." Run `graphify update .`
after code changes. Fold any accepted drift back into PRD.md /
decisions.md / context per planning/.instructions.md.
