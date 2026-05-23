import type { ReactNode } from "react";

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

export type FilterCondition = {
  fieldKey: string;
  operator: "contains" | "is" | "is_empty";
  value?: string;
};

export type GroupRule = {
  fieldKey: string;
  direction: "asc" | "desc";
};

export type ViewState = {
  filter: FilterCondition[];
  sort: SortRule[];
  group: GroupRule[];
  aggregations: Record<string, "none" | "count" | "sum" | "mean" | "min" | "max">;
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

export type WriteOp =
  | ({ kind: "cell"; writes: CellWrite[] } & OptionListDelta)
  | ({
      kind: "paste";
      writes: CellWrite[];
      rowsInserted: unknown[];
      newOptions: Record<string, FieldOption[]>;
    } & Pick<OptionListDelta, "removedOptions">)
  | { kind: "fill"; writes: CellWrite[] }
  | { kind: "rowInsert"; rows: unknown[] }
  | { kind: "rowDelete"; rows: unknown[] }
  | { kind: "fieldDefMutation"; before: FieldDef; after: FieldDef };

export type CellCoord = {
  rowIndex: number;
  columnIndex: number;
};

export type CellRange = {
  anchor: CellCoord;
  focus: CellCoord;
};

export type DataTableProps<TRow> = {
  rows: TRow[];
  getRowId: (row: TRow) => string;
  fieldDefs: FieldDef[];
  columnDefs: DataTableColumnDef<TRow>[];
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  onWrite?: (op: WriteOp) => void | Promise<void>;
  renderHeaderActions?: (field: FieldDef) => ReactNode;
  readOnly?: boolean;
  density?: "compact" | "comfortable";
  emptyMessage: string;
  onRowOpen?: (row: TRow) => void;
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
