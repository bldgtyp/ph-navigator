---
DATE: 2026-06-04
TIME: 19:30 EDT
STATUS: Complete
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

- **Phase 0 (Planning)** — `Complete`, `2026-06-04`. README + PRD +
  PLAN drafted. **OQs resolved 2026-06-04** (see PRD §Resolved
  decisions).
- **Phase 1 (Backend destructive reshape + API)** — `Complete`,
  commit `5eb40eb`. Alembic 20260604_0017 drops the version
  table + `current_version_id`, renames
  `source_provenance → source` and `notes → comments`, adds the
  seven categorization columns. `POST /duplicate` wired. Dead
  `new_catalog_version_id` / `reject_clearing_version_date`
  helpers removed. FrameRef updated end-to-end. `make ci` green
  (490 backend + 1082 frontend tests).
- **Phase 2 (Frontend DataTable page)** — `Complete`, commit
  `3eed10b`. New `frontend/src/features/catalogs/frame-types/`
  (`controller.ts`, `fieldDefs.ts`, `__tests__/`) mirrors the
  glazing precedent. `FrameTypesCatalogPage.tsx` rewritten on
  `<DataTable>` with all seventeen columns; the
  `FrameTypeEditorModal` is retired. Added a `length_mm`
  number-units type (mm ↔ in) to `lib/units/numberUnits.ts` so
  the topbar IP/SI toggle flips `width_mm` display alongside the
  three thermal columns. Soft-enum categorization columns ship
  as plain `short_text` for v1; strict `single_select` promotion
  remains deferred to a follow-up after the Phase 4 seed lands
  (PRD D4).
- **Phase 3 (JSON import/export)** — `Complete`. New
  `backend/features/catalogs/frame_types/import_export/`
  (`file_format.py`, `coerce.py`, `tokens.py`, `upgrade.py`,
  `pipeline.py`, `service.py`) implements the
  `ph-navigator.catalog.frame-types` envelope; routes wire
  `POST /import/preview` + `POST /import/commit` with the
  8 MB body cap. v0 upgrade renames `source_provenance` /
  `notes` to `source` / `comments`, matching the Phase 1
  Alembic reshape. Frontend
  `frame-types/import_export/` mirrors glazing's
  `ImportDialog.tsx`, `OverflowMenuItems.tsx`, `export.ts`,
  `useImportMutations.ts`, `api.ts`, `types.ts`; overflow menu
  + dialog wired onto the page. Backend pytest covers happy
  path, bad envelope, schema-too-new, v0 upgrade, matched-id
  skip, bad number, unknown field, missing name, one-shot
  token, and round-trip noop. `make ci` green (500 backend +
  1095 frontend tests).
- **Phase 4 (Seed data + smoke)** — `Complete`. Committed
  `backend/features/catalogs/frame_types/seeds/frame-types.v1.json`
  (190 rows — CSV actually contains 190 data rows; the
  PRD/README's "189" estimate predates the conversion).
  Per PRD §Field provenance the conversion drops `DATASHEET`,
  `LINK`, `WIDTH_IN`, `U_VALUE_BTU_HR_FT2_F`,
  `PSI_G_BTU_HR_FT_F`; `psi_install_w_mk` is `null` for every
  row (PRD D5 — AirTable CSV doesn't carry it). New
  `scripts/seed_frame_catalog.py` and `make seed-frames`
  Makefile recipe pipe the seed through the same
  `preview_import` → `commit_import` service the HTTP routes
  use. Local run reported `new=190, matched=0, errored=0,
  warnings=0` and seeded 190 rows clean. Playwright MCP visual
  smoke deferred to manual verification by the operator
  against the live dev environment.
- **Closeout** — `make ci` green (500 backend + 1095 frontend
  tests). All four phases land on `feat/frame-types-catalog`
  ahead of merge.

## Next step

Manual operator verification: run `make seed-frames` locally
against the dev database, navigate to `/catalog/frame-types`,
confirm 190 rows render with the seventeen columns and that the
IP/SI topbar toggle flips the four numeric performance columns.
Once verified, merge `feat/frame-types-catalog` into `main`.
Follow-up tickets (deferred from PRD): (a) promote soft-enum
columns to strict `single_select` — **DONE** in
`planning/archive/window-frames-catalog-enums/` (manufacturer / brand / use /
operation / location / mull_type are now single-select via the
`catalog_field_options` store; `material` stays free text; `name` is derived);
(b) extract the shared `import_export` plumbing across Materials / Glazing /
Frames into a single abstraction (PRD §Out of scope).

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
