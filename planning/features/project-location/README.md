---
DATE: 2026-06-12
TIME: 18:08 EDT
STATUS: Active — Phase 3 complete. Backend location backbone,
  frontend Project Settings location UI, and EPW linkage are
  implemented with focused tests, `$ simplify`, `$ docs-pass`,
  `make format`, `make ci`, and `graphify update .` complete.
AUTHOR: Claude (for Ed)
SCOPE: Router for the Project Location feature — scope, read order,
  phase map. Expanded from the 2026-06-12 handoff stub (now in §
  "Origin") into a full PRD + plan per Ed's direction.
RELATED:
  - planning/features/model-viewer/decisions.md (D-07 origin;
    sun-path consumer — wiring deferred back to model-viewer)
  - context/PRD.md §4 (access), §6.1 (relational layer), §11.5 (SI)
  - backend/features/assets/registry.py (EPW asset kind — Phase 3)
---

# Project Location

A durable, project-level **Location** section — latitude, longitude,
elevation, time zone, true-north, display address — with a robust link
to an uploaded **EPW** weather file that can pre-fill those fields and
stay on hand for future climate-aware work. Editors edit; public
viewers read. SI-canonical on the wire; MCP-readable day one.

Location is durable project metadata (context/PRD.md §6.1), stored in
its own 1:1 relational table — never in the versioned project
document.

## Read order

1. **PRD.md** — product + behavior contract; resolves the storage fork
   and defines the REST + MCP surface, validation, units, UI, and the
   deferred sun-path seam.
2. **decisions.md** — the resolved forks (D-PL-1 storage, D-PL-2
   sun-path deferral, D-PL-3 EPW parse ownership, D-PL-4 true-north
   convention, D-PL-5 API shape) with rationale.
3. **PLAN.md** — phase map + dependency graph + sequencing.
4. **phases/** — implementation handoffs:
   - `phase-01-location-backbone.md` — backend module, table, REST,
     MCP (critical path; unblocks the model-viewer data dependency).
   - `phase-02-location-ui.md` — Location section in Project Settings.
   - `phase-03-epw-linkage.md` — EPW asset kind, parse, apply, warn.
5. **STATUS.md** — current state, next step, blockers.

## Phase map (at a glance)

| Phase | Title | Layer |
|-------|-------|-------|
| 1 | Location backbone | backend (`project_location` module + table + REST + MCP) — complete |
| 2 | Location UI | frontend (Project Settings section) — complete |
| 3 | EPW linkage | backend + frontend (asset_kind, parse, apply, warnings) — complete |

The model-viewer **sun-path wiring** is the known consumer but is
**not** a phase here — it is deferred to model-viewer (decisions.md
D-PL-2). Phase 1 satisfies its data dependency; PRD §10 documents the
seam so the wiring is a clean, scheduled handoff once model-viewer
Phases 2 + 6 are merged.

## Origin

Created from model-viewer **OQ-1 / D-07** (Ed, 2026-06-12): a sun path
needs only project location, V2 had no location store, and Ed directed
building a proper Location section with robust EPW linkages rather than
a one-off field. The original requirements stub is preserved in git
history (this README's pre-2026-06-12 revision) and fully absorbed
into PRD.md.
