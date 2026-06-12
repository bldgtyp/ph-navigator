---
DATE: 2026-06-12
TIME: 18:08 EDT
STATUS: Active — Phase 1 complete
AUTHOR: Claude (for Ed)
SCOPE: Status ledger for the Project Location feature.
RELATED:
  - planning/features/project-location/README.md
  - planning/features/project-location/PRD.md
  - planning/features/project-location/PLAN.md
  - planning/features/project-location/decisions.md
---

# Project Location — Status

`Active — Phase 1 complete.` Requirements stub (2026-06-12) expanded
into a full PRD + 3-phase plan. The two open forks are resolved
(decisions.md): **dedicated `project_location` table + module**
(D-PL-1) and **sun-path wiring deferred to model-viewer** (D-PL-2).
Phase 1 backend code now exists, `make format` + `make ci` pass, and
the code graph has been updated.

## Phases

| Phase | Title | State |
|-------|-------|-------|
| 1 | Location backbone (BE: table + REST + MCP) | Complete — REST + MCP live, tested, formatted, CI-green, graph updated |
| 2 | Location UI (FE: Project Settings section) | Planned — depends on Phase 1 |
| 3 | EPW linkage (BE+FE) | Planned — depends on Phases 1–2 |

## Phase 1 implementation ledger

- [x] Added Alembic revision `20260612_0023_project_location.py`
  creating the 1:1 `project_location` table.
- [x] Added `backend/features/project_location/` with Pydantic
  models, raw-SQL repository, service transaction boundary, REST
  routes, and MCP read tool.
- [x] Registered `GET/PUT /api/v1/projects/{id}/location` and
  `get_project_location`.
- [x] Added focused backend tests in `backend/tests/test_project_location.py`
  for validation, public read, editor write, explicit-null clears,
  write auth, MCP read, and MCP project-scope rejection.
- [x] Updated existing backend test truncation fixtures to include the
  new FK-owned `project_location` table.
- [x] `/simplify` pass complete: extracted shared blank-string
  normalization, reused existing MCP test helpers, and kept MCP tool
  registration on the existing `features.mcp.tools` import surface.
- [x] `/docs-pass` complete: no new context/ADR doc required; this
  feature status ledger remains the right durable status record.
- [x] Focused verification passed:
  `cd backend && uv run pytest tests/test_project_location.py`;
  `cd backend && uv run ruff check features/project_location tests/test_project_location.py`;
  `cd backend && uv run ty check features/project_location tests/test_project_location.py`.
- [x] `make format` passed.
- [x] `make ci` passed: backend Ruff format/check, Ty, Alembic
  upgrade, pytest (`748 passed, 2 skipped`); frontend Prettier check,
  ESLint, structural checks, Vitest (`1549 passed`), and production
  build.
- [x] `graphify update .` passed.

## Next step

Implement **Phase 2** (`phases/phase-02-location-ui.md`): Project
Settings Location UI wired to the Phase 1 `/location` API.

## Blockers

None for Phases 1–3.

## Deferred / external

The model-viewer **sun-path wiring** (populating the `sun_path` wire
key via `Sunpath.from_location`) is owned by model-viewer, not this
plan (decisions.md D-PL-2). It is schedulable once model-viewer
Phase 2 (extraction + ladybug dep) and Phase 6 (renderer stub) are
merged; the seam is specified in PRD §10. Until then the Site & Sun
lens shows the building + shades + a "Set project location" hint, and
this feature's Phase 2 UI is where that location is set.
