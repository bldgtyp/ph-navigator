import { useState, useCallback } from 'react';
import { GridCellData, WindowGridData } from '../components/types';

const createCellId = (row: number, col: number) => `${row}-${col}`;

export const useWindowGrid = () => {
    const [selectedCells, setSelectedCells] = useState<string[]>([]);
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

    // ----------------------------------------------------------------------------------
    // Grid Sizing
    const updateColumnWidth = useCallback(
        (index: number, newWidth: number) => {
            if (index < 0 || index >= gridData.columnWidths.length) return;

            setGridData(prev => ({
                ...prev,
                columnWidths: prev.columnWidths.map((width, i) => (i === index ? newWidth : width)),
            }));
        },
        [gridData.columnWidths]
    );

    const updateRowHeight = useCallback(
        (index: number, newHeight: number) => {
            if (index < 0 || index >= gridData.rowHeights.length) return;

            setGridData(prev => ({
                ...prev,
                rowHeights: prev.rowHeights.map((height, i) => (i === index ? newHeight : height)),
            }));
        },
        [gridData.rowHeights]
    );

    // ----------------------------------------------------------------------------------
    // Cell Selection
    const toggleCellSelection = useCallback(
        (cellId: string) => {
            setSelectedCells(prev => {
                if (prev.includes(cellId)) {
                    // Deselect if already selected
                    return prev.filter(id => id !== cellId);
                } else {
                    // Only allow selecting adjacent cells (cells that share an edge)
                    if (prev.length === 0) {
                        // First selection is always valid
                        return [cellId];
                    }

                    // Check if this cell is adjacent to any selected cell
                    const cell = gridData.cells.get(cellId);
                    if (!cell) return prev;

                    // Check adjacency with any selected cell
                    for (const selectedId of prev) {
                        const selectedCell = gridData.cells.get(selectedId);
                        if (!selectedCell) continue;

                        // Check if cells are adjacent (share an edge)
                        const isAdjacent =
                            // Horizontally adjacent
                            (cell.row === selectedCell.row &&
                                (Math.abs(cell.col - selectedCell.col) === 1 ||
                                    Math.abs(cell.col + cell.colSpan - selectedCell.col) === 0 ||
                                    Math.abs(cell.col - (selectedCell.col + selectedCell.colSpan)) === 0)) ||
                            // Vertically adjacent
                            (cell.col === selectedCell.col &&
                                (Math.abs(cell.row - selectedCell.row) === 1 ||
                                    Math.abs(cell.row + cell.rowSpan - selectedCell.row) === 0 ||
                                    Math.abs(cell.row - (selectedCell.row + selectedCell.rowSpan)) === 0));

                        if (isAdjacent) {
                            return [...prev, cellId];
                        }
                    }

                    // If we get here, the cell isn't adjacent to any selected cell
                    return prev;
                }
            });
        },
        [gridData.cells]
    );

    const clearSelection = useCallback(() => {
        setSelectedCells([]);
    }, []);

    // ----------------------------------------------------------------------------------
    // Merging Cells Together
    const mergeSelectedCells = useCallback(() => {
        if (selectedCells.length <= 1) {
            return; // Need at least 2 cells to merge
        }

        // Calculate the boundaries of the merged cell
        let minRow = Infinity;
        let minCol = Infinity;
        let maxRow = -1;
        let maxCol = -1;

        // Find the boundaries of all selected cells
        for (const cellId of selectedCells) {
            const cell = gridData.cells.get(cellId);
            if (!cell) continue;

            minRow = Math.min(minRow, cell.row);
            minCol = Math.min(minCol, cell.col);
            maxRow = Math.max(maxRow, cell.row + cell.rowSpan - 1);
            maxCol = Math.max(maxCol, cell.col + cell.colSpan - 1);
        }

        // Check if the selection forms a rectangle (no gaps)
        // This requires checking that all cells in the rectangular region are selected
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                const cellAtPos = Array.from(gridData.cells.values()).find(
                    cell => c >= cell.col && c < cell.col + cell.colSpan && r >= cell.row && r < cell.row + cell.rowSpan
                );

                if (!cellAtPos || !selectedCells.includes(cellAtPos.id)) {
                    alert('Can only merge cells that form a complete rectangle');
                    return;
                }
            }
        }

        // Calculate dimensions of new merged cell
        const rowSpan = maxRow - minRow + 1;
        const colSpan = maxCol - minCol + 1;
        const newCellId = createCellId(minRow, minCol);

        // Create new cell data
        const newCell: GridCellData = {
            id: newCellId,
            row: minRow,
            col: minCol,
            rowSpan,
            colSpan,
            sash: { id: `merged-${Date.now()}` }, // You might want to keep one of the existing sashes
        };

        // Update grid data
        setGridData(prev => {
            const newCells = new Map(prev.cells);

            // Remove all selected cells
            for (const cellId of selectedCells) {
                newCells.delete(cellId);
            }

            // Add the new merged cell
            newCells.set(newCellId, newCell);

            return {
                ...prev,
                cells: newCells,
            };
        });

        // Clear selection after merging
        clearSelection();
    }, [gridData.cells, selectedCells, clearSelection]);

    return {
        gridData,
        isPositionOccupied,
        addRow,
        addColumn,
        addSash,
        getCellSize,
        updateColumnWidth,
        updateRowHeight,
        selectedCells,
        toggleCellSelection,
        clearSelection,
        mergeSelectedCells,
    };
};
