import { useState, useCallback } from 'react';
import { GridCellData, WindowGridData } from '../components/types';

const createCellId = (row: number, col: number) => `${row}-${col}`;

export const useWindowGrid = () => {
    const [gridData, setGridData] = useState<WindowGridData>({
        rowHeights: [100, 200],
        columnWidths: [100, 200, 100],
        cells: new Map([
            [createCellId(0, 0), { id: createCellId(0, 0), sash: { id: 'a' }, rowSpan: 1, colSpan: 2, row: 0, col: 0 }],
            [createCellId(0, 2), { id: createCellId(0, 2), sash: { id: 'd' }, rowSpan: 2, colSpan: 1, row: 0, col: 2 }],
            [createCellId(1, 0), { id: createCellId(1, 0), sash: { id: 'b' }, rowSpan: 1, colSpan: 1, row: 1, col: 0 }],
            [createCellId(1, 1), { id: createCellId(1, 1), sash: { id: 'c' }, rowSpan: 1, colSpan: 1, row: 1, col: 1 }],
        ]),
    });

    // Helper to check if a cell position is occupied by any cell (including spans)
    const isPositionOccupied = useCallback(
        (row: number, col: number): boolean => {
            for (const cell of gridData.cells.values()) {
                const occupiesRows = row >= cell.row && row < cell.row + cell.rowSpan;
                const occupiesCols = col >= cell.col && col < cell.col + cell.colSpan;
                if (occupiesRows && occupiesCols) {
                    return true;
                }
            }
            return false;
        },
        [gridData.cells]
    );

    const addRow = useCallback(() => {
        setGridData(prev => ({
            ...prev,
            rowHeights: [...prev.rowHeights, 100],
        }));
    }, []);

    const addColumn = useCallback(() => {
        setGridData(prev => ({
            ...prev,
            columnWidths: [...prev.columnWidths, 100],
        }));
    }, []);

    const addSash = useCallback(
        (row: number, col: number) => {
            if (isPositionOccupied(row, col)) return;

            const cellId = createCellId(row, col);

            setGridData(prev => {
                const newCells = new Map(prev.cells);
                newCells.set(cellId, {
                    id: cellId,
                    sash: { id: `sash-${Date.now()}` },
                    rowSpan: 1,
                    colSpan: 1,
                    row,
                    col,
                });

                return {
                    ...prev,
                    cells: newCells,
                };
            });
        },
        [isPositionOccupied]
    );

    const getCellSize = useCallback(
        (row: number, col: number, rowSpan: number, colSpan: number) => {
            const width = gridData.columnWidths.slice(col, col + colSpan).reduce((sum, w) => sum + w, 0);
            const height = gridData.rowHeights.slice(row, row + rowSpan).reduce((sum, h) => sum + h, 0);
            return { width, height };
        },
        [gridData.columnWidths, gridData.rowHeights]
    );

    return {
        gridData,
        isPositionOccupied,
        addRow,
        addColumn,
        addSash,
        getCellSize,
    };
};
