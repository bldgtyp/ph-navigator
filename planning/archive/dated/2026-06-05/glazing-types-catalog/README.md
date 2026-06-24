---
DATE: 2026-06-04
TIME: 12:00 EDT
STATUS: Active
AUTHOR: Claude (Opus 4.7) + Ed May
SCOPE: Build out the Window-Glazing Catalog from a stub landing page
       into a full DataTable-backed catalog manager with JSON
       import/export and AirTable-derived seed data.
RELATED:
  - PRD.md
  - PLAN.md
  - STATUS.md
  - ../frame-types-catalog/README.md
  - ../../../context/user-stories/10-windows.md (US-WIN-3, US-WIN-4)
  - ../../../context/technical-requirements/data-table.md
  - ../../../planning/archive/materials-catalog-datatable/  (precedent)
  - ../../../planning/archive/materials-catalog-import-export/  (precedent)
  - ../../../research/Glazing Data-ALL DATA.csv  (seed dataset, 42 rows)
---

# Window-Glazing Catalog

## What this feature folder is

The execution surface for turning `/catalog/glazing-types` from a
hand-rolled HTML table on a stub landing page into a first-class
catalog manager built on the shared `<DataTable>` component — matching
the look, feel, and toolset of `/catalog/materials`.

The Window-Glazing Catalog is the bookshelf source for IGU
constructions referenced by project Window elements
(US-WIN-3 browse, US-WIN-4 bookshelf-copy). Catalog rows hold the
*intrinsic glazing performance properties* (U-value, g-value, identity
metadata); per-project evidence such as datasheet PDFs lives on the
project, not in the catalog.

The Frame-Types Catalog (`../frame-types-catalog/`) is a parallel
build with the same shape and roughly the same phase plan, but a
larger field set; the two feature folders ship independently.

## Read order

1. `PRD.md` — behavioral contract: data model (final field list),
   API surface, JSON file format, DataTable wiring, IP/SI unit
   contract, validation, acceptance criteria, non-goals.
2. `PLAN.md` — the four-phase implementation sequence with
   per-phase scope, dependencies, and exit criteria.
3. `STATUS.md` — current state, next step, blockers.
4. `phases/` — per-phase plans are added when each phase moves to
   `in_progress`. The PLAN.md phase summaries are authoritative
   until then.

## Phase map (locked 2026-06-04)

Each phase lands as one mergeable PR; each ends with the app in a
working state. Phases execute in order — Phase 2 depends on the new
schema columns from Phase 1; Phase 3 depends on the DataTable wiring
from Phase 2; Phase 4 depends on the import endpoint from Phase 3.

- **Phase 01 — Schema + backend** (`phases/phase-01-schema.md` when
  active). Add the missing CSV-aligned column to
  `catalog_glazing_types` via Alembic, extend the Pydantic models and
  repository, keep all existing endpoints green, add backend tests.
- **Phase 02 — DataTable page** (`phases/phase-02-datatable.md` when
  active). Replace the hand-rolled table in
  `GlazingTypesCatalogPage.tsx` with `<DataTable>`. Create
  `frontend/src/features/catalogs/glazing-types/` (controller,
  fieldDefs, types) mirroring `materials/`. Wire cell edits, row
  add/duplicate/soft-delete/reactivate, IP/SI display.
- **Phase 03 — JSON import/export** (`phases/phase-03-import-export.md`
  when active). Add `backend/features/catalogs/glazing_types/import_export/`
  (file_format, coerce, tokens, upgrade, pipeline, service) and the
  `/import/preview` + `/import/commit` endpoints. Add the frontend
  `ImportDialog`, `export.ts`, `OverflowMenuItems`,
  `useImportMutations`. Both sides tested.
- **Phase 04 — Seed data + smoke**
  (`phases/phase-04-seed-data.md` when active). Commit the canonical
  JSON seed file derived from
  `research/Glazing Data-ALL DATA.csv` under
  `backend/features/catalogs/glazing_types/seeds/`. Add a
  `make seed-glazing` recipe (or `uv run` script) that POSTs the
  seed through `/import/commit`. Playwright MCP smoke verifying the
  full UX (load → import → edit → export → re-import).

When all four phases are merged, the feature rolls to `STATUS:
Complete` and the canonical behavior moves into the relevant
`context/` doc(s) (PRD §7 catalog bookshelf; the
`context/user-stories/10-windows.md` references to the glazing
catalog become satisfied).

## Out of scope (explicit non-goals)

- Datasheet PDF / file attachments on catalog rows — datasheets and
  any per-project document evidence live on the **project**, not the
  catalog (decided 2026-06-04). The `DATASHEET` and AirTable
  attachment columns in the CSV are intentionally dropped during
  seed import.
- Per-project copy-out / refresh-from-catalog flow. That is owned by
  US-WIN-4 (bookshelf copy) and US-WIN-11 (refresh-from-catalog) in
  the windows feature folder.
- A second-pass shared abstraction over Materials / Glazing / Frame
  catalogs. The three catalogs are structurally similar; a
  consolidation refactor is a candidate follow-up *after* both this
  folder and `../frame-types-catalog/` ship.
- Custom user-authored fields on glazing rows. Catalog field set is
  fixed built-ins; matches the Materials Catalog precedent.
- CSV import/export. JSON is the durable file format; the CSV in
  `research/` is a one-shot seed source, not a supported file type.

## Relationship to existing code

- Backend `backend/features/catalogs/glazing_types/` already has
  `routes.py`, `models.py`, `service.py`, `repository.py` populated
  with CRUD + soft-delete + reactivate. Phase 1 *extends* this — it
  does not replace it.
- Frontend `frontend/src/features/catalogs/routes/GlazingTypesCatalogPage.tsx`
  currently renders a custom HTML table and a modal editor
  (`GlazingTypeEditorModal.tsx`). Phase 2 replaces the page body
  with a DataTable; the modal can be retired once the DataTable
  covers all edit affordances (target: end of Phase 2).
- Shared `<DataTable>` lives at `frontend/src/shared/ui/data-table/`.
  No changes to the component itself are anticipated; this feature
  consumes the existing public API.
