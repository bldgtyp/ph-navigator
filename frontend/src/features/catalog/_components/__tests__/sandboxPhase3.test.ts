import {
    HISTORY_LIMIT,
    getPastePlan,
    normalizeSelection,
    parseTsv,
    popRedo,
    popUndo,
    pushHistory,
} from '../sandboxPhase3';

describe('sandboxPhase3 helpers', () => {
    it('parses quoted TSV with trailing newline', () => {
        expect(parseTsv('a\t"b\nc"\r\n1\t2\r\n')).toEqual([
            ['a', 'b\nc'],
            ['1', '2'],
        ]);
    });

    it('normalizes selection bounds', () => {
        expect(
            normalizeSelection({
                anchor: { rowIndex: 5, colIndex: 3 },
                head: { rowIndex: 2, colIndex: 1 },
            })
        ).toEqual({ topRow: 2, bottomRow: 5, leftCol: 1, rightCol: 3 });
    });

    it('expands single-cell clipboard across a multi-cell selection', () => {
        const plan = getPastePlan({
            selection: { topRow: 10, bottomRow: 14, leftCol: 2, rightCol: 3 },
            clipboard: [['x']],
            rowCount: 20,
            columnCount: 8,
        });
        expect(plan).toMatchObject({ anchor: { rowIndex: 10, colIndex: 2 }, height: 5, width: 2, overflowRows: 0 });
    });

    it('reports overflow and column clipping', () => {
        const plan = getPastePlan({
            selection: { topRow: 18, bottomRow: 18, leftCol: 6, rightCol: 6 },
            clipboard: [
                ['1', '2', '3'],
                ['4', '5', '6'],
                ['7', '8', '9'],
            ],
            rowCount: 20,
            columnCount: 8,
        });
        expect(plan).toMatchObject({ height: 3, width: 2, overflowRows: 1, clippedColumnCount: 1 });
    });

    it('maintains bounded undo/redo history', () => {
        let history = { undo: [], redo: [] as any[] };
        for (let i = 0; i < HISTORY_LIMIT + 1; i += 1) {
            history = pushHistory(history, { kind: 'cell', writes: [], appendedRows: 0, summary: `op-${i}` });
        }
        expect(history.undo).toHaveLength(HISTORY_LIMIT);
        expect(history.undo[0].summary).toBe('op-1');

        const undone = popUndo(history);
        expect(undone.op?.summary).toBe(`op-${HISTORY_LIMIT}`);
        expect(undone.history.redo).toHaveLength(1);

        const redone = popRedo(undone.history);
        expect(redone.op?.summary).toBe(`op-${HISTORY_LIMIT}`);
        expect(redone.history.undo).toHaveLength(HISTORY_LIMIT);
    });
});
