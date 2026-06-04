---
DATE: 2026-06-04
TIME: 16:00 EDT
STATUS: Complete
AUTHOR: Claude (Opus 4.7) + Ed May
SCOPE: Status ledger for the Window-Glazing Catalog feature.
RELATED:
  - README.md
  - PRD.md
  - PLAN.md
---

# STATUS — Window-Glazing Catalog

## Current state

- **Phase 0 (Planning)** — `Complete`, `2026-06-04`.
- **Phase 1 (Backend destructive reshape + API)** — `Complete`,
  `2026-06-04`. Alembic 20260604_0016 dropped the version layer +
  4 columns, renamed `source_provenance`/`notes` →
  `source`/`comments`, added `suffix`, added `POST /duplicate`.
  Adjacent: `GlazingRef` reshaped to match (now version-less),
  `_require_catalog_origin_family` allows glazing without a
  version prefix, refresh.py loosened `pinned_catalog_version_id`
  to nullable. Modal + landing page kept compiling on the new
  shape (retired in Phase 2).
- **Phase 2 (Frontend DataTable page)** — `Complete`, `2026-06-04`.
  `frontend/src/features/catalogs/glazing-types/` (controller +
  fieldDefs + tests) added; `GlazingTypesCatalogPage` rewritten on
  `<DataTable>` with 9 columns + bulk reactivate; modal retired.
  Added `u_value` (+ `specific_heat`) to the IP/SI registry on both
  sides so the U-value column toggles cleanly between
  `W/(m²·K)` and `Btu/(h-ft²-F)`.
- **Phase 3 (JSON import/export)** — `Complete`, `2026-06-04`.
  `backend/features/catalogs/glazing_types/import_export/` mirrors the
  materials pipeline (file_format, upgrade v0→v1 rename, coerce,
  tokens, pipeline, service); routes ship `/import/preview` +
  `/import/commit`. Frontend
  `frontend/src/features/catalogs/glazing-types/import_export/` ships
  `api.ts`, `types.ts`, `export.ts`, `useImportMutations.ts`,
  `ImportDialog.tsx`, `OverflowMenuItems.tsx`; the catalog page wires
  the overflow menu and dialog. Match key is `id`; round-trip is a
  no-op.
- **Phase 4 (Seed data + smoke)** — `Complete`, `2026-06-04`.
  Canonical seed at
  `backend/features/catalogs/glazing_types/seeds/glazing-types.v1.json`
  (43 rows derived from the AirTable CSV, with DATASHEET + LINK
  columns dropped per PRD). `backend/scripts/seed_glazing_catalog.py`
  loads it through the same preview→commit pipeline the HTTP routes
  use; wired as `make seed-glazing`. A pipeline-level seed-file smoke
  test guards against rot.

## Next step

Feature complete. Candidate follow-ups (deferred):

- Consolidation refactor over Materials / Frame / Glazing import
  pipelines once Frame ships.
- Re-export the seed file from the live catalog after the first
  seed run so subsequent reruns are idempotent on `id` rather than
  duplicating rows.

## Blockers

None known. The verification grep is the gating check before the
destructive migration; if it surfaces dependent code, that work
is in-scope for Phase 1 (not a blocker).

## Verification

- Tests touched: `tests/test_catalogs_glazing_*` (backend),
  `frontend/src/features/catalogs/glazing-types/__tests__/`
  (frontend), `frontend/tests/e2e/glazing-types-catalog.spec.ts`
  (E2E).
- Closeout gate: `make format` + `make ci` from repo root at end
  of every phase.

## Notes

- The 42-row CSV at
  `research/Glazing Data-ALL DATA.csv` is the seed source for
  Phase 4. Five rows are special: the two `DEFAULT |` rows and the
  three `Mercury | TRIO-E` / `Lamilux` / `Lepage` rows have
  unusual values that may stress validators — review them in the
  Phase 4 preview output before committing.
- The Materials Catalog landed in two separate planning folders
  (`materials-catalog-datatable` then
  `materials-catalog-import-export`). For Glazing we are
  combining them into one folder because the starting point is a
  stub landing page rather than a hand-rolled production table —
  there is no production behavior we need to bridge through an
  intermediate state.
