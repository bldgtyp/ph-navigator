---
DATE: 2026-06-13
TIME: -
STATUS: Planned — start after Phase 1 + Phase 2 (needs the sun-path
  endpoint AND the reference-dataset read endpoints).
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff — the Climate top-level tab: location
  record + multi-source attach/select + per-source visualization.
RELATED:
  - ../PRD.md §5.3 (and §4.1 sources, §4.3 record)
  - ../decisions.md (D-CL-3 tab, D-CL-4 sources, D-CL-9 custom, D-CL-11)
  - phase-01-sun-path-service.md
  - phase-02-reference-datasets-and-format.md
---

# Climate Phase 3 — Climate tab UI

The visible home: location record, all climate **sources** (ASHRAE /
EPW / Phius / PHI / custom) attachable + independently visualized, and
the sun-path visual. Frontend-led; consumes Phase 1 (sun path) + Phase 2
(dataset read endpoints + standardized record).

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
