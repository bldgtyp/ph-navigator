---
DATE: 2026-06-03
TIME: 21:45 EDT
STATUS: Draft — open questions resolved; ready for phased plan.
AUTHOR: Claude (Opus 4.7)
SCOPE: Add JSON import (upload) and JSON export (download) to the
       Materials Catalog page so the catalog can be seeded, backed up,
       and bulk-extended from a file. Surfaced through the DataTable
       "More view actions" overflow menu.
RELATED:
  - ../materials-catalog-datatable/PRD.md
  - ../../../context/technical-requirements/data-table.md
  - ../../../backend/features/catalogs/materials/
  - ../../../frontend/src/features/catalogs/materials/
  - ../../../frontend/src/shared/ui/data-table/components/ViewMenuOverflow.tsx
  - ../../../research/Material Data-Grid view.csv  (reference dataset)
---

# Materials Catalog — JSON Import / Export — PRD

## Problem

The Materials Catalog now renders on the shared `<DataTable>` and
holds the canonical nine-field record shape (see
`materials-catalog-datatable/PRD.md`). It has no bulk in/out path:

- Seeding a fresh environment means hand-typing rows.
- There is no backup mechanism short of `pg_dump`.
- Migrating existing materials (~hundreds of rows, e.g. the WUFI /
  manufacturer datasheet set captured in
  `research/Material Data-Grid view.csv`) is not feasible row-by-row
  through the grid.
- When the schema does evolve (rename, drop, add a field), we have no
  way to re-ingest an older export without manual transformation.

We want a small, file-based round-trip — **download JSON** to back up
or transport the catalog, **upload JSON** to seed, restore, or
bulk-extend it — with a forgiving importer that tolerates older
schemas by converting what it can and leaving the rest blank.

## Goals

1. From the Materials Catalog page, a user can **download** the current
   catalog as a single JSON file. The file is self-describing
   (versioned envelope) and round-trips losslessly back through upload.
2. From the same page, a user can **upload** a JSON file to import
   records. Import handles three cases per row:
   - **New** — no existing match → insert.
   - **Duplicate / match** — existing match → resolve per the user's
     chosen conflict policy (skip / update / add-as-new).
   - **Schema drift** — file's schema doesn't match current → coerce
     what we can, leave unknown / unparseable fields blank, surface a
     per-row warning in the preview.
3. The user sees a **dry-run preview** before any row is written, with
   counts for new / matched / updated / skipped / errored and per-row
   warnings, and can cancel without side effects.
4. Both actions live behind the DataTable **"More view actions"**
   overflow menu (the kebab on the toolbar — `ViewMenuOverflow`,
   reachable on `MaterialsCatalogPage` via the
   `overflowMenuActions` slot).

## Non-Goals

- CSV import/export. The reference CSV at
  `research/Material Data-Grid view.csv` is informational only; the
  v1 file format is JSON. (A CSV adapter may follow but is out of
  scope; CSV's lack of typed values and provenance makes it a poor
  durable backup format.)
- Import/export for the **other** catalogs (Frame Types, Glazing
  Types) — out of scope here, but the import/export shape is designed
  to generalize.
- Import of project-document material snapshots
  (`ProjectMaterial`) — that's a different lifecycle.
- Attachments, datasheet PDFs, or any binary payload alongside the
  JSON. JSON is values-only.
- Server-side scheduled / background imports. v1 is synchronous,
  user-initiated, browser-driven.
- Field-definition import (custom FieldDefs). The catalog's nine
  fields are fixed built-ins; we don't import field shape.
- Undo of a completed import as a single semantic action. Import is
  treated as a bulk write; users can rely on JSON re-upload from a
  prior backup to restore.

## Users & Stories

Primary user: Ed / BLDGTYP staff seeding or maintaining the catalog.
Secondary: any future user who wants to back up before a risky bulk
edit.

### Story 1 — Seed a fresh catalog from a file

> As a CPHC, I have a JSON file with ~300 vetted materials. From the
> Materials Catalog page I open **More view actions → Import JSON**,
> pick the file, review the preview ("300 new, 0 matched, 0
> errored"), confirm, and see all rows in the grid.

### Story 2 — Back up before bulk editing

> Before changing categories on 50 rows, I open **More view actions →
> Export JSON**, save the file locally, do my edits, and know I can
> restore by re-uploading the file if something goes wrong.

### Story 3 — Add a manufacturer's product line

> A door manufacturer publishes 14 new assemblies. I drop them into a
> JSON file matching the catalog shape, upload, choose **"Skip
> matches, insert new"**, and confirm. The 14 new rows land; existing
> rows are untouched.

### Story 4 — Re-import an older backup after a schema change

> Six months from now we rename `comments` → `notes`. I upload a JSON
> file exported under the old schema. The importer recognizes the
> file's schema version, maps `comments` → `notes`, warns on any
> field it could not map, and writes rows with the unrecognized
> fields left blank. I see the warnings in the preview before
> committing.

### Story 5 — Catch and reject a bad file

> I upload the wrong file (an Excel export, a PDF, a corrupted JSON).
> The importer fails fast at the file-parse step with a single clear
> error and writes nothing. The grid is unchanged.

## Surface — DataTable Overflow Menu

The DataTable toolbar already exposes a `ViewMenuOverflow` ("More
view actions") popover at the right of the axis-button cluster, with
an `actions` slot intended for page-specific items
(`frontend/src/shared/ui/data-table/components/ViewMenuOverflow.tsx`).
`<DataTable>` forwards a `overflowMenuActions` prop into it
(`DataTable.tsx:1128`).

`MaterialsCatalogPage` will pass a node containing two menu items:

- **Export JSON** — triggers a synchronous download of the current
  catalog (all active rows by default; "include inactive" follows
  the page's existing include-inactive toggle state).
- **Import JSON…** — opens a modal with file picker → preview →
  confirm flow.

No new toolbar real estate; both items are inside the existing
overflow popover. Keyboard reachable through the existing popover
focus management.

## File Format — `materials.catalog.json` v1

A JSON object with a small envelope so the importer can dispatch on
schema version. Pretty-printed; UTF-8; LF line endings.

```json
{
  "kind": "ph-navigator.catalog.materials",
  "schema_version": 1,
  "exported_at": "2026-06-03T21:15:00Z",
  "exported_by": "ed.p.may@gmail.com",
  "app_version": "ph-navigator-v2 <git-sha>",
  "rows": [
    {
      "external_id": "01HWQ7K3Z9F8YV2N4D6XJ5C0AB",
      "name": "AAC Block",
      "category": "insulation",
      "density_kg_m3": null,
      "specific_heat_j_kgk": null,
      "conductivity_w_mk": 0.1090,
      "emissivity": 0.90,
      "color": "#e6e6e6",
      "source": "WUFI-Passive Database",
      "url": "",
      "comments": ""
    }
  ]
}
```

Conventions:

- `rows[i]` keys are exactly the nine catalog `field_key`s from
  `materials-catalog-datatable/PRD.md`.
- Values are **canonical SI** (units never appear in the file — the
  frontend SI/IP toggle is a display concern, not a storage one).
- `category` values are option **ids** (e.g. `"insulation"`), not
  display labels.
- `color` is `#rrggbb` (the on-the-wire form data-table.md already
  defines). The legacy ARGB tuple from the reference CSV is **not**
  the storage form.
- Missing keys are treated as `null` / unset by the importer.
- Unknown keys are ignored on import and a per-row warning is
  surfaced.
- `external_id` is a **stable, portable identifier** (ULID, opaque
  string) generated server-side on row create and persisted on the
  `catalog_materials` row. It is the primary dedup match key (see
  below) and survives renames. Exports always include it; imports
  prefer it when present.
- The internal database `id`, `created_at`, `created_by`,
  `updated_at`, `updated_by`, `is_active` are **excluded** from the
  export. The importer ignores them if present. (Rationale: internal
  identity is local to a database; `external_id` is the portable
  one.)

### Schema versioning

- `schema_version` is an integer. v1 corresponds to the nine-field
  contract in `materials-catalog-datatable/PRD.md`.
- A future schema change (rename / add / drop) bumps
  `schema_version` and ships a migration map (`v1 → v2`,
  `v2 → v3`) inside the importer. Each step is a pure function
  `oldRow → newRow` that can drop / rename / default fields.
- Importing an **older** version: pipe through the chain of upgrade
  functions, then validate.
- Importing a **newer** version than the running app knows: refuse
  with a single dialog ("This file was exported by a newer version
  of PH-Navigator. Upgrade the app or downgrade the file.").

## Import Behavior

### Pipeline

1. **Parse.** Read the file as text → `JSON.parse`. Fail-fast with
   the JSON parse error if it isn't valid JSON.
2. **Envelope check.** Reject if `kind !==
   "ph-navigator.catalog.materials"` or `schema_version` is missing
   or non-integer.
3. **Upgrade.** Run the row through the upgrade chain for its
   `schema_version` to bring it to the current shape.
4. **Coerce / validate per row.** For each row:
   - Drop unknown keys (record a warning).
   - Coerce types where forgiving (string number → number; unknown
     `category` option → leave blank + warning; malformed `color` →
     blank + warning).
   - Required-field check (`name`): if missing/empty, the row is
     **errored** and excluded from the write set.
5. **Dedup match.** For each surviving row, look up an existing
   catalog row by the **match key** (see below). Classify as
   `new` or `match`.
6. **Preview.** Render the dry-run report; the user picks a conflict
   policy and confirms (or cancels).
7. **Commit.** Send the write batch to the backend (single
   transaction) and re-fetch the catalog list.

### Match key (deduplication)

Dedup is **by `external_id`**:

- **Primary:** exact `external_id` match against an existing
  `catalog_materials` row.
- **No fallback to `name`.** If a row's `external_id` is missing or
  doesn't match any existing row, the row is classified `new`. (Two
  rows with the same `name` but different `external_id`s are two
  different materials. The catalog already allows duplicate names.)
- **Rows without `external_id` in the file** (e.g. files
  hand-authored by a user, or files from a tool that doesn't emit
  ids): always classified `new`. The backend assigns a fresh
  `external_id` on insert.

This makes round-trips fully unambiguous through renames and
duplicate names, and keeps the importer's matching logic trivial.

### Conflict policy (MVP)

MVP ships **Skip matches** as the only behavior — no user choice
required:

- `match` rows (existing `external_id` already in the catalog) are
  dropped from the write set and reported in the preview as
  "skipped (already in catalog)".
- `new` rows are inserted; `errored` rows are excluded.

Update-in-place and add-all-as-new policies are deferred to a
follow-up release. The preview UI still shows the count of matched
rows so the user understands what's being skipped, but there is no
radio in v1.

### Schema drift handling

When a row arrives under an older `schema_version`, the upgrade
chain rewrites it to the current shape, then row-level coercion runs.
Examples (illustrative; v1 is the current shape):

- **Renamed field** (`source_provenance` → `source`): upgrade step
  copies value across, warning is suppressed.
- **Dropped field** (`density_lb_ft3` legacy IP column): upgrade
  step ignores it; warning logged ("field X was dropped in v2").
- **New field** added since the file was exported: row gets the
  field unset (`null`); no warning (this is the expected case).
- **Type narrowed** (`category` text → fixed single_select): if
  the value matches an option label or id (case-insensitive), it's
  resolved to the option id; otherwise it's left blank and a
  warning is recorded.
- **Unit change** (e.g. someday we switch a canonical SI unit):
  upgrade step does the unit conversion.

The rule of thumb: **convert what we can, blank what we can't, never
fail the whole import on a single recoverable row.**

### Preview UI

A modal dialog with:

- File name, file's `schema_version`, file's `exported_at`.
- Summary counts: `N new`, `N matched (will be skipped)`,
  `N errored`, `N warnings`.
- A collapsible list of per-row warnings/errors, grouped by reason
  (e.g. "Unknown category (4 rows)", "Missing name (1 row)").
- **Cancel** / **Import N rows** buttons.

No write happens until the user clicks Import.

### Commit / write path

The backend owns the import pipeline end-to-end (parse, envelope
check, upgrade chain, coerce, dedup, validate, write) so that the
same logic is reachable from non-browser callers — a future CLI,
an MCP endpoint, or a scripted seeding job. The frontend is a thin
client: upload the raw file, render the dry-run report, post a
commit token.

Two-call flow:

1. `POST /api/v1/catalogs/materials/import/preview`
   - Body: the raw file contents as JSON (one request, no
     pre-parsing in the browser beyond `JSON.parse` for client-side
     error messages on totally invalid files).
   - Response: dry-run report —
     `{ token, schema_version, counts: { new, matched, errored, warnings }, warnings: [...], rows_preview: [...] }`.
   - `token` is opaque, server-held, ties the preview to a
     normalized write set cached for a short TTL (e.g. 10 min).
   - No DB writes.

2. `POST /api/v1/catalogs/materials/import/commit`
   - Body: `{ token }`.
   - Server replays the cached write set in a single DB transaction
     (inserts only in MVP, given Skip-matches policy).
   - Response: `{ inserted: N, skipped: N, rows: [...] }`.

- Server-side validation errors during preview abort with an
  error report; nothing is written. A commit call with a
  stale/unknown token returns 410 Gone.
- The frontend invalidates the materials query and the grid
  re-renders from fresh server state after commit.
- The same `preview` + `commit` endpoints are the contract a future
  MCP / CLI caller will use; nothing in the import path lives only
  in the browser.

## Export Behavior

- Synchronous; no backend round-trip required if the page already
  holds the data. v1 implementation: serialize from the in-memory
  query cache.
- Filename: `materials-catalog_<YYYY-MM-DD>.json`.
- Pretty-printed (2-space indent) for diff-friendliness.
- Includes inactive rows iff the page's include-inactive toggle is
  on at export time (i.e., "what you see is what you export").
- No selection-based export in v1 — always full visible set. (Open
  question.)

## Acceptance

- **Surface.** `MaterialsCatalogPage` exposes "Export JSON" and
  "Import JSON…" in the DataTable's "More view actions" overflow
  menu; no new toolbar buttons elsewhere.
- **Round-trip.** Exporting the catalog and re-importing the same
  file results in zero inserts and N skipped rows (every row matches
  on `external_id`); the catalog is unchanged.
- **Seed.** Importing a JSON file derived from the reference CSV
  (`research/Material Data-Grid view.csv`) into an empty catalog
  produces one row per CSV record with the nine canonical fields
  populated where the CSV had values, and `null` everywhere the CSV
  was blank.
- **Schema drift.** Importing a fabricated "v0" file (with
  `source_provenance` / `notes` legacy keys) succeeds, mapping
  values into `source` / `comments`, with a per-rule warning shown
  in the preview.
- **Bad file.** A non-JSON file or a JSON file with a wrong `kind`
  is rejected at the parse / envelope step with a single clear
  error; no rows change.
- **Dry-run.** Cancelling the preview never writes.
- **Backend transaction.** A server-side validation failure on any
  row aborts the entire import; the DB is unchanged.
- **CI.** `make ci` green from repo root.

## Resolved Decisions

1. **Match key = `external_id`.** A stable, opaque, server-assigned
   identifier on `catalog_materials`. No fallback to `name`. Rows
   without `external_id` are always inserted as new.
2. **Conflict policy = Skip matches only** for MVP. No user choice
   in the preview. Update-in-place and add-all-as-new policies are
   deferred.
3. **No selection-based export** in MVP. Export = full visible set.
4. **Export includes inactive iff** the page's include-inactive
   toggle is on at export time. "What you see is what you export."
5. **Backend owns the import pipeline.** Parse, upgrade chain,
   validation, dedup, and write all live behind
   `POST /api/v1/catalogs/materials/import/{preview,commit}`. This
   makes the same path reachable from a future MCP endpoint or
   CLI; the browser stays a thin client.
6. **No CSV adapter.** Out of scope; not stubbed.
