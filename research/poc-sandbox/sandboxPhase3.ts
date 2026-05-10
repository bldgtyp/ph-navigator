export type CellCoord = { rowIndex: number; colIndex: number };

export type SelectionRange = { anchor: CellCoord; head: CellCoord } | null;

export type SelectionBounds = {
    topRow: number;
    bottomRow: number;
    leftCol: number;
    rightCol: number;
};

export type CellWrite = {
    rowIndex: number;
    colId: string;
    before: unknown;
    after: unknown;
};

export type FieldOptionWrite = {
    fieldKey: string;
    before: unknown;
    after: unknown;
};

export type EditOpKind = 'cell' | 'paste' | 'fill';

export type EditOp = {
    kind: EditOpKind;
    writes: CellWrite[];
    appendedRows: number;
    fieldOptionWrites?: FieldOptionWrite[];
    summary: string;
};

export type EditHistory = {
    undo: EditOp[];
    redo: EditOp[];
};

export type PastePlan = {
    anchor: CellCoord;
    width: number;
    height: number;
    overflowRows: number;
    clippedColumnCount: number;
};

export const HISTORY_LIMIT = 8;

export const normalizeSelection = (selection: SelectionRange): SelectionBounds | null => {
    if (!selection) return null;
    return {
        topRow: Math.min(selection.anchor.rowIndex, selection.head.rowIndex),
        bottomRow: Math.max(selection.anchor.rowIndex, selection.head.rowIndex),
        leftCol: Math.min(selection.anchor.colIndex, selection.head.colIndex),
        rightCol: Math.max(selection.anchor.colIndex, selection.head.colIndex),
    };
};

export const parseTsv = (input: string): string[][] => {
    const text = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n$/, '');
    if (text === '') return [['']];
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const next = text[i + 1];
        if (char === '"') {
            if (inQuotes && next === '"') {
                cell += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (char === '\t' && !inQuotes) {
            row.push(cell);
            cell = '';
            continue;
        }
        if (char === '\n' && !inQuotes) {
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
            continue;
        }
        cell += char;
    }

    row.push(cell);
    rows.push(row);
    return rows;
};

export const getPastePlan = ({
    selection,
    clipboard,
    rowCount,
    columnCount,
}: {
    selection: SelectionBounds;
    clipboard: string[][];
    rowCount: number;
    columnCount: number;
}): PastePlan => {
    const clipboardHeight = clipboard.length;
    const clipboardWidth = Math.max(...clipboard.map(row => row.length), 0);
    const selectionHeight = selection.bottomRow - selection.topRow + 1;
    const selectionWidth = selection.rightCol - selection.leftCol + 1;
    const singleClipboardCell = clipboardHeight === 1 && clipboardWidth === 1;
    const singleSelectionCell = selectionHeight === 1 && selectionWidth === 1;
    const sameShape = clipboardHeight === selectionHeight && clipboardWidth === selectionWidth;

    let height = clipboardHeight;
    let width = clipboardWidth;
    if (singleClipboardCell && (selectionHeight > 1 || selectionWidth > 1)) {
        height = selectionHeight;
        width = selectionWidth;
    } else if (!singleSelectionCell && sameShape) {
        height = selectionHeight;
        width = selectionWidth;
    }

    const anchor = { rowIndex: selection.topRow, colIndex: selection.leftCol };
    const usableWidth = Math.max(0, Math.min(width, columnCount - anchor.colIndex));
    const overflowRows = Math.max(0, anchor.rowIndex + height - rowCount);

    return {
        anchor,
        width: usableWidth,
        height,
        overflowRows,
        clippedColumnCount: Math.max(0, width - usableWidth),
    };
};

export const getClipboardValue = ({
    clipboard,
    rowOffset,
    colOffset,
    selection,
}: {
    clipboard: string[][];
    rowOffset: number;
    colOffset: number;
    selection: SelectionBounds;
}): string => {
    const clipboardHeight = clipboard.length;
    const clipboardWidth = Math.max(...clipboard.map(row => row.length), 0);
    const selectionHeight = selection.bottomRow - selection.topRow + 1;
    const selectionWidth = selection.rightCol - selection.leftCol + 1;
    const singleClipboardCell = clipboardHeight === 1 && clipboardWidth === 1;
    const singleSelectionCell = selectionHeight === 1 && selectionWidth === 1;
    const sameShape = clipboardHeight === selectionHeight && clipboardWidth === selectionWidth;

    if (singleClipboardCell && (selectionHeight > 1 || selectionWidth > 1)) {
        return clipboard[0]?.[0] ?? '';
    }
    if (singleSelectionCell || sameShape) {
        return clipboard[rowOffset]?.[colOffset] ?? '';
    }
    return clipboard[rowOffset]?.[colOffset] ?? '';
};

export const pushHistory = (history: EditHistory, op: EditOp): EditHistory => ({
    undo: [...history.undo, op].slice(-HISTORY_LIMIT),
    redo: [],
});

export const popUndo = (history: EditHistory): { op: EditOp | null; history: EditHistory } => {
    if (history.undo.length === 0) return { op: null, history };
    const op = history.undo[history.undo.length - 1];
    return {
        op,
        history: {
            undo: history.undo.slice(0, -1),
            redo: [...history.redo, op].slice(-HISTORY_LIMIT),
        },
    };
};

export const popRedo = (history: EditHistory): { op: EditOp | null; history: EditHistory } => {
    if (history.redo.length === 0) return { op: null, history };
    const op = history.redo[history.redo.length - 1];
    return {
        op,
        history: {
            undo: [...history.undo, op].slice(-HISTORY_LIMIT),
            redo: history.redo.slice(0, -1),
        },
    };
};
