---
DATE: 2026-05-11
STATUS: Split from context/USER_STORIES.md; canonical story body.
SOURCE: context/USER_STORIES.md
---

# PH-Navigator V2 — User Stories: Tables and Equipment

## US-Builder-Tables — Common table-view pattern (cross-cutting)

**Status:** Draft · **Priority:** MVP (foundational — all
table-view tabs depend on this)
**PRD ref:** §6.2 (project document tables), §6.3 (project-
scoped non-catalog tables), §8.3 (JSON-Patch via draft buffer),
§11.3 (per-table display)
**Spike ref:** `poc/catalog-spike` branch — `/catalog-poc/sandbox-
tanstack` — Phase 1 (active cell, keyboard nav, frozen column,
⌘C copy), Multi-Cell Select, Phase 5 (stacked sort/filter/group
toolbar). The spike establishes the implementation primitive
this story formalizes.

### Story
> As an editor, I want every per-project data table (Rooms,
> Thermal Bridges, ERVs, Pumps, Fans, future heat-pumps, etc.)
> to share the same TanStack Table primitive and the same
> sort/filter/group/copy/keyboard ergonomics, so I learn the
> pattern once and apply it everywhere — and so the team adding
> a new table type writes column definitions, not a new editor.

### Why this is its own story

The Equipment tab (US-Builder-Equipment) ships with **five**
sub-tabs whose UX is 80% identical (table primitive, toolbar,
keyboard nav, mutations, locked-version handling); only the
column set, validation rules, and per-row modal contents differ.
Per-tab stories should not re-spell the shared half. This parent
defines the shared half. Per-table stories specialize.

Tables that carry datasheet/photo/spec state must also use the
cross-cutting evidence/status grammar in `context/UI_UX.md` §1.8.
Evidence badges should be filterable, human-readable, and linked to
the row/detail surface that resolves the gap.

### Acceptance criteria (the shared pattern)

1. **Table primitive — TanStack Table v8** (already prototyped
   in `/catalog-poc/sandbox-tanstack`). One reusable
   `<ProjectDataTable>` component lives in
   `frontend/src/components/data-table/`. Each per-table sub-tab
   passes a `columnDef` array, a `tableKey` (e.g.
   `"rooms"`, `"thermal_bridges"`), and a JSON-Patch path
   (`tables.rooms`, `tables.thermal_bridges`).
2. **Stacked sort / filter / group toolbar** (Phase 5 spike;
   commit `b5fa8f8`). The toolbar above the table lets the user
   stack any number of sorts, filters, and groupings — same UX
   on every table tab.
3. **Session-only single view state** (per Q-TBL-1 resolved
   2026-05-10). Sort/filter/group state lives in **in-memory
   Zustand** keyed by `table_key` for the duration of the
   session — switching sub-tabs and returning preserves your
   last-edited toolbar config; reloading the page or signing
   out resets to defaults. **Not persisted** to localStorage,
   to `userPreferencesStore`, or to the backend in V2 v1.
   Single view per table per session — multi-view / named /
   shareable views are a post-parity feature (see
   NEW-TBL-1 below). Reset-to-default action in the toolbar
   overflow.
4. **Active cell + keyboard nav** (Phase 1 spike; commit
   `b2a3c7c`). Active cell highlighted; arrow-key nav across
   cells; first column frozen. Tab/Shift-Tab moves cell-to-cell;
   Enter opens row-detail modal (criterion 8); Escape closes.
5. **Multi-cell select + ⌘C copy** (commit `834881e`). Click +
   shift-click rectangular selections; ⌘C copies as TSV
   (Excel-compatible); ⌘A selects whole table.
6. **`naturalSortCompare` for default sort** — same comparator
   used in US-APT-1 / US-ENV-2 sidebar lists. "Room 2" sorts
   before "Room 10."
7. **Add row** — two-path UX matching US-ENV-7 (segment) and
   US-APT-4 (aperture-element):
   - **Hand-enter row** — opens an inline-edit row with
     `catalog_origin: null` and the table's empty-defaults.
     Always available.
   - **Pick from catalog** — only available when the table
     has a corresponding catalog. **In V2 v1, only Materials,
     Frame Types, and Glazing Types have catalogs** (PRD
     §3 non-goals); the equipment catalogs (ERVs, Pumps, Fans,
     Heat-Pumps, etc.) are deferred to v1.1+. Story copy:
     when the catalog ships, "Pick from catalog" appears next
     to "Hand-enter" without a story rewrite — the
     `catalog_origin` shape is already in the per-row schema.
8. **Edit row — row-detail modal.** Click any row → modal
   opens with all editable fields, validation per-field. Save
   commits one JSON-Patch `replace` on
   `tables.<table_key>[<idx>]`; Cancel discards. Modal reopens
   on the same row across re-renders (URL deep-link to the row
   is post-MVP).
9. **Inline edit on cell double-click** (Phase 1 spike). For
   simple-typed columns (number, short text), double-click
   enters cell-edit mode — Enter commits, Escape cancels.
   Complex fields (enums, references) always go through the
   row-detail modal.
10. **Delete row** — destructive shadcn `Dialog`, simple
    Cancel/Delete confirm. No name retyping (matches
    US-APT-1.2 / US-ENV-2 patterns). Single JSON-Patch
    `remove`. **No** physical purge of orphans this row may
    have referenced (consistent with envelope's "Unused
    materials" treatment, Q-ENV-2).
11. **Drift badges for catalog-linked rows** — when a row's
    `catalog_origin.catalog_version_id !=
    current_catalog_version_id`, render the same drift badge
    + diff dialog as US-APT-4.2 / US-ENV-11. Hidden in V2 v1
    for tables whose catalogs haven't shipped.
12. **Empty-state.** Table-specific copy + primary CTA wired
    to the table's add-row flow. E.g. "No rooms yet. **[+ Add
    room]**". Secondary line if the table is catalog-eligible:
    "Or pick from the catalog when it's available."
13. **Locked-version + Viewer rendering.** Read-only —
    cell editing disabled, add/delete hidden, sort/filter/
    group still functional, ⌘C copy still works (read-only is
    a UX state, not a data state).
14. **Per-table JSON download** — under the table's overflow
    `⋯` menu. Exports a slice of the document body
    (`{ "table_key": [...] }`) for the active version. Same
    semantics as the project-level JSON download, just scoped.
15. **All mutations through the draft buffer** (PRD §8.3) —
    one JSON-Patch per row operation; no chatty multi-PATCH.

16. **User-defined single-select column type** (per
    `research/poc-plans/poc-evaluation.md` §4.3 — Phase 4 of
    the catalog-spike). Tables can declare columns of type
    `single_select` whose options are **defined per-project by
    the user** (not hard-coded enums) and stored alongside
    project data in the document. This is a shared primitive
    used by multiple tables (Rooms `floor_level` /
    `building_zone`, future TBs / ERVs / etc.).

    **Storage shape** in the project document body:
    ```jsonc
    {
      "schema_version": 1,
      "project": { ... },
      "tables": { "rooms": [...], ... },
      "single_select_options": {
        "<table_key>.<column_key>": [
          { "id": "opt_<ULID>", "label": "Basement",
            "color": "#6b7280", "order": 0 },
          { "id": "opt_<ULID>", "label": "Ground",
            "color": "#3b82f6", "order": 1 },
          { "id": "opt_<ULID>", "label": "1st",
            "color": "#10b981", "order": 2 }
        ],
        "rooms.building_zone": [ /* ... */ ]
      }
    }
    ```
    Row cells reference options by stable `option_id`
    (`"floor_level": "opt_01HXYZ..."`), not by label —
    renames are non-destructive.

    **Behavior:**
    - **Pills with palette colors.** Each option renders as a
      pill in its `color`. Phase 4 spike has the palette wired.
    - **Cell popover with search + create.** Click cell → popover
      lists existing options; type to filter; "Create '<x>'"
      shortcut creates a new option using the next palette color
      and appends to the column's option list. Inline-create is
      shipping in the spike (POC §4.3 qualified-yes).
    - **Match-or-create on paste.** Pasting a column of strings
      runs through the spike's `single-select match-or-create`
      pipeline — case-aware match against existing labels;
      unmatched strings auto-create new options (consolidated
      toast lists everything created); single ⌘Z reverts the
      cell writes AND the option creations as one op (spike
      L6.5).
    - **Paste coercion errors are preflighted.** Field coercion
      returns a structured success/error result. If any pasted
      cell fails validation, no draft write occurs; PHN shows a
      paste review dialog with row, column, raw value, and error
      for the first 25 failures plus an overflow count.
    - **Sort follows option order, not alphabetical.** When the
      user sorts by a single-select column, rows order by
      `option.order`, not by `label`. Reordering options
      reorders the table (AirTable parity — POC §4.3 L2.4).
    - **Nullable** — cells may be empty (`null`); sort treats
      null as last (configurable per-column if needed v1.1+).
    - **Duplicate labels blocked.** Option labels must be unique
      within one `<table_key>.<column_key>` after trim +
      case-insensitive comparison. Paste match-or-create matches
      an existing option instead of creating a duplicate.
    - **Rename / reorder are non-destructive.** Rows store
      `option_id`, so renaming a label or reordering options
      does not rewrite row data.
    - **Delete is explicit.** Unreferenced options delete
      immediately. Referenced nullable options require a
      confirmation and then clear affected cells to `null`.
      Referenced required options are blocked until affected rows
      are reassigned or merged into another option.
    - **Merge supported.** "Merge into…" rewrites all source
      option references to the target `option_id` and removes the
      source option records as one semantic write op.
    - **Missing option fallback.** If imported/corrupt data
      references an `option_id` not present in the option list,
      the cell renders a warning pill and Save is blocked until
      the value is cleared or reassigned.

17. **Single-select header modal** — option management
    (drag-reorder + recolor + rename + delete). This was
    deferred from the catalog-spike Phase 4 (POC §4.3
    qualifications), but is **required for V2 v1** because Rooms
    needs explicit user control over option order (drives sort).

    **Trigger:** click the column header's `⋯` menu →
    **"Edit options…"**.

    **Modal contents:**
    - Vertical list of options, each row: drag handle, color
      swatch (clickable → palette picker), label text-input,
      delete `×` button. shadcn `Dialog` + `react-aria-components
      DropZone` (or equivalent) for drag-reorder.
    - Drag-reorder updates `order` integers; sort follows.
    - Recolor swatch click opens a palette popover; selection
      writes `color`.
    - Rename in-place; commits on blur or Enter; affects
      every row referencing this option (no row mutation —
      cell-render pulls the latest label).
    - **Delete with row-impact warning.** When the option is
      referenced by ≥1 row, the delete `×` opens a sub-dialog:
      *"3 rows reference 'Basement'. Choose what to do:"*
      → **(a)** Clear those cells (set `null`), then delete.
      → **(b)** Replace with a different option (dropdown of
      remaining options).
      → **(c)** Cancel.
    - **Add option** at the bottom — same UX as inline-create
      from the cell popover; gets the next palette color.
    - **Save / Cancel** at the bottom of the modal.

    All mutations route through the draft buffer as
    JSON-Patches against
    `body.single_select_options["<table>.<column>"]`.

### Cross-cutting hooks for LLM-friendliness

The MCP server (PRD §10.3) exposes per-table read/write tool
calls keyed by `table_key`: `read_table`, `add_row`,
`update_row`, `delete_row`. The `<ProjectDataTable>` component
should not know about MCP; the *backend* exposes uniform
endpoints that the MCP server wraps. From day 1, every table
type added gets MCP support for free.

### Resolved questions (2026-05-10)
- **Q-TBL-1: Per-user persisted view state?** Resolved: **no
  persistence in V2 v1.** Single view state per table per
  session, kept in-memory only — last edits survive sub-tab
  navigation, reset on reload. The richer "saved / named /
  shareable views" model (analogous to AirTable Interfaces)
  is a deliberate post-parity feature, captured as
  **NEW-TBL-1** below. Rationale: avoid building two view-state
  systems (a session one and a persistence one) when the
  end-state is shareable views, which is a much bigger UX
  surface than just localStorage caching.
- **Q-TBL-2: Per-row deep-link URLs.** Resolved: defer to
  v1.1+. URL format when added would be
  `/projects/{id}/equipment/rooms/{row_id}` mirroring Q-ENV-9
  / Q-APT-5.
- **Q-TBL-3: Bulk row operations** (delete N rows, set field
  on N rows). Resolved: defer to v1.1+. Multi-select + ⌘C
  copy ships in V2 v1; multi-edit / bulk-delete doesn't.

### Open questions
None outstanding.

### Related new feature (post-parity)

**NEW-TBL-1 — Shareable stable views (AirTable-Interface
analog).** Status: stub · post-parity · Source: Ed feedback
2026-05-10 (Q-TBL-1 resolution thread).

> As a CPHC, I want to save a named view of any project data
> table (a particular sort + filter + group + column-visibility
> config) and share that view via a stable URL with my project
> team — contractors, clients, certifiers — so they always land
> on the same curated slice without me having to re-explain the
> filter every time.

**Why this matters.** AirTable's "Interface" feature (and to a
lesser extent its saved Views) is a workflow Ed and BLDGTYP
teams already rely on — the value isn't just personal-
preference persistence, it's *team-coordination*: "open this
URL to see only the rooms with iCFA ≥ 0.5, sorted by floor
level, grouped by building zone — that's what we're reviewing
in tomorrow's design call."

**Open design questions (queued, not blocking V2 v1):**

- View ownership — per-project (visible to all editors) or
  per-user (private until shared)?
- View identity — short-id slug in URL
  (`/projects/{id}/equipment/rooms?view=q4-design-review`) or
  opaque ULID?
- View fields — sort + filter + group + column-visibility +
  active-cell? Or also "frozen rows / cells" for presentation?
- Editable on a shared URL, or strictly read-only?
- Apply across multiple tables, or per-table only?
- Versioned with the project document, or independent of
  versions (so a view URL keeps working as the project
  evolves)?

**Cross-references.** Couples with NEW-LLM-API-1 (asset / API
endpoints) — agentic workflows ("create a view that shows…")
ride on this. The view persistence layer should expose CRUD
endpoints from day 1 so the MCP server can manage views.

---

## US-Builder-Equipment — Equipment tab (US-3.5)

**Status:** Draft · **Priority:** MVP (promotes the placeholder
in US-3.5 to a walked story; sub-stories US-EQ-1..6 detail the
sub-tabs)
**PRD ref:** §6.2 (`tables.rooms`, `tables.equipment`), §6.3
(non-catalog tables), §11.1 (project tabs)
**V1 ref:** V1 has equipment surfaces under the AirTable
backend; V2 brings them into the project document and into the
unified table-view UX (US-Builder-Tables)

### Story
> As an editor, I want a single "Equipment" tab that gathers
> all per-project occupancy and MEP data — Rooms, Thermal
> Bridges, ERVs, Pumps, Fans — under one roof, so I have one
> destination for "everything that's not envelope and not
> windows." Sub-tabs let me focus on one table at a time
> without losing the parent context.

### Why one tab, not five

Per Q-LAND-1's resolved tab bar (Status / Windows / Envelope /
**Equipment** / Model), Equipment is one of five top-level tabs.
Splitting Rooms, Thermal Bridges, and the equipment tables into
five top-level tabs would push the bar to 9 tabs and bury
related data behind extra clicks. The sub-tab convention used
by Envelope (Assemblies / Specifications / Airtightness / Site
Photos) carries over here cleanly. **Decision (a) per Ed,
2026-05-10.**

### Sub-tabs (in display order)

| Order | Sub-tab | Story | V2 v1 status | Catalog-linked? |
|---|---|---|---|---|
| 1 | Rooms | US-EQ-2 | **Full draft** — source-of-truth for downstream HBJSON | No (rooms unlikely to ever have a catalog) |
| 2 | Thermal Bridges | US-EQ-3 | Editable DataTable with core TB fields, seeded type options, and inline PDF Report attachment | Yes |
| 3 | ERVs | US-EQ-4 | **Full draft** — ventilation-critical for PH | Catalog deferred to v1.1+ |
| 4 | Heat Pumps | US-EQ-7..11 | **Full draft (2026-06-09)** — four nested leaf pages (Equipment/Units × Outdoor/Indoor); Phius Multiple HP Estimator export target | "Project Catalog" pattern (project-scoped types + instances); shared catalog deferred to v1.1+ |
| 5 | Pumps | US-EQ-5 | **Placeholder** — scaffolding + empty-state copy only; full schema deferred to v1.1+ | Catalog deferred to v1.1+ |
| 6 | Fans | US-EQ-6 | **Full draft** — ventilation-critical for PH | Catalog deferred to v1.1+ |

Default sub-tab on first visit: **Rooms** (it's the
source-of-truth that downstream tools — Rhino, the energy model
— consume; users are most likely to land here first when
populating a new project).

### Architectural decisions

- **All five sub-tabs share the US-Builder-Tables primitive.**
  Per-sub-tab stories cover only the column set, per-field
  validation, row-detail-modal contents, and any unique
  affordances. The shared half (toolbar, keyboard nav,
  mutations, locked-version, drift badges, JSON download) is
  inherited.
- **All five tables are hand-entered in V2 v1.** PRD §3
  non-goals: equipment catalogs (ERVs, Pumps, Fans, Heat-Pumps,
  etc.) ship in v1.1+. Each row's schema includes
  `catalog_origin: null | <object>` from day 1 so adding the
  catalog-pick path later is additive — no schema migration.
- **Rooms is special: PHN-first source-of-truth.** Per Ed's
  framing (2026-05-10), Rooms data is **defined in PHN first**,
  then **consumed by Rhino** to generate HBJSON. HBJSON is
  downstream of the rooms table, not upstream. There is **no
  "sync from HBJSON"** action — that would invert the data
  flow. A future "Compare HBJSON vs Rooms" QA/QC feature is
  captured as a post-parity new feature (NEW-ROOMS-1 below).

### Sub-stories

#### US-EQ-1 — Equipment tab structure (sub-tab nav)

**Status:** Draft · **Priority:** MVP
**Mirrors:** US-ENV-1 (envelope sub-tab structure)

**Acceptance criteria:**

1. **Sub-tab bar** below the Equipment tab heading. Five
   sub-tabs in the order above. shadcn `Tabs` primitive.
2. **URL deep-link** per Q-LAND-1 / Q-ENV-9 pattern:
   - `/projects/{id}/equipment` → redirect to
     `/projects/{id}/equipment/rooms` (default sub-tab)
   - `/projects/{id}/equipment/rooms`
   - `/projects/{id}/equipment/thermal-bridges`
   - `/projects/{id}/equipment/ervs`
   - `/projects/{id}/equipment/heat-pumps` (nested; redirects to
     `…/heat-pumps/equipment-outdoor` — see US-EQ-7)
   - `/projects/{id}/equipment/pumps`
   - `/projects/{id}/equipment/fans`
   - Browser back / forward navigates sub-tab history.
3. **Sub-tab content area** renders the matching
   `<ProjectDataTable>` (US-Builder-Tables) with that table's
   column definition and validation rules.
4. **Persistent toolbar above the data table** — sort / filter
   / group / reset (per US-Builder-Tables criterion 2). Distinct
   from the page-level / project-level header above.
5. **Locked-version + Viewer rendering.** Sub-tab nav still
   functional; tables rendered read-only (US-Builder-Tables
   criterion 13).

### Resolved questions (2026-05-10)
- **Q-EQ-1: Sub-tab order.** Resolved: **Rooms / Thermal
  Bridges / ERVs / Pumps / Fans** (as listed). Rooms first
  matches "user populates this first."
- **Q-EQ-2: Default sub-tab on first visit to the Equipment
  tab.** Resolved: **Rooms** (source-of-truth, most-edited).
  `/projects/{id}/equipment` redirects to
  `/projects/{id}/equipment/rooms`.

### Open questions
None outstanding.

### Related new feature (post-parity)

**NEW-ROOMS-1 — "Compare HBJSON vs Rooms" QA/QC feature.**
Status: stub · post-parity. As a CPHC, after uploading a Rhino-
generated HBJSON to the Model tab (US-Viewer), I want a QA
action that compares the HBJSON's room metadata against the
Rooms table and flags drift (room renamed in Rhino without
updating PHN; iCFA factor changed in only one place; new room
appears in HBJSON but not in PHN; etc.). Surfaces in the Model
tab and on the Rooms sub-tab. Important quality gate for late-
stage QA but not blocking V2 v1.

---

## US-EQ-2 — Rooms sub-tab

**Status:** Draft · **Priority:** MVP
**PRD ref:** §6.2 (`tables.rooms[]` — needs amendment per
Q-EQ-2.x resolutions below)
**V1 ref:** V1 captured rooms in AirTable; V2 brings them into
the project document.
**Inherits:** US-Builder-Tables (toolbar, keyboard nav,
mutations, locked-version, JSON download).

### Story
> As an editor, I want a Rooms table that captures the per-room
> metadata our Rhino → HBJSON pipeline depends on — name,
> number, floor level, building zone, occupant count, bedroom
> count, iCFA factor, ERV-unit assignment — so the energy model
> and certification submittals derive consistently from a single
> source-of-truth in PHN.

### Data shape (per Ed's spec, 2026-05-10; Q-EQ-2.x resolved)

```jsonc
{
  "id": "rm_<ULID>",
  "name": "LIVING ROOM",              // may be blank
  "number": "101",                    // may be blank
  "floor_level": "opt_01HXYZ...",     // single-select option_id; nullable; ref to body.single_select_options["rooms.floor_level"][*].id
  "building_zone": "opt_01HABC...",   // single-select option_id; ref to body.single_select_options["rooms.building_zone"][*].id; nullable
  "num_people": 2,
  "num_bedrooms": 0,
  "icfa_factor": 1.0,                 // clamped [0.0, 1.0]
  "erv_unit_ids": ["erv_<ULID>"],     // array of refs to tables.equipment.ervs[*].id; empty array = no ERV; multiple ERVs allowed
  "catalog_origin": null,             // forward-compatible (rooms have no catalog and likely never will)
  "notes": null
}
```

**Companion `single_select_options` entries** (project document):
```jsonc
{
  "single_select_options": {
    "rooms.floor_level": [
      { "id": "opt_...", "label": "Basement", "color": "#6b7280", "order": 0 },
      { "id": "opt_...", "label": "Ground",   "color": "#3b82f6", "order": 1 },
      { "id": "opt_...", "label": "1st",      "color": "#10b981", "order": 2 }
      /* user-defined per-project; reordering options reorders the table */
    ],
    "rooms.building_zone": [
      /* user-defined per-project; nullable on the row;
         no predictable structure imposed */
    ]
  }
}
```

### Acceptance criteria

1. **Inherits US-Builder-Tables criteria 1–15** (table
   primitive, toolbar, keyboard nav, multi-cell copy, default
   sort, add/edit/delete, draft-buffer mutations, locked-
   version handling, JSON download).
2. **Column set** (default visible, default sort by `number`
   ascending via `naturalSortCompare`):
   | Column | Type | Validation | Notes |
   |---|---|---|---|
   | `number` | string | nullable/blank allowed; unique-within-project only for non-blank values (case-insensitive trim) | sort key |
   | `name` | string | nullable/blank allowed | |
   | `floor_level` | **single_select** (US-Builder-Tables criteria 16–17) | nullable; when present, option_id ref into `single_select_options["rooms.floor_level"]` | sort follows option order, not label; blank rooms remain valid |
   | `building_zone` | **single_select** (US-Builder-Tables criteria 16–17) | option_id ref into `single_select_options["rooms.building_zone"]`; **nullable** | user-defined options; no enum imposed |
   | `num_people` | int | `>= 0` | |
   | `num_bedrooms` | int | `>= 0` | |
   | `icfa_factor` | float | `0.0 <= x <= 1.0`, default `1.0` | |
   | `erv_unit_ids` | **array of refs** | each id must reference an existing `tables.equipment.ervs[*].id`; empty array allowed | multi-select dropdown listing this project's ERV units by `name`; **a room may be served by 0, 1, or multiple ERVs** (per Q-EQ-2.4 resolution); updates live as ERVs are added |
3. **Add row.** Hand-enter only (no catalog). Empty-defaults:
   `number`, `name` blank; `floor_level: null`;
   `building_zone: null`; counts `0`;
   `icfa_factor: 1.0`; `erv_unit_ids: []`.
4. **Row-detail modal** opens on row click. Title:
   `"Room: {number} — {name}"` (or `"New room"` for unsaved
   row). All 8 columns editable; `notes` (multi-line)
   available under a "Notes" expander.
5. **`number` uniqueness** enforced like
   US-APT-1's name-uniqueness — trim + case-insensitive
   comparison; add/duplicate auto-suffix `(2)`, `(3)`; rename
   rejects collisions with toast.
6. **`erv_unit_id` referential integrity.** When the
   referenced ERV is deleted (US-EQ-4), affected rooms have
   their `erv_unit_id` set to `null` and a soft-warning toast
   surfaces: *"3 rooms had their ERV assignment cleared because
   'ERV-A' was deleted."* No cross-table cascade-delete.
7. **HBJSON downstream — no auto-sync.** Rooms data is
   PHN-first; the Rhino model consumes it to generate HBJSON.
   The Rooms sub-tab has **no "Sync from HBJSON"** action —
   that would invert the data flow. The `HBJSON` upload action
   (US-ENV-12 / US-Viewer) does **not** mutate `tables.rooms`.
8. **Empty state.** "No rooms yet. **[+ Add room]**." Single
   primary CTA. (No catalog-pick alternative — this table has
   no catalog and is unlikely to ever have one.)
9. **Per-table JSON download** under `⋯` menu yields
   `{ "rooms": [...] }` for the active version.
10. **Locked-version + Viewer rendering** per
    US-Builder-Tables criterion 13.

### Resolved questions (2026-05-10)

- **Q-EQ-2.1: `floor_level` data type.** Resolved:
  **user-defined single-select column, per-project**, leveraging
  the catalog-spike single-select primitive (US-Builder-Tables
  criteria 16–17; POC §4.3). Each project's CPHC defines an
  ordered option list (e.g. `[Basement, Ground, 1st, 2nd, Roof]`);
  rooms reference options by stable `option_id`. **Sort follows
  the option order, not alphabetical** — reordering options in
  the header modal reorders the table data (AirTable parity).
  This handles both numeric ("1st", "2nd") and non-numeric
  ("Basement", "Roof", "Mezzanine", "B-2") values without an
  imposed schema.

- **Q-EQ-2.2: `building_zone` data type.** Resolved: same as
  Q-EQ-2.1 — **user-defined single-select per-project,
  nullable.** No enum is imposed; the user types whatever zone
  labels their project needs ("residential", "common-space",
  "rooftop garden", whatever). Empty cells (`null`) are
  permitted — not all rooms need a zone.

- **Q-EQ-2.3: `icfa_factor` constraints.** Resolved:
  **clamp `[0.0, 1.0]`, default `1.0`.** Mechanical rooms
  typically 0; primary living spaces 1.0; circulation sometimes
  fractional. Validation enforces clamp on save.

- **Q-EQ-2.4: ERV-unit assignment cardinality.** Resolved:
  **N:M (a room may be served by 0, 1, or multiple ERVs).**
  Stored as `erv_unit_ids: string[]`, each id referencing a
  `tables.equipment.ervs[*].id`. In real projects, a single
  room can legitimately be served by more than one ERV unit
  (e.g. a large multi-zone apartment with separate supply
  trains, or a room straddling two ventilation zones in a
  retrofit). The empty array is the default and represents "no
  ERV" (passive ventilation, or ventilation handled by a Fan
  row instead).

- **Q-EQ-2.5: HBJSON-vs-Rooms compare feature scope.**
  Resolved: **defer until after V2 v1 MVP ships.** Captured as
  **NEW-ROOMS-1 (post-parity)** in US-Builder-Equipment. The
  QA-rule set (which fields matter most for drift, drift
  severity thresholds, presentation) needs at least one real
  project's worth of usage data before we can spec it well —
  building it speculatively is wasted work.

### Open questions
None outstanding.

### Cross-references

- ERV-unit dropdown source: `tables.equipment.ervs[]` →
  US-EQ-4.
- iCFA-factor consumed by:
  - **US-ENV-14 (Airtightness)** — the iCFA used for Phius
    CORE cfm50/sf is the HBJSON's
    `interior_conditioned_floor_area`, which is computed from
    Rhino geometry × per-room iCFA factors. Rooms-table data
    feeds *into* the HBJSON, not the other way around.
- Future: energy-model service will read this whole table.

---

## US-EQ-3 — Thermal Bridges sub-tab

**Status:** Implemented · **Priority:** MVP editable table
**PRD ref:** §6.2 (`tables.thermal_bridges` FieldDef envelope)

The Thermal Bridges page is an editable shared DataTable backed by
`tables.thermal_bridges`. It tracks the current certification-friendly
schedule fields and stores the simulation/report PDF inline on the main
row. The previous split attachment surface for "Simulation Files" is
retired; report PDFs live in `pdf_report_asset_ids[]`.

Core fields:

1. `record_id` / Tag — primary schedule identifier.
2. `name`.
3. `sheet_name`.
4. `drawing_number`.
5. `psi_value_w_mk` — stored SI as W/(m-K), displayed through the
   shared W/(m-K) ↔ Btu/(h-ft-F) number-units path.
6. `frsi_value` — numeric, valid range `[0.0, 1.0]`.
7. `thermal_bridge_type` — single-select with seeded options:
   `15-Ambient`, `16-Perimeter`, `17-Below-Grade`.
8. `pdf_report_asset_ids[]` — PDF-only attachment cell.
9. `notes`.

Acceptance criteria:

1. Editor users can add, edit, duplicate, delete, reorder/view-configure,
   and save/reload thermal bridge rows through the shared DataTable.
2. Viewer and locked-version states render read-only.
3. Tag/name/sheet/drawing/psi/fRSI/type/report/notes all round-trip
   through draft save and version read APIs.
4. Clearing nullable cells persists `null` per the shared DataTable
   contract.
5. `fRSI Value` rejects values outside `[0.0, 1.0]`; `Psi-Value`
   rejects negative values.
6. Reset seed data creates five thermal bridge rows for UI testing.
7. PDF Report accepts PDFs only; Flixo/Dartwin/HBJSON/native simulation
   files are intentionally not modeled as a second table in this phase.

### Scope notes

- Linear thermal bridges only. Point thermal bridges (`count × χ-value`)
  remain a future additive shape.
- No assembly reference in this phase; `sheet_name` and
  `drawing_number` are the current drawing-coordinate fields.
- `thermal_bridge_type` is intentionally seeded with the WUFI-style
  numbered labels Ed specified.

### Open questions
None outstanding for the current editable table.

---

## US-EQ-4 — ERVs sub-tab

**Status:** Draft · **Priority:** MVP
**PRD ref:** §6.2 (`tables.equipment.ervs[]`), §6.3 (non-catalog
in v1; catalog deferred to v1.1+ per PRD §3 / §7.0)
**V1 ref:** V1 captured ERV units in AirTable per project; V2
moves them into the project document.
**Inherits:** US-Builder-Tables (criteria 1–17 including
single-select column type).

### Story
> As an editor, I want an ERVs table that captures each
> physical ERV / HRV unit installed on the project — name,
> manufacturer, model, type (ERV vs HRV), nominal performance
> (airflow, sensible recovery efficiency, electrical power),
> and a project-level datasheet — so Rooms (US-EQ-2) can
> reference these units and the energy model has the per-unit
> performance data it needs.

### Data shape

```jsonc
{
  "id": "erv_<ULID>",
  "name": "ERV-A",
  "manufacturer": "opt_<ULID>",               // single-select option_id; user-defined; no seeded defaults
  "model_number": "ComfoAir Q450",
  "unit_type": "opt_<ULID>",                  // single-select option_id; user-defined; no seeded defaults (ERV+HRV combined per Q-EQ-4.2; user types their own labels)
  "nominal_airflow_cfm": 250.0,
  "sensible_recovery_efficiency": 0.85,       // 0.0–1.0
  "electrical_power_w": 110.0,                // fan power at nominal CFM
  "datasheet_asset_ids": ["asset_..."],
  "notes": null,
  "catalog_origin": null                      // forward-compat; ERV catalog ships in v1.1+
}
```

### Acceptance criteria

1. **Inherits US-Builder-Tables criteria 1–17.**
2. **Column set** (default visible, default sort by `name`
   ascending):
   | Column | Type | Validation | Notes |
   |---|---|---|---|
   | `name` | string | required, unique-within-project | sort key |
   | `manufacturer` | single_select | nullable | user-defined per-project; **no seeded defaults** |
   | `model_number` | string | optional | |
   | `unit_type` | single_select | nullable | user-defined per-project; **no seeded defaults** — user types their own labels (e.g. "ERV", "HRV", "DOAS"); ERV + HRV share this single table per Q-EQ-4.2 resolved |
   | `nominal_airflow_cfm` | float | `> 0` | display in active unit (CFM / L/s) |
   | `sensible_recovery_efficiency` | float | `0.0 ≤ x ≤ 1.0` | percentage display in UI |
   | `electrical_power_w` | float | `≥ 0` | |
3. **Add row** — **two paths in V2 v1**:
   - **Hand-enter** — `catalog_origin: null`. Always available.
   - **Pick from catalog** — wired into the picker primitive
     **but the catalog itself is deferred** (PRD §3 non-goal).
     The "Pick from catalog" button is **hidden in V2 v1** and
     becomes visible automatically when the ERV catalog ships
     (v1.1+). The `catalog_origin` shape on each row supports
     this from day 1 — no migration needed.
4. **Row-detail modal.** Title: `"ERV: {name}"`. Datasheet
   uploader section per QA principle (project-only datasheets,
   never catalog-side; auto-memory
   `qa_principle_per_project_datasheets`).
5. **`name` uniqueness.** Trim + case-insensitive comparison;
   add/duplicate auto-suffix `(2)`, `(3)`; rename rejects
   collisions. Mirrors US-EQ-2 `number` uniqueness.
6. **Empty state.** "No ERV / HRV units yet. **[+ Add unit]**."
   When the catalog ships, secondary line "Or pick from the
   ERV catalog" appears.
7. **Per-table JSON download** under `⋯` menu.
8. **Locked-version + Viewer rendering** per
    US-Builder-Tables criterion 13.

### Deferred to v1.1+ (deliberately out of v1 scope)
- `latent_recovery_efficiency` (LRE) — relevant for full ERVs
  in cooling-dominated climates.
- `serves_zone` — single-select for which zone/floor; reverse-
  derivable from rooms.erv_unit_ids.
- `installation_location` (string) and `ducting_distance_m`
  (float) — needed for distribution-loss calc.
- `commissioning_test_date`, `commissioning_certified_cfm` —
  for QA after install. Likely lands as part of a
  Commissioning sub-tab in v2 along with airtightness
  (US-ENV-14) and other test data.

### Resolved questions (2026-05-10)
- **Q-EQ-4.1: Default seeded options for `unit_type` and
  `manufacturer`?** Resolved: **no seeded defaults for either.**
  User defines all option labels per-project. Aligns with the
  broader 2026-05-10 directive that V2 v1 ships zero seeded
  single-select defaults — the user controls vocabulary.
- **Q-EQ-4.2: Treat ERV and HRV as one table or split?**
  Resolved: **one combined table for all ERV and HRV units.**
  Data shape is identical; the `unit_type` single-select holds
  whatever labels the user defines (typically "ERV" and "HRV",
  but they can use any labels). PRD §7.0 also groups them as
  "ERV units."

### Open questions
None outstanding.

### Cross-references
- `tables.rooms[*].erv_unit_ids` references `id` of rows in
  this table (US-EQ-2 criterion 6 referential integrity).
- Catalog integration: deferred to v1.1+; story copy on the
  catalog manager side will surface "ERV catalog (v1.1+)" as
  a roadmap item per PRD §7.0.

---

## US-EQ-5 — Pumps sub-tab

**Status:** Placeholder · **Priority:** MVP scaffolding only —
**full data shape and row-detail modal deferred to v1.1+** (per
Q-EQ-5.1 resolution 2026-05-10)
**PRD ref:** §6.2 (`tables.equipment.pumps` — empty-list
placeholder in V2 v1)

### Scope in V2 v1 (placeholder)

The Pumps sub-tab exists in V2 v1 **as scaffolding only** so the
Equipment tab structure (US-EQ-1) is complete and the URL deep-
link `/projects/{id}/equipment/pumps` resolves. **No editable
schema ships in v1.**

Concretely:

1. Sub-tab nav routes correctly (US-EQ-1 criterion 2).
2. The `<ProjectDataTable>` primitive renders, but the
   underlying `tables.equipment.pumps` array is empty and
   there are **no editable columns** in v1.
3. Empty-state copy:
   *"Pumps — coming in v1.1+. Continue tracking pump
   electrical loads in your existing energy-model spreadsheet
   for now."* No `[+ Add]` CTA.
4. Add / edit / delete are all hidden in v1.
5. Locked-version + Viewer rendering as inherited.

### Why placeholder, not full draft

Per Ed (2026-05-10): pumps are a less-universal data set than
ERVs / Fans (some PH projects don't even have circulation
pumps), and the energy-model integration is non-trivial enough
that demoting to placeholder is the right v1 cut. Full draft
preserved below for v1.1+ planning.

### Deferred to v1.1+ (full draft preserved below)

> **v1.1+ data shape (deferred):**
> ```jsonc
> {
>   "id": "pmp_<ULID>",
>   "name": "DHW Recirc",
>   "manufacturer": "opt_<ULID>",            // user-defined single-select; no seeded defaults
>   "model_number": "Grundfos UP15-10",
>   "pump_type": "opt_<ULID>",               // user-defined single-select; no seeded defaults (Q-EQ-5.1 resolution dropped the seeded-defaults pattern)
>   "electrical_power_w": 25.0,
>   "runtime_hours_per_year": 8760,
>   "datasheet_asset_ids": [],
>   "notes": null,
>   "catalog_origin": null
> }
> ```
>
> **v1.1+ acceptance criteria (deferred):**
> - Inherits US-Builder-Tables criteria 1–17.
> - Column set: name / manufacturer / model_number /
>   pump_type / electrical_power_w / runtime_hours_per_year.
> - Two-path add (hand-enter; catalog-pick when Pump catalog
>   ships per PRD §7.0).
> - Datasheet QA principle (auto-memory).
> - `name` uniqueness within project.
> - Flow-rate / head-pressure deferred again to a later v1.x
>   when hydraulic-design verification surfaces a real need.

### Resolved questions (2026-05-10)
- **Q-EQ-5.1: Flow-rate / head-pressure fields for v1?**
  Resolved: **defer for MVP — placeholder tab and table are
  enough.** The whole sub-tab is placeholder in V2 v1. Even
  in the v1.1+ full draft, flow / head stay deferred (energy
  model only uses `power × runtime`).

---

## US-EQ-6 — Fans sub-tab

**Status:** Draft · **Priority:** MVP
**PRD ref:** §6.2 (`tables.equipment.fans[]`), §6.3, §7.0
(future Fan catalog with `sub_category` column for
extract-trash / kitchen / laundry / other)
**Inherits:** US-Builder-Tables (criteria 1–17).

### Story
> As an editor, I want a Fans table that captures each
> non-ventilation-system fan on the project — kitchen extract,
> bathroom extract, dryer, range hood, etc. — so the energy
> model has per-fan power consumption and runtime, and the
> ventilation calculation knows about exhaust paths that
> don't go through an ERV.

### Data shape

```jsonc
{
  "id": "fan_<ULID>",
  "name": "Kitchen Extract",
  "manufacturer": "opt_<ULID>",
  "model_number": "Panasonic FV-08VKM3",
  "fan_purpose": "opt_<ULID>",                // single-select; defaults seeded per PRD §7.0 sub_categories: Kitchen Extract / Bath Extract / Dryer / Laundry / Range Hood / Other
  "airflow_cfm": 80.0,
  "electrical_power_w": 18.0,
  "runtime_hours_per_day": 0.5,               // average — user estimates per their occupancy profile
  "datasheet_asset_ids": [],
  "notes": null,
  "catalog_origin": null                      // Fan catalog v1.1+
}
```

### Acceptance criteria

1. **Inherits US-Builder-Tables criteria 1–17.**
2. **Column set** (default sort by `name`):
   | Column | Type | Validation | Notes |
   |---|---|---|---|
   | `name` | string | required, unique-within-project | |
   | `manufacturer` | single_select | nullable | user-defined; **no seeded defaults** |
   | `model_number` | string | optional | |
   | `fan_purpose` | single_select | nullable | user-defined; **no seeded defaults** — user types their own labels (Kitchen Extract, Bath Extract, etc.). v1.1+ Fan catalog (PRD §7.0) will introduce a `sub_category` whose options ARE catalog-managed; user-defined options here are independent of that |
   | `airflow_cfm` | float | `> 0` | display in active unit (CFM / L/s) |
   | `electrical_power_w` | float | `≥ 0` | |
   | `runtime_hours_per_day` | float | `0 ≤ x ≤ 24` | average daily runtime estimate |
3. **Add row** — two-path; catalog button hidden in v1.
4. **Row-detail modal.** Title: `"Fan: {name}"`. Datasheet
   uploader.
5. **`name` uniqueness** as US-EQ-4 / 5.
6. **Empty state.** "No fans yet. **[+ Add fan]**."
7. **Per-table JSON download** + locked-version rendering as
   inherited.

### Resolved questions (2026-05-10)
- **Q-EQ-6.1: Default seeded `fan_purpose` options?** Resolved:
  **no seeded defaults for MVP.** User defines all option
  labels per-project. Aligns with the broader 2026-05-10
  directive that V2 v1 ships zero seeded single-select
  defaults. When the v1.1+ Fan catalog (PRD §7.0) ships, its
  catalog `sub_category` column is independent of the
  user-defined `fan_purpose` here.
- **Q-EQ-6.2: Vent-path attribution to a Room (`serves_room_id`).**
  Resolved: **defer to v1.1+.** Most projects have 1–2 extract
  fans; explicit room linkage is overhead in v1. Add when a
  multifamily project surfaces a real need.

### Open questions
None outstanding.

### Cross-references
- Same datasheet QA principle as US-EQ-4.
- Catalog integration deferred to v1.1+; story will land
  alongside the Fan catalog roster (PRD §7.0).
- Coordinates with ERVs (US-EQ-4) — between them, Rooms'
  ventilation paths are fully covered.

---

## US-EQ-4 — ERVs sub-tab — *Amendment 2026-06-09: Linked-from-HP-indoor surfaces*

**Status:** Phase 4 partially implemented (2026-06-09). Count
column (AC-AMEND-1/2) ships; modal-badge deep-link
(AC-AMEND-3) descoped — Ventilators uses inline DataTable editing,
no row-detail modal exists to host the badge. Tracked as
**Q-HP-FOLLOWUP-7** (post-v1): revisit when / if Ventilators
grows a row-detail modal. · **Priority:** MVP (Phase 4 of the
Heat Pumps rollout — see `planning/archive/heat-pumps/PRD.md` §5.4)
**Driver:** Heat Pumps feature requires the ERV sub-tab to expose
the reverse side of the HP-indoor ↔ ERV link captured by
`heat_pump_indoor_units[*].linked_erv_unit_id`.

### What changes on US-EQ-4

1. **No schema change to `tables.equipment.ervs[*]`.** The link is
   stored one-way on the HP indoor unit; ERV rows learn about it
   via server-side reverse lookup.
2. **New column on the ERVs DataTable:** `Linked HP indoor` —
   default-hidden. Renders the count of HP indoor units linking to
   this ERV row (`0` means standalone ERV; `1+` means integrated).
   Filterable + sortable like any column.
3. **New badge on the ERV row-detail modal header:** when ≥1 HP
   indoor unit links to this ERV, render `"Linked from HP indoor:
   {tag}"` for each linked tag (comma-separated if multiple).
   Each tag is a deep-link that navigates the user to the
   matching row in `…/equipment/heat-pumps/units-indoor`.
4. **Delete behavior:** Phase 4 ships a **silent backend cascade**
   on the ERV side — when a ventilator row is removed via the
   slice-replace endpoint, `apply_ventilators_replace` nulls
   `linked_erv_unit_id` on every HP indoor unit that referenced
   it before re-validating the document. No pre-delete dialog or
   post-delete toast (scope amendment 2026-06-09 — see
   `planning/archive/heat-pumps/phases/phase-04-erv-and-rooms-cross-link.md`
   "Scope amendment"). The historical "US-EQ-2 cascade still nulls
   `rooms[*].erv_unit_ids`" claim is obsolete — no `erv_unit_ids`
   field exists on rooms in the V2 codebase.

### Acceptance criteria (additive to existing US-EQ-4)

- ✅ AC-AMEND-1 (Phase 4 implemented 2026-06-09): `Linked HP
  indoor` column appears in the column-visibility overflow menu;
  default-hidden; togglable on.
- ✅ AC-AMEND-2 (Phase 4 implemented 2026-06-09): When toggled
  on, the column renders an integer count per row; sorts
  numerically; filters work. While the HP slice is still
  fetching, the cell renders `—` to distinguish "loading" from
  "no link".
- ◻ AC-AMEND-3 (descoped 2026-06-09 — Q-HP-FOLLOWUP-7): badge
  with deep-link on the ERV row-detail modal. No ERV row-detail
  modal exists today; revisit when one is added.
- ✏️ AC-AMEND-4 (Phase 4 implemented 2026-06-09, behavior
  amended): Deleting an ERV that has ≥1 linking HP indoor unit
  succeeds; the linked HP indoor rows have `linked_erv_unit_id`
  cleared via silent backend cascade. **No toast** (scope
  amendment — silent matches D-HP-19 spirit without dragging in
  a row-detail modal or an inline-delete intercept path).
- ✏️ AC-AMEND-5 (partial): Viewer renders the column unchanged.
  Badge surfaces (AC-AMEND-3) are descoped, so the deep-link
  navigation case is moot until a modal exists.

### Cross-references
- HP indoor side: US-EQ-11 (HP Units — Indoor) criterion 6.
- Storage shape: `tables.equipment.heat_pump_indoor_units[*].linked_erv_unit_id`
  per `planning/archive/heat-pumps/PRD.md` §4.5.

---

## US-EQ-7 — Heat Pumps sub-tab structure (nested-tab navigation)

**Status:** Phase 2 partially implemented (2026-06-09; Equipment —
Outdoor + Equipment — Indoor leaves live, Units leaves
placeholder) · **Priority:** MVP
**PRD ref:** Heat Pumps PRD §5 (UI and navigation)
**Inherits:** US-EQ-1 (Equipment tab structure); US-Builder-Tables

### Story
> As an editor, I want a single "Heat Pumps" slot inside the
> Equipment tab that opens a nested sub-tab strip — Equipment
> Outdoor / Equipment Indoor / Units Outdoor / Units Indoor — so I
> learn one navigation pattern (the existing Equipment sub-tab
> idiom) and apply it to a richer four-table feature without
> bloating the parent strip.

### Acceptance criteria (summary)

1. New sub-tab "Heat Pumps" added to the Equipment sub-tab bar in
   the position defined in §US-Builder-Equipment table above
   (between ERVs and Pumps).
2. Clicking "Heat Pumps" renders a nested sub-tab strip with four
   entries: `Equipment — Outdoor` (default), `Equipment — Indoor`,
   `Units — Outdoor`, `Units — Indoor`. shadcn `Tabs` smaller
   variant (per Heat Pumps PRD D-HP-13).
3. URL deep-link per the route shape in the Heat Pumps PRD §5.2.
   `…/heat-pumps` redirects to `…/heat-pumps/equipment-outdoor`.
4. Each leaf page renders exactly one DataTable wired to the
   underlying project document body shape (US-EQ-8..11).
5. Locked-version + Viewer rendering inherited — nested nav still
   functional; tables read-only.

### Implementation status

Phase 1 adds the "Heat Pumps" parent Equipment tab, the nested
four-leaf strip, and the deep-link shape
`/projects/{id}/equipment/heat-pumps/equipment-outdoor`. The
Equipment — Outdoor leaf is live. Phase 2 lights up the
Equipment — Indoor leaf using the same nested-strip primitive.
Units — Outdoor and Units — Indoor intentionally render
phase-placeholder
states until US-EQ-9..11 land.

### Resolved questions
All directional questions resolved in
`planning/archive/heat-pumps/decisions.md`. No open questions on
this story.

---

## US-EQ-8 — HP Equipment — Outdoor DataTable

**Status:** Phase 1 implemented (2026-06-09) + Phase 5A locally
implemented (2026-06-09; Phius CSV export end-to-end wired —
backend `phius_export` + dialog + menu; xlsx-paste still
deferred per OPQ-3) · **Priority:** MVP
**Inherits:** US-Builder-Tables (criteria 1–17), US-EQ-1, US-EQ-7

### Story
> As an editor, I want a DataTable that captures every distinct
> outdoor condensing unit model used on the project — including
> the AHRI-rated pairing with a specific indoor model, Phius-calc-
> aligned performance numbers (HSPF2/COP/SEER2/EER2/IEER),
> refrigerant type, and the cut-sheet PDF — so the Phius Multiple
> Heat Pump Performance Estimator export has every row it needs.

### Acceptance criteria (summary)

1. Inherits US-Builder-Tables criteria 1–17.
2. Column set per Heat Pumps PRD §4.2 — 20 fields.
3. Default column visibility per Heat Pumps PRD §5.3 (legacy
   metrics + inactive-discriminator side fields hidden by default).
4. Required fields: `model_number`. `paired_indoor_equip_id` is a
   nullable FK to HP Equipment — Indoor; null covers VRF /
   multi-zone rows. `system_family` replaces the earlier
   `mode_type` label.
5. Phius export action available in the overflow `⋯` menu per Heat
   Pumps PRD §6.
6. `datasheet_asset_ids[]` via the shared `<AttachmentCell>`.
7. Empty state per Heat Pumps PRD §5.6.

### Implementation status

Phase 1 ships the active-version REST-backed DataTable, row-detail
modal, add / edit / delete row mutations, inline simple-cell edits,
`datasheet_asset_ids[]` via `<AttachmentCell>`, a paired-indoor FK
picker, and a minimal inline-create modal for indoor equipment.

Phase 5A (2026-06-09, awaiting commit) replaces the Phase 1 export
stub with a real pre-export dialog: the `⋯ → Export to Phius HP
Estimator…` menu item opens `PhiusExportDialog`, which fetches the
wrapped JSON payload (`rows` + `warnings` + inline `csv`) from
`POST /api/v1/projects/{id}/equipment/heat-pumps/export-phius`,
renders row count + per-row warnings grouped by `model_number`,
and on Continue downloads `phius-hp-estimator-{bt}-{YYYY-MM-DD}.csv`
via `shared/lib/downloadBlob`. Backend Qty is derived from outdoor-
unit instance counts; column-conditional cells follow Heat Pumps
PRD §6.2 / §6.4. xlsx-paste payload (OPQ-3) returns a 501
placeholder this slice.

Phase 1 caveat: HP equipment `manufacturer`, `system_family`, and
`refrigerant` rows store option ids, but HP tables are not yet
registered with the generic editable `single_select_options`
lifecycle. Until that registration lands, the frontend mints
deterministic `opt_<slug>` ids from typed labels and renders those
ids back as readable labels.

### Resolved questions
None outstanding on this story (Heat Pumps PRD OPQ-1 is a
phase-1-internal implementation detail, not a story question).

---

## US-EQ-9 — HP Equipment — Indoor DataTable

**Status:** Phase 2 implemented (2026-06-09; frontend
indoor-equipment page live) · **Priority:** MVP
**Inherits:** US-Builder-Tables (criteria 1–17), US-EQ-1, US-EQ-7

### Story
> As an editor, I want a DataTable that captures every distinct
> indoor head / cassette / concealed-duct / multi-position /
> ERV-integrated model used on the project — including
> install-type (so the ERV-integrated path drives the
> `linked_erv_unit_id` picker on the instance side) — so the
> indoor side of every installed AHU is documented and the
> Phius / energy-model handoff has consistent per-type metadata.

### Acceptance criteria (summary)

1. Inherits US-Builder-Tables criteria 1–17.
2. Column set per Heat Pumps PRD §4.3 — 16 fields.
3. Required fields: `model_number`.
4. `install_type` is a user-defined single-select with seeded
   examples (CASSETTE / WALL-MOUNTED / CONCEALED-DUCTED /
   MULTI-POSITION / ERV-INTEGRATED). The `ERV-INTEGRATED` value
   drives the conditional visibility of the
   `linked_erv_unit_id` field on instance rows (US-EQ-11).
5. `datasheet_asset_ids[]` via the shared `<AttachmentCell>`.
6. Empty state per Heat Pumps PRD §5.6.

### Implementation status

Phase 2 ships the active-version REST-backed indoor-equipment
DataTable, the full 16-field row-detail modal (Identity /
Performance / Notes sections), and add / edit / delete row
mutations. Default-visible columns: manufacturer, model_type,
model_number, install_type, nominal_tons, cooling_btuh,
heating_btuh_47f, datasheet. Default-hidden: fan_speed_cfm,
heating_btuh_17f, heating_cop, seer, eer, hspf, notes. Required
validation: `model_number` non-empty, `nominal_tons > 0` when
set, all other numeric fields `>= 0` when set.

`install_type` ships its five canonical seed labels (Cassette,
Wall-mounted, Concealed-ducted, Multi-position, ERV-integrated)
through a frontend `<datalist>` autocomplete on the row-detail
modal. The same Phase 1 `manufacturer`/`system_family`/
`refrigerant` caveat applies: HP option ids are still minted
deterministically from typed labels until the generic
`single_select_options` registration lands.

The Phase 1 minimal "Create indoor equipment" modal used by the
outdoor-equipment inline-create shortcut is now the same full
modal mounted in `mode="add"`; the outdoor flow's inline-create
shortcut continues to work without code-site changes.

### Resolved questions
None outstanding on this story (the
single_select_options registration follow-up is tracked on
US-EQ-8's caveat note).

---

## US-EQ-10 — HP Units — Outdoor DataTable

**Status:** Phase 3 implemented (Heat Pumps PRD §4.4 / §5) ·
**Priority:** MVP
**Inherits:** US-Builder-Tables (criteria 1–17), US-EQ-1, US-EQ-7

### Story
> As an editor, I want a DataTable that captures every installed
> outdoor condenser instance on the project — tagged with the GC
> drawing schedule label (e.g. `HP-17`), pointing to its
> outdoor-equipment "type" row, and noting the building zone it
> serves — so the Phius export's `Qty` column is computed from
> real instance counts and the project's drawing schedule is
> faithfully captured.

### Acceptance criteria (summary)

1. Inherits US-Builder-Tables criteria 1–17.
2. Column set per Heat Pumps PRD §4.4 — 6 fields.
3. `tag` is the Record-ID per US-Builder-Tables §record-id;
   required; unique within table (trim + case-insensitive).
4. `outdoor_equip_id` required — picker dropdown sources
   `heat_pump_outdoor_equip[]` rows by display name; inline
   "Create new outdoor equipment" shortcut per Heat Pumps PRD §5.5.
5. Empty state per Heat Pumps PRD §5.6 (with secondary line when
   the outdoor-equip table is itself empty).
6. Referential integrity per Heat Pumps PRD §4.6 (deleting an
   outdoor-equip row referenced by ≥1 unit is blocked; deleting
   an outdoor unit cascade-nulls referencing indoor units).

### Phase 3 implementation notes (2026-06-09)

Shipped `OutdoorUnitsTable.tsx`, `OutdoorUnitRowModal.tsx`, and
`outdoor-unit-columns.tsx` (frontend) on top of the Phase 0 backend
service which already supports the dry-run cascade preview
(`?dry-run=true`) and the cascade-null on confirm. The two-step
cascade flow is implemented as: click Delete → call
`previewHeatPumpDelete` (dry-run) → if `affected.length > 0` open
`CascadePreviewDialog` → on confirm re-read the slice from the
TanStack Query cache (to pick up any draft_etag advances while the
dialog was open) and issue the real delete. Tag uniqueness mirrors
US-EQ-2 (auto-suffix `(2)` / `(3)` on add via `uniqueTagForAdd`;
reject on rename via `tagCollides`).

**Carry-over (Phase 1 / Phase 2 option-id caveat):** the `Zone`
field on the outdoor unit row-detail modal is a free-text input
that derives an `opt_…` id via `optionIdFromLabel`, mirroring the
existing Phase 1 `manufacturer` / `system_family` / `refrigerant`
inputs. The acceptance-item 8 "shared with `tables.rooms[*].building_zone`
option list" picker UX is deferred until the Rooms frontend lands
and the cross-table single_select_options primitive is registered
(see US-EQ-8 caveat). The free-text approach is forward-compatible:
once Rooms supplies canonical option ids, the existing
`optionIdFromLabel` slugging keeps matched casing aligned.

---

## US-EQ-11 — HP Units — Indoor DataTable

**Status:** Phase 4 implemented (2026-06-09) — `linked_erv_unit_id`
single-select picker and `served_room_ids` multi-select picker are
both wired on the indoor unit row-detail modal. Backend silent
cascades on ventilator delete (null the link) and room delete
(filter the array) ship in this phase. ·
**Priority:** MVP
**Inherits:** US-Builder-Tables (criteria 1–17), US-EQ-1, US-EQ-7,
US-EQ-4 (amendment)

### Story
> As an editor, I want a DataTable that captures every installed
> indoor AHU instance — tagged with the GC drawing schedule label
> (e.g. `AHU-17L`), pointing to its indoor-equipment type, the
> outdoor unit it's wired to, the rooms it serves, and (for
> ERV-integrated installs) the matching ERV row — so the project's
> mechanical schedule, energy-model load attribution, and
> Mitsubishi-style integrated-unit cases are all captured in one
> place.

### Acceptance criteria (summary)

1. Inherits US-Builder-Tables criteria 1–17.
2. Column set per Heat Pumps PRD §4.5 — 9 fields.
3. `tag` is the Record-ID; required; unique within table.
4. `indoor_equip_id` required (picker per US-EQ-10 criterion 4
   pattern). `outdoor_unit_id` nullable but encouraged; picker
   sources `heat_pump_outdoor_units[]` rows.
5. `served_room_ids[]` multi-select picker sources `tables.rooms[]`
   by `number` / `name`; empty array allowed; integers cap at the
   project's room count.
6. `linked_erv_unit_id` field appears in the row-detail modal only
   when the row's `indoor_equip_id` references an indoor equip
   row whose `install_type` is `ERV-INTEGRATED` (or
   user-renamed equivalent). Field is a single-select picker
   sourcing `tables.equipment.ervs[]` rows by `name`. See US-EQ-4
   amendment for the reverse-lookup surface.
7. `floor_level` mirrors `tables.rooms[*].floor_level` option list.
8. Empty state per Heat Pumps PRD §5.6.
9. Referential integrity per Heat Pumps PRD §4.6 — every linked
   id (`indoor_equip_id`, `outdoor_unit_id`, `linked_erv_unit_id`,
   each entry of `served_room_ids[]`) responds correctly to
   deletes on the referenced side.

### Phase 3 implementation notes (2026-06-09)

Shipped `IndoorUnitsTable.tsx`, `IndoorUnitRowModal.tsx`, and
`indoor-unit-columns.tsx`. The modal includes `linked_erv_unit_id`
and `served_room_ids` as visible-but-disabled fields tagged with a
"Configured in Phase 4" pill — the underlying storage (Phase 0)
already accepts and round-trips both values; only the picker UI is
gated. The outdoor-unit picker disables itself with helper text
("Add an outdoor unit first in Units — Outdoor.") when the source
list is empty, satisfying acceptance criterion 4's nullable picker
behavior. Indoor-unit deletes are direct (no dry-run) — indoor
units are leaves with no downstream cascade.

**Carry-overs to Phase 4:** the `served_room_ids[]` multi-select
picker (criterion 5), the `linked_erv_unit_id` install-type-gated
picker (criterion 6), and the `floor_level` cross-table option-list
sharing (criterion 7) all land in Phase 4 alongside the Rooms
frontend. Same Phase 1 option-id caveat applies to the current
free-text `Floor` input.

### Phase 4 implementation notes (2026-06-09)

The two "Configured in Phase 4" pills are gone. `linked_erv_unit_id`
is now an always-rendered single-select sourced from
`tables.equipment.ervs.rows` (sorted by `record_id`); the picker
disables with helper text "Add an ERV first under Equipment → ERVs"
when the source list is empty. `served_room_ids[]` is an
always-rendered multi-select sourced from `tables.rooms.rows`
(display per US-EQ-2: `{number} — {name}`). Both fields are
inlined in `IndoorUnitRowModal.tsx` rather than broken into
standalone picker components — they were too small to justify
extraction. Backend cascades land in
`apply_ventilators_replace` (nulls `linked_erv_unit_id` on every
referencing HP indoor row when a ventilator is removed) and
`apply_rooms_replace` (filters `served_room_ids[]` when a room is
removed). Both cascades are silent — no preview, no dialog — per
the scope amendment that descoped AC #6 modal badge and AC #8
pre-delete dialog to Q-HP-FOLLOWUP-7.

**Still carry-over (Phase 1 option-id caveat):** the free-text
`Floor` input on the indoor unit modal still derives an `opt_…`
via `optionIdFromLabel` rather than picking from
`tables.rooms.floor_level`. Cross-table option-list sharing
(criterion 7) is deferred until the shared single-select
primitive lands; the free-text approach round-trips correctly in
the meantime.

---
