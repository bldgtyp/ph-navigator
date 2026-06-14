---
DATE: 2026-06-13
TIME: -
STATUS: In progress (2026-06-13) — decomposed into 3a/3b/3c (see §0).
  Sub-phase **3a COMPLETE** (tab + reference-dataset browser + record tables
  + the migrated location editor; Settings now read-only; `make ci` green).
  3b (project-climate source model + attach/select; needs new backend) and
  3c (charting + sun-path visual) follow.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff — the Climate top-level tab: location
  record + multi-source attach/select + per-source visualization.
RELATED:
  - ../PRD.md §5.3 (and §4.1 sources, §4.3 record)
  - ../decisions.md (D-CL-3 tab, D-CL-4 sources, D-CL-9 custom, D-CL-11)
  - phase-01-sun-path-service.md
  - phase-02-reference-datasets-and-format.md
  - phase-03b-climate-source-attach-select.md (3b — own doc)
  - phase-03c-climate-visualization.md (3c — own doc)
---

# Climate Phase 3 — Climate tab UI

The visible home: location record, all climate **sources** (ASHRAE /
EPW / Phius / PHI / custom) attachable + independently visualized, and
the sun-path visual. Frontend-led; consumes Phase 1 (sun path) + Phase 2
(dataset read endpoints + standardized record).

## 0. Decomposition (added 2026-06-13)

Phase 3 is **not** purely frontend (the §2 inventory below is the full
target). A frontend-infrastructure survey surfaced three facts that force
a split:

- **No charting library** is installed — graphs (§2.4) need a new
  dependency (recharts/visx), a real decision under the pnpm
  supply-chain rules.
- **No frontend sun-path consumer exists** — Phase 1 shipped the backend
  `GET /projects/{id}/sun-path` + MCP only; the Model Viewer reads sun
  path through a *different* combined model-data endpoint. A Climate-tab
  sun-path visual needs a new `useSunPathQuery` **and** a render, which
  overlaps the separate `model-viewer-sun-path` feature.
- **"Attach + store all sources" (D-CL-4) needs new backend** — Phase 2
  built only the **app-wide** reference datasets. There is no
  **project-scoped** "this project selected Phius location X / ASHRAE
  pointer / EPW / custom" model yet. That is a new table + routes.

So Phase 3 ships in three sub-phases:

- **3a — Tab shell + location editor + reference-dataset browser**
  (frontend-only; no new deps; no backend). **COMPLETE 2026-06-13** (`make
  ci` green): `climate` tab added after Status (`features/projects/lib.ts` +
  `ProjectTabContent.tsx`); new `frontend/src/features/climate/` client
  (`types`/`api`/`query-keys`/`hooks`) over `/api/v1/climate/datasets…`; a
  dataset **browser** (`ClimateDatasetBrowser` — dataset picker +
  country/region filter + nearest-to-project) with the standardized record
  as read-only monthly + design-condition tables (`ClimateRecordTable`,
  IP/SI temp toggle). The **rich location editor was migrated into the tab**
  (D-CL-3): the editor + EPW upload/parse flow were extracted into a
  reusable `useProjectLocationForm` hook plus `ProjectLocationEditor` /
  `ProjectLocationSummary` components (in `features/projects/`, imported
  one-way by climate); `ClimateLocationSection` hosts the editable section
  with its own Save, and project **Settings now renders only a compact
  read-only summary** pointing at the Climate tab. Tests under
  `features/climate/__tests__/` (incl. `ClimateLocationSection`:
  editor/viewer/EPW/late-resolve/units) + the slimmed
  `ProjectSettingsModal.location` read-only test.
- **3b — Source attach/select** → **`phase-03b-climate-source-attach-select.md`**.
  New backend `project_climate_source` model + routes (attach Phius/PHI
  location, ASHRAE pointer, EPW, custom; per-project default per D-CL-11) +
  the frontend attach/select UI.
- **3c — Visualization** → **`phase-03c-climate-visualization.md`**.
  Charting-lib decision + monthly graphs for the active source; the
  sun-path visual (`useSunPathQuery` on the Phase-1 endpoint; coordinate
  with / reuse `model-viewer-sun-path` geometry).

Tab placement (Ed 2026-06-13): **near the front, right after Status.**

## 1. Required reading

- `../PRD.md` §5.3, §4.1 (sources), §4.3 (record); `../decisions.md`
  D-CL-3 (tab + setter migration), D-CL-4 (sources), D-CL-9 (custom),
  D-CL-11 (per-analysis default).
- Existing code:
  - `frontend/src/features/projects/components/ProjectLocationSettingsSection.tsx`
    + `location-form.ts` — the setter to reuse/migrate.
  - `PROJECT_TABS` + `TAB_COPY` (where `model` was added) — add
    `climate`.
  - The tab content router (where `ModelTab` lazy-loads) — lazy-load
    the Climate tab.
  - `model-viewer-sun-path` SiteSunLayer geometry mapping — share the
    DTO→geometry conversion for the sun-path visual rather than
    duplicating it.

## 2. Work

1. **Roster:** add a `climate` tab to `PROJECT_TABS` + `TAB_COPY`; place
   near the front (location is project-defining; Ed to confirm).
2. **Location record:** coords / elevation / time zone / true north /
   address — editor-editable, viewer read-only. Reuse or migrate
   `ProjectLocationSettingsSection` (D-CL-3: recommend migrating the rich
   edit into the tab; leave a compact read-only summary in settings or
   remove that section — confirm with Ed).
3. **Sources (D-CL-4) — attach + store all simultaneously:**
   - **ASHRAE:** station id + URL input (link out to
     `ashrae-meteo.info`); show cached values if fetched.
   - **EPW:** upload/replace + provenance (reuse the existing
     `project_location` EPW flow).
   - **Phius:** version dropdown → location search/select against the
     Phase 2 dataset endpoints; pin the chosen location.
   - **PHI/PHPP:** same pattern, PHI datasets.
   - **Custom (D-CL-9):** a form to enter a standardized record for a
     missing location.
4. **Visualization:** for the active/selected source, monthly **graph +
   table** (temperature, radiation N/E/S/W/global, dewpoint,
   degree-days) from the standardized record. Plus the **sun-path
   visual** (consume `useSunPathQuery(projectId)`; "Set location" empty
   state when null). Use the project charting approach (check
   `features/report-tables` / any existing chart lib before adding one).
5. **Per-analysis default (D-CL-11):** let the user mark which source is
   the project default (the consumers' default); lightweight in this
   phase (a radio/flag), full per-consumer override can come with the
   consumers.
6. **Units:** elevation m/ft; angles invariant; temps respect the IP/SI
   toggle in graphs/tables. **Permissions:** editor edits, viewer reads.

## 3. Tests

- **vitest:** tab renders for editor + viewer; source attach/select
  state; graph/table maps a standardized record correctly; sun-path
  empty vs. populated; units toggle.
- **Playwright:** Climate tab loads; attach a Phius location via the
  dropdown and see its graph+table; seeded-location project shows the
  sun-path visual; no-location empty state.
- **`make ci`** green.

## 4. Exit criteria

- PRD §7 Phase 3 met; tab in the roster; all sources attachable +
  visualized; setter-migration sub-question resolved + recorded in
  STATUS.
