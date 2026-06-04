---
DATE: 2026-06-04
TIME: 12:00 EDT
STATUS: Active
AUTHOR: Claude (Opus 4.7) + Ed May
SCOPE: Status ledger for the Window-Glazing Catalog feature.
RELATED:
  - README.md
  - PRD.md
  - PLAN.md
---

# STATUS — Window-Glazing Catalog

## Current state

- **Phase 0 (Planning)** — `Active`, `2026-06-04`. README + PRD +
  PLAN drafted. **OQs resolved 2026-06-04** (see PRD §Resolved
  decisions). Ready for Phase 1 kickoff.
- **Phase 1 (Backend destructive reshape + API)** — `pending`.
  Scope widened: drop version table + 4 columns, rename 2
  columns, add 1 column.
- **Phase 2 (Frontend DataTable page)** — `pending`. 9 columns.
- **Phase 3 (JSON import/export)** — `pending`. Match key is `id`.
- **Phase 4 (Seed data + smoke)** — `pending`. 42 rows.

## Next step

Kick off Phase 1 on `feat/glazing-types-catalog`. Create
`phases/phase-01-schema.md` with the detailed implementation
steps. Start with the verification grep called out in
PLAN.md/PRD.md §Backend Shape — confirm no downstream code reads
`catalog_version_id` / `current_version_id` /
`catalog_glazing_type_versions` / `catalog_schema_version` /
`GlazingRef.catalog_origin`. If anything points at them, fold that
work into the same Alembic revision (mirror Materials Phase 2 in
`planning/archive/materials-catalog-datatable/phases/`).

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
