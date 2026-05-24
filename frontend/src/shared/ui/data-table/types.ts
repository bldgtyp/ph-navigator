import type { ReactNode } from "react";
import type { AggregationKind } from "./fields/aggregations";

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
  // Phase 4: for `field_type === "computed"`, declare the underlying
  // value type so the filter-operator registry knows which catalogue to
  // expose. Defaults to "text" when omitted (preserves Phase 0–3
  // behaviour for existing computed columns).
  computed_type?: "text" | "number";
  // When false, single_select pills render with a neutral background
  // even when each option still carries a color. Default true.
  colorCodeOptions?: boolean;
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
  width?: number;
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
  aggregations: Record<string, AggregationKind>;
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
  | {
      kind: "fieldDefMutation";
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
