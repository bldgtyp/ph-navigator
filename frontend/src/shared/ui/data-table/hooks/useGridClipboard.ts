import { useCallback } from "react";
import { parseTsv, rangeToHtml, rangeToTsv } from "../lib/paste/tsv";
import { coercePasteWrites, planPaste } from "../lib/paste/plan";
import type {
  CellRange,
  CellWrite,
  DataTableColumnDef,
  FieldDef,
  FieldOption,
  WriteOp,
} from "../types";
import type { DispatchWrite } from "./useGridWriteReducer";

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
}): GridClipboard {
  const { range, rows, columns, fieldDefs, getRowId, onWrite, dispatchWrite, onAnnounce } = args;

  const copy = useCallback(() => {
    void copySelection(rows, columns, fieldDefs, range);
  }, [columns, fieldDefs, range, rows]);

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
      });
    },
    [columns, dispatchWrite, fieldDefs, getRowId, onAnnounce, onWrite, range, rows],
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
) {
  const tsv = rangeToTsv(rows, columns, fieldDefs, range);
  const html = rangeToHtml(rows, columns, fieldDefs, range);
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
}) {
  const { tsv, range, rows, columns, fieldDefs, getRowId, onWrite, dispatchWrite, onAnnounce } =
    args;
  if (!onWrite) {
    onAnnounce("Paste is not enabled for this table yet.");
    return;
  }
  if (!tsv) return;
  const plan = planPaste({
    clipboard: parseTsv(tsv),
    target: range,
    rowCount: rows.length,
    columnCount: columns.length,
  });
  if (plan.rowsOverflow) {
    onAnnounce(`Clipboard has ${plan.rowsOverflow} more rows. Add rows before paste.`);
    return;
  }
  if (plan.columnsOverflow) {
    onAnnounce(`Clipboard has ${plan.columnsOverflow} more columns. Extra columns dropped.`);
    return;
  }
  const coerced = coercePasteWrites({
    plannedWrites: plan.writes,
    rows,
    columns,
    fieldDefs,
    getRowId,
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
  const inverseWrites = buildPasteInverse(coerced.writes, rows, columns, getRowId);
  const op: WriteOp = {
    kind: "paste",
    writes: coerced.writes,
    rowsInserted: [],
    newOptions: coerced.newOptions,
  };
  const removedOptions = optionsToRemoveOnInverse(coerced.newOptions);
  const inverse: WriteOp = {
    kind: "cell",
    writes: inverseWrites,
    ...(removedOptions ? { removedOptions } : {}),
  };
  try {
    await dispatchWrite(op, inverse);
    onAnnounce(`${plan.writes.length} cells pasted.`);
  } catch (error) {
    onAnnounce(error instanceof Error ? error.message : "Paste failed.");
  }
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
