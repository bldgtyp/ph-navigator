> Split from `context/UI_UX.md` §2 (Pages — narrative). Cross-cutting design
> intent (§0), common elements incl. the DataTable model (§1 / §1.7), flows
> (§3), and the state-indicator cheatsheet (§4) stay in `../../UI_UX.md` —
> read it alongside this page.

# 2.3 Catalog landing pages (`/catalog/{table_slug}`)

**Purpose:** Curate the global catalogs that projects pick from.

**(Detailed in a later story — US-Catalog. Placeholder.)**

The dashboard's "Catalogs ▾" dropdown navigates to one of these pages.
The page renders a single `<DataTable>` (see §1.7 and
`context/technical-requirements/data-table.md`) over the catalog rows,
framed by chrome that's specific to catalogs:

- Page header with the catalog's display name, the active version
  (read-only banner if viewing a historical version), a version
  picker, and a "Save" / "Save as new version" affordance (PRD §7.2).
- Above the table, a small audit-log link surfaces who-changed-what
  inside this catalog (recent N events).
- The `<DataTable>` itself is the same component used in the
  project-scoped Materials sub-tab; the only differences are
  the column declarations and which row-chrome slots are enabled.

Full UX description (page header layout, version picker mechanics,
attachment uploads on Frames, audit log surfacing) deferred to the
Catalog user stories.

