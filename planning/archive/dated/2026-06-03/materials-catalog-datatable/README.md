---
DATE: 2026-06-03
TIME: 20:30 EDT
STATUS: Complete — squash-merged to main as `94d6a2a` via PR #6;
        folder archived under `planning/archive/`. See STATUS.md.
AUTHOR: Claude (Opus 4.7)
SCOPE: Rebuild the Materials Catalog page on the shared DataTable
       primitive and reshape the catalog material schema.
RELATED:
  - PRD.md
  - STATUS.md
  - PLAN.md
  - phases/phase-01-backend-schema.md
  - phases/phase-02-drift-and-envelope.md
  - phases/phase-03-frontend-datatable.md
  - phases/phase-04-verification-docs.md
  - ../../../context/technical-requirements/data-table.md
  - ../../../context/technical-requirements/frontend-viewer-units.md
  - ../../archive/data-table-unit-number-field/phases/phase-04-fixed-catalog-fields.md
---

# Materials Catalog — DataTable Migration

Planning packet for replacing the hand-rolled Materials Catalog table at
`frontend/src/features/catalogs/routes/MaterialsCatalogPage.tsx` with the
shared `<DataTable>` primitive, reshaping the catalog material schema
to the fixed nine-field contract requested by Ed, and removing the
versioning layer (`catalog_material_versions`) that the bookshelf snapshot
pattern made redundant.

## Read order

1. `STATUS.md` — current state, next step.
2. `PRD.md` — product contract: fields, behavior, scope.
3. `PLAN.md` — implementation sequence and phase map.
4. `phases/phase-01-backend-schema.md`
5. `phases/phase-02-drift-and-envelope.md`
6. `phases/phase-03-frontend-datatable.md`
7. `phases/phase-04-verification-docs.md`

## Scope

- In: schema reshape, single shared catalog table, DataTable wiring,
  built-in field locks, fixed-mode Number with Units for density /
  specific heat / conductivity, single_select Category with the twelve
  fixed options, removal of the version layer.
- Out: user-authorable custom fields on the catalog (data-table.md
  v1 carves these out), per-(user, catalog, table) `ViewState`
  persistence (catalogs resize locally), attachments on catalog rows,
  catalog-row comments threads.
