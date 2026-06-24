---
DATE: 2026-06-04
TIME: 01:30 EDT
STATUS: Complete — squash-merged to main as `94d6a2a` via PR #6.
        Branch `feat/materials-catalog-datatable` deleted (remote +
        local). Feature folder moved into `planning/archive/` per the
        data-table-unit-number-field precedent.
AUTHOR: Claude (Opus 4.7)
SCOPE: Status ledger for the Materials Catalog DataTable migration.
RELATED:
  - README.md
  - PRD.md
  - PLAN.md
---

# STATUS — Materials Catalog DataTable

## Final state (merged)

- **Main commit**: `94d6a2a` "Materials Catalog: rebuild on shared
  DataTable; flatten catalog schema (#6)".
- **PR**: https://github.com/bldgtyp/ph-navigator-v2/pull/6 (merged,
  squashed).

## What landed

- **Backend (phases 1 + 2 merged into one commit on the branch)**:
  destructive Alembic 0015 flattened `catalog_materials` and dropped
  `catalog_material_versions`; `CatalogOrigin.catalog_version_id` +
  `catalog_schema_version` made Optional; `ProjectMaterial` reshape
  (rename `notes` → `comments`, add `source` + `url`); envelope drift
  collapsed to field-value comparison only;
  `context/technical-requirements/data-model.md` §7.2 / §7.4 folded.
- **Frontend (phase 3)**: shared `<DataTable>` replaces the hand-rolled
  Materials Catalog table + `MaterialEditorModal`; built-in nine-field
  FieldDefs with locks; fixed-mode `numberUnits` for density /
  specific_heat / conductivity; twelve-option Category single_select;
  `useMaterialsCatalogController` translates DataTable `WriteOp`s
  (cell / paste / fill / rowInsert / rowDelete) to PATCH / POST /
  DELETE on the existing REST surface;
  `frontend-viewer-units.md` §11.5.5 folded.
- **Phase 4 verification + follow-ups**: Playwright MCP smoke
  captured; the four surfaced gaps closed —
  - FU-1 + FU-3 (single_select + row-delete): 7 controller unit tests
    proved both paths are wired correctly; the smoke results were
    synthetic-click artifacts, not real bugs.
  - FU-2 (Shift-Enter on empty grid): page now passes `buildEmptyRow`,
    controller substitutes `"New material"` / `"insulation"` defaults
    when the DataTable hands over empty `fieldDefaults`.
  - FU-4 (global SI/IP toggle): new `<TopbarUnitToggle>` lives in
    `<WorkspaceTopbar>`, so every authenticated page (Dashboard,
    ProjectShell, all three catalog managers) shows it inline. The
    pre-existing `UnitSystemToggle` in the project header was removed
    as a duplicate; CSS dead code stripped from `version-controls.css`.
- **Topbar toggle visual pass**: redesigned to a compact
  `[IP | SI]` rectangle with a soft accent tint on the active option.
  Replaces the initial black-pill design that washed out the active
  label.

## Tests at merge

- Frontend: 1010 passed.
- Backend: 440 passed, 1 skipped (full repo suite).
- `make ci` from repo root green.

## Context doc fold-backs

- `context/technical-requirements/data-model.md` — §7.2 callout
  describing the flat materials shape; §7.4 materials-drift-is-field-
  only note; project_materials JSON example updated to the new shape.
- `context/technical-requirements/frontend-viewer-units.md` — §11.5.2
  Toggle UX rewritten to point at `<TopbarUnitToggle>`; §11.5.5
  registry list now includes `specific_heat`; "Fixed-mode anchors"
  subsection points at the live materials fieldDefs file.
- `context/UI_UX.md` §2 — IP/SI toggle moved from project header to
  the global `<WorkspaceTopbar>`.

## Follow-ups recorded elsewhere

- **Catalog frame_types + glazing_types** still ride the
  hand-rolled-table + modal-form UI. The same DataTable migration can
  be applied; not in scope for this PR. Decide separately whether the
  versioned schema there also needs a flattening pass.
- **Catalog view-state persistence** remains explicitly deferred per
  `context/technical-requirements/data-table.md` ("Catalog-manager
  view-state persistence is still out of scope; catalog tables resize
  locally").

No open work tied to this feature.
