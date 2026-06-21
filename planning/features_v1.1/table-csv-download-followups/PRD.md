---
DATE: 2026-06-21
TIME: 10:20 EDT
STATUS: Deferred
AUTHOR: Claude (for Ed May)
SCOPE: Deferred behavior options for the Table CSV Download feature.
RELATED: ./README.md, ./STATUS.md, planning/archive/table-csv-download/PRD.md
---

# PRD — Table CSV Download Follow-ups

Each item below shipped in v1 with the **default** noted. The **alternative**
is what to evaluate if real usage wants different behavior. Implementation
pointers are to the shipped code so a future agent can find the seam fast.

## Open questions carried from v1 (archived PRD §6)

### F1 — Formula/computed error cells in the export

- **v1 default:** a computed-**error** cell (`isComputedErrorValue`)
  serializes as `""`, keeping a clean data column.
- **Alternative:** emit the human-readable `COMPUTED_ERROR_MESSAGES[code]`
  text (e.g. "Division by zero.") so errors are visible in the exported file.
- **Seam:** `formatExportCellValue` in
  `frontend/src/shared/ui/data-table/lib/export/csv.ts` — the single
  `if (isComputedErrorValue(value)) return ""` branch.
- **Decide on:** whether anyone exports tables mid-formula-edit and needs the
  error surfaced for debugging vs. wanting a clean column for downstream use.

### F2 — True `linked_record` id columns

- **v1 default:** the serializer exports whatever the column accessor yields.
  Display-accessor / inverse-link columns already export human labels; a
  column declared `accessorValue: "ids"` exports raw record ids.
- **Alternative:** resolve those ids to the joined **target record labels** so
  every linked column is human-readable in the CSV.
- **Seam:** the column accessor feeding `tableToCsv`; would need a per-column
  label resolver (the grid already resolves these for on-screen pills).
- **Decide on:** whether any production table actually mounts an
  `accessorValue: "ids"` linked column that a user would export. If none do,
  this is moot.

### F3 — Catalog "Export" label reconciliation

- **v1 default:** Materials / Glazing Types / Frame Types keep their bespoke
  `Export JSON` / `Import JSON…` overflow items **and** also get the new
  universal `Download CSV` — two export-ish items coexist in one menu.
- **Alternative:** rename / regroup so the two are not confusable (e.g.
  "Export catalog (JSON)" vs "Download table (CSV)", or a submenu).
- **Seam:** `CatalogImportExportMenu` (in each catalog page's
  `overflowMenuActions`) alongside the built-in `ViewMenuOverflow` item.
- **Decide on:** whether the coexistence actually confuses users in practice.

## Explicit v1 non-goals worth revisiting later (archived PRD §5)

These were ruled out for v1 on purpose; list them so they are not silently
forgotten:

- **Timestamped filenames** — v1 uses a predictable `${tableName}.csv` and
  lets the browser de-dupe repeats as `name (1).csv`. Add a timestamp option
  if archival snapshots need unique names.
- **Project/version context in the filename** — DataTable does not know the
  project name today; add if disambiguation across projects is wanted.
- **CSV-injection sanitization** (leading `= + - @`) — deliberately **not**
  applied; v1 preserves fidelity for the user's own local-use data. Revisit
  only if exported CSVs start flowing to untrusted consumers.
- **XLSX export / JSON-from-this-menu / format-options UI / "export selection
  only"** — out of scope; clipboard copy already covers selection export.

## Non-goals for this follow-up folder

- No new backend route — the v1 frontend-only decision stands unless a
  uniform server-side surface appears.
- No re-litigation of the current-view (WYSIWYG) scope or the RFC-4180 /
  BOM / CRLF wire format — those are settled and documented in
  `context/technical-requirements/data-table.md`.
