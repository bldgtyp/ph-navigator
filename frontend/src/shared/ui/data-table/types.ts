// @size-exception: planning/features/row-context-menu/PRD.md
import type { ReactNode } from "react";
import type { NumberUnitsConfig } from "../../../lib/units";
import type { AggregationKind } from "./fields/aggregations";
import type { FieldSchemaMutation } from "./lib/customFieldMutations";
import type { FieldRegistryEntry } from "./lib/formula/resolver";
import type { LinkedRecordTargetTableOption } from "./components/FieldConfigSectionLinkedRecord";

export type { LinkedRecordTargetTableOption } from "./components/FieldConfigSectionLinkedRecord";

// Phase 6 §4.3.1: subset codes for the 7 non-empty subsets of
// {filter, sort, group}. Encoded as lowercase concatenations of the
// present axes' first letters, in fixed order f < s < g. Used as the
// `data-axis-tint` HTML attribute value so CSS attribute selectors
// paint each cell without any per-render JS work.
export type AxisRoleSubset = "f" | "s" | "g" | "fs" | "fg" | "sg" | "fsg";

export type FieldType =
  | "text"
  | "number"
  | "single_select"
  | "computed"
  | "attachment"
  | "color"
  | "linked_record";

// Closed v1 set, mirrored from backend `CustomFieldType`.
export type CustomFieldType =
  | "short_text"
  | "long_text"
  | "number"
  | "url"
  | "single_select"
  | "color"
  | "formula"
  | "linked_record";

// Per-attribute lock keys. Each entry in `FieldDef.locked` forbids
// one user edit through the field-config modal / header context menu.
// Render-time overlay — never persisted in the document.
export type FieldLockKey =
  | "display_name"
  | "field_type"
  | "options"
  | "default"
  | "description"
  | "formula"
  | "delete"
  | "duplicate";

export type FieldDef = {
  field_key: string;
  field_type: FieldType;
  display_name: string;
  read_only?: boolean;
  required?: boolean;
  description?: string;
  options?: FieldOption[];
  // Forward-compat slot consumed by row-insert defaults (Phase 2). Falls
  // back to the field-type natural zero (text: "", number: null,
  // single_select: null) when omitted.
  default?: unknown;
  // Drives the field-config modal's type picker. Built-ins set this so
  // the picker has a source type to render from (the Phase 1a hard
  // rule keeps the picker disabled regardless).
  custom_field_type?: CustomFieldType;
  // Phase 4: for `field_type === "computed"`, declare the underlying
  // value type so the filter-operator registry knows which catalogue to
  // expose. Defaults to "text" when omitted (preserves Phase 0–3
  // behaviour for existing computed columns).
  computed_type?: "text" | "number";
  // Custom number fields only. Mirrored from
  // `CustomFieldDef.config.precision` so the field-config modal can edit
  // number display precision without reaching into the document model.
  numberPrecision?: number;
  // Optional Number with Units config. Present only for number fields
  // whose persisted `TableFieldDef.config.units` is complete and valid.
  numberUnits?: NumberUnitsConfig;
  // When false, single_select pills render with a neutral background
  // even when each option still carries a color. Default true.
  colorCodeOptions?: boolean;
  // Custom single-select only. Stored as
  // `CustomFieldDef.config.default_option_id`; row creation applies it
  // only when the row omits this field.
  defaultOptionId?: string | null;
  // Per-attribute lock list applied at render time. Built-ins default
  // to `DEFAULT_BUILT_IN_LOCKS` per PRD §P5.0; custom fields omit it.
  locked?: ReadonlyArray<FieldLockKey>;
  // Marks a seed as feature-author-declared. Custom (`cf_*`) fields
  // omit it. Drives the formula registry's `origin` classification.
  built_in?: boolean;
  // Carries the stored source + AST + deps for a custom formula
  // field. Absent on core fields and non-formula custom fields. The
  // grid rebuilds the displayed expression from `ast` on each open so
  // a referenced field's rename absorbs silently between sessions.
  formula_config?: {
    source: string;
    ast: unknown;
    deps: string[];
    result_type?: string;
  };
  // Carries `target_table_path` + `max_links` for `linked_record`
  // custom fields (PRD §5). Absent on every other field type.
  // `max_links: null` → multi-link; `1` → single-link.
  linked_record_config?: {
    target_table_path: string[];
    max_links: number | null;
  };
};

export type FieldOption = {
  id: string;
  label: string;
  color: string;
  order: number;
};

export type AddCustomFieldRequest = {
  displayName: string;
  fieldType: CustomFieldType;
  config: Record<string, unknown>;
  description: string | null;
  // Only set when `fieldType === "single_select"`. Carries the initial
  // option list so add-with-options is one atomic POST.
  initialOptions?: FieldOption[];
  // Visual anchor in `view.columnOrder` ("insert this new field right
  // after this fieldKey"). Null means "append at end". Any fieldKey is
  // accepted — the consumer decides what subset (custom-only) to
  // forward to the backend's `insert_after_field_id`.
  insertAfterFieldKey: string | null;
};

export type DataTableColumnDef<TRow> = {
  id: string;
  fieldKey: string;
  header: string;
  accessor: (row: TRow) => unknown;
  render?: (row: TRow) => ReactNode;
  className?: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
  // Used by fit-to-content double-click. Defaults to
  // `String(accessor(row))`. Override when `render(row)` produces a
  // visibly shorter string than the accessor (e.g. iCFA rendered as
  // `toFixed(2)`) so the measured width matches what the user sees.
  measureText?: (row: TRow) => string;
};

export type SortRule = {
  fieldKey: string;
  direction: "asc" | "desc";
};

export type FilterOperator =
  // text operators (also "computed" with computed_type === "text" or absent)
  | "contains"
  | "does_not_contain"
  | "is"
  | "is_not"
  | "is_empty"
  | "is_not_empty"
  // number operators (also "computed" with computed_type === "number")
  | "eq"
  | "neq"
  | "gt"
  | "lt"
  | "between"
  // single_select operators
  | "is_any_of"
  | "is_none_of";

// Discriminated only by `operator`: each operator consults one of the
// three value slots (per its `FilterValueShape` in the registry):
//   - text + number-single: `value` (raw string; number ops parse with Number())
//   - between:              `valuePair` (two raw strings)
//   - is_any_of/is_none_of: `valueList` (option ids)
//   - is_empty/is_not_empty: none
// Slots are individually optional so consumers can construct conditions
// inline without a narrowing tax; the evaluator treats missing/blank
// slots as dormant (row passes — see Phase 4 §4.4).
export type FilterCondition = {
  fieldKey: string;
  operator: FilterOperator;
  value?: string;
  valuePair?: [string, string];
  valueList?: string[];
};

export type GroupRule = {
  fieldKey: string;
  direction: "asc" | "desc";
};

export type ViewState = {
  filter: FilterCondition[];
  sort: SortRule[];
  group: GroupRule[];
  // Plan 06 §4.1: `null` and a missing key both mean "no aggregation".
  // The library normalises both to "none" at read time; the explicit
  // `null` form exists so plan 09 (persistence) can distinguish
  // "user cleared this column" from "user never picked one" without
  // changing the in-memory render path.
  aggregations: Record<string, AggregationKind | null>;
  columnOrder: string[];
  columnWidths: Record<string, number>;
  hiddenColumns: string[];
  expandedGroups: Record<string, boolean>;
};

export type CellWrite = {
  rowId: string;
  fieldKey: string;
  value: unknown;
};

// Optional payload carried by cell / paste ops when a single semantic
// gesture also mutates a single-select option list. `newOptions` lists
// options that the op creates; `removedOptions` lists option ids that
// the op removes (used on the inverse leg of a create-then-write op so
// ⌘Z reverts both halves in one entry — PoC L6.5).
export type OptionListDelta = {
  newOptions?: Record<string, FieldOption[]>;
  removedOptions?: Record<string, string[]>;
};

// One entry per row inserted in a `rowInsert` op. `fieldDefaults` keys
// the grid-visible fields by `field_key`; the consumer's `buildEmptyRow`
// expands those into a full TRow (filling in non-grid fields from the
// anchor row or from its own defaults). `anchorRowId` is the rowId
// immediately above the new row at insert time (null for "insert at top"
// gestures, currently unreachable through Shift+Enter).
export type RowInsertPayload = {
  rowId: string;
  fieldDefaults: Record<string, unknown>;
  anchorRowId: string | null;
};

// One entry per row removed in a `rowDelete` op. `row` is the full TRow
// at delete time, so the inverse `rowInsert` reconstruction is lossless
// for grid-visible fields (Phase 2 §4.6 — non-grid fields rebuild via
// the consumer's defaults, which is acceptable while Rooms is the only
// consumer).
export type RowDeletePayload = {
  rowId: string;
  row: unknown;
  anchorRowId: string | null;
};

// Phase 4 — consumer-defined row-menu item rendered after the four
// built-ins (Insert / Duplicate / Expand / Delete). The library does
// not interpret `onSelect`; the consumer's closure decides whether to
// dispatch a `WriteOp` through `onWrite` (riding the existing undo
// pipeline) or call its own API directly (no library-managed undo).
//
// `shortcutHint` is display-only — the library does not register a
// global keyboard shortcut for it. Decision D-3 / PRD §2 non-goal.
export type RowAction = {
  // Stable id used for React keys, the `data-row-action-key`
  // attribute on the rendered button, and consumer-side telemetry.
  key: string;
  label: string;
  // Optional lucide-react icon. Renders in the left 16-px icon slot
  // via the same `--with-icon` modifier the built-ins use.
  icon?: ReactNode;
  // Right-aligned muted hint text. Display-only — see the comment
  // above for why the library does not bind a shortcut.
  shortcutHint?: string;
  // Routes to `data-danger="true"` for the red tint (matches the
  // built-in `Delete record` styling).
  danger?: boolean;
  // Called after the menu closes — mirrors the built-in lifecycle so
  // any state mutation the consumer kicks off lands after Radix's
  // close animation runs.
  onSelect: () => void;
};

// Per-open context handed to the consumer's `rowActions` selector.
// `selectionCount` and `rowIsInSelection` are snapshotted at right-
// click time (PRD §5 render-perf contract) so the consumer reads the
// same state the library used to pick its branch.
export type RowActionContext<TRow> = {
  rowId: string;
  row: TRow;
  selectionCount: number;
  rowIsInSelection: boolean;
};

// One entry per row duplicated in a `rowDuplicate` op. Carries enough
// for both consumer write models:
//   - CRUD consumers (Materials) use `sourceRowId` to call the backend
//     duplicate endpoint and ignore `sourceRow` on the forward path.
//   - Slice-replace consumers (Rooms, Pumps) clone `sourceRow`
//     client-side, mint the new row's `name` with the `(copy)` suffix,
//     and dispatch their existing slice-replace mutation.
// The `sourceRow` snapshot also feeds the inverse `rowDelete.row` for
// ⌘Z. `anchorRowId` is almost always equal to `sourceRowId` today, but
// kept separate so a future "duplicate to top / bottom" gesture is
// expressible without a WriteOp shape change.
export type RowDuplicatePayload = {
  rowId: string;
  sourceRowId: string;
  sourceRow: unknown;
  anchorRowId: string | null;
};

export type WriteOp =
  | ({ kind: "cell"; writes: CellWrite[] } & OptionListDelta)
  | ({
      kind: "paste";
      writes: CellWrite[];
      rowsInserted: unknown[];
      newOptions: Record<string, FieldOption[]>;
    } & Pick<OptionListDelta, "removedOptions">)
  | { kind: "fill"; writes: CellWrite[] }
  | { kind: "rowInsert"; rows: RowInsertPayload[] }
  | { kind: "rowDelete"; rows: RowDeletePayload[] }
  | { kind: "rowDuplicate"; rows: RowDuplicatePayload[] }
  // `schemaMutation` carries two sub-shapes. `typed` is the
  // custom-field pipeline that POSTs to `/custom-fields:mutate`;
  // `legacyOptions` is the single-select option editor that still
  // rides the whole-table replace path until plan-16 splits it into
  // its own kind.
  | { kind: "schemaMutation"; variant: "typed"; mutation: FieldSchemaMutation }
  | {
      kind: "schemaMutation";
      variant: "legacyOptions";
      before: FieldDef;
      after: FieldDef;
      // Dependent cell writes ride in the same op so ⌘Z reverts the
      // field-def + cell changes together. Populated when an option
      // delete cascades (Clear / Replace-with).
      cellWrites?: CellWrite[];
    };

export type CellCoord = {
  rowIndex: number;
  columnIndex: number;
};

export type CellRange = {
  anchor: CellCoord;
  focus: CellCoord;
};

// Consumer callback used by Shift+Enter row insert (Phase 2). Receives
// the library-generated tmp rowId and the field-default map (per
// plan-30 D10 always sourced from `FieldDef.default` / natural zero —
// never from anchor values). `anchorRow` is retained for the future
// explicit "Duplicate record" right-click action, which will reuse this
// builder; the Shift-Enter path never reads values from it. Consumers
// that omit this prop disable row insert.
export type BuildEmptyRow<TRow> = (args: {
  rowId: string;
  fieldDefaults: Record<string, unknown>;
  anchorRow: TRow | null;
}) => TRow;

// Per-field linked-record integration surface. The data-table library
// has no knowledge of the target table — the consumer supplies the
// candidate row list (for the picker) and a resolver (for the pill's
// display label). `onPillClick` is the navigation hook (PRD Q19); when
// undefined the pills render but do nothing on click.
export type LinkedRecordCellOps = {
  candidates: ReadonlyArray<LinkedRecordCellCandidate>;
  resolve: (rowId: string) => { recordId: string | null } | null;
  onPillClick?: (rowId: string) => void;
};

export type LinkedRecordCellCandidate = {
  rowId: string;
  recordId: string | null;
  displayName?: string | null;
};

export type DataTableProps<TRow> = {
  rows: TRow[];
  getRowId: (row: TRow) => string;
  fieldDefs: FieldDef[];
  columnDefs: DataTableColumnDef<TRow>[];
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  onWrite?: (op: WriteOp) => void | Promise<void>;
  buildEmptyRow?: BuildEmptyRow<TRow>;
  // Generate a fresh row id for Shift+Enter inserts. Consumers whose
  // backend enforces a specific id prefix (Rooms: ^rm_...) should pass
  // their own; the library default is `tmp_<ulid>`. Whatever id this
  // returns is also the rowId carried in the rowInsert WriteOp.
  generateRowId?: () => string;
  // Opaque string the library uses to decide when to clear the in-
  // memory undo history (PoC L6.3). Consumers should pass a key that
  // changes on session boundaries — e.g. project switch, version
  // switch, sub-tab switch — and stays stable across the consumer's
  // own write/refetch cycles. When omitted, history clears on every
  // `rows` identity change (the Phase 0 default, which is unsafe for
  // consumers whose rows array reidentifies after a successful write).
  sessionKey?: string;
  readOnly?: boolean;
  density?: "compact" | "comfortable";
  emptyMessage: string;
  onRowOpen?: (row: TRow) => void;
  overflowMenuActions?: ReactNode;
  // Consumer-supplied toolbar actions rendered alongside the built-in
  // "Delete N rows" button when at least one row is selected via the
  // gutter checkbox. Receives the live selection set so the consumer
  // can render its own bulk actions (e.g. "Reactivate") conditional on
  // the rows in scope. Selection clears automatically when the rows
  // array identity changes after a successful mutation.
  bulkSelectionActions?: (selectedRowIds: ReadonlySet<string>) => ReactNode;
  // Phase 4 — per-row-menu extension slot. Invoked at menu-open time
  // with the right-clicked row's context; the returned items render
  // after the four built-ins, separated by a single divider.
  // Suppressed in the multi-select-collapse branch (PRD §5 rule 1).
  // The library calls the selector each time the menu opens; consumers
  // do not need to memoize unless item identity matters across opens.
  rowActions?: (ctx: RowActionContext<TRow>) => RowAction[];
  footerAction?: ReactNode;
  // When provided, the toolbar's "Reset view" action invokes this
  // callback instead of the in-DataTable default (which clears
  // filter/sort/group/aggregations/expandedGroups in place). Consumers
  // that own the view state externally use this slot to coordinate
  // their own reset semantics.
  onResetView?: () => void;
  // Consumer owns the schema fingerprint, so it builds and dispatches
  // the `WriteOp.schemaMutation`. Omit to hide the Delete-field menu
  // item.
  onDeleteCustomField?: (fieldKey: string) => Promise<void> | void;
  // When provided, the tail "+" cell becomes a focusable button and
  // the header context menu surfaces `Insert field left/right`. The
  // consumer returns the minted `cf_*` id so DataTable can focus the
  // first cell of the new column after the refetch. A rejected
  // promise leaves the modal open and surfaces the error inline.
  // Omit in viewer mode.
  onAddCustomField?: (request: AddCustomFieldRequest) => Promise<{ newFieldKey: string }>;
  onDuplicateCustomField?: (fieldKey: string) => Promise<{ newFieldKey: string } | void>;
  // The consumer builds the `editFieldBundle` WriteOp from this
  // request because it owns the schema fingerprint. Modal Save calls
  // this and awaits resolution; rejection leaves the modal open with
  // the error surfaced inline.
  onEditCustomFieldBundle?: (request: EditCustomFieldBundleRequest) => Promise<void>;
  // Registry the formula editor uses for ref completion / palette /
  // live preview. When omitted (or empty), the editor cannot resolve
  // `{Display Name}` refs.
  formulaFieldRegistry?: ReadonlyArray<FieldRegistryEntry>;
  // Maps a row to its per-`field_id` value map for the formula
  // editor's focused-row live preview. Each map key is a formula-side
  // `field_id` (core key for core fields, `cf_*` for custom fields).
  getFormulaRowValues?: (row: TRow) => Record<string, unknown>;
  // Per-fieldKey integration surface for `linked_record` columns
  // (PRD §5 Phase 1). The data-table library is target-table agnostic
  // — the consumer supplies candidates + resolver + navigation hook
  // per linked_record FieldDef. Omit (or omit a fieldKey) to render
  // the cell as a read-only pill list with empty resolution.
  linkedRecordOps?: ReadonlyMap<string, LinkedRecordCellOps>;
  // Target-table options for the field config modal's "linked record"
  // target dropdown (PRD Q13). Page-level consumers derive this from
  // the project's `TableContract` manifest (entries with
  // `link_targetable === true`, minus the current table). Omit when
  // the table has no link-target candidates — the modal then gates
  // Save as long as `linked_record` is the selected field type.
  linkedRecordTargets?: ReadonlyArray<LinkedRecordTargetTableOption>;
};

// Request shape for the unified field-config modal Save. The consumer
// turns this into one `editFieldBundle` WriteOp. Only properties the
// user actually changed need to differ from the current FieldDef; the
// consumer is responsible for assembling the full `after:
// CustomFieldDef` it ships to the backend.
export type EditCustomFieldBundleRequest = {
  fieldKey: string;
  displayName: string;
  description: string | null;
  // Set when the user changed the field's type. The consumer rebuilds
  // `after.field_type` and resets `after.config` accordingly.
  fieldType?: CustomFieldType;
  // True when the type change has incompatible rows the user
  // acknowledged in the inline preflight panel.
  acknowledgeDestructive?: boolean;
  // Set by the single-select options section. The consumer sends this
  // as `editFieldBundle.nextOptions`.
  options?: FieldOption[];
  // Set for custom single-selects. `null` means "no default".
  defaultOptionId?: string | null;
  // Stored in CustomFieldDef.config so custom select columns keep the
  // same color-code toggle behavior as the legacy editor.
  colorCodeOptions?: boolean;
  // Set for custom number fields. Stored in CustomFieldDef.config.
  numberPrecision?: number;
  // Set for number fields when optional unit metadata changed. `null`
  // removes units and returns the field to a plain Number.
  numberUnits?: NumberUnitsConfig | null;
  // Set for custom formula fields when the expression changed. The
  // consumer sends it as `editFieldBundle.formulaSource` so the
  // backend reparses/resolves the bundle atomically.
  formulaSource?: string;
  // Set for `linked_record` fields. PRD Q13 — `target_table_path` is
  // immutable on existing linked-record fields; the modal only emits it
  // when the type also changes (initial creation through this bundle
  // path is not currently supported; addField owns creation). `null`
  // for `maxLinks` means multi.
  linkedRecordTargetPath?: string[];
  linkedRecordMaxLinks?: number | null;
};

// Phase 6 §4.6: discriminated union the body renderer walks. A `group`
// entry produces a <GroupHeaderRow> at the given depth; a `data` entry
// produces a regular data <tr>. The plan replaces the raw `tableRows`
// iteration in `GridBody`, interleaving group headers between data rows
// in display order.
export type BodyPlanItem<TRow> =
  | {
      kind: "group";
      depth: number;
      pathKey: string;
      fieldDef: FieldDef;
      groupValue: unknown;
      count: number;
      expanded: boolean;
      aggregatedValues: Map<string, string>;
    }
  | {
      kind: "data";
      row: TRow;
      rowId: string;
      depth: number;
    };

// Phase 7 §4.1: state the fill hook publishes to the body renderer.
// `source` is the active selection's normalized rectangle whenever the
// handle is visible; `targetPreview` is the (group-clamped) target
// rectangle during an active drag (null otherwise). `handleVisible`
// gates the `<FillHandle>` render and the `data-fill-handle="true"`
// attribute on the source's bottom-right cell. The rectangle shape is
// inlined (rather than imported from `lib.ts`) to keep the type module
// free of runtime-side imports.
export type FillRect = {
  rowStart: number;
  rowEnd: number;
  columnStart: number;
  columnEnd: number;
};

export type FillState = {
  source: FillRect | null;
  targetPreview: FillRect | null;
  handleVisible: boolean;
};

export function emptyViewState(): ViewState {
  return {
    filter: [],
    sort: [],
    group: [],
    aggregations: {},
    columnOrder: [],
    columnWidths: {},
    hiddenColumns: [],
    expandedGroups: {},
  };
}
