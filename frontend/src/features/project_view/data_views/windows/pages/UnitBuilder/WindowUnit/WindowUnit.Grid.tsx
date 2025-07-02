import React from 'react';
import { Box } from '@mui/material';
import GridCell from './GridCell';
import GridLines from './GridLines';
import DimensionLabels from './DimensionLabels';
import { WindowGridData } from '../types';

interface WindowGridProps {
    gridData: WindowGridData;
    isPositionOccupied: (row: number, col: number) => boolean;
    addSash: (row: number, col: number) => void;
    getCellSize: (row: number, col: number, rowSpan: number, colSpan: number) => { width: number; height: number };
    updateColumnWidth: (index: number, value: number) => void;
    updateRowHeight: (index: number, value: number) => void;
    selectedCells: string[];
    toggleCellSelection: (cellId: string) => void;
}

const WindowUnitGrid: React.FC<WindowGridProps> = ({
    gridData,
    isPositionOccupied,
    addSash,
    getCellSize,
    updateColumnWidth,
    updateRowHeight,
    selectedCells,
    toggleCellSelection,
}) => {
    // Calculate total grid dimensions for the container
    const totalWidth = gridData.columnWidths.reduce((sum, width) => sum + width, 0);
    const totalHeight = gridData.rowHeights.reduce((sum, height) => sum + height, 0);

    return (
        <Box
            className="window-grid-outer-container"
            sx={{
                position: 'relative',
                pl: 6,
                pb: 6,
                pt: 1,
                pr: 1,
                mt: 4,
            }}
        >
            <Box
                className="window-cells-container"
                sx={{
                    position: 'relative',
                    width: `${totalWidth}px`,
                    height: `${totalHeight}px`,
                    border: '1px solid #ccc',
                }}
            >
                {/* Main grid with cells */}
                <Box
                    className="window-cells"
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: gridData.columnWidths.map(w => `${w}px`).join(' '),
                        gridTemplateRows: gridData.rowHeights.map(h => `${h}px`).join(' '),
                        gap: 0,
                        position: 'relative',
                        zIndex: 1,
                        width: '100%',
                        height: '100%',
                    }}
                >
                    {Array.from(gridData.cells.values()).map(cell => {
                        const { width, height } = getCellSize(cell.row, cell.col, cell.rowSpan, cell.colSpan);
                        return (
                            <GridCell
                                key={cell.id}
                                cell={cell}
                                width={width}
                                height={height}
                                isSelected={selectedCells.includes(cell.id)}
                                onToggleSelect={toggleCellSelection}
                            />
                        );
                    })}
                </Box>

                {/* Grid lines overlay - only show for empty cells */}
                <GridLines
                    rowHeights={gridData.rowHeights}
                    columnWidths={gridData.columnWidths}
                    isPositionOccupied={isPositionOccupied}
                    addSash={addSash}
                />

                {/* Dimension labels */}
                <DimensionLabels
                    rowHeights={gridData.rowHeights}
                    columnWidths={gridData.columnWidths}
                    onColumnWidthChange={updateColumnWidth}
                    onRowHeightChange={updateRowHeight}
                />
            </Box>
        </Box>
    );
};

export default WindowUnitGrid;
