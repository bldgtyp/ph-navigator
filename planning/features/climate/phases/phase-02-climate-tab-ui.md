---
DATE: 2026-06-13
TIME: -
STATUS: Planned — start after Phase 1.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff — the Climate top-level tab.
RELATED:
  - ../PRD.md §5.2
  - ../decisions.md (D-CL-3)
  - phase-01-sun-path-service.md
---

# Climate Phase 2 — Climate tab UI

A new top-level **Climate** tab: the visible home for the location/EPW
record and the climate visualization. Frontend-led; reuses Phase 1's
endpoint and the existing location data.

## 1. Required reading

- `../PRD.md` §5.2, `../decisions.md` D-CL-3 (tab + setter-migration
  sub-question).
- Existing code:
  - `frontend/src/features/projects/components/ProjectLocationSettingsSection.tsx`
    + `location-form.ts` — the setter to reuse/migrate.
  - The `PROJECT_TABS` roster + `TAB_COPY` (where `model` was added) —
    add `climate`.
  - `frontend/src/features/projects/.../ProjectTabContent` (or
    equivalent) — tab content routing; lazy-load the tab.
  - `model-viewer-sun-path` SiteSunLayer geometry mapping — the
    sun-path visual reuses the same DTO→geometry conversion (share a
    helper if practical, rather than duplicating arc/compass mapping).

## 2. Work

1. **Roster:** add a `climate` tab to `PROJECT_TABS` with `TAB_COPY`;
   place it sensibly in the order (near the front — location is
   project-defining; Ed to confirm placement).
2. **Tab content** (`features/climate/` frontend module):
   - **Location record:** coords / elevation / time zone / true north /
     address — editor-editable, viewer read-only. Reuse or migrate
     `ProjectLocationSettingsSection` (D-CL-3: recommend migrating the
     rich edit here; leave a compact read-only summary in settings or
     remove the settings section once the tab is the home — confirm
     with Ed).
   - **EPW provenance:** filename, source URL, parsed header snapshot;
     download link; editor upload/replace (reuse the existing
     `project_location` EPW flow).
   - **Sun-path visualization:** consume `useSunPathQuery(projectId)`
     (Phase 1 endpoint) and render a standalone diagram (2D plan or a
     light 3D — implementer's call). Show the "Set project location"
     empty state when the endpoint returns null.
3. **Units:** elevation toggles m/ft; angles invariant (inherited rule;
   reuse `lib/units/`).
4. **Permissions:** editor edits, viewer reads — mirror the existing
   `project_location` access split.

## 3. Tests

- **vitest:** tab renders for editor + viewer; sun-path empty state vs.
  populated; units toggle.
- **Playwright:** Climate tab loads; seeded-location project shows the
  record + sun-path visual; no-location shows the empty state.
- **`make ci`** green.

## 4. Exit criteria

- PRD §7 Phase 2 met; tab in the roster; setter-migration sub-question
  resolved + documented in STATUS.
