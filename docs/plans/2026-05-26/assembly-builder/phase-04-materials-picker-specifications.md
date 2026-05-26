---
DATE: 2026-05-26
TIME: 18:21 EDT
STATUS: Proposed implementation plan.
AUTHOR: Codex
SCOPE: Project materials, material picker, shared material editor,
       detach-to-new-material, and Specifications cards.
RELATED:
  - docs/features/assembly-builder-prd.md §§5.4-5.5, 6.4-6.5, 7.7-7.11
  - docs/plans/2026-05-26/assembly-builder/phase-03-editor-commands-canvas-crud.md
  - context/technical-requirements/data-model.md §7
  - context/user-stories/20-envelope.md US-ENV-7, US-ENV-13
---

# Phase 4 - Materials Picker And Specifications

## Goal

Make assemblies useful by wiring real project materials into segments
and exposing the per-material Specifications review surface. This phase
proves the V2 product-layer correction: one product record can serve
many segments, with shared values and one QA status.

## In Scope

- Project material creation by hand-enter.
- Existing project-material picker with use counts.
- Materials catalog picker and copy-in.
- De-dupe by `catalog_table + catalog_record_id`.
- Duplicate-name disambiguation in picker and Specifications cards.
- Shared `ProjectMaterialEditor`.
- Unit-aware display/input for conductivity / lambda, density, and
  specific heat using shared IP/SI helpers.
- Shared-use warning and affected-use count/list.
- Tracking edited catalog fields in `catalog_origin.local_overrides`.
- Detach-to-new-material.
- Remove unused project materials command.
- Specifications material cards with:
  - status select;
  - product values;
  - notes;
  - use-sites;
  - segment-owned use-site notes;
  - placeholders for datasheets/site photos that Phase 6 upgrades.

## Out Of Scope

- Uploading datasheets or site photos.
- Catalog drift refresh dialog.
- Thermal calculation.
- HBJSON export.
- Bulk material-card operations.
- Runtime custom fields on envelope data.

## Backend Work

Add material-related envelope commands:

- `pick_project_material`;
- `pick_catalog_material`;
- `hand_enter_material`;
- `update_project_material`;
- `update_segment_use_site_notes`;
- `detach_segment_material`;
- `remove_unused_project_materials`.

The backend owns:

- de-dupe rules;
- duplicate-name allowance;
- local override tracking;
- reference updates;
- use-site derivation;
- segment use-site note mutation without changing project-material
  notes;
- unused material detection.

## Frontend Work

Add:

- material picker surface in Segment Properties;
- catalog list/search/grouping by category;
- hand-enter material dialog;
- shared material values editor;
- material picker/specification value formatting for conductivity /
  lambda, density, specific heat, and emissivity, with only emissivity
  remaining unitless;
- use-site note editor on each segment row inside a material card;
- detach flow;
- Specifications card interactions;
- unused-material section and cleanup confirmation.

The same editor component must be used from Segment Properties and
Specifications.

## Verification Gates

Backend:

- hand-enter defaults;
- catalog copy-in payload and `catalog_origin` family validation;
- de-dupe happy path;
- duplicate catalog-origin ambiguity path;
- shared material update affects all use-sites;
- IP/SI material editor values submit canonical SI and preserve
  `catalog_origin.local_overrides` comparisons against canonical SI,
  not rounded display strings;
- use-site note update affects only the target segment;
- detach copies values/datasheets/status/notes, clears
  `catalog_origin`, preserves segment photos and use-site notes;
- remove unused deletes only unreferenced project-material rows.

Frontend:

- picker grouping/search;
- duplicate material display;
- material physical values display in the active unit system in picker,
  material preview, shared editor, and Specifications cards;
- focused material numeric editors are not rewritten when IP/SI is
  toggled, and still submit canonical SI;
- shared warning appears from both edit entry points;
- Specifications sorting and viewer hiding of `na`/unused.

Browser:

1. Pick a catalog material into a segment.
2. Pick the same catalog material into another segment and confirm one
   project-material row is reused.
3. Hand-enter a material with null physical values.
4. Edit shared material values and verify all use-sites reflect it.
5. Toggle SI/IP and verify conductivity / lambda, density, and specific
   heat displays update without changing canonical stored values.
6. Edit a material value in IP mode and verify the command payload is
   canonical SI.
7. Add a use-site note and verify it stays with that segment.
8. Detach one segment to a custom material and verify the use-site note
   stays on the segment.
9. Delete a segment and remove unused material explicitly.
10. Save, reload, verify material/use-site state persists.

Commands:

```bash
cd backend
uv run ruff check .
uv run ty check
uv run pytest tests/test_catalogs.py tests/test_project_document.py

cd ../frontend
pnpm run format
pnpm test -- --run src/features/envelope
pnpm run build
```

## Success Criteria

1. Segment material assignment no longer requires seed/fixture project
   materials.
2. Project-material sharing is obvious and safe.
3. Specifications can be used as a material QA sweep even before
   evidence upload lands.
4. Use-site notes preserve V1's per-segment note workflow without
   turning product notes back into segment fields.
5. No material edit path bypasses local-overrides tracking.

## Risks

- **Catalog manager API skew.** Mitigation: use current
  `/api/v1/catalogs/materials` contracts, not aspirational generic
  catalog routes.
- **Shared material edits surprise users.** Mitigation: use count/list
  and identical warning text everywhere.
- **Duplicate names make export/picker ambiguous.** Mitigation:
  display extra identity signals and test duplicates directly.

## Lessons To Capture

Record lessons for:

- picker ergonomics;
- duplicate-name display;
- local override field list;
- detach copy policy.
- whether use-site notes need richer formatting or length limits.
