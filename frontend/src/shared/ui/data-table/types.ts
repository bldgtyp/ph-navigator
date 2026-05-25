import type { ReactNode } from "react";
import type { AddCustomFieldRequest } from "./components/AddFieldPopover";
import type { EditCustomFieldDescriptionRequest } from "./components/EditFieldDescriptionPopover";
import type { AggregationKind } from "./fields/aggregations";
import type { FieldSchemaMutation } from "./lib/customFieldMutations";
import type { FieldRegistryEntry } from "./lib/formula/resolver";

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
  | "argb_color";

// Closed v1 set, mirrored from backend `CustomFieldType`.
export type CustomFieldType =
  | "short_text"
  | "long_text"
  | "number"
  | "url"
  | "single_select"
  | "formula";

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
  // Set only for custom (non-`read_only_schema`) fields. Drives the
  // field-config modal's type picker.
  custom_field_type?: CustomFieldType;
  // Phase 4: for `field_type === "computed"`, declare the underlying
  // value type so the filter-operator registry knows which catalogue to
  // expose. Defaults to "text" when omitted (preserves Phase 0–3
  // behaviour for existing computed columns).
  computed_type?: "text" | "number";
  // When false, single_select pills render with a neutral background
  // even when each option still carries a color. Default true.
  colorCodeOptions?: boolean;
  // Plan-13 §4.5 / US-CF-6: when true, header context-menu hides
  // schema-mutation items (rename / change type / delete / edit
  // formula). Core fields set this to true; user-defined custom fields
  // leave it absent. The flag ships in plan-14 P1.4 so the schema is
  // consistent; the menu component that consumes it lands in Phase 2.
  read_only_schema?: boolean;
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
};

export type FieldOption = {
  id: string;
  label: string;
  color: string;
  order: number;
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
// the library-generated tmp rowId, the field-default map (cloned from
// the anchor row when present, otherwise from `FieldDef.default`), and
// the anchor row itself so the consumer can copy non-grid fields
// directly. Consumers that omit this prop disable row insert.
export type BuildEmptyRow<TRow> = (args: {
  rowId: string;
  fieldDefaults: Record<string, unknown>;
  anchorRow: TRow | null;
}) => TRow;

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
  // promise leaves the popover open and surfaces the error inline.
  // Omit in viewer mode.
  onAddCustomField?: (request: AddCustomFieldRequest) => Promise<{ newFieldKey: string }>;
  onRenameCustomField?: (request: RenameCustomFieldRequest) => Promise<void>;
  onDuplicateCustomField?: (fieldKey: string) => Promise<{ newFieldKey: string } | void>;
  onSetCustomFieldDescription?: (request: EditCustomFieldDescriptionRequest) => Promise<void>;
  // plan-21 P5a.1: the consumer builds the `editFieldBundle` WriteOp
  // from this request (it knows the schema fingerprint). Modal Save
  // calls this and awaits resolution; rejection leaves the modal open
  // with the error surfaced inline. P5a.1 ships name + description
  // only; later sub-phases extend the request shape with type-change,
  // options/default, and formula source.
  onEditCustomFieldBundle?: (request: EditCustomFieldBundleRequest) => Promise<void>;
  // Commit the new formula `source` for a custom formula field.
  // Backend re-parses + resolves + cycle-checks. Omit to hide the
  // `Edit formula…` menu item entirely.
  onEditCustomFieldFormula?: (request: EditCustomFieldFormulaRequest) => Promise<void>;
  // Registry the formula editor uses for ref completion / palette /
  // live preview. When omitted (or empty), the editor cannot resolve
  // `{Display Name}` refs, so the `Edit formula…` menu item is
  // suppressed.
  formulaFieldRegistry?: ReadonlyArray<FieldRegistryEntry>;
  // Maps a row to its per-`field_id` value map for the formula
  // editor's focused-row live preview. Each map key is a formula-side
  // `field_id` (core key for core fields, `cf_*` for custom fields).
  getFormulaRowValues?: (row: TRow) => Record<string, unknown>;
};

export type EditCustomFieldFormulaRequest = {
  fieldKey: string;
  source: string;
};

export type RenameCustomFieldRequest = {
  fieldKey: string;
  displayName: string;
};

// plan-21 P5a.1 request shape for the unified field-config modal Save.
// The consumer turns this into one `editFieldBundle` WriteOp. Only
// properties the user actually changed need to differ from the current
// FieldDef; the consumer is responsible for assembling the full
// `after: CustomFieldDef` it ships to the backend.
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
