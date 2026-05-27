---
DATE: 2026-05-24
STATUS: Draft. User-defined custom fields on project-document tables.
        Builds on US-Builder-Tables (30-tables-equipment.md) and the
        shared `<DataTable>` primitive
        (context/technical-requirements/data-table.md).
AUTHOR: Ed May (with Claude)
SCOPE: User stories for adding AirTable-style user-defined fields
       (text, long text, number, URL, single-select, formula) to
       project-document tables (Rooms, ERVs, Pumps, Fans, Thermal
       Bridges, ...). Catalog tables are explicitly out of scope for
       v1. Authoring source for the implementation plans under
       planning/archive/dated/2026-05-24/plan-13-custom-fields-overview.md.
RELATED: context/user-stories/30-tables-equipment.md (US-Builder-Tables),
         context/user-stories/31-data-table-enhancements.md (parity bar),
         context/technical-requirements/data-table.md,
         context/technical-requirements/data-model.md,
         context/PRD.md §6 (data model), §11 (frontend),
         planning/archive/dated/2026-05-24/plan-13-custom-fields-overview.md
---

# PH-Navigator V2 — User Stories: Custom Fields (US-CF-*)

These stories add **user-defined fields** to project-document tables —
AirTable's "+ add field" affordance, adapted to PH-Navigator's
versioned-document model. Every table keeps a set of **Core (locked)
fields** defined by the app for API/MCP stability, and editors can
extend each table with their own **custom (unlocked) fields**.

Custom field definitions live inside the project document body, so
they ride the existing version / save / Save-As / lock lifecycle.
Renaming, retyping, or deleting a custom field changes the current
**Draft** only — locked older **Versions** keep their schema and data
intact (see GLOSSARY: Version, Draft, Save / Save As).

| Story | Title | Status |
|---|---|---|
| US-CF-1  | Right-click context menu on column headers | Phase 2 |
| US-CF-2  | Add a custom field (text / long_text / number / url) | Phase 2 (four simple types only; single_select Phase 3, formula Phase 4) |
| US-CF-3  | Rename a custom field | Phase 2 |
| US-CF-4  | Change a custom field's type (preflight + convert anyway) | Draft |
| US-CF-5  | Delete a custom field | Phase 2 |
| US-CF-6  | Core fields show a reduced context menu | Phase 2 |
| US-CF-7  | Custom single-select fields | Draft |
| US-CF-8  | Formula fields | Draft |
| US-CF-9  | Viewers see custom fields, never the schema-mutation menu | Phase 2 |
| US-CF-10 | LLM/MCP discovers and writes custom fields via the document | Phase 1 (read criteria 1, 2, 4); Phase 2 (write) |
| US-CF-11 | Locked / unlocked visual indicator on header cells | Phase 2 |
| US-CF-12 | Duplicate field-name protection | Phase 2 |
| US-CF-13 | Duplicate an existing field | Phase 2 |
| US-CF-14 | Field description / tooltip | Phase 2 |

---

## US-CF-1 — Right-click context menu on column headers

**Status:** Phase 2 · **Priority:** Foundational for US-CF-2..8

### Story
> As an editor, I want to right-click a column header and see a menu
> of field operations (insert, rename, change type, sort, filter,
> group, hide, delete) so I can manage table structure without
> leaving the grid.

### Acceptance criteria
1. Right-click on any header cell opens a popover menu anchored to
   the click point.
2. The menu lists operations consistent with the AirTable screenshot
   in the originating discussion (insert left / insert right, sort
   A→Z / Z→A, filter by, group by, hide, delete, plus rename / edit
   type / edit formula for editable field types).
3. Menu items that mutate **view state** (sort, filter, group, hide)
   route through the same `onViewChange` path the toolbar uses — no
   duplicate state.
4. Menu items that mutate **schema** (insert, rename, change type,
   delete, edit formula) emit one `FieldDefMutation` `WriteOp` per
   gesture; one menu action = one undo entry.
5. In **Viewer** mode the menu is suppressed entirely — right-click
   falls through to the browser default.
6. In **Editor** mode on a **Core field**, the menu shows the
   view-state items only (see US-CF-6).
7. Keyboard equivalent: pressing the standard context-menu key
   (Shift+F10 / Menu key) on a focused header cell opens the same
   menu.

---

## US-CF-2 — Add a custom field

**Status:** Phase 2 (four simple types: `short_text`, `long_text`, `number`, `url`; `single_select` lands in Phase 3, `formula` in Phase 4) · **Priority:** Phase 2

### Story
> As an editor, I want to add a new field to a table by choosing its
> type and name, so I can capture project-specific data without
> waiting for an app release.

### Acceptance criteria
1. "Insert field left" / "Insert field right" from the header context
   menu opens a **popover** field editor anchored to the target header
   cell (AirTable-parity surface; see Q-CF-1 resolution).
2. The tail `+` cell at the right edge of every header row (already
   laid out per data-table.md "Column widths") opens the same popover
   editor anchored to the `+` cell.
3. The editor collects: **display name** (required), **field type**
   (required; one of `short_text`, `long_text`, `number`, `url`,
   `single_select`, `formula`), an optional **description**
   (US-CF-14), and a type-specific **config** panel (e.g. URL display
   mode, number precision, single-select option list, formula
   expression).
4. Submitting the editor:
   - validates the display name is non-empty after trim,
   - validates uniqueness across the table (see US-CF-12),
   - emits one `FieldDefMutation` `WriteOp` adding the new field to
     `tables.<name>.custom_fields`,
   - inserts the column at the chosen position in `ViewState.columnOrder`,
   - focuses the first cell of the new column for immediate entry.
5. The new field becomes a Custom (unlocked) field and shows the
   unlocked visual indicator (US-CF-11).
6. Cancel discards the editor without dirtying the draft.

---

## US-CF-3 — Rename a custom field

**Status:** Phase 2 · **Priority:** Phase 2

### Story
> As an editor, I want to rename a custom field without losing its
> data, view state, or formula references.

### Acceptance criteria
1. Selecting **Rename** from the context menu (or double-clicking the
   header label) opens an inline rename input populated with the
   current display name.
2. Submitting validates non-empty + uniqueness (US-CF-12) and emits
   one `FieldDefMutation` `WriteOp` mutating only `display_name` (and
   the advisory `field_key` slug).
3. **The stable `cf_*` id does not change.** All row values, view
   state entries (filter / sort / group / order / width / hidden),
   and formula AST references survive the rename untouched.
4. Formula editors that reference this field re-render with the new
   display name on next open; stored ASTs are not rewritten.
5. Core fields are not renamable — the rename item is absent from
   their context menu (US-CF-6).

---

## US-CF-4 — Change a custom field's type

**Status:** Draft · **Priority:** Phase 3

### Story
> As an editor, I want to change a custom field's type after I've
> entered data, with a clear warning about anything that won't
> convert.

### Acceptance criteria
1. **Change type** opens a dialog with: the current type, a target
   type picker, and a preflight of every existing value's coercion
   result against the target type.
2. Preflight reports row count + per-row diagnostics (row id, raw
   value, error) for any values that won't coerce, capped to the
   first 25 with an overflow count.
3. If preflight is clean, the dialog's primary action is **Convert**
   (single click commits).
4. If preflight has failures, the primary action becomes **Convert
   anyway (incompatible values cleared)** and the user must
   acknowledge a checkbox before it enables.
5. Commit emits one `FieldDefMutation` `WriteOp` containing the
   before/after `FieldDef` **plus** the `CellWrite[]` clearing each
   incompatible cell — atomic from an undo perspective.
6. The conversion preserves the field's `cf_*` id, position, and any
   view-state entries.

---

## US-CF-5 — Delete a custom field

**Status:** Phase 2 · **Priority:** Phase 2

### Story
> As an editor, I want to delete a custom field I no longer need,
> without affecting older locked versions of the project.

### Acceptance criteria
1. **Delete field** in the context menu prompts a confirmation
   dialog showing field name, type, and current row-value count.
2. Confirm emits one `FieldDefMutation` `WriteOp` removing the field
   from `tables.<name>.custom_fields` and stripping its key from
   every row's `custom` dict in the current draft.
3. `sanitizeViewStateForSchema` drops every reference to the deleted
   field id from `ViewState` (already specified in data-table.md).
4. Older saved Versions are not modified. Switching to a prior
   Version shows the field and its data exactly as it was at that
   Save.
5. Formula fields that referenced the deleted field by id continue
   to parse but evaluate to a structured `error: missing_ref` state
   (rendered in the existing computed-field `error` state).
6. Core fields are not deletable — the item is absent from their
   menu (US-CF-6).

---

## US-CF-6 — Core fields show a reduced context menu

**Status:** Phase 2 · **Priority:** Foundational (Phase 2 ships this)

### Story
> As an editor, I want core fields to clearly communicate that they
> are app-managed, by hiding schema-editing menu items, so I don't
> waste time trying to rename or delete them.

### Acceptance criteria
1. Core fields are flagged in the merged `FieldDef[]` (see
   `useTableSchema` in the implementation plan) with
   `read_only_schema: true`.
2. Their header context menu shows **only** the view-state items
   (sort, filter, group, hide). Rename / change type / delete /
   insert-into / edit formula are absent — not greyed-out — to
   reduce visual clutter.
3. Insert-left and insert-right remain available when invoked from a
   core field; the new field is added as a custom field at that
   position.
4. Core fields render with the locked visual indicator (US-CF-11).

---

## US-CF-7 — Custom single-select fields

**Status:** Draft · **Priority:** Phase 3

### Story
> As an editor, I want to add a single-select field with my own
> options, behaving exactly like the core single-select fields
> (Floor, Building Zone, etc.).

### Acceptance criteria
1. Choosing `single_select` in the field editor exposes an option-
   list editor (add, rename, reorder, color, delete options).
2. Options for custom single-select fields live in the document's
   existing `option_lists` map under the key
   `tables.<table>.<cf_id>` — same shape and lifecycle as the core
   single-select option lists already described in data-model.md
   §6.2.
3. Match-or-create paste behavior (data-table.md "Clipboard
   coercion") applies to custom single-select fields identically.
4. Renaming an option updates every row's stored value (because
   values reference options by id, not by label).
5. Deleting an option nulls every row that referenced it, with a
   confirmation showing the affected row count.

---

## US-CF-8 — Formula fields

**Status:** Draft · **Priority:** Phase 4

### Story
> As an editor, I want to add a read-only formula field that
> computes its value from other fields in the same row using a small
> safe expression language (arithmetic, string ops, conditionals).

### Acceptance criteria
1. Choosing `formula` opens a formula editor showing: an expression
   input, a field palette (clickable list of every other field in
   the table, both core and custom), and a live preview against the
   currently focused row.
2. The user writes expressions in **AirTable-style** syntax —
   `{Display Name}` for field references — e.g.
   `concat({Number}, " — ", upper({Name}))`.
3. On commit the editor:
   - parses to a typed AST,
   - resolves every `{Display Name}` ref to a stable `cf_*` /
     core-key id,
   - rejects with an inline error if any ref is unresolved, the
     grammar fails, or a cycle is detected (a → b → a),
   - stores `{ source: "<as written>", ast: <resolved>, deps: [...] }`
     in the field's `config`.
4. Cell value is computed lazily on render (frontend) and on
   download (backend); the two evaluators must agree to the byte on
   the test corpus.
5. Formula cells render in the existing `computed` field type's
   ready / stale / loading / error states; they are never editable.
6. JSON downloads inline the computed value alongside the source
   values on each row (per resolved decision 3).
7. Allowed operators / functions (v1): `+ - * / %`, comparison
   (`= != < <= > >=`), boolean `and / or / not`, `if(cond, a, b)`,
   `concat`, `upper`, `lower`, `replace`, `substring`, `len`, `trim`,
   `number()`, `text()`. No cross-row aggregates, no date math, no
   table lookups. (Deferred — see plan-13 §6.)
8. Renaming a referenced field updates the editor's *displayed*
   expression on next open; the stored AST is untouched (refs are
   by id).
9. Deleting a referenced field leaves the formula in a structured
   `error: missing_ref` state until the user edits or deletes it.

---

## US-CF-9 — Viewers see custom fields

**Status:** Phase 2 · **Priority:** Phase 2

### Story
> As a viewer (unauthenticated reader of a project URL), I want to
> see every custom field and every formula's computed value, so the
> view-only experience matches what the editor sees.

### Acceptance criteria
1. The merged `FieldDef[]` is identical in Viewer and Editor mode —
   the same custom fields and types render with the same column
   layout.
2. Header context menu is entirely suppressed in Viewer mode
   (US-CF-1 criterion 5).
3. The right-edge `+` tail cell is hidden in Viewer mode.
4. Filter / sort / group / hide on custom fields work in Viewer mode
   exactly as on core fields (these are local-only operations).
5. Formula values are visible and read-only.

---

## US-CF-10 — LLM / MCP discovers and writes custom fields

**Status:** Phase 1 (read criteria 1, 2, 4) · Phase 2 (write criteria 5, 6) · remaining criteria Draft
**Priority:** Phase 1 (read) + Phase 2 (write)

### Story
> As an MCP client (Claude Desktop / Code), I want the project
> document to advertise each table's custom fields and their types,
> so I can write valid values to custom fields and compute formulas
> without out-of-band knowledge.

### Acceptance criteria
1. Project JSON downloads include each table's `custom_fields` array
   inline at `tables.<name>.custom_fields`.
2. Each row's `custom` dict is keyed by the same `cf_*` ids that
   appear in `custom_fields[*].id`.
3. Formula values are inlined per row alongside the source values
   (US-CF-8 criterion 6); the field type marks them so consumers
   can choose to ignore them on round-trip.
4. The published `ProjectDocumentV1` JSON Schema declares
   `custom_fields` as a closed `CustomFieldDef[]` and each row's
   `custom` as `additionalProperties: true`. No per-project schema
   endpoint in v1.
5. MCP tools to add / rename / retype / delete custom fields ship
   in phase 2, scoped behind the editor MCP token, audit-logged
   like every other write.
6. MCP cell writes to custom fields flow through the existing
   `patch_draft` tool — no new write surface needed.

---

## US-CF-11 — Locked / unlocked visual indicator

**Status:** Phase 2 · **Priority:** Phase 2

### Story
> As an editor, I want to tell at a glance which fields are core
> (locked, app-managed) and which are my own custom fields, without
> turning the table into wall-of-color.

### Acceptance criteria
1. Locked / unlocked state is communicated on the **header cell
   only** — never on data cells (would saturate the grid).
2. The signal is **orthogonal to existing tint channels** (filter /
   sort / group). Implementation uses a non-background channel: a
   small lock glyph for core fields and a 2–3 px left border accent
   or alternate glyph for custom fields. Header background tints
   remain reserved for view state.
3. The indicator survives all four view-state tints layering on top
   of it.
4. The indicator is visible to Viewers as well as Editors.
5. Icons have accessible names ("Core field" / "Custom field") and
   reasonable contrast for color-vision-deficient users.

---

## US-CF-12 — Duplicate field-name protection

**Status:** Phase 2 · **Priority:** Phase 2

### Story
> As an editor, I want the app to refuse duplicate field names in
> the same table, so my data stays unambiguous and my formula
> references resolve uniquely.

### Acceptance criteria
1. Field name uniqueness is enforced **per table**, **case-
   insensitive**, with leading/trailing whitespace **trimmed**
   before comparison.
2. The check applies across **all** fields in the table — core and
   custom — not custom-only.
3. Add and rename operations preflight on the client (inline error
   in the field editor) and are re-validated on the server before
   the `FieldDefMutation` `WriteOp` is accepted.
4. A server-side duplicate rejection returns a structured error;
   the table rolls back to the last server-acknowledged snapshot
   (per data-table.md "Write Pipeline" rollback rule) and surfaces
   the message in the field editor.
5. The error message names the offending existing field
   (e.g. "Field name 'Notes' already exists in this table (core
   field).").

---

## US-CF-13 — Duplicate an existing field

**Status:** Phase 2 · **Priority:** Phase 2

### Story
> As an editor, I want to duplicate an existing custom field (with
> its type and config) so I can quickly create a sibling field
> without re-entering the configuration.

### Acceptance criteria
1. **Duplicate field** appears in the header context menu for any
   custom field (US-CF-1). It is **absent** from core fields'
   menus — core duplication would conflict with their `field_key`
   uniqueness in the Pydantic model.
2. Duplicate creates a new custom field immediately to the right of
   the source with:
   - a fresh `cf_*` id,
   - `display_name` defaulted to `<source name> copy` (uniquified
     per US-CF-12 with `copy 2`, `copy 3`, ... if needed),
   - `field_type`, `config`, and `description` deep-copied from the
     source,
   - **no row values** copied — every row's `custom` dict starts
     empty for the new field id.
3. For `single_select` sources, the duplicate references the same
   option list under a new key `tables.<table>.<new_cf_id>` whose
   options are deep-copied (fresh option ids) — the two fields are
   independent after duplication.
4. For `formula` sources, the AST is deep-copied verbatim; the
   formula evaluates identically until the user edits it.
5. The operation emits one `FieldDefMutation` `WriteOp` (one undo).

---

## US-CF-14 — Field description / tooltip

**Status:** Phase 2 · **Priority:** Phase 2

### Story
> As an editor, I want to attach a short description to any custom
> field, so collaborators (and future-me) know what the field is
> for without guessing from the name.

### Acceptance criteria
1. The field editor (US-CF-2) exposes an optional **description**
   text input.
2. When a field has a non-empty description, the header cell shows
   a small `?` glyph adjacent to the locked/unlocked indicator
   (US-CF-11). Hovering / focusing the glyph opens a tooltip
   displaying the description.
3. Description is editable through the same field editor (opened
   via the context menu's **Edit field** item for custom fields).
4. **Core fields** support descriptions too, but only **read-only**
   — they are populated by the app from the FieldDef registry and
   the context menu does not expose an editor for them.
5. Description text is plain text, max 280 chars, no markdown
   rendering in v1.
6. Descriptions are included in JSON downloads and in the published
   `ProjectDocumentV1` JSON Schema's `CustomFieldDef` shape.

---

## Cross-cutting notes

- **Versioning safety.** Because `custom_fields` lives in the
  project document body, schema mutations are scoped to the current
  Draft. Save commits them; Save As branches them; Lock freezes
  them. No cross-version migration is required when a custom field
  is renamed / retyped / deleted.
- **Catalog tables are out of scope** for v1. This story set applies
  only to project-document tables (Rooms, ERVs, Pumps, Fans,
  Thermal Bridges, ...). Catalog stability is foundational and is
  revisited post-v1.
- **No back-compat shim** is required for the document-shape change
  from `tables.<name>: Row[]` to
  `tables.<name>: { custom_fields, rows }` — see PRD §16 / CLAUDE.md
  ("no users, no real DB, change anything we want"). One
  `schema_version` bump.

## Resolved questions

All open questions on this story set are resolved as of 2026-05-24:

- ~~**Q-CF-1.**~~ **Resolved 2026-05-24:** popover anchored to the
  header cell (AirTable parity). Formula editor may escalate to a
  modal as its config grows; revisit during phase 4.
- ~~**Q-CF-2.**~~ **Resolved 2026-05-24:** formula live preview
  evaluates against the **focused row** only — simpler and
  sufficient for v1.
- ~~**Q-CF-3.**~~ **Resolved 2026-05-24:** field-permissions UI
  (per-user, per-role) is deferred from v1. **Schema mutations
  are still gated by editor login** through the existing auth
  pipeline — viewers and unauthenticated MCP requests are rejected
  server-side. The deferral is only about *granular per-field*
  permissions, not about authentication.
- ~~**Q-CF-4.**~~ **Resolved 2026-05-24:** **included in v1** —
  see US-CF-13.
- ~~**Q-CF-5.**~~ **Resolved 2026-05-24:** **included in v1** —
  see US-CF-14.
