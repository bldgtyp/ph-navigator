import { useCallback } from "react";
import type { UnitSystem } from "../../../../lib/units";
import { parseTsv, rangeToHtml, rangeToTsv } from "../lib/paste/tsv";
import { coercePasteWrites, planPaste } from "../lib/paste/plan";
import { planEmptyRows } from "../lib/rows/defaults";
import type {
  BuildEmptyRow,
  CellRange,
  CellWrite,
  DataTableColumnDef,
  FieldDef,
  FieldOption,
  RowDeletePayload,
  RowInsertPayload,
  WriteOp,
} from "../types";
import type { DispatchWrite } from "./useGridWriteReducer";

type StableCellAddr = { rowId: string; fieldKey: string };
export type CopiedCellRange = { anchor: StableCellAddr; focus: StableCellAddr };
export type PasteRowsOverflowDecision = "add-rows" | "truncate" | "cancel";

// Clipboard wiring — copy and paste — routed through dispatchWrite so
// paste lands as one semantic undo entry (PoC L6.1, L6.2). Read uses
// readText() rather than the native paste event because the surrounding
// `<div role="grid">` is the focus target, not an editable element.
export type GridClipboard = {
  copy: () => void;
  // Paste from a pre-read TSV string. Use this from the native onPaste
  // event (clipboardData.getData) — no permission prompt, no flaky read.
  pasteText: (tsv: string) => Promise<void>;
  // Fallback that reads via navigator.clipboard.readText(). Wired to
  // the ⌘V keydown path for tests and as a last-resort.
  pasteFromClipboard: () => Promise<void>;
};

export function useGridClipboard<TRow>(args: {
  range: CellRange;
  rows: TRow[];
  columns: DataTableColumnDef<TRow>[];
  fieldDefs: FieldDef[];
  getRowId: (row: TRow) => string;
  onWrite?: (op: WriteOp) => void | Promise<void>;
  dispatchWrite: DispatchWrite;
  onAnnounce: (message: string) => void;
  onCopyRange?: (range: CopiedCellRange) => void;
  onPasteComplete?: (writes: CellWrite[]) => void;
  onPasteRowsOverflow?: (rowsOverflow: number) => Promise<PasteRowsOverflowDecision>;
  buildEmptyRow?: BuildEmptyRow<TRow>;
  generateRowId?: () => string;
  unitSystem?: UnitSystem;
}): GridClipboard {
  const {
    range,
    rows,
    columns,
    fieldDefs,
    getRowId,
    onWrite,
    dispatchWrite,
    onAnnounce,
    onCopyRange,
    onPasteComplete,
    onPasteRowsOverflow,
    buildEmptyRow,
    generateRowId,
    unitSystem = "SI",
  } = args;

  const copy = useCallback(() => {
    void copySelection(rows, columns, fieldDefs, range, unitSystem);
    const copiedRange = rangeToStableRange(rows, columns, range, getRowId);
    if (copiedRange) onCopyRange?.(copiedRange);
  }, [columns, fieldDefs, getRowId, onCopyRange, range, rows, unitSystem]);

  const pasteText = useCallback(
    async (tsv: string) => {
      await pasteIntoSelection({
        tsv,
        range,
        rows,
        columns,
        fieldDefs,
        getRowId,
        onWrite,
        dispatchWrite,
        onAnnounce,
        onPasteComplete,
        onPasteRowsOverflow,
        buildEmptyRow,
        generateRowId,
        unitSystem,
      });
    },
    [
      columns,
      dispatchWrite,
      fieldDefs,
      getRowId,
      onAnnounce,
      onPasteComplete,
      onWrite,
      onPasteRowsOverflow,
      buildEmptyRow,
      generateRowId,
      range,
      rows,
      unitSystem,
    ],
  );

  const pasteFromClipboard = useCallback(async () => {
    if (!onWrite) {
      onAnnounce("Paste is not enabled for this table yet.");
      return;
    }
    const tsv = await navigator.clipboard?.readText();
    if (!tsv) return;
    await pasteText(tsv);
  }, [onAnnounce, onWrite, pasteText]);

  return { copy, pasteText, pasteFromClipboard };
}

async function copySelection<TRow>(
  rows: TRow[],
  columns: DataTableColumnDef<TRow>[],
  fieldDefs: FieldDef[],
  range: CellRange,
  unitSystem: UnitSystem,
) {
  const tsv = rangeToTsv(rows, columns, fieldDefs, range, unitSystem);
  const html = rangeToHtml(rows, columns, fieldDefs, range, unitSystem);
  if ("ClipboardItem" in window && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/plain": new Blob([tsv], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      }),
    ]);
    return;
  }
  await navigator.clipboard?.writeText(tsv);
}

async function pasteIntoSelection<TRow>(args: {
  tsv: string;
  range: CellRange;
  rows: TRow[];
  columns: DataTableColumnDef<TRow>[];
  fieldDefs: FieldDef[];
  getRowId: (row: TRow) => string;
  onWrite?: (op: WriteOp) => void | Promise<void>;
  dispatchWrite: DispatchWrite;
  onAnnounce: (message: string) => void;
  onPasteComplete?: (writes: CellWrite[]) => void;
  onPasteRowsOverflow?: (rowsOverflow: number) => Promise<PasteRowsOverflowDecision>;
  buildEmptyRow?: BuildEmptyRow<TRow>;
  generateRowId?: () => string;
  unitSystem: UnitSystem;
}) {
  const {
    tsv,
    range,
    rows,
    columns,
    fieldDefs,
    getRowId,
    onWrite,
    dispatchWrite,
    onAnnounce,
    onPasteComplete,
    onPasteRowsOverflow,
    buildEmptyRow,
    generateRowId,
    unitSystem,
  } = args;
  if (!onWrite) {
    onAnnounce("Paste is not enabled for this table yet.");
    return;
  }
  if (!tsv) return;
  const clipboard = parseTsv(tsv);
  let plan = planPaste({
    clipboard,
    target: range,
    rowCount: rows.length,
    columnCount: columns.length,
  });
  let rowsForCoercion = rows;
  let rowsInserted: RowInsertPayload[] = [];
  let insertedRowIds = new Set<string>();
  if (plan.rowsOverflow) {
    const decision = await onPasteRowsOverflow?.(plan.rowsOverflow);
    if (!decision || decision === "cancel") {
      onAnnounce("Paste canceled.");
      return;
    }
    if (decision === "add-rows") {
      if (!buildEmptyRow) {
        onAnnounce("Row insert is not enabled for this table.");
        return;
      }
      const growth = planEmptyRows({
        count: plan.rowsOverflow,
        fieldDefs,
        buildEmptyRow,
        generateRowId,
      });
      rowsForCoercion = [...rows, ...growth.rows];
      rowsInserted = growth.inserts;
      insertedRowIds = new Set(rowsInserted.map((row) => row.rowId));
      plan = planPaste({
        clipboard,
        target: range,
        rowCount: rowsForCoercion.length,
        columnCount: columns.length,
      });
    }
  }
  if (plan.columnsOverflow) {
    onAnnounce(`Clipboard has ${plan.columnsOverflow} more columns. Extra columns dropped.`);
    return;
  }
  const coerced = coercePasteWrites({
    plannedWrites: plan.writes,
    rows: rowsForCoercion,
    columns,
    fieldDefs,
    getRowId,
    unitSystem,
  });
  if (!coerced.ok) {
    const first = coerced.errors[0];
    onAnnounce(
      first
        ? `Paste blocked at row ${first.rowIndex + 1}, column ${first.columnIndex + 1}: ${first.message}`
        : "Paste blocked.",
    );
    return;
  }
  const { existingWrites, insertedFieldDefaultsByRowId } = splitPasteWrites(
    coerced.writes,
    insertedRowIds,
  );
  if (rowsInserted.length > 0) {
    rowsInserted = rowsInserted.map((row) => ({
      ...row,
      fieldDefaults: {
        ...row.fieldDefaults,
        ...(insertedFieldDefaultsByRowId.get(row.rowId) ?? {}),
      },
    }));
  }
  const insertedDeletes = buildInsertedRowDeletes(rowsInserted, rowsForCoercion, getRowId);
  const inverseWrites = buildPasteInverse(existingWrites, rows, columns, getRowId);
  const op: WriteOp = {
    kind: "paste",
    writes: existingWrites,
    rowsInserted,
    newOptions: coerced.newOptions,
  };
  const removedOptions = optionsToRemoveOnInverse(coerced.newOptions);
  const inverse: WriteOp = {
    kind: "paste",
    writes: inverseWrites,
    rowsInserted: [],
    ...(insertedDeletes.length > 0 ? { rowsDeleted: insertedDeletes } : {}),
    newOptions: {},
    ...(removedOptions ? { removedOptions } : {}),
  };
  try {
    await dispatchWrite(op, inverse);
    onPasteComplete?.(existingWrites);
    const rowMessage =
      rowsInserted.length > 0
        ? ` ${rowsInserted.length} ${rowsInserted.length === 1 ? "row" : "rows"} added.`
        : "";
    onAnnounce(`${coerced.writes.length} cells pasted.${rowMessage}`);
  } catch (error) {
    onAnnounce(error instanceof Error ? error.message : "Paste failed.");
  }
}

function splitPasteWrites(
  writes: CellWrite[],
  insertedRowIds: ReadonlySet<string>,
): {
  existingWrites: CellWrite[];
  insertedFieldDefaultsByRowId: Map<string, Record<string, unknown>>;
} {
  const existingWrites: CellWrite[] = [];
  const insertedFieldDefaultsByRowId = new Map<string, Record<string, unknown>>();
  for (const write of writes) {
    if (!insertedRowIds.has(write.rowId)) {
      existingWrites.push(write);
      continue;
    }
    const defaults = insertedFieldDefaultsByRowId.get(write.rowId) ?? {};
    defaults[write.fieldKey] = write.value;
    insertedFieldDefaultsByRowId.set(write.rowId, defaults);
  }
  return { existingWrites, insertedFieldDefaultsByRowId };
}

function buildInsertedRowDeletes<TRow>(
  inserts: RowInsertPayload[],
  rowsForCoercion: TRow[],
  getRowId: (row: TRow) => string,
): RowDeletePayload[] {
  const rowById = new Map(rowsForCoercion.map((row) => [getRowId(row), row]));
  return inserts.map((insert) => ({
    rowId: insert.rowId,
    row: rowById.get(insert.rowId) ?? null,
    anchorRowId: insert.anchorRowId,
  }));
}

function rangeToStableRange<TRow>(
  rows: TRow[],
  columns: DataTableColumnDef<TRow>[],
  range: CellRange,
  getRowId: (row: TRow) => string,
): CopiedCellRange | null {
  const anchorRow = rows[range.anchor.rowIndex];
  const focusRow = rows[range.focus.rowIndex];
  const anchorColumn = columns[range.anchor.columnIndex];
  const focusColumn = columns[range.focus.columnIndex];
  if (!anchorRow || !focusRow || !anchorColumn || !focusColumn) return null;
  return {
    anchor: { rowId: getRowId(anchorRow), fieldKey: anchorColumn.fieldKey },
    focus: { rowId: getRowId(focusRow), fieldKey: focusColumn.fieldKey },
  };
}

function optionsToRemoveOnInverse(
  newOptions: Record<string, FieldOption[]>,
): Record<string, string[]> | null {
  const removed: Record<string, string[]> = {};
  let any = false;
  for (const [fieldKey, options] of Object.entries(newOptions)) {
    if (!options.length) continue;
    removed[fieldKey] = options.map((option) => option.id);
    any = true;
  }
  return any ? removed : null;
}

function buildPasteInverse<TRow>(
  writes: CellWrite[],
  rows: TRow[],
  columns: DataTableColumnDef<TRow>[],
  getRowId: (row: TRow) => string,
): CellWrite[] {
  const rowById = new Map(rows.map((row) => [getRowId(row), row]));
  const accessorByFieldKey = new Map(columns.map((column) => [column.fieldKey, column.accessor]));
  return writes.map((write) => {
    const row = rowById.get(write.rowId);
    const accessor = accessorByFieldKey.get(write.fieldKey);
    const previous = row && accessor ? accessor(row) : null;
    return { rowId: write.rowId, fieldKey: write.fieldKey, value: previous };
  });
}
