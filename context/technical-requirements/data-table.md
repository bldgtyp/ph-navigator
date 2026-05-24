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
  read_only_schema?: boolean;   // true = core field; schema-mutation menu items hidden (US-CF-6)
  required?: boolean;
  description?: string;
};

type CoerceResult<T> =
  | { ok: true; value: T | null }
  | { ok: false; error: string; raw: string };
```

V2 v1 field types:

| Type | Requirement |
|---|---|
| `text` | Plain text with contains/is/empty-style operators. |
| `number` | SI in document; render/input through active unit context where relevant. |
| `single_select` | Project-defined options, pill renderer, popover editor, match-or-create paste, sort by option order. |
| `computed` | Backend-owned read overlay; frontend renders ready/stale/loading/error states and never reimplements PH calculations. |
| `attachment` | R2-backed asset preview through an injected renderer. Full attachment UX lands with the Envelope/assets slice. |
| `argb_color` | Post-v1 typed field. Treat legacy ARGB strings as text until needed. |

Clipboard coercion must preflight the whole paste range. If any cell
fails validation, commit nothing and show a paste review dialog with row,
column, raw value, and error, capped to the first 25 failures plus an
overflow count.

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
  Catalog manager persistence is still out of scope; a future design
  may add `scope_type/scope_id` rather than reusing project ids.
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

## Layout, Styling, And Accessibility

- 32 px row height; 1 px dividers; row hover highlight.
- Sticky first data column by default when it is the row identifier.
- Row numbers, row select, and drag handles live in table chrome, not in
  the backend schema or TanStack data column model.
- Use explicit stacking lanes for sticky headers, frozen columns,
  selection, focus, editor overlays, and popovers.
- Focus uses an outline channel. Selection and fill preview use separate
  border/box-shadow channels.
- Tint palette is an explicit token set, not runtime HSL blending.
- Locked / unlocked field state (core vs custom; US-CF-11) is a
  **header-only** signal communicated through a non-background channel
  (lock glyph and/or 2–3 px left border accent on a dedicated token,
  e.g. `--phn-header-border-locked`). It must not consume a fifth
  tint channel — the existing four header tints (filter / sort /
  group / future) remain reserved for view state and layer on top
  of the locked-state indicator. The indicator is visible to Viewers
  as well as Editors.
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
  `data-model.md` §6.6 and `docs/plans/2026-05-24/plan-13-custom-fields-overview.md`.
  The tail `+` cell opens the field editor popover for Editors and
  remains hidden in Viewer mode.
- Named/shareable table views.
- Dark-mode tint palette.
- Row-height presets and per-cell wrap toggle.
- Catalog-manager view-state persistence (column widths persist for
  project-document tables only; catalog tables resize locally).
- Auto-fit / "distribute remaining width" toolbar action.
- Keyboard-driven column resize (mouse / touch / pen only in v1).
