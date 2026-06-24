---
DATE: 2026-06-04
TIME: 12:00 EDT
STATUS: Draft for implementation.
AUTHOR: Claude (Opus 4.7) + Ed May
SCOPE: Implementation sequence for the Window-Frame-Elements
       Catalog.
RELATED:
  - README.md
  - PRD.md
  - STATUS.md
  - ../glazing-types-catalog/PLAN.md
---

# PLAN — Window-Frame-Elements Catalog

## Sequencing rationale

The Phase 1 reshape is destructive (drop version table + version
columns; rename `source_provenance`/`notes`; add seven identity
columns); the frontend DataTable wiring depends on the
post-reshape response shape. Import/export depends on the
DataTable overflow-menu slot being present in the new page.
Seed-load depends on `/import/commit` existing. So:

1. Backend destructive reshape + repository + Pydantic + routes
   (Phase 1).
2. Frontend DataTable page rebuild (Phase 2).
3. Backend + frontend JSON import/export (Phase 3).
4. Canonical JSON seed file + dev recipe + smoke (Phase 4).

Each phase is self-contained and shippable; if review pauses
between phases, `main` remains coherent and the partially-built
catalog continues to serve users via whichever surface (HTML
table in Phase 1, DataTable in Phase 2+).

## Branching

Single feature branch: `feat/frame-types-catalog`. Phases land as
separate commits (or separate PRs into the branch) on that
branch, following the existing single-branch pattern from the
archived `materials-catalog-datatable/PLAN.md`. No per-phase
worktree — there is no cohort or downstream cascade here, and
main is open for unrelated work.

The Glazing-Types Catalog (`../glazing-types-catalog/`) is a
sibling branch (`feat/glazing-types-catalog`). The two branches
can land in any order; they touch disjoint files in
`backend/features/catalogs/` and `frontend/src/features/catalogs/`.

## Phase map

| Phase | Scope summary | Exits when |
|-------|---------------|-----------|
| 1     | **Backend destructive reshape + API.** Alembic migration: (a) add seven `text null` columns: `use`, `operation`, `location`, `mull_type`, `prefix`, `suffix`, `material`; (b) rename `source_provenance → source` and `notes → comments`; (c) drop `current_version_id`, `catalog_schema_version`, `version_label`, `version_date`; (d) drop `catalog_frame_type_versions` table. Pydantic models (`_CatalogFrameTypeFields`, `CatalogFrameTypeListItem`, `CatalogFrameTypePublic`) reshape to match. Repository SQL updated for the new column set. List/detail/create/update endpoints round-trip the post-reshape fields. New `POST /duplicate` endpoint wired (mirror Materials). **Verification grep** before touching the version table: search the codebase for `catalog_version_id`, `current_version_id`, `catalog_frame_type_versions`, `catalog_schema_version`, `FrameRef.catalog_origin`; if any project-document or envelope-drift code reads these, that work lands in the same migration commit. Backend pytest covers each new column, the renames, and `POST /duplicate`. | `cd backend && uv run pytest tests/test_catalogs_frame_*` green; `make migrate` clean; manual `curl` round-trips the new + renamed fields; existing landing page still functions against the new response shape. |
| 2     | **Frontend DataTable page.** Create `frontend/src/features/catalogs/frame-types/` with `controller.ts`, `fieldDefs.ts`, `__tests__/`. Rewrite `routes/FrameTypesCatalogPage.tsx` to wire `<DataTable>` (seventeen columns per PRD §Catalog Field Contract), `CatalogMenu` topbar, `buildEmptyFrameTypeRow`, IP/SI display for `width_mm`, `u_value_w_m2k`, `psi_g_w_mk`, `psi_install_w_mk`. Soft-enum dropdown suggestions for `use`, `operation`, `location`, `mull_type`, `material` via the existing FieldDef `options` slot (rendered as suggestions, not strict — per PRD D4). Retire `FrameTypeEditorModal.tsx`. Vitest for controller + fieldDefs. Playwright MCP smoke for sort/filter/inline-edit/duplicate. | `make check-frontend` green; manual driving of the page in a browser via Playwright MCP shows add/edit/duplicate/soft-delete/reactivate all working; no console errors; IP/SI toggle flips all four numeric column displays. |
| 3     | **JSON import / export.** Add `backend/features/catalogs/frame_types/import_export/` (`file_format.py`, `coerce.py`, `tokens.py`, `upgrade.py`, `pipeline.py`, `service.py`) with the `ph-navigator/catalog-frame-types` envelope. Wire `POST /import/preview` + `POST /import/commit`. Add frontend `import_export/` (`ImportDialog.tsx`, `OverflowMenuItems.tsx`, `export.ts`, `useImportMutations.ts`, `api.ts`, `types.ts`). Surface the overflow-menu items on the page. Backend pytest for preview/commit + drift handling; Vitest for `export.ts` + `ImportDialog`; Playwright E2E for full upload cycle. | Round-trip works: export current catalog → re-import → preview reports 0 changes → commit is a no-op. All `make ci` gates green. |
| 4     | **Seed data + smoke.** Convert `research/Frame Data-ALL DATA.csv` → `backend/features/catalogs/frame_types/seeds/frame-types.v1.json` (committed). The conversion drops `DATASHEET`, `LINK`, `WIDTH_IN`, `U_VALUE_BTU_HR_FT2_F`, `PSI_G_BTU_HR_FT_F` per PRD. Add a `make seed-frames` Makefile recipe (or `uv run python -m features.catalogs.frame_types.seeds.load`) that POSTs the seed through `/import/commit`. Run it once locally to verify all 189 rows appear. Playwright MCP records a screenshot of the seeded grid for `assets/`. | `make seed-frames` ingests 189 rows; visual smoke matches AirTable; PRD `STATUS` rolls to `Complete`; OQ3 (soft-enum → strict enum) is revisited with observed option distribution from the live seed. |

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

- **Destructive migration scope.** Phase 1 drops a table and
  four columns, renames two columns, and adds seven — all in a
  single Alembic revision. App is in dev (no production users);
  risk is the verification grep at the top of Phase 1. If any
  project-document, envelope-drift, or bookshelf-copy code still
  reads `catalog_version_id` / `current_version_id` /
  `catalog_frame_type_versions`, that work must land in the
  same commit. If the grep is clean, the reshape is purely an
  internal-catalog refactor.
- **DataTable column count.** Seventeen columns is the largest
  surface the catalog UX has used to date. Default column order
  should put identity columns (`name`, `manufacturer`, `brand`)
  first, then categorization (`use`, `operation`, `location`,
  `mull_type`, `prefix`, `suffix`, `material`), then performance
  (`width_mm`, `u_value_w_m2k`, `psi_g_w_mk`,
  `psi_install_w_mk`), then color / source / comments / audit.
  Phase 2 verification should hide-by-default the
  rarely-populated columns (`prefix`, `material`,
  `psi_install_w_mk`) to keep the initial grid readable.
- **Soft-enum vs. strict enum.** Settled in PRD D4: Phase 2
  ships `text`-with-suggestions; a follow-up after Phase 4 may
  promote to strict `single_select` once the real option
  distribution is observable. Resist promoting inside Phase 2 —
  that risks blocking the AirTable seed on a rigidity that may
  not match the real data.
- **Glazing catalog parallelism.** The Glazing catalog is a
  near-identical build with a smaller field set. Resist the
  urge to extract a shared abstraction mid-flight — finish both
  independently, then consolidate in a follow-up.
- **Import collisions on `id`.** Match key is `id` (D2). Seed
  rows that originate from AirTable will not have a `rec`-
  prefixed `id` (we generate fresh ids on insert), so the first
  seed run treats every row as new. Subsequent re-runs of the
  same seed file would also insert duplicates unless the seed
  file is re-exported from the live catalog after the first run
  — Phase 4 should document this loop or alternatively capture
  stable ids in the seed JSON after the first ingest.

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
