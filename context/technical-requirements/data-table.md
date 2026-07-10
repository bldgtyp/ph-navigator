---
DATE: 2026-05-12
STATUS: CANONICAL TECHNICAL REQUIREMENTS — extracted from the catalog POC table-view doc.
RELATED: context/PRD.md §11.3, context/TECH_STACK.md,
         context/UI_UX.md §1.7, context/user-stories/30-tables-equipment.md,
         research/poc-plans/grid-spike-results.md,
         research/poc-plans/poc-evaluation.md,
         research/poc-plans/poc-lessons-for-real-build.md
---

# PH-Navigator V2 — DataTable Requirements

This is the implementation contract for the shared table primitive used
by catalog manager pages, project data tables, bookshelf pickers, and
future grid-style surfaces.

The older top-level `context/DATA_TABLE.md` was removed from active
context because it was mostly a consolidated catalog-POC record. Keep
the POC artifacts under `research/` for archaeology; use this file for
current implementation decisions.

## Ownership Split

- Product scope and startup-level direction: `context/PRD.md`.
- User-facing table interaction model: `context/UI_UX.md` §1.7.
- Acceptance criteria for project tables and equipment tabs:
  `context/user-stories/30-tables-equipment.md`.
- Stack/library decision: `context/TECH_STACK.md`.
- Implementation contract: this file.

## Library Decision

Use TanStack Table v8 (MIT, headless) with
`@tanstack/react-virtual`, rendered through shadcn-table primitives.

AG Grid Community was rejected because row grouping, range selection,
and set-filter style faceted filtering are Enterprise features. MUI X
DataGrid was also rejected because the comparable parity features live
behind paid tiers and its visual idiom does not match the shadcn/Tailwind
app shell.

Accepted tradeoff: TanStack is headless, so PHN owns markup, styling,
selection behavior, clipboard handling, and accessibility. That is
consistent with the app's typed, domain-specific table requirements.

## Consumers

The shared primitive should serve:

- catalog manager pages at `/catalog/{slug}`;
- project data tables, starting with Rooms;
- Equipment sub-tabs as they become real tables;
- bookshelf pickers using a read/select-only mode;
- future grid-style surfaces that can be described by typed columns and
  a stable row id.

Do not build separate table editors per domain unless the domain cannot
fit this contract.

## Component Shape

The public API should expose user intent, not TanStack internals.

```ts
type DataTableProps<TRow> = {
  rows: TRow[];
  getRowId: (row: TRow) => string;
  fieldDefs: FieldDef[];
  columnDefs: ColumnDef<TRow>[];

  view: ViewState;
  onViewChange: (next: ViewState) => void;

  onWrite: (op: WriteOp) => void | Promise<void>;
  readOnly?: boolean;

  density?: "compact" | "comfortable";
  tintTheme?: TintTheme;
  rowChrome?: { leading?: ChromeSlot[]; trailing?: ChromeSlot[] };

  unitContext?: UnitContext;
  attachmentRenderer?: AttachmentRenderer;
};
```

Rules:

- `rows` use stable ids. Never treat visual row index or data-array
  index as identity.
- `view` is controlled by the parent. For project-document tables,
  per-user view state is persisted across sessions and devices through
  the `features/table_views` adapter (see Plan 09 / US-TBL-VIEW-1).
  Named/shareable views remain post-v1 (NEW-TBL-1).
- Selection, active-cell, edit, and fill-handle state remain internal
  unless multiple consumers need to observe them.
- `readOnly` covers locked versions, Viewer mode, and permission
  boundaries. Hide edit affordances instead of rendering disabled
  controls with tooltips.

## Field Definition Registry

One typed `FieldDef` drives render, edit, clipboard coercion, sort,
filter, and aggregation. Avoid scattered field-type conditionals across
renderers.

```ts
type FieldDef = {
  field_key: string;
  field_type: FieldType;
  display_name: string;
  config?: FieldConfig;
  read_only?: boolean;
  // Plan-31 Phase 1a — per-attribute lock list. Built-in (feature-
  // author-declared) seeds carry `built_in: true` plus a `locked`
  // array naming the attributes the user cannot edit. Defaults to
  // `["delete", "duplicate"]` for built-ins; user-created custom
  // fields leave it absent (= fully editable). Not persisted —
  // derived from feature code at load time so tightening / loosening
  // locks in code takes effect on next render without rewriting
  // documents.
  built_in?: boolean;
  locked?: ReadonlyArray<FieldLockKey>;
  optionMutability?: OptionMutability;
  required?: boolean;
  description?: string;
};

type FieldLockKey =
  | "display_name"
  | "field_type"
  | "options"
  | "default"
  | "description"
  | "formula"
  | "delete"
  | "duplicate";

type OptionMutability = "editable" | "locked";

type CoerceResult<T> =
  | { ok: true; value: T | null }
  | { ok: false; error: string; raw: string };
```

**Lock semantics.** Each `FieldDef` declares which attributes the user
may *not* edit. The unified field-config modal opens for both built-in
and custom fields; locked sections render disabled with the uniform
`"Field Locked"` tooltip (per `plan-31` Q-F5). Default policy: built-ins
ship `["delete", "duplicate"]`; attachments ship the all-locked array
(no field is user-authorable). Phase 1a additionally enforces a hard
rule that the type picker stays disabled on every built-in regardless
of lock-list contents — Phase 3 lifts that rule once the storage path
has been reshaped (see `data-model.md` §6.6 + `plan-31` PRD §P0.1).

**Single-select option mutability.** Option-list editing is an explicit
capability, not implied by `field_type === "single_select"`.
Frontend `FieldDef.optionMutability` is `"editable"` or `"locked"`; when
omitted it is derived from whether `FieldDef.locked` includes
`"options"`. The shared field-config modal, inline single-select picker,
and paste planner all use this contract: locked fields keep value edits
for existing options, but cannot add, rename, reorder, recolor, delete,
or paste-create options. Backend `TableFieldRegistry` mirrors the same
policy with `option_editable_builtin_field_keys`; custom single-selects
remain editable, while built-ins must be allowlisted. Rooms allowlist
`floor_level` and `building_zone`. App-owned `status` fields and other
non-allowlisted built-in single-select vocabularies are locked even
when their cell values remain editable.

Option-list saves use the typed schema path. The field-config modal
emits the full next option list as `EditCustomFieldBundleRequest.options`,
which becomes `editFieldBundle.nextOptions` and is applied through the
same backend `apply_edit_options` path as direct `editOptions`. When an
option referenced by rows is deleted, the modal records an explicit
cascade choice. Nullable fields may clear referenced cells; replacement
choices are carried as `optionReplacements` (`deletedOptionId ->
replacementOptionId`). Required built-in single-selects cannot clear:
the backend rejects referenced deletes unless every deleted id maps to
a replacement id that remains in `nextOptions`.

**Header/schema invariant.** Every project table header is rendered by
the shared `GridHeader` / `DataTableHeaderCell` path; feature tables do
not provide custom header editors. If a visible row property differs
from the persisted schema key, the column sets
`DataTableColumnDef.schemaFieldKey`; cells still write through
`fieldKey`, while header field-configuration actions use
`schemaFieldKey`. Feature-owned built-in render metadata is merged into
the persisted schema with the shared `fieldDefsWithRenderOverrides`
helper, preserving `built_in`, `custom_field_type`, locks, and other
schema attributes. `read_only` fields are projection-only for schema
editing and do not expose the field-config modal.

V2 v1 field types:

| Type | Requirement |
|---|---|
| `text` | Plain text with contains/is/empty-style operators. |
| `number` | SI or dimensionless numeric value in document. Plain numbers render with `FieldDef.numberPrecision` when configured and have no unit chrome. Optional `numberUnits` config (see "Number with Units" below) wires a single Number field into the global SI/IP toggle without inventing a separate type. |
| `single_select` | Project-defined options, pill renderer, popover editor, match-or-create paste, sort by option order. |
| `computed` | Backend-owned read overlay; frontend renders ready/stale/loading/error states and never reimplements PH calculations. |
| `attachment` | Cell value is `string[]` of `asset_id`s referencing `project_assets` rows (`data-model.md` §6.5). Rendered by `<AttachmentCell>` — mousewheel-scrolled thumbnail strip, fixed cell height, "📎 Drop files here" pill-button in the empty active state, preview modal on double-click, select-and-Delete detach gesture. **Pre-set core fields only in v1** — not in the user-extensible custom-field set; the roster of attachment-capable cells lives in `attachments.md` §A2. **Clipboard semantics in v1: copy/paste of attachment cells is disabled.** Fill propagates the array verbatim within the same column. Aggregations: Count, Count Unique. Sort: by array length. Filter: `is_empty`, `is_not_empty`, `count_gte`, `count_lte`. **No** schema-mutation menu entries — `addField` / `deleteField` / `changeType` / `setFormula` do not apply. Write paths reject asset ids that are missing, pending/failed, cross-project, invalid for the field policy, or over the field's max-count. Full UX contract: `attachments.md`. |
| `color` | User-authorable nullable color field stored as normalized `#rrggbb` hex. Editor exposes native color picker plus hex/RGB/CMYK inputs; short hex is accepted by frontend input and expanded before write. Filter: `is`, `is_not`, `is_empty`, `is_not_empty`. Aggregations: Count, Count Unique. Sort/group by stored hex. Does not drive row tinting or app view-state coloring. |
| `linked_record` | Cell value is an ordered `string[]` of target row ids. Pills resolve labels through consumer-supplied target-table data and open the target record in the standard same-page row modal when active, preserving the current table/route for AirTable parity. Cross-route `?focus=<row_id>` deep links remain allowed for explicit navigation flows, but linked chips should not navigate by default. |

**Formula authoring UI.** Add/edit Formula field modals use the shared
`FieldConfigSectionFormula` surface only. The expression editor is the
shared `FormulaSourceEditor`: multiline by default, textarea-backed,
resizable, and overlaid with tolerant syntax highlighting for field
references, string literals, and numeric literals. Formula feedback is a
structured preview/error card; blocking local parse/evaluation errors
use alert semantics, while neutral preview states remain polite. Field
and function autocomplete is rendered by the shared
`FormulaSuggestionPanel`, filters from the caret token (`{N` and bare
`N` both work), inserts fields as `{Display Name}` and functions as
`name(`, and supports ArrowUp/ArrowDown, Enter, Tab, Escape, and mouse
selection. Feature tables may provide formula registries or row-value
readers, but must not import formula editor components or CSS directly.

Clipboard coercion must preflight the whole paste range. If any cell
fails validation, commit nothing and show a paste review dialog with row,
column, raw value, and error, capped to the first 25 failures plus an
overflow count.

## Backend Data Shapes

Semantically identical built-ins use one storage tier across tables.
`inside_outside` is a typed single-select column on both Ventilators and
Hot Water Tanks, with per-table option namespaces
`ventilators.inside_outside` and `hot_water_tanks.inside_outside`.
`phase` is a typed nullable number column on equipment tables that
currently expose it (Pumps, Fans, Hot Water Heaters), and Pydantic row
validators enforce `phase in {1, 3}` wherever the column exists.

A built-in cross-table `status` single-select rides on twelve DataTables.
The rule is **Datasheet-driven**: every DataTable-backed table that carries
a `Datasheet` field gets `status` — Pumps, Fans, Hot Water Heaters, Hot
Water Tanks, Electric Heaters, Appliances, Ventilators, and all four Heat
Pump leaves (Outdoor/Indoor **Equipment** and Outdoor/Indoor **Units**).
Thermal Bridges is the lone exception — it carries `status` *without* a
Datasheet (pure dashboard accounting). Rooms and Space Types stay out.
Unlike `inside_outside`/`device_type`, its value
is **not** a typed column: it lives in `row.custom_values["status"]`, and
its option list is namespaced `<table_label>.status` (e.g. `pumps.status`,
`thermal_bridges.status`, `heat_pumps_outdoor_equip.status`). That key is
the same `<table_label>.<field_key>` namespace the generic-table validator
resolves single-select *custom-value* option lists under — so a built-in
single-select stored in `custom_values` is keyed by the table's validation
label, not by the dotted `option_list_key(table_path, ...)` prefix used for
`cf_*` custom fields. The FieldDef (default `opt_status_needed`; options
Complete/Needed/Question/N/A, colored with the Materials/report-status
palette), option list, and the in-scope table list (`STATUS_TABLE_NAMES`)
have a single source of truth in
`backend/features/project_document/tables/_status_field.py`; a module-load
drift guard in `tables/registry.py` keeps `STATUS_TABLE_NAMES` in sync with
the contracts that actually carry the field. On the frontend the shared
equipment + thermal-bridges tables (including Ventilators) resolve the
column through the normal `useTableSchema` `${tableKey}.${field_key}` path;
the four Heat Pump leaves build FieldDefs from local factories and route the
cell write via a `status → setCustomValue` seam because the value lives in
`custom_values`.
New rows default to `opt_status_needed`; duplicate preserves the source
row's status.

The Status landing page reads this cross-table contract through compact
project-document projections rather than mounting the 12 owning table slices:
`GET /projects/{project_id}/versions/{version_id}/draft/status-summary`
(editor-only current view) and
`GET /projects/{project_id}/versions/{version_id}/document/status-summary`
(view-safe saved version). Both load the selected document once and return only
aggregate counts plus each record's id, Display Name/Tag fallback, normalized
status, notes, and owning-route metadata. Missing or invalid legacy status
values normalize to `unknown`; they are never silently counted as Needed.

On the shared frontend renderer, only the built-in `field_key === "status"`
single-select gets semantic status-chip treatment: Complete and Needed
render as compact solid chips with decorative scan icons; Question remains
visually distinct; N/A stays neutral and quiet. Ordinary `single_select`
fields, linked-record pills, toolbar chips, and filter/group chips keep the
quieter tinted-pill treatment. A full solid-fill/white-text chip conversion
is intentionally rejected for dense tables until a separate design decision
changes that scope. Numeric-prefix hiding for single-select labels is also
not global; any future prefix stripping needs an explicit field/list-level
presentation rule.

**Shared table visual rhythm.** DataTable density is tokenized in
`frontend/src/styles/tokens.css` and consumed by the shared
`DataTable.css` surface. Current defaults are 38px data rows, 38px normal
headers, 50px unit-bearing headers, 12px horizontal cell/header padding,
and 4px vertical cell padding. The row virtualizer's data-row estimate must
stay synchronized with `--data-table-row-height`; grouped rows may keep a
separate estimate. The grid continues to use fixed `colgroup` widths for
persisted sizing, resize, sticky frozen columns, and virtualization. Unit
labels render as quiet second-line header badges, plain/unit-aware numeric
cells right-align, empty numeric displays render the muted dash, and the
toolbar, gutter, row hover/selection, active cell, and summary bar use the
shared table tokens instead of table-local one-off chrome.

Attachment-capable equipment tables use their canonical rich table keys
(`ventilators`, `pumps`, `fans`, `hot_water_heaters`,
`hot_water_tanks`, `electric_heaters`, `appliances`) in the attachment
registry and bulk-download manifests. The previous `equipment_*`
attachment-only table aliases are intentionally unregistered so each
table path has one validated write surface.

Heat Pumps uses the same generic FieldDef-capable backend table shape as
the rest of the equipment tables, but at the leaf-table grain under the
existing `equipment.heat_pumps` aggregate. The registered generic table
keys are `heat_pumps_outdoor_equip`, `heat_pumps_indoor_equip`,
`heat_pumps_outdoor_units`, and `heat_pumps_indoor_units`; each leaf
stores `{ field_defs, rows }`, and each row carries the standard
`custom_values` / `custom_links` bags. Normal leaf edits use the generic
project-document table read/replace/schema-mutation routes. The
feature-specific aggregate route may remain for legacy delete-preview and
Phius export workflows until the frontend finishes migrating. On the
frontend, each Heat Pump leaf owns its own `useSliceTableController`
instance, view-state key, schema fingerprint, and replace payload
builder. Each leaf table composes its built-in Heat Pump columns with
the shared `customFieldColumnDefs` output from the controller's
`tableSchema`, and forwards the controller's custom-field action
handlers into `<DataTable>`, so server-returned custom fields, locks,
formula `rows_computed` overlays, view-state sanitization, and schema
mutations use the same frontend path as Rooms and the generic equipment
tables. Cross-leaf displays may compose the four loaded slices for
labels and inverse-link pills, but writes still land on the owning leaf
controller so custom-field bag routing, option deltas, and conflict
handling stay identical to other generic table consumers.
Heat Pump built-in link columns on the unit leaves are declared as
backend `linked_record` FieldDefs (`outdoor_equip_id`,
`indoor_equip_id`, `outdoor_unit_id`, `served_room_ids`, and
`linked_erv_unit_id`) even when the Pydantic row stores the canonical
value in a typed scalar/list attribute. The frontend adapter converts
grid writes back to that typed row shape, but the schema remains
truthful so the shared linked-record cell renders labels/pills instead
of raw stored ids.

Blank-value coercion follows AirTable parity: when a field allows null
(`required !== true`), user clear gestures write `null`, not the
field-type natural zero. This includes Backspace/Delete on the active
editable cell and committing an emptied inline editor for `text`,
`number`, `single_select`, and `color` fields. Required fields reject the clear
and keep the prior value.

Number cells carry the shared `data-table-numeric-cell` class /
`data-numeric-cell="true"` marker so numeric alignment is semantic, not
table-local. Empty rendered number cells show a muted em dash in display
state only; clipboard, paste, and writes continue to use the nullable
value contract above.

Plain `number` cells with `FieldDef.numberPrecision` render, copy, CSV
export, and aggregate at that configured precision without mutating the
stored value. Numeric filter comparisons and paste normalization still
parse numeric values, not formatted strings.

### Number with Units

Per-field opt-in extension that wires a single `number` field into the
global SI/IP toggle. Not a separate `field_type` — the picker still
shows "Number", and plain Number fields stay unitless when
`numberUnits` is absent. Full contract (registry, `FieldDef.numberUnits`
shape, `editable` / `fixed` modes, SI-canonical storage, format/parse
helpers, backend round-trip) lives in `frontend-viewer-units.md`
§11.5.5; this section captures only what's specific to the DataTable
grid surface.

- **Header unit badge.** When `FieldDef.numberUnits` is present the
  column header uses the shared two-line header layout: field name on
  the primary line, active unit label (`m` / `ft`, `kg/m3` / `lb/ft3`,
  …) as a quiet badge below it. Cells render the bare displayed value
  at the active system's precision — no per-cell suffix.
- **Cell pipeline.** Render, inline-editor seed, paste coerce, copy,
  filter compare, and aggregation all go through the §11.5.5 shared
  format/parse helpers against the active `unitSystem`. Aggregates
  reduce on canonical SI then format in the active system. The global
  SI/IP toggle is render-only and never dirties an open editor draft.
- **View state on config change.** Editing a field's `numberUnits`
  config (or clearing it) drops that field's persisted filter rules —
  stored filter values were typed in the prior system and would be
  ambiguous after a swap. Sort, group, widths, hidden columns, and
  filters on other fields are preserved.

Header field descriptions render as a compact icon trigger beside the
field name, not a full text `"?"` control. The trigger remains a real
button with the accessible name `Description for <field>` and opens the
description tooltip on hover or keyboard focus.

**Field identity rule.** For core fields, `FieldDef.field_key` is the
declared core key (e.g. `"name"`, `"floor_level"`). For user-defined
custom fields it is the immutable `cf_*` id from
`CustomFieldDef.id` — never the display name and never the advisory
`field_key` slug. `CellWrite.fieldKey`, `WriteOp.fieldKey`, filter /
sort / group / column-width / hidden-column entries in `ViewState`,
and formula dependency ids all carry this identity. Renaming a custom
field never rewrites any row, write op, or view-state entry.
See `data-model.md` §6.6.2.

## Interaction Requirements

Implement the shared UX contract from `context/UI_UX.md` §1.7:

- active cell and keyboard navigation;
- rectangular range selection, full-row select, full-column select, and
  full visible-table select;
- native copy as TSV plus HTML;
- TSV paste with rectangle planning and optional row append;
- fill handle with cyclic repeat, not pattern detection;
- semantic undo/redo per gesture;
- stacked toolbar for hide/filter/group/sort/color;
- group accordion with per-column aggregations;
- tinting for filtered, sorted, and grouped columns;
- read-only mode where local sort/filter/group and copy still work.

Paste works regardless of group / filter / sort — it resolves against the
same view-resolved visible rows copy and the fill handle use, so no view
transform disables it. Column overflow is dropped with a toast; row overflow
opens a truncate / add rows / cancel modal when row creation is allowed. The
add-rows path appends backing rows at table end; under active group / sort /
filter those new rows may land outside the current visible view after save.

### Download CSV (parent-owned overflow affordance)

The `...` overflow menu always renders a built-in **Download CSV** item
(in `ViewMenuOverflow`, alongside `Reset view`). Like row-expand, this is
an iron-law affordance: it is parent-owned, never injected per-table via
the consumer `actions`/`overflowMenuActions` slot, and is enforced by a
required `onDownloadCsv` prop at every internal seam plus a structural
guard (`scripts/check-data-table-contract.mjs`). Every consumer supplies
a required `tableName` prop that becomes the download filename.

It is always present and always enabled — including read-only/viewer mode
(download is a read action) and an empty table (header-only CSV). The
output is the current view (WYSIWYG): `filteredRows` × `visibleColumnDefs`
(active sort, filter, hidden columns, column order; identifier pinned
first; group headers excluded). Serialization (`lib/export/csv.ts`,
`tableToCsv`) reuses the clipboard cell serializer — single-select →
option label, plain number → configured precision, number+units → active
SI/IP value with the unit on the header — and adds a computed/formula
branch (error cells → `""`). Format is RFC-4180 (comma-delimited,
minimal double-quote quoting, `\r\n` records) as UTF-8 with a leading
BOM so Excel renders `m²`, the Rooms em-dash, and accented names
correctly.

## Write Pipeline

All mutations collapse into one semantic `WriteOp` pipeline.

```ts
type WriteOp =
  | { kind: "cell"; writes: CellWrite[] }
  | {
      kind: "paste";
      writes: CellWrite[];
      rowsInserted: RowInsertPayload[];
      rowsDeleted?: RowDeletePayload[];
      newOptions: Record<string, FieldOption[]>;
    }
  | { kind: "fill"; writes: CellWrite[] }
  | { kind: "rowInsert"; rows: unknown[] }
  | { kind: "rowDelete"; rows: unknown[] }
  | { kind: "schemaMutation"; mutation: FieldSchemaMutation };
```

> **Implementation note (plan-15 P2.4):** the legacy
> `WriteOp.fieldDefMutation` shape — currently consumed only by the
> single-select option editor (`FieldEditorPopover`) — is renamed to
> `WriteOp.schemaMutation` in plan-15 phase 2.4. No shim chain
> (pre-deploy, CLAUDE.md §16). The single-select option editor
> continues to ride the renamed variant via the legacy `before` /
> `after` / `cellWrites` slots until plan-16 / Phase 3 splits it into
> its own `editOptions` mutation kind.

`FieldSchemaMutation` is the discriminated DTO for user-defined field
schema changes. It is shared by browser writes, REST, and MCP so that
add / rename / delete / duplicate / change-type / describe / set-formula
go through one validation and audit path:

```ts
type FieldSchemaMutation =
  | { kind: "addField";       tableKey: TableKey; after: CustomFieldDef;  insertAfterFieldId?: string; expectedSchemaFingerprint: string }
  | { kind: "renameField";    tableKey: TableKey; fieldId: string;        displayName: string;          expectedSchemaFingerprint: string }
  | { kind: "deleteField";    tableKey: TableKey; fieldId: string;        clearValues: true;            expectedSchemaFingerprint: string }
  | { kind: "duplicateField"; tableKey: TableKey; sourceFieldId: string;  after: CustomFieldDef;        expectedSchemaFingerprint: string }
  | { kind: "changeType";     tableKey: TableKey; fieldId: string;        after: CustomFieldDef;        cellWrites: CellWrite[]; expectedSchemaFingerprint: string }
  | { kind: "setDescription"; tableKey: TableKey; fieldId: string;        description: string | null;   expectedSchemaFingerprint: string }
  | { kind: "setFormula";     tableKey: TableKey; fieldId: string;        config: FormulaConfig;        expectedSchemaFingerprint: string };
```

Invariants:

- **Table-scoped identity.** `tableKey` plus `fieldId` (a stable
  `cf_*` id) is the unique target. Display names and the advisory
  `field_key` slug are never identity.
- **Optimistic concurrency.** `expectedSchemaFingerprint` is the
  fingerprint of the table's `custom_fields` array as the editor saw
  it (see View State below). The backend rejects with a structured
  stale-fingerprint error if the live draft has moved on.
- **One semantic gesture = one undo entry.** `changeType` carries the
  dependent `cellWrites` (incompatible values cleared per US-CF-4)
  inside the same op so the operation is atomic from an undo
  perspective.
- **Backend authority.** The backend re-validates duplicate-name
  rules (per-table, case-insensitive, trimmed, across core + custom),
  type-conversion legality, formula parse + cycle + dependency rules,
  and option-list namespace edits, then applies the mutation in one
  transaction or rejects it. See `data-model.md` §6.6 and
  `save-versioning.md` §8.3.

Rules:

- Inline edit, paste, fill, row insert/delete, and single-select option
  mutations all emit through `onWrite`.
- One semantic gesture equals one undo entry.
- Growing paste is still one semantic gesture: inserted rows travel in
  `paste.rowsInserted`, undo removes them through `paste.rowsDeleted`, and
  existing-cell inverses ride in the same history entry.
- A draft ETag is document-scoped, not table-scoped. After any accepted
  editor table write, invalidate sibling editor table slices for the
  same project/version so subsequent writes use a fresh guard. New
  generic table features should rely on `createTableSliceFeature` for
  this behavior; legacy aggregate endpoints that can change table data
  must also invalidate the generic editor table-slice query family.
- If a target editor table slice is invalidated, the next write must
  refresh that target slice before constructing the payload, not just
  patch the outgoing ETag header. This preserves the lazy sibling
  invalidation performance contract without overwriting target-table
  rows that changed while the cached slice was stale.
- Single-select option creation during paste belongs in the same op as
  the cell writes that use those options.
- All mounted table instances share one FIFO persistence lane per open
  draft. Do not send concurrent project-document writes from different
  tables, schema controls, or modal/preflight paths against the same draft.
- Adjacent queued cell/row-insert gestures may share one transport request,
  but keep one history entry and one settlement handle per gesture. Never
  coalesce across a lifecycle flush boundary.
- The table may optimistically apply writes while the queue flushes; the
  surrounding shell owns save/sync/conflict indicators.
- Save and Save As wait for pending table writes to flush before calling
  the version endpoint.
- On conflict, auth failure, locked-version failure, or backend
  validation failure, stop the queue, roll back to the last
  server-acknowledged snapshot, clear undo, and hand control to the
  parent conflict/session/validation UI.
- A draft-ETag conflict may retry once only when all targeted rows still
  exist, inserted ids do not collide, and every remote target value equals
  the gesture's captured pre-edit value. Never retry a saved-version mismatch
  or overwrite a remotely changed target cell.
- Undo is local-only. Do not issue compensating PATCH requests after a
  conflict.
- Keep the 50 most recent semantic gestures per mounted table. Clear both
  undo/redo stacks whenever the draft lineage is replaced (rollback, reload,
  remote slice, lock conflict, discard, or version switch).

## View State

Store plain user-intent state and derive TanStack shapes from it.

```ts
type ViewState = {
  filter: FilterCondition[];
  sort: SortRule[];
  group: GroupRule[];
  aggregations: Record<string, AggregationKind>;
  columnOrder: string[];
  columnWidths: Record<string, number>;
  hiddenColumns: string[];
  expandedGroups: Record<string, boolean>;
};
```

Rules:

- Persist or cache `ViewState`, never TanStack's `columnFilters`,
  `grouping`, or `sorting` objects.
- Toolbar-owned sort/filter/group state is the mutation authority.
  Header affordances must call the same `onViewChange` path.
- Group direction requires a pre-sort derived from group rules.
- Empty/dormant filter rows pass all rows; they do not match empty
  strings.
- Project-document tables persist one `ViewState` per
  `(user_id, project_id, table_key)` through
  `useProjectTableViewState` (`features/table_views`). The hook owns
  the load gate, debounced PUT (500 ms), in-flight + latest-pending
  save queue, DELETE-on-reset, and render-safe schema sanitization.
  Backend storage lives in `user_table_views` and is JSONB-opaque
  beyond envelope checks (schema version, byte size, table-key syntax).
  Anonymous Viewer mode never reads or writes saved view state.
- Catalog manager tables (Materials, Glazing Types, Frame Types) persist
  one `ViewState` per `(user_id, catalog_table_key)` through
  `useLocalTableViewState` (`features/table_views`), backed by
  `localStorage` under `phn:tableView:v1:${userId}:${tableKey}`.
  Catalogs are shared across users, but sort / filter / group / column
  widths are a personal lens — localStorage gives each user their own
  remembered view without a server round-trip. The hook mirrors
  `useProjectTableViewState`'s API and reuses its `ViewStateEnvelope`
  type and `sanitizeViewStateForSchema` pass, but uses a shorter
  debounce (150 ms) since there is no network cost, flushes the
  pending write on unmount and scope-change so navigation never
  drops the last edit, and exposes no `saveError` / `isLoading` —
  localStorage reads synchronously in the state initializer.
- **Schema fingerprint on persisted view state.** Custom-field
  schemas are *version*-scoped while persisted view state is
  *(user, project, table)*-scoped. Each persisted view-state record
  carries a stable fingerprint of the active table schema (computed
  from core field ids + custom field ids + custom field types,
  ordered by the table schema). On load, view state is applied for
  render regardless of fingerprint, but writes back are gated by
  matching fingerprint: switching to a version whose schema does
  not match must not overwrite the saved order / widths / hidden /
  sort / filter / group / aggregation entries of the version whose
  schema does match. The first user-driven view-state change under
  a new schema persists under the new fingerprint. Tests cover the
  round-trip: version A with custom columns, version B without
  them, back to version A with column order / width / hidden state
  preserved.

## Identifier Column

The DataTable separates **identity** (a hidden machine key) from the
**human label** shown in the pinned leading column. This is the Honeybee
model: the hidden `row.id` maps to HB `identifier`; the pinned
**Display Name** maps to HB `display_name`. The settled contract lives
in `planning/archive/dated/2026-06-17/record-identity-model/`.

Two layers, applied uniformly across every project DataTable:

| Layer | Backing field | Unique? | User-visible? | Owns |
|---|---|---|---|---|
| Hidden key | `row.id` (`rm_`, `pmp_`, `st_`, `tb_`, `fan_`, …) | **Yes** — enforced on every table | No | Identity, linked-record targets, `custom_links`, formula deps |
| **Display Name** | the descriptive `name` field (the `{Number} — {Name}` formula on Rooms) | **No** — never constrained | Yes — pinned to slot 0 | The readable handle; carries the duplicate-warning chip |
| **Tag** | the former identifier (`record_id` field key) | No | Yes — ordinary column | Nothing structural; a normal code field |

Rules:

- **Pinned by a per-column flag.** Each table builder sets
  `isIdentifier: true` on exactly one `DataTableColumnDef`
  (`shared/ui/data-table/types.ts`). `identifierColumnId()` finds it,
  `useGridColumns` forces it to slot 0 (and never hides it even if its
  id is in `hiddenColumns`), and `computeIdentifierDuplicates` keys the
  warning chip on it (`lib/identifier/recordId.ts`, `GridBody.tsx`).
  There is no global `record_id` constant in the pin path and no
  synthetic `__record_id__` column — the identifier is whatever column
  the table flags, per table, not a hardcoded field key.
- **Display Name is the descriptive name.** On the 8 generic tables
  (appliances, electric_heaters, fans, hot_water_heaters,
  hot_water_tanks, ventilators, thermal_bridges, space_types) and Pumps
  the flagged column is the `name` field, labeled **"Display Name"**.
  On Rooms it is the editable `{Number} — {Name}` formula column
  (`record_id` field key kept as a formula), also labeled
  "Display Name". The header is never **"Name"** and never
  **"Record-ID"** — both labels are retired.
- **Tag is an ordinary field.** The former identifier (`record_id`
  field key, labeled **"Tag"**) is now an ordinary, editable,
  non-unique, unpinned column on the generic tables. `RECORD_ID_FIELD_KEY`
  survives only as the field key several call sites read its value by;
  it no longer drives pinning or the warning chip. Rooms has no Tag
  field (its `record_id` slot is the Display Name formula); Pumps gained
  an empty Display Name and keeps its Tag.
- **Never unique-constrained.** No table hard-blocks a duplicate Display
  Name (or a duplicate Tag). Cells whose Display Name matches another
  row in the same table render a non-blocking warning chip ("Also used
  on row N…"); empty / whitespace values do not warn. The only
  enforced-unique guard is on the hidden `row.id`, applied to every
  FieldDef-capable table by `validate_table_row_ids` /
  `generic_table_row_ids` (`backend/features/project_document/_validators.py`).
- **The pinned slot cannot be hidden or reordered** (the "Hide field"
  toggle is suppressed for it; only sort remains).
- **Shift-Enter row insert produces a truly blank row**: field defaults
  come from `FieldDef.default` / natural zero only, never cloned from
  the anchor row.
- **View state round-trips without a special case.** The identifier
  column has an ordinary column id, so its persisted sort rules and
  widths flow through `sanitizeViewStateForSchema`'s generic
  `columnIds` set with no reserved-key whitelist.
- **Heat-pump sub-tables are not yet on the shared grid** (they join in
  the data-table-consolidation refactor); they flag no `isIdentifier`
  column and show no pinned Display Name or warning chip in the interim.

See `planning/archive/dated/2026-06-17/record-identity-model/PRD.md` for the full
identity contract, and
`planning/archive/dated/2026-06-04/editable-fields/archive/complete/plan-30-datatable-identifier-column.md`
for the original identifier-column rollout that this model supersedes.

## Layout, Styling, And Accessibility

- 32 px row height; 1 px dividers; row hover highlight.
- Sticky first data column by default; when a column declares
  `isIdentifier` (see *Identifier column*), that column is pinned to
  slot 0 regardless of saved `columnOrder`.
- Row numbers, row select, and drag handles live in table chrome, not in
  the backend schema or TanStack data column model.
- Use explicit stacking lanes for sticky headers, frozen columns,
  selection, focus, editor overlays, and popovers.
- Toolbar filter/sort/group popovers may contain nested searchable
  selectors for fields, operators, and directions. Those nested option
  lists must be positioned in viewport space and escape the parent
  popover content box so transforms, scroll containers, and clipping do
  not offset them from the clicked input. Ordinary form/modal selectors
  remain inline unless they have the same popover-in-popover constraint.
- Focus uses an outline channel. Selection and fill preview use separate
  border/box-shadow channels.
- Tint palette is an explicit token set, not runtime HSL blending.
- Locked-attribute state (any `FieldDef` whose `locked` array is
  non-empty — equivalently, every `built_in: true` seed under the
  Plan-31 Phase 1a default policy) is a **header-only** signal
  communicated through a non-background channel (lock glyph and/or
  2–3 px bottom border accent on a dedicated token, e.g.
  `--phn-header-border-locked`). It must not consume a fifth tint
  channel — the existing four header tints (filter / sort / group /
  future) remain reserved for view state and layer on top of the
  locked-state indicator. The indicator is visible to Viewers as
  well as Editors. The indicator says "this field has at least one
  frozen attribute"; per-attribute granularity surfaces inside the
  field-config modal via the `"Field Locked"` tooltip (Q-F5).
- Container has `tabIndex={0}` and owns bubbled keyboard handling.
- Use grid semantics: `role="grid"` plus visual
  `aria-rowindex`/`aria-colindex`.
- Tab should leave the table when there is no next visible cell.
- Announce filter/sort/group changes through a polite live region.

## Extraction Order

1. Extract the real component API before wiring persistence.
2. Add dedicated tests for selection, copy/paste planning, coercion,
   single-select lifecycle, view-state derivation, and undo semantics.
3. Wire Rooms through the project draft buffer.
4. Reuse the same component for the first catalog manager table.
5. Add attachment rendering when the Envelope/assets slice needs it.
6. Run an accessibility pass after the interaction model is stable.

## Column widths

Every column has an explicit pixel width that the user can change by
dragging the right edge of its header. Widths are user view-state, not
column-definition data — they ride on `ViewState.columnWidths` and
persist per `(user, project, table_key)` exactly like sort / filter /
group / order / hidden columns (plan 09).

- **Resolver.** `resolveColumnWidth(columnDef, fieldDef, view)` in
  `shared/ui/data-table/lib/columnWidths.ts` is the single source of
  truth. Precedence is: persisted `view.columnWidths[id]` →
  `DataTableColumnDef.defaultWidth` → per-field-type default
  (`FIELD_TYPE_DEFAULT_WIDTH`) → text default. Always clamped to the
  column's `[minWidth, maxWidth]` (global defaults: 60 / 800 px).
- **Render path.** `<DataTable>` emits one `<col>` per visible column
  with an inline `width: ${px}px` style. `<table>` is
  `width: max-content; table-layout: fixed` and the wrapper handles
  both axes' overflow.
- **Resize gesture.** `useGridColumnResize` (Pointer Events) owns the
  drag session and emits `onViewChange` continuously via
  `requestAnimationFrame`; the consumer's 500 ms debounce in
  `useProjectTableViewState` collapses the burst into one PUT.
  Esc cancels.
- **Fit-to-content.** Double-click on the resize handle invokes
  `measureColumnFitWidth` against the header label + every visible
  cell's accessor (or `DataTableColumnDef.measureText` override),
  clamped to `[minWidth, maxWidth]`.
- **Tail "+" cell.** A 42 px cell sits at the right edge of every
  header / data / summary row. v1 is `aria-disabled`; the future
  "add field" feature only needs to add behavior, not layout.
- **Persistence corollary.** `sanitizeViewStateForSchema` drops widths
  whose column id is no longer present in the schema. No back-compat
  shim is required for the rename from `width` → `defaultWidth` —
  pre-deployment.

## Shared Column Builders

Feature tables should use the shared builders in
`shared/ui/data-table/columns.tsx` and adjacent shared modules for
common column and row-editor shapes:

- `linkColumn` / `LinkCell` for external URL cells using
  `.data-table-link-cell` and the shared `shortenUrl` formatter.
- `attachmentColumn` for attachment fields: ordered id accessors,
  count-based `measureText`, editor/read-only wiring, and no-op ordered
  id suppression before `onWrite` / direct `onChange`.
- `identifierColumn` / `identifierColumnDef` for the single
  `isIdentifier: true` column described above.
- `incomingLinkColumn` / `incomingLinkFieldDef` for read-only incoming
  linked-record pill columns. The column helper emits the shared
  GridBody linked-record cell behavior (`LinkedRecordCell` with active
  `+` affordance) so feature tables do not hand-render inverse-link
  pills. Use `accessorValue: "ids"` only when the table also declares a
  real `linked_record` `FieldDef` and therefore needs the DataTable
  linked-record renderer to receive row ids; use the default
  display-text accessor for synthetic inverse-link columns so
  clipboard, filter, sort, and measure text stay aligned with the
  visible pill labels.
- `IncomingLinkPicker` for inverse-link edit affordances whose write
  lands on another table. Feature code may own the domain mutation, but
  it must not mount `fields/linkedRecord/Picker` directly for incoming
  link cells. Cross-table selection changes should be converted to
  source-table cell writes with the shared incoming-link selection
  helpers, including `max_links` handling and no-op suppression. True
  editable FK fields should stay on the normal
  `linkedRecordOps` + `GridBody` path so the shared `LinkedRecordCell`
  owns pills, the active-cell `+`, unlink affordances, and picker
  launch.
- Synthetic computed columns that are not persisted backend fields must
  still provide frontend `FieldDef` metadata when they need a shared
  renderer such as `lookup` or `linked_record`. Append these definitions
  only for missing `field_key`s; persisted backend FieldDefs remain
  authoritative for real editable fields.
- `DATA_TABLE_COLUMN_WIDTHS` for semantic default widths such as
  `recordId`, `identifier`, `link`, `attachment`, `notes`, and small
  numeric columns.

Editable numeric inputs that need blank-to-null parsing use
`parseNumberInput` from `lib/units/format.ts`.

## Shared Row-Edit Modal

Feature row editors should use the shared row-edit primitives in
`shared/ui/data-table/row-edit.tsx` and `useRowEditForm.ts` when their
form shape fits the common scaffold:

- `useRowEditForm` owns `draft`, `error`, `isSaving`, frozen-draft
  checks, optional validation, and the submit try/catch path.
- `RowEditModal` owns the `ModalDialog` / `project-form` chrome,
  conflict banner, error paragraph, Cancel/submit actions, optional
  Delete action, read-only submit suppression, and read-only delete
  suppression.
- `TextField`, `TextAreaField`, `NumberField`,
  `ModalSingleSelectField`, and `ModalLinkedRecordField` provide shared
  field wrappers for modal editing. `ModalSingleSelectField` writes
  option ids, not labels, and may optionally create a new option id for
  modal-owned option lists. `ModalLinkedRecordField` wraps the shared
  linked-record picker and only mounts the picker while open, so closed
  fields do not sort target candidates during unrelated form edits.
- `ConfirmDestructiveDialog` is the shared destructive-confirm
  primitive for table/row operations. It exposes optional detail
  children and disabled confirm state for cascade previews; feature
  surfaces that only report blocked deletion details may still use a
  feature-specific informational modal.
- Row-edit layout styles live in `DataTable.css`; shared row-edit
  components must not depend on feature-local CSS imports.

**Row expand is intrinsic, never per-table.** Every DataTable instance
always presents an identical, working row-expand affordance: the gutter
Expand button, the "Expand record" row-context-menu item, and the keyboard
open gesture. These are not opt-in — the internal handler props
(`GridGutter.onExpandRow`, `GridBody.onRowExpand`, `RowContextMenu.onOpen`)
are **required**, so a table physically cannot render the affordance
unwired. DataTable always supplies the handler:

- When a consumer passes `onRowOpen`, the affordances invoke that bespoke
  modal (Rooms, Ventilators, heat-pump leaves, Materials).
- When a consumer omits `onRowOpen`, they open the built-in generic
  `RecordDetailModal`, assembled from the table's own `columnDefs` +
  `fieldDefs`. It reads every visible field, edits the safe types
  (`text` / `number` / `single_select`) through the normal `dispatchWrite`
  + undo pipeline, and renders the rest read-only. Read-only tables (no
  `onWrite`) open it view-only.

Consumers must **not** add their own gutter/expand control or re-implement
this affordance — `onRowOpen` is the single, optional override.
`frontend/scripts/check-data-table-contract.mjs` (run in `check:all`)
fails the build if the dead-decoration pattern or an optional
expand-handler prop is reintroduced. The keyboard path is the one
deliberate exception: in pure viewer mode (read-only with no consumer
drawer) Enter stays inert, since there is nothing to edit and the explicit
Expand button/menu already cover viewing.

## Regression Coverage

The contracts above are guarded by a layered test suite. Fast shared tests
live next to the DataTable code; the slower browser matrix lives under
`frontend/tests/e2e/table-regression/` and is described once as data in
`tableMatrix.ts` (one entry per project table). See
`planning/archive/dated/2026-06-19/data-table-regression-suite/` for the full design.

| Contract | Where proven |
|---|---|
| Commit write/undo, coercion, null clears, option ids, link dedupe/`maxLinks` | `data-table/__tests__/sharedEditContract.test.ts` (React-free planners) |
| Row-expand is always a live button (never a dead decoration) and opens the built-in record-detail modal with no `onRowOpen`; "Expand record" menu item always present; required internal props | `data-table/__tests__/{GridBody,recordDetailExpand,RowContextMenu}.test.tsx`; guard `scripts/check-data-table-contract.mjs` |
| Every table mounts the grid with its columns, no console error | e2e `@table-smoke` (one test per table) |
| Text / number / single-select edit → display → reload → persisted value shape | e2e `@table-behavior` |
| Linked-record commit (grid picker + add-dialog), inverse column, persisted ids | e2e `@table-links` |
| View-state (sort / filter / group / hide / reorder) persists by `(user, project, tableKey)` and survives reload; heat-pump leaves stay independent | e2e `@table-view-state` |
| Shared formula editor/autocomplete reaches every field-config-capable DataTable; one persisted Rooms `&` formula recomputes after reload | e2e `@table-formula` |

Run policy (see the feature `PLAN.md` "Validation Policy"):

- Default frontend work does not pay for the browser matrix. Use
  `make frontend-dev-check` + focused Vitest.
- Shared DataTable changes: run the focused Vitest seam, then the relevant
  e2e tag(s).
- The browser matrix needs the local stack (frontend `5173`, backend
  `8000`) and the seeded agent account (`make seed-agent-user`). Sign-in
  defaults to `codex@example.com`.
- Scripts: `pnpm run test:e2e:tables:smoke` (fast render check, ~20s) and
  `pnpm run test:e2e:tables:formula` (formula rollout check). Use
  `pnpm run test:e2e:tables` for the full directory. The suite is
  intentionally kept out of default CI until its stack + flake profile are
  wired for CI (a known full-run teardown flake is tracked in the feature
  `STATUS.md`).

## Deferred

- OR mode in filters.
- Non-contiguous Cmd-click selection.
- Fill-handle pattern detection.
- Mobile/phone optimization.
- Comments, mentions, and presence cursors.
- ~~Linked-record / relation cells.~~ Shipped — built-in + custom
  linked-record fields with the shared picker; covered by e2e
  `@table-links` (see Regression Coverage above).
- ~~User-created runtime schema editing (the tail "+" cell is laid out
  but unwired).~~ Replaced by user-defined custom fields — see
  `data-model.md` §6.6 and `planning/archive/dated/2026-05-24/plan-13-custom-fields-overview.md`.
  The tail `+` cell opens the field editor popover for Editors and
  remains hidden in Viewer mode.
- Named/shareable table views.
- Dark-mode tint palette.
- Row-height presets and per-cell wrap toggle.
- Catalog-manager view-state persistence (column widths persist for
  project-document tables only; catalog tables resize locally).
- Auto-fit / "distribute remaining width" toolbar action.
- Keyboard-driven column resize (mouse / touch / pen only in v1).
