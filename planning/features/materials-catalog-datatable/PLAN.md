---
DATE: 2026-06-03
TIME: 20:30 EDT
STATUS: Draft for implementation.
AUTHOR: Claude (Opus 4.7)
SCOPE: Implementation sequence for the Materials Catalog DataTable
       migration.
RELATED:
  - README.md
  - PRD.md
  - STATUS.md
  - phases/phase-01-backend-schema.md
  - phases/phase-02-drift-and-envelope.md
  - phases/phase-03-frontend-datatable.md
  - phases/phase-04-verification-docs.md
---

# PLAN — Materials Catalog DataTable

## Sequencing rationale

The frontend wiring depends on the new response shape from the
backend; envelope drift depends on the version layer being gone.
Order:

1. Backend schema reshape (destructive migration).
2. Envelope drift + `CatalogOrigin` reshape — keeps backend tests
   green before the frontend lands.
3. Frontend DataTable rebuild.
4. Closeout: `make ci`, MCP smoke, context-doc fold-back.

Each phase is self-contained and shippable; if review pauses between
phases, main remains coherent.

## Branching

Single feature branch: `feat/materials-catalog-datatable`. Phases land
as separate commits on that branch (no per-phase worktree — there is
no cohort or downstream-cascade pattern here).

## Phase map

| Phase | File | Scope |
|-------|------|-------|
| 1 | `phases/phase-01-backend-schema.md` | Alembic destructive revision; flatten + reshape `catalog_materials`; drop `catalog_material_versions`; update models, repository, service, routes, tests. |
| 2 | `phases/phase-02-drift-and-envelope.md` | Remove `catalog_version_id` from `CatalogOrigin`; rewrite `drift.py` and `pick_catalog_material` snapshot writer; rewrite drift tests. |
| 3 | `phases/phase-03-frontend-datatable.md` | Built-in `TableFieldDef[]` + overlay (locks, fixed `numberUnits`, category options); REST→DataTable adapter; new `MaterialsCatalogPage`; delete `MaterialEditorModal`. |
| 4 | `phases/phase-04-verification-docs.md` | `make ci` from repo root; Playwright MCP smoke; update `context/technical-requirements/data-table.md` if any deferred item flipped; closeout. |

## Risks

- **Cross-cutting envelope test churn.** Phase 2 touches
  `tests/envelope/test_envelope_catalog_drift.py` and
  `tests/envelope/test_envelope_commands_materials.py`. Rewrites
  must preserve coverage of pick-time snapshot semantics and
  field-level drift detection.
- **`numberUnits` fixed-mode for catalogs.** The archived
  data-table-unit-number-field Phase 4 anticipated this exact
  wiring point. Re-read that phase doc before implementing the
  overlay; the contract for fixed-mode is settled and should be
  followed verbatim.
- **Category single-select on a Number-of-options-known-to-the-feature
  field.** The twelve options ship in feature code, not the database.
  The overlay should mark `locked: ["options", "delete", "duplicate"]`
  so the field-config modal cannot mutate the option list.
