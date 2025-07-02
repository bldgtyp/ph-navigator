import { useState, useCallback } from 'react';

import { useApertures } from '../ApertureView/Aperture.Context';
import { patchWithAlert } from '../../../../../../../api/patchWithAlert';

import { ApertureType, GridCellData, WindowGridData, defaultAperture } from '../types';

const createCellId = (row: number, col: number) => `${row}-${col}`;

export const useWindowGrid = () => {
    const { activeAperture, setIsLoadingApertures, handleSetActiveAperture, handleUpdateAperture } = useApertures();
    const [selectedCells, setSelectedCells] = useState<number[]>([]);

    // const getCellSize = useCallback(
    //     (row: number, col: number, rowSpan: number, colSpan: number) => {
    //         if (!activeAperture) return { width: 0, height: 0 };
    //         const width = activeAperture?.column_widths_mm.slice(col, col + colSpan).reduce((sum, w) => sum + w, 0);
    //         const height = activeAperture?.row_heights_mm.slice(row, row + rowSpan).reduce((sum, h) => sum + h, 0);
    //         return { width, height };
    //     },
    //     [activeAperture]
    // );

    // // ----------------------------------------------------------------------------------
    // // Grid Sizing
    // const updateColumnWidth = useCallback(
    //     (index: number, newWidth: number) => {
    //         // if (index < 0 || index >= gridData.columnWidths.length) return;
    //         // setGridData(prev => ({
    //         //     ...prev,
    //         //     columnWidths: prev.columnWidths.map((width, i) => (i === index ? newWidth : width)),
    //         // }));
    //     },
    //     []
    //     // [selectedAperture?.column_widths_mm]
    // );

    // const updateRowHeight = useCallback(
    //     (index: number, newHeight: number) => {
    //         // if (index < 0 || index >= selectedAperture.row_heights_mm.length) return;
    //         // setGridData(prev => ({
    //         //     ...prev,
    //         //     rowHeights: prev.rowHeights.map((height, i) => (i === index ? newHeight : height)),
    //         // }));
    //     },
    //     []
    //     // [selectedAperture?.row_heights_mm]
    // );

    // ----------------------------------------------------------------------------------
    // Cell Selection
    // const toggleCellSelection = useCallback(
    //     (elementId: number) => {
    //         setSelectedCells(prev => {
    //             if (prev.includes(elementId)) {
    //                 // Deselect if already selected
    //                 return prev.filter(id => id !== elementId);
    //             } else {
    //                 // Only allow selecting adjacent cells (cells that share an edge)
    //                 if (prev.length === 0) {
    //                     // First selection is always valid
    //                     return [elementId];
    //                 }

    //                 // Check if this cell is adjacent to any selected cell
    //                 const cell = gridData.cells.get(elementId);
    //                 if (!cell) return prev;

    //                 // Check adjacency with any selected cell
    //                 for (const selectedId of prev) {
    //                     const selectedCell = gridData.cells.get(selectedId);
    //                     if (!selectedCell) continue;

    //                     // Check if cells are adjacent (share an edge)
    //                     const isAdjacent =
    //                         // Horizontally adjacent
    //                         (cell.row === selectedCell.row &&
    //                             (Math.abs(cell.col - selectedCell.col) === 1 ||
    //                                 Math.abs(cell.col + cell.colSpan - selectedCell.col) === 0 ||
    //                                 Math.abs(cell.col - (selectedCell.col + selectedCell.colSpan)) === 0)) ||
    //                         // Vertically adjacent
    //                         (cell.col === selectedCell.col &&
    //                             (Math.abs(cell.row - selectedCell.row) === 1 ||
    //                                 Math.abs(cell.row + cell.rowSpan - selectedCell.row) === 0 ||
    //                                 Math.abs(cell.row - (selectedCell.row + selectedCell.rowSpan)) === 0));

    //                     if (isAdjacent) {
    //                         return [...prev, elementId];
    //                     }
    //                 }

    //                 // If we get here, the cell isn't adjacent to any selected cell
    //                 return prev;
    //             }
    //         });
    //     },
    //     [gridData.cells]
    // );

    // const clearSelection = useCallback(() => {
    //     setSelectedCells([]);
    // }, []);

    // ----------------------------------------------------------------------------------
    // Merging Cells Together
    // const mergeSelectedCells = useCallback(() => {
    //     if (selectedCells.length <= 1) {
    //         return; // Need at least 2 cells to merge
    //     }

    //     // Calculate the boundaries of the merged cell
    //     let minRow = Infinity;
    //     let minCol = Infinity;
    //     let maxRow = -1;
    //     let maxCol = -1;

    //     // Find the boundaries of all selected cells
    //     for (const cellId of selectedCells) {
    //         const cell = gridData.cells.get(cellId);
    //         if (!cell) continue;

    //         minRow = Math.min(minRow, cell.row);
    //         minCol = Math.min(minCol, cell.col);
    //         maxRow = Math.max(maxRow, cell.row + cell.rowSpan - 1);
    //         maxCol = Math.max(maxCol, cell.col + cell.colSpan - 1);
    //     }

    //     // Check if the selection forms a rectangle (no gaps)
    //     // This requires checking that all cells in the rectangular region are selected
    //     for (let r = minRow; r <= maxRow; r++) {
    //         for (let c = minCol; c <= maxCol; c++) {
    //             const cellAtPos = Array.from(gridData.cells.values()).find(
    //                 cell => c >= cell.col && c < cell.col + cell.colSpan && r >= cell.row && r < cell.row + cell.rowSpan
    //             );

    //             if (!cellAtPos || !selectedCells.includes(cellAtPos.id)) {
    //                 alert('Can only merge cells that form a complete rectangle');
    //                 return;
    //             }
    //         }
    //     }

    //     // Calculate dimensions of new merged cell
    //     const rowSpan = maxRow - minRow + 1;
    //     const colSpan = maxCol - minCol + 1;
    //     const newCellId = createCellId(minRow, minCol);

    //     // Create new cell data
    //     const newCell: GridCellData = {
    //         id: newCellId,
    //         row: minRow,
    //         col: minCol,
    //         rowSpan,
    //         colSpan,
    //         sash: { id: `merged-${Date.now()}` }, // You might want to keep one of the existing sashes
    //     };

    //     // Update grid data
    //     setGridData(prev => {
    //         const newCells = new Map(prev.cells);

    //         // Remove all selected cells
    //         for (const cellId of selectedCells) {
    //             newCells.delete(cellId);
    //         }

    //         // Add the new merged cell
    //         newCells.set(newCellId, newCell);

    //         return {
    //             ...prev,
    //             cells: newCells,
    //         };
    //     });

    //     // Clear selection after merging
    //     clearSelection();
    // }, [gridData.cells, selectedCells, clearSelection]);

    return {
        // getCellSize,
        // updateColumnWidth,
        // updateRowHeight,
        selectedCells,
    };
};
