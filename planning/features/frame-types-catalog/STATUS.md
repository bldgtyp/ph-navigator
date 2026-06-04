---
DATE: 2026-06-04
TIME: 12:00 EDT
STATUS: Active
AUTHOR: Claude (Opus 4.7) + Ed May
SCOPE: Status ledger for the Window-Frame-Elements Catalog
       feature.
RELATED:
  - README.md
  - PRD.md
  - PLAN.md
---

# STATUS — Window-Frame-Elements Catalog

## Current state

- **Phase 0 (Planning)** — `Active`, `2026-06-04`. README + PRD +
  PLAN drafted. **OQs resolved 2026-06-04** (see PRD §Resolved
  decisions). Ready for Phase 1 kickoff.
- **Phase 1 (Backend destructive reshape + API)** — `pending`.
  Scope widened: drop version table + 4 columns, rename 2
  columns, add 7 columns.
- **Phase 2 (Frontend DataTable page)** — `pending`. 17 columns;
  largest catalog grid to date.
- **Phase 3 (JSON import/export)** — `pending`. Match key is `id`.
- **Phase 4 (Seed data + smoke)** — `pending`. 189 rows.

## Next step

Kick off Phase 1 on `feat/frame-types-catalog`. Create
`phases/phase-01-schema.md` with the detailed implementation
steps (per-column DDL, rename DDL, drop DDL, validator
additions, repository SQL diffs, pytest plan). Start with the
verification grep called out in PLAN.md/PRD.md §Backend Shape —
confirm no downstream code reads `catalog_version_id` /
`current_version_id` / `catalog_frame_type_versions` /
`catalog_schema_version` / `FrameRef.catalog_origin`. If
anything points at them, fold that work into the same Alembic
revision (mirror Materials Phase 2 in
`planning/archive/materials-catalog-datatable/phases/`).

## Blockers

None known. The verification grep is the gating check before
the destructive migration; if it surfaces dependent code, that
work is in-scope for Phase 1 (not a blocker).

## Verification

- Tests touched: `tests/test_catalogs_frame_*` (backend),
  `frontend/src/features/catalogs/frame-types/__tests__/`
  (frontend), `frontend/tests/e2e/frame-types-catalog.spec.ts`
  (E2E).
- Closeout gate: `make format` + `make ci` from repo root at end
  of every phase.

## Notes

- The 189-row CSV at `research/Frame Data-ALL DATA.csv` is the
  seed source for Phase 4. Spot-check rows during Phase 4
  preview:
  - **Mullion rows** (`location = "Mull-V"` or `"Mull-H"`)
    populate `mull_type` with directional sub-codes (`OP-to-OP`,
    `OP-to-FX`, `FX-to-FX`). Validate the seed JSON preserves
    these.
  - **Lift & Slide** rows (Alpen Zenith) use a non-trivial
    `use` value with a space; ensure the JSON envelope handles
    that without trimming.
  - The `Default` row (no manufacturer pipe-separator in the
    name) is a fallback row; consider whether to include it in
    the seed or generate it programmatically.
  - **Doors with no glazing** (`Curries | Mercury`) have very
    high `psi_g_w_mk` values (0.226-0.291) — these are real and
    correct for steel doors.
- The Materials Catalog landed in two separate planning folders
  (`materials-catalog-datatable` then
  `materials-catalog-import-export`). For Frames we are
  combining them into one folder because the starting point is a
  stub landing page rather than a hand-rolled production table.
- The Glazing-Types Catalog
  (`../glazing-types-catalog/`) is the sibling build; the two
  features can land in any order on disjoint files. Resist
  premature shared-abstraction work until both ship.
