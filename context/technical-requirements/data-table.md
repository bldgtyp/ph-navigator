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

V2 v1 field types:

| Type | Requirement |
|---|---|
| `text` | Plain text with contains/is/empty-style operators. |
| `number` | SI in document. Plain numbers render raw and have no unit chrome. Optional `numberUnits` config (see "Number with Units" below) wires a single Number field into the global SI/IP toggle without inventing a separate type. |
| `single_select` | Project-defined options, pill renderer, popover editor, match-or-create paste, sort by option order. |
| `computed` | Backend-owned read overlay; frontend renders ready/stale/loading/error states and never reimplements PH calculations. |
| `attachment` | Cell value is `string[]` of `asset_id`s referencing `project_assets` rows (`data-model.md` §6.5). Rendered by `<AttachmentCell>` — mousewheel-scrolled thumbnail strip, fixed cell height, "📎 Drop files here" pill-button in the empty active state, preview modal on double-click, select-and-Delete detach gesture. **Pre-set core fields only in v1** — not in the user-extensible custom-field set; the roster of attachment-capable cells lives in `attachments.md` §A2. **Clipboard semantics in v1: copy/paste of attachment cells is disabled.** Fill propagates the array verbatim within the same column. Aggregations: Count, Count Unique. Sort: by array length. Filter: `is_empty`, `is_not_empty`, `count_gte`, `count_lte`. **No** schema-mutation menu entries — `addField` / `deleteField` / `changeType` / `setFormula` do not apply. Full UX contract: `attachments.md`. |
| `color` | User-authorable nullable color field stored as normalized `#rrggbb` hex. Editor exposes native color picker plus hex/RGB/CMYK inputs; short hex is accepted by frontend input and expanded before write. Filter: `is`, `is_not`, `is_empty`, `is_not_empty`. Aggregations: Count, Count Unique. Sort/group by stored hex. Does not drive row tinting or app view-state coloring. |
| `linked_record` | Cell value is an ordered `string[]` of target row ids. Pills resolve labels through consumer-supplied target-table data and open the target record in the standard same-page row modal when active, preserving the current table/route for AirTable parity. Cross-route `?focus=<row_id>` deep links remain allowed for explicit navigation flows, but linked chips should not navigate by default. |

Clipboard coercion must preflight the whole paste range. If any cell
fails validation, commit nothing and show a paste review dialog with row,
column, raw value, and error, capped to the first 25 failures plus an
overflow count.

Blank-value coercion follows AirTable parity: when a field allows null
(`required !== true`), user clear gestures write `null`, not the
field-type natural zero. This includes Backspace/Delete on the active
editable cell and committing an emptied inline editor for `text`,
`number`, `single_select`, and `color` fields. Required fields reject the clear
and keep the prior value.

### Number with Units

Per-field opt-in extension that wires a single `number` field into the
global SI/IP toggle. Not a separate `field_type` — the picker still
shows "Number", and plain Number behavior is unchanged when
`numberUnits` is absent. Full contract (registry, `FieldDef.numberUnits`
shape, `editable` / `fixed` modes, SI-canonical storage, format/parse
helpers, backend round-trip) lives in `frontend-viewer-units.md`
§11.5.5; this section captures only what's specific to the DataTable
grid surface.

- **Header chip.** When `FieldDef.numberUnits` is present the column
  header shows the active unit label (`m` / `ft`, `kg/m3` / `lb/ft3`,
  …) as a quiet chip. Cells render the bare displayed value at the
  active system's precision — no per-cell suffix.
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

Paste is disabled while grouped. Column overflow is dropped with a
toast; row overflow prompts to append records when creation is allowed.

## Write Pipeline

All mutations collapse into one semantic `WriteOp` pipeline.

```ts
type WriteOp =
  | { kind: "cell"; writes: CellWrite[] }
  | { kind: "paste"; writes: CellWrite[]; rowsInserted: unknown[]; newOptions: Record<string, FieldOption[]> }
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
- Single-select option creation during paste belongs in the same op as
  the cell writes that use those options.
- One table instance maintains a FIFO persistence queue per open draft.
  Do not send concurrent draft writes for the same table/draft.
- The table may optimistically apply writes while the queue flushes; the
  surrounding shell owns save/sync/conflict indicators.
- Save and Save As wait for pending table writes to flush before calling
  the version endpoint.
- On conflict, auth failure, locked-version failure, or backend
  validation failure, stop the queue, roll back to the last
  server-acknowledged snapshot, clear undo, and hand control to the
  parent conflict/session/validation UI.
- Undo is local-only. Do not issue compensating PATCH requests after a
  conflict.

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
in `planning/archive/record-identity-model/`.

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

See `planning/archive/record-identity-model/PRD.md` for the full
identity contract, and
`planning/archive/editable-fields/archive/complete/plan-30-datatable-identifier-column.md`
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

## Deferred

- OR mode in filters.
- Non-contiguous Cmd-click selection.
- Fill-handle pattern detection.
- Mobile/phone optimization.
- Comments, mentions, and presence cursors.
- Linked-record / relation cells.
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
