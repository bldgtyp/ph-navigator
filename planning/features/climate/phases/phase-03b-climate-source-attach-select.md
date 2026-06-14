---
DATE: 2026-06-13
TIME: -
STATUS: Planned (next substantial Phase-3 slice after the 3a editor
  migration). Needs NEW backend — Phase 2 built only the app-wide
  reference datasets; there is no project-scoped "this project selected
  source X" model yet.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff — the project-climate source model + the tab
  UI to attach/select multiple climate sources per project (D-CL-4 / D-CL-9
  / D-CL-11).
RELATED:
  - phase-03-climate-tab-ui.md (§0 decomposition; 3a complete)
  - ../PRD.md §4.1 (sources), §5.3
  - ../decisions.md (D-CL-4 store-all-sources, D-CL-9 custom, D-CL-11
    per-analysis default)
  - backend/features/climate/ (app-wide datasets; this adds project scope)
  - frontend/src/features/climate/ (3a client; this adds attach/select UI)
---

# Climate Phase 3b — Source attach + select (deferred)

The "record + compare sources" half of the tab. 3a made the app-wide
reference datasets *browsable*; 3b lets a project **attach** one or more
climate sources (Phius/PHI location, ASHRAE pointer, EPW, custom) and mark
a **default**. This is the first Phase-3 slice that needs new backend.

## Why this needs new backend

Phase 2's `climate_dataset*` tables are **app-wide** (no `project_id`).
There is no model for "project P selected Phius location L / this ASHRAE
station / this uploaded EPW / this custom record". 3b introduces it.

## Scope

1. **Backend: `project_climate_source`.**
   - Migration + repository (raw SQL, per `CODING_STANDARDS.md`):
     `(id, project_id FK, kind, ref, label, is_default, data JSONB,
     created_at)` where `kind ∈ {phius, phi, ashrae, epw, custom}`.
     `ref` points at the app-wide location id for `phius`/`phi`; `data`
     JSONB holds the standardized `ClimateRecord` for `custom` (D-CL-9) and
     the cached values for `ashrae`; `epw` reuses the existing
     `project_location` EPW asset.
   - Routes: `GET/POST/PATCH/DELETE
     /api/v1/projects/{id}/climate/sources`, plus a
     `PUT …/sources/{sid}/default` (D-CL-11). MCP tools mirroring these
     (project-scoped — `project:read`/`project:write`).
   - A single project default source today; full per-consumer override
     lands with Phase 4's consumers.
2. **Frontend: attach/select UI in the Climate tab.**
   - **Phius/PHI:** browse (reuse 3a `ClimateDatasetBrowser`) → "Attach"
     pins the chosen location as a source.
   - **ASHRAE:** station id + URL input (link out to `ashrae-meteo.info`);
     store the pointer + any cached values (D-CL-4 keeps ASHRAE a pointer).
   - **EPW:** reuse the existing `project_location` EPW upload flow as a
     source.
   - **Custom (D-CL-9):** a form to enter a standardized record for a
     missing location.
   - A source roster with a default radio/flag (D-CL-11).
3. **Permissions.** Editor attaches/edits/sets default; viewer reads.

## Depends on / sequencing

- The **3a location-editor migration is complete** (the tab owns the
  location editor via `useProjectLocationForm`), so the source UI can sit
  alongside it directly.
- Unblocks the per-source visualization in **phase-03c** (3c renders the
  selected/active source) and feeds **Phase 4** (design conditions read
  the attached sources).

## Tests

- pytest: source CRUD + default-toggle + project scoping (a source is
  invisible to other projects); custom-record validation; MCP parity.
- vitest/Playwright: attach a Phius location and see it in the roster;
  set a default; viewer is read-only.
- `make ci` green.

## Exit criteria

- A project can attach Phius/PHI/ASHRAE/EPW/custom sources, all stored
  simultaneously (D-CL-4), with one marked default (D-CL-11); editor/viewer
  gating holds; routes + MCP live; `make ci` green.
