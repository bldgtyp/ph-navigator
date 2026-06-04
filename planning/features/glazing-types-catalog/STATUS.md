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
  PLAN drafted; awaiting human review before Phase 1 kickoff.
- **Phase 1 (Backend schema + API)** — `pending`.
- **Phase 2 (Frontend DataTable page)** — `pending`.
- **Phase 3 (JSON import/export)** — `pending`.
- **Phase 4 (Seed data + smoke)** — `pending`.

## Next step

Human review of `PRD.md` and `PLAN.md`. Resolve the three open
questions called out in PRD §Open questions:

1. OQ1 — Keep the `catalog_glazing_type_versions` layer for v1?
2. OQ2 — Is `name` alone sufficient as the import match key, or do
   we need `name + suffix`?
3. OQ3 — Rename `source_provenance → source` for parity with
   Materials Catalog?

Once those are settled, kick off Phase 1 on
`feat/glazing-types-catalog` and create `phases/phase-01-schema.md`
with the detailed implementation steps.

## Blockers

None known. The existing backend `glazing_types/` feature already
has CRUD + soft-delete + reactivate wired, so Phase 1 is purely
additive.

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
