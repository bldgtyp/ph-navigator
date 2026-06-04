---
DATE: 2026-06-04
TIME: 12:00 EDT
STATUS: Draft for implementation.
AUTHOR: Claude (Opus 4.7) + Ed May
SCOPE: Implementation sequence for the Window-Glazing Catalog.
RELATED:
  - README.md
  - PRD.md
  - STATUS.md
  - ../frame-types-catalog/PLAN.md
---

# PLAN — Window-Glazing Catalog

## Sequencing rationale

The frontend DataTable wiring depends on the new `suffix` column
being in the response. Import/export depends on the DataTable
overflow-menu slot being present in the new page. Seed-load
depends on `/import/commit` existing. So:

1. Backend schema + repository + Pydantic + routes (Phase 1).
2. Frontend DataTable page rebuild (Phase 2).
3. Backend + frontend JSON import/export (Phase 3).
4. Canonical JSON seed file + dev recipe + smoke (Phase 4).

Each phase is self-contained and shippable; if review pauses
between phases, `main` remains coherent and the partially-built
catalog continues to serve users via whichever surface (HTML table
in Phase 1, DataTable in Phase 2+).

## Branching

Single feature branch: `feat/glazing-types-catalog`. Phases land as
separate commits (or separate PRs into the branch) on that branch,
following the existing single-branch pattern from the archived
`materials-catalog-datatable/PLAN.md`. No per-phase worktree —
there is no cohort or downstream cascade here, and main is open
for unrelated work.

The Frame-Types Catalog (`../frame-types-catalog/`) is a sibling
branch (`feat/frame-types-catalog`). The two branches can land in
any order; they touch disjoint files in `backend/features/catalogs/`
and `frontend/src/features/catalogs/`.

## Phase map

| Phase | Scope summary | Exits when |
|-------|---------------|-----------|
| 1     | **Backend schema + API.** Alembic migration adds `suffix text null` to `catalog_glazing_types`. Pydantic models (`_CatalogGlazingTypeFields`, `CatalogGlazingTypeListItem`, `CatalogGlazingTypePublic`) gain `suffix`. Repository SQL projects + writes the new column. List/detail/create/update endpoints round-trip the new field. New `POST /duplicate` endpoint if not already wired (mirror materials). Backend pytest covers the new field across CRUD + duplicate. | `cd backend && uv run pytest tests/test_catalogs_glazing_*` green; `make migrate` clean; manual `curl` round-trips the field; existing landing page still functions. |
| 2     | **Frontend DataTable page.** Create `frontend/src/features/catalogs/glazing-types/` with `controller.ts`, `fieldDefs.ts`, `__tests__/`. Rewrite `routes/GlazingTypesCatalogPage.tsx` to wire `<DataTable>` (eleven columns per PRD §Catalog Field Contract), `CatalogMenu` topbar, `buildEmptyGlazingTypeRow`, IP/SI U-value display. Retire `GlazingTypeEditorModal.tsx`. Vitest for controller + fieldDefs. Playwright MCP smoke for sort/filter/inline-edit/duplicate. | `make check-frontend` green; manual driving of the page in a browser via Playwright MCP shows add/edit/duplicate/soft-delete/reactivate all working; no console errors; IP/SI toggle flips U-value display. |
| 3     | **JSON import / export.** Add `backend/features/catalogs/glazing_types/import_export/` (`file_format.py`, `coerce.py`, `tokens.py`, `upgrade.py`, `pipeline.py`, `service.py`) with the `ph-navigator/catalog-glazing-types` envelope. Wire `POST /import/preview` + `POST /import/commit`. Add frontend `import_export/` (`ImportDialog.tsx`, `OverflowMenuItems.tsx`, `export.ts`, `useImportMutations.ts`, `api.ts`, `types.ts`). Surface the overflow-menu items on the page. Backend pytest for preview/commit + drift handling; Vitest for `export.ts` + `ImportDialog`; Playwright E2E for full upload cycle. | Round-trip works: export current catalog → re-import → preview reports 0 changes → commit is a no-op (or all "match → skip"). All `make ci` gates green. |
| 4     | **Seed data + smoke.** Convert `research/Glazing Data-ALL DATA.csv` → `backend/features/catalogs/glazing_types/seeds/glazing-types.v1.json` (committed). The conversion drops `DATASHEET` and `LINK` columns per PRD. Add a `make seed-glazing` Makefile recipe (or `uv run python -m features.catalogs.glazing_types.seeds.load`) that POSTs the seed through `/import/commit`. Run it once locally to verify all 42 rows appear. Playwright MCP records a screenshot of the seeded grid for `assets/`. | `make seed-glazing` ingests 42 rows; visual smoke matches AirTable; PRD `STATUS` rolls to `Complete`; `context/user-stories/10-windows.md` §US-WIN-3 / US-WIN-4 references this catalog as a satisfied dependency. |

## Verification at every phase

Per `CLAUDE.md` § Mandatory closeout gate:

1. `make format` from the repo root.
2. `make ci` from the repo root.
3. If `make format` changes files, inspect the diff and rerun
   `make ci`.
4. Do not declare the phase complete while any `make ci` step is
   red. Fix the failure locally, rerun.

Phase 2 and Phase 3 additionally require Playwright MCP smoke
(per the project's `webapp-testing` skill) — the UI is not
considered "working" until it's been driven in a real browser.

## Risks

- **Schema migration safety.** Adding a nullable column to an
  existing table is low-risk; existing rows stay valid. The
  `catalog_glazing_type_versions` table is left alone in Phase 1
  to avoid an envelope-drift refactor mid-feature.
- **DataTable column reorder of an existing user view.** None —
  no one has saved view state for this catalog yet (the current
  landing page is hand-rolled and has no view-state contract).
  Phase 2 can ship with default column order without migration.
- **Import collisions on `name`.** Seed `name` values from
  AirTable already encode the suffix (`"Kawneer | GL-1 | S"`),
  so collision risk is low. If the seed preview surfaces
  collisions, revisit OQ2 in the PRD before committing the
  import.
- **Frame catalog parallelism.** The Frame-Types Catalog is a
  near-identical build with a larger field set. Resist the urge
  to extract a shared abstraction mid-flight — finish both
  independently, then consolidate in a follow-up.

## Out of scope (cross-reference README/PRD)

See `README.md` § Out of scope and `PRD.md` § Non-Goals.

## Per-phase files

Per-phase implementation plans are added to `phases/` when each
phase moves to `in_progress`. Until then, the rows in the *Phase
map* table above are authoritative. File names will follow:

- `phases/phase-01-schema.md`
- `phases/phase-02-datatable.md`
- `phases/phase-03-import-export.md`
- `phases/phase-04-seed-data.md`
