---
DATE: 2026-06-13
TIME: -
STATUS: COMPLETE (2026-06-14) — backend (project_climate_source table +
  migration, repository/service, REST CRUD + set-default routes,
  project-scoped MCP) **and** the frontend attach/select UI (sources roster +
  default radio + Phius/PHI/ASHRAE/EPW attach) both landed; `make ci` green.
  Only the **custom-record entry form** is deferred (backend supports the
  `custom` kind; a full standardized-record editor is a follow-up). See
  §Outcome.
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

# Climate Phase 3b — Source attach + select

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

## Outcome — backend (2026-06-14)

New `backend/features/project_climate_source/` module + migration
`20260614_0026`, mirroring the `project_location` feature patterns:

- **migration** — `project_climate_source (id, project_id FK CASCADE, kind
  CHECK ∈ {phius,phi,ashrae,epw,custom}, ref, label, is_default, data JSONB,
  created_at, updated_at)`; a `project_id` index and a **partial-unique index
  on `(project_id) WHERE is_default`** enforcing one default per project
  (D-CL-11).
- **models.py** — `ProjectClimateSourcePublic` + list/create/update requests;
  `validate_source_shape()` is the shared presence-rule check (custom needs
  `data`+no `ref`; phius/phi/ashrae/epw need `ref`; only custom/ashrae may
  carry `data`), run by the create `model_validator` and re-run in the
  service for the merged PATCH shape.
- **repository.py** — raw SQL list/get/insert/update (dynamic SET over an
  allow-list)/delete + `clear_default`/`mark_default` + a
  `get_dataset_location_provider` join for ref validation.
- **service.py** — per-kind validation against live data (phius/phi: the
  referenced `climate_dataset_location` exists **and its provider matches the
  kind**; epw: the project EPW asset exists + is uploaded; custom: `data`
  validates as a `ClimateRecord`), one-default enforcement (clear-then-mark
  in one transaction so the partial-unique index never sees two defaults),
  and audit logging on every mutation.
- **routes.py** — `GET/POST` `…/climate/sources`, `PATCH/DELETE
  …/sources/{sid}`, `PUT …/sources/{sid}/default`; view access reads, editor
  writes.
- **mcp.py** — project-scoped `list_project_climate_sources` (`project:read`)
  and `set_project_climate_source_default` (`project:write`); create/patch/
  delete stay REST-only, matching the read-mostly `project_location` MCP
  surface.
- **tests** — `tests/test_project_climate_source.py`: CRUD, default toggle,
  project-scoping isolation, per-kind validation, editor/viewer gating, MCP
  parity + scope gating. `make ci` green.

## Outcome — frontend (2026-06-14)

The `features/climate/` client gained a project-scoped source layer
(`types`/`query-keys`/`api`/`hooks`/`lib`, section-headered alongside the
app-wide reference-dataset client): `useClimateSourcesQuery` +
create/delete/set-default mutations (one shared `invalidateClimateSourceQueries`
helper, matching `project_document`/`projects` hooks).

- **`ClimateSourcesSection`** — the attached-source roster with the default
  radio (D-CL-11), a remove button, plus the non-dataset attach affordances:
  an **ASHRAE** station/URL form and an **attach project EPW** button (wired to
  `project_location`'s EPW asset). Editor-gated; viewers get a read-only
  roster.
- **`ClimateDatasetBrowser`** gained an optional `onAttach` — selecting a
  Phius/PHI location shows **"Attach as source"** (kind = the dataset
  provider).
- **`ClimateTab`** owns one `useCreateClimateSourceMutation` and funnels every
  attach affordance through it (single pending/error surface, error shown in
  the sources section).
- Tests: `features/climate/__tests__/ClimateSourcesSection.test.tsx` (roster +
  default reflection, ASHRAE/EPW attach payloads, set-default, remove, viewer
  read-only).

**Deferred (small follow-up):** the **custom-record entry form** — attaching a
`custom` source needs a full standardized-`ClimateRecord` editor; the backend
already accepts it, but the UI is out of this slice.
