import type {
  BodyPlanItem,
  CellCoord,
  CellRange,
  CellWrite,
  DataTableColumnDef,
  FieldDef,
  FieldOption,
  FieldType,
  FilterCondition,
  FilterOperator,
  GroupRule,
  SortRule,
  ViewState,
} from "./types";
import { generatedId } from "../../lib/ids";
import { evaluateFilter, getFilterOperators, isFilterContributing } from "./fields/filterOperators";
import { formatAggregation, type AggregationKind } from "./fields/aggregations";

export type NormalizedRange = {
  rowStart: number;
  rowEnd: number;
  columnStart: number;
  columnEnd: number;
};

export function normalizeRange(range: CellRange): NormalizedRange {
  return {
    rowStart: Math.min(range.anchor.rowIndex, range.focus.rowIndex),
    rowEnd: Math.max(range.anchor.rowIndex, range.focus.rowIndex),
    columnStart: Math.min(range.anchor.columnIndex, range.focus.columnIndex),
    columnEnd: Math.max(range.anchor.columnIndex, range.focus.columnIndex),
  };
}

export function isCellInRange(cell: CellCoord, range: CellRange | null): boolean {
  if (!range) return false;
  return isCellInNormalizedRange(cell, normalizeRange(range));
}

export function isCellInNormalizedRange(cell: CellCoord, normalized: NormalizedRange): boolean {
  return (
    cell.rowIndex >= normalized.rowStart &&
    cell.rowIndex <= normalized.rowEnd &&
    cell.columnIndex >= normalized.columnStart &&
    cell.columnIndex <= normalized.columnEnd
  );
}

export type EdgeBits = {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
};

// Phase 3 §4.10: edge bits drive the perimeter-outline rendering. Cells
// in the interior of an N×M range have all four bits false; only cells
// on the relevant edge get the corresponding bit. The body composes a
// single `box-shadow` inline style from these bits so the outline draws
// as one contiguous rectangle without interior gridlines (PoC L3.2).
export function computeEdgeBits(
  rowIndex: number,
  columnIndex: number,
  range: NormalizedRange,
): EdgeBits {
  const inside =
    rowIndex >= range.rowStart &&
    rowIndex <= range.rowEnd &&
    columnIndex >= range.columnStart &&
    columnIndex <= range.columnEnd;
  if (!inside) return { top: false, right: false, bottom: false, left: false };
  return {
    top: rowIndex === range.rowStart,
    right: columnIndex === range.columnEnd,
    bottom: rowIndex === range.rowEnd,
    left: columnIndex === range.columnStart,
  };
}

export function moveActiveCell(
  active: CellCoord,
  key: string,
  rowCount: number,
  columnCount: number,
): CellCoord {
  if (rowCount === 0 || columnCount === 0) return active;
  if (key === "ArrowUp")
    return nextCell(active, Math.max(0, active.rowIndex - 1), active.columnIndex);
  if (key === "ArrowDown")
    return nextCell(active, Math.min(rowCount - 1, active.rowIndex + 1), active.columnIndex);
  if (key === "ArrowLeft")
    return nextCell(active, active.rowIndex, Math.max(0, active.columnIndex - 1));
  if (key === "ArrowRight") {
    return nextCell(active, active.rowIndex, Math.min(columnCount - 1, active.columnIndex + 1));
  }
  if (key === "Home") return nextCell(active, active.rowIndex, 0);
  if (key === "End") return nextCell(active, active.rowIndex, columnCount - 1);
  return active;
}

function nextCell(active: CellCoord, rowIndex: number, columnIndex: number): CellCoord {
  return rowIndex === active.rowIndex && columnIndex === active.columnIndex
    ? active
    : { rowIndex, columnIndex };
}

export function clampCellCoord(cell: CellCoord, rowCount: number, columnCount: number): CellCoord {
  if (rowCount === 0 || columnCount === 0) return { rowIndex: 0, columnIndex: 0 };
  const next = {
    rowIndex: Math.min(Math.max(cell.rowIndex, 0), rowCount - 1),
    columnIndex: Math.min(Math.max(cell.columnIndex, 0), columnCount - 1),
  };
  return next.rowIndex === cell.rowIndex && next.columnIndex === cell.columnIndex ? cell : next;
}

export function clampRange(range: CellRange, rowCount: number, columnCount: number): CellRange {
  return {
    anchor: clampCellCoord(range.anchor, rowCount, columnCount),
    focus: clampCellCoord(range.focus, rowCount, columnCount),
  };
}

export function rangeToTsv<TRow>(
  rows: TRow[],
  columns: DataTableColumnDef<TRow>[],
  fieldDefs: FieldDef[],
  range: CellRange,
): string {
  const normalized = normalizeRange(range);
  const fieldDefsByKey = fieldKeyFieldDefMap(fieldDefs);
  const lines: string[] = [];
  for (let rowIndex = normalized.rowStart; rowIndex <= normalized.rowEnd; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row) continue;
    const values: string[] = [];
    for (
      let columnIndex = normalized.columnStart;
      columnIndex <= normalized.columnEnd;
      columnIndex += 1
    ) {
      values.push(
        formatClipboardCellValue(
          columns[columnIndex]?.accessor(row),
          fieldDefForColumn(columns[columnIndex], fieldDefsByKey),
        ),
      );
    }
    lines.push(values.join("\t"));
  }
  return lines.join("\n");
}

export function rangeToHtml<TRow>(
  rows: TRow[],
  columns: DataTableColumnDef<TRow>[],
  fieldDefs: FieldDef[],
  range: CellRange,
): string {
  const normalized = normalizeRange(range);
  const fieldDefsByKey = fieldKeyFieldDefMap(fieldDefs);
  const body = rows
    .slice(normalized.rowStart, normalized.rowEnd + 1)
    .map((row) => {
      const cells = columns
        .slice(normalized.columnStart, normalized.columnEnd + 1)
        .map(
          (column) =>
            `<td>${escapeHtml(formatClipboardCellValue(column.accessor(row), fieldDefForColumn(column, fieldDefsByKey)))}</td>`,
        )
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<table>${body}</table>`;
}

export function parseTsv(raw: string): string[][] {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n$/, "")
    .split("\n")
    .map((line) => line.split("\t"));
}

export function planPaste({
  clipboard,
  target,
  rowCount,
  columnCount,
}: {
  clipboard: string[][];
  target: CellRange;
  rowCount: number;
  columnCount: number;
}) {
  const normalized = normalizeRange(target);
  const targetRows = normalized.rowEnd - normalized.rowStart + 1;
  const targetColumns = normalized.columnEnd - normalized.columnStart + 1;
  const sourceRows = clipboard.length;
  const sourceColumns = Math.max(0, ...clipboard.map((row) => row.length));
  const fillTarget =
    sourceRows === 1 && sourceColumns === 1 && (targetRows > 1 || targetColumns > 1);
  const plannedRows = fillTarget ? targetRows : sourceRows;
  const plannedColumns = fillTarget ? targetColumns : sourceColumns;

  return {
    writes: Array.from({ length: Math.min(plannedRows, rowCount - normalized.rowStart) }).flatMap(
      (_, rowOffset) =>
        Array.from({ length: Math.min(plannedColumns, columnCount - normalized.columnStart) }).map(
          (_, columnOffset) => ({
            rowIndex: normalized.rowStart + rowOffset,
            columnIndex: normalized.columnStart + columnOffset,
            raw: clipboard[fillTarget ? 0 : rowOffset]?.[fillTarget ? 0 : columnOffset] ?? "",
          }),
        ),
    ),
    rowsOverflow: Math.max(0, normalized.rowStart + plannedRows - rowCount),
    columnsOverflow: Math.max(0, normalized.columnStart + plannedColumns - columnCount),
  };
}

// Route every condition through the field-type registry's
// `evaluateFilter` — operator semantics live in
// `fields/filterOperators.ts`. Dormant rules (blank value / unparsable
// number / empty option list) pass everything per L8.4. Conditions
// whose field is unknown, whose field exposes no operators, or whose
// value slots aren't yet contributing are pre-filtered outside the row
// loop, so when no rule is actually narrowing we return `rows` by
// identity (preserves downstream memo identity on `filteredRows`).
export function applyFilters<TRow>(
  rows: TRow[],
  columns: DataTableColumnDef<TRow>[],
  fieldDefs: FieldDef[],
  filters: FilterCondition[],
): TRow[] {
  if (filters.length === 0) return rows;
  const columnsByFieldKey = fieldKeyColumnMap(columns);
  const fieldDefsByKey = fieldKeyFieldDefMap(fieldDefs);
  const activeRules: {
    filter: FilterCondition;
    column: DataTableColumnDef<TRow>;
    fieldDef: FieldDef;
  }[] = [];
  for (const filter of filters) {
    if (!filter.fieldKey) continue;
    const column = columnsByFieldKey.get(filter.fieldKey);
    if (!column) continue;
    const fieldDef = fieldDefsByKey.get(filter.fieldKey);
    if (!fieldDef) continue;
    if (getFilterOperators(fieldDef).length === 0) continue;
    if (!isFilterContributing(filter)) continue;
    activeRules.push({ filter, column, fieldDef });
  }
  if (activeRules.length === 0) return rows;
  return rows.filter((row) =>
    activeRules.every(({ filter, column, fieldDef }) =>
      evaluateFilter(filter, column.accessor(row), fieldDef),
    ),
  );
}

// Phase 4 §4.4: pick the first operator the registry exposes for a
// field. Used by the FilterPopover when adding a new rule and when the
// user changes a rule's field to one that doesn't support the rule's
// current operator. Returns null when the field has no operators
// (attachment / argb_color); the popover skips such fields.
export function defaultOperatorForField(fieldDef: FieldDef | undefined): FilterOperator | null {
  const operators = getFilterOperators(fieldDef);
  return operators[0]?.operator ?? null;
}

export function sortRows<TRow>(
  rows: TRow[],
  columns: DataTableColumnDef<TRow>[],
  fieldDefs: FieldDef[],
  sortRules: SortRule[],
): TRow[] {
  if (sortRules.length === 0) return rows;
  const columnsByFieldKey = fieldKeyColumnMap(columns);
  const fieldDefsByKey = fieldKeyFieldDefMap(fieldDefs);
  const sorted = [...rows];
  sorted.sort((left, right) => {
    for (const rule of sortRules) {
      const column = columnsByFieldKey.get(rule.fieldKey);
      if (!column) continue;
      const fieldDef = fieldDefForColumn(column, fieldDefsByKey);
      const result =
        fieldDef?.field_type === "single_select"
          ? compareSingleSelectValues(column.accessor(left), column.accessor(right), fieldDef)
          : formatClipboardValue(column.accessor(left)).localeCompare(
              formatClipboardValue(column.accessor(right)),
              undefined,
              {
                numeric: true,
                sensitivity: "base",
              },
            );
      if (result !== 0) return rule.direction === "asc" ? result : -result;
    }
    return 0;
  });
  return sorted;
}

export type CoercePasteResult =
  | {
      ok: true;
      writes: CellWrite[];
      newOptions: Record<string, FieldOption[]>;
    }
  | {
      ok: false;
      errors: { rowIndex: number; columnIndex: number; raw: string; message: string }[];
    };

export function coercePasteWrites<TRow>({
  plannedWrites,
  rows,
  columns,
  fieldDefs,
  getRowId,
}: {
  plannedWrites: { rowIndex: number; columnIndex: number; raw: string }[];
  rows: TRow[];
  columns: DataTableColumnDef<TRow>[];
  fieldDefs: FieldDef[];
  getRowId: (row: TRow) => string;
}): CoercePasteResult {
  const errors: { rowIndex: number; columnIndex: number; raw: string; message: string }[] = [];
  const writes: CellWrite[] = [];
  const optionsByField = new Map(
    fieldDefs.map((fieldDef) => [fieldDef.field_key, [...(fieldDef.options ?? [])]]),
  );
  const fieldDefsByKey = fieldKeyFieldDefMap(fieldDefs);
  const newOptions: Record<string, FieldOption[]> = {};

  for (const plannedWrite of plannedWrites) {
    const row = rows[plannedWrite.rowIndex];
    const column = columns[plannedWrite.columnIndex];
    if (!row || !column) continue;
    const fieldDef = fieldDefForColumn(column, fieldDefsByKey);
    if (fieldDef?.read_only) {
      errors.push({ ...plannedWrite, message: "Field is read-only." });
      continue;
    }
    const coerced = coerceFieldValue(plannedWrite.raw, fieldDef, () => {
      const options = optionsByField.get(column.fieldKey) ?? [];
      optionsByField.set(column.fieldKey, options);
      return options;
    });
    if (!coerced.ok) {
      errors.push({ ...plannedWrite, message: coerced.message });
      continue;
    }
    writes.push({ rowId: getRowId(row), fieldKey: column.fieldKey, value: coerced.value });
    if (coerced.created) {
      newOptions[column.fieldKey] = [...(newOptions[column.fieldKey] ?? []), coerced.created];
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, writes, newOptions };
}

export function formatClipboardValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export function formatClipboardCellValue(value: unknown, fieldDef: FieldDef | undefined): string {
  if (fieldDef?.field_type !== "single_select") return formatClipboardValue(value);
  if (value === null || value === undefined || value === "") return "";
  const option = fieldDef.options?.find((candidate) => candidate.id === value);
  return option?.label ?? "";
}

export function formatDisplayCellValue(value: unknown, fieldDef: FieldDef | undefined): string {
  if (fieldDef?.field_type !== "single_select") return formatClipboardValue(value);
  if (value === null || value === undefined || value === "") return "";
  const option = singleSelectOption(value, fieldDef);
  return option?.label ?? "Missing option";
}

export function singleSelectOption(
  value: unknown,
  fieldDef: FieldDef | undefined,
): FieldOption | undefined {
  if (fieldDef?.field_type !== "single_select" || typeof value !== "string") return undefined;
  return fieldDef.options?.find((candidate) => candidate.id === value);
}

export function coerceFieldValue(
  raw: string,
  fieldDef: FieldDef | undefined,
  optionsForField: () => FieldOption[],
  { emptyNumberValue = null }: { emptyNumberValue?: number | null } = {},
): { ok: true; value: unknown; created?: FieldOption } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (fieldDef?.field_type === "number") {
    if (!trimmed) return { ok: true, value: emptyNumberValue };
    const value = Number(trimmed);
    return Number.isFinite(value)
      ? { ok: true, value }
      : { ok: false, message: "Expected a number." };
  }
  if (fieldDef?.field_type === "single_select") {
    if (!trimmed) return { ok: true, value: null };
    const options = optionsForField();
    const existing = findFieldOptionByLabel(options, trimmed);
    if (existing) return { ok: true, value: existing.id };
    const created = createFieldOption(trimmed, options);
    options.push(created);
    return { ok: true, value: created.id, created };
  }
  return { ok: true, value: raw };
}

function compareSingleSelectValues(left: unknown, right: unknown, fieldDef: FieldDef): number {
  const leftRank = optionSortRank(left, fieldDef);
  const rightRank = optionSortRank(right, fieldDef);
  if (leftRank !== rightRank) return leftRank - rightRank;
  return formatClipboardCellValue(left, fieldDef).localeCompare(
    formatClipboardCellValue(right, fieldDef),
    undefined,
    {
      numeric: true,
      sensitivity: "base",
    },
  );
}

function optionSortRank(value: unknown, fieldDef: FieldDef): number {
  if (value === null || value === undefined || value === "") return Number.POSITIVE_INFINITY;
  const option = singleSelectOption(value, fieldDef);
  // Missing option ids sort before explicit blanks so corrupt refs stay visible.
  return option?.order ?? Number.MAX_SAFE_INTEGER;
}

function fieldDefForColumn<TRow>(
  column: DataTableColumnDef<TRow> | undefined,
  fieldDefsByKey: Map<string, FieldDef>,
): FieldDef | undefined {
  if (!column) return undefined;
  return fieldDefsByKey.get(column.fieldKey);
}

function fieldKeyFieldDefMap(fieldDefs: FieldDef[]): Map<string, FieldDef> {
  return new Map(fieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef]));
}

// Build a fieldKey-keyed map of values cloned from the anchor row. Reads
// through column accessors so consumers stay in control of how each
// fieldKey maps to a row property. Missing column → `FieldDef.default`
// → field-type natural zero. Used by the Shift+Enter row insert flow
// (Phase 2 §4.5).
export function extractRowDefaults<TRow>(
  row: TRow,
  fieldDefs: FieldDef[],
  columns: DataTableColumnDef<TRow>[],
): Record<string, unknown> {
  const accessorByFieldKey = new Map(columns.map((column) => [column.fieldKey, column.accessor]));
  return Object.fromEntries(
    fieldDefs.map((fieldDef) => {
      const accessor = accessorByFieldKey.get(fieldDef.field_key);
      if (accessor) return [fieldDef.field_key, accessor(row)];
      if (fieldDef.default !== undefined) return [fieldDef.field_key, fieldDef.default];
      return [fieldDef.field_key, naturalZero(fieldDef.field_type)];
    }),
  );
}

// Fallback path used when there is no anchor row (currently unreachable
// through Shift+Enter because the empty-state branch short-circuits the
// grid, but kept as a forward-compat slot for future "insert at top"
// affordances).
export function buildEmptyRowDefaults(fieldDefs: FieldDef[]): Record<string, unknown> {
  return Object.fromEntries(
    fieldDefs.map((fieldDef) => [
      fieldDef.field_key,
      fieldDef.default !== undefined ? fieldDef.default : naturalZero(fieldDef.field_type),
    ]),
  );
}

export function naturalZero(fieldType: FieldType): unknown {
  if (fieldType === "text") return "";
  if (fieldType === "number") return 0;
  return null;
}

export function findFieldOptionByLabel(
  options: FieldOption[],
  rawLabel: string,
): FieldOption | undefined {
  const label = normalizeOptionLabel(rawLabel);
  return options.find((option) => normalizeOptionLabel(option.label) === label);
}

export function hasDuplicateFieldOptionLabels(options: FieldOption[]): boolean {
  const labels = new Set<string>();
  for (const option of options) {
    const label = normalizeOptionLabel(option.label);
    if (!label) continue;
    if (labels.has(label)) return true;
    labels.add(label);
  }
  return false;
}

export const OPTION_COLOR_PALETTE: readonly string[] = [
  "#3b82f6",
  "#10b981",
  "#a16207",
  "#7c3aed",
  "#0f766e",
  "#be123c",
] as const;

export function createFieldOption(rawLabel: string, existingOptions: FieldOption[]): FieldOption {
  return {
    id: generatedId("opt"),
    label: rawLabel.trim(),
    color: nextOptionColor(existingOptions.length),
    order: nextOptionOrder(existingOptions),
  };
}

// Counts how many rows reference each option id, read through the
// supplied accessor. The accessor makes this row-shape-agnostic so any
// DataTable consumer can reuse it without knowing the row type.
export function optionReferenceCounts<TRow>(
  rows: readonly TRow[],
  accessor: (row: TRow) => unknown,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const value = accessor(row);
    if (typeof value !== "string" || !value) continue;
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

// Returns the option ids referenced by ≥1 row that are NOT present in
// the supplied options list. Used by the FieldEditorPopover to surface
// a "N rows reference unknown options" warning.
export function missingOptionReferences<TRow>(
  rows: readonly TRow[],
  options: readonly FieldOption[],
  accessor: (row: TRow) => unknown,
): string[] {
  const validIds = new Set(options.map((option) => option.id));
  const missing = new Set<string>();
  for (const row of rows) {
    const value = accessor(row);
    if (typeof value !== "string" || !value) continue;
    if (!validIds.has(value)) missing.add(value);
  }
  return [...missing];
}

// Reindexes options' `order` to 0..N-1 in current array order and trims
// their labels. Used after every drag-reorder save to keep the order
// ints contiguous.
export function normalizeOptionOrders(options: readonly FieldOption[]): FieldOption[] {
  return options.map((option, index) => ({
    ...option,
    label: option.label.trim(),
    order: index,
  }));
}

function normalizeOptionLabel(label: string): string {
  return label.trim().toLocaleLowerCase();
}

function nextOptionColor(index: number): string {
  return OPTION_COLOR_PALETTE[index % OPTION_COLOR_PALETTE.length] ?? "#6b7280";
}

function nextOptionOrder(options: FieldOption[]): number {
  return options.length ? Math.max(...options.map((option) => option.order)) + 1 : 0;
}

function fieldKeyColumnMap<TRow>(
  columns: DataTableColumnDef<TRow>[],
): Map<string, DataTableColumnDef<TRow>> {
  return new Map(columns.map((column) => [column.fieldKey, column]));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Phase 6 §4.5: derived sort prepended with group rules. The user's
// `view.sort` is preserved as-is in user intent; only the derived list
// dedups against `view.group` so a field doesn't appear twice in the
// effective comparator (L8.3). The group's direction wins when a field
// is in both lists.
export function effectiveSortFromView(view: Pick<ViewState, "group" | "sort">): SortRule[] {
  if (view.group.length === 0) return view.sort;
  const groupSort: SortRule[] = view.group.map((rule) => ({
    fieldKey: rule.fieldKey,
    direction: rule.direction,
  }));
  const groupKeys = new Set(groupSort.map((rule) => rule.fieldKey));
  const userSort = view.sort.filter((rule) => !groupKeys.has(rule.fieldKey));
  return [...groupSort, ...userSort];
}

// Phase 6 §4.6: stable string key the body plan uses for
// `expandedGroups` lookups. JSON-stringifying each path segment keeps
// keys stable across re-renders without needing a row id. The keys
// ride only in client state — they never reach the backend.
export function groupPathKey(values: readonly unknown[]): string {
  return values.map((value) => JSON.stringify(value ?? null)).join("::");
}

// Phase 6 §4.10: drop expandedGroups entries whose path depth exceeds
// the new group depth. Called whenever `view.group` changes so the map
// doesn't accumulate stale deep-path keys. Same-or-shorter paths stay —
// re-grouping by a different field at the same depth keeps the old
// state in place (acceptable; clears on Reset).
export function pruneExpandedGroups(
  map: Record<string, boolean>,
  nextGroup: readonly GroupRule[],
): Record<string, boolean> {
  const maxDepth = nextGroup.length;
  if (maxDepth === 0) return {};
  const next: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(map)) {
    // Path depth = number of `::`-separated segments. JSON.stringify
    // never emits `::` for any primitive, so split-count is safe.
    const depth = key.split("::").length;
    if (depth <= maxDepth) next[key] = value;
  }
  return next;
}

// Phase 6 §4.6: build the interleaved group-header + data-row plan.
// `rows` is assumed already pre-sorted via `effectiveSortFromView` so
// rows sharing a path arrive contiguously. One pass: when the current
// row's path diverges from the previous at depth N, emit a group
// header at every depth from N down to view.group.length - 1, then
// emit the data row (unless any ancestor is collapsed).
//
// Aggregated values per group path are precomputed via
// `computeAggregatesByPath` so chevron toggles (which only change
// `expandedGroups`) can re-run only this cheap interleaving pass.
export function buildBodyPlan<TRow>(
  rows: readonly TRow[],
  columns: readonly DataTableColumnDef<TRow>[],
  fieldDefs: readonly FieldDef[],
  getRowId: (row: TRow) => string,
  view: Pick<ViewState, "group" | "expandedGroups" | "aggregations">,
): BodyPlanItem<TRow>[] {
  if (view.group.length === 0) {
    return rows.map((row) => ({
      kind: "data",
      row,
      rowId: getRowId(row),
      depth: 0,
    }));
  }
  const fieldDefByKey = new Map(fieldDefs.map((f) => [f.field_key, f]));
  const columnByKey = new Map(columns.map((c) => [c.fieldKey, c]));
  const groupFieldDefs: FieldDef[] = [];
  const groupAccessors: ((row: TRow) => unknown)[] = [];
  for (const rule of view.group) {
    const fieldDef = fieldDefByKey.get(rule.fieldKey);
    const column = columnByKey.get(rule.fieldKey);
    if (!fieldDef || !column) {
      // Group rule references a field that isn't in the table; fall
      // back to a flat plan rather than crash. Phase 6 doesn't surface
      // this as an error — the toolbar field picker prevents it.
      return rows.map((row) => ({
        kind: "data",
        row,
        rowId: getRowId(row),
        depth: 0,
      }));
    }
    groupFieldDefs.push(fieldDef);
    groupAccessors.push(column.accessor);
  }

  const aggregatesByPath = computeAggregatesByPath(rows, columns, fieldDefs, view, groupAccessors);

  const plan: BodyPlanItem<TRow>[] = [];
  let prevPath: unknown[] = [];
  let isFirstRow = true;
  for (const row of rows) {
    const path = groupAccessors.map((accessor) => accessor(row));
    const divergeAt = isFirstRow ? 0 : firstDivergeIndex(prevPath, path);
    isFirstRow = false;
    if (divergeAt < view.group.length) {
      // Skip emission entirely when any ancestor above the divergence
      // is already collapsed — descendant headers belong inside that
      // closed group and must stay hidden until it expands.
      let ancestorCollapsed = false;
      for (let depth = 0; depth < divergeAt; depth += 1) {
        const ancestorKey = groupPathKey(path.slice(0, depth + 1));
        if (view.expandedGroups[ancestorKey] === false) {
          ancestorCollapsed = true;
          break;
        }
      }
      if (!ancestorCollapsed) {
        for (let depth = divergeAt; depth < view.group.length; depth += 1) {
          const subPath = path.slice(0, depth + 1);
          const pathKey = groupPathKey(subPath);
          const expanded = view.expandedGroups[pathKey] ?? true;
          const agg = aggregatesByPath.get(pathKey);
          plan.push({
            kind: "group",
            depth,
            pathKey,
            fieldDef: groupFieldDefs[depth]!,
            groupValue: path[depth],
            count: agg?.count ?? 0,
            expanded,
            aggregatedValues: agg?.values ?? new Map(),
          });
          // Stop emitting deeper headers under a collapsed parent so
          // a closed group hides both its data rows AND its child
          // group headers (acceptance criterion 6).
          if (!expanded) break;
        }
      }
    }
    prevPath = path;
    if (!isPathFullyExpanded(view.expandedGroups, path)) continue;
    plan.push({
      kind: "data",
      row,
      rowId: getRowId(row),
      depth: view.group.length,
    });
  }
  return plan;
}

// Walk `rows` once, accumulating per-path row counts and per-column
// raw values for fields with a non-`none` aggregation kind in
// `view.aggregations`. At the end, format each value list via the
// registry's `formatAggregation`. Aggregates at a given depth cover
// all descendant data rows — including those under collapsed inner
// groups (parent §16: no per-level-only toggle).
export function computeAggregatesByPath<TRow>(
  rows: readonly TRow[],
  columns: readonly DataTableColumnDef<TRow>[],
  fieldDefs: readonly FieldDef[],
  view: Pick<ViewState, "group" | "aggregations">,
  groupAccessors: readonly ((row: TRow) => unknown)[],
): Map<string, { count: number; values: Map<string, string> }> {
  const fieldDefByKey = new Map(fieldDefs.map((f) => [f.field_key, f]));
  // Pre-resolve column accessors for fields with an active aggregation
  // so the per-row loop stays O(rows × aggregated columns).
  const aggregated: { fieldKey: string; kind: AggregationKind; accessor: (row: TRow) => unknown }[] =
    [];
  for (const [fieldKey, kind] of Object.entries(view.aggregations)) {
    if (kind === "none") continue;
    const column = columns.find((c) => c.fieldKey === fieldKey);
    if (!column) continue;
    aggregated.push({ fieldKey, kind, accessor: column.accessor });
  }

  // Per path: count + map of fieldKey → array of raw values.
  type PathAcc = { count: number; valueLists: Map<string, unknown[]> };
  const acc = new Map<string, PathAcc>();
  const ensure = (pathKey: string): PathAcc => {
    let entry = acc.get(pathKey);
    if (!entry) {
      entry = { count: 0, valueLists: new Map() };
      acc.set(pathKey, entry);
    }
    return entry;
  };

  for (const row of rows) {
    const path = groupAccessors.map((accessor) => accessor(row));
    for (let depth = 0; depth < view.group.length; depth += 1) {
      const pathKey = groupPathKey(path.slice(0, depth + 1));
      const entry = ensure(pathKey);
      entry.count += 1;
      for (const { fieldKey, accessor } of aggregated) {
        let list = entry.valueLists.get(fieldKey);
        if (!list) {
          list = [];
          entry.valueLists.set(fieldKey, list);
        }
        list.push(accessor(row));
      }
    }
  }

  // Format each value list via the registry. Doing this once at the
  // end keeps the per-row loop free of string-formatting work.
  const result = new Map<string, { count: number; values: Map<string, string> }>();
  for (const [pathKey, entry] of acc) {
    const values = new Map<string, string>();
    for (const { fieldKey, kind } of aggregated) {
      const list = entry.valueLists.get(fieldKey) ?? [];
      values.set(fieldKey, formatAggregation(kind, list, fieldDefByKey.get(fieldKey)));
    }
    result.set(pathKey, { count: entry.count, values });
  }
  return result;
}

// Returns the index where `prev` and `next` first diverge. If one is a
// prefix of the other, returns the shorter length.
export function firstDivergeIndex(prev: readonly unknown[], next: readonly unknown[]): number {
  const len = Math.min(prev.length, next.length);
  for (let i = 0; i < len; i += 1) {
    if (!shallowEqualValue(prev[i], next[i])) return i;
  }
  return len;
}

function shallowEqualValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  // Group keys are primitive cell values (string ids, numbers,
  // strings). JSON-stringify equality covers the rare object case
  // without forcing a deep-equal dependency.
  return JSON.stringify(a) === JSON.stringify(b);
}

function isPathFullyExpanded(
  expandedGroups: Readonly<Record<string, boolean>>,
  path: readonly unknown[],
): boolean {
  // Every ancestor (depths 0..path.length-1) must be expanded for a
  // data row at this path to render. Default expanded when a path
  // hasn't been touched.
  for (let depth = 0; depth < path.length; depth += 1) {
    const key = groupPathKey(path.slice(0, depth + 1));
    if (expandedGroups[key] === false) return false;
  }
  return true;
}
