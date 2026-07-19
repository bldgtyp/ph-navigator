> Split from `context/UI_UX.md` §2 (Pages — narrative). Cross-cutting design
> intent (§0), common elements incl. the DataTable model (§1 / §1.7), flows
> (§3), and the state-indicator cheatsheet (§4) stay in `../../UI_UX.md` —
> read it alongside this page.

# 2.3 Catalog manager pages (`/catalog/{materials|frame-types|glazing-types}`)

**Purpose:** Curate the three global libraries that projects pick from.
Catalogs are app-level (not project-scoped): a signed-in user can browse
them; mutating them is gated on the `catalog.edit` capability
(`canEditCatalogs`). The Dashboard's Catalogs card grid (§2.2) and the
topbar `Catalogs ▾` menu (`CatalogMenu`) both link here.

## Routes

There are **three explicit routes** — one per catalog — not a dynamic
`/catalog/{slug}` template. The slugs are fixed in
`features/catalogs/lib.ts` (`CATALOGS`):

| Route | Page component | Library |
| --- | --- | --- |
| `/catalog/materials` | `MaterialsCatalogPage` | Materials |
| `/catalog/frame-types` | `FrameTypesCatalogPage` | Window-Frame Elements |
| `/catalog/glazing-types` | `GlazingTypesCatalogPage` | Window-Glazing |

**No versioning.** Catalogs are plain global tables with an active/inactive
(soft-delete) flag per row. There is no version picker, no active-version
banner, no "Save as new version", and no per-catalog audit-log link. Writes
land directly (each cell edit / insert / duplicate is its own request via the
page's controller); the DataTable's optimistic-write model (§1.7) applies.

## Page chrome (shared across all three)

- **Topbar** (`WorkspaceTopbar`): breadcrumbs (`Catalogs / <library>`), a
  `Catalogs ▾` menu (`CatalogMenu`) to jump between the three libraries, the
  global IP/SI unit toggle, and the account menu.
- **New-row entry** (editors only):
  - Materials opens `MaterialEditorModal` via a "New Material +" button and
    also supports Shift-Enter to append a blank grid row.
  - Frame-types opens `FrameTypeCreateModal` from the table's footer "+"
    (its `name` is server-derived from parts, so a modal collects them);
    Shift-Enter still appends a blank row.
  - Glazing-types follows the same pattern as frame-types.
- **Deactivated toggle**: a "Show deactivated …" checkbox filters
  soft-deleted rows in/out client-side (the full catalog is fetched once).
  Selecting deactivated rows exposes a bulk **Reactivate** action.
- **Row count** label.
- **Overflow menu**: per-catalog **Import** / **Export** (JSON) via
  `CatalogImportExportMenu` + `ImportDialog`. Export is disabled on an empty
  catalog; Import is editor-only.
- **The grid** is the shared `<DataTable>` (§1.7); only the column
  declarations, `fieldDefs`, and which row-chrome slots are enabled differ
  between the three. `readOnly` is driven by `!canEditCatalogs(session)`.
  Row-open (for materials/frames) launches the editor modal for that record.

## Materials

Columns: name, category (single-select), density, specific heat,
conductivity, emissivity, color, source, URL, comments (plus the
active/inactive flag). `MaterialEditorModal` is the create/edit form.

## Frame-types (Window-Frame Elements) and glazing-types (Window-Glazing)

These carry single-select "config" fields (e.g. use, operation, location,
mull type on frames) whose option lists are editable in-grid. Because those
options are referenced by project documents, **renaming or deleting an option
runs an option-cascade job**:

- The grid's edit-field-bundle flow calls `previewCatalogOptionCascade` to
  count affected catalog rows and projects, then shows a confirmation
  ("Rename N options? This updates X catalog rows and rewrites references in
  Y projects. The catalog stays locked until the project cascade finishes.").
- On confirm, the backend starts an async job; the page mounts
  `CatalogOptionCascadeModal` (`CatalogOptionCascadeProgressModal`), which
  polls job progress. An unresolved job is re-attached on page load
  (`useUnresolvedCatalogOptionJob`) so a refresh does not lose a
  still-running cascade.
- The catalog is treated as locked for that field until the cascade
  finishes.

Frame-type creation is modal-first (`FrameTypeCreateModal`); after a create
the new row is scroll-focused in the grid (`focusRowId`).
