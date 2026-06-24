---
DATE: 2026-06-04
TIME: 19:30 EDT
STATUS: Complete
AUTHOR: Claude (Opus 4.7) + Ed May
SCOPE: Build out the Window-Frame-Elements Catalog from a stub
       landing page into a full DataTable-backed catalog manager
       with JSON import/export and AirTable-derived seed data.
RELATED:
  - PRD.md
  - PLAN.md
  - STATUS.md
  - ../glazing-types-catalog/README.md
  - ../../../context/user-stories/10-windows.md (US-WIN-3, US-WIN-4)
  - ../../../context/technical-requirements/data-table.md
  - ../../../planning/archive/materials-catalog-datatable/  (precedent)
  - ../../../planning/archive/materials-catalog-import-export/  (precedent)
  - ../../../research/Frame Data-ALL DATA.csv  (seed dataset, 189 rows)
---

# Window-Frame-Elements Catalog

## What this feature folder is

The execution surface for turning `/catalog/frame-types` from a
hand-rolled HTML table on a stub landing page into a first-class
catalog manager built on the shared `<DataTable>` component —
matching the look, feel, and toolset of `/catalog/materials`.

The Window-Frame-Elements Catalog is the bookshelf source for the
per-side frame profiles referenced by project Window elements
(US-WIN-3 browse, US-WIN-4 bookshelf-copy). Catalog rows hold the
*intrinsic frame performance properties* (U-value, psi-g, width,
identity metadata) plus the discriminators that locate each row in
a manufacturer's frame system (use / operation / location /
mull-type / prefix / suffix). Per-project evidence such as
datasheet PDFs lives on the project, not in the catalog.

The Window-Glazing Catalog (`../glazing-types-catalog/`) is a
parallel build with the same shape and roughly the same phase
plan, but a smaller field set; the two feature folders ship
independently.

## Read order

1. `PRD.md` — behavioral contract: data model (final field list
   including seven new identity / categorization columns), API
   surface, JSON file format, DataTable wiring, IP/SI unit
   contract for U-value / psi-g / width, validation, acceptance
   criteria, non-goals.
2. `PLAN.md` — the four-phase implementation sequence with
   per-phase scope, dependencies, and exit criteria.
3. `STATUS.md` — current state, next step, blockers.
4. `phases/` — per-phase plans are added when each phase moves to
   `in_progress`. The PLAN.md phase summaries are authoritative
   until then.

## Phase map (locked 2026-06-04)

Each phase lands as one mergeable PR; each ends with the app in a
working state. Phases execute in order — Phase 2 depends on the
new schema columns from Phase 1; Phase 3 depends on the DataTable
wiring from Phase 2; Phase 4 depends on the import endpoint from
Phase 3.

- **Phase 01 — Schema + backend** (`phases/phase-01-schema.md`
  when active). Add seven new columns to `catalog_frame_types`
  via Alembic (`use`, `operation`, `location`, `mull_type`,
  `prefix`, `suffix`, `material`), extend the Pydantic models and
  repository, keep all existing endpoints green, add backend
  tests.
- **Phase 02 — DataTable page** (`phases/phase-02-datatable.md`
  when active). Replace the hand-rolled table in
  `FrameTypesCatalogPage.tsx` with `<DataTable>`. Create
  `frontend/src/features/catalogs/frame-types/` (controller,
  fieldDefs, types) mirroring `materials/`. Wire cell edits, row
  add/duplicate/soft-delete/reactivate, IP/SI display for
  U-value, psi-g, and width.
- **Phase 03 — JSON import/export** (`phases/phase-03-import-export.md`
  when active). Add `backend/features/catalogs/frame_types/import_export/`
  (file_format, coerce, tokens, upgrade, pipeline, service) and
  the `/import/preview` + `/import/commit` endpoints. Add the
  frontend `ImportDialog`, `export.ts`, `OverflowMenuItems`,
  `useImportMutations`. Both sides tested.
- **Phase 04 — Seed data + smoke**
  (`phases/phase-04-seed-data.md` when active). Commit the
  canonical JSON seed file derived from
  `research/Frame Data-ALL DATA.csv` under
  `backend/features/catalogs/frame_types/seeds/`. Add a
  `make seed-frames` recipe (or `uv run` script) that POSTs the
  seed through `/import/commit`. Playwright MCP smoke verifying
  the full UX (load → import → edit → export → re-import).

When all four phases are merged, the feature rolls to `STATUS:
Complete` and the canonical behavior moves into the relevant
`context/` doc(s).

## Out of scope (explicit non-goals)

- Datasheet PDF / file attachments on catalog rows — datasheets
  and any per-project document evidence live on the **project**,
  not the catalog (decided 2026-06-04). The `DATASHEET` and
  `LINK` columns in the CSV are intentionally dropped during seed
  import.
- Per-project copy-out / refresh-from-catalog flow. That is owned
  by US-WIN-4 (bookshelf copy) and US-WIN-11
  (refresh-from-catalog) in the windows feature folder.
- A second-pass shared abstraction over Materials / Glazing /
  Frame catalogs. The three catalogs are structurally similar; a
  consolidation refactor is a candidate follow-up *after* both
  this folder and `../glazing-types-catalog/` ship.
- Strict enum validation for `use` / `operation` / `location` /
  `mull_type`. The CSV data has minor variation (e.g. "Lift &
  Slide" as a `use` value, "Mull-V" with a directional sub-code
  in `mull_type`), so v1 stores these as `text` with optional
  client-side option hints. Strict enumeration is deferred.
- Custom user-authored fields on frame rows. Catalog field set is
  fixed built-ins; matches the Materials Catalog precedent.
- CSV import/export. JSON is the durable file format; the CSV in
  `research/` is a one-shot seed source, not a supported file
  type.

## Relationship to existing code

- Backend `backend/features/catalogs/frame_types/` already has
  `routes.py`, `models.py`, `service.py`, `repository.py`
  populated with CRUD + soft-delete + reactivate. Phase 1
  *extends* this — it does not replace it.
- Frontend `frontend/src/features/catalogs/routes/FrameTypesCatalogPage.tsx`
  currently renders a custom HTML table and a modal editor
  (`FrameTypeEditorModal.tsx`). Phase 2 replaces the page body
  with a DataTable; the modal can be retired once the DataTable
  covers all edit affordances (target: end of Phase 2).
- Shared `<DataTable>` lives at `frontend/src/shared/ui/data-table/`.
  No changes to the component itself are anticipated; this
  feature consumes the existing public API.

## Relationship to the sibling Glazing-Types Catalog

The Glazing-Types Catalog and the Frame-Types Catalog are
structurally identical — both replace a stub landing page with a
DataTable, both add JSON import/export, both seed from an
AirTable CSV. The Frame catalog differs by:

- Larger field set (eighteen columns vs. eleven), with seven
  category / identity columns (`use`, `operation`, `location`,
  `mull_type`, `prefix`, `suffix`, `material`) absent from
  glazing.
- Two extra numeric performance properties (`psi_g_w_mk`,
  `psi_install_w_mk`) and a physical dimension (`width_mm`) on
  top of `u_value_w_m2k`.
- A much larger seed dataset (189 rows vs. 42).

The two folders deliberately do **not** share planning content;
the implementation should resist premature abstraction. Once both
ship, a follow-up "catalogs shared abstraction" feature folder
may consolidate the import_export plumbing, the DataTable
controller boilerplate, and the seed-loader recipe.
