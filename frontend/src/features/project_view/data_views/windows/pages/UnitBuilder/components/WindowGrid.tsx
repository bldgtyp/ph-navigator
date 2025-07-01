import React from 'react';
import { Box } from '@mui/material';
import GridCell from './GridCell';
import GridLines from './GridLines';
import { WindowGridData } from './types';

interface WindowGridProps {
    gridData: WindowGridData;
    isPositionOccupied: (row: number, col: number) => boolean;
    addSash: (row: number, col: number) => void;
    getCellSize: (row: number, col: number, rowSpan: number, colSpan: number) => { width: number; height: number };
}

const WindowGrid: React.FC<WindowGridProps> = ({ gridData, isPositionOccupied, addSash, getCellSize }) => {
    return (
        <Box className="window-cells-container" sx={{ position: 'relative' }}>
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
                }}
            >
                {Array.from(gridData.cells.values()).map(cell => {
                    const { width, height } = getCellSize(cell.row, cell.col, cell.rowSpan, cell.colSpan);
                    return <GridCell key={cell.id} cell={cell} width={width} height={height} />;
                })}
            </Box>

            {/* Grid lines overlay */}
            <GridLines
                rowHeights={gridData.rowHeights}
                columnWidths={gridData.columnWidths}
                isPositionOccupied={isPositionOccupied}
                addSash={addSash}
            />
        </Box>
    );
};

export default WindowGrid;
